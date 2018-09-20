const { Client } = require('pg');
const crypto = require('crypto');
const _ = require('lodash');
const moment = require('moment');

const { assertApp } = require('../modules/error-handling');
const log = require('../modules/log');
const db = require('../modules/db');
const utils = require('../modules/utils');
const MAX_QUERY_PARAMS = 30000;
const DB_CONCURRENT_INSERTS = 10;

function * generateProduct (collectionA, collectionB, ratio) {
  function randomSequence (collection, sequenceLength) {
    const index = Math.floor(Math.random() * collection.length);
    return collection.slice(index, index + sequenceLength);
  }

  for (const elementOfA of collectionA) {
    const subscriptionsBatch = randomSequence(collectionB, ratio);
    for (const elementOfB of subscriptionsBatch) {
      yield [elementOfA, elementOfB];
    }
  }
}

function computePlaceholders (values, startingOffset = 0) {
  assertApp(Number.isInteger(startingOffset));
  const placeholders = Array(values.length).fill('')
    .map((e, nestedIndex) => `$${startingOffset + nestedIndex + 1}`)
    .join(',');
  return `(${placeholders})`;
}

function * generateInsertBatches (nestedIteratee, batchLength) {
  let batch = [];
  let parameterCount = 0;

  for (const values of nestedIteratee) {
    assertApp(Array.isArray(values));
    assertApp(values.length !== 0);

    if (batch.length > 0 && batch.length % batchLength === 0) {
      const insertParameter = _.flatten(batch.map(e => e.values));
      const insertPlaceholders = batch.map(e => e.placeholders).join(',');
      yield {
        values: insertParameter,
        valuesPlaceholders: insertPlaceholders,
      };
      parameterCount = 0;
      batch = [];
    }

    const placeholders = computePlaceholders(values, parameterCount);

    batch.push({
      values,
      placeholders,
    });
    parameterCount += values.length;
  }

  if (batch.length !== 0) {
    const insertParameter = _.flatten(batch.map(e => e.values));
    const insertPlaceholders = batch.map(e => e.placeholders).join(',');
    yield {
      values: insertParameter,
      valuesPlaceholders: insertPlaceholders,
    };
  }
}

function * generateUniqueRandomString (minLength, maxLength) {
  const strings = {};
  while (true) {
    const randString = getRandomString({ minLength, maxLength });
    if (strings[randString] != null) {
      continue;
    }

    strings[randString] = true;
    yield randString;
  }
}
function getRandomString (config) {
  const allowedCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const { minLength, maxLength } = config;

  const stringLength = Math.floor(
    Math.random() * (maxLength - minLength),
  ) + minLength;

  let result = '';

  for (let i = 0; i < stringLength; i++) {
    result += allowedCharacters.charAt(
      Math.floor(Math.random() * allowedCharacters.length),
    );
  }

  return result;
}

function getRandomDate (minDate, maxDate) {
  const timeDuration = maxDate.getTime() - minDate.getTime();

  const randomDate = new Date(
    minDate.getTime() +
    Math.random() * timeDuration,
  );

  return randomDate;
}

function updateProgess (current, goal) {
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(`${current / goal * 100}%`);
}

function * range (start, stop, step = 1) {
  if (stop == null) {
    stop = start;
    start = 0;
  }

  for (let k = start; step > 0 ? k < stop : k > stop; k += step) {
    yield k;
  }
}

function * dateOffsetGeneratorFromToday (minuteFrequency, forward = false) {
  const today = new Date();
  const difference = today - new Date().setMinutes(
    today.getMinutes() - minuteFrequency
  );
  let index = -1;

  while (true) {
    index += 1;
    if (forward) {
      yield new Date(today.getTime() + difference * index);
    } else {
      yield new Date(today.getTime() - difference * index);
    }
  }
}

async function insertRandomData (
  dbClient,
  {table, columnsString, rowGenerator, amount}
) {
  log.info(`Inserting ${amount} random rows into table ${table}`);
  const rows = (function * generatorMap () {
    for (const id of range(0, amount)) {
      yield rowGenerator(id);
    }
  })();
  // const rowsPerInsert = DB_MAX_INSERT_VALUES / rows[0].length;
  const multiRowInserts = generateInsertBatches(
    rows,
    100,
  );
  const insertBatchGen = utils.batchMap(
    multiRowInserts,
    async ({values, valuesPlaceholders}) => {
      return dbClient.executeQuery(
        `
        INSERT INTO ${table}
          ${columnsString}
        VALUES
          ${valuesPlaceholders};
        `,
        values
      );
    },
    DB_CONCURRENT_INSERTS,
  );
  let index = -1;
  for (const batch of insertBatchGen) {
    index += 1;
    updateProgess(
      index * DB_CONCURRENT_INSERTS,
      amount
    );
    await Promise.all(batch);
  }
  await dbClient.executeQuery(
    `SELECT setval(${table}_id_seq, (SELECT MAX(id) FROM ${table}))`
  );
}

async function insertRandomAirports (dbClient, amount) {
  const minNameLength = 3;
  const maxNameLength = 30;
  const minIataLength = 3;
  const maxIataLength = 8;

  const table = 'airports';
  const columnsString = '(id, name, iata_code)';
  const nameGen = generateUniqueRandomString(minNameLength, maxNameLength);
  const iataGen = generateUniqueRandomString(minIataLength, maxIataLength);

  const rowGenerator = id => {
    const name = nameGen.next().value;
    const iata = iataGen.next().value;
    return [id, name, iata];
  };
  return insertRandomData(
    dbClient,
    { table, columnsString, rowGenerator, amount },
  );
}

