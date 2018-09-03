/* eslint-disable camelcase */
const { defineAPIMethod } = require('./resolve-method');
const { assertPeer, assertApp, assertUser, errorCodes } = require('../modules/error-handling');
const { toSmallestCurrencyUnit } = require('../modules/utils');
const { isObject } = require('lodash');
const log = require('../modules/log');
const auth = require('../modules/auth');
const moment = require('moment');
const subscriptions = require('../modules/subscriptions');
const users = require('../modules/users');
const accounting = require('../modules/accounting');

const SERVER_DATE_FORMAT = 'Y-MM-DD';
const SERVER_TIME_FORMAT = 'Y-MM-DDTHH:mm:ssZ';
const SEARCH_MONTHS_AHEAD = 1;
const MAX_PRICE_TO = Math.pow(10, 6); // 10k in cents
const DEFAULT_PRICE_TO = MAX_PRICE_TO - 100;
const MAX_SEARCH_PAGE_LIMIT = 20;
const DEFAULT_SEARCH_PAGE_LIMIT = 5;
const DEFAULT_SEARCH_PAGE_OFFSET = 0;
const MAX_FLY_DURATION = 48;
const DEFAULT_MAX_FLY_DURATION = 24;

const LIST_SUBSCRIPTIONS_DEFAULT_LIMIT = 5;
const CREDIT_HISTORY_DEFAULT_LIMIT = 10;
const CREDIT_HISTORY_MAX_LIMIT = 20;

async function airportIDExists (dbClient, airportID) {
  assertApp(isObject(dbClient), `got ${dbClient}`);
  assertApp(Number.isInteger(airportID), `got ${airportID}`);

  log.debug(`Checking if airport id=${airportID} exists.`);

  const { rows } = await dbClient.executeQuery(
    `
      SELECT 1
      FROM airports
      WHERE airports.id=$1
    `,
    [airportID],
  );

  assertApp(rows.length < 2);

  return rows.length === 1;
}

