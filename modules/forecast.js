const { Buffer } = require('buffer');
const http = require('http');
const _ = require('lodash');
const errors = require('./error-handling');
const log = require('./log');
const { defineParsers, jsonParser, yamlParser } = require('./normalize');

const multiParser = defineParsers(jsonParser, yamlParser);
const API_KEY = process.env.DALIPECHE_API_KEY;
const DALIPECHE_ADDRESS = process.env.DALIPECHE_ADDRESS;
const DALIPECHE_PORT = process.env.DALIPECHE_PORT;
errors.assertApp(
  DALIPECHE_ADDRESS && DALIPECHE_PORT,
  'DALIPECHE_ADDRESS and/or DALIPECHE_PORT env variables are not set.',
);

errors.assertApp(
  API_KEY,
  'Missing environment variable DALIPECHE_API_KEY',
  errors.errorCodes.missingEnvVar,
);

function buildPostRequestOptions (body) {
  errors.assertApp(typeof body === 'string', `got ${body}`);

  return {
    hostname: DALIPECHE_ADDRESS,
    port: DALIPECHE_PORT,
    path: '/api/forecast',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
    },
  };
}

async function fetchForecast (dbClient, bodyParams) {
  errors.assertApp(_.isObject(dbClient), `got ${dbClient}`);
  errors.assertApp(_.isObject(bodyParams), `got ${bodyParams}`);

  log.info('Fetching forecast with bodyParams =', bodyParams);

  bodyParams.key = API_KEY;

  async function fetch (bodyParams) {
    const body = JSON.stringify(bodyParams);
    const options = buildPostRequestOptions(body);

    return new Promise((resolve, reject) => {
      const data = [];
      const req = http.request(options, response => {
        response.setEncoding('utf-8');
        response.on('data', chunk => {
          data.push(chunk);
        });

        response.on('end', () => {
          resolve(data.join(''));
        });
      });

      req.on('error', e => {
        reject(
          new errors.PeerError(
            `Couldn't connect to DaliPeche API. ${e}`,
            'DALIPECHE_SERVICE_DOWN',
          ),
        );
      });

      req.write(body);
      req.end();
    });
  }

  const response = await retry(() => fetch(bodyParams));
  let forecast;

  try {
    forecast = multiParser.parse(response, 'json');
  } catch (e) {
    log.critical(
      'Send a request to DaliPeche but service returned a bad response.',
      'Params:', bodyParams,
      'response: ', response,
    );

    await insertFetch(dbClient, 'bad_response');

    return response;
  }

  if (forecast.statusCode != null) {
    const statusCode = +forecast.statusCode;
    if (!Number.isInteger(statusCode)) {
      log.critical(
        'Send a request to DaliPeche but service returned a bad response.',
        'Params:', bodyParams,
        'response: ', response,
      );
      await insertFetch(dbClient, 'bad_response');

      return response;
    }

    if (
      forecast.statusCode === 31 || // no api key
      forecast.statusCode === 33 || // invalid api key
      forecast.statusCode === 300 // not enough credits
    ) {
      log.critical(
        'Send a bad request to DaliPeche: ',
        'params:', bodyParams,
        'response:', response,
      );
      await insertFetch(dbClient, 'bad_request');

      return response;
    }
    log.info(
      'Send a request to DaliPeche but it failed: ',
      'params', bodyParams,
      'response', response,
    );
    await insertFetch(dbClient, 'failed_request');

    return response;
  }

  await insertFetch(dbClient, 'successful_request');

  return response;
}

async function insertFetch (dbClient, reason) {
  errors.assertApp(_.isObject(dbClient), `got ${dbClient}`);
  errors.assertApp(typeof reason === 'string', `got ${reason}`);

  return dbClient.executeQuery(
    `
        INSERT INTO dalipeche_fetches
          (fetch_time, api_key, tax_reason)
        VALUES
          (current_timestamp, $1, $2)
      `,
    [API_KEY, reason],
  );
}

async function retry (fetch, times = 2) {
  let error;

  for (let tries = 0; tries < times; tries++) {
    try {
      return await fetch();
    } catch (e) {
      log.info('DaliPeche fetch failed. Retrying.');
      error = e;
      if (e.code !== 'DALIPECHE_SERVICE_DOWN') {
        throw e;
      }
    }
  }

  throw error;
}

module.exports = {
  fetchForecast,
  API_KEY,
};