async function insertRandomAirlines (dbClient, amount) {
  const MIN_CODE_LENGTH = 2;
  const MAX_CODE_LENGTH = 8;
  const MIN_NAME_LENGTH = 2;
  const MAX_NAME_LENGTH = 30;

  const table = 'airlines';
  const columnsString = '(id, name, code, logo_url)';
  const nameGen = generateUniqueRandomString(MIN_NAME_LENGTH, MAX_NAME_LENGTH);
  const codeGen = generateUniqueRandomString(MIN_CODE_LENGTH, MAX_CODE_LENGTH);
  const rowGenerator = id => {
    const name = nameGen.next().value;
    const code = codeGen.next().value;
    const logoURL = `https://images.kiwi.com/airlines/64/${code}.png`;
    return [id, name, code, logoURL];
  };

  return insertRandomData(
    dbClient,
    { table, columnsString, rowGenerator, amount },
  );
}

/*
* Ratio is how many airport id DUOs of (1, 2) (2, 1) to return
* per every airport id
*
* So for each airport id the generator returns 2 * ratio tuples
 */
function * generateAirportIDDuos (amountOfAirports, ratio) {
  // assertApp(Number.isInteger(amountOfAirports));
  // assertApp(Number.isInteger(ratio));

  for (let id1 = 0; id1 < amountOfAirports; id1++) {
    for (let offset = 1; offset <= ratio; offset++) {
      yield [id1, (id1 + offset) % amountOfAirports];
      // yield [id1 + offset, id1];
    }
  }
}

/*
* subscription with ID x is for airports
* airport_from_id = Math.floor(x / ratio)
* airport_to_id = Math.floor(x / ratio) + x % ratio + 1
 */
async function insertRandomSubscriptions (dbClient, amount, amountOfAirports) {
  const ratio = Math.ceil(amount / amountOfAirports);
  log.info('Airport ratio in subscriptions is', ratio);
  const table = 'subscriptions';
  const columnsString = '(id, airport_from_id, airport_to_id, created_at, updated_at)';
  const dateGen = dateOffsetGeneratorFromToday(1);
  const airportIDsGen = generateAirportIDDuos(amountOfAirports, ratio);
  const rowGenerator = id => {
    const [from, to] = airportIDsGen.next().value;
    const date = dateGen.next().value;
    return [id, from, to, date, date];
  };

  await insertRandomData(
    dbClient,
    { table, columnsString, rowGenerator, amount }
  );

  return ratio;
}

async function insertRandomFetches (dbClient, amount) {
  const table = 'fetches';
  const columnsString = '(id, fetch_time)';
  const dateGen = dateOffsetGeneratorFromToday(15);
  const rowGenerator = id => {
    const fetchTime = dateGen.next().value;
    return [id, fetchTime];
  };

  return insertRandomData(
    dbClient,
    { table, columnsString, rowGenerator, amount }
  );
}

async function insertRandomRecentSubscriptionsFetches (
  dbClient,
  subscriptionsCount,
) {
  assertApp(Number.isInteger(subscriptionsCount));

  const recentFetchID = await dbClient.executeQuery(
    `
    SELECT id
    FROM fetches
    WHERE fetch_time = (SELECT MAX(fetch_time) FROM fetches)
    `
  ).then(pgResult => {
    assertApp(pgResult.rows.length === 1);

    return pgResult.rows[0].id;
  });

  const table = 'subscriptions_fetches';
  const columnsString = '(id, subscription_id, fetch_id)';
  const rowGenerator = id => {
    return [id, id, recentFetchID];
  };

  return insertRandomData(
    dbClient,
    { table, columnsString, rowGenerator, amount: subscriptionsCount }
  );
}

async function insertRandomUsers (dbClient, amount) {
  const MIN_EMAIL_ADDRESS_LOCAL_PART_LENGTH = 2;
  const MAX_EMAIL_ADDRESS_LOCAL_PART_LENGTH = 40;
  const MIN_EMAIL_ADDRESS_DOMAIN_PART_LENGTH = 2;
  const MAX_EMAIL_ADDRESS_DOMAIN_PART_LENGTH = 20;

  function * generateUniqueEmails () {
    const generated = {};
    while (true) {
      const localPart = getRandomString({
        minLength: MIN_EMAIL_ADDRESS_LOCAL_PART_LENGTH,
        maxLength: MAX_EMAIL_ADDRESS_LOCAL_PART_LENGTH,
      });

      const domainPart = getRandomString({
        minLength: MIN_EMAIL_ADDRESS_DOMAIN_PART_LENGTH,
        maxLength: MAX_EMAIL_ADDRESS_DOMAIN_PART_LENGTH,
      });
      const email = `${localPart}@${domainPart}`;

      if (generated[email] != null) {
        continue;
      }

      yield email;
      generated[email] = true;
    }
  }

  const emailGen = generateUniqueEmails();
  const table = 'users';
  const columnsString = `(id, email, password, api_key, verified, sent_verification_email, verification_token)`;
  const rowGenerator = id => {
    const email = emailGen.next().value;
    const password = crypto.createHash('md5').update(email).digest('hex');
    let apiKey = `${email}:${password}`;
    apiKey = crypto.createHash('md5').update(apiKey).digest('hex');
    const verified = true;
    const sentEmail = true;
    return [id, email, password, apiKey, verified, sentEmail, apiKey];
  };
  return insertRandomData(
    dbClient,
    {table, columnsString, rowGenerator, amount},
  );
}

