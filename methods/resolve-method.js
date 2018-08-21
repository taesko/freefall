const { assertPeer, assertApp, assertUser, PeerError, errorCodes } = require('../modules/error-handling');
const { toSmallestCurrencyUnit } = require('../modules/utils');
const { isObject, isFunction } = require('lodash');
const log = require('../modules/log');
const auth = require('../modules/auth');
const moment = require('moment');
const subscriptions = require('../modules/subscriptions');
const users = require('../modules/users');
const accounting = require('../modules/accounting');

const MAX_CREDITS_DIFFERENCE = Math.pow(10, 12);
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
    'SEARCH_BAD_FLY_FROM': { status_code: '2000', currency: 'USD', routes: [] },
    'SEARCH_BAD_FLY_TO': { status_code: '2000', currency: 'USD', routes: [] },
    'SEARCH_INVALID_FLY_FROM': { status_code: '2000', currency: 'USD', routes: [] },
    'SEARCH_INVALID_FLY_TO': { status_code: '2000', currency: 'USD', routes: [] },
    'SEARCH_INVALID_DATE_RANGE': { status_code: '2000', currency: 'USD', routes: [] },
    'SEARCH_EARLY_DATE_FROM': { status_code: '2000', currency: 'USD', routes: [] },
    'SEARCH_BAD_PRICE_TO': { status_code: '2000', currency: 'USD', routes: [] },
    'SEARCH_INVALID_PRICE_TO': { status_code: '2000', currency: 'USD', routes: [] },
    'SEARCH_BAD_LIMIT': { status_code: '2000', currency: 'USD', routes: [] },
    'SEARCH_INVALID_LIMIT': { status_code: '2000', currency: 'USD', routes: [] },
    'SEARCH_BAD_OFFSET': { status_code: '2000', currency: 'USD', routes: [] },
    'SEARCH_INVALID_OFFSET': { status_code: '2000', currency: 'USD', routes: [] },
    'SEARCH_BAD_MAX_FLY_DURATION': { status_code: '2000', currency: 'USD', routes: [] },
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
    [errorCodes.subscriptionExists]: { status_code: '2000', subscription_id: null },
    [errorCodes.notEnoughCredits]: { status_code: '2001', subscription_id: null },
    'SUBSCR_BAD_FLY_FROM': { status_code: '2100', subscription_id: null },
    'SUBSCR_BAD_FLY_TO': { status_code: '2100', subscription_id: null },
    'SUBSCR_BAD_API_KEY': { status_code: '2200', subscription_id: null },
    'SUBSCRIBE_USER_BAD_DATE': { status_code: '2100', subscription_id: null },
    'SUBSCR_EARLY_DATE_FROM': { status_code: '2100', subscription_id: null },
    'SUBSCR_INVALID_FLY_FROM_ID': { status_code: '2100', subscription_id: null },
    'SUBSCR_INVALID_FLY_TO_ID': { status_code: '2100', subscription_id: null },
  },
  async (params, dbClient) => {
    assertApp(isObject(params));
    const flyFrom = +params.fly_from;
    const flyTo = +params.fly_to;
    const dateFrom = params.date_from;
    const dateTo = params.date_to;
    const apiKey = params.api_key;
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
    const userId = await users.fetchUser(dbClient, { apiKey: params.api_key })
      .then(user => { return user == null ? null : user.id; });

    const subscribeAndTax = async (
      userId,
      {
        flyFrom,
        flyTo,
        dateFrom,
        dateTo,
      }) => {
      const { id: subId } = await subscriptions.subscribeUser(
        dbClient,
        userId,
        {
          airportFromId: flyFrom,
          airportToId: flyTo,
          dateFrom,
          dateTo,
        },
      );
      // reactivating an old user subscription shouldn't be taxed
      // if subscription has been taxed pass silently.
      // NOTE in concurrent requests the subscription might be taxed after this query
      // unique constraints will fail in that case.
      if (await accounting.subscriptionIsTaxed(dbClient, subId)) {
        log.info('Subscription is already taxed. Skipping taxing');
        return subId;
      }

      try {
        await accounting.taxSubscribe(dbClient, userId, subId);
      } catch (e) {
        if (e.code === '23505') { // unique constraint failed
          throw PeerError('subscription already exists.', errorCodes.subscriptionExists);
        } else {
          throw e;
        }
      }

      return subId;
    };

    const subscriptionId = await subscribeAndTax(userId, {
      flyFrom,
      flyTo,
      dateFrom,
      dateTo,
    });

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
    'EDIT_SUBSCR_NOT_ENOUGH_PERMISSIONS': { status_code: '2200' },
    'EDIT_SUBSCR_BAD_API_KEY': { status_code: '2200' },
  },
  async (params, dbClient) => {
    {
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
    }
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
    'LIST_SUBSCR_INVALID_USER_ID': { subscriptions: [] }, // TODO add status codes ?
  },
  async (params, dbClient) => {
    const user = await users.fetchUser(dbClient, { apiKey: params.api_key });
    assertPeer(user != null, `got ${user}`, 'LIST_SUBSCR_INVALID_USER_ID');
    const subRows = await subscriptions.listUserSubscriptions(
      dbClient,
      user.id,
    );

    for (const sr of subRows) {
      sr.id = `${sr.id}`;
      sr.fly_from = `${sr.fly_from}`;
      sr.fly_to = `${sr.fly_to}`;
      sr.date_from = moment(sr.date_from).format('Y-MM-DD');
      sr.date_to = moment(sr.date_to).format('Y-MM-DD');
    }

    return {
      subscriptions: subRows,
    };
  },
);

