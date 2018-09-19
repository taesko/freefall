/* eslint-disable prefer-arrow-callback */
const http = require('http');

const _ = require('lodash');

const {
  assertApp,
  assertPeer,
  assertSystem,
  PeerError,
  SystemError,
} = require('../modules/error-handling');
const config = require('../modules/config');
const normalize = require('../modules/normalize');
const log = require('../logs');

const multiParser = normalize.defineParsers(
  normalize.yamlParser,
  normalize.jsonParser,
);

const defaultTimeout = 20 * 1000;
const protocolToFormat = {
  'jsonrpc': 'json',
  'yamlrpc': 'yaml',
};
const jsonRPCVersion = '2.0';
const yamlRPCVersion = '2.0';

const testingUserAPIKey = 'wat';

const idGen = (function * () {
  for (let k = 0; ; k++) {
    yield k;
  }
})();

function buildRPCBody (protocol, method, params) {
  function buildJSONRPCBody (method, params, version = jsonRPCVersion) {
    const object = {
      id: idGen.next(),
      method,
      params,
      jsonrpc: version,
    };

    return multiParser.stringify(object, protocolToFormat[protocol]);
  }
  function buildYAMLRPCBody (method, params, version = yamlRPCVersion) {
    const object = {
      id: idGen.next(),
      action: method,
      parameters: params,
      yamlrpc: version,
    };

    return multiParser.stringify(object, protocolToFormat[protocol]);
  }

  const builders = {
    'jsonrpc': buildJSONRPCBody,
    'yamlrpc': buildYAMLRPCBody,
  };

  return builders[protocol](method, params);
}

function parseRPCBody (protocol, body) {
  function parseJSONRPCBody (body, version = jsonRPCVersion) {
    assertApp(version === jsonRPCVersion);

    return multiParser.parse(body, protocolToFormat[protocol]);
  }
  function parseYAMLRPCBody (body, version = yamlRPCVersion) {
    assertApp(version === yamlRPCVersion);

    const parsed = multiParser.parse(body, protocolToFormat[protocol]);

    if (parsed.error) {
      return {
        id: parsed.id,
        jsonrpc: parsed.yamlrpc,
        error: parsed.error,
      };
    } else {
      return {
        id: parsed.id,
        jsonrpc: parsed.yamlrpc,
        result: parsed.result,
      };
    }
  }

  const parseFunctions = {
    'jsonrpc': parseJSONRPCBody,
    'yamlrpc': parseYAMLRPCBody,
  };

  return parseFunctions[protocol](body);
}

async function makeRPCRequest (
  method,
  params,
  {
    endpoint = config.routes.api,
    protocol = 'jsonrpc',
    timeout = defaultTimeout,
  } = {},
) {
  assertApp(endpoint.startsWith(config.routes.api));

  const body = buildRPCBody(protocol, method, params);
  return new Promise((resolve, reject) => {
    const data = [];
    const req = http.request(
      {
        hostname: config.hostname,
        protocol: config.protocol,
        path: endpoint,
        method: 'POST',
        body: body,
      },
      response => {
        response.setEncoding = 'utf-8';
        response.on('data', chunk => data.push(chunk));
        response.on('end', () => resolve(data.join('')));
      }
    );
    req.setTimeout(timeout, () => {
      const err = new PeerError(
        `Timeout of peer at ${config.hostname}:${config.protocol}`,
        'RPC_REQUEST_TIMEOUT',
      );
      reject(err);
    });
    req.on('error', () => {
      const err = new SystemError(
        `Could not connect to peer at ${config.hostname}:${config.protocol}:`,
        'RPC_REQUEST_ERROR'
      );
      reject(err);
    });
  });
}

const runners = [];

function handleTestError (testFunction, input, error) {
  assertApp(_.isFunction(error));
  assertApp(_.isObject(error));

  log.error(
    '%0 FAILED on input - $1 with error: %2',
    testFunction,
    input,
    error,
  );
}

function defineTestFunction (
  fn,
  inputs = [],
  { repeat = 1 } = {}
) {
  assertApp(_.isFunction());
  assertApp(Array.isArray(inputs));
  assertApp(inputs.every(input => Array.isArray(input)));
  assertApp(Number.isInteger(repeat));

  runners.push(async () => {
    for (let k = 0; k <= repeat; k++) {
      for (const input of inputs) {
        try {
          await fn(...input);
        } catch (e) {
          if (e instanceof PeerError) {
            handleTestError(fn, input, e);
          }
        }
      }
    }
  });

  return fn;
}

async function runTests () {
  for (const func of runners) {
    await func();
  }
}

defineTestFunction(
  async function subscribe () {
    const subscriptions = await makeRPCRequest(
      'list_subscriptions',
      { api_key: testingUserAPIKey },
    );

    assertPeer(subscriptions.result != null);
    assertPeer(subscriptions.result.status_code === '1000');

    const first = subscriptions.body.subscriptions[0];
    const second = subscriptions.body.subscriptions[1];

    const unsubscribeBody = await makeRPCRequest(
      'unsubscribe',
      { api_key: testingUserAPIKey, v: '2.0', user_subscription_id: first.id },
    );

    assertPeer(unsubscribeBody.result != null);
    assertPeer(unsubscribeBody.result.status_code === '1000');

    const newSubscriptionsBody = await makeRPCRequest(
      'list_subscriptions',
      { api_key: testingUserAPIKey },
    );

    assertPeer(newSubscriptionsBody.result != null);
    assertPeer(newSubscriptionsBody.result.status_code === '1000');

    const newFirst = newSubscriptionsBody.result.subscriptions[0];
    assertPeer(newFirst.id === second.id);
  },
);

runTests()
  .then(() => log.info('Finished'))
  .catch(err => log.error('An unexpected error occurred.', err));