async function insertRandomUsersSubscriptions (dbClient, amount) {
  const START_DATE = new Date('2018-01-01');
  const END_DATE = new Date('2018-12-31');
  const ROW_VALUES_COUNT = 5;
  const SUBSCRIPTIONS_PER_USER = 10;

  log.info(`Inserting random users subscriptions... Going to insert at most: ${amount}`);

  let { rows: users } = await dbClient.executeQuery(`

    SELECT
      id
    FROM users;

  `);
  let userIds = users.map(user => user.id);
  users = null;

  let { rows: subscriptions } = await dbClient.executeQuery(`

    SELECT
      id
    FROM subscriptions;

  `);
  let subscriptionIds = subscriptions.map(subscription => subscription.id);
  subscriptions = null;

  const products = generateProduct(
    userIds,
    subscriptionIds,
    SUBSCRIPTIONS_PER_USER,
  );
  const newUserSubscriptions = Array.from(products)
    .map(([userId, subscriptionId]) => {
      return {
        userId,
        subscriptionId,
      };
    });

  log.info(`Generated ${newUserSubscriptions.length} new random user subscriptions.`);

  userIds = null;
  subscriptionIds = null;

  let rowsInserted = 0;

  while (rowsInserted < amount) {
    updateProgess(rowsInserted, amount);

    let insertQueryParameters = '';
    let queryParamsCounter = 0;

    while (queryParamsCounter + ROW_VALUES_COUNT < MAX_QUERY_PARAMS && rowsInserted < amount) {
      insertQueryParameters += `($${queryParamsCounter + 1}, $${queryParamsCounter + 2}, $${queryParamsCounter + 3}, $${queryParamsCounter + 4}, $${queryParamsCounter + 5})`;

      if (queryParamsCounter + ROW_VALUES_COUNT * 2 < MAX_QUERY_PARAMS && rowsInserted + 1 < amount) {
        insertQueryParameters += ',';
      }

      queryParamsCounter += ROW_VALUES_COUNT;
      rowsInserted++;
    }

    const insertQueryValues = [];

    for (let insertedQueryValues = 0; insertedQueryValues < queryParamsCounter; insertedQueryValues += ROW_VALUES_COUNT) {
      const dateFrom = getRandomDate(START_DATE, END_DATE);
      const dateTo = getRandomDate(dateFrom, END_DATE);

      if (
        dateFrom.getDate() === dateTo.getDate() &&
        dateFrom.getMonth() === dateTo.getMonth()
      ) { // avoid check constraint violation
        dateTo.setDate(dateTo.getDate() + 1);
      }

      if (newUserSubscriptions.length === 0) {
        break;
      }
      const newUserSubscription = newUserSubscriptions.pop();

      insertQueryValues.push(newUserSubscription.userId);
      insertQueryValues.push(newUserSubscription.subscriptionId);
      insertQueryValues.push(dateFrom);
      insertQueryValues.push(dateTo);
      insertQueryValues.push(1); // daily subscription plan
    }
    if (newUserSubscriptions.length === 0) {
      break;
    }

    await dbClient.executeQuery(`

      INSERT INTO users_subscriptions
        (user_id, subscription_id, date_from, date_to, subscription_plan_id)
      VALUES
        ${insertQueryParameters}
      ON CONFLICT DO NOTHING;

    `, insertQueryValues);
  }

  log.info(`Insert user subscriptions finished.`);
}

async function insertRandomRoutes (
  dbClient,
  latestSubscrFetchesCount,
  routesPerSubscriptionFetch,
) {
  assertApp(Number.isInteger(latestSubscrFetchesCount));
  assertApp(Number.isInteger(routesPerSubscriptionFetch));

  const MAX_ROWS = 1e7;
  const MIN_BOOKING_TOKEN_LENGTH = 20;
  const MAX_BOOKING_TOKEN_LENGTH = 100;
  const MIN_PRICE = 30;
  const MAX_PRICE = 3000;
  const bookingTokenGen = generateUniqueRandomString(
    MIN_BOOKING_TOKEN_LENGTH,
    MAX_BOOKING_TOKEN_LENGTH,
  );
  const table = 'routes';
  const columnsString = '(id, booking_token, subscription_fetch_id, price)';
  const amount = latestSubscrFetchesCount * routesPerSubscriptionFetch;

  assertApp(amount <= MAX_ROWS, `Rows to insert is too big - ${amount} total`);

  const rowGenerator = id => {
    const bookingToken = bookingTokenGen.next().value;
    const randomOffset = Math.floor(Math.random() * (MIN_PRICE + MAX_PRICE));
    const price = (MIN_PRICE + randomOffset) * 100; // transform into cents
    const subscriptionFetchId = Math.floor(id / routesPerSubscriptionFetch);

    return [id, bookingToken, subscriptionFetchId, price];
  };

  await insertRandomData(
    dbClient,
    { table, columnsString, amount, rowGenerator },
  );

  return amount;
}

async function insertRandomFlights (
  dbClient,
  {
    airportCount,
    airportRatio,
    airlinesCount,
    routeCount,
    flightsPerRoute,
    routesPerSubscriptionFetch,
    recentSubscriptionFetchCount,
  }
) {
  [
    airportCount, airportRatio, airlinesCount,
    flightsPerRoute, routesPerSubscriptionFetch, recentSubscriptionFetchCount,
  ].every(arg => assertApp(Number.isInteger(arg)));

  const MIN_REMOTE_ID_LENGTH = 20;
  const MAX_REMOTE_ID_LENGTH = 20;
  const MIN_FLIGHT_NUMBER_LENGTH = 4;
  const MAX_FLIGHT_NUMBER_LENGTH = 4;

  const rightNow = moment();
  const table = 'flights';
  const columnsString = `(id, airline_id, flight_number, airport_from_id, airport_to_id, dtime, atime, remote_id)`;
  const remoteIDsGen = generateUniqueRandomString(
    MIN_REMOTE_ID_LENGTH,
    MAX_REMOTE_ID_LENGTH
  );
  const amount = routeCount * flightsPerRoute;

  const rowGenerator = id => {
    const routeID = Math.floor(id / flightsPerRoute); // 0
    const subscrFetchID = Math.floor(routeID / routesPerSubscriptionFetch); // 0

    assertApp(subscrFetchID <= recentSubscriptionFetchCount);

    const subscriptionID = subscrFetchID;
    const routeAirportFromID = Math.floor(subscriptionID / airportRatio);
    const routeAirportToID = routeAirportFromID +
                             subscriptionID % airportRatio + 1;
    const flightIndexInRoute = id % flightsPerRoute;
    const airportIDOffset = airportRatio * 2;

    let airportFromID;
    let airportToID;

    if (flightIndexInRoute === 0) {
      airportFromID = routeAirportFromID;
      airportToID = airportFromID + airportIDOffset;
    } else if (flightIndexInRoute === flightsPerRoute - 1) {
      airportFromID = routeAirportFromID +
                      flightIndexInRoute - 1 +
                      airportIDOffset;
      airportToID = routeAirportToID;
    } else {
      airportFromID = routeAirportFromID +
                      flightIndexInRoute - 1 +
                      airportIDOffset;
      airportToID = routeAirportToID +
                    flightIndexInRoute - 1 +
                    airportIDOffset;
    }
    airportFromID = airportFromID % airportCount;
    airportToID = airportToID % airportCount;

    const flightNumber = getRandomString({
      minLength: MIN_FLIGHT_NUMBER_LENGTH,
      maxLength: MAX_FLIGHT_NUMBER_LENGTH,
    });
    const airlineID = id % airlinesCount;
    const departureTime = moment(rightNow).add(routeID, 'seconds')
      .add(flightIndexInRoute, 'hours');
    const arrivalTime = moment(rightNow).add(routeID, 'seconds')
      .add(flightIndexInRoute + 1, 'hours');
    const remoteID = remoteIDsGen.next().value;

    return [
      id,
      airlineID,
      flightNumber,
      airportFromID,
      airportToID,
      departureTime,
      arrivalTime,
      remoteID,
    ];
  };

  await insertRandomData(
    dbClient,
    { table, columnsString, rowGenerator, amount },
  );

  return amount;
}

