const _ = require('lodash');
const moment = require('moment');
const { assertApp, assertPeer, AppError, PeerError, errorCodes } = require('./error-handling');
const log = require('./log');
const users = require('./users');
const db = require('./db');
const SUBSCRIPTION_COST = 100;

async function depositCredits (dbClient, userId, amount) {
  assertApp(_.isObject(dbClient), `got ${typeof dbClient} but expected object`);
  assertApp(typeof userId === 'number');
  assertApp(typeof amount === 'number');
  assertApp(amount > 0, 'tried to deposit a non-positive amount of credits.');
  assertPeer(
    await users.userExists(dbClient, { userId }),
    `user with id ${userId} does not exist`,
    errorCodes.userDoesNotExist,
  );

  log.info(`Depositing ${amount} credits into user ${userId}.`);

  const { rows: creditRows } = await dbClient.executeQuery(
    `
      UPDATE users
      SET credits = credits + $1
      WHERE
        id=$2 AND
        active=true
      RETURNING *
    `,
    [amount, userId],
  );

  assertApp(
    Array.isArray(creditRows),
    `database returned invalid data type while depositing credits - ${typeof creditRows}`,
  );
  assertApp(
    creditRows.length === 1,
    `deposited on too many/too few users. row count - ${creditRows.length}`,
  );

  log.info(`New credits of user ${userId} are = ${amount}`);

  const accountTransfer = await dbClient.insert(
    'account_transfers',
    {
      user_id: userId,
      transfer_amount: amount,
      transferred_at: new Date().toISOString(),
    },
  );

  log.info('Account transfer id is - ', accountTransfer.id);

  return accountTransfer;
}

async function taxUser (dbClient, userId, amount) {
  assertApp(_.isObject(dbClient), `got ${dbClient}`);
  assertApp(typeof userId === 'number', `got ${userId}`);
  // a service can be free, but it should be recorded as free of tax
  assertApp(typeof amount === 'number' && amount >= 0, `got ${amount}`);
  assertPeer(
    await users.userExists(dbClient, { userId }),
    `user with id ${userId} does not exist.`,
  );

  log.info(`Taxing user ${userId} with amount=${amount}`);

  const { rows: creditRows } = await dbClient.executeQuery(
    `
      UPDATE users
      SET credits = credits - $1
      WHERE
        id=$2 AND
        active=true AND
        credits - $1 >= 0
      RETURNING *
    `,
    [amount, userId],
  );

  assertApp(
    Array.isArray(creditRows),
    `executeQuery returned a non-array value - ${typeof creditRows}`,
  );

  if (creditRows.length === 0) {
    throw new PeerError(
      `User ${userId} does not have enough credits.`,
      errorCodes.notEnoughCredits,
    );
  } else if (creditRows.length > 1) {
    throw new AppError(`Tried to only tax user with id ${userId} but taxed ${creditRows.length} users.`);
  }

  log.info(`Set credits of user ${userId} to ${creditRows[0].credits}`);
  log.info(`Recording account transfer for ${userId}.`);

  const accountTransfer = await dbClient.insert(
    'account_transfers',
    {
      user_id: userId,
      transfer_amount: -amount,
      transferred_at: new Date().toISOString(),
    },
  );

  log.info(`Account transfer id is ${accountTransfer.id}`);

  return accountTransfer;
}

async function subscriptionIsTaxedDeprecated (dbClient, userSubscriptionId) {
  log.warn('subscriptionIsTaxed is deprecated');
  assertApp(_.isObject(dbClient), `got ${dbClient}`);
  assertApp(Number.isInteger(userSubscriptionId), `got ${userSubscriptionId}`);

  const { rows: subscrTransfer } = await dbClient.executeQuery(
    `
    SELECT * FROM user_subscription_account_transfers
    WHERE user_subscription_id = $1
    `,
    [userSubscriptionId],
  );
  assertApp(Array.isArray(subscrTransfer), `bad db response - ${subscrTransfer}`);
  assertApp(
    subscrTransfer.length <= 1,
    `user subscription ${userSubscriptionId} is taxed more than once`,
  );

  return subscrTransfer.length === 1;
}