const adminListUsers = defineAPIMethod(
  {
    'ALU_NOT_ENOUGH_PERMISSIONS': { status_code: '2200' },
  },
  async (params, dbClient) => {
    assertPeer(
      await auth.hasPermission(dbClient, params.api_key, 'admin_list_users'),
      'You do not have sufficient permission to call admin_list_users method.',
      'ALU_NOT_ENOUGH_PERMISSIONS',
    );

    const selectResult = await dbClient.executeQuery(`

      SELECT
        users.id,
        users.email,
        users.api_key,
        users.credits,
        users.verified,
        users.verification_token,
        users.active,
        users_roles.role_id
      FROM users
      LEFT JOIN users_roles
      ON users.id = users_roles.user_id
      ORDER BY users.id
      LIMIT $1
      OFFSET $2;

    `, [params.limit, params.offset]);

    assertApp(isObject(selectResult), `got ${selectResult}`);
    assertApp(Array.isArray(selectResult.rows), `got ${selectResult.rows}`);

    const userList = selectResult.rows;

    for (const user of userList) {
      user.id = `${user.id}`;
    }

    return {
      users: userList,
    };
  },
);

const adminListGuestSubscriptions = defineAPIMethod(
  {
    'ALS_NOT_ENOUGH_PERMISSIONS': { status_code: '2200' },
  },
  async (params, dbClient) => {
    assertPeer(
      await auth.hasPermission(dbClient, params.api_key, 'admin_list_guest_subscriptions'),
      'You do not have sufficient permission to call admin_list_subscriptions method.',
      'ALS_NOT_ENOUGH_PERMISSIONS',
    );

    const result = await dbClient.executeQuery(`

      SELECT *
      FROM subscriptions
      ORDER BY id
      LIMIT $1
      OFFSET $2;

    `, [
      params.limit,
      params.offset,
    ]);

    assertApp(isObject(result), `got ${result}`);
    assertApp(Array.isArray(result.rows), `got ${result.rows}`);

    const guestSubscr = result.rows.map(sub => {
      const createdAt = sub.created_at == null ? 'No information' : sub.created_at.toISOString();
      const updatedAt = sub.updated_at == null ? 'No information' : sub.updated_at.toISOString();

      return {
        id: `${sub.id}`,
        fly_from: `${sub.airport_from_id}`,
        fly_to: `${sub.airport_to_id}`,
        created_at: createdAt,
        updated_at: updatedAt,
      };
    });

    return {
      status_code: '1000',
      guest_subscriptions: guestSubscr,
    };
  },
);

