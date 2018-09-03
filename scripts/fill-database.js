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

  log.info(`Inserting random airlines... Amount: ${amount}`);

  const { rows: existingAirlines } = await dbClient.executeQuery(`

    SELECT
      name,
      code
    FROM airlines;

  `);

  const existingCodes = existingAirlines.map(airline => airline.code);
  const existingNames = existingAirlines.map(airline => airline.name);

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

    while (queryParamsCounter + 3 < MAX_QUERY_PARAMS && rowsInserted < amount) {
      insertQueryParameters += `($${queryParamsCounter + 1}, $${queryParamsCounter + 2}, $${queryParamsCounter + 3})`;

      if (queryParamsCounter + 6 < MAX_QUERY_PARAMS && rowsInserted + 1 < amount) {
        insertQueryParameters += ',';
      }

      queryParamsCounter += 3;
      rowsInserted++;
    }

    const insertQueryValues = [];

    for (let insertedQueryValues = 0; insertedQueryValues < queryParamsCounter; insertedQueryValues += 3) {
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

async function fillDatabase (dbClient) {
  const AIRPORTS_AMOUNT = 10000;
  const AIRLINES_AMOUNT = 100000;

  log.info('Fill database started');

  await insertRandomAirports(dbClient, AIRPORTS_AMOUNT);
  await insertRandomAirlines(dbClient, AIRLINES_AMOUNT);

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
