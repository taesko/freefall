const { Client } = require('pg');
const log = require('../modules/log');
const db = require('../modules/db');
const MAX_QUERY_PARAMS = 30000;

function getRandomString(config) {
  const { minLength, maxLength } = config;

  const stringLength = Math.floor(
    Math.random() * (maxLength - minLength)
  ) + minLength;

  return Math.random().toString(36).substring(stringLength);
}

async function insertRandomAirports (dbClient, amount) {
  const MAX_FAILED_ATTEMPTS = 50;
  const IATA_CODE_LENGTH = 3;
  const MIN_AIRPORT_NAME_LENGTH = 2;
  const MAX_AIRPORT_NAME_LENGTH = 30;

  log.info(`Inserting random airports... Amount: ${amount}`);

  const { rows: existingAirports } = await dbClient.executeQuery(`

    SELECT
      iata_code,
      name
    FROM airports;

  `);

  const existingIATACodes = existingAirports.map(airport => airport.iata_code);
  const existingAirportNames = existingAirports.map(airport => airport.name);

  const randomIATACodes = new Set();
  const randomAirportNames = new Set();

  for (let i = 0; i < amount; i++) {
    let failedAttempts = 0;

    const randomIATACode = getRandomString({
      minLength: IATA_CODE_LENGTH,
      maxLength: IATA_CODE_LENGTH,
    });

    if (existingIATACodes.includes(randomIATACode)) {
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        throw new Error('MAX_FAILED_ATTEMPTS reached while creating randomIATACodes set');
      }

      i--; // try again
      failedAttempts++;
      continue;
    }

    randomIATACodes.add(randomIATACode);

    if (randomIATACodes.size < i + 1) {
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        throw new Error('MAX_FAILED_ATTEMPTS reached while creating randomIATACodes set');
      }

      i--; // try again
      failedAttempts++;
      continue;
    }

    failedAttempts = 0;
  }

  for (let i = 0; i < amount; i++) {
    let failedAttempts = 0;

    const randomAirportName = getRandomString({
      minLength: MIN_AIRPORT_NAME_LENGTH,
      maxLength: MAX_AIRPORT_NAME_LENGTH,
    });

    if (existingAirportNames.includes(randomAirportName)) {
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        throw new Error('MAX_FAILED_ATTEMPTS reached while creating randomAirportNames set');
      }

      i--; // try again
      failedAttempts++;
      continue;
    }

    randomAirportNames.add(randomAirportName);

    if (randomAirportNames.size < i + 1) {
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        throw new Error('MAX_FAILED_ATTEMPTS reached while creating randomAirportNames set');
      }

      i--; // try again
      failedAttempts++;
      continue;
    }

    failedAttempts = 0;
  }

  let insertQueryParameters = '';
  let queryParamsCounter = 0;

  for (let i = 0; i < amount; i++) {
    insertQueryParameters += `($${queryParamsCounter + 1}, $${queryParamsCounter + 2})`;
    queryParamsCounter += 2;

    if (i < amount - 1) {
      insertQueryParameters += ',';
    }
  }

  const randomIATACodesIterator = randomIATACodes.values();
  const randomAirportNamesIterator = randomAirportNames.values();
  const insertQueryValues = [];

  for (let i = 0; i < amount; i++) {
    insertQueryValues.push(randomIATACodesIterator.next().value);
    insertQueryValues.push(randomAirportNamesIterator.next().value);
  }

  await dbClient.executeQuery(`

    INSERT INTO airports
      (iata_code, name)
    VALUES
      ${insertQueryParameters};

  `, insertQueryValues);

  log.info(`Insert airports finished.`);
}