async function taxSubscribeDeprecated (dbClient, userId, userSubscriptionId) {
  log.warn('taxSubscribe is deprecated');
  assertApp(_.isObject(dbClient), `got ${dbClient}`);
  assertApp(typeof userId === 'number', `got ${userId}`);
  assertApp(typeof userSubscriptionId === 'number', `got ${userSubscriptionId}`);

  log.info(`Taxing user ${userId} for subscription ${userSubscriptionId}`);

  const transfer = await taxUser(dbClient, userId, SUBSCRIPTION_COST);

  log.info(`Linking account transfer ${transfer.id} with user subscription ${userSubscriptionId}`);

  // unique constrain error is thrown here if a subscription has been reactivated instead of created
  // and userSubscriptionId has already been taxed. - can happen during concurrent requests
  const subscrTransfer = await dbClient.insert(
    'user_subscription_account_transfers',
    {
      'account_transfer_id': transfer.id,
      'user_subscription_id': userSubscriptionId,
    },
  );

  log.info('user_subscription_account_transfer id is', subscrTransfer.id);

  return subscrTransfer;
}

async function registerTransferByEmployee (dbClient, accountTransferId, employeeId) {
  assertApp(_.isObject(dbClient), `got ${typeof dbClient} but expected object`);
  assertApp(
    typeof accountTransferId === 'number',
    `expected accountTransferId to be number but got ${typeof accountTransferId} instead - ${accountTransferId}`,
  );
  assertApp(
    typeof employeeId === 'number',
    `expected employeeId to be number but got ${typeof employeeId} instead - ${employeeId}`,
  );

  log.info(`Registering transfer ${accountTransferId} from employee ${employeeId}`);

  const insertResult = await dbClient.executeQuery(`
    INSERT INTO account_transfers_by_employees
      (account_transfer_id, employee_id)
    VALUES
      ($1, $2)
    RETURNING *;
  `, [accountTransferId, employeeId]);

  assertApp(_.isObject(insertResult), `got ${insertResult}`);
  assertApp(Array.isArray(insertResult.rows), `got ${insertResult.rows}`);
  assertApp(insertResult.rows.length === 1, `got ${insertResult.rows.length}`);

  const accountTransferByEmployee = insertResult.rows[0];

  log.info('account_transfers_by_employee id is', accountTransferByEmployee.id);

  return accountTransferByEmployee;
}

