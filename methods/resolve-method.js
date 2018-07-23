const SERVER_TIME_FORMAT = 'Y-MM-DDTHH:mm:ssZ';
const { assertPeer, assertApp, PeerError } = require('../modules/error-handling');
const { toSmallestCurrencyUnit, fromSmallestCurrencyUnit } = require('../modules/utils');
const { isFunction, isObject, each, forOwn } = require('lodash');
const { log } = require('../modules/utils.js');
const auth = require('../modules/auth');
const moment = require('moment');

const API_METHODS = {
  search,
  subscribe,
  unsubsribe,
  list_airports: listAirports,
  list_subscriptions: listSubscriptions,
  list_users: listUsers,
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

    return { route, flyDuration };
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

async function subscribe (params, db) {
  assertPeer(
    Number.isInteger(+params.fly_from) && Number.isInteger(+params.fly_to),
    'subscribe params fly_from and fly_to must be an integer wrapped in a string',
  );
  const flyFrom = +params.fly_from;
  const flyTo = +params.fly_to;
  const email = params.email;
  const dateFrom = params.date_from;
  const dateTo = params.date_to;

  await db.insertIfNotExistsSub(flyFrom, flyTo);
  const isSubscribed = await db.insertEmailSubscription({
    email,
    airportFromId: flyFrom,
    airportToId: flyTo,
    dateFrom,
    dateTo,
  });

  return {
    status_code: (isSubscribed) ? '1000' : '2000',
  };
}

async function unsubsribe (params, db) {
  const isDel = await db.delIfNotExistsEmailSub(params.email);
  return {
    status_code: (isDel) ? '1000' : '2000',
  };
}

async function listAirports (params, db) {
  const airports = await db.select('airports', ['id', 'iata_code', 'name']);

  for (const air of airports) {
    air.id = `${air.id}`;
  }

  return {
    airports,
  };
}

async function listSubscriptions (params, db) {
  const { email } = params;
  const subRows = await db.executeAll(
    `
        SELECT usub.id, usub.date_from, usub.date_to, 
          users.id user_id, users.email,
          ap_from.name airport_from, ap_to.name airport_to
        FROM user_subscriptions usub
        JOIN users ON usub.user_id=users.id
        JOIN subscriptions sub ON usub.subscription_id=sub.id
        JOIN airports ap_from ON sub.airport_from_id=ap_from.id
        JOIN airports ap_to ON sub.airport_to_id=ap_to.id
        WHERE users.email=?
      `,
    email,
  );

  for (const sr of subRows) {
    sr.id = `${sr.id}`;
    sr.user_id = `${sr.user_id}`;
  }

  return {
    subscriptions: subRows,
  };
}

async function listUsers (params, db) {
  const users = await db.select('users', ['id', 'email']);

  for (const user of users) {
    user.id = `${user.id}`;
  }

  return {
    users,
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