const search = defineAPIMethod(
  {
    'SEARCH_BAD_FLY_FROM': {
      status_code: '2000',
      currency: 'USD',
      routes: [],
    },
    'SEARCH_BAD_FLY_TO': {
      status_code: '2000',
      currency: 'USD',
      routes: [],
    },
    'SEARCH_INVALID_FLY_FROM': {
      status_code: '2000',
      currency: 'USD',
      routes: [],
    },
    'SEARCH_INVALID_FLY_TO': {
      status_code: '2000',
      currency: 'USD',
      routes: [],
    },
    'SEARCH_INVALID_DATE_RANGE': {
      status_code: '2000',
      currency: 'USD',
      routes: [],
    },
    'SEARCH_EARLY_DATE_FROM': {
      status_code: '2000',
      currency: 'USD',
      routes: [],
    },
    'SEARCH_BAD_PRICE_TO': {
      status_code: '2000',
      currency: 'USD',
      routes: [],
    },
    'SEARCH_INVALID_PRICE_TO': {
      status_code: '2000',
      currency: 'USD',
      routes: [],
    },
    'SEARCH_BAD_LIMIT': {
      status_code: '2000',
      currency: 'USD',
      routes: [],
    },
    'SEARCH_INVALID_LIMIT': {
      status_code: '2000',
      currency: 'USD',
      routes: [],
    },
    'SEARCH_BAD_OFFSET': {
      status_code: '2000',
      currency: 'USD',
      routes: [],
    },
    'SEARCH_INVALID_OFFSET': {
      status_code: '2000',
      currency: 'USD',
      routes: [],
    },
    'SEARCH_BAD_MAX_FLY_DURATION': {
      status_code: '2000',
      currency: 'USD',
      routes: [],
    },
  },
  async (params, dbClient) => {
    assertApp(isObject(params), `got ${params}`);
    assertApp(isObject(dbClient), `got ${dbClient}`);

    const flyFrom = +params.fly_from;
    const flyTo = +params.fly_to;

    assertPeer(Number.isInteger(flyFrom), `got ${flyFrom}`, 'SEARCH_BAD_FLY_FROM');
    assertPeer(Number.isInteger(flyTo), `got ${flyTo}`, 'SEARCH_BAD_FLY_TO');

    const flyFromExists = await airportIDExists(dbClient, flyFrom);
    const flyToExists = await airportIDExists(dbClient, flyTo);

    assertPeer(flyFromExists, `got ${flyFrom}`, 'SEARCH_INVALID_FLY_FROM');
    assertPeer(flyToExists, `got ${flyTo}`, 'SEARCH_INVALID_FLY_TO');

    const dateFrom = moment(params.date_from);
    let dateTo;

    if (params.date_to) {
      dateTo = moment(params.date_to);
    } else {
      dateTo = moment().add(SEARCH_MONTHS_AHEAD, 'months');
    }

    assertPeer(dateFrom < dateTo, `dateFrom=${dateFrom}, dateTo=${dateTo}`,
      'SEARCH_INVALID_DATE_RANGE',
    );
    assertPeer(moment().add(-1, 'days') < dateFrom, `dateFrom=${dateFrom}`,
      'SEARCH_EARLY_DATE_FROM',
    );

    const priceTo = toSmallestCurrencyUnit(params.price_to) || DEFAULT_PRICE_TO;

    assertPeer(Number.isInteger(priceTo), `got ${priceTo}`, 'SEARCH_BAD_PRICE_TO');
    assertPeer(priceTo > 0 && priceTo <= MAX_PRICE_TO, `got ${priceTo}`, 'SEARCH_INVALID_PRICE_TO');

    const limit = params.limit || DEFAULT_SEARCH_PAGE_LIMIT;
    const offset = params.offset || DEFAULT_SEARCH_PAGE_OFFSET;

    assertPeer(Number.isInteger(limit), `got ${limit}`, 'SEARCH_BAD_LIMIT');
    assertPeer(limit > 0 && limit <= MAX_SEARCH_PAGE_LIMIT, `got ${limit}`, 'SEARCH_INVALID_LIMIT');
    assertPeer(Number.isInteger(offset), `got ${offset}`, 'SEARCH_BAD_OFFSET');
    assertPeer(offset >= 0, `got ${offset}`, 'SEARCH_INVALID_OFFSET');

    const currency = params.currency;
    // eslint-disable-next-line max-len
    const maxFlightDuration = params.max_fly_duration || DEFAULT_MAX_FLY_DURATION;

    assertPeer(
      maxFlightDuration < MAX_FLY_DURATION,
      `got ${maxFlightDuration}`,
      'SEARCH_INVALID_FLY_DURATION',
    );

    assertPeer(
      maxFlightDuration > 0,
      `got ${maxFlightDuration}`,
      `SEARCH_INVALID_MAX_FLY_DURATION`,
    );

    const subscribed = await subscriptions.globalSubscriptionExists(
      dbClient,
      +params.fly_from,
      +params.fly_to,
    );

    if (!subscribed) {
      await subscriptions.subscribeGlobally(
        dbClient,
        +params.fly_from,
        +params.fly_to,
      );

      return {
        status_code: '1001',
        routes: [],
        currency,
      };
    }

    const { rows: subscrIDRows } = await dbClient.executeQuery(
      `
      SELECT subscriptions_fetches.id
      FROM subscriptions_fetches
      LEFT JOIN fetches ON fetches.id = subscriptions_fetches.fetch_id
      LEFT JOIN subscriptions ON subscriptions.id = subscriptions_fetches.subscription_id
      WHERE
        subscriptions.airport_from_id = $1 AND
        subscriptions.airport_to_id = $2 AND
        fetches.fetch_time = (SELECT MAX(fetches.fetch_time) FROM fetches)
      `,
      [flyFrom, flyTo],
    );

    if (subscrIDRows.length === 0) {
      return {
        status_code: '1002',
        routes: [],
        currency,
      };
    }

    const { id: subscrID } = subscrIDRows[0];

    const { rows: routeIDRows } = await dbClient.executeQuery(
      `
      SELECT route_id, price, booking_token
      FROM search_view
      WHERE
        dtime::date >= $2::date AND
        atime::date <= $3::date AND
        price <= $4 AND
        subscription_fetch_id = $1
      GROUP BY route_id, price, booking_token
      ORDER BY price, route_id
      LIMIT $5
      OFFSET $6
      `,
      [
        subscrID,
        dateFrom.format(SERVER_TIME_FORMAT),
        dateTo.format(SERVER_TIME_FORMAT),
        priceTo,
        limit,
        offset,
      ],
    );

    const routeIDs = routeIDRows.map(row => row.route_id);

    if (routeIDs.length === 0) {
      return {
        status_code: '1002',
        currency,
        routes: [],
      };
    }

    let placeholders = Array(routeIDs.length)
      .fill('')
      .map((element, index) => `$${index + 1}`)
      .join(',');
    placeholders = `(${placeholders})`;
    const whereClause = `WHERE route_id in ${placeholders}`;

    log.debug('unique route ids are', routeIDs);

    const { rows: routesAndFlights } = await dbClient.executeQuery(
      `
      SELECT *
      FROM search_view
      ${whereClause}
      `,
      routeIDs,
    );

    const routesMeta = {};
    const flightsPerRoute = {};

    for (const routeFlight of routesAndFlights) {
      assertApp(isObject(routeFlight));
      assertApp(Number.isInteger(+routeFlight.route_id));
      assertApp(typeof routeFlight.booking_token === 'string');
      assertApp(Number.isInteger(+routeFlight.price));

      routesMeta[routeFlight.route_id] = {
        booking_token: routeFlight.booking_token,
        price: routeFlight.price / 100, // price is for the total route that the flight is part of
      };

      if (!flightsPerRoute[routeFlight.route_id]) {
        flightsPerRoute[routeFlight.route_id] = [];
      }

      flightsPerRoute[routeFlight.route_id].push(routeFlight);
      delete routeFlight.booking_token;
      delete routeFlight.price;
      delete routeFlight.route_id;
    }

    const routes = [];

    // eslint-disable-next-line camelcase
    for (const route_id of Object.keys(flightsPerRoute)) {
      const totalDurationMS = flightsPerRoute[route_id].reduce(
        (total, flight) => total + (flight.atime - flight.atime),
        0,
      );
      if (totalDurationMS / 1000 / 60 / 60 > maxFlightDuration) {
        continue;
      }

      flightsPerRoute[route_id].sort(
        (flightA, flightB) => new Date(flightA.dtime) - new Date(flightB.dtime),
      );

      const flightCount = flightsPerRoute[route_id].length;
      const first = flightsPerRoute[route_id][0];
      const last = flightsPerRoute[route_id][flightCount - 1];
      const departureAirport = first.airport_from_id;
      const arrivalAirport = last.airport_to_id;

      if (departureAirport !== flyFrom || arrivalAirport !== flyTo) {
        continue;
      }

      routes.push({
        ...routesMeta[route_id],
        route: flightsPerRoute[route_id],
      });
    }

    routes.sort((routeA, routeB) => {
      return routeA.price - routeB.price;
    });

    return {
      status_code: '1000',
      routes,
      currency,
    };
  },
);

