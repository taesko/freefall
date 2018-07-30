const SERVER_TIME_FORMAT = 'Y-MM-DDTHH:mm:ssZ';
const { assertPeer, assertApp, PeerError } = require('../modules/error-handling');
const { toSmallestCurrencyUnit, fromSmallestCurrencyUnit } = require('../modules/utils');
const { isObject, each, forOwn } = require('lodash');
const log = require('../modules/log');
const auth = require('../modules/auth');
const moment = require('moment');
const subscriptions = require('../modules/subscriptions');
const users = require('../modules/users');

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
  get_api_key: getAPIKey,
  senderror: sendError,
};

async function search (params, db) {
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

  params.price_to = toSmallestCurrencyUnit(params.price_to);

  const result = {};

  if (params.currency) {
    result.currency = params.currency;
  }

  const subs = await db.selectSubscriptions(+params.fly_from, +params.fly_to);

  if (subs.length <= 0) {
    await subscriptions.subscribeGlobally(params.fly_from, params.fly_to);

    result.status_code = '2000';
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
  const routesAndFlights = await db.selectRoutesFlights(fetchId, params);

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

async function subscribe (params) {
  assertPeer(
    Number.isInteger(+params.fly_from) && Number.isInteger(+params.fly_to),
    'subscribe params fly_from and fly_to must be an integer wrapped in a string',
  );
  const flyFrom = +params.fly_from;
  const flyTo = +params.fly_to;
  const dateFrom = params.date_from;
  const dateTo = params.date_to;

  const user = await users.fetchUser({ apiKey: params.api_key });

  assertPeer(user != null, 'invalid api key');

  let subscriptionId;
  let statusCode;
  try {
    subscriptionId = await subscriptions.subscribeUser(
      user.id,
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
      log.warn('Peer error occurred while subscribing user.');
      statusCode = 2000;
      subscriptionId = null;
    } else {
      throw e;
    }
  }

  return {
    subscription_id: `${subscriptionId}`,
    status_code: `${statusCode}`,
  };
}

async function unsubscribe (params, db) {
  assertPeer(
    Number.isInteger(+params.user_subscription_id),
    'user_subscription_id must be an integer wrapped in a string',
  );
  const userSubId = +params.user_subscription_id;
  const apiKey = params.api_key;

  const user = await users.fetchUser({ apiKey });

  assertPeer(user, 'invalid api key');

  const userSubscriptions = await subscriptions.listUserSubscriptions(user.id);

  assertPeer(
    userSubscriptions.some(sub => +sub.id === +userSubId),
    'This api key is not allowed to modify this subscription.',
  );

  let statusCode;

  try {
    await subscriptions.removeUserSubscription(userSubId);
    statusCode = 1000;
  } catch (e) {
    if (e instanceof PeerError) {
      log.warn('Peer error occurred while removing subscription: ', userSubId);
      statusCode = 2000;
    } else {
      throw e;
    }
  }

  return { status_code: `${statusCode}` };
}

async function listAirports (params, db) {
  const airports = await db.select('airports');

  for (const air of airports) {
    air.id = `${air.id}`;
  }

  return {
    airports,
  };
}

async function listSubscriptions (params, db) {
  const user = await users.fetchUser({ apiKey: params.api_key });
  const subRows = await subscriptions.listUserSubscriptions(user.id);

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

async function adminListUsers (params) {
  assertPeer(
    await auth.tokenHasRole(params.api_key, 'admin'),
    'You do not have sufficient permission to call admin_list_users method.',
  );
  const userList = await users.listUsers(false);

  // TODO use a helper function ?
  for (const user of userList) {
    user.id = `${user.id}`;
  }

  return {
    users: userList,
  };
}

async function adminListSubscriptions (params) {
  // TODO handle errors how ?
  assertPeer(
    await auth.tokenHasRole(params.api_key, 'admin'),
    'You do not have sufficient permission to call admin_list_subscriptions method.',
  );
  let userSubscriptions;
  let guestSubscriptions;

  if (!params.user_id) {
    userSubscriptions = await subscriptions.listAllUserSubscriptions();
    guestSubscriptions = await subscriptions.listGlobalSubscriptions();
    guestSubscriptions = guestSubscriptions.map(sub => {
      return {
        id: `${sub.id}`,
        fly_from: `${sub.airport_from_id}`,
        fly_to: `${sub.airport_to_id}`,
      };
    });
  } else {
    userSubscriptions = await subscriptions.listUserSubscriptions(
      params.user_id
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

async function adminSubscribe (params) {
  assertPeer(
    await auth.tokenHasRole(params.api_key, 'admin'),
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

async function adminUnsubscribe (params) {
  assertPeer(
    await auth.tokenHasRole(params.api_key, 'admin'),
    'You do not have sufficient permission to call admin_list_subscriptions method.',
  );

  async function removeSubscription (params) {
    let statusCode;

    const subId = +params.user_subscription_id;

    try {
      await subscriptions.removeUserSubscription(subId);
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

  async function removeAllSubscriptions (params) {
    const userId = +params.user_id;
    assertPeer(Number.isInteger(userId), 'user_id must be an integer wrapped in string.');
    let statusCode;
    try {
      await subscriptions.removeAllSubscriptionsOfUser(userId);
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
    return removeAllSubscriptions(params);
  } else {
    return removeSubscription(params);
  }
}

async function adminEditSubscription (params) {
  const userSubId = +params.user_subscription_id;
  const airportFromId = +params.fly_from;
  const airportToId = +params.fly_to;
  const dateFrom = params.date_from;
  const dateTo = params.date_to;

  try {
    await subscriptions.updateUserSubscription(
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
        'An error occurred while executing method admin_unsubscribe with params',
        params,
      );
      return { status_code: '1000' };
    } else {
      throw e;
    }
  }
}

async function adminRemoveUser (params) {
  assertPeer(
    await auth.tokenHasRole(params.api_key, 'admin'),
    'You do not have sufficient permission to call admin_list_subscriptions method.',
  );

  let statusCode;

  try {
    await users.removeUser(params.user_id);
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

async function adminEditUser (params) {
  assertPeer(
    await auth.tokenHasRole(params.api_key, 'admin'),
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
    password = users.hashPassword(params.password);
  }

  try {
    await users.editUser(
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

async function adminListFetches (params, db) {
  assertPeer(
    await auth.tokenHasRole(params.api_key, 'admin'),
    'You do not have sufficient permission to call admin_list_subscriptions method.',
  );

  const fetches = await db.select('fetches');
  return {
    status_code: '1000',
    fetches,
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