async function insertRandomRoutesFlights (
  dbClient,
  {
    routeCount,
    flightsPerRoute,
  }
) {
  assertApp(Number.isInteger(routeCount));
  assertApp(Number.isInteger(flightsPerRoute));

  const table = 'routes_flights';
  const columnsString = '(id, route_id, flight_id)';
  const amount = routeCount * flightsPerRoute;
  const rowGenerator = id => {
    const routeID = Math.floor(id / flightsPerRoute);
    const flightID = id % flightsPerRoute;

    return [id, routeID, flightID];
  };

  await insertRandomData(
    dbClient,
    { table, columnsString, amount, rowGenerator },
  );

  return amount;
}

async function insertRandomRoles (dbClient, amount) {
  const ROW_VALUES_COUNT = 1;
  const MAX_FAILED_ATTEMPTS = 50;
  const MIN_ROLE_NAME_LENGTH = 3;
  const MAX_ROLE_NAME_LENGTH = 30;

  log.info(`Inserting random roles... Amount: ${amount}`);

  let { rows: existingRoles } = await dbClient.executeQuery(`

    SELECT
      name
    FROM roles;

  `);
  let existingRoleNames = existingRoles.map((role) => role.name);
  existingRoles = null;

  let randomRoleNames = new Set();
  let failedAttempts = 0;

  for (let i = 0; i < amount; i++) {
    const randomRoleName = getRandomString({
      minLength: MIN_ROLE_NAME_LENGTH,
      maxLength: MAX_ROLE_NAME_LENGTH,
    });

    if (existingRoleNames.includes(randomRoleName)) {
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        throw new Error('MAX_FAILED_ATTEMPTS reached while creating randomRoleNames set');
      }

      i--; // try again
      failedAttempts++;
      continue;
    }

    randomRoleNames.add(randomRoleName);

    if (randomRoleNames.size < i + 1) {
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        throw new Error('MAX_FAILED_ATTEMPTS reached while creating randomPermissionNames set');
      }

      i--; // try again
      failedAttempts++;
      continue;
    }

    failedAttempts = 0;
  }

  existingRoleNames = null;
  const randomRoleNamesIterator = randomRoleNames.values();
  randomRoleNames = null;

  let rowsInserted = 0;

  while (rowsInserted < amount) {
    updateProgess(rowsInserted, amount);

    let insertQueryParameters = '';
    let queryParamsCounter = 0;

    while (
      queryParamsCounter + ROW_VALUES_COUNT < MAX_QUERY_PARAMS &&
      rowsInserted < amount
    ) {
      insertQueryParameters += `($${queryParamsCounter + 1})`;

      if (
        queryParamsCounter + ROW_VALUES_COUNT * 2 < MAX_QUERY_PARAMS &&
        rowsInserted + 1 < amount
      ) {
        insertQueryParameters += ',';
      }

      queryParamsCounter += ROW_VALUES_COUNT;
      rowsInserted++;
    }

    const insertQueryValues = [];

    for (
      let insertedQueryValues = 0;
      insertedQueryValues < queryParamsCounter;
      insertedQueryValues += ROW_VALUES_COUNT
    ) {
      insertQueryValues.push(randomRoleNamesIterator.next().value);
    }

    await dbClient.executeQuery(`

      INSERT INTO roles
        (name)
      VALUES
        ${insertQueryParameters};

    `, insertQueryValues);
  }

  log.info(`Insert roles finished.`);
}