const subscribe = defineAPIMethod(
  {
    [errorCodes.subscriptionExists]: {
      status_code: '2000',
      subscription_id: null,
    },
    [errorCodes.notEnoughCredits]: {
      status_code: '2001',
      subscription_id: null,
    },
    'SUBSCR_BAD_FLY_FROM': {
      status_code: '2100',
      subscription_id: null,
    },
    'SUBSCR_BAD_FLY_TO': {
      status_code: '2100',
      subscription_id: null,
    },
    'SUBSCR_BAD_API_KEY': {
      status_code: '2200',
      subscription_id: null,
    },
    'SUBSCRIBE_BAD_DATE': {
      status_code: '2100',
      subscription_id: null,
    },
    'SUBSCR_EARLY_DATE_FROM': {
      status_code: '2100',
      subscription_id: null,
    },
    'SUBSCR_INVALID_FLY_FROM_ID': {
      status_code: '2100',
      subscription_id: null,
    },
    'SUBSCR_INVALID_FLY_TO_ID': {
      status_code: '2100',
      subscription_id: null,
    },
    'SUBSCRIBE_INVALID_PLAN': {
      status_code: '2100',
      subscription_id: null,
    },
  },
  async (params, dbClient) => {
    assertApp(isObject(params));
    const flyFrom = +params.fly_from;
    const flyTo = +params.fly_to;
    const { date_from: dateFrom, date_to: dateTo } = params;
    const { api_key: apiKey, plan } = params;
    const userExists = await users.userExists(dbClient, { apiKey });
    const flyFromExists = await airportIDExists(dbClient, flyFrom);
    const flyToExists = await airportIDExists(dbClient, flyTo);

    assertPeer(Number.isInteger(flyFrom), `got ${flyFrom}`, 'SUBSCR_BAD_FLY_FROM');
    assertPeer(Number.isInteger(flyTo), `got ${flyTo}`, 'SUBSCR_BAD_FLY_TO');
    assertPeer(userExists, `got ${apiKey}`, 'SUBSCR_BAD_API_KEY');
    assertPeer(moment() < moment(dateFrom), `dateFrom=${dateFrom}`, 'SUBSCR_EARLY_DATE_FROM');
    assertPeer(flyFromExists, `got ${flyFrom}`, 'SUBSCR_INVALID_FLY_FROM_ID');
    assertPeer(flyToExists, `got ${flyTo}`, 'SUBSCR_INVALID_FLY_TO_ID');

    // TODO maybe this should be part of the transaction ?
    const { id: userId } = await users.fetchUser(dbClient, { apiKey: apiKey });
    const { id: subscriptionId } = await subscriptions.subscribeUser(
      dbClient,
      userId,
      {
        airportFromId: flyFrom,
        airportToId: flyTo,
        dateFrom,
        dateTo,
        plan,
      },
    );

    // reactivating an old user subscription shouldn't be taxed
    // if subscription has been taxed pass silently.
    // NOTE in concurrent requests the subscription might be taxed after this query
    // unique constraints will fail in that case.
    const { rows: taxedRows } = await dbClient.executeQuery(
      `SELECT 1 FROM user_subscription_account_transfers WHERE user_subscription_id=$1`,
      [subscriptionId],
    );
    assertApp(taxedRows.length <= 1);

    if (taxedRows.length === 1) {
      return {
        subscription_id: `${subscriptionId}`,
        status_code: '1000',
      };
    }

    const planRecord = await subscriptions.fetchSubscriptionPlan(
      dbClient,
      plan
    );
    const { initial_tax: initialTax } = planRecord;
    log.info(`Taxing user ${userId} for subscription ${subscriptionId}`);
    const transfer = await accounting.taxUser(dbClient, userId, initialTax);

    try {
      log.info(`Linking account transfer ${transfer.id} with user subscription ${subscriptionId}`);
      await dbClient.executeQuery(
        `
        INSERT INTO user_subscription_account_transfers
          (account_transfer_id, user_subscription_id)
        VALUES
          ($1, $2)
        `,
        [transfer.id, subscriptionId],
      );
    } catch (e) {
      // unique constraint failed
      log.info(`Subscription already was taxed. Probably by a concurrent request.`);
      assertUser(e.code !== '23505', 'subscription exists', errorCodes.subscriptionExists);
      throw e;
    }

    return {
      subscription_id: `${subscriptionId}`,
      status_code: '1000',
    };
  },
);