async function insertRandomAirlines(dbClient, amount) {
  const MAX_FAILED_ATTEMPTS = 50;
  const MIN_CODE_LENGTH = 2;
  const MAX_CODE_LENGTH = 8;
  const MIN_NAME_LENGTH = 2;
  const MAX_NAME_LENGTH = 30;
  const ROW_VALUES_COUNT = 3;

  log.info(`Inserting random airlines... Amount: ${amount}`);

  let { rows: existingAirlines } = await dbClient.executeQuery(`

    SELECT
      name,
      code
    FROM airlines;

  `);

  const existingCodes = existingAirlines.map((airline) => airline.code);
  const existingNames = existingAirlines.map((airline) => airline.name);

  existingAirlines = null;

  const randomCodes = new Set();
  const randomNames = new Set();

  for (let i = 0; i < amount; i++) {
    let failedAttempts = 0;

    const randomCode = getRandomString({
      minLength: MIN_CODE_LENGTH,
      maxLength: MAX_CODE_LENGTH,
    });

    if (existingCodes.includes(randomCode)) {
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        throw new Error('MAX_FAILED_ATTEMPTS reached while creating randomCodes set');
      }

      i--; // try again
      failedAttempts++;
      continue;
    }

    randomCodes.add(randomCode);

    if (randomCodes.size < i + 1) {
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        throw new Error('MAX_FAILED_ATTEMPTS reached while creating randomCodes set');
      }

      i--; // try again
      failedAttempts++;
      continue;
    }

    failedAttempts = 0;
  }

  for (let i = 0; i < amount; i++) {
    let failedAttempts = 0;

    const randomName = getRandomString({
      minLength: MIN_NAME_LENGTH,
      maxLength: MAX_NAME_LENGTH,
    });

    if (existingNames.includes(randomName)) {
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        throw new Error('MAX_FAILED_ATTEMPTS reached while creating randomCodes set');
      }

      i--; // try again
      failedAttempts++;
      continue;
    }

    randomNames.add(randomName);

    if (randomNames.size < i + 1) {
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        throw new Error('MAX_FAILED_ATTEMPTS reached while creating randomNames set');
      }

      i--;
      failedAttempts++;
      continue;
    }

    failedAttempts = 0;
  }

  const randomCodesIterator = randomCodes.values();
  const randomNamesIterator = randomNames.values();

  let rowsInserted = 0;

  while (rowsInserted < amount) {
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

    for (let insertedQueryValues = 0; insertedQueryValues < queryParamsCounter; insertedQueryValues += ROW_VALUES_COUNT) {
      const randomCode = randomCodesIterator.next().value;
      insertQueryValues.push(randomNamesIterator.next().value);
      insertQueryValues.push(randomCode);
      insertQueryValues.push(`https://images.kiwi.com/airlines/64/${randomCode}.png`);
    }

    await dbClient.executeQuery(`
      INSERT INTO airlines
        (name, code, logo_url)
      VALUES
        ${insertQueryParameters};
    `, insertQueryValues);
  }

  log.info(`Insert airlines finished.`);
}

async function insertRandomSubscriptions (dbClient, amount) {
  const MAX_FAILED_ATTEMPTS = 50;
  const ROW_VALUES_COUNT = 2;

  log.info(`Inserting random subscriptions... Amount: ${amount}`);

  const { rows: existingSubscriptions } = await dbClient.executeQuery(`

    SELECT
      airport_from_id,
      airport_to_id
    FROM subscriptions;

  `);

  let { rows: airports } = await dbClient.executeQuery(`

    SELECT
      id
    FROM airports;

  `);
  let airportIds = airports.map((airport) => airport.id);

  airports = null;

  const newSubscriptions = [];

  for (let i1 = 0; i1 < airportIds.length && newSubscriptions.length < amount; i1++) {
    for (let i2 = 0; i2 < airportIds.length && newSubscriptions.length < amount; i2++) {
      if (i1 === i2) {
        continue;
      }

      const existingSubscription = existingSubscriptions.find((s) => {
        return (
          airportIds[i1] === s.airport_from_id &&
          airportIds[i2] === s.airport_to_id
        );
      });

      if (existingSubscription) {
        continue;
      }

      newSubscriptions.push([
        airportIds[i1],
        airportIds[i2],
      ]);
    }
  }

  airportIds = null;

  let rowsInserted = 0;

  while (rowsInserted < amount) {
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

    for (let insertedQueryValues = 0; insertedQueryValues < queryParamsCounter; insertedQueryValues += ROW_VALUES_COUNT) {
      const newSubscription = newSubscriptions.pop();
      insertQueryValues.push(newSubscription[0]);
      insertQueryValues.push(newSubscription[1]);
    }

    await dbClient.executeQuery(`

      INSERT INTO subscriptions
        (airport_from_id, airport_to_id)
      VALUES
        ${insertQueryParameters};

    `, insertQueryValues);
  }

  log.info(`Insert subscriptions finished.`);
}

async function insertRandomFetches (dbClient, amount) {
  const ROW_VALUES_COUNT = 1;
  const START_FETCH_TIME = new Date('2018-01-01');
  const END_FETCH_TIME = new Date('2018-12-31');

  log.info(`Inserting random fetches... Amount: ${amount}`);

  const fetchTimes = [];

  while (fetchTimes.length < amount) {
    const timeDuration = END_FETCH_TIME.getTime() - START_FETCH_TIME.getTime();
    const randomDate = new Date(
      START_FETCH_TIME.getTime() +
      Math.random() * timeDuration
    );

    fetchTimes.push(randomDate);
  }

  let rowsInserted = 0;

  while (rowsInserted < amount) {
    let insertQueryParameters = '';
    let queryParamsCounter = 0;

    while (queryParamsCounter + ROW_VALUES_COUNT < MAX_QUERY_PARAMS && rowsInserted < amount) {
      insertQueryParameters += `($${queryParamsCounter + 1})`;

      if (queryParamsCounter + ROW_VALUES_COUNT * 2 < MAX_QUERY_PARAMS && rowsInserted + 1 < amount) {
        insertQueryParameters += ',';
      }

      queryParamsCounter += ROW_VALUES_COUNT;
      rowsInserted++;
    }

    const insertQueryValues = [];

    for (let insertedQueryValues = 0; insertedQueryValues < queryParamsCounter; insertedQueryValues += ROW_VALUES_COUNT) {
      const fetchTime = fetchTimes.pop();
      insertQueryValues.push(fetchTime);
    }

    await dbClient.executeQuery(`

      INSERT INTO fetches
        (fetch_time)
      VALUES
        ${insertQueryParameters};

    `, insertQueryValues);
  }

  log.info(`Insert fetches finished.`);
}

