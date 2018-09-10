const { Client } = require('pg');
const crypto = require('crypto');
const _ = require('lodash');

const { assertApp } = require('../modules/error-handling');
const log = require('../modules/log');
const db = require('../modules/db');
const MAX_QUERY_PARAMS = 30000;

function randomSequence (collection, sequenceLength) {
  const index = Math.floor(Math.random() * collection.length);
  return collection.slice(index, index + sequenceLength);
}

function * generateProduct (collectionA, collectionB, ratio) {
  for (const elementOfA of collectionA) {
    const subscriptionsBatch = randomSequence(collectionB, ratio);
    for (const elementOfB of subscriptionsBatch) {
      yield [elementOfA, elementOfB];
    }
  }
}

function * generateInsertBatches (nestedCollection, batchLength) {
  function computePlaceholders (values, startingIndex = 0) {
    assertApp(Number.isInteger(startingIndex));
    const placeholders = Array(values.length).fill('')
      .map((e, nestedIndex) => `$${startingIndex + nestedIndex + 1}`)
      .join(',');
    return `(${placeholders})`;
  }

  let batch = [];
  let parameterCount = 0;

  for (const values of nestedCollection) {
    assertApp(Array.isArray(values));
    assertApp(values.length !== 0);

    if (batch.length > 0 && batch.length % batchLength === 0) {
      const insertParameter = _.flatten(batch.map(e => e.values));
      const insertPlaceholders = batch.map(e => e.placeholders).join(',');
      yield { values: insertParameter, valuesPlaceholders: insertPlaceholders };
      parameterCount = 0;
      batch = [];
    }

    const placeholders = computePlaceholders(values, parameterCount);

    batch.push({ values, placeholders });
    parameterCount += values.length;
  }

  if (batch.length !== 0) {
    const insertParameter = _.flatten(batch.map(e => e.values));
    const insertPlaceholders = batch.map(e => e.placeholders).join(',');
    yield { values: insertParameter, valuesPlaceholders: insertPlaceholders };
  }
}

function getRandomString (config) {
  const allowedCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const { minLength, maxLength } = config;

  const stringLength = Math.floor(
    Math.random() * (maxLength - minLength)
  ) + minLength;

  let result = '';

  for (let i = 0; i < stringLength; i++) {
    result += allowedCharacters.charAt(
      Math.floor(Math.random() * allowedCharacters.length)
    );
  }

  return result;
}

function getRandomDate (minDate, maxDate) {
  const timeDuration = maxDate.getTime() - minDate.getTime();

  const randomDate = new Date(
    minDate.getTime() +
    Math.random() * timeDuration
  );

  return randomDate;
}

function updateProgess (current, goal) {
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(`${current / goal * 100}%`);
}

