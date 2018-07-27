const { Buffer } = require('buffer');
const http = require('http');
const errors = require('./error-handling');

const API_KEY = process.env.DALIPECHE_API_KEY || 'jXb5iIHJYElWAyQK';

errors.assertApp(
  API_KEY,
  'Missing environment variable DALIPECHE_API_KEY',
  errors.errorCodes.missingEnvVar,
);

function buildPostRequestOptions (body) {
  return {
    hostname: '10.20.1.137',
    port: '3001',
    path: '/api/forecast',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
    },
  };
}

async function fetchForecast (bodyParams) {
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
        reject(new errors.PeerError(
          `Couldn't connect to DaliPeche API. ${e}`,
          errors.errorCodes.serviceDown)
        );
      });

      req.write(body);
      req.end();
    });
  }

  return retry(() => fetch(bodyParams));
}

async function retry (fetch, times = 2) {
  for (let tries = 0; tries < times; tries++) {
    try {
      return await fetch();
    } catch (e) {
      if (e.code !== errors.errorCodes.serviceDown) {
        throw e;
      }
    }
  }
}

module.exports = {
  fetchForecast,
};