const unsubscribe = defineAPIMethod(
  {
    'UNSUBSCR_BAD_USER_SUBSCR_ID': { status_code: '2100' },
    'UNSUBSCR_INVALID_API_KEY': { status_code: '2200' },
    'UNSUBSCR_NOT_ENOUGH_PERMISSIONS': { status_code: '2200' },
    'RUS_BAD_ID': { status_code: '2000' },
  },
  async (params, dbClient) => {
    const userSubId = +params.user_subscription_id;
    const apiKey = params.api_key;
    const user = await users.fetchUser(dbClient, { apiKey });

    assertPeer(Number.isInteger(userSubId), `got ${userSubId}`, 'UNSUBSCR_BAD_USER_SUBSCR_ID');
    assertPeer(user != null, `got ${user}`, 'UNSUBSCR_INVALID_API_KEY');

    const userSubscriptions = await subscriptions.listUserSubscriptions(
      dbClient,
      user.id,
    );
    const apiKeyHasPermissions = userSubscriptions.some(
      sub => +sub.id === +userSubId,
    );

    assertPeer(apiKeyHasPermissions,
      `apiKey=${apiKey} subscr=${userSubId}`,
      'UNSUBSCR_NOT_ENOUGH_PERMISSIONS',
    );

    await subscriptions.removeUserSubscription(dbClient, userSubId);

    return { status_code: `1000` };
  },
);