async function insertRandomAirports (dbClient, amount) {
  const MAX_FAILED_ATTEMPTS = 50;
  const IATA_CODE_LENGTH = 3;
  const MIN_AIRPORT_NAME_LENGTH = 2;
  const MAX_AIRPORT_NAME_LENGTH = 30;

  log.info(`Inserting random airports... Amount: ${amount}`);

  let { rows: existingAirports } = await dbClient.executeQuery(`

    SELECT
      iata_code,
      name
    FROM airports;

  `);

  let existingIATACodes = existingAirports.map(airport => airport.iata_code);
  let existingAirportNames = existingAirports.map(airport => airport.name);

  existingAirports = null;

  let randomIATACodes = new Set();
  let randomAirportNames = new Set();
  let failedAttempts = 0;

  for (let i = 0; i < amount; i++) {
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

  existingIATACodes = null;

  for (let i = 0; i < amount; i++) {
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

  existingAirportNames = null;

  let insertQueryParameters = '';
  let queryParamsCounter = 0;

  for (let i = 0; i < amount; i++) {
    insertQueryParameters += `($${queryParamsCounter + 1}, $${queryParamsCounter + 2})`;
    queryParamsCounter += 2;

    if (i < amount - 1) {
      insertQueryParameters += ',';
    }
  }

  let randomIATACodesIterator = randomIATACodes.values();
  let randomAirportNamesIterator = randomAirportNames.values();

  randomIATACodes = null;
  randomAirportNames = null;

  const insertQueryValues = [];

  for (let i = 0; i < amount; i++) {
    insertQueryValues.push(randomIATACodesIterator.next().value);
    insertQueryValues.push(randomAirportNamesIterator.next().value);
  }

  randomIATACodesIterator = null;
  randomAirportNamesIterator = null;

  await dbClient.executeQuery(`

    INSERT INTO airports
      (iata_code, name)
    VALUES
      ${insertQueryParameters};

  `, insertQueryValues);

  log.info(`Insert airports finished.`);
}

async function insertRandomAirlines (dbClient, amount) {
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

  let existingCodes = existingAirlines.map((airline) => airline.code);
  let existingNames = existingAirlines.map((airline) => airline.name);

  existingAirlines = null;

  let randomCodes = new Set();
  let randomNames = new Set();
  let failedAttempts = 0;

  for (let i = 0; i < amount; i++) {
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

  existingCodes = null;

  for (let i = 0; i < amount; i++) {
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

  existingNames = null;

  const randomCodesIterator = randomCodes.values();
  const randomNamesIterator = randomNames.values();

  randomCodes = null;
  randomNames = null;

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
  const ROW_VALUES_COUNT = 2;

  log.info(`Inserting random subscriptions... Amount: ${amount}`);

  let { rows: airports } = await dbClient.executeQuery(`

    SELECT
      id
    FROM airports;

  `);
  let airportIds = airports.map((airport) => airport.id);

  airports = null;

  const newSubscriptions = [];

  for (let count = 0; count < amount; count++) {
    const randA = Math.floor(Math.random() * airportIds.length);
    const randB = Math.floor(Math.random() * airportIds.length);
    const from = airportIds[randA];
    const to = airportIds[randB];
    if (from != null && to != null && from !== to) {
      newSubscriptions.push({
        airportFromId: from,
        airportToId: to,
      });
    }
  }

  log.info(`Generated ${newSubscriptions.length} random subscriptions.`);

  airportIds = null;

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

    for (let insertedQueryValues = 0; insertedQueryValues < queryParamsCounter; insertedQueryValues += ROW_VALUES_COUNT) {
      if (newSubscriptions.length === 0) {
        break;
      }
      const newSubscription = newSubscriptions.pop();
      insertQueryValues.push(newSubscription.airportFromId);
      insertQueryValues.push(newSubscription.airportToId);
    }
    if (newSubscriptions.length === 0) {
      break;
    }

    await dbClient.executeQuery(`

      INSERT INTO subscriptions
        (airport_from_id, airport_to_id)
      VALUES
        ${insertQueryParameters}
      ON CONFLICT DO NOTHING
      ;

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
    fetchTimes.push(getRandomDate(START_FETCH_TIME, END_FETCH_TIME));
  }

  let rowsInserted = 0;

  while (rowsInserted < amount) {
    updateProgess(rowsInserted, amount);

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

async function insertRandomSubscriptionsFetches (dbClient) {
  const MIN_API_FETCHES_COUNT = 1;
  const MAX_API_FETCHES_COUNT = 20;
  const SUBSCRIPTIONS_PER_FETCH = 10;

  log.info(`Inserting random subscriptions fetches...`);

  let { rows: subscriptions } = await dbClient.executeQuery(
    `SELECT id FROM subscriptions;`
  );
  let subscriptionIds = subscriptions.map((subscription) => subscription.id);
  subscriptions = null;

  let { rows: fetches } = await dbClient.executeQuery(
    `SELECT id FROM fetches;`
  );

  let fetchesIds = fetches.map((f) => f.id);
  fetches = null;

  const newSubscriptionsFetches = [];

  const products = generateProduct(
    fetchesIds,
    subscriptionIds,
    SUBSCRIPTIONS_PER_FETCH
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
      Math.random() * (MAX_API_FETCHES_COUNT - MIN_API_FETCHES_COUNT)
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
      values
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
      insertQueryValues.push(crypto.createHash('md5').update(`${randomEmail}:${hashedRandomPassword}:verification_token`).digest('hex'));
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

  log.info(`Inserting random users subscriptions... Amount: ${amount}`);

  let { rows: existingUsersSubscriptions } = await dbClient.executeQuery(`

    SELECT
      user_id,
      subscription_id
    FROM users_subscriptions;

  `);

  let { rows: users } = await dbClient.executeQuery(`

    SELECT
      id
    FROM users;

  `);
  let userIds = users.map((user) => user.id);
  users = null;

  let { rows: subscriptions } = await dbClient.executeQuery(`

    SELECT
      id
    FROM subscriptions;

  `);
  let subscriptionIds = subscriptions.map((subscription) => subscription.id);
  subscriptions = null;

  const newUserSubscriptions = [];

  const products = generateProduct(
    userIds,
    subscriptionIds,
    SUBSCRIPTIONS_PER_USER,
  );
  for (const [userId, subscriptionId] of products) {
    const existingUserSubscription = existingUsersSubscriptions.find(
      us => userId === us.user_id && subscriptionId === us.subscription_id,
    );

    if (existingUserSubscription) {
      continue;
    }

    newUserSubscriptions.push({
      userId,
      subscriptionId,
    });
  }

  existingUsersSubscriptions = null;
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

      const newUserSubscription = newUserSubscriptions.pop();

      insertQueryValues.push(newUserSubscription.userId);
      insertQueryValues.push(newUserSubscription.subscriptionId);
      insertQueryValues.push(dateFrom);
      insertQueryValues.push(dateTo);
      insertQueryValues.push(1); // daily subscription plan
    }

    await dbClient.executeQuery(`

      INSERT INTO users_subscriptions
        (user_id, subscription_id, date_from, date_to, subscription_plan_id)
      VALUES
        ${insertQueryParameters};

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
        Math.random() * subscriptionsFetchesIds.length
      );
      const randomSubscriptionFetchId = subscriptionsFetchesIds[randomIndex];
      const randomPrice = Math.floor(
        Math.random() * (MAX_PRICE - MIN_PRICE)
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

  log.info(`Inserting random routes flights... Amount: ${amount}`);

  let { rows: existingRoutesFlights } = await dbClient.executeQuery(`

    SELECT
      route_id,
      flight_id
    FROM routes_flights;

  `);

  let { rows: routes } = await dbClient.executeQuery(`

    SELECT
      id
    FROM routes;

  `);
  let routeIds = routes.map((route) => route.id);
  routes = null;

  let { rows: flights } = await dbClient.executeQuery(`

    SELECT
      id
    FROM flights;

  `);
  let flightIds = flights.map((flight) => flight.id);
  flights = null;

  const newRoutesFlights = [];

  for (
    let i1 = 0;
    i1 < routeIds.length && newRoutesFlights.length < amount;
    i1++
  ) {
    for (
      let i2 = 0;
      i2 < flightIds.length && newRoutesFlights.length < amount;
      i2++
    ) {
      const existingRouteFlight = existingRoutesFlights.find((rf) => {
        return (
          routeIds[i1] === rf.route_id &&
          flightIds[i2] === rf.flight_id
        );
      });

      if (existingRouteFlight) {
        continue;
      }

      newRoutesFlights.push({
        routeId: routeIds[i1],
        flightId: flightIds[i2],
      });
    }
  }

  existingRoutesFlights = null;
  routeIds = null;
  flightIds = null;

  let rowsInserted = 0;

  while (rowsInserted < amount) {
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
      const newRouteFlight = newRoutesFlights.pop();

      insertQueryValues.push(newRouteFlight.routeId);
      insertQueryValues.push(newRouteFlight.flightId);
    }

    await dbClient.executeQuery(`

      INSERT INTO routes_flights
        (route_id, flight_id)
      VALUES
        ${insertQueryParameters};

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
  const ROW_VALUES_COUNT = 2;

  log.info(`Inserting random roles permissions... Amount: ${amount}`);

  let { rows: existingRolesPermissions } = await dbClient.executeQuery(`

    SELECT
      role_id,
      permission_id
    FROM roles_permissions;

  `);

  let { rows: roles } = await dbClient.executeQuery(`

    SELECT
      id
    FROM roles;

  `);
  let roleIds = roles.map((role) => role.id);
  roles = null;

  let { rows: permissions } = await dbClient.executeQuery(`

    SELECT
      id
    FROM permissions;

  `);
  let permissionIds = permissions.map((permission) => permission.id);
  permissions = null;

  const newRolesPermissions = [];

  for (
    let i1 = 0;
    i1 < roleIds.length && newRolesPermissions.length < amount;
    i1++
  ) {
    for (
      let i2 = 0;
      i2 < permissionIds.length && newRolesPermissions.length < amount;
      i2++
    ) {
      const existingRolePermission = existingRolesPermissions.find((rp) => {
        return (
          roleIds[i1] === rp.role_id &&
          permissionIds[i2] === rp.permission_id
        );
      });

      if (existingRolePermission) {
        continue;
      }

      newRolesPermissions.push({
        roleId: roleIds[i1],
        permissionId: permissionIds[i2],
      });
    }
  }

  existingRolesPermissions = null;
  roleIds = null;
  permissionIds = null;

  let rowsInserted = 0;

  while (rowsInserted < amount) {
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
      const newRolePermission = newRolesPermissions.pop();

      insertQueryValues.push(newRolePermission.roleId);
      insertQueryValues.push(newRolePermission.permissionId);
    }

    await dbClient.executeQuery(`

      INSERT INTO roles_permissions
        (role_id, permission_id)
      VALUES
        ${insertQueryParameters};

    `, insertQueryValues);
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
        Math.random() * DALIPECHE_FETCH_STATUSES.length
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
  const ROW_VALUES_COUNT = 1;

  log.info(`Inserting random login sessions... Amount: ${amount}`);

  let { rows: existingLoginSessions } = await dbClient.executeQuery(`

    SELECT
      user_id
    FROM login_sessions;

  `);
  let existingLoginSessionsUserIds = existingLoginSessions.map((ls) => {
    return ls.user_id;
  });
  existingLoginSessions = null;

  let { rows: users } = await dbClient.executeQuery(`

    SELECT
      id
    FROM users;

  `);
  let userIds = users.map((user) => user.id);
  users = null;

  const newLoginSessionsUserIds = [];

  for (let i = 0; i < userIds.length; i++) {
    if (existingLoginSessionsUserIds.includes(userIds[i])) {
      continue;
    }

    newLoginSessionsUserIds.push(userIds[i]);
  }

  existingLoginSessionsUserIds = null;
  userIds = null;

  let rowsInserted = 0;

  while (rowsInserted < amount) {
    updateProgess(rowsInserted, amount);

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

    for (
      let insertedQueryValues = 0;
      insertedQueryValues < queryParamsCounter;
      insertedQueryValues += ROW_VALUES_COUNT
    ) {
      insertQueryValues.push(newLoginSessionsUserIds.pop());
    }

    await dbClient.executeQuery(`

      INSERT INTO login_sessions
        (user_id)
      VALUES
        ${insertQueryParameters};

    `, insertQueryValues);
  }

  log.info(`Insert login sessions finished`);
}

async function insertRandomPasswordResets (dbClient, amount) {
  const ROW_VALUES_COUNT = 1;

  log.info(`Inserting random password resets... Amount: ${amount}`);

  let { rows: existingPasswordResets } = await dbClient.executeQuery(`

    SELECT
      user_id
    FROM password_resets;

  `);
  let existingPasswordResetsUserIds = existingPasswordResets.map((ls) => {
    return ls.user_id;
  });
  existingPasswordResets = null;

  let { rows: users } = await dbClient.executeQuery(`

    SELECT
      id
    FROM users;

  `);
  let userIds = users.map((user) => user.id);
  users = null;

  const newPasswordResetsUserIds = [];

  for (let i = 0; i < userIds.length; i++) {
    if (existingPasswordResetsUserIds.includes(userIds[i])) {
      continue;
    }

    newPasswordResetsUserIds.push(userIds[i]);
  }

  existingPasswordResetsUserIds = null;
  userIds = null;

  let rowsInserted = 0;

  while (rowsInserted < amount) {
    updateProgess(rowsInserted, amount);

    let insertQueryParameters = '';
    let queryParamsCounter = 0;

    while (queryParamsCounter + ROW_VALUES_COUNT < MAX_QUERY_PARAMS && rowsInserted < amount) {
      insertQueryParameters += `($${queryParamsCounter + 1})`;

      if (queryParamsCounter + ROW_VALUES_COUNT * 1 < MAX_QUERY_PARAMS && rowsInserted + 1 < amount) {
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
      insertQueryValues.push(newPasswordResetsUserIds.pop());
    }

    await dbClient.executeQuery(`

      INSERT INTO password_resets
        (user_id)
      VALUES
        ${insertQueryParameters};

    `, insertQueryValues);
  }

  log.info(`Insert password resets finished`);
}

async function insertRandomAccountTransfersByEmployees (dbClient, amount) {
  const TRANSFER_AMOUNT = 1000;
  const ACCOUNT_TRANSFERS_ROW_VALUES_COUNT = 3;
  const ACCOUNT_TRANSFERS_BY_EMPLOYEES_ROW_VALUES_COUNT = 2;

  log.info(`Inserting random account transfers by employees... Amount: ${amount}`);

  let { rows: users } = await dbClient.executeQuery(`

    SELECT
      id
    FROM users;

  `);
  const userIds = users.map((user) => user.id);
  users = null;

  let { rows: employees } = await dbClient.executeQuery(`

    SELECT
      id
    FROM employees;

  `);
  const employeeIds = employees.map((employee) => employee.id);
  employees = null;

  let rowsInserted = 0;

  while (rowsInserted < amount) {
    updateProgess(rowsInserted, amount);

    let insertQueryParameters = '';
    let queryParamsCounter = 0;

    while (queryParamsCounter + ACCOUNT_TRANSFERS_ROW_VALUES_COUNT < MAX_QUERY_PARAMS && rowsInserted < amount) {
      insertQueryParameters += `($${queryParamsCounter + 1}, $${queryParamsCounter + 2}, $${queryParamsCounter + 3})`;

      if (queryParamsCounter + ACCOUNT_TRANSFERS_ROW_VALUES_COUNT * 2 < MAX_QUERY_PARAMS && rowsInserted + 1 < amount) {
        insertQueryParameters += ',';
      }

      queryParamsCounter += ACCOUNT_TRANSFERS_ROW_VALUES_COUNT;
      rowsInserted++;
    }

    let insertQueryValues = [];

    for (
      let insertedQueryValues = 0;
      insertedQueryValues < queryParamsCounter;
      insertedQueryValues += ACCOUNT_TRANSFERS_ROW_VALUES_COUNT
    ) {
      const randomIndex = Math.floor(Math.random() * userIds.length);
      const randomUserId = userIds[randomIndex];

      insertQueryValues.push(randomUserId);
      insertQueryValues.push(TRANSFER_AMOUNT);
      insertQueryValues.push((new Date()).toISOString());
    }

    const { rows: insertedAccountTransfers } = await dbClient.executeQuery(`

      INSERT INTO account_transfers
        (user_id, transfer_amount, transferred_at)
      VALUES
        ${insertQueryParameters}
      RETURNING *;

    `, insertQueryValues);

    insertQueryParameters = '';
    insertQueryValues = [];

    for (let i = 0; i < insertedAccountTransfers.length; i++) {
      const insertedQueryValues =
        i * ACCOUNT_TRANSFERS_BY_EMPLOYEES_ROW_VALUES_COUNT;
      insertQueryParameters += `($${insertedQueryValues + 1}, $${insertedQueryValues + 2})`;

      if (i < insertedAccountTransfers.length - 1) {
        insertQueryParameters += ',';
      }

      insertQueryValues.push(insertedAccountTransfers[i].id);

      const randomIndex = Math.floor(Math.random() * employeeIds.length);
      const randomEmployeeId = employeeIds[randomIndex];

      insertQueryValues.push(randomEmployeeId);
    }

    await dbClient.executeQuery(`

      INSERT INTO account_transfers_by_employees
        (account_transfer_id, employee_id)
      VALUES
        ${insertQueryParameters};

    `, insertQueryValues);

    insertQueryValues = insertedAccountTransfers.map((at) => at.user_id);

    let uniqueInsertQueryValues = [];

    for (let i = 0; i < insertQueryValues.length; i++) {
      if (uniqueInsertQueryValues.includes(insertQueryValues[i])) {
        continue;
      } else {
        uniqueInsertQueryValues.push(insertQueryValues[i]);
      }
    }

    for (let i = 0; i < uniqueInsertQueryValues.length; i++) {
      insertQueryValues.splice(
        insertQueryValues.indexOf(uniqueInsertQueryValues[i]),
        1
      );
    }

    while (uniqueInsertQueryValues.length > 0) {
      insertQueryParameters = '(';

      for (let i = 0; i < uniqueInsertQueryValues.length; i++) {
        insertQueryParameters += `$${i + 2}`; // +2 because first param is transfer amount

        if (i < uniqueInsertQueryValues.length - 1) {
          insertQueryParameters += ',';
        }
      }

      insertQueryParameters += ')';

      await dbClient.executeQuery(`

        UPDATE users
        SET credits = credits + $1
        WHERE id IN ${insertQueryParameters};

      `, [TRANSFER_AMOUNT, ...uniqueInsertQueryValues]);

      uniqueInsertQueryValues = [];

      for (let i = 0; i < insertQueryValues.length; i++) {
        if (uniqueInsertQueryValues.includes(insertQueryValues[i])) {
          continue;
        } else {
          uniqueInsertQueryValues.push(insertQueryValues[i]);
        }
      }
      for (let i = 0; i < uniqueInsertQueryValues.length; i++) {
        insertQueryValues.splice(
          insertQueryValues.indexOf(uniqueInsertQueryValues[i]),
          1
        );
      }
    }
  }

  log.info(`Insert account transfers by employees finished.`);
}

async function insertRandomUserSubscriptionAccountTransfers (dbClient, amount) {
  const ACCOUNT_TRANSFERS_ROW_VALUES_COUNT = 3;
  const USER_SUBSCRIPTION_ACCOUNT_TRANSFERS_ROW_VALUES_COUNT = 2;
  const TRANSFER_AMOUNT = -20;
  const MAX_FAILED_ATTEMPTS = 50;

  log.info(`Inserting random user subscription account transfers... Amount: ${amount}`);

  let { rows: userSubscriptionAccountTransfers } = await dbClient.executeQuery(`

    SELECT
      id
    FROM user_subscription_account_transfers;

  `);
  let userSubscriptionAccountTransfersIds = userSubscriptionAccountTransfers.map((usat) => usat.id);
  userSubscriptionAccountTransfers = null;

  const { rows: users } = await dbClient.executeQuery(`

    SELECT
      id,
      credits
    FROM users;

  `);

  let { rows: usersSubscriptions } = await dbClient.executeQuery(`

    SELECT
      id
    FROM users_subscriptions;

  `);
  let usersSubscriptionsIds = usersSubscriptions.map((us) => us.id);
  usersSubscriptions = null;

  let rowsInserted = 0;
  let randomUserSubscriptionIds = new Set();

  for (let i = 0; i < usersSubscriptionsIds.length; i++) {
    if (
      userSubscriptionAccountTransfersIds.includes(usersSubscriptionsIds[i])
    ) {
      continue;
    }

    randomUserSubscriptionIds.add(usersSubscriptionsIds[i]);
  }

  usersSubscriptionsIds = null;
  userSubscriptionAccountTransfersIds = null;
  const randomUserSubscriptionIdsIterator = randomUserSubscriptionIds.values();
  randomUserSubscriptionIds = null;

  while (rowsInserted < amount) {
    updateProgess(rowsInserted, amount);

    let insertQueryParameters = '';
    let queryParamsCounter = 0;

    while (queryParamsCounter + ACCOUNT_TRANSFERS_ROW_VALUES_COUNT < MAX_QUERY_PARAMS && rowsInserted < amount) {
      insertQueryParameters += `($${queryParamsCounter + 1}, $${queryParamsCounter + 2}, $${queryParamsCounter + 3})`;

      if (queryParamsCounter + ACCOUNT_TRANSFERS_ROW_VALUES_COUNT * 2 < MAX_QUERY_PARAMS && rowsInserted + 1 < amount) {
        insertQueryParameters += ',';
      }

      queryParamsCounter += ACCOUNT_TRANSFERS_ROW_VALUES_COUNT;
      rowsInserted++;
    }

    let insertQueryValues = [];
    let failedAttempts = 0;

    for (
      let insertedQueryValues = 0;
      insertedQueryValues < queryParamsCounter;
      insertedQueryValues += ACCOUNT_TRANSFERS_ROW_VALUES_COUNT
    ) {
      const randomIndex = Math.floor(Math.random() * users.length);

      if (users[randomIndex].credits <= Math.abs(TRANSFER_AMOUNT)) {
        if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
          throw new Error('MAX_FAILED_ATTEMPTS reached while selecting users');
        }

        failedAttempts++;
        insertedQueryValues -= ACCOUNT_TRANSFERS_ROW_VALUES_COUNT; // try again
        continue;
      }

      users[randomIndex].credits += TRANSFER_AMOUNT;

      insertQueryValues.push(users[randomIndex].id);
      insertQueryValues.push(TRANSFER_AMOUNT);
      insertQueryValues.push((new Date()).toISOString());

      failedAttempts = 0;
    }

    const { rows: insertedAccountTransfers } = await dbClient.executeQuery(`

      INSERT INTO account_transfers
        (user_id, transfer_amount, transferred_at)
      VALUES
        ${insertQueryParameters}
      RETURNING *;

    `, insertQueryValues);

    insertQueryParameters = '';
    insertQueryValues = [];

    for (let i = 0; i < insertedAccountTransfers.length; i++) {
      const insertedQueryValues =
        i * USER_SUBSCRIPTION_ACCOUNT_TRANSFERS_ROW_VALUES_COUNT;
      insertQueryParameters += `($${insertedQueryValues + 1}, $${insertedQueryValues + 2})`;

      if (i < insertedAccountTransfers.length - 1) {
        insertQueryParameters += ',';
      }

      insertQueryValues.push(insertedAccountTransfers[i].id);

      insertQueryValues.push(randomUserSubscriptionIdsIterator.next().value);
    }

    await dbClient.executeQuery(`

      INSERT INTO user_subscription_account_transfers
        (account_transfer_id, user_subscription_id)
      VALUES
        ${insertQueryParameters};

    `, insertQueryValues);

    insertQueryValues = insertedAccountTransfers.map((at) => at.user_id);

    let uniqueInsertQueryValues = [];

    for (let i = 0; i < insertQueryValues.length; i++) {
      if (uniqueInsertQueryValues.includes(insertQueryValues[i])) {
        continue;
      } else {
        uniqueInsertQueryValues.push(insertQueryValues[i]);
      }
    }

    for (let i = 0; i < uniqueInsertQueryValues.length; i++) {
      insertQueryValues.splice(
        insertQueryValues.indexOf(uniqueInsertQueryValues[i]),
        1
      );
    }

    while (uniqueInsertQueryValues.length > 0) {
      insertQueryParameters = '(';

      for (let i = 0; i < uniqueInsertQueryValues.length; i++) {
        insertQueryParameters += `$${i + 2}`; // +2 because first param is transfer amount

        if (i < uniqueInsertQueryValues.length - 1) {
          insertQueryParameters += ',';
        }
      }

      insertQueryParameters += ')';

      await dbClient.executeQuery(`

        UPDATE users
        SET credits = credits + $1
        WHERE id IN ${insertQueryParameters};

      `, [TRANSFER_AMOUNT, ...uniqueInsertQueryValues]);

      uniqueInsertQueryValues = [];

      for (let i = 0; i < insertQueryValues.length; i++) {
        if (uniqueInsertQueryValues.includes(insertQueryValues[i])) {
          continue;
        } else {
          uniqueInsertQueryValues.push(insertQueryValues[i]);
        }
      }

      for (let i = 0; i < uniqueInsertQueryValues.length; i++) {
        insertQueryValues.splice(
          insertQueryValues.indexOf(uniqueInsertQueryValues[i]),
          1
        );
      }
    }
  }

  log.info(`Insert user subscription account transfers finished.`);
}

async function insertRandomSubscriptionsFetchesAccountTransfers (dbClient, amount) {
  const ACCOUNT_TRANSFERS_ROW_VALUES_COUNT = 3;
  const SUBSCRIPTION_FETCHES_ACCOUNT_TRANSFERS_ROW_VALUES_COUNT = 2;
  const TRANSFER_AMOUNT = -50;
  const MAX_FAILED_ATTEMPTS = 50;

  log.info(`Inserting random subscription fetches account transfers... Amount: ${amount}`);

  const { rows: users } = await dbClient.executeQuery(`

    SELECT
      id,
      credits
    FROM users;

  `);

  let { rows: subscriptionsFetches } = await dbClient.executeQuery(`

    SELECT
      id
    FROM subscriptions_fetches;

  `);
  const subscriptionsFetchesIds = subscriptionsFetches.map((sf) => sf.id);
  subscriptionsFetches = null;

  let rowsInserted = 0;

  while (rowsInserted < amount) {
    updateProgess(rowsInserted, amount);

    let insertQueryParameters = '';
    let queryParamsCounter = 0;

    while (queryParamsCounter + ACCOUNT_TRANSFERS_ROW_VALUES_COUNT < MAX_QUERY_PARAMS && rowsInserted < amount) {
      insertQueryParameters += `($${queryParamsCounter + 1}, $${queryParamsCounter + 2}, $${queryParamsCounter + 3})`;

      if (queryParamsCounter + ACCOUNT_TRANSFERS_ROW_VALUES_COUNT * 2 < MAX_QUERY_PARAMS && rowsInserted + 1 < amount) {
        insertQueryParameters += ',';
      }

      queryParamsCounter += ACCOUNT_TRANSFERS_ROW_VALUES_COUNT;
      rowsInserted++;
    }

    let insertQueryValues = [];
    let failedAttempts = 0;

    for (
      let insertedQueryValues = 0;
      insertedQueryValues < queryParamsCounter;
      insertedQueryValues += ACCOUNT_TRANSFERS_ROW_VALUES_COUNT
    ) {
      const randomIndex = Math.floor(Math.random() * users.length);

      if (users[randomIndex].credits <= Math.abs(TRANSFER_AMOUNT)) {
        if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
          throw new Error('MAX_FAILED_ATTEMPTS reached while selecting users');
        }

        failedAttempts++;
        insertedQueryValues -= ACCOUNT_TRANSFERS_ROW_VALUES_COUNT; // try again
        continue;
      }

      users[randomIndex].credits += TRANSFER_AMOUNT;

      insertQueryValues.push(users[randomIndex].id);
      insertQueryValues.push(TRANSFER_AMOUNT);
      insertQueryValues.push((new Date()).toISOString());

      failedAttempts = 0;
    }

    const { rows: insertedAccountTransfers } = await dbClient.executeQuery(`

      INSERT INTO account_transfers
        (user_id, transfer_amount, transferred_at)
      VALUES
        ${insertQueryParameters}
      RETURNING *;

    `, insertQueryValues);

    insertQueryParameters = '';
    insertQueryValues = [];

    for (let i = 0; i < insertedAccountTransfers.length; i++) {
      const insertedQueryValues =
        i * SUBSCRIPTION_FETCHES_ACCOUNT_TRANSFERS_ROW_VALUES_COUNT;
      insertQueryParameters += `($${insertedQueryValues + 1}, $${insertedQueryValues + 2})`;

      if (i < insertedAccountTransfers.length - 1) {
        insertQueryParameters += ',';
      }

      insertQueryValues.push(insertedAccountTransfers[i].id);

      const randomIndex = Math.floor(
        Math.random() * subscriptionsFetchesIds.length
      );
      const randomSubscriptionFetchId = subscriptionsFetchesIds[randomIndex];

      insertQueryValues.push(randomSubscriptionFetchId);
    }

    await dbClient.executeQuery(`

      INSERT INTO subscriptions_fetches_account_transfers
        (account_transfer_id, subscription_fetch_id)
      VALUES
        ${insertQueryParameters};

    `, insertQueryValues);

    insertQueryValues = insertedAccountTransfers.map((at) => at.user_id);

    let uniqueInsertQueryValues = [];

    for (let i = 0; i < insertQueryValues.length; i++) {
      if (uniqueInsertQueryValues.includes(insertQueryValues[i])) {
        continue;
      } else {
        uniqueInsertQueryValues.push(insertQueryValues[i]);
      }
    }

    for (let i = 0; i < uniqueInsertQueryValues.length; i++) {
      insertQueryValues.splice(
        insertQueryValues.indexOf(uniqueInsertQueryValues[i]),
        1
      );
    }

    while (uniqueInsertQueryValues.length > 0) {
      insertQueryParameters = '(';

      for (let i = 0; i < uniqueInsertQueryValues.length; i++) {
        insertQueryParameters += `$${i + 2}`; // +2 because first param is transfer amount

        if (i < uniqueInsertQueryValues.length - 1) {
          insertQueryParameters += ',';
        }
      }

      insertQueryParameters += ')';

      await dbClient.executeQuery(`

        UPDATE users
        SET credits = credits + $1
        WHERE id IN ${insertQueryParameters};

      `, [TRANSFER_AMOUNT, ...uniqueInsertQueryValues]);

      uniqueInsertQueryValues = [];

      for (let i = 0; i < insertQueryValues.length; i++) {
        if (uniqueInsertQueryValues.includes(insertQueryValues[i])) {
          continue;
        } else {
          uniqueInsertQueryValues.push(insertQueryValues[i]);
        }
      }

      for (let i = 0; i < uniqueInsertQueryValues.length; i++) {
        insertQueryValues.splice(
          insertQueryValues.indexOf(uniqueInsertQueryValues[i]),
          1
        );
      }
    }
  }

  log.info(`Insert subscription fetches account transfers finished.`);
}

async function fillDatabase (dbClient) {
  const AIRPORTS_AMOUNT = 10000;
  const AIRLINES_AMOUNT = 10000;
  const SUBSCRIPTIONS_AMOUNT = 100000;
  const FETCHES_AMOUNT = 10000;
  const SUBSCRIPTIONS_FETCHES_AMOUNT = 200000;
  const USERS_AMOUNT = 100000;
  const USERS_SUBSCRIPTIONS_AMOUNT = 500000;
  const ROUTES_AMOUNT = 100000;
  const FLIGHTS_AMOUNT = 1000000;
  const ROUTES_FLIGHTS_AMOUNT = 2000000;
  const ROLES_AMOUNT = 1000;
  const PERMISSIONS_AMOUNT = 10000;
  const ROLES_PERMISSIONS_AMOUNT = 100000;
  const DALIPECHE_FETCHES_AMOUNT = 1000;
  const EMPLOYEES_AMOUNT = 5000;
  const ACCOUNT_TRANSFERS_BY_EMPLOYEES_AMOUNT = 500000;
  const USER_SUBSCRIPTION_ACCOUNT_TRANSFERS_AMOUNT = 100000;
  const SUBSCRIPTION_FETCHES_ACCOUNT_TRANSFERS_AMOUNT = 1000000;

  log.info('Fill database started');

  await insertRandomAirports(dbClient, AIRPORTS_AMOUNT);
  await insertRandomAirlines(dbClient, AIRLINES_AMOUNT);
  await insertRandomSubscriptions(dbClient, SUBSCRIPTIONS_AMOUNT);
  await insertRandomFetches(dbClient, FETCHES_AMOUNT);
  await insertRandomSubscriptionsFetches(
    dbClient,
    SUBSCRIPTIONS_FETCHES_AMOUNT
  );
  await insertRandomUsers(dbClient, USERS_AMOUNT);
  await insertRandomUsersSubscriptions(dbClient, USERS_SUBSCRIPTIONS_AMOUNT);
  await insertRandomRoutes(dbClient, ROUTES_AMOUNT);
  await insertRandomFlights(dbClient, FLIGHTS_AMOUNT);
  await insertRandomRoutesFlights(dbClient, ROUTES_FLIGHTS_AMOUNT);
  await insertRandomRoles(dbClient, ROLES_AMOUNT);
  await insertRandomPermissions(dbClient, PERMISSIONS_AMOUNT);
  await insertRandomRolesPermissions(dbClient, ROLES_PERMISSIONS_AMOUNT);
  await insertRandomDalipecheFetches(dbClient, DALIPECHE_FETCHES_AMOUNT);
  await insertRandomEmployees(dbClient, EMPLOYEES_AMOUNT);
  await insertRandomEmployeesRoles(dbClient, EMPLOYEES_AMOUNT);
  await insertRandomLoginSessions(dbClient, USERS_AMOUNT);
  await insertRandomPasswordResets(dbClient, USERS_AMOUNT);
  await insertRandomAccountTransfersByEmployees(
    dbClient,
    ACCOUNT_TRANSFERS_BY_EMPLOYEES_AMOUNT
  );
  await insertRandomUserSubscriptionAccountTransfers(
    dbClient,
    USER_SUBSCRIPTION_ACCOUNT_TRANSFERS_AMOUNT
  );
  await insertRandomSubscriptionsFetchesAccountTransfers(
    dbClient,
    SUBSCRIPTION_FETCHES_ACCOUNT_TRANSFERS_AMOUNT
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