async function getAccountTransfers (dbClient, filters, groupings) {
  let offset;

  if (filters.limit) {
    offset = filters.offset;
  } else {
    offset = 0;
  }

  const useDateTrunc = function (column, timePrecision) {
    if (timePrecision == null) {
      return column;
    }

    // TODO escape timePrecision
    return `date_trunc('${timePrecision}', ${column})`;
  };

  const ignoreDeposits = function (column) {
    return `CASE WHEN ${column} < 0 THEN ${column} ELSE 0 END * -1`;
  };

  const ignoreWithdrawals = function (column) {
    return `CASE WHEN ${column} > 0 THEN ${column} ELSE 0 END`;
  };

  const depositIfAmountPositiveElseWitihdrawal = function (column) {
    return `CASE WHEN ${column} > 0 THEN 'deposit' ELSE 'withdrawal' END`;
  };

  // TODO this is ugly hack, fix it:
  const resolveTransferReason = function () {
    return `

      CASE
      WHEN "user_subscription_account_transfers"."id" IS NOT NULL THEN 'user subscription'
      WHEN "subscriptions_fetches_account_transfers"."id" IS NOT NULL THEN 'fetch'
      WHEN "account_transfers_by_employees"."id" IS NOT NULL THEN 'employee'
      ELSE 'unknown'
      END

    `;
  };

  const columnsConfig = [
    {
      isSet: false,
      isGroupable: true,
      isAggregatable: false,
      table: null,
      column: 'transferred_at',
      alias: 'transferred_at',
      transform: useDateTrunc,
      groupingsSettingName: 'transferred_at', // TODO change name
    },
    {
      isSet: false,
      isGroupable: true,
      isAggregatable: false,
      table: 'account_transfers',
      column: 'transfer_amount',
      alias: 'type',
      transform: depositIfAmountPositiveElseWitihdrawal,
      groupingsSettingName: 'type',
    },
    { // TODO FIX this is ugly hack:
      isSet: false,
      isGroupable: true,
      isAggregatable: false,
      table: '', // doesn't matter
      column: '', // doesn't matter
      alias: 'reason',
      transform: resolveTransferReason,
      groupingsSettingName: 'reason',
    },
    {
      isSet: true,
      isGroupable: true,
      isAggregatable: false,
      set: [
        {
          table: 'account_transfers',
          column: 'user_id',
          alias: 'account_owner_id',
          transform: null,
        },
        {
          table: 'users',
          column: 'email',
          alias: 'account_owner_email',
          transform: null,
        },
      ],
      groupingsSettingName: 'user', // TODO change name
    },
    {
      isSet: false,
      isGroupable: true,
      isAggregatable: false,
      table: 'a3',
      column: 'name',
      alias: 'subscr_airport_from_name',
      transform: null,
      groupingsSettingName: 'subscr_airport_from',
    },
    {
      isSet: false,
      isGroupable: true,
      isAggregatable: false,
      table: 'a4',
      column: 'name',
      alias: 'subscr_airport_to_name',
      transform: null,
      groupingsSettingName: 'subscr_airport_to',
    },
    {
      isSet: false,
      isGroupable: true,
      isAggregatable: false,
      table: null,
      column: 'fetch_time',
      alias: null,
      transform: useDateTrunc,
      groupingsSettingName: 'fetch_time',
    },
    {
      isSet: true,
      isGroupable: true,
      isAggregatable: false,
      set: [
        {
          table: 'employees',
          column: 'id',
          alias: 'employee_transferrer_id',
          transform: null,
        },
        {
          table: 'employees',
          column: 'email',
          alias: 'employee_transferrer_email',
          transform: null,
        },
      ],
      groupingsSettingName: 'employee',
    },
    {
      isSet: false,
      isGroupable: true,
      isAggregatable: false,
      table: 'a1',
      column: 'name',
      alias: 'user_subscr_airport_from_name',
      transform: null,
      groupingsSettingName: 'user_subscr_airport_from',
    },
    {
      isSet: false,
      isGroupable: true,
      isAggregatable: false,
      table: 'a2',
      column: 'name',
      alias: 'user_subscr_airport_to_name',
      transform: null,
      groupingsSettingName: 'user_subscr_airport_to',
    },
    {
      isSet: false,
      isGroupable: true,
      isAggregatable: false,
      table: 'users_subscriptions',
      column: 'date_from',
      alias: 'user_subscr_date_from',
      transform: useDateTrunc,
      groupingsSettingName: 'user_subscr_date_from',
    },
    {
      isSet: false,
      isGroupable: true,
      isAggregatable: false,
      table: 'users_subscriptions',
      column: 'date_to',
      alias: 'user_subscr_date_to',
      transform: useDateTrunc,
      groupingsSettingName: 'user_subscr_date_to',
    },
    {
      isSet: true,
      isGroupable: false,
      isAggregatable: true,
      set: [
        {
          table: null,
          column: 'transfer_amount',
          alias: 'deposit_amount',
          transform: ignoreWithdrawals,
        },
        {
          table: null,
          column: 'transfer_amount',
          alias: 'withdrawal_amount',
          transform: ignoreDeposits,
        },
      ],
      aggregateFunction: 'sum',
    },
    {
      isSet: false,
      isGroupable: false,
      isAggregatable: false,
      table: 'account_transfers',
      column: 'id',
      alias: 'account_transfer_id',
      transform: null,
    },
  ];

  const {
    selectColumnsPart,
    groupColumns,
    activeColumns,
  } = db.buildGroupingParams(columnsConfig, groupings);

  const queryValues = [
    filters.user,
    filters.transferred_at_from,
    filters.transferred_at_to,
    filters.deposits,
    filters.withdrawals,
    filters.transfers_by_employees,
    filters.new_subsctiption_taxes,
    filters.new_fetch_taxes,
    filters.subscr_airport_from,
    filters.subscr_airport_to,
    filters.fetch_time_from,
    filters.fetch_time_to,
    filters.employee_email,
    filters.user_subscr_airport_from,
    filters.user_subscr_airport_to,
    filters.user_subscr_depart_time_from,
    filters.user_subscr_depart_time_to,
    filters.user_subscr_arrival_time_from,
    filters.user_subscr_arrival_time_to,
    offset,
  ];

  if (filters.limit) {
    queryValues.push(filters.limit);
  }

  let selectAccountTransfersResult;
  let accountTransfers = [];
  let isReachedTimeout = false;

  try {
    //await dbClient.executeQuery('SET statement_timeout TO 15000;');

    selectAccountTransfersResult = await dbClient.executeQuery(`

      SELECT
        ${selectColumnsPart}
        ${groupColumns.length > 0 ? ', COUNT(*) AS grouped_amount' : ''}
      FROM account_transfers
      LEFT JOIN users
        ON account_transfers.user_id = users.id
      LEFT JOIN user_subscription_account_transfers
        ON user_subscription_account_transfers.account_transfer_id = account_transfers.id
      LEFT JOIN subscriptions_fetches_account_transfers
        ON subscriptions_fetches_account_transfers.account_transfer_id = account_transfers.id
      LEFT JOIN account_transfers_by_employees
        ON account_transfers_by_employees.account_transfer_id = account_transfers.id
      LEFT JOIN employees
        ON employees.id = account_transfers_by_employees.employee_id
      LEFT JOIN users_subscriptions
        ON user_subscription_account_transfers.user_subscription_id = users_subscriptions.id
      LEFT JOIN subscriptions s1
        ON users_subscriptions.subscription_id = s1.id
      LEFT JOIN airports a1
        ON s1.airport_from_id = a1.id
      LEFT JOIN airports a2
        ON s1.airport_to_id = a2.id
      LEFT JOIN subscriptions_fetches
        ON subscriptions_fetches_account_transfers.subscription_fetch_id = subscriptions_fetches.id
      LEFT JOIN subscriptions s2
        ON subscriptions_fetches.subscription_id = s2.id
      LEFT JOIN airports a3
        ON s2.airport_from_id = a3.id
      LEFT JOIN airports a4
        ON s2.airport_to_id = a4.id
      LEFT JOIN fetches
        ON subscriptions_fetches.fetch_id = fetches.id
      WHERE
        (
          $1::text IS NULL OR
          users.email = $1
        ) AND
        (
          $2::text IS NULL OR
          transferred_at::date >= to_date($2, 'YYYY-MM-DD')
        ) AND
        (
          $3::text IS NULL OR
          transferred_at::date <= to_date($3, 'YYYY-MM-DD')
        ) AND
        (
          (
            $4 = true AND
            transfer_amount >= 0
          ) OR
          (
            $5 = true AND
            transfer_amount <= 0
          )
        ) AND
        (
          (
            $6 = true AND
            employees.id IS NOT NULL
          ) OR
          (
            $7 = true AND
            users_subscriptions.date_to IS NOT NULL
          ) OR
          (
            $8 = true AND
            fetch_time IS NOT NULL
          )
        ) AND
        (
          $9::text IS NULL OR
          a3.name = $9
        ) AND
        (
          $10::text IS NULL OR
          a4.name = $10
        ) AND
        (
          $11::text IS NULL OR
          fetch_time >= to_timestamp($11, 'YYYY-MM-DDTHH24:MI:SS')
        ) AND
        (
          $12::text IS NULL OR
          fetch_time <= to_timestamp($12, 'YYYY-MM-DDTH24:MI:SS')
        ) AND
        (
          $13::text IS NULL OR
          employees.email = $13
        ) AND
        (
          $14::text IS NULL OR
          a1.name = $14
        ) AND
        (
          $15::text IS NULL OR
          a2.name = $15
        ) AND
        (
          $16::text IS NULL OR
          users_subscriptions.date_from >= to_date($16, 'YYYY-MM-DD')
        ) AND
        (
          $17::text IS NULL OR
          users_subscriptions.date_from <= to_date($17, 'YYYY-MM-DD')
        ) AND
        (
          $18::text IS NULL OR
          users_subscriptions.date_to >= to_date($18, 'YYYY-MM-DD')
        ) AND
        (
          $19::text IS NULL OR
          users_subscriptions.date_to <= to_date($19, 'YYYY-MM-DD')
        )
      ${groupColumns.length > 0 ? `GROUP BY ${groupColumns}` : ''}
      ORDER BY ${groupColumns.length > 0 ? groupColumns : '1'}
      OFFSET $20
      ${filters.limit ? 'LIMIT $21' : ''};

    `, queryValues);

    assertApp(_.isObject(selectAccountTransfersResult), `Expected selectAccountTransfersResult to be an object, but was ${typeof selectAccountTransfersResult}`);
    assertApp(Array.isArray(selectAccountTransfersResult.rows), `Expected selectAccountTransfersResult.rows to be array, but was ${typeof selectAccountTransfersResult.rows}`);

    assertApp(
      groupings.transferred_at === null ||
      typeof groupings.transferred_at === 'string'
    );
    assertApp(
      groupings.user_subscr_date_from === null ||
      typeof groupings.user_subscr_date_from === 'string'
    );
    assertApp(
      groupings.user_subscr_date_to === null ||
      typeof groupings.user_subscr_date_to === 'string'
    );
    assertApp(
      groupings.fetch_time === null ||
      typeof groupings.fetch_time === 'string'
    );

    const truncateDatetime = function (datetime, precision) {
      assertApp(datetime === null || datetime instanceof Date);
      assertApp(precision === null || typeof precision === 'string');

      if (datetime === null) {
        return datetime;
      } else if (precision === null) {
        return datetime.toISOString();
      }

      const precisionsFormats = {
        'none': 'Y-MM-DDTHH:mm:ss.SSSZ',
        'second': 'Y-MM-DDTHH:mm:ss',
        'minute': 'Y-MM-DDTHH:mm',
        'hour': 'Y-MM-DDTHH',
        'day': 'Y-MM-DD',
        'week': 'Y-MM,WW',
        'month': 'Y-MM',
        'year': 'Y',
      };
      assertApp(Object.keys(precisionsFormats).includes(precision));

      const result = moment(datetime).format(precisionsFormats[precision]);

      return result;
    };

    accountTransfers = selectAccountTransfersResult.rows.map(row => ({
      account_transfer_id: row.account_transfer_id || null,
      account_owner_email: row.account_owner_email || null,
      account_owner_id: String(row.account_owner_id),
      deposit_amount: Number(row.deposit_amount),
      withdrawal_amount: Number(row.withdrawal_amount),
      transferred_at: (row.transferred_at && truncateDatetime(row.transferred_at, groupings.transferred_at)) || null,
      type: row.type || null,
      reason: row.reason || null,
      employee_transferrer_id:
        row.employee_transferrer_id == null ? null : String(row.employee_transferrer_id),
      employee_transferrer_email: row.employee_transferrer_email || null,
      user_subscr_airport_from_name: row.user_subscr_airport_from_name || null,
      user_subscr_airport_to_name: row.user_subscr_airport_to_name || null,
      user_subscr_date_from: (row.user_subscr_date_from &&
        truncateDatetime(row.user_subscr_date_from, groupings.user_subscr_date_from)) || null,
      user_subscr_date_to: (row.user_subscr_date_to &&
        truncateDatetime(row.user_subscr_date_to, groupings.user_subscr_date_to)) || null,
      subscr_airport_from_name: row.subscr_airport_from_name || null,
      subscr_airport_to_name: row.subscr_airport_to_name || null,
      fetch_time: (row.fetch_time && truncateDatetime(row.fetch_time, groupings.fetch_time)) || null,
      grouped_amount: row.grouped_amount || null,
    }));

    //await dbClient.executeQuery('SET statement_timeout TO DEFAULT;');
  } catch (error) {
    if (error.code === '57014') {
      isReachedTimeout = true;
    } else {
      throw error;
    }
  }

  return {
    isReachedTimeout,
    accountTransfers,
    activeColumns,
  };
}

module.exports = {
  depositCredits,
  taxUser,
  taxSubscribeDeprecated,
  subscriptionIsTaxedDeprecated,
  registerTransferByEmployee,
  getAccountTransfers,
};