async function insertRandomPermissions (dbClient, amount) {
  const ROW_VALUES_COUNT = 1;
  const MAX_FAILED_ATTEMPTS = 50;
  const MIN_PERMISSION_NAME_LENGTH = 3;
  const MAX_PERMISSION_NAME_LENGTH = 30;

  log.info(`Inserting random permissions... Amount: ${amount}`);

  let { rows: existingPermissions } = await dbClient.executeQuery(`

    SELECT
      name
    FROM permissions;

  `);
  let existingPermissionsNames = existingPermissions.map((permission) => {
    return permission.name;
  });
  existingPermissions = null;

  let randomPermissionNames = new Set();
  let failedAttempts = 0;

  for (let i = 0; i < amount; i++) {
    const randomPermissionName = getRandomString({
      minLength: MIN_PERMISSION_NAME_LENGTH,
      maxLength: MAX_PERMISSION_NAME_LENGTH,
    });

    if (existingPermissionsNames.includes(randomPermissionName)) {
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        throw new Error('MAX_FAILED_ATTEMPTS reached while creating randomPermissionNames set');
      }

      i--; // try again
      failedAttempts++;
      continue;
    }

    randomPermissionNames.add(randomPermissionName);

    if (randomPermissionNames.size < i + 1) {
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        throw new Error('MAX_FAILED_ATTEMPTS reached while creating randomPermissionNames set');
      }

      i--; // try again
      failedAttempts++;
      continue;
    }

    failedAttempts = 0;
  }

  existingPermissionsNames = null;
  const randomPermissionNamesIterator = randomPermissionNames.values();
  randomPermissionNames = null;
  let rowsInserted = 0;

  while (rowsInserted < amount) {
    updateProgess(rowsInserted, amount);

    let insertQueryParameters = '';
    let queryParamsCounter = 0;

    while (
      queryParamsCounter + ROW_VALUES_COUNT < MAX_QUERY_PARAMS &&
      rowsInserted < amount
    ) {
      insertQueryParameters += `($${queryParamsCounter + 1})`;

      if (
        queryParamsCounter + ROW_VALUES_COUNT * 2 < MAX_QUERY_PARAMS &&
        rowsInserted + 1 < amount
      ) {
        insertQueryParameters += ',';
      }

      queryParamsCounter += ROW_VALUES_COUNT;
      rowsInserted++;
    }

    const insertQueryValues = [];

    for (
      let insertedQueryValues = 0;
      insertedQueryValues < queryParamsCounter;
      insertedQueryValues += ROW_VALUES_COUNT
    ) {
      insertQueryValues.push(randomPermissionNamesIterator.next().value);
    }

    await dbClient.executeQuery(`

      INSERT INTO permissions
        (name)
      VALUES
        ${insertQueryParameters};

    `, insertQueryValues);
  }

  log.info(`Insert permissions finished.`);
}

async function insertRandomRolesPermissions (dbClient, amount) {
  const PERMISSIONS_PER_ROLE = 10;

  log.info(`Inserting random roles permissions... Going to insert at most ${amount}`);

  let { rows: roles } = await dbClient.executeQuery(
    `SELECT id FROM roles;`,
  );
  let roleIds = roles.map((role) => role.id);
  roles = null;

  let { rows: permissions } = await dbClient.executeQuery(
    `SELECT id FROM permissions;`,
  );
  let permissionIds = permissions.map((permission) => permission.id);
  permissions = null;

  const product = generateProduct(roleIds, permissionIds, PERMISSIONS_PER_ROLE);
  const newRolesPermissions = Array.from(product);

  log.info(`Generated ${newRolesPermissions.length} new random rows for roles_permissions table.`);
  roleIds = null;
  permissionIds = null;

  const insertBatch = 400;
  const insertRowsGen = generateInsertBatches(newRolesPermissions, insertBatch);
  let index = -1;

  for (const { values, valuesPlaceholders } of insertRowsGen) {
    index += 1;
    updateProgess(index * insertBatch, newRolesPermissions.length);

    await dbClient.executeQuery(
      `
      INSERT INTO roles_permissions
        (role_id, permission_id)
      VALUES
        ${valuesPlaceholders}
      ON CONFLICT DO NOTHING;
      `,
      values,
    );
  }

  log.info(`Insert roles permissions finished`);
}

async function insertRandomDalipecheFetches (dbClient, amount) {
  const ROW_VALUES_COUNT = 3;
  const MIN_API_KEY_LENGTH = 50;
  const MAX_API_KEY_LENGTH = 50;
  const START_DATE = new Date('2018-01-01');
  const END_DATE = new Date('2018-12-31');
  const DALIPECHE_FETCH_STATUSES = [
    'pending',
    'no_response',
    'bad_response',
    'free_request',
    'failed_request',
    'successful_request',
  ];

  log.info(`Inserting random dalipeche fetches... Amount: ${amount}`);

  let rowsInserted = 0;

  while (rowsInserted < amount) {
    updateProgess(rowsInserted, amount);

    let insertQueryParameters = '';
    let queryParamsCounter = 0;

    while (queryParamsCounter + ROW_VALUES_COUNT < MAX_QUERY_PARAMS && rowsInserted < amount) {
      insertQueryParameters += `($${queryParamsCounter + 1}, $${queryParamsCounter + 2}, $${queryParamsCounter + 3})`;

      if (queryParamsCounter + ROW_VALUES_COUNT * 2 < MAX_QUERY_PARAMS && rowsInserted + 1 < amount) {
        insertQueryParameters += ',';
      }

      queryParamsCounter += ROW_VALUES_COUNT;
      rowsInserted++;
    }

    const insertQueryValues = [];

    for (
      let insertedQueryValues = 0;
      insertedQueryValues < queryParamsCounter;
      insertedQueryValues += ROW_VALUES_COUNT
    ) {
      const randomAPIKey = getRandomString({
        minLength: MIN_API_KEY_LENGTH,
        maxLength: MAX_API_KEY_LENGTH,
      });

      const randomIndex = Math.floor(
        Math.random() * DALIPECHE_FETCH_STATUSES.length,
      );

      insertQueryValues.push(randomAPIKey);
      insertQueryValues.push(getRandomDate(START_DATE, END_DATE));
      insertQueryValues.push(DALIPECHE_FETCH_STATUSES[randomIndex]);
    }

    await dbClient.executeQuery(`

      INSERT INTO dalipeche_fetches
        (api_key, fetch_time, status)
      VALUES
        ${insertQueryParameters};

    `, insertQueryValues);
  }

  log.info(`Insert dalipeche fetches finished.`);
}

