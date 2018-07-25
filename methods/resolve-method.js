const SERVER_TIME_FORMAT = 'Y-MM-DDTHH:mm:ssZ';
const { assertPeer, assertApp, PeerError } = require('../modules/error-handling');
const { toSmallestCurrencyUnit, fromSmallestCurrencyUnit } = require('../modules/utils');
const { isObject, each, forOwn } = require('lodash');
const { log } = require('../modules/utils.js');
const auth = require('../modules/auth');
const moment = require('moment');
const subscriptions = require('../modules/subscriptions');

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
  admin_remove_user: adminRemoveUser,
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
      (routeFlight.isReturn === 1 || routeFlight.isReturn === 0),
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

  if (subs <= 0) {
    await subscribe({
      v: params.v,
      fly_from: params.fly_from,
      fly_to: params.fly_to,
    }, db);

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
               typeof flight.dtime === 'string' &&
               typeof flight.atime === 'string' &&
               typeof flight.flightNumber === 'string' &&
               (flight.isReturn === 1 || flight.isReturn === 0);
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

  const user = await auth.fetchUserByAPIKey(params.api_key);

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
    // TODO this try catch should be at an upper level
    // and the method's response object should be built there - setting status_code properly
    // handling the request by sending back the response
    // and rethrowing the exception
    log('An error occurred while subscribing user.', e);
    subscriptionId = null;
    statusCode = 2000;
  }

  return {
    subscription_id: `${subscriptionId}`,
    status_code: `${statusCode}`,
  };
}

async function unsubscribe (params, db) {
  const user = await auth.fetchUserByAPIKey(params.api_key);

  assertPeer(user, 'invalid api key');

  const userSubscriptions = await db.selectWhere(
    'user_subscriptions',
    '*',
    { user_id: user.id },
  );

  assertPeer(
    userSubscriptions.some(sub => +sub.id === +params.user_subscription_id),
    'This api key is not allowed to modify this subscription.',
  );

  let statusCode;

  try {
    await subscriptions.removeUserSubscription(params.user_subscription_id);
    statusCode = 1000;
  } catch (e) {
    log('An error occurred while removing subscription: ', params.user_subscription_id, e);
    statusCode = 2000;
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
  const subRows = await db.executeAll(
    `
      SELECT usub.id, usub.date_from, usub.date_to, 
        ap_from.id fly_from, ap_to.id fly_to
      FROM user_subscriptions usub
      JOIN users ON usub.user_id=users.id
      JOIN subscriptions sub ON usub.subscription_id=sub.id
      JOIN airports ap_from ON sub.airport_from_id=ap_from.id
      JOIN airports ap_to ON sub.airport_to_id=ap_to.id
      WHERE users.api_key=?
    `,
    params.api_key,
  );

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

async function adminListUsers (params, db) {
  assertPeer(
    await auth.tokenHasRole(params.api_key, 'admin'),
    'You do not have sufficient permission to call admin_list_users method.',
  );
  const users = await db.select('users', ['id', 'email']);

  for (const user of users) {
    user.id = `${user.id}`;
  }

  return {
    users,
  };
}

async function adminListSubscriptions (params, db) {
  // TODO handle errors how ?
  assertPeer(
    await auth.tokenHasRole(params.api_key, 'admin'),
    'You do not have sufficient permission to call admin_list_subscriptions method.',
  );
  const mainQuery = `
      SELECT user_sub.id, user_sub.date_from, user_sub.date_to, 
        ap_from.id fly_from, ap_to.id fly_to,
        users.id user_id, users.email user_email
      FROM user_subscriptions user_sub
      JOIN users ON user_sub.user_id=users.id
      JOIN subscriptions sub ON user_sub.subscription_id=sub.id
      JOIN airports ap_from ON sub.airport_from_id=ap_from.id
      JOIN airports ap_to ON sub.airport_to_id=ap_to.id
    `;
  let userSubscriptions;
  let guestSubscriptions;

  if (!params.user_id) {
    userSubscriptions = await db.executeAll(mainQuery);
    guestSubscriptions = await subscriptions.listGlobalSubscriptions();
    guestSubscriptions = guestSubscriptions.map(sub => {
      return {
        id: `${sub.id}`,
        fly_from: `${sub.airport_from_id}`,
        fly_to: `${sub.airport_to_id}`,
      };
    });
  } else {
    userSubscriptions = await db.executeAll(
      `
        ${mainQuery}
        WHERE users.id = ?
      `,
      params.user_id,
    );
    guestSubscriptions = null;
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

  if (guestSubscriptions == null) {
    return {
      status_code: '1000',
      user_subscriptions: userSubscriptions,
    };
  } else {
    return {
      status_code: '1000',
      user_subscriptions: userSubscriptions,
      guest_subscriptions: guestSubscriptions,
    };
  }
}

async function adminSubscribe (params) {
  assertPeer(
    await auth.tokenHasRole(params.api_key, 'admin'),
    'You do not have sufficient permission to call admin_list_subscriptions method.',
  );
  assertPeer(
    Number.isInteger(+params.fly_from) &&
    Number.isInteger(+params.fly_to) &&
    Number.isInteger(+params.user_id),
    'subscribe params fly_from and fly_to must be an integer wrapped in a string',
  );
  const flyFrom = +params.fly_from;
  const flyTo = +params.fly_to;
  const dateFrom = params.date_from;
  const dateTo = params.date_to;
  const userId = +params.user_id;

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
    // TODO this try catch should be at an upper level
    // and the method's response object should be built there - setting status_code properly
    // handling the request by sending back the response
    // and rethrowing the exception
    log('An error occurred while subscribing user.', e);
    subscriptionId = null;
    statusCode = 2000;
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
      log('An error occurred while removing subscription: ', subId, e);
      statusCode = '2000';
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
      statusCode = '2000';
      log(
        `An error occurred in method admin_unsubscribe while removing all subscriptions.',
        'Params of method were: `,
        params,
        e,
      );
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

async function adminRemoveUser (params, db) {
  assertPeer(
    await auth.tokenHasRole(params.api_key, 'admin'),
    'You do not have sufficient permission to call admin_list_subscriptions method.',
  );
  await db.executeRun(
    `
      DELETE
      FROM user_subscriptions
      WHERE user_id=?
    `,
    [+params.user_id],
  );
  await db.executeRun(
    `
      DELETE 
      FROM users
      WHERE id=? AND role='user'
    `,
    [+params.user_id],
  );
  // TODO refactor out into a user module
  return { status_code: '1000' };
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

  log('Got trace from client: ', params);

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
