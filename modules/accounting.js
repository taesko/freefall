const _ = require('lodash');

const { assertApp, assertPeer, AppError, PeerError, errorCodes } = require('./error-handling');
const log = require('./log');
const users = require('./users');
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

  // TODO remove
  groupings = {
    email: true,
    datetime: null,
  };

  const queryValues = [
    filters.user_email,
    filters.datetime_from,
    filters.datetime_to,
    filters.deposits,
    filters.withdrawals,
    filters.transfers_by_employees,
    filters.new_subsctiption_taxes,
    filters.new_fetch_taxes,
    offset,
    groupings.datetime,
  ];

  const useDateTrunc = function (column, timePrecision) {
    if (timePrecision == null) {
      return column;
    }

    return `date_trunc('${timePrecision}', ${column})`;
  };

  const selectColumns = [
    {
      isSet: false,
      isGroupable: false,
      isAggregatable: false,
      column: 'account_transfers.id',
      alias: 'account_transfer_id',
      transform: null,
    },
    {
      isSet: false,
      isGroupable: false,
      isAggregatable: true,
      column: 'transfer_amount',
      alias: null,
      aggregateFunction: 'sum',
      transform: null,
    },
    {
      isSet: false,
      isGroupable: true,
      isAggregatable: false,
      column: 'transferred_at',
      alias: 'transferred_at',
      transform: useDateTrunc,
      groupingsSettingName: 'datetime', // TODO change name
    },
    {
      isSet: true,
      isGroupable: true,
      isAggregatable: false,
      set: [
        {
          column: 'account_transfers.user_id',
          alias: 'account_owner_id',
          transform: null,
        },
        {
          column: 'users.email',
          alias: 'account_owner_email',
          transform: null,
        },
      ],
      groupingsSettingName: 'email', // TODO change name
    },
    {
      isSet: true,
      isGroupable: true,
      isAggregatable: false,
      set: [
        {
          column: 'employees.id',
          alias: 'employee_transferrer_id',
          transform: null,
        },
        {
          column: 'employees.email',
          alias: 'employee_transferrer_email',
          transform: null,
        }
      ],
    },
    {
      isSet: false,
      isGroupable: true,
      isAggregatable: false,
      column: 'a1.name',
      alias: 'user_subscr_airport_from_name',
      transform: null,
    },
    {
      isSet: false,
      isGroupable: true,
      isAggregatable: false,
      column: 'a2.name',
      alias: 'user_subscr_airport_to_name',
      transform: null,
    },
    {
      isSet: false,
      isGroupable: true,
      isAggregatable: false,
      column: 'users_subscriptions.date_from',
      alias: 'user_subscr_date_from',
      transform: useDateTrunc,
    },
    {
      isSet: false,
      isGroupable: true,
      isAggregatable: false,
      column: 'users_subscriptions_date_to',
      alias: 'user_subscr_date_to',
      transform: useDateTrunc,
    },
    {
      isSet: false,
      isGroupable: true,
      isAggregatable: false,
      column: 'a3.name',
      alias: 'subscr_airport_from_name',
      transform: null,
    },
    {
      isSet: false,
      isGroupable: true,
      isAggregatable: false,
      column: 'a4.name',
      alias: 'subscr_airport_to_name',
      transform: null,
    },
    {
      isSet: false,
      isGroupable: true,
      isAggregatable: false,
      column: 'fetch_time',
      alias: null,
      transform: useDateTrunc,
    },
  ];

  let querySelectColumnsPart;
  let queryGroupByPart;

  {
    let querySelectColumns = [];
    let queryGroupBy = [];

    const areNoGroupings = Object.values(groupings)
      .every((grouping) => grouping == null);

    for (let i = 0; i < selectColumns.length; i++) {
      let querySelectColumn = '';

      if (areNoGroupings) {
        const columns = [];

        if (selectColumns[i].isSet) {
          columns.push(...selectColumns[i].set);
        } else {
          columns.push(selectColumns[i]);
        }

        for (const column of columns) {
          if (column.transform != null) {
            querySelectColumn += column.transform(column.column, groupings.datetime);
          } else {
            querySelectColumn += column.column;
          }
        }
      } else {
        for (const [groupingName, groupingValue] of Object.entries(groupings)) {
          const columns = [];

          if (selectColumns[i].isSet) {
            columns.push(...selectColumns[i].set);
          } else {
            columns.push(selectColumns[i]);
          }

          for (const column of columns) {
            if (column.transform != null) {
              querySelectColumn += column.transform(column.column, groupings.datetime);
            } else {
              querySelectColumn += column.column;
            }

            if (column.isAggregatable) {
              querySelectColumn += `${column.aggregateFunction}(${column.column})`;
            }
          }
        }
      }

      if (selectColumns[i].alias != null) {
        querySelectColumn += `AS ${selectColumns[i].alias}`;
      }
    }

    querySelectColumnsPart = querySelectColumns.join(',');
    queryGroupByPart = queryGroupBy.join(',');
  }

  if (filters.limit) {
    queryValues.push(filters.limit);
  }

  console.log(areNoGroupings);
  console.log(groupings.datetime == null);

  const selectAccountTransfersResult = await dbClient.executeQuery(`

    SELECT
      ${areNoGroupings ? 'account_transfers.id' : 'NULL'} AS account_transfer_id,
      ${areNoGroupings ? 'transfer_amount' : 'sum(transfer_amount)'},
      ${areNoGroupings ? 'transferred_at' : groupings.datetime == null ? 'NULL' : 'date_trunc($10::text, transferred_at)'} AS transferred_at,
      account_transfers.user_id AS account_owner_id,
      users.email AS account_owner_email,
      ${areNoGroupings ? 'employees.id' : 'NULL'} AS employee_transferrer_id,
      ${areNoGroupings ? 'employees.email' : 'NULL'} AS employee_transferrer_email,
      ${areNoGroupings ? 'a1.name' : 'NULL'} AS user_subscr_airport_from_name,
      ${areNoGroupings ? 'a2.name' : 'NULL'} AS user_subscr_airport_to_name,
      ${areNoGroupings ? 'users_subscriptions.date_from' : 'NULL'} AS user_subscr_date_from,
      ${areNoGroupings ? 'users_subscriptions.date_to' : 'NULL'} AS user_subscr_date_to,
      ${areNoGroupings ? 'a3.name' : 'NULL'} AS subscr_airport_from_name,
      ${areNoGroupings ? 'a4.name' : 'NULL'} AS subscr_airport_to_name,
      ${areNoGroupings ? 'fetch_time' : 'NULL'}
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
      )  AND
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
      )
    GROUP BY account_owner_id, account_owner_email
    ORDER BY transferred_at
    OFFSET $9
    ${filters.limit ? 'LIMIT $11' : ''};

  `, queryValues);


  /*const queryValues = [
    filters.user_email,
    filters.date_from,
    filters.date_to,
    filters.deposits,
    filters.withdrawals,
    filters.transfers_by_employees,
    filters.new_subsctiption_taxes,
    filters.new_fetch_taxes,
    offset,
  ];

    if (filters.limit) {
      queryValues.push(filters.limit);
    }

    const selectAccountTransfersResult = await dbClient.executeQuery(`

      SELECT
        account_transfers.id AS account_transfer_id,
        transfer_amount,
        transferred_at,
        account_transfers.user_id AS account_owner_id,
        users.email AS account_owner_email,
        employees.id AS employee_transferrer_id,
        employees.email AS employee_transferrer_email,
        a1.name AS user_subscr_airport_from_name,
        a2.name AS user_subscr_airport_to_name,
        users_subscriptions.date_from AS user_subscr_date_from,
        users_subscriptions.date_from AS user_subscr_date_to,
        a3.name AS subscr_airport_from_name,
        a4.name AS subscr_airport_to_name,
        fetch_time
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
        )
      ORDER BY transferred_at
      OFFSET $9
      ${filters.limit ? 'LIMIT $10' : ''};

    `, queryValues);*/

  assertApp(_.isObject(selectAccountTransfersResult), `Expected selectAccountTransfersResult to be an object, but was ${typeof selectAccountTransfersResult}`);
  assertApp(Array.isArray(selectAccountTransfersResult.rows), `Expected selectAccountTransfersResult.rows to be array, but was ${typeof selectAccountTransfersResult.rows}`);

  const accountTransfersUsersRows = selectAccountTransfersResult.rows;

  const accountTransfers = accountTransfersUsersRows.map(row => ({
    account_transfer_id: row.account_transfer_id,
    user: {
      email: row.account_owner_email,
      id: String(row.account_owner_id),
    },
    deposit_amount: (row.transfer_amount > 0) ? row.transfer_amount : null,
    withdrawal_amount:
      (row.transfer_amount < 0) ? row.transfer_amount * -1 : null,
    transferred_at: row.transferred_at.toISOString(),
    employee_transferrer_id:
      row.employee_transferrer_id == null ? null : String(row.employee_transferrer_id),
    employee_transferrer_email: row.employee_transferrer_email,
    user_subscr_airport_from_name: row.user_subscr_airport_from_name,
    user_subscr_airport_to_name: row.user_subscr_airport_to_name,
    user_subscr_date_from: row.user_subscr_date_from &&
      row.user_subscr_date_from.toISOString(),
    user_subscr_date_to: row.user_subscr_date_to &&
      row.user_subscr_date_to.toISOString(),
    subscr_airport_from_name: row.subscr_airport_from_name,
    subscr_airport_to_name: row.subscr_airport_to_name,
    fetch_time: row.fetch_time && row.fetch_time.toISOString(),
  }));

  return accountTransfers;
}

module.exports = {
  depositCredits,
  taxUser,
  taxSubscribeDeprecated,
  subscriptionIsTaxedDeprecated,
  registerTransferByEmployee,
  getAccountTransfers,
};
