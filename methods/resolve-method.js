const { assertPeer, assertApp, PeerError, errorCodes } = require('../modules/error-handling');
const { toSmallestCurrencyUnit } = require('../modules/utils');
const { isObject, isFunction } = require('lodash');
const log = require('../modules/log');
const auth = require('../modules/auth');
const moment = require('moment');
const subscriptions = require('../modules/subscriptions');
const users = require('../modules/users');
const accounting = require('../modules/accounting');

const MAX_CREDITS_DIFFERENCE = Math.pow(10, 12);
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

    const priceTo = params.price_to || DEFAULT_PRICE_TO;

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

    const { rows: routesAndFlights } = await dbClient.executeQuery(
      `
    SELECT
      routes.id AS route_id,
      routes.booking_token,
      routes.price,
      airlines.name AS airline_name,
      airlines.logo_url AS airline_logo,
      afrom.name::text AS airport_from,
      ato.name::text AS airport_to,
      afrom.id AS airport_from_id,
      ato.id AS airport_to_id,
      to_char(flights.dtime::timestamp, 'YYYY-MM-DD"T"HH24:MI:SSZ') dtime,
      to_char(flights.atime::timestamp, 'YYYY-MM-DD"T"HH24:MI:SSZ') atime,
      flights.flight_number AS flight_number,
      routes_flights.is_return AS return
    FROM routes
    LEFT JOIN routes_flights ON routes_flights.route_id = routes.id
    LEFT JOIN flights ON routes_flights.flight_id = flights.id
    LEFT JOIN airports as afrom ON afrom.id = flights.airport_from_id
    LEFT JOIN airports as ato ON ato.id = flights.airport_to_id
    LEFT JOIN airlines ON airlines.id = flights.airline_id
    LEFT JOIN subscriptions_fetches ON routes.subscription_fetch_id=subscriptions_fetches.id
    LEFT JOIN fetches ON subscriptions_fetches.fetch_id=fetches.id
    WHERE
        flights.dtime >= $3::date AND
        flights.atime <= $4::date AND
        routes.price <= $5 AND
        subscriptions_fetches.id IN (
          SELECT subscriptions_fetches.id
          FROM subscriptions_fetches
          LEFT JOIN fetches ON fetches.id = subscriptions_fetches.fetch_id
          LEFT JOIN subscriptions ON subscriptions.id = subscriptions_fetches.subscription_id
          WHERE
            subscriptions.airport_from_id = $1 AND
            subscriptions.airport_to_id = $2 AND
            fetches.fetch_time = (SELECT MAX(fetches.fetch_time) FROM fetches)
        )
     ORDER BY route_id
     LIMIT $6 * 5 -- TODO assumes a single route does not span more than 5 flights
     OFFSET $7 * 5
    `,
      [
        flyFrom,
        flyTo,
        dateFrom.format(SERVER_TIME_FORMAT),
        dateTo.format(SERVER_TIME_FORMAT),
        priceTo,
        limit,
        offset,
      ],
    );

    if (routesAndFlights.length === 0) {
      return {
        status_code: '1002',
        currency,
        routes: [],
      };
    }

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

async function unsubscribe (params, dbClient) {
  if (!Number.isInteger(+params.user_subscription_id)) {
    return { status_code: '2100' };
  }

  const userSubId = +params.user_subscription_id;
  const apiKey = params.api_key;

  const user = await users.fetchUser(dbClient, { apiKey });

  if (user == null) {
    return { status_code: '2200' };
  }

  const userSubscriptions = await subscriptions.listUserSubscriptions(
    dbClient,
    user.id,
  );

  if (!userSubscriptions.some(sub => +sub.id === +userSubId)) {
    return {
      status_code: '2200',
    };
  }

  let statusCode;

  try {
    await subscriptions.removeUserSubscription(dbClient, userSubId);
    statusCode = 1000;
  } catch (e) {
    if (e instanceof PeerError) {
      log.warn('Peer error occurred while removing subscription: ', userSubId);
      if (e.code === 'RUS_BAD_ID') {
        statusCode = '2000';
      }
    } else {
      throw e;
    }
  }

  return { status_code: `${statusCode}` };
}