const editSubscription = defineAPIMethod(
  {
    [errorCodes.subscriptionExists]: { status_code: '2000' },
    'EDIT_SUBSCR_BAD_FROM_ID': { status_code: '2100' },
    'EDIT_SUBSCR_BAD_TO_ID': { status_code: '2100' },
    'EDIT_SUBSCR_BAD_SUBSCR_ID': { status_code: '2100' },
    'EDIT_SUBSCR_INVALID_FROM_ID': { status_code: '2101' },
    'EDIT_SUBSCR_INVALID_TO_ID': { status_code: '2101' },
    'EDIT_SUBSCR_BAD_DATE_RANGE': { status_code: '2102' },
    'EDIT_SUBSCR_INVALID_DATE_FROM': { status_code: '2102' },
    'EDIT_SUBSCR_INVALID_DATE_TO': { status_code: '2102' },
    'UPDATE_SUBSCR_INVALID_PLAN': { status_code: '2105' },
    'EDIT_SUBSCR_NOT_ENOUGH_PERMISSIONS': { status_code: '2200' },
    'EDIT_SUBSCR_BAD_API_KEY': { status_code: '2200' },
  },
  async (params, dbClient) => {
    const apiKey = params.api_key;
    const user = await users.fetchUser(dbClient, { apiKey });

    assertPeer(user != null, `got ${user}`, 'EDIT_SUBSCR_BAD_API_KEY');

    const userSubscr = await dbClient.selectWhere(
      'users_subscriptions',
      '*',
      {
        user_id: user.id,
      },
    );
    const subscriptionId = +params.user_subscription_id;
    const flyFrom = +params.fly_from;
    const flyTo = +params.fly_to;
    const plan = params.plan;

    assertPeer(Number.isInteger(flyFrom),
      `got ${flyFrom}`,
      'EDIT_SUBSCR_BAD_FROM_ID',
    );
    assertPeer(Number.isInteger(flyTo), `got ${flyTo}`, 'EDIT_SUBSCR_BAD_TO_ID');
    assertPeer(
      Number.isInteger(subscriptionId), `got ${subscriptionId}`, 'EDIT_SUBSCR_BAD_SUBSCR_ID',
    );

    const dateFrom = moment(params.date_from, SERVER_DATE_FORMAT);
    const dateTo = moment(params.date_to, SERVER_DATE_FORMAT);

    assertPeer(dateFrom.isValid(), `got ${dateFrom}`, 'EDIT_SUBSCR_INVALID_DATE_FROM');
    assertPeer(dateTo.isValid(), `got ${dateTo}`, 'EDIT_SUBSCR_INVALID_DATE_TO');
    assertPeer(dateFrom < dateTo, `got ${dateFrom} and ${dateTo}`, 'EDIT_SUBSCR_BAD_DATE_RANGE');

    const apiKeyHasPermissions = userSubscr.find(
      subscr => subscr.id === subscriptionId,
    );

    // TODO apiKeyHasPermissions also checks if the user exists
    assertPeer(apiKeyHasPermissions, `apiKey=${apiKey}`, 'EDIT_SUBSCR_NOT_ENOUGH_PERMISSIONS');
    assertPeer(
      await airportIDExists(dbClient, flyFrom), `got ${flyFrom}`, 'EDIT_SUBSCR_INVALID_FROM_ID',
    );
    assertPeer(
      await airportIDExists(dbClient, flyTo), `got ${flyTo}`, 'EDIT_SUBSCR_INVALID_TO_ID',
    );

    try {
      await subscriptions.updateUserSubscription(dbClient, subscriptionId, {
        airportFromId: flyFrom,
        airportToId: flyTo,
        dateFrom: dateFrom.format(SERVER_TIME_FORMAT),
        dateTo: dateTo.format(SERVER_TIME_FORMAT),
        plan,
      });
    } catch (e) {
      assertPeer(
        e.code !== '23505',
        `Peer tried to update user subscription ${subscriptionId} to another already existing one.`,
        errorCodes.subscriptionExists,
      );
      throw e;
    }

    return { status_code: '1000' };
  },
);