const adminListUserSubscriptions = defineAPIMethod(
  {
    'ALS_INVALID_USER_ID': { status_code: '2000' },
    'ALS_BAD_USER_ID': { status_code: '2100' },
    'ALS_NOT_ENOUGH_PERMISSIONS': { status_code: '2200' },
  },
  async (params, dbClient) => {
    assertPeer(
      await auth.hasPermission(dbClient, params.api_key, 'admin_list_user_subscriptions'),
      'You do not have sufficient permission to call admin_list_subscriptions method.',
      'ALS_NOT_ENOUGH_PERMISSIONS',
    );

    let userId;

    if (params.user_id) {
      userId = +params.user_id;
      assertPeer(Number.isInteger(userId), `got ${userId}`, 'ALS_BAD_USER_ID');
      const exists = await users.userExists(dbClient, { userId });
      assertPeer(exists, `got ${userId}`, 'ALS_INVALID_USER_ID');
    }

    // TODO set MAX limit from config
    assertPeer(Number.isSafeInteger(params.offset), `got ${params.offset}`, 'ALS_BAD_OFFSET');
    assertPeer(Number.isSafeInteger(params.limit), `got ${params.limit}`, 'ALS_BAD_LIMIT');

    let userSubscr;

    if (userId) {
      const result = await dbClient.executeQuery(`

        SELECT
          user_sub.id,
          user_sub.date_from,
          user_sub.date_to,
          ap_from.id fly_from,
          ap_to.id fly_to,
          users.id user_id,
          users.email user_email,
          user_sub.created_at created_at,
          user_sub.updated_at updated_at
        FROM users_subscriptions user_sub
        JOIN users ON user_sub.user_id=users.id
        JOIN subscriptions sub ON user_sub.subscription_id=sub.id
        JOIN airports ap_from ON sub.airport_from_id=ap_from.id
        JOIN airports ap_to ON sub.airport_to_id=ap_to.id
        WHERE
          user_sub.active=true AND
          users.id = $1
        ORDER BY user_sub.id
        LIMIT $2
        OFFSET $3;

      `, [
        userId,
        params.limit,
        params.offset,
      ]);

      assertApp(isObject(result), `got ${result}`);
      assertApp(Array.isArray(result.rows), `got ${result.rows}`);

      userSubscr = result.rows;
    } else {
      const result = await dbClient.executeQuery(`

        SELECT
          user_sub.id,
          user_sub.date_from,
          user_sub.date_to,
          ap_from.id fly_from,
          ap_to.id fly_to,
          users.id user_id,
          users.email user_email,
          user_sub.created_at created_at,
          user_sub.updated_at updated_at
        FROM users_subscriptions user_sub
        JOIN users ON user_sub.user_id=users.id
        JOIN subscriptions sub ON user_sub.subscription_id=sub.id
        JOIN airports ap_from ON sub.airport_from_id=ap_from.id
        JOIN airports ap_to ON sub.airport_to_id=ap_to.id
        WHERE
          user_sub.active=true
        ORDER BY user_sub.id
        LIMIT $1
        OFFSET $2;

      `, [
        params.limit,
        params.offset,
      ]);

      assertApp(isObject(result), `got ${result}`);
      assertApp(Array.isArray(result.rows), `got ${result.rows}`);

      userSubscr = result.rows;
    }

    userSubscr = userSubscr.map(sub => {
      const createdAt = sub.created_at == null ? 'No information' : sub.created_at.toISOString();
      const updatedAt = sub.updated_at == null ? 'No information' : sub.updated_at.toISOString();

      return {
        id: `${sub.id}`,
        user: {
          id: `${sub.user_id}`,
          email: `${sub.user_email}`,
        },
        date_from: moment(sub.date_from).format('Y-MM-DD'),
        date_to: moment(sub.date_to).format('Y-MM-DD'),
        fly_from: `${sub.fly_from}`,
        fly_to: `${sub.fly_to}`,
        created_at: createdAt,
        updated_at: updatedAt,
      };
    });

    return {
      status_code: '1000',
      user_subscriptions: userSubscr,
    };
  }
);

// const adminListSubscriptions = defineAPIMethod(
//   {
//     'ALS_INVALID_USER_ID': { status_code: '2000' },
//     'ALS_BAD_USER_ID': { status_code: '2100' },
//     'ALS_NOT_ENOUGH_PERMISSIONS': { status_code: '2200' },
//   },
//   async (params, dbClient) => {
//     assertPeer(
//       await auth.hasPermission(dbClient, params.api_key, 'admin_list_subscriptions'),
//       'You do not have sufficient permission to call admin_list_subscriptions method.',
//       'ALS_NOT_ENOUGH_PERMISSIONS',
//     );
//
//     let userId;
//
//     if (params.user_id) {
//       userId = +params.user_id;
//       assertPeer(Number.isInteger(userId), `got ${userId}`, 'ALS_BAD_USER_ID');
//       const exists = await users.userExists(dbClient, { userId });
//       assertPeer(exists, `got ${userId}`, 'ALS_INVALID_USER_ID');
//     }
//
//     let userSubscr;
//     let guestSubscr;
//
//     if (userId) {
//       userSubscr = await subscriptions.listUserSubscriptions(
//         dbClient,
//         userId,
//       );
//       // TODO ask ivan if guestSubscr should be null or empty array
//       guestSubscr = [];
//     } else {
//       userSubscr = await subscriptions.listAllUserSubscriptions(dbClient);
//       guestSubscr = await subscriptions.listGlobalSubscriptions(dbClient);
//       guestSubscr = guestSubscr.map(sub => {
//         return {
//           id: `${sub.id}`,
//           fly_from: `${sub.airport_from_id}`,
//           fly_to: `${sub.airport_to_id}`,
//           created_at:
//             sub.created_at == null ?
//               'No information' : sub.created_at.toISOString(),
//           updated_at:
//             sub.updated_at == null ?
//               'No information' : sub.updated_at.toISOString(),
//         };
//       });
//     }
//
//     userSubscr = userSubscr.map(sub => {
//       const createdAt = sub.created_at == null ? 'No information' : sub.created_at.toISOString();
//       const updatedAt = sub.updated_at == null ? 'No information' : sub.updated_at.toISOString();
//
//       return {
//         id: `${sub.id}`,
//         user: {
//           id: `${sub.user_id}`,
//           email: `${sub.user_email}`,
//         },
//         date_from: moment(sub.date_from).format('Y-MM-DD'),
//         date_to: moment(sub.date_to).format('Y-MM-DD'),
//         fly_from: `${sub.fly_from}`,
//         fly_to: `${sub.fly_to}`,
//         created_at: createdAt,
//         updated_at: updatedAt,
//       };
//     });
//
//     return {
//       status_code: '1000',
//       user_subscriptions: userSubscr,
//       guest_subscriptions: guestSubscr,
//     };
//   },
// );