async function insertRandomEmployees (dbClient, amount) {
  const MIN_EMAIL_ADDRESS_LOCAL_PART_LENGTH = 2;
  const MAX_EMAIL_ADDRESS_LOCAL_PART_LENGTH = 40;
  const MIN_EMAIL_ADDRESS_DOMAIN_PART_LENGTH = 2;
  const MAX_EMAIL_ADDRESS_DOMAIN_PART_LENGTH = 20;
  const MIN_PASSWORD_LENGTH = 8;
  const MAX_PASSWORD_LENGTH = 50;
  const MAX_FAILED_ATTEMPTS = 50;
  const ROW_VALUES_COUNT = 3;

  log.info(`Inserting random employees... Amount: ${amount}`);

  let { rows: existingEmployees } = await dbClient.executeQuery(`

    SELECT
      email
    FROM employees;

  `);

  let existingEmails = existingEmployees.map((employee) => employee.email);
  existingEmployees = null;

  let randomEmails = new Set();
  let failedAttempts = 0;

  for (let i = 0; i < amount; i++) {
    const randomLocalPart = getRandomString({
      minLength: MIN_EMAIL_ADDRESS_LOCAL_PART_LENGTH,
      maxLength: MAX_EMAIL_ADDRESS_LOCAL_PART_LENGTH,
    });

    const randomDomainPart = getRandomString({
      minLength: MIN_EMAIL_ADDRESS_DOMAIN_PART_LENGTH,
      maxLength: MAX_EMAIL_ADDRESS_DOMAIN_PART_LENGTH,
    });

    const randomEmailAddress = `${randomLocalPart}@${randomDomainPart}`;

    if (existingEmails.includes(randomEmailAddress)) {
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        throw new Error('MAX_FAILED_ATTEMPTS reached while creating randomCodes set');
      }

      i--; // try again
      failedAttempts++;
      continue;
    }

    randomEmails.add(randomEmailAddress);

    if (randomEmails.size < i + 1) {
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        throw new Error('MAX_FAILED_ATTEMPTS reached while creating randomEmails set');
      }

      i--; // try again
      failedAttempts++;
      continue;
    }

    failedAttempts = 0;
  }

  existingEmails = null;
  const randomEmailsIterator = randomEmails.values();
  randomEmails = null;

  let rowsInserted = 0;

  while (rowsInserted < amount) {
    updateProgess(rowsInserted, amount);

    let insertQueryParameters = '';
    let queryParamsCounter = 0;

    while (queryParamsCounter + ROW_VALUES_COUNT < MAX_QUERY_PARAMS && rowsInserted < amount) {
      insertQueryParameters += `($${queryParamsCounter + 1}, $${queryParamsCounter + 2}, $${queryParamsCounter + 3})`;

      if (queryParamsCounter + ROW_VALUES_COUNT * 2 < MAX_QUERY_PARAMS && rowsInserted + 1 < amount) {
        insertQueryParameters += ',';
      }

      queryParamsCounter += ROW_VALUES_COUNT;
      rowsInserted++;
    }

    const insertQueryValues = [];

    for (
      let insertedQueryValues = 0;
      insertedQueryValues < queryParamsCounter;
      insertedQueryValues += ROW_VALUES_COUNT
    ) {
      const randomEmail = randomEmailsIterator.next().value;
      const randomPassword = getRandomString({
        minLength: MIN_PASSWORD_LENGTH,
        maxLength: MAX_PASSWORD_LENGTH,
      });

      const hashedRandomPassword = crypto.createHash('md5').update(randomPassword).digest('hex');

      insertQueryValues.push(randomEmail);
      insertQueryValues.push(hashedRandomPassword);
      insertQueryValues.push(crypto.createHash('md5').update(`${randomEmail}:${hashedRandomPassword}`).digest('hex'));
    }

    await dbClient.executeQuery(`

      INSERT INTO employees
        (email, password, api_key)
      VALUES
        ${insertQueryParameters};

    `, insertQueryValues);
  }

  log.info(`Insert employees finished.`);
}

async function insertRandomEmployeesRoles (dbClient, amount) {
  const ROW_VALUES_COUNT = 2;

  log.info(`Inserting random employees roles... Amount: ${amount}`);

  let { rows: existingEmployeesRoles } = await dbClient.executeQuery(`

    SELECT
      employee_id
    FROM employees_roles;

  `);
  let existingEmployeesRolesEmployeeIds = existingEmployeesRoles.map((er) => {
    return er.employee_id;
  });
  existingEmployeesRoles = null;

  let { rows: employees } = await dbClient.executeQuery(`

    SELECT
      id
    FROM employees;

  `);
  let employeeIds = employees.map((employee) => employee.id);
  employees = null;

  let { rows: roles } = await dbClient.executeQuery(`

    SELECT
      id
    FROM roles;

  `);
  let roleIds = roles.map((role) => role.id);
  roles = null;

  const newEmployeesRoles = [];

  for (
    let i = 0;
    i < employeeIds.length && newEmployeesRoles.length < amount;
    i++
  ) {
    if (existingEmployeesRolesEmployeeIds.includes(employeeIds[i])) {
      continue;
    }

    const randomIndex = Math.floor(Math.random() * roleIds.length);
    const randomRoleId = roleIds[randomIndex];

    newEmployeesRoles.push({
      employeeId: employeeIds[i],
      roleId: randomRoleId,
    });
  }

  existingEmployeesRolesEmployeeIds = null;
  employeeIds = null;
  roleIds = null;

  let rowsInserted = 0;

  while (rowsInserted < amount) {
    updateProgess(rowsInserted, amount);

    let insertQueryParameters = '';
    let queryParamsCounter = 0;

    while (queryParamsCounter + ROW_VALUES_COUNT < MAX_QUERY_PARAMS && rowsInserted < amount) {
      insertQueryParameters += `($${queryParamsCounter + 1}, $${queryParamsCounter + 2})`;

      if (queryParamsCounter + ROW_VALUES_COUNT * 2 < MAX_QUERY_PARAMS && rowsInserted + 1 < amount) {
        insertQueryParameters += ',';
      }

      queryParamsCounter += ROW_VALUES_COUNT;
      rowsInserted++;
    }

    const insertQueryValues = [];

    for (
      let insertedQueryValues = 0;
      insertedQueryValues < queryParamsCounter;
      insertedQueryValues += ROW_VALUES_COUNT
    ) {
      const newEmployeeRole = newEmployeesRoles.pop();

      insertQueryValues.push(newEmployeeRole.employeeId);
      insertQueryValues.push(newEmployeeRole.roleId);
    }

    await dbClient.executeQuery(`

      INSERT INTO employees_roles
        (employee_id, role_id)
      VALUES
        ${insertQueryParameters};

    `, insertQueryValues);
  }

  log.info(`Insert employees roles finished.`);
}

