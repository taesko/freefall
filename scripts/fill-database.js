const { Client } = require('pg');
const crypto = require('crypto');
const _ = require('lodash');

const { assertApp } = require('../modules/error-handling');
const log = require('../modules/log');
const db = require('../modules/db');
const utils = require('../modules/utils');
const MAX_QUERY_PARAMS = 30000;
const DB_MAX_INSERT_VALUES = 1000;
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
  const rows = Array.from(range(1, amount))
    .map(rowGenerator);
  log.info('Generated random rows. Beginning inserts');
  const rowsPerInsert = DB_MAX_INSERT_VALUES / rows[0].length;
  const multiRowInserts = generateInsertBatches(
    rows,
    rowsPerInsert,
  );
  const insertBatchGen = utils.batchMap(
    multiRowInserts,
    async ({values, valuesPlaceholders}) => {
      return dbClient.executeQuery(
        `
        INSERT INTO ${table}
          ${columnsString}
        VALUES
          ${valuesPlaceholders}
        ON CONFLICT DO NOTHING;
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
      index * DB_CONCURRENT_INSERTS * multiRowInserts.length * rowsPerInsert,
      amount
    );
    await Promise.all(batch);
  }
}

async function insertRandomAirports (dbClient, amount) {
  const table = 'airports';
  const columnsString = '(id, name, iata_code)';
  const rowGenerator = id => {
    const name = getRandomString({minLength: 5, maxLength: 30});
    const iata = getRandomString({minLength: 3, maxLength: 30});
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
  const rowGenerator = id => {
    const name = getRandomString({
      minLength: MIN_NAME_LENGTH,
      maxLength: MAX_NAME_LENGTH,
    });
    const code = getRandomString({
      minLength: MIN_CODE_LENGTH,
      maxLength: MAX_CODE_LENGTH,
    });
    const logoURL = `https://images.kiwi.com/airlines/64/${code}.png`;
    return [id, name, code, logoURL];
  };

  return insertRandomData(
    dbClient,
    { table, columnsString, rowGenerator, amount },
  );
}

async function insertRandomSubscriptions (dbClient, amount, amountOfAirports) {
  const table = 'subscriptions';
  const columnsString = '(id, airport_from_id, airport_to_id, created_at, updated_at)';
  const dateGen = dateOffsetGeneratorFromToday(1);
  const rowGenerator = id => {
    const from = Math.floor(amount * Math.random()) % amountOfAirports + 1;
    const to = (from + 1) % amountOfAirports;
    const date = dateGen.next().value;
    return [id, from, to, date, date];
  };

  return insertRandomData(
    dbClient,
    { table, columnsString, rowGenerator, amount }
  );
}

async function insertRandomFetches (dbClient, amount) {
  const table = 'fetches';
  const columnsString = '(id, fetch_time)';
  const dateGen = dateOffsetGeneratorFromToday(15);
  const rowGenerator = id => {
    const fetchTime = dateGen.next().value;
    return [id, fetchTime];
  };
  await insertRandomData(dbClient, { table, columnsString, rowGenerator, amount });
}

async function insertRandomSubscriptionsFetches (dbClient) {
  const MIN_API_FETCHES_COUNT = 1;
  const MAX_API_FETCHES_COUNT = 20;
  const SUBSCRIPTIONS_PER_FETCH = 10;

  log.info(`Inserting random subscriptions fetches...`);

  let { rows: subscriptions } = await dbClient.executeQuery(
    `SELECT id FROM subscriptions;`,
  );
  let subscriptionIds = subscriptions.map((subscription) => subscription.id);
  subscriptions = null;

  let { rows: fetches } = await dbClient.executeQuery(
    `SELECT id FROM fetches;`,
  );

  let fetchesIds = fetches.map((f) => f.id);
  fetches = null;

  const newSubscriptionsFetches = [];

  const products = generateProduct(
    fetchesIds,
    subscriptionIds,
    SUBSCRIPTIONS_PER_FETCH,
  );
  for (const [fetchId, subscriptionId] of products) {
    newSubscriptionsFetches.push({
      subscriptionId: subscriptionId,
      fetchId,
    });
  }

  log.info(`Generated ${newSubscriptionsFetches.length} rows. Inserting...`);

  subscriptionIds = null;
  fetchesIds = null;

  const rows = newSubscriptionsFetches.map(({ subscriptionId, fetchId }) => {
    const randomAPIFetchesCount = Math.floor(
      Math.random() * (MAX_API_FETCHES_COUNT - MIN_API_FETCHES_COUNT),
    ) + MIN_API_FETCHES_COUNT;

    return [subscriptionId, fetchId, randomAPIFetchesCount];
  });

  const batchLength = 300;
  const insertBatchesGen = generateInsertBatches(rows, batchLength);
  let index = -1;

  for (const { values, valuesPlaceholders } of insertBatchesGen) {
    index += 1;
    updateProgess(index * batchLength, rows.length);

    await dbClient.executeQuery(
      `
      INSERT INTO subscriptions_fetches
        (subscription_id, fetch_id, api_fetches_count)
      VALUES
        ${valuesPlaceholders}
      ON CONFLICT DO NOTHING;
      `,
      values,
    );
  }

  log.info(`Insert subscriptions fetches finished.`);
}

async function insertRandomUsers (dbClient, amount) {
  const MIN_EMAIL_ADDRESS_LOCAL_PART_LENGTH = 2;
  const MAX_EMAIL_ADDRESS_LOCAL_PART_LENGTH = 40;
  const MIN_EMAIL_ADDRESS_DOMAIN_PART_LENGTH = 2;
  const MAX_EMAIL_ADDRESS_DOMAIN_PART_LENGTH = 20;
  const MIN_PASSWORD_LENGTH = 8;
  const MAX_PASSWORD_LENGTH = 50;
  const MAX_FAILED_ATTEMPTS = 50;
  const ROW_VALUES_COUNT = 6;

  log.info(`Inserting random users... Amount: ${amount}`);

  let { rows: existingUsers } = await dbClient.executeQuery(`

    SELECT
      email
    FROM users;

  `);

  let existingEmails = existingUsers.map((user) => user.email);
  existingUsers = null;

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
      insertQueryParameters += `($${queryParamsCounter + 1}, $${queryParamsCounter + 2}, $${queryParamsCounter + 3}, $${queryParamsCounter + 4}, $${queryParamsCounter + 5}, $${queryParamsCounter + 6})`;

      if (queryParamsCounter + ROW_VALUES_COUNT * 2 < MAX_QUERY_PARAMS && rowsInserted + 1 < amount) {
        insertQueryParameters += ',';
      }

      queryParamsCounter += ROW_VALUES_COUNT;
      rowsInserted++;
    }

    const insertQueryValues = [];

    for (let insertedQueryValues = 0; insertedQueryValues < queryParamsCounter; insertedQueryValues += ROW_VALUES_COUNT) {
      const randomEmail = randomEmailsIterator.next().value;
      const randomPassword = getRandomString({
        minLength: MIN_PASSWORD_LENGTH,
        maxLength: MAX_PASSWORD_LENGTH,
      });

      const hashedRandomPassword = crypto.createHash('md5').update(randomPassword).digest('hex');

      insertQueryValues.push(randomEmail);
      insertQueryValues.push(hashedRandomPassword);
      insertQueryValues.push(crypto.createHash('md5').update(`${randomEmail}:${hashedRandomPassword}`).digest('hex'));
      insertQueryValues.push(true); // verified
      insertQueryValues.push(true); // sent verification email
      insertQueryValues.push(crypto.createHash('md5').update(`${randomEmail}:${hashedRandomPassword}:verification_token`).digest(
        'hex'));
    }

    await dbClient.executeQuery(`

      INSERT INTO users
        (email, password, api_key, verified, sent_verification_email, verification_token)
      VALUES
        ${insertQueryParameters};

    `, insertQueryValues);
  }

  log.info(`Insert users finished.`);
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