const adminSubscribe = defineAPIMethod(
  {
    'ASUBSCR_NOT_ENOUGH_PERMISSIONS': { status_code: '2200' },
    'ASUBSCR_BAD_FLY_FROM': { status_code: '2100' },
    'ASUBSCR_BAD_FLY_TO': { status_code: '2100' },
    'ASUBSCR_BAD_USER_ID': { status_code: '2100' },
    [errorCodes.subscriptionExists]: { status_code: '2000' },
    [errorCodes.subscriptionDoesNotExist]: { status_code: '2000' },
  },
  async (params, dbClient) => {
    assertPeer(
      await auth.hasPermission(dbClient, params.api_key, 'admin_subscribe'),
      'You do not have sufficient permission to call admin_list_subscriptions method.',
      'ASUBSCR_NOT_ENOUGH_PERMISSIONS',
    );

    const flyFrom = +params.fly_from;
    const flyTo = +params.fly_to;
    const dateFrom = params.date_from;
    const dateTo = params.date_to;
    const userId = +params.user_id;

    assertPeer(Number.isInteger(flyFrom), `got ${flyFrom}`, 'ASUBSCR_BAD_FLY_FROM');
    assertPeer(Number.isInteger(flyTo), `got ${flyTo}`, 'ASUBSCR_BAD_FLY_TO');
    assertPeer(Number.isInteger(userId), `got ${userId}`, 'ASUBSCR_BAD_USER_ID');

    let subscriptionId;
    let statusCode;

    try {
      subscriptionId = await subscriptions.subscribeUser(
        dbClient,
        userId,
        {
          airportFromId: flyFrom,
          airportToId: flyTo,
          dateFrom,
          dateTo,
        },
      );
      statusCode = 1000;
    } catch (e) {
      if (e instanceof PeerError) {
        log.warn(
          'An error occurred while executing method admin_subscribe with params',
          params,
        );
        subscriptionId = null;
        statusCode = 2000;
      } else {
        throw e;
      }
    }

    return {
      subscription_id: `${subscriptionId}`,
      status_code: `${statusCode}`,
    };
  },
);

async function adminUnsubscribe (params, dbClient) {
  assertPeer(
    await auth.hasPermission(dbClient, params.api_key, 'admin_unsubscribe'),
    'You do not have sufficient permission to call admin_list_subscriptions method.',
  );

  async function removeSubscription (params, dbClient) {
    let statusCode;

    const subId = +params.user_subscription_id;

    try {
      await subscriptions.removeUserSubscription(dbClient, subId);
      statusCode = '1000';
    } catch (e) {
      if (e instanceof PeerError) {
        log.warn(
          'An error occurred while executing method admin_unsubscribe with params',
          params,
        );
        statusCode = '2000';
      } else {
        throw e;
      }
    }

    return { status_code: `${statusCode}` };
  }

  async function removeAllSubscriptions (params, dbClient) {
    const userId = +params.user_id;
    assertPeer(Number.isInteger(userId), 'user_id must be an integer wrapped in string.');
    let statusCode;
    try {
      await subscriptions.removeAllSubscriptionsOfUser(dbClient, userId);
      statusCode = '1000';
    } catch (e) {
      if (e instanceof PeerError) {
        log.warn(
          'An error occurred while executing method admin_unsubscribe with params',
          params,
        );
        statusCode = '2000';
      } else {
        throw e;
      }
    }
    // this method never fails ?
    return { status_code: statusCode };
  }

  if (params.user_id) {
    return removeAllSubscriptions(params, dbClient);
  } else {
    return removeSubscription(params, dbClient);
  }
}