async function insertRandomLoginSessions (dbClient, amount) {
  log.info('Staring to insert login sessions.');
  await dbClient.executeQuery(
    `
    INSERT INTO login_sessions
      (user_id, expiration_date)
    SELECT id, now() + (floor(random()*24)||' hours')::interval
    FROM users 
    LIMIT $1
    ON CONFLICT DO NOTHING;
    `,
    [amount],
  );
  log.info(`Insert login sessions finished.`);
}

async function insertRandomPasswordResets (dbClient, amount) {
  log.info('Starting to insert password resets');
  await dbClient.executeQuery(
    `
    INSERT INTO password_resets
      (user_id, sent_email, expires_on)
    SELECT id, random() > 0.1, now() + (floor(random()*24)||' hours')::interval
    FROM users
    LIMIT $1
    ON CONFLICT DO NOTHING;
    `,
    [amount],
  );
  log.info(`Insert password resets finished`);
}

async function insertRandomAccountTransfersByEmployees (dbClient, amount) {
  const TRANSFER_AMOUNT = 1000;

  log.info('Beginning insert into account_transfers table');
  const { rows: accountTransferRows } = await dbClient.executeQuery(
    `
    INSERT INTO account_transfers
      (user_id, transfer_amount, transferred_at)
    SELECT id, $1, now() - (floor(random()*30)||' days')::interval
    FROM users
    ORDER BY random()
    LIMIT $2
    RETURNING *
    `,
    [TRANSFER_AMOUNT, amount],
  );
  log.info('Finished insert into account_transfers table');

  log.info('Beginning insert into account_transfers_by_employees table');
  await dbClient.executeQuery(
    `
    CREATE OR REPLACE FUNCTION pg_temp.random_employee() RETURNS integer as
    $$ SELECT id FROM employees ORDER BY random() LIMIT 1 $$ language sql;
    `
  );
  await dbClient.executeQuery(
    `
    INSERT INTO account_transfers_by_employees
      (account_transfer_id, employee_id)
    SELECT account_transfers.id, pg_temp.random_employee()
    FROM account_transfers
    ON CONFLICT DO NOTHING
    `,
  );
  log.info('Finished insert into account_transfers_by_employees table');

  log.info('Updating user credits');
  const batchLength = 500;
  const batchesGen = utils.batchMap(
    accountTransferRows,
    row => row.user_id,
    batchLength,
  );
  let index = -1;

  for (const userIds of batchesGen) {
    index += 1;
    updateProgess(index * batchLength, accountTransferRows.length);
    const placeholders = computePlaceholders(userIds, 1);
    await dbClient.executeQuery(
      `
      UPDATE users
      SET credits = credits + $1
      WHERE id IN ${placeholders};
      `,
      [TRANSFER_AMOUNT, ...userIds],
    );
  }
  log.info('Finished updating user credits');
  log.info(`Insert account transfers by employees finished.`);
}

async function insertRandomUserSubscriptionAccountTransfers (dbClient, amount) {
  const TRANSFER_AMOUNT = -20;

  log.info(`Inserting random account transfers for user subscriptions...`);
  const { rows: insertedAccountTransfers } = await dbClient.executeQuery(
    `
    INSERT INTO account_transfers
      (user_id, transfer_amount, transferred_at)
    SELECT users.id, $1, users_subscriptions.created_at
    FROM users
    JOIN users_subscriptions 
      ON users.id=users_subscriptions.user_id
    ORDER BY random()
    RETURNING *;
    `,
    [TRANSFER_AMOUNT],
  );
  log.info(`Finished inserting account transfers. Amount: ${insertedAccountTransfers.length}`);
  log.info(`Inserting random user subscription account transfers...`);
  // TODO account transfers and users subscriptions are not linked properly
  const { rows: insertedUSAT } = await dbClient.executeQuery(
    `
    INSERT INTO user_subscription_account_transfers
      (account_transfer_id, user_subscription_id)
    SELECT account_transfers.id, users_subscriptions.id
    FROM account_transfers
    JOIN users_subscriptions
      ON account_transfers.user_id=users_subscriptions.user_id
    ON CONFLICT DO NOTHING
    `
  );
  log.info(`Finished inserting user subscr account transfers. Amount: ${insertedUSAT}.`);
  log.info('Updating users credits');

  const batchLength = 50;
  const userIDBatchGen = utils.batchMap(
    insertedAccountTransfers,
    row => row.user_id,
    batchLength,
  );
  let index = -1;

  for (const userIDs of userIDBatchGen) {
    index++;
    updateProgess(index * batchLength, insertedAccountTransfers.length);
    const placeholders = computePlaceholders(userIDs, 1);
    await dbClient.executeQuery(
      `
      UPDATE users
      SET credits = credits + $1
      WHERE id IN ${placeholders};
      `,
      [TRANSFER_AMOUNT, ...userIDs]
    );
  }
  log.info(`Finished updating user's credits.`);
}

