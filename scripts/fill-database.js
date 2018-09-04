const { Client } = require('pg');
const crypto = require('crypto');
const log = require('../modules/log');
const db = require('../modules/db');
const MAX_QUERY_PARAMS = 30000;

function getRandomString(config) {
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

function getRandomDate(minDate, maxDate) {
  const timeDuration = maxDate.getTime() - minDate.getTime();

  const randomDate = new Date(
    minDate.getTime() +
    Math.random() * timeDuration
  );

  return randomDate;
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

      newSubscriptions.push({
        airportFromId: airportIds[i1],
        airportToId: airportIds[i2],
      });
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
      insertQueryValues.push(newSubscription.airportFromId);
      insertQueryValues.push(newSubscription.airportToId);
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
    fetchTimes.push(getRandomDate(START_FETCH_TIME, END_FETCH_TIME));
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

async function insertRandomUsers(dbClient, amount) {
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
      email,
      api_key,
      verification_token
    FROM users;

  `);

  let existingEmails = existingUsers.map((user) => user.email);

  existingUsers = null;

  const randomEmails = new Set();

  for (let i = 0; i < amount; i++) {
    let failedAttempts = 0;

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

  const randomEmailsIterator = randomEmails.values();

  let rowsInserted = 0;

  while (rowsInserted < amount) {
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
  const MAX_FAILED_ATTEMPTS = 50;
  const START_DATE = new Date('2018-01-01');
  const END_DATE = new Date('2018-12-31');
  const ROW_VALUES_COUNT = 5;

  log.info(`Inserting random users subscriptions... Amount: ${amount}`);

  const { rows: existingUsersSubscriptions } = await dbClient.executeQuery(`

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

  for (let i1 = 0; i1 < userIds.length && newUserSubscriptions.length < amount; i1++) {
    for (let i2 = 0; i2 < subscriptionIds.length && newUserSubscriptions.length < amount; i2++) {
      const existingUserSubscription = existingUsersSubscriptions.find((us) => {
        return (
          userIds[i1] === us.user_id &&
          subscriptionIds[i2] === us.subscription_id
        );
      });

      if (existingUserSubscription) {
        continue;
      }

      newUserSubscriptions.push({
        userId: userIds[i1],
        subscriptionId: subscriptionIds[i2],
      });
    }
  }

  userIds = null;
  subscriptionIds = null;

  let rowsInserted = 0;

  while (rowsInserted < amount) {
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
  const existingBookingTokens = existingRoutes.map((route) => route.booking_token);

  existingRoutes = null;

  let { rows: subscriptionsFetches } = await dbClient.executeQuery(`

    SELECT
      id
    FROM subscriptions_fetches;

  `);
  const subscriptionsFetchesIds = subscriptionsFetches.map((sf) => sf.id);

  subscriptionsFetches = null;

  const randomBookingTokens = new Set();

  for (let i = 0; i < amount; i++) {
    let failedAttempts = 0;

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

  const randomBookingTokensIterator = randomBookingTokens.values();

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
  const existingRemoteIds = existingFlights.map((flight) => flight.remote_id);
  existingFlights = null;

  let { rows: airlines } = await dbClient.executeQuery(`

    SELECT
      id
    FROM airlines;

  `);
  const airlineIds = airlines.map((airline) => airline.id);
  airlines = null;

  let { rows: airports } = await dbClient.executeQuery(`

    SELECT
      id
    FROM airports;

  `);
  const airportIds = airports.map((airport) => airport.id);
  airports = null;

  const randomRemoteIds = new Set();

  for (let i = 0; i < amount; i++) {
    let failedAttempts = 0;

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

  const randomRemoteIdsIterator = randomRemoteIds.values();

  const newFlights = [];

  for (let i1 = 0; i1 < airportIds.length && newFlights.length < amount; i1++) {
    for (let i2 = 0; i2 < airportIds.length && newFlights.length < amount; i2++) {
      for (let i3 = 0; i3 < airlineIds.length && newFlights.length < amount; i3++) {
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

  let rowsInserted = 0;

  while (rowsInserted < amount) {
    let insertQueryParameters = '';
    let queryParamsCounter = 0;

    while (queryParamsCounter + ROW_VALUES_COUNT < MAX_QUERY_PARAMS && rowsInserted < amount) {
      insertQueryParameters += `($${queryParamsCounter + 1}, $${queryParamsCounter + 2}, $${queryParamsCounter + 3}, $${queryParamsCounter + 4}, $${queryParamsCounter + 5}, $${queryParamsCounter + 6}, $${queryParamsCounter + 7})`;

      if (queryParamsCounter + ROW_VALUES_COUNT * 2 < MAX_QUERY_PARAMS && rowsInserted + 1 < amount) {
        insertQueryParameters += ',';
      }

      queryParamsCounter += ROW_VALUES_COUNT;
      rowsInserted++;
    }

    const insertQueryValues = [];

    for (let insertedQueryValues = 0; insertedQueryValues < queryParamsCounter; insertedQueryValues += ROW_VALUES_COUNT) {
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

  const { rows: existingRoutesFlights } = await dbClient.executeQuery(`

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

  for (let i1 = 0; i1 < routeIds.length && newRoutesFlights.length < amount; i1++) {
    for (let i2 = 0; i2 < flightIds.length && newRoutesFlights.length < amount; i2++) {
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

  routeIds = null;
  flightIds = null;

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

async function fillDatabase (dbClient) {
  const AIRPORTS_AMOUNT = 1000;
  const AIRLINES_AMOUNT = 1000;
  const SUBSCRIPTIONS_AMOUNT = 1000;
  const FETCHES_AMOUNT = 1000;
  const SUBSCRIPTIONS_FETCHES_AMOUNT = 2000;
  const USERS_AMOUNT = 1000;
  const USERS_SUBSCRIPTIONS_AMOUNT = 2000;
  const ROUTES_AMOUNT = 1000;
  const FLIGHTS_AMOUNT = 5000;
  const ROUTES_FLIGHTS_AMOUNT = 10000;

  log.info('Fill database started');

  await insertRandomAirports(dbClient, AIRPORTS_AMOUNT);
  await insertRandomAirlines(dbClient, AIRLINES_AMOUNT);
  await insertRandomSubscriptions(dbClient, SUBSCRIPTIONS_AMOUNT);
  await insertRandomFetches(dbClient, FETCHES_AMOUNT);
  await insertRandomSubscriptionsFetches(dbClient, SUBSCRIPTIONS_FETCHES_AMOUNT);
  //await insertRandomUsers(dbClient, USERS_AMOUNT);
  //await insertRandomUsersSubscriptions(dbClient, USERS_SUBSCRIPTIONS_AMOUNT);
  await insertRandomRoutes(dbClient, ROUTES_AMOUNT);
  await insertRandomFlights(dbClient, FLIGHTS_AMOUNT);
  await insertRandomRoutesFlights(dbClient, ROUTES_FLIGHTS_AMOUNT);
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