async function adminEditSubscription (params, dbClient) {
  if (!await auth.hasPermission(dbClient, params.api_key, 'admin_edit_subscription')) {
    return {
      status_code: '2200',
    };
  }

  const userSubId = +params.user_subscription_id;
  const airportFromId = +params.fly_from;
  const airportToId = +params.fly_to;
  const dateFrom = params.date_from;
  const dateTo = params.date_to;

  try {
    const updatedSubscription = await subscriptions.updateUserSubscription(
      dbClient,
      userSubId,
      {
        airportFromId,
        airportToId,
        dateFrom,
        dateTo,
      },
    );

    assertApp(isObject(updatedSubscription), `got ${updatedSubscription}`);

    assertApp(updatedSubscription.updated_at instanceof Date, `got ${updatedSubscription.updated_at}`);

    const updatedAt = updatedSubscription.updated_at.toISOString();

    return {
      updated_at: updatedAt,
      status_code: '1000',
    };
  } catch (e) {
    if (e instanceof PeerError) {
      // TODO somehow make this a decorator ?
      log.warn(
        'An error occurred while executing method admin_edit_subscription with params',
        params,
      );
      if (e.code === 'UPDATE_SUBSCR_BAD_DATE') {
        return { status_code: '2100' };
      } else {
        return { status_code: '2000' };
      }
    } else {
      throw e;
    }
  }
}

async function adminRemoveUser (params, dbClient) {
  assertPeer(
    await auth.hasPermission(dbClient, params.api_key, 'admin_remove_user'),
    'You do not have sufficient permission to call admin_list_subscriptions method.',
  );

  let statusCode;
  const userId = +params.user_id;

  assertPeer(Number.isInteger(userId));

  try {
    await users.removeUser(dbClient, userId);
    statusCode = '1000';
  } catch (e) {
    if (e instanceof PeerError) {
      statusCode = '2000';
    } else {
      throw e;
    }
  }

  return { status_code: statusCode };
}

async function adminEditUser (params, dbClient) {
  if (!await auth.hasPermission(dbClient, params.api_key, 'admin_edit_user')) {
    return { status_code: '2100' };
  }
  if (!Number.isInteger(+params.user_id)) {
    return { status_code: '2200' };
  }

  let statusCode;
  const userId = +params.user_id;
  const { email } = params;
  let password;

  if (params.password) {
    password = users.hashPassword(params.password);
  }

  if (email.indexOf('@') === -1) {
    return { status_code: '2203' };
  }

  if (params.role) {
    if (!Number.isSafeInteger(params.role)) {
      return { status_code: '2204' };
    }

    const selectResult = await dbClient.executeQuery(`

      SELECT *
      FROM roles
      WHERE id = $1;

    `, [params.role]);

    assertApp(isObject(selectResult), `got ${selectResult}`);
    assertApp(Array.isArray(selectResult.rows), `got ${selectResult.rows}`);

    if (selectResult.rows.length !== 1) {
      return { status_code: '2204' };
    }

    await dbClient.executeQuery(`

      UPDATE users_roles
      SET
        role_id = $1,
        updated_at = now()
      WHERE user_id = $2;

    `, [params.role, userId]);
  }

  try {
    await users.editUser(
      dbClient,
      userId,
      {
        email,
        password,
      },
    );
    statusCode = '1000';
  } catch (e) {
    // TODO verify emails
    if (e.code === 'FF_SHORT_EMAIL') {
      statusCode = '2201';
    } else if (e.code === 'FF_SHORT_PASSWORD') {
      statusCode = '2202';
    } else if (e.code === errorCodes.emailTaken) {
      statusCode = '2204';
    } else if (e instanceof PeerError) {
      statusCode = '2000';
    } else {
      throw e;
    }
  }

  return { status_code: statusCode };
}

async function adminListFetches (params, dbClient) {
  assertPeer(
    await auth.hasPermission(dbClient, params.api_key, 'admin_list_fetches'),
    'You do not have sufficient permission to call admin_list_subscriptions method.',
  );

  const fetches = await dbClient.select('fetches');
  return {
    status_code: '1000',
    fetches,
  };
}