async function insertRandomSubscriptionsFetchesAccountTransfers (dbClient) {
  const TRANSFER_AMOUNT = -50;

  log.info('Started inserting into account transfers for subscription fetches');
  const { rows: insertedAccountTransfers } = await dbClient.executeQuery(
    `
    INSERT INTO account_transfers
      (user_id, transfer_amount, transferred_at)
    SELECT users_subscriptions.user_id, $1, fetches.fetch_time
    FROM subscriptions_fetches
    JOIN fetches ON subscriptions_fetches.fetch_id = fetches.id
    JOIN users_subscriptions ON subscriptions_fetches.subscription_id = users_subscriptions.subscription_id
    RETURNING *;
    `,
    [TRANSFER_AMOUNT],
  );
  log.info('Finished inserting into account_transfers');
  log.info('Started inserting into subscriptions_fetches_account_transfers');
  await dbClient.executeQuery(
    `
    INSERT INTO subscriptions_fetches_account_transfers
      (account_transfer_id, subscription_fetch_id)
    SELECT account_transfers.id, subscriptions_fetches.id
    FROM account_transfers
    JOIN users_subscriptions ON account_transfers.user_id = users_subscriptions.user_id 
    JOIN subscriptions_fetches ON users_subscriptions.subscription_id = subscriptions_fetches.subscription_id
    ON CONFLICT DO NOTHING
    `,
  );
  log.info('Finished inserting into subscriptions_fetches_account_transfers');
  const batchLength = 500;
  const userIDsBatchGen = utils.batchMap(
    insertedAccountTransfers,
    row => row.user_id,
    batchLength,
  );
  let index = -1;

  log.info('Updating user credits');
  for (const userIDs of userIDsBatchGen) {
    index += 1;
    updateProgess(index * batchLength, insertedAccountTransfers.length);

    const placeholders = computePlaceholders(userIDs, 1);

    await dbClient.executeQuery(
      `
      UPDATE users
      SET credits = credits + $1
      WHERE id IN ${placeholders};
      `,
      [TRANSFER_AMOUNT, ...userIDs]
    );
  }
  log.info('Finished updating user credits');

  log.info(`Insert subscription fetches account transfers finished.`);
}

async function fillDatabase (dbClient) {
  const AIRPORTS_AMOUNT = 1e4;
  const AIRLINES_AMOUNT = 1e4;
  const SUBSCRIPTIONS_AMOUNT = 1e5;
  const FETCHES_AMOUNT = 1e2;
  const ROUTES_PER_SUBSCRIPTION_FETCH = 1e1;
  const FLIGHTS_PER_ROUTE = 4;
  const USERS_AMOUNT = 100000;
  const USERS_SUBSCRIPTIONS_AMOUNT = 500000;
  // flights are more then possible routes, but not as much as the ratio of flights per route
  // because flights might be shared between routes;
  const ROLES_AMOUNT = 1000;
  const PERMISSIONS_AMOUNT = 10000;
  const ROLES_PERMISSIONS_AMOUNT = 100000;
  const DALIPECHE_FETCHES_AMOUNT = 100000;
  const EMPLOYEES_AMOUNT = 5000;
  const ACTIVE_LOGIN_SESSIONS = Math.floor(USERS_AMOUNT / 2);
  const ACCOUNT_TRANSFERS_BY_EMPLOYEES_AMOUNT = 500000;
  const USER_SUBSCRIPTION_ACCOUNT_TRANSFERS_AMOUNT = 100000;
  const SUBSCRIPTION_FETCHES_ACCOUNT_TRANSFERS_AMOUNT = 1000000;

  log.info('Fill database started');

  await insertRandomAirports(dbClient, AIRPORTS_AMOUNT);
  await insertRandomAirlines(dbClient, AIRLINES_AMOUNT);
  const airportRatio = await insertRandomSubscriptions(
    dbClient,
    SUBSCRIPTIONS_AMOUNT,
    AIRPORTS_AMOUNT
  );
  await insertRandomFetches(dbClient, FETCHES_AMOUNT);
  await insertRandomRecentSubscriptionsFetches(
    dbClient,
    SUBSCRIPTIONS_AMOUNT,
  );
  const routeCount = await insertRandomRoutes(
    dbClient,
    SUBSCRIPTIONS_AMOUNT,
    ROUTES_PER_SUBSCRIPTION_FETCH
  );
  await insertRandomFlights(
    dbClient,
    {
      airlinesCount: AIRLINES_AMOUNT,
      airportCount: AIRPORTS_AMOUNT,
      airportRatio,
      routeCount,
      flightsPerRoute: FLIGHTS_PER_ROUTE,
      routesPerSubscriptionFetch: ROUTES_PER_SUBSCRIPTION_FETCH,
      recentSubscriptionFetchCount: SUBSCRIPTIONS_AMOUNT,
    }
  );
  await insertRandomRoutesFlights(
    dbClient,
    {
      routeCount: routeCount,
      flightsPerRoute: FLIGHTS_PER_ROUTE,
    },
  );
  await insertRandomUsers(dbClient, USERS_AMOUNT);
  await insertRandomUsersSubscriptions(dbClient, USERS_SUBSCRIPTIONS_AMOUNT);
  await insertRandomRoles(dbClient, ROLES_AMOUNT);
  await insertRandomPermissions(dbClient, PERMISSIONS_AMOUNT);
  await insertRandomRolesPermissions(dbClient, ROLES_PERMISSIONS_AMOUNT);
  await insertRandomDalipecheFetches(dbClient, DALIPECHE_FETCHES_AMOUNT);
  await insertRandomEmployees(dbClient, EMPLOYEES_AMOUNT);
  await insertRandomEmployeesRoles(dbClient, EMPLOYEES_AMOUNT);
  await insertRandomLoginSessions(dbClient, ACTIVE_LOGIN_SESSIONS);
  await insertRandomPasswordResets(dbClient, USERS_AMOUNT);
  await insertRandomAccountTransfersByEmployees(
    dbClient,
    ACCOUNT_TRANSFERS_BY_EMPLOYEES_AMOUNT,
  );
  await insertRandomUserSubscriptionAccountTransfers(
    dbClient,
    USER_SUBSCRIPTION_ACCOUNT_TRANSFERS_AMOUNT,
  );
  await insertRandomSubscriptionsFetchesAccountTransfers(
    dbClient,
    SUBSCRIPTION_FETCHES_ACCOUNT_TRANSFERS_AMOUNT,
  );

  log.info('Fill database finished');
}

async function start () {
  log.info('Creating db client..');

  const client = new Client();

  await client.connect();

  const dbClient = db.wrapPgClient(client);

  try {
    await dbClient.executeQuery('BEGIN');
    await fillDatabase(dbClient);
    await dbClient.executeQuery('COMMIT');
    log.info('Success.');
  } catch (error) {
    await dbClient.executeQuery('ROLLBACK');
    log.error(error);
  } finally {
    log.info('Releasing db client..');
    await client.end();
  }
}

start().then(() => {
  log.info('Finished.');
}).catch(log.error);