async function insertRandomRoutes (dbClient, amount) {
  const MIN_BOOKING_TOKEN_LENGTH = 20;
  const MAX_BOOKING_TOKEN_LENGTH = 100;
  const MIN_PRICE = 30;
  const MAX_PRICE = 3000;
  const MAX_FAILED_ATTEMPTS = 50;
  const ROW_VALUES_COUNT = 3;

  log.info(`Inserting random routes... Amount: ${amount}`);

  let { rows: existingRoutes } = await dbClient.executeQuery(`

    SELECT
      booking_token
    FROM routes;

  `);
  let existingBookingTokens = existingRoutes.map((route) => {
    return route.booking_token;
  });

  existingRoutes = null;

  let { rows: subscriptionsFetches } = await dbClient.executeQuery(`

    SELECT
      id
    FROM subscriptions_fetches;

  `);
  const subscriptionsFetchesIds = subscriptionsFetches.map((sf) => sf.id);

  subscriptionsFetches = null;

  let randomBookingTokens = new Set();
  let failedAttempts = 0;

  for (let i = 0; i < amount; i++) {
    const randomBookingToken = getRandomString({
      minLength: MIN_BOOKING_TOKEN_LENGTH,
      maxLength: MAX_BOOKING_TOKEN_LENGTH,
    });

    if (existingBookingTokens.includes(randomBookingToken)) {
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        throw new Error('MAX_FAILED_ATTEMPTS reached while creating randomBookingTokens set');
      }

      i--; // try again
      failedAttempts++;
      continue;
    }

    randomBookingTokens.add(randomBookingToken);

    if (randomBookingTokens.size < i + 1) {
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        throw new Error('MAX_FAILED_ATTEMPTS reached while creating randomBookingTokens set');
      }

      i--; // try again
      failedAttempts++;
      continue;
    }

    failedAttempts = 0;
  }

  existingBookingTokens = null;
  const randomBookingTokensIterator = randomBookingTokens.values();
  randomBookingTokens = null;

  let rowsInserted = 0;

  while (rowsInserted < amount) {
    updateProgess(rowsInserted, amount);

    let insertQueryParameters = '';
    let queryParamsCounter = 0;

    while (
      queryParamsCounter + ROW_VALUES_COUNT < MAX_QUERY_PARAMS &&
      rowsInserted < amount
    ) {
      insertQueryParameters += `($${queryParamsCounter + 1}, $${queryParamsCounter + 2}, $${queryParamsCounter + 3})`;

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
      const randomIndex = Math.floor(
        Math.random() * subscriptionsFetchesIds.length,
      );
      const randomSubscriptionFetchId = subscriptionsFetchesIds[randomIndex];
      const randomPrice = Math.floor(
        Math.random() * (MAX_PRICE - MIN_PRICE),
      ) + MIN_PRICE;

      insertQueryValues.push(randomBookingTokensIterator.next().value);
      insertQueryValues.push(randomSubscriptionFetchId);
      insertQueryValues.push(randomPrice);
    }

    await dbClient.executeQuery(`

      INSERT INTO routes
        (booking_token, subscription_fetch_id, price)
      VALUES
        ${insertQueryParameters};

    `, insertQueryValues);
  }

  log.info(`Insert routes finished.`);
}