async function adminAlterUserCredits (params, dbClient) {
  if (!await auth.hasPermission(dbClient, params.api_key, 'admin_alter_user_credits')) {
    return {
      status_code: '2100',
    };
  }

  if (!Number.isInteger(Number(params.user_id))) {
    return {
      status_code: '2103', // user not found or parameter error ?
    };
  }
  if (!Number.isInteger(+params.credits_difference)) {
    return { status_code: '2103' };
  }

  const adminId = await users.fetchUser(dbClient, { apiKey: params.api_key })
    .then(user => { return user == null ? null : user.id; });

  const userId = Number(params.user_id);
  const amount = Math.abs(params.credits_difference);

  let accountTransfer;

  if (Math.abs(+params.credits_difference) > MAX_CREDITS_DIFFERENCE) {
    return { status_code: '2103' }; // TODO set a new status code at the front end
  } else if (params.credits_difference === 0) {
    return { status_code: '2103' }; // TODO does not fail when user id does not exist.
  } else if (params.credits_difference > 0) {
    try {
      accountTransfer = await accounting.depositCredits(
        dbClient,
        userId,
        amount,
      );
    } catch (e) {
      if (e.code === errorCodes.userDoesNotExist) {
        return { status_code: '2102' };
      } else {
        throw e;
      }
    }
  } else {
    try {
      accountTransfer = await accounting.taxUser(dbClient, userId, amount);
    } catch (e) {
      if (e.code === errorCodes.notEnoughCredits) {
        return { status_code: '2101' };
      } else {
        throw e;
      }
    }
  }

  await accounting.registerTransferByAdmin(
    dbClient,
    accountTransfer.id,
    adminId,
  );

  return {
    status_code: '1000',
  };
}

const adminAddRole = defineAPIMethod(
  {
    'AAR_INVALID_API_KEY': { status_code: '2100' },
    'AAR_BAD_PARAMETERS_FORMAT': { status_code: '2101' },
    'AAR_UNKNOWN_PERMISSIONS': { status_code: '2102' },
  },
  async (params, dbClient) => {
    assertUser(
      await auth.hasPermission(dbClient, params.api_key, 'admin_add_role'),
      'You do not have sufficient permission to call admin_add_role method.',
      'AAR_INVALID_API_KEY'
    );

    const insertResult = await dbClient.executeQuery(`

      INSERT INTO roles
        (name)
      VALUES
        ($1)
      RETURNING *;

    `, [params.role_name]);

    assertApp(isObject(insertResult), `got ${insertResult}`);
    assertApp(Array.isArray(insertResult.rows), `got ${insertResult.rows}`);
    assertApp(insertResult.rows.length === 1, `got ${insertResult.rows.length}`);
    assertApp(typeof insertResult.rows[0].id === 'number', `got ${insertResult.rows[0].id}`);

    const roleId = insertResult.rows[0].id;

    for (const permissionId of params.permissions) {
      const selectPermissionResult = await dbClient.executeQuery(`

        SELECT *
        FROM permissions
        WHERE id = $1;

      `, [permissionId]);

      assertApp(isObject(selectPermissionResult), `got ${selectPermissionResult}`);
      assertApp(Array.isArray(selectPermissionResult.rows), `got ${selectPermissionResult.rows}`);

      assertUser(
        selectPermissionResult.rows.length === 1,
        'Attempted to create a role with unknown permissions!',
        'AAR_UNKNOWN_PERMISSIONS'
      );

      await dbClient.executeQuery(`

        INSERT INTO roles_permissions
          (role_id, permission_id)
        VALUES
          ($1, $2);

      `, [roleId, permissionId]);
    }

    return {
      status_code: '1000',
    };
  }
);

