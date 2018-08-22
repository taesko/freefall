const { Buffer } = require('buffer');
const http = require('http');
const _ = require('lodash');
const errors = require('./error-handling');
const log = require('./log');

const API_KEY = process.env.DALIPECHE_API_KEY;
const DALIPECHE_ADDRESS = process.env.DALIPECHE_ADDRESS;
const DALIPECHE_PORT = process.env.DALIPECHE_PORT;
const FETCH_STATUS = {
  pending: 'pending', // request was sent but hasn't been handled. status is only temporary
  noResponse: 'no_response', // unknown tax
  badResponse: 'bad_response', // unknown tax
  freeRequest: 'free_request', // tax = 0
  failedRequest: 'failed_request', // tax = 1
  successfulRequest: 'successful_request', // tax = 2
};
const STATUS_CODES = {
  invalidParams: 30,
  noAPIKey: 31,
  invalidAPIKey: 33,
  exceededRateLimit: 35,
  notEnoughCredits: 300,
};

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

function buildPostRequestBody (params) {
  errors.assertApp(_.isObject(params));
  return { key: API_KEY, ...params };
}

async function fetchForecast (dbClient, postBody) {
  errors.assertApp(_.isObject(dbClient), `got ${dbClient}`);
  errors.assertApp(_.isObject(postBody), `got ${postBody}`);

  log.info('Fetching forecast with postBody =', postBody);

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

      req.setTimeout(20 * 1000, () => {
        reject(
          new errors.PeerError(
            `Request to DaliPeche API timed out.`,
            'DALIPECHE_SERVICE_DOWN',
          ),
        );
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

  // TODO handle http client errors
  return retry(() => fetch(postBody));
}

function fetchStatusFromResponse (parsedResponse) {
  if (parsedResponse.statusCode == null) {
    return FETCH_STATUS.successfulRequest;
  }
  const statusCode = +parsedResponse.statusCode;
  const isNotTaxedRequest = (
    statusCode === STATUS_CODES.noAPIKey || // no api key
    statusCode === STATUS_CODES.invalidAPIKey || // invalid api key
    statusCode === STATUS_CODES.notEnoughCredits || // not enough credits
    statusCode === STATUS_CODES.exceededRateLimit
  );

  if (isNotTaxedRequest) {
    return FETCH_STATUS.freeRequest;
  } else {
    return FETCH_STATUS.failedRequest;
  }
}
async function recordFetch (dbClient, status) {
  errors.assertApp(_.isObject(dbClient), `got ${dbClient}`);
  errors.assertApp(typeof status === 'string', `got ${status}`);

  const { rows } = await dbClient.executeQuery(
    `
    INSERT INTO dalipeche_fetches
      (fetch_time, api_key, status)
    VALUES
      (current_timestamp, $1, $2)
    RETURNING *
    `,
    [API_KEY, status],
  );

  errors.assertApp(rows.length === 1);

  log.debug('DALIPECHE FETCH ROWS RESULT = ', rows);
  return rows[0];
}

async function updateFetch (dbClient, fetchID, status) {
  errors.assertApp(_.isObject(dbClient), `got ${dbClient}`);
  errors.assertApp(Number.isSafeInteger(fetchID));
  errors.assertApp(typeof status === 'string', `got ${status}`);

  const { rows } = await dbClient.executeQuery(
    `
    UPDATE dalipeche_fetches
    SET status=$2
    WHERE id=$1
    RETURNING *
    `,
    [fetchID, status],
  );

  errors.assertApp(rows.length === 1);

  return rows[0];
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
  recordFetch,
  updateFetch,
  fetchStatusFromResponse,
  buildPostRequestBody,
  FETCH_STATUS,
  API_KEY,
  STATUS_CODES,
};
