/* eslint-disable prefer-arrow-callback,camelcase */
const http = require('http');

const _ = require('lodash');
const moment = require('moment');

const {
  assertApp,
  assertPeer,
  PeerError,
  SystemError,
} = require('../modules/error-handling');
const config = require('../modules/config');
const normalize = require('../modules/normalize');
const log = require('../modules/log');

const multiParser = normalize.defineParsers(
  normalize.yamlParser,
  normalize.jsonParser,
);

const testConfig = {
  date_format: 'YYYY-MM-DD',
  stopOnFail: true,
  api_protocol: 'jsonrpc',
};

const defaultTimeout = 5 * 1000;
const protocolToFormat = {
  'jsonrpc': 'json',
  'yamlrpc': 'yaml',
};
const jsonRPCVersion = '2.0';
const yamlRPCVersion = '2.0';
const testingUserAPIKey = '99acea95da5d772dc6dcdbc82bbc31e8';

const idGen = (function * () {
  for (let k = 1; ; k++) {
    yield k;
  }
})();

function buildRPCBody (protocol, method, params) {
  function buildJSONRPCBody (method, params, version = jsonRPCVersion) {
    const object = {
      id: idGen.next().value,
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
    protocol = testConfig.api_protocol,
    timeout = defaultTimeout,
  } = {},
) {
  assertApp(endpoint.startsWith(config.routes.api));

  const body = buildRPCBody(protocol, method, params);
  const options = {
    hostname: '10.20.1.128',
    port: '3000',
    path: endpoint,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
    },
  };

  log.info(`Making an RPC request to ${options.hostname}:${options.port}`);

  return new Promise((resolve, reject) => {
    const data = [];
    const req = http.request(
      options,
      response => {
        response.setEncoding = 'utf-8';
        response.on('data', chunk => data.push(chunk));
        response.on('end', () => resolve(
          parseRPCBody(protocol, data.join(''))
        ));
      },
    );
    req.setTimeout(timeout, () => {
      const err = new PeerError(
        `Timeout of peer at ${options.hostname}:${options.port}`,
        'RPC_REQUEST_TIMEOUT',
      );
      reject(err);
    });
    req.on('error', () => {
      const err = new SystemError(
        `Could not connect to peer at ${options.hostname}:${options.port}:`,
        'RPC_REQUEST_ERROR',
      );
      reject(err);
    });

    req.write(body);
    req.end();
  });
}

const runners = [];

function handleTestError (testFunction, input, error) {
  assertApp(_.isFunction(testFunction));
  assertApp(_.isObject(error));

  log.error(
    `${testFunction.name} FAILED on input -`,
    input,
    'with error',
    error,
  );
}

function assertEqual (a, b) {
  assertPeer(
    _.isEqual(a, b),
    `${JSON.stringify(a)} is not equal to ${JSON.stringify(b)}`
  );
}