async function insertRandomFlights (dbClient, amount) {
  const MIN_REMOTE_ID_LENGTH = 20;
  const MAX_REMOTE_ID_LENGTH = 20;
  const MIN_FLIGHT_NUMBER_LENGTH = 4;
  const MAX_FLIGHT_NUMBER_LENGTH = 4;
  const START_DATE = new Date('2018-01-01');
  const END_DATE = new Date('2018-12-31');
  const MAX_FAILED_ATTEMPTS = 50;
  const ROW_VALUES_COUNT = 7;

  log.info(`Inserting random flights... Amount: ${amount}`);

  let { rows: existingFlights } = await dbClient.executeQuery(`

    SELECT
      remote_id
    FROM flights;

  `);
  let existingRemoteIds = existingFlights.map((flight) => flight.remote_id);
  existingFlights = null;

  let { rows: airlines } = await dbClient.executeQuery(`

    SELECT
      id
    FROM airlines;

  `);
  let airlineIds = airlines.map((airline) => airline.id);
  airlines = null;

  let { rows: airports } = await dbClient.executeQuery(`

    SELECT
      id
    FROM airports;

  `);
  let airportIds = airports.map((airport) => airport.id);
  airports = null;

  let randomRemoteIds = new Set();
  let failedAttempts = 0;

  for (let i = 0; i < amount; i++) {
    const randomRemoteId = getRandomString({
      minLength: MIN_REMOTE_ID_LENGTH,
      maxLength: MAX_REMOTE_ID_LENGTH,
    });

    if (existingRemoteIds.includes(randomRemoteId)) {
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        throw new Error('MAX_FAILED_ATTEMPTS reached while creating randomRemoteIds set');
      }

      i--; // try again
      failedAttempts++;
      continue;
    }

    randomRemoteIds.add(randomRemoteId);

    if (randomRemoteIds.size < i + 1) {
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        throw new Error('MAX_FAILED_ATTEMPTS reached while creating randomRemoteIds set');
      }

      i--; // try again
      failedAttempts++;
      continue;
    }

    failedAttempts = 0;
  }

  existingRemoteIds = null;
  const randomRemoteIdsIterator = randomRemoteIds.values();
  randomRemoteIds = null;

  const newFlights = [];

  for (
    let i1 = 0;
    i1 < airportIds.length && newFlights.length < amount;
    i1++
  ) {
    for (
      let i2 = 0;
      i2 < airportIds.length && newFlights.length < amount;
      i2++
    ) {
      for (
        let i3 = 0;
        i3 < airlineIds.length && newFlights.length < amount;
        i3++
      ) {
        if (i1 === i2) {
          continue;
        }

        newFlights.push({
          airlineId: airlineIds[i3],
          airportFromId: airportIds[i1],
          airportToId: airportIds[i2],
        });
      }
    }
  }

  airlineIds = null;
  airportIds = null;

  let rowsInserted = 0;

  while (rowsInserted < amount) {
    updateProgess(rowsInserted, amount);

    let insertQueryParameters = '';
    let queryParamsCounter = 0;

    while (
      queryParamsCounter + ROW_VALUES_COUNT < MAX_QUERY_PARAMS &&
      rowsInserted < amount
    ) {
      insertQueryParameters += `($${queryParamsCounter + 1}, $${queryParamsCounter + 2}, $${queryParamsCounter + 3}, $${queryParamsCounter + 4}, $${queryParamsCounter + 5}, $${queryParamsCounter + 6}, $${queryParamsCounter + 7})`;

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
      const departureTime = getRandomDate(START_DATE, END_DATE);
      const arrivalTime = getRandomDate(departureTime, END_DATE);
      const flightNumber = getRandomString({
        minLength: MIN_FLIGHT_NUMBER_LENGTH,
        maxLength: MAX_FLIGHT_NUMBER_LENGTH,
      });

      if (
        departureTime.getDate() === arrivalTime.getDate() &&
        departureTime.getMonth() === arrivalTime.getMonth()
      ) { // avoid check constraint violation
        arrivalTime.setDate(arrivalTime.getDate() + 1);
      }

      const newFlight = newFlights.pop();

      insertQueryValues.push(newFlight.airlineId);
      insertQueryValues.push(flightNumber);
      insertQueryValues.push(newFlight.airportFromId);
      insertQueryValues.push(newFlight.airportToId);
      insertQueryValues.push(departureTime);
      insertQueryValues.push(arrivalTime);
      insertQueryValues.push(randomRemoteIdsIterator.next().value);
    }

    await dbClient.executeQuery(`

      INSERT INTO flights
        (airline_id, flight_number, airport_from_id, airport_to_id, dtime, atime, remote_id)
      VALUES
        ${insertQueryParameters};

    `, insertQueryValues);
  }

  log.info(`Insert flights finished`);
}