async function insertRandomSubscriptionsFetches(dbClient, amount) {
  const ROW_VALUES_COUNT = 3;
  const MIN_API_FETCHES_COUNT = 1;
  const MAX_API_FETCHES_COUNT = 20;

  log.info(`Inserting random subscriptions fetches... Amount: ${amount}`);

  const { rows: existingSubscriptionsFetches } = await dbClient.executeQuery(`

    SELECT
      subscription_id,
      fetch_id
    FROM subscriptions_fetches;

  `);

  let { rows: subscriptions } = await dbClient.executeQuery(`

    SELECT
      id
    FROM subscriptions;

  `);

  let { rows: fetches } = await dbClient.executeQuery(`

    SELECT
      id
    FROM fetches;

  `);

  let subscriptionIds = subscriptions.map((subscription) => subscription.id);
  subscriptions = null;

  let fetchesIds = fetches.map((f) => f.id);
  fetches = null;

  const newSubscriptionsFetches = [];

  for (let i1 = 0; i1 < subscriptionIds.length && newSubscriptionsFetches.length < amount; i1++) {
    for (let i2 = 0; i2 < fetchesIds.length && newSubscriptionsFetches.length < amount; i2++) {
      const existingSubscriptionFetch = existingSubscriptionsFetches.find((sf) => {
        return (
          subscriptionIds[i1] === sf.subscription_id &&
          fetchesIds[i2] === sf.fetch_id
        );
      });

      if (existingSubscriptionFetch) {
        continue;
      }

      newSubscriptionsFetches.push({
        subscriptionId: subscriptionIds[i1],
        fetchId: fetchesIds[i2],
      });
    }
  }

  subscriptionIds = null;
  fetchesIds = null;

  let rowsInserted = 0;

  while (rowsInserted < amount) {
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

    for (let insertedQueryValues = 0; insertedQueryValues < queryParamsCounter; insertedQueryValues += ROW_VALUES_COUNT) {
      const newSubscriptionFetch = newSubscriptionsFetches.pop();

      insertQueryValues.push(newSubscriptionFetch.subscriptionId);
      insertQueryValues.push(newSubscriptionFetch.fetchId);

      const randomAPIFetchesCount = Math.floor(
        Math.random() * (MAX_API_FETCHES_COUNT - MIN_API_FETCHES_COUNT)
      ) + MIN_API_FETCHES_COUNT;

      insertQueryValues.push(randomAPIFetchesCount);
    }

    await dbClient.executeQuery(`

      INSERT INTO subscriptions_fetches
        (subscription_id, fetch_id, api_fetches_count)
      VALUES
        ${insertQueryParameters};

    `, insertQueryValues);
  }

  log.info(`Insert subscriptions fetches finished.`);
}

async function fillDatabase (dbClient) {
  const AIRPORTS_AMOUNT = 10000;
  const AIRLINES_AMOUNT = 100000;
  const SUBSCRIPTIONS_AMOUNT = 1000000;
  const FETCHES_AMOUNT = 10000;
  const SUBSCRIPTIONS_FETCHES_AMOUNT = 2000000;

  log.info('Fill database started');

  await insertRandomAirports(dbClient, AIRPORTS_AMOUNT);
  await insertRandomAirlines(dbClient, AIRLINES_AMOUNT);
  await insertRandomSubscriptions(dbClient, SUBSCRIPTIONS_AMOUNT);
  await insertRandomFetches(dbClient, FETCHES_AMOUNT);
  await insertRandomSubscriptionsFetches(dbClient, SUBSCRIPTIONS_FETCHES_AMOUNT);

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
    await dbClient.executeQuery('ROLLBACK');
  } catch (error) {
    await dbClient.executeQuery('ROLLBACK');
    log.error(error);
  } finally {
    log.info('Releasing db client..');
    client.end();
  }
}

start().then(() => {
  log.info('Success.');
}).catch(log.error);