const adminEditRole = defineAPIMethod(
  {
    'AER_INVALID_ADMIN_API_KEY': { status_code: '2100' },
    'AER_BAD_PARAMETERS_FORMAT': { status_code: '2101' },
    'AER_UNKNOWN_PERMISSIONS': { status_code: '2102' },
    'AER_UNKNOWN_ROLE': { status_code: '2103' },
  },
  async (params, dbClient) => {
    assertUser(
      await auth.hasPermission(dbClient, params.api_key, 'admin_edit_role'),
      'You do not have sufficient permissions to call admin_edit_role_method',
      'AER_INVALID_ADMIN_API_KEY'
    );

    assertUser(
      typeof params.role_name === 'string' ||
      (Array.isArray(params.permissions) && params.permissions.length > 0),
      'No values for parameters to update!',
      'AER_BAD_PARAMETERS_FORMAT'
    );

    const selectResult = await dbClient.executeQuery(`

      SELECT *
      FROM roles
      WHERE id = $1;

    `, [params.role_id]);

    assertApp(isObject(selectResult), `got ${selectResult}`);
    assertApp(Array.isArray(selectResult.rows), `got ${selectResult.rows}`);

    assertUser(
      selectResult.rows.length === 1,
      'Could found selected role!',
      'AER_UNKNOWN_ROLE'
    );

    if (params.role_name) {
      await dbClient.executeQuery(`

        UPDATE roles
        SET
          name = $1,
          updated_at = now()
        WHERE id = $2;

      `, [params.role_name, params.role_id]);
    }

    if (params.permissions && params.permissions.length > 0) {
      await dbClient.executeQuery(`

        DELETE FROM roles_permissions
        WHERE role_id = $1;

      `, [params.role_id]);

      for (const permissionId of params.permissions) {
        const selectPermissionResult = await dbClient.executeQuery(`

          SELECT *
          FROM permissions
          WHERE id = $1;

        `, [permissionId]);

        assertApp(isObject(selectPermissionResult), `got ${selectPermissionResult}`);
        assertApp(Array.isArray(selectPermissionResult.rows), `got ${selectPermissionResult.rows}`);

        assertUser(
          selectPermissionResult.rows.length === 1,
          'Attempted to give unknown permission to role!',
          'AER_UNKNOWN_PERMISSIONS'
        );

        await dbClient.executeQuery(`

          INSERT INTO roles_permissions
            (role_id, permission_id)
          VALUES
            ($1, $2);

        `, [params.role_id, permissionId]);
      }
    }

    return { status_code: '1000' };
  }
);

const adminRemoveRole = defineAPIMethod(
  {
    'ARR_INVALID_ADMIN_API_KEY': { status_code: '2100' },
    'ARR_BAD_PARAMETERS_FORMAT': { status_code: '2101' },
    'ARR_UNKNOWN_ROLE': { status_code: '2102' },
  },
  async (params, dbClient) => {
    assertUser(
      await auth.hasPermission(dbClient, params.api_key, 'admin_remove_role'),
      'You do not have permissions to call admin_remove_role method!',
      'ARR_INVALID_ADMIN_API_KEY'
    );

    const selectResult = await dbClient.executeQuery(`

      SELECT *
      FROM roles
      WHERE id = $1;

    `, [params.role_id]);

    assertApp(isObject(selectResult), `got ${selectResult}`);
    assertApp(Array.isArray(selectResult.rows), `got ${selectResult.rows}`);

    assertUser(
      selectResult.rows.length === 1,
      'Selected role could not be found!',
      'ARR_UNKNOWN_ROLE'
    );

    await dbClient.executeQuery(`

      DELETE FROM roles_permissions
      WHERE role_id = $1;

    `, [params.role_id]);

    await dbClient.executeQuery(`

      DELETE FROM roles
      WHERE id = $1;

    `, [params.role_id]);

    return { status_code: '1000' };
  }
);

const adminListPermissions = defineAPIMethod(
  {
    'ALP_INVALID_ADMIN_API_KEY': { status_code: '2100', permissions: [] },
    'ALP_BAD_PARAMETERS_FORMAT': { status_code: '2101', permissions: [] },
  },
  async (params, dbClient) => {
    assertUser(
      await auth.hasPermission(dbClient, params.api_key, 'admin_list_permissions'),
      'You do not have permissions to call admin_list_permissions method',
      'ALP_INVALID_ADMIN_API_KEY'
    );

    const selectResult = await dbClient.executeQuery(`

      SELECT *
      FROM permissions
      ORDER BY id ASC;

    `);

    assertApp(isObject(selectResult), `got ${selectResult}`);
    assertApp(Array.isArray(selectResult.rows), `got ${selectResult.rows}`);

    const permissions = selectResult.rows.map((row) => {
      assertApp(row.created_at instanceof Date, `got ${row.created_at}`);
      assertApp(row.updated_at instanceof Date, `got ${row.updated_at}`);

      return {
        id: row.id,
        name: row.name,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
      };
    });

    return {
      status_code: '1000',
      permissions,
    };
  }
);