async function insertRandomRoutesFlights (dbClient, amount) {
  const ROW_VALUES_COUNT = 2;
  const ROUTE_TO_FLIGHT_RATIO = 5;

  log.info(`Inserting random routes flights... Amount: ${amount}`);

  let { rows: routes } = await dbClient.executeQuery(
    `SELECT id FROM routes;`,
  );
  let routeIds = routes.map((route) => route.id);
  let { rows: flights } = await dbClient.executeQuery(
    `SELECT id FROM flights;`,
  );
  let flightIds = flights.map((flight) => flight.id);

  routes = null;
  flights = null;

  const newRoutesFlights = Array.from(
    generateProduct(routeIds, flightIds, ROUTE_TO_FLIGHT_RATIO),
  ).map(([routeId, flightId]) => {
    return {
      routeId,
      flightId,
    };
  });

  log.info(`Generated ${newRoutesFlights.length} new routes_flights rows.`);

  routeIds = null;
  flightIds = null;

  let rowsInserted = 0;

  while (newRoutesFlights.length > 0) {
    updateProgess(rowsInserted, amount);

    let insertQueryParameters = '';
    let queryParamsCounter = 0;

    while (
      queryParamsCounter + ROW_VALUES_COUNT < MAX_QUERY_PARAMS &&
      rowsInserted < amount
    ) {
      insertQueryParameters += `($${queryParamsCounter + 1}, $${queryParamsCounter + 2})`;

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
      if (newRoutesFlights.length === 0) {
        break;
      }
      const newRouteFlight = newRoutesFlights.pop();

      insertQueryValues.push(newRouteFlight.routeId);
      insertQueryValues.push(newRouteFlight.flightId);
    }
    if (
      newRoutesFlights.length === 0 ||
      insertQueryParameters.length === 0 ||
      insertQueryValues.length === 0
    ) {
      break;
    }

    await dbClient.executeQuery(`

      INSERT INTO routes_flights
        (route_id, flight_id)
      VALUES
        ${insertQueryParameters}
      ON CONFLICT DO NOTHING;

    `, insertQueryValues);
  }

  log.info(`Insert routes flights finished.`);
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
  const AIRPORTS_AMOUNT = 10000;
  const AIRLINES_AMOUNT = 10000;
  const SUBSCRIPTIONS_AMOUNT = 100000;
  const FETCHES_AMOUNT = 10000;
  const USERS_AMOUNT = 100000;
  const USERS_SUBSCRIPTIONS_AMOUNT = 500000;
  const ROUTES_AMOUNT = 100000;
  const FLIGHTS_AMOUNT = 200000;
  const ROUTES_FLIGHTS_AMOUNT = 100000;
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
  await insertRandomSubscriptions(dbClient, SUBSCRIPTIONS_AMOUNT, AIRPORTS_AMOUNT);
  await insertRandomFetches(dbClient, FETCHES_AMOUNT);
  // await insertRandomSubscriptionsFetches(dbClient);
  // await insertRandomRoutes(dbClient, ROUTES_AMOUNT);
  // await insertRandomFlights(dbClient, FLIGHTS_AMOUNT);
  // await insertRandomRoutesFlights(dbClient, ROUTES_FLIGHTS_AMOUNT);
  // await insertRandomUsers(dbClient, USERS_AMOUNT);
  // await insertRandomUsersSubscriptions(dbClient, USERS_SUBSCRIPTIONS_AMOUNT);
  // await insertRandomRoles(dbClient, ROLES_AMOUNT);
  // await insertRandomPermissions(dbClient, PERMISSIONS_AMOUNT);
  // await insertRandomRolesPermissions(dbClient, ROLES_PERMISSIONS_AMOUNT);
  // await insertRandomDalipecheFetches(dbClient, DALIPECHE_FETCHES_AMOUNT);
  // await insertRandomEmployees(dbClient, EMPLOYEES_AMOUNT);
  // await insertRandomEmployeesRoles(dbClient, EMPLOYEES_AMOUNT);
  // await insertRandomLoginSessions(dbClient, ACTIVE_LOGIN_SESSIONS);
  // await insertRandomPasswordResets(dbClient, USERS_AMOUNT);
  // await insertRandomAccountTransfersByEmployees(
  //   dbClient,
  //   ACCOUNT_TRANSFERS_BY_EMPLOYEES_AMOUNT,
  // );
  // await insertRandomUserSubscriptionAccountTransfers(
  //   dbClient,
  //   USER_SUBSCRIPTION_ACCOUNT_TRANSFERS_AMOUNT,
  // );
  // await insertRandomSubscriptionsFetchesAccountTransfers(
  //   dbClient,
  //   SUBSCRIPTION_FETCHES_ACCOUNT_TRANSFERS_AMOUNT,
  // );

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