const creditHistory = defineAPIMethod(
  {
    'TH_BAD_LIMIT': { status_code: '2100' },
    'TH_BAD_OFFSET': { status_code: '2100' },
    'TH_INVALID_LIMIT': { status_code: '2100' },
    'TH_INVALID_API_KEY': { status_code: '2200' },
    'TH_NOT_ENOUGH_PERMISSIONS': { status_code: '2200' },
  },
  async (params, dbClient) => {
    const apiKey = params.api_key;
    const limit = +params.limit || CREDIT_HISTORY_DEFAULT_LIMIT;
    const offset = +params.offset || 0;

    assertPeer(Number.isSafeInteger(limit), `got ${limit}`, 'TH_BAD_LIMIT');
    assertPeer(Number.isSafeInteger(offset), `got ${offset}`, 'TH_BAD_OFFSET');
    assertPeer(limit <= CREDIT_HISTORY_MAX_LIMIT, `got ${limit}`, 'TH_INVALID_LIMIT');

    const user = await users.fetchUser(dbClient, { apiKey });

    assertPeer(user, `got ${user}`, 'TH_INVALID_API_KEY');
    assertPeer(user.api_key === apiKey, `got ${user}`, 'TH_NOT_ENOUGH_PERMISSIONS');

    const { rows: subscrTransfers } = await dbClient.executeQuery(
      `
      SELECT credit_history.id::text, transferred_at, transfer_amount, reason,
        subscriptions.airport_from_id::text, subscriptions.airport_to_id::text, 
        users_subscriptions.date_from, users_subscriptions.date_to,
        users_subscriptions.active AS subscription_status
      FROM (
        SELECT usat.user_subscription_id AS id, transferred_at, transfer_amount, 'initial tax' AS reason
        FROM account_transfers
        JOIN user_subscription_account_transfers AS usat
          ON account_transfers.id=usat.account_transfer_id
        UNION ALL
        SELECT users_subscriptions.id, transferred_at, transfer_amount, 'fetch tax' AS reason
        FROM account_transfers
        JOIN subscriptions_fetches_account_transfers AS sfat 
          ON account_transfers.id=sfat.account_transfer_id
        JOIN subscriptions_fetches 
          ON sfat.subscription_fetch_id=subscriptions_fetches.id
        JOIN subscriptions 
          ON subscriptions_fetches.subscription_id=subscriptions.id
        JOIN users_subscriptions 
          ON subscriptions.id=users_subscriptions.subscription_id
      ) AS credit_history
      JOIN users_subscriptions 
        ON credit_history.id=users_subscriptions.id
      JOIN subscriptions 
        ON users_subscriptions.subscription_id=subscriptions.id
      WHERE users_subscriptions.user_id=$1
      ORDER BY transferred_at DESC, id ASC
      LIMIT $2
      OFFSET $3
      `,
      [user.id, limit, offset],
    );

    for (const transfer of subscrTransfers) {
      transfer.date_from = moment(transfer.date_from)
        .format(SERVER_DATE_FORMAT);
      transfer.date_to = moment(transfer.date_to).format(SERVER_DATE_FORMAT);
      transfer.transferred_at = transfer.transferred_at.toISOString();
    }

    return {
      status_code: '1000',
      credit_history: subscrTransfers,
    };
  },
);

const depositHistory = defineAPIMethod(
  {
    'TH_INVALID_API_KEY': { status_code: '2200' },
    'TH_NOT_ENOUGH_PERMISSIONS': { status_code: '2200' },
  },
  async ({
    api_key: apiKey,
    from = null,
    to = null,
    limit = CREDIT_HISTORY_DEFAULT_LIMIT,
    offset = 0,
  }, dbClient) => {
    const user = await users.fetchUser(dbClient, { apiKey });

    assertPeer(user, `got ${user}`, 'TH_INVALID_API_KEY');
    assertPeer(user.api_key === apiKey, `got ${user}`, 'TH_NOT_ENOUGH_PERMISSIONS');

    const fromClause = from ? 'transferred_at > $4::timestamp' : '$4=$4';
    const toClause = to ? 'transferred_at > $5::timestamp' : '$5=$5';

    from = from || '';
    to = to || '';

    const { rows: depositHistory } = await dbClient.executeQuery(
      `
        SELECT transferred_at::text, transfer_amount, 'Freefall deposit' AS reason
        FROM account_transfers
        WHERE 
          user_id=$1 AND
          id IN (SELECT account_transfer_id FROM account_transfers_by_employees) AND
          ${fromClause} AND
          ${toClause}
        ORDER BY transferred_at DESC, id ASC
        LIMIT $2
        OFFSET $3
        `,
      [user.id, limit, offset, from, to],
    );

    return {
      status_code: '1000',
      deposit_history: depositHistory,
    };
  },
);