const adminListRoles = defineAPIMethod(
  {
    'ALR_INVALID_ADMIN_API_KEY': { status_code: '2100', roles: [] },
    'ALR_BAD_PARAMETERS_FORMAT': { status_code: '2101', roles: [] },
  },
  async (params, dbClient) => {
    assertUser(
      await auth.hasPermission(dbClient, params.api_key, 'admin_list_roles'),
      'You do not have permissions to call admin_list_roles method!',
      'ALR_INVALID_ADMIN_API_KEY'
    );

    assertUser(
      params.limit > 0 && params.limit <= 20,
      'Expected limit to be 0 < limit <= 20',
      'ALP_BAD_PARAMETERS_FORMAT'
    );

    assertUser(
      Number.isSafeInteger(params.offset) && params.offset >= 0,
      'Expected offset to be a positive integer!',
      'ALP_BAD_PARAMETERS_FORMAT'
    );

    let rolesSelect;

    if (params.role_id) {
      const roleId = Number(params.role_id);
      assertUser(
        Number.isSafeInteger(roleId),
        'Expected role_id to be an integer!',
        'ALP_BAD_PARAMETERS_FORMAT'
      );

      rolesSelect = await dbClient.executeQuery(`

        SELECT *
        FROM roles
        WHERE id = $1;

      `, [roleId]);
    } else {
      rolesSelect = await dbClient.executeQuery(`

        SELECT *
        FROM roles
        ORDER BY id ASC
        LIMIT $1
        OFFSET $2;

      `, [params.limit, params.offset]);
    }

    assertApp(isObject(rolesSelect), `got ${rolesSelect}`);
    assertApp(Array.isArray(rolesSelect.rows), `got ${rolesSelect.rows}`);

    const roles = [];

    for (const role of rolesSelect.rows) {
      assertApp(role.created_at instanceof Date, `got ${role.created_at}`);
      assertApp(role.updated_at instanceof Date, `got ${role.updated_at}`);

      const roleElement = {
        id: role.id,
        name: role.name,
        created_at: role.created_at.toISOString(),
        updated_at: role.updated_at.toISOString(),
      };

      const permissionsSelect = await dbClient.executeQuery(`

        SELECT permissions.id
        FROM roles_permissions
        LEFT JOIN permissions
        ON permissions.id = roles_permissions.permission_id
        WHERE role_id = $1;

      `, [role.id]);

      assertApp(isObject(permissionsSelect), `got ${permissionsSelect}`);
      assertApp(Array.isArray(permissionsSelect.rows), `got ${permissionsSelect.rows}`);

      const permissions = permissionsSelect.rows.map((row) => {
        return row.id;
      });

      roleElement.permissions = permissions;
      roles.push(roleElement);
    }

    return {
      status_code: '1000',
      roles,
    };
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

function defineAPIMethod (errors, method) {
  assertApp(isObject(errors));
  assertApp(isFunction(method));

  async function apiMethod (params, db, appCtx) {
    let result;

    try {
      result = await method(params, db, appCtx);
    } catch (e) {
      if (e instanceof PeerError) {
        result = errors[e.code];
        assertApp(result != null, `Unhandled PeerError ${JSON.stringify(e)}`);
      } else {
        throw e;
      }
    }

    return result;
  }

  return apiMethod;
}

async function execute ({ methodName, params, db, appCtx }) {
  assertPeer(
    typeof methodName === 'string',
    `Expected a name of method, got ${methodName}, type ${typeof methodName}`,
  );

  assertPeer(
    isObject(params),
    `Expected object params, got ${params}, not an object`,
  );

  assertPeer(
    isObject(db),
    `Expected db object, got ${db}`,
  );

  for (const [name, method] of Object.entries(API_METHODS)) {
    if (name === methodName) {
      return method(params, db, appCtx);
    }
  }
  throw new PeerError(`Unknown method '${methodName}'`);
}

const API_METHODS = {
  search,
  subscribe,
  unsubscribe,
  edit_subscription: editSubscription,
  list_airports: listAirports,
  list_subscriptions: listSubscriptions,
  // admin_list_subscriptions: adminListSubscriptions,
  admin_add_role: adminAddRole,
  admin_edit_role: adminEditRole,
  admin_remove_role: adminRemoveRole,
  admin_list_roles: adminListRoles,
  admin_list_permissions: adminListPermissions,
  admin_list_user_subscriptions: adminListUserSubscriptions,
  admin_list_guest_subscriptions: adminListGuestSubscriptions,
  admin_list_users: adminListUsers,
  admin_subscribe: adminSubscribe,
  admin_unsubscribe: adminUnsubscribe,
  admin_edit_subscription: adminEditSubscription,
  admin_remove_user: adminRemoveUser,
  admin_edit_user: adminEditUser,
  admin_list_fetches: adminListFetches, // eslint-disable-line no-unused-vars
  admin_alter_user_credits: adminAlterUserCredits,
  get_api_key: getAPIKey,
  senderror: sendError,
};

module.exports = {
  execute,
};
