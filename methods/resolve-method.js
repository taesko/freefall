const SERVER_TIME_FORMAT = 'Y-MM-DDTHH:mm:ssZ';
const SEARCH_MONTHS_AHEAD = 1;
const MAX_PRICE_TO = Math.pow(10, 6); // 10k in cents
const DEFAULT_PRICE_TO = MAX_PRICE_TO;
const { assertPeer, assertApp, PeerError, errorCodes } = require('../modules/error-handling');
const { toSmallestCurrencyUnit } = require('../modules/utils');
const { isObject } = require('lodash');
const log = require('../modules/log');
const auth = require('../modules/auth');
const moment = require('moment');
const subscriptions = require('../modules/subscriptions');
const users = require('../modules/users');
const accounting = require('../modules/accounting');
const MAX_CREDITS_DIFFERENCE = Math.pow(10, 12);

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

async function search (params, dbClient) {
  const flyFrom = +params.fly_from;
  const flyTo = +params.fly_to;

  let dateFrom;

  if (params.date_from) {
    dateFrom = moment(params.date_from).format(SERVER_TIME_FORMAT);
  } else {
    dateFrom = moment().format(SERVER_TIME_FORMAT);
  }

  let dateTo;

  if (params.date_to) {
    dateTo = moment(params.date_to).format(SERVER_TIME_FORMAT);
  } else {
    dateTo = moment().add(SEARCH_MONTHS_AHEAD, 'months').format(SERVER_TIME_FORMAT);
  }

  if (
    params.price_to &&
    (params.price_to > MAX_PRICE_TO || params.price_to <= 0)
  ) {
    return {
      status_code: '2000',
      currency: params.currency,
      routes: [],
    };
  }

  const priceTo = toSmallestCurrencyUnit(params.price_to || DEFAULT_PRICE_TO);
  const currency = params.currency;
  const maxFlightDuration = params.max_fly_duration;

  const subscribed = await subscriptions.globalSubscriptionExists(
    dbClient,
    +params.fly_from,
    +params.fly_to,
  );

  if (!subscribed) {
    try {
      await subscriptions.subscribeGlobally(
        dbClient,
        +params.fly_from,
        +params.fly_to,
      );
    } catch (e) {
      if (e.code === 'FF_INVALID_AIRPORT_ID') {
        log.debug('Caught FF_INVALID_AIRPORT_ID');
        return {
          status_code: '2000',
          routes: [],
          currency,
        };
      } else {
        throw e;
      }
    }

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
     LIMIT 50
    `,
    [flyFrom, flyTo, dateFrom, dateTo, priceTo],
  );

  assertApp(Array.isArray(routesAndFlights), 'Invalid database response for search');

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

    log.debug('flights per route_id are', route_id, flightsPerRoute[route_id]);
    const flightCount = flightsPerRoute[route_id].length;
    const first = flightsPerRoute[route_id][0];
    const last = flightsPerRoute[route_id][flightCount - 1];
    const departureAirport = first.airport_from_id;
    const arrivalAirport = last.airport_to_id;

    if (departureAirport !== flyFrom || arrivalAirport !== flyTo) {
      continue;
    }

    routes.push({ ...routesMeta[route_id], route: flightsPerRoute[route_id] });
  }

  routes.sort((routeA, routeB) => {
    return routeA.price - routeB.price;
  });

  return {
    status_code: '1000',
    routes,
    currency,
  };
}

async function subscribe (params, dbClient) {
  if (
    !(Number.isInteger(+params.fly_from) && Number.isInteger(+params.fly_to))
  ) {
    return {
      status_code: '2100',
      subscription_id: null,
    };
  }

  const flyFrom = +params.fly_from;
  const flyTo = +params.fly_to;
  const dateFrom = params.date_from;
  const dateTo = params.date_to;

  // TODO maybe this should be part of the transaction ?
  const userId = await users.fetchUser(dbClient, { apiKey: params.api_key })
    .then(user => { return user == null ? null : user.id; });

  if (userId == null) {
    return {
      status_code: '2200',
      subscriptionId: null,
    };
  }

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
    // reactivating and old user subscription shouldn't be taxed
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

  let statusCode;
  let subscriptionId;
  const statusCodeHash = {};

  statusCodeHash[errorCodes.notEnoughCredits] = '2001';
  statusCodeHash[errorCodes.subscriptionExists] = '2000';

  try {
    subscriptionId = await subscribeAndTax(userId, {
      flyFrom,
      flyTo,
      dateFrom,
      dateTo,
    });
    statusCode = '1000';
    subscriptionId = `${subscriptionId}`;
  } catch (e) {
    if (e instanceof PeerError) {
      log.info('Peer error occurred while subscribing user.');
      statusCode = statusCodeHash[e.code];
      if (e.code === 'SUBSCRIBE_USER_BAD_DATE') {
        statusCode = '2100';
      } else if (!statusCode) {
        log.warn(`Error has an unknown code. Setting statusCode to '2999'`);
        statusCode = '2999';
      }
      subscriptionId = null;
    } else {
      throw e;
    }
  }

  return {
    subscription_id: subscriptionId,
    status_code: `${statusCode}`,
  };
}

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

module.exports = {
  execute,
};