const fullCreditHistory = defineAPIMethod(
  {
    'TH_BAD_LIMIT': { status_code: '2100' },
    'TH_BAD_OFFSET': { status_code: '2100' },
    'TH_INVALID_LIMIT': { status_code: '2100' },
    'TH_INVALID_API_KEY': { status_code: '2200' },
    'TH_NOT_ENOUGH_PERMISSIONS': { status_code: '2200' },
  },
  async (params, dbClient) => {
    const apiKey = params.api_key;
    const limit = +params.limit || CREDIT_HISTORY_DEFAULT_LIMIT;
    const offset = +params.offset || 0;

    assertPeer(Number.isSafeInteger(limit), `got ${limit}`, 'TH_BAD_LIMIT');
    assertPeer(Number.isSafeInteger(offset), `got ${offset}`, 'TH_BAD_OFFSET');
    assertPeer(limit <= CREDIT_HISTORY_MAX_LIMIT, `got ${limit}`, 'TH_INVALID_LIMIT');

    const user = await users.fetchUser(dbClient, { apiKey });

    assertPeer(user, `got ${user}`, 'TH_INVALID_API_KEY');
    assertPeer(user.api_key === apiKey, `got ${user}`, 'TH_NOT_ENOUGH_PERMISSIONS');

    const { rows: history } = await dbClient.executeQuery(
      `
      SELECT 
        account_transfers.id AS transfer_id,
        CASE 
          WHEN taxes.id IS NULL THEN 'deposit'
          ELSE 'tax'
          AS transfer_type
        COALESCE(taxes.transfer_amount, deposits.transfer_amount) AS transfer_amount,
        COALESCE(taxes.transferred_at, deposits.transferred_at) AS transferred_at,
        COALESCE(taxes.reason, deposits.reason) AS reason,
        taxes.id AS subscription_id,
        taxes.airport_from_id::text,
        taxes.airport_to_id::text,
        taxes.date_from,
        taxes.date_to,
        taxes.subscription_status
      FROM account_transfers
      LEFT JOIN (
        SELECT 
          credit_history.id::text,
          credit_history.transfer_id,
          transferred_at,
          transfer_amount,
          reason,
          subscriptions.airport_from_id::text,
          subscriptions.airport_to_id::text, 
          users_subscriptions.date_from,
          users_subscriptions.date_to,
          users_subscriptions.active AS subscription_status
        FROM (
          SELECT 
            usat.user_subscription_id AS id,
            account_transfers.id AS transfer_id,
            transferred_at,
            transfer_amount,
            'initial tax' AS reason
          FROM account_transfers
          JOIN user_subscription_account_transfers AS usat
            ON account_transfers.id=usat.account_transfer_id
          UNION ALL
          SELECT 
            users_subscriptions.id,
            account_transfers.id AS transfer_id,
            transferred_at,
            transfer_amount,
            'fetch tax' AS reason
          FROM account_transfers
          JOIN subscriptions_fetches_account_transfers AS sfat 
            ON account_transfers.id=sfat.account_transfer_id
          JOIN subscriptions_fetches 
            ON sfat.subscription_fetch_id=subscriptions_fetches.id
          JOIN subscriptions 
            ON subscriptions_fetches.subscription_id=subscriptions.id
          JOIN users_subscriptions 
            ON subscriptions.id=users_subscriptions.subscription_id
        ) AS credit_history
        JOIN users_subscriptions 
          ON credit_history.id=users_subscriptions.id
        JOIN subscriptions 
          ON users_subscriptions.subscription_id=subscriptions.id
        WHERE users_subscriptions.user_id=$1
      ) AS taxes
        ON account_transfers.id=taxes.transfer_id
      LEFT JOIN (
        SELECT 
          id AS transfer_id,
          transferred_at,
          transfer_amount,
          'Freefall deposit'::text AS reason
        FROM account_transfers
        WHERE user_id=$1 AND id IN (SELECT account_transfer_id FROM account_transfers_by_employees)
      ) AS deposits
        ON account_transfers.id=deposits.transfer_id
      WHERE user_id=$1,
      ORDER BY transferred_at
      LIMIT $2
      OFFSET $3
      `,
      [user.id, limit, offset]
    );

    for (const transfer of history) {
      if (transfer.type === 'tax') {
        transfer.date_from = moment(transfer.date_from)
          .format(SERVER_DATE_FORMAT);
        transfer.date_to = moment(transfer.date_to).format(SERVER_DATE_FORMAT);
      }
      transfer.transferred_at = transfer.transferred_at.toISOString();
    }

    return {
      status_code: '1000',
      credit_history: history,
    };
  },
);
async function listAirports (params, dbClient) {
  const airports = await dbClient.select('airports');

  for (const air of airports) {
    air.id = `${air.id}`;
  }

  return {
    airports,
  };
}

