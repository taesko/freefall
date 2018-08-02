const SERVER_TIME_FORMAT = 'Y-MM-DDTHH:mm:ssZ';
const { assertPeer, assertApp, PeerError, errorCodes } = require('../modules/error-handling');
const { toSmallestCurrencyUnit, fromSmallestCurrencyUnit } = require('../modules/utils');
const { isObject, each, forOwn } = require('lodash');
const log = require('../modules/log');
const auth = require('../modules/auth');
const moment = require('moment');
const subscriptions = require('../modules/subscriptions');
const users = require('../modules/users');
const accounting = require('../modules/accounting');

const API_METHODS = {
  search,
  subscribe,
  unsubscribe,
  list_airports: listAirports,
  list_subscriptions: listSubscriptions,
  admin_list_subscriptions: adminListSubscriptions,
  admin_list_users: adminListUsers,
  admin_subscribe: adminSubscribe,
  admin_unsubscribe: adminUnsubscribe,
  admin_edit_subscription: adminEditSubscription,
  admin_remove_user: adminRemoveUser,
  admin_edit_user: adminEditUser,
  admin_list_fetches: adminListFetches,
  admin_alter_user_credits: adminAlterUserCredits,
  get_api_key: getAPIKey,
  senderror: sendError,
};

async function search (params, dbClient) {
  const dbToAPIRouteFlight = function dbToAPIRouteFlight (routeFlight) {
    assertApp(
      typeof routeFlight.airlineName === 'string' &&
      typeof routeFlight.logoURL === 'string' &&
      typeof routeFlight.afromName === 'string' &&
      typeof routeFlight.atoName === 'string' &&
      typeof routeFlight.dtime === 'string' &&
      typeof routeFlight.atime === 'string' &&
      typeof routeFlight.flightNumber === 'string' &&
      (routeFlight.isReturn === true || routeFlight.isReturn === false),
      'Invalid database flight response.',
    );

    return {
      airport_from: routeFlight.afromName,
      airport_to: routeFlight.atoName,
      return: !!routeFlight.isReturn,
      dtime: routeFlight.dtime,
      atime: routeFlight.atime,
      airline_logo: routeFlight.logoURL,
      airline_name: routeFlight.airlineName,
      flight_number: routeFlight.flightNumber,
    };
  };

  const flyDurationCalc = (acc, flight) => {
    const arrivalTime = moment(flight.atime, SERVER_TIME_FORMAT);
    const departureTime = moment(flight.dtime, SERVER_TIME_FORMAT);

    return acc + arrivalTime.diff(departureTime, 'hours');
  };

  const flyDurationIncluder = (route) => {
    const accInitValue = 0;
    const flyDuration = route.route.reduce(flyDurationCalc, accInitValue);

    return {
      route,
      flyDuration,
    };
  };

  const flyDurationFilter = (route) => {
    return (
      !params.max_fly_duration ||
      route.flyDuration <= params.max_fly_duration
    );
  };

  const flyDurationExcluder = (route) => {
    return { ...route.route };
  };

  const cmpPrices = function cmpPrices (route1, route2) {
    if (route1.price > route2.price) {
      return 1;
    } else if (route1.price < route2.price) {
      return -1;
    }
    return 0;
  };

  const cmpDepartureTimes = function cmpDepartureTimes (flight1, flight2) {
    const departureTime1 = moment(flight1.dtime, SERVER_TIME_FORMAT);
    const departureTime2 = moment(flight2.dtime, SERVER_TIME_FORMAT);

    if (departureTime1.isAfter(departureTime2)) {
      return 1;
    } else if (departureTime2.isAfter(departureTime1)) {
      return -1;
    }
    return 0;
  };

  const flightsInRouteSorter = function flightsInRouteSorter (route) {
    // sorts flights in a route by departure time
    return {
      ...route,
      route: route.route.sort(cmpDepartureTimes),
    };
  };

  const hasMatchingDepartureAirport = (flight) => {
    return flight.afromId === +params.fly_from;
  };

  const hasMatchingArrivalAirport = (flight) => {
    return flight.atoId === +params.fly_to;
  };

  const areEndpointsCorrect = (route) => {
    return route.some(hasMatchingDepartureAirport) &&
           route.some(hasMatchingArrivalAirport);
  };

  assertPeer(
    isObject(params) &&
    typeof params.v === 'string' &&
    Number.isInteger(+params.fly_from) &&
    Number.isInteger(+params.fly_to) &&
    (!params.price_to || Number.isInteger(params.price_to)) &&
    (!params.currency || typeof params.currency === 'string') &&
    (!params.date_from || typeof params.date_from === 'string') &&
    (!params.date_to || typeof params.date_to === 'string') &&
    (!params.sort || typeof params.sort === 'string') &&
    (!params.max_fly_duration || Number.isInteger(params.max_fly_duration)),
    'Invalid search request.',
  );

  if (Number.isInteger(params.price_to)) {
    params.price_to = toSmallestCurrencyUnit(params.price_to);
  }

  const result = {};

  if (params.currency) {
    result.currency = params.currency;
  }

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

    result.status_code = '1001';
    result.routes = [];

    return result;
  }

  const subs = await dbClient.selectSubscriptions(
    +params.fly_from,
    +params.fly_to,
  );

  // subs.length can be equal to 0 if we haven't yet fetched flights for it.
  if (subs.length === 0) {
    result.status_code = '1002';
    result.routes = [];

    return result;
  }

  assertApp(
    subs.length === 1 &&
    isObject(subs[0]) &&
    Number.isInteger(subs[0].fetchId) &&
    typeof subs[0].timestamp === 'string',
    'Invalid subscription data.',
  );

  const fetchId = subs[0].fetchId;
  const routesAndFlights = await dbClient.selectRoutesFlights(fetchId, params);

  assertApp(
    Array.isArray(routesAndFlights),
    'Invalid database routes and flights response.',
  );

  const routesHash = {};

  each(routesAndFlights, (routeFlight) => {
    assertApp(
      isObject(routeFlight) &&
      Number.isInteger(routeFlight.routeId) &&
      typeof routeFlight.bookingToken === 'string' &&
      Number.isInteger(routeFlight.price),
      'Invalid database route response.',
    );

    routesHash[routeFlight.routeId] = routesHash[routeFlight.routeId] || {
      booking_token: routeFlight.bookingToken,
      price: fromSmallestCurrencyUnit(routeFlight.price),
      route: [],
    };

    assertApp(Array.isArray(routesHash[routeFlight.routeId].route));

    routesHash[routeFlight.routeId].route.push(routeFlight);
  });

  const routes = [];

  forOwn(routesHash, (routeData, routeId) => {
    assertApp(
      typeof routeId === 'string' &&
      isObject(routeData),
      'Invalid database route response',
    );

    const route = routeData.route;

    assertApp(
      route.every(flight => {
        return Number.isInteger(flight.afromId) &&
               Number.isInteger(flight.atoId) &&
               typeof flight.airlineName === 'string' &&
               typeof flight.logoURL === 'string' &&
               typeof flight.afromName === 'string' &&
               typeof flight.atoName === 'string' &&
               // typeof flight.dtime === 'string' &&
               // typeof flight.atime === 'string' &&
               typeof flight.flightNumber === 'string' &&
               (flight.isReturn === true || flight.isReturn === false);
      }),
      'Invalid database flight response.',
    );

    if (areEndpointsCorrect(route)) {
      const routeAPIFormat = route.map((flight) => {
        return dbToAPIRouteFlight(flight);
      });
      routes.push({
        ...routeData,
        route: routeAPIFormat,
      });
    }
  });

  result.routes = routes
    .map(flyDurationIncluder)
    .filter(flyDurationFilter)
    .map(flyDurationExcluder)
    .sort(cmpPrices)
    .map(flightsInRouteSorter);
  result.status_code = '1000';

  return result;
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
    await accounting.taxSubscribe(dbClient, userId, subId);

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

  log.debug('sub rows is', subRows);
  for (const sr of subRows) {
    sr.id = `${sr.id}`;
    sr.fly_from = `${sr.fly_from}`;
    sr.fly_to = `${sr.fly_to}`;
    const dateFrom = new Date(sr.date_from);
    const dateTo = new Date(sr.date_to);
    sr.date_from = dateFrom.toISOString().split('T')[0]; // ISO 8601 is delimited with T in JS
    sr.date_to = dateTo.toISOString().split('T')[0];
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
  assertPeer(
    await auth.tokenHasRole(dbClient, params.api_key, 'admin'),
    'You do not have sufficient permission to call admin_list_subscriptions method.',
  );
  assertPeer(
    Number.isInteger(+params.user_id),
    'user_id parameter must be an integer wrapped in a string.',
  );

  let statusCode;
  const userId = +params.user_id;
  const { email } = params;
  let password;

  if (params.password) {
    password = users.hashPassword(dbClient, params.password);
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
  assertPeer(
    await auth.tokenHasRole(dbClient, params.api_key, 'admin'),
    'You do not have sufficient permission to call admin_alter_user_credits method.',
  );

  assertPeer(
    Number.isInteger(Number(params.user_id)),
    `Expected user_id to be an integer, represented as string, but was ${typeof Number(params.user_id)}`,
  );

  const adminId = await users.fetchUser(dbClient, { apiKey: params.api_key })
    .then(user => { return user == null ? null : user.id; });

  const userId = Number(params.user_id);
  const amount = Math.abs(params.credits_difference);

  let accountTransfer;

  if (params.credits_difference > 0) {
    accountTransfer = await accounting.depositCredits(dbClient, userId, amount);
  } else {
    accountTransfer = await accounting.taxUser(dbClient, userId, amount);
  }

  await accounting.registerTransferByAdmin(
    dbClient,
    accountTransfer.id,
    adminId
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