function defineTestFunction (
  fn,
  {
    repeat = 1,
    inputs = [[]],
  } = {},
) {
  assertApp(_.isFunction(fn));
  assertApp(Array.isArray(inputs));
  assertApp(inputs.every(input => Array.isArray(input)));
  assertApp(Number.isInteger(repeat));

  runners.push(async () => {
    log.info(`Testing ${fn.name}: `);
    for (let k = 0; k < repeat; k++) {
      if (k > 0) {
        log.info(`Repeating tests. ${k + 1}/${repeat}`);
      }
      for (const input of inputs) {
        try {
          await fn(...input);
          log.info(`\t ${fn.name} PASSED`);
        } catch (e) {
          if (e instanceof PeerError) {
            handleTestError(fn, input, e);
          } else {
            throw e;
          }
          if (testConfig.stopOnFail) {
            throw e;
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

function responseBodyIsOK (method, responseBody) {
  const validators = {
    list_subscriptions: body => {
      return body.error == null;
    },
    subscribe: body => {
      return body.error == null && body.result.status_code === '1000';
    },
    unsubscribe: body => {
      return body.error == null && body.result.status_code === '1000';
    },
    credit_history: body => {
      return body.error == null && body.result.status_code === '1000';
    },
  };

  assertApp(Object.keys(validators).includes(method));

  return validators[method](responseBody);
}

async function popSubscription () {
  const listSubscrBody = await makeRPCRequest(
    'list_subscriptions',
    { api_key: testingUserAPIKey, v: '2.0' },
  );

  assertPeer(responseBodyIsOK('list_subscriptions', listSubscrBody));

  const { result: listSubscrResult } = listSubscrBody;
  const { subscriptions } = listSubscrResult;

  if (subscriptions.length === 0) {
    return null;
  }

  const first = subscriptions[0];
  const unsubscribeBody = await makeRPCRequest(
    'unsubscribe',
    { api_key: testingUserAPIKey, v: '2.0', user_subscription_id: first.id },
  );

  assertPeer(responseBodyIsOK('unsubscribe', unsubscribeBody));

  const newSubscriptionsBody = await makeRPCRequest(
    'list_subscriptions',
    { api_key: testingUserAPIKey, v: '2.0' },
  );

  assertPeer(responseBodyIsOK('list_subscriptions', newSubscriptionsBody));

  const { result: newSubscrResult } = newSubscriptionsBody;
  const { subscriptions: newSubscriptions } = newSubscrResult;
  const newFirst = newSubscriptions[0];

  assertPeer(newSubscriptions.length === 0 || newFirst.id !== first.id);

  return first;
}

async function makeSubscribeRequest (
  params,
  {
    strict = false,
  } = {},
) {
  assertApp(_.isObject(params));
  assertApp(typeof strict === 'boolean');

  const todayString = moment().format(testConfig.date_format);

  if (!strict) {
    if (params.date_from < todayString) {
      params.date_from = todayString;
    }
    if (params.date_to < todayString) {
      params.date_to = todayString;
    }
  }

  return makeRPCRequest(
    'subscribe',
    params,
  );
}

async function makeListSubscriptionsRequest (
  params,
  {
    mustBeSuccessful = false,
  } = {}
) {
  assertApp(_.isObject(params));

  params.v = params.v || '2.0';

  const responseBody = await makeRPCRequest(
    'list_subscriptions',
    params,
  );

  if (mustBeSuccessful) {
    assertPeer(responseBodyIsOK('list_subscriptions', responseBody));
  }

  return responseBody;
}

defineTestFunction(
  async function testSubscriptionReactivation () {
    const popped = await popSubscription() ||
      {
        fly_from: '2',
        fly_to: '3',
        date_from: moment().add('1', 'day').format(testConfig.date_format),
        date_to: moment().add('1', 'month').format(testConfig.date_format),
        plan: 'daily',
      };
    const subscribeResponse = await makeSubscribeRequest(
      {
        api_key: testingUserAPIKey,
        v: '2.0',
        fly_from: popped.fly_from,
        fly_to: popped.fly_to,
        date_from: popped.date_from,
        date_to: popped.date_to,
        plan: popped.plan,
      },
    );

    assertPeer(responseBodyIsOK('subscribe', subscribeResponse));

    const lsResponse = await makeListSubscriptionsRequest(
      { api_key: testingUserAPIKey },
      { mustBeSuccessful: true },
    );
    const { subscriptions } = lsResponse.result;
    const expectedSubscrID = subscribeResponse.result.subscription_id;

    assertPeer(
      subscriptions.length > 0,
      'expected subscribe request to have altered state but it did not.'
    );
    assertPeer(
      subscriptions[0].id === expectedSubscrID,
      `expected latest subscription to be ${expectedSubscrID}`
    );
  },
  { repeat: 2 },
);

defineTestFunction(
  async function testConcurrentSubscribeReactivation () {
    const concurrency = 5;
    const popped = await popSubscription();

    const send = () => {
      return makeRPCRequest(
        'subscribe',
        {
          api_key: testingUserAPIKey,
          v: '2.0',
          fly_from: popped.fly_from,
          fly_to: popped.fly_to,
          date_from: popped.date_from,
          date_to: popped.date_to,
          plan: popped.plan,
        },
      );
    };
    const responses = await Promise.all(
      Array(concurrency).fill(null).map(send),
    );
    const subscriptions = await makeListSubscriptionsRequest(
      { api_key: testingUserAPIKey },
      { mustBeSuccessful: true },
    ).then(response => {
      assertPeer(responseBodyIsOK('list_subscriptions', response));

      return response.result.subscriptions;
    });
    const { successful, unsuccessful } = responses.reduce(
      (hash, response) => {
        if (responseBodyIsOK('subscribe', response)) {
          hash.successful.push(response);
        } else {
          hash.unsuccessful.push(response);
        }
        return hash;
      },
      { successful: [], unsuccessful: [] }
    );

    assertPeer(successful.length > 0);
    assertPeer(subscriptions.length > 0);

    successful.every(subscr => {
      assertEqual(subscr.result.subscription_id, subscriptions[0].id);
    });
    subscriptions.slice(1).every(subscr => {
      assertEqual(subscr.id === successful[0].result.subscription_id);
    });
  },
);

defineTestFunction(
  async function testTaxing () {
    function * randomSubscribeParamsGenerator (flyFrom = '2', flyTo = '3') {
      const randomDays = `${Math.floor(Math.random() * 30)}`;
      const dateFrom = moment().add(randomDays, 'days');

      while (true) {
        dateFrom.add('1', 'day');

        yield {
          api_key: testingUserAPIKey,
          v: '2.0',
          fly_from: flyFrom,
          fly_to: flyTo,
          date_from: dateFrom.format(testConfig.date_format),
          date_to: moment(dateFrom).add('1', 'month').format(testConfig.date_format),
          plan: 'daily',
        };
      }
    }

    const chParams = {
      api_key: testingUserAPIKey,
      v: '2.0',
    };
    const creditHistoryBody = await makeRPCRequest('credit_history', chParams);
    const lastTax = await makeRPCRequest('credit_history', chParams)
      .then(body => {
        assertPeer(responseBodyIsOK('credit_history', body));

        return body.result.credit_history[0];
      });
    let subscribeBody;
    let tryCount = -1;
    const maxTries = 5;

    for (const params of randomSubscribeParamsGenerator()) {
      tryCount++;

      assertApp(tryCount < maxTries);

      subscribeBody = await makeSubscribeRequest(params);

      if (responseBodyIsOK('subscribe', subscribeBody)) {
        break;
      }
    }

    const { subscriptions } = subscribeBody.result;
    const newLastTax = await makeRPCRequest('credit_history', chParams)
      .then(body => {
        assertPeer(responseBodyIsOK('credit_history', chParams));

        const last = body.result.credit_history[0];

        assertPeer(last != null);

        return last;
      });

    assertPeer(newLastTax.id === subscriptions.id);
    assertPeer(newLastTax.id !== lastTax.id);
    assertPeer(newLastTax.reason === 'initial tax');
  },
);

defineTestFunction(
  async function testSearch () {
    const params = {
      fly_from: '2',
      fly_to: '3',
    };

    const responseBody = await makeRPCRequest('search', params);

    assertPeer(responseBodyIsOK('search', responseBody));

    const { routes } = responseBody.result;

    for (const route of routes) {
      let first = route[0];
      let last = route.slice(-1)[0];

      if (route.length === 0) {
        return;
      } else if (route.length === 1) {
        first = first || last;
        last = first;
      }

      assertPeer(first.airport_from === params.fly_from);
      assertPeer(last.airport_to === params.airport_to);

      for (let k = 1; k < route.length - 2; k++) {
        const current = route[k];
        const next = route[k + 1];

        assertPeer(current.airport_to === next.airport_from);
        assertPeer(current.dtime <= current.atime);
        assertPeer(current.atime <= next.atime);
      }
    }
  }
);

runTests()
  .then(() => log.info('Finished'))
  .catch(err => log.error('An unexpected error occurred.', err));