const listSubscriptions = defineAPIMethod(
  {
    'LIST_SUBSCR_INVALID_API_KEY': { subscriptions: [], status_code: '2200' },
  },
  async (
    {
      fly_from = null,
      fly_to = null,
      limit = LIST_SUBSCRIPTIONS_DEFAULT_LIMIT,
      offset = 0,
      api_key: apiKey,
    },
    dbClient
  ) => {
    const user = await users.fetchUser(dbClient, { apiKey });

    assertPeer(user != null, `got ${user}`, 'LIST_SUBSCR_INVALID_API_KEY');

    let flyFromClause;

    if (fly_from) {
      flyFromClause = `(ap_from.name=$4 OR ap_from.iata_code=$4)`;
    } else {
      fly_from = '';
      flyFromClause = `$4=$4`;
    }

    let flyToClause;

    if (fly_to) {
      flyToClause = `(ap_to.name=$5 OR ap_to.iata_code=$5)`;
    } else {
      fly_to = '';
      flyToClause = `$5=$5`;
    }

    const { rows: subRows } = await dbClient.executeQuery(
      `
      SELECT 
        user_sub.id::text,
        airport_from_id::text AS fly_from,
        airport_to_id::text AS fly_to,
        to_char(date_from, 'YYYY-MM-DD') AS date_from,
        to_char(date_to, 'YYYY-MM-DD') AS date_to,
        subscription_plans.name AS plan
      FROM users_subscriptions AS user_sub
      JOIN users ON user_sub.user_id=users.id
      JOIN subscriptions sub ON user_sub.subscription_id=sub.id
      JOIN airports ap_from ON sub.airport_from_id=ap_from.id
      JOIN airports ap_to ON sub.airport_to_id=ap_to.id
      JOIN subscription_plans ON user_sub.subscription_plan_id=subscription_plans.id
      WHERE user_id=$1 AND
        user_sub.active=true AND
        ${flyFromClause} AND
        ${flyToClause}
      ORDER BY user_sub.updated_at DESC
      LIMIT $2
      OFFSET $3
      `,
      [user.id, limit, offset, fly_from, fly_to],
    );

    return {
      subscriptions: subRows,
    };
  },
);

const modifyCredentials = defineAPIMethod(
  {
    'MC_SHORT_PASSWORD': { status_code: '2100' },
    'MC_INVALID_API_KEY': { status_code: '2200' },
  },
  async ({ api_key, password }, dbClient) => {
    const user = await users.fetchUser(dbClient, { apiKey: api_key });

    assertUser(user != null, 'invalid api key', 'MC_INVALID_API_KEY');
    assertUser(
      password.length >= 8,
      `password needs to be at least of length 8`,
      'MC_SHORT_PASSWORD'
    );

    password = users.hashPassword(password);
    await users.editUser(dbClient, user.id, { password });

    return { status_code: '1000' };
  }
);

async function getAPIKey (params, db, ctx) {
  const user = await auth.getLoggedInUser(ctx);
  const apiKey = (user == null) ? null : user.api_key;
  const statusCode = (apiKey == null) ? '2000' : '1000';

  return {
    api_key: apiKey,
    status_code: statusCode,
  };
}

async function sendError (params) {
  assertPeer(
    isObject(params),
    'Invalid senderror request',
  );

  log.debug('Got trace from client: ', params);

  return {
    status_code: '1000',
  };
}

module.exports = {
  search,
  subscribe,
  unsubscribe,
  edit_subscription: editSubscription,
  list_airports: listAirports,
  list_subscriptions: listSubscriptions,
  credit_history: creditHistory,
  deposit_history: depositHistory,
  modify_credentials: modifyCredentials,
  get_api_key: getAPIKey,
  senderror: sendError,
};