async function editSubscription (params, dbClient) {
  const user = await users.fetchUser(dbClient, { apiKey: params.api_key });
  const userSubscr = await dbClient.selectWhere(
    'users_subscriptions',
    '*',
    {
      user_id: user.id,
    },
  );
  const subscriptionId = +params.user_subscription_id;
  const airportFromId = +params.fly_from;
  const airportToId = +params.fly_to;
  const dateFrom = params.date_from;
  const dateTo = params.date_to;

  if (!userSubscr.find(subscr => subscr.id === subscriptionId)) {
    log.info(`Peer with api_key ${params.api_key} cannot modify user subscription ${subscriptionId}.`);
    return { status_code: '2200' };
  }
  if (
    !Number.isInteger(airportFromId) ||
    !Number.isInteger(airportToId) ||
    !Number.isInteger(subscriptionId)
  ) {
    log.info('Peer entered non-integer ids');
    return { status_code: '2100' };
  }
  if (moment(dateFrom) > moment(dateTo)) {
    log.info('Peer entered invalid dates.');
    return { status_code: '2102' };
  }

  const pgResult = await dbClient.executeQuery(
    `
      SELECT *
      FROM airports
      WHERE id IN ($1, $2)
    `,
    [airportFromId, airportToId],
  );
  assertApp(Array.isArray(pgResult.rows), `db returned ${pgResult.rows} for rows`);
  if (pgResult.rows.length !== 2) {
    log.info('Peer sent airport ids that did not exist.');
    return { status_code: '2101' };
  }

  try {
    await subscriptions.updateUserSubscription(dbClient, subscriptionId, {
      airportFromId,
      airportToId,
      dateFrom,
      dateTo,
    });
  } catch (e) {
    if (e.code === '23505') { // unique constraint failed
      log.info(`Peer tried to update user subscription ${subscriptionId} to another already existing one.`);
      return { status_code: '2000' };
    } else {
      throw e;
    }
  }

  return { status_code: '1000' };
}

async function listAirports (params, dbClient) {
  const airports = await dbClient.select('airports');

  for (const air of airports) {
    air.id = `${air.id}`;
  }

  return {
    airports,
  };
}

async function listSubscriptions (params, dbClient) {
  const user = await users.fetchUser(dbClient, { apiKey: params.api_key });
  const subRows = await subscriptions.listUserSubscriptions(dbClient, user.id);

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
}

async function adminListUsers (params, dbClient) {
  assertPeer(
    await auth.tokenHasRole(dbClient, params.api_key, 'admin'),
    'You do not have sufficient permission to call admin_list_users method.',
  );
  const userList = await users.listUsers(dbClient, false);

  // TODO use a helper function ?
  for (const user of userList) {
    user.id = `${user.id}`;
  }

  return {
    users: userList,
  };
}

async function adminListSubscriptions (params, dbClient) {
  // TODO handle errors how ?
  assertPeer(
    await auth.tokenHasRole(dbClient, params.api_key, 'admin'),
    'You do not have sufficient permission to call admin_list_subscriptions method.',
  );
  let userSubscriptions;
  let guestSubscriptions;

  if (!params.user_id) {
    userSubscriptions = await subscriptions.listAllUserSubscriptions(dbClient);
    guestSubscriptions = await subscriptions.listGlobalSubscriptions(dbClient);
    guestSubscriptions = guestSubscriptions.map(sub => {
      return {
        id: `${sub.id}`,
        fly_from: `${sub.airport_from_id}`,
        fly_to: `${sub.airport_to_id}`,
      };
    });
  } else {
    userSubscriptions = await subscriptions.listUserSubscriptions(
      dbClient,
      +params.user_id,
    );
    // TODO ask ivan if guestSubscriptions should be null or empty array
    guestSubscriptions = [];
  }

  userSubscriptions = userSubscriptions.map(sub => {
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
    };
  });

  return {
    status_code: '1000',
    user_subscriptions: userSubscriptions,
    guest_subscriptions: guestSubscriptions,
  };
}

async function adminSubscribe (params, dbClient) {
  assertPeer(
    await auth.tokenHasRole(dbClient, params.api_key, 'admin'),
    'You do not have sufficient permission to call admin_list_subscriptions method.',
  );

  const flyFrom = +params.fly_from;
  const flyTo = +params.fly_to;
  const dateFrom = params.date_from;
  const dateTo = params.date_to;
  const userId = +params.user_id;

  assertPeer(
    Number.isInteger(flyFrom) &&
    Number.isInteger(flyTo) &&
    Number.isInteger(userId),
    'subscribe params fly_from, fly_to and user_id must be an integer wrapped in a string',
  );

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
}

async function adminUnsubscribe (params, dbClient) {
  assertPeer(
    await auth.tokenHasRole(dbClient, params.api_key, 'admin'),
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
  if (!await auth.tokenHasRole(dbClient, params.api_key, 'admin')) {
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
    await subscriptions.updateUserSubscription(
      dbClient,
      userSubId,
      {
        airportFromId,
        airportToId,
        dateFrom,
        dateTo,
      },
    );
    return { status_code: '1000' };
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
    await auth.tokenHasRole(dbClient, params.api_key, 'admin'),
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
  if (!await auth.tokenHasRole(dbClient, params.api_key, 'admin')) {
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
    await auth.tokenHasRole(dbClient, params.api_key, 'admin'),
    'You do not have sufficient permission to call admin_list_subscriptions method.',
  );

  const fetches = await dbClient.select('fetches');
  return {
    status_code: '1000',
    fetches,
  };
}

async function adminAlterUserCredits (params, dbClient) {
  if (!await auth.tokenHasRole(dbClient, params.api_key, 'admin')) {
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
  admin_list_subscriptions: adminListSubscriptions,
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
