const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const ajv = new Ajv();
const {assertApp, assertPeer, AppError} = require('./error-handling');
const {log} = require('./utils');

const PROTOCOLS = ['jsonrpc'];
const METHODS = ['search', 'subscribe', 'unsubscribe'];
const SCHEMAS_DIR = path.join(__dirname, '..', 'api_schemas');

const FORMATS = {
  'text/json': 'json',
  'application/json': 'json',
  'text/yaml': 'yaml',
};

function getApiSchema (method, type = 'request') {
  const typeDirs = {
    'request': 'requests',
    'response': 'responses',
  };
  const schemaPath = path.join(SCHEMAS_DIR, typeDirs[type], `${method}.json`);

  assertApp(
    fs.existsSync(schemaPath),
    `Missing schema ${method}`
  );

  return fs.readFileSync(schemaPath);
}

function getFullSchemaName (method, type) {
  type = type.toLowerCase();
  assertApp(
    METHODS.indexOf(method) !== -1 ||
    PROTOCOLS.indexOf(method) !== -1 ||
    method === 'error',
    `there is no such method ${method}`
  );
  assertApp(type === 'request' || type === 'response',
    `invalid type=${type} parameter - must be one of ['request', 'response']`);

  return `${type}/${method}`;
}

(function registerSchemas () {
  const schemas = {};

  for (const type of ['request', 'response']) {
    for (const shortName of METHODS.concat(PROTOCOLS)) {
      const name = getFullSchemaName(shortName, type);
      schemas[name] = getApiSchema(shortName, type);
    }
  }

  const err = getFullSchemaName('error', 'response');
  schemas[err] = getApiSchema('error', 'response');

  for (const [name, schema] of Object.entries(schemas)) {
    try {
      ajv.addSchema(schema, name);
      log(`Registered schema ${name}`);
    } catch (e) {
      throw new AppError(`Cannot add ${name} schema to ajv. Reason: ${e}`);
    }
  }
})();

function validateProtocol (obj, protocol = 'jsonrpc', type = 'request') {
  assertApp(PROTOCOLS.indexOf(protocol) !== -1,
    `Cannot validate protocol - ${protocol} is unknown`);

  if (type === 'request') {
    assertPeer(ajv.validate(`request/${protocol}`, obj));
  } else if (type === 'response') {
    assertApp(ajv.validate(`response/${protocol}`, obj));
  } else {
    assertApp(false, `Invalid parameter type=${type}`);
  }
}

function validateRequest (requestBody, protocol = 'jsonrpc') {
  validateProtocol(requestBody, protocol, 'request');

  const method = requestBody.method;
  const apiResultSchema = getApiSchema(method, 'request');
  const apiResult = requestBody.params;

  assertPeer(METHODS.indexOf(method) !== -1, `Method not supported - ${method}`);
  assertPeer(ajv.validate(apiResultSchema, apiResult),
    `Invalid params for method ${method}`
  );
}

function validateRequestFormat ({headerParam, queryParam}) {
  const headerFormat = FORMATS[headerParam];
  const queryFormat = FORMATS[queryParam];
  assertPeer(
    headerFormat || queryFormat,
    `neither of header parameter ${headerParam} and query parameter ${queryParam} are valid format parameters`
  );
  assertPeer(
    !(
      headerFormat && queryFormat &&
      headerFormat.toLowerCase() === queryFormat.toLowerCase()
    ),
    `header param ${headerParam} and query param ${queryParam} have different values.`
  );

  return headerFormat || queryFormat;
}

function validateResponse(responseBody, protocol = 'jsonrpc') {
  assertApp(PROTOCOLS.indexOf(protocol) !== -1, `Cannot validate protocol - ${protocol}`);
  const protocolSchema = getApiSchema(getFullSchemaName(protocol, 'response'));
  assertPeer(ajv.validate(protocolSchema, responseBody));

  const bodySchemaName = getApiSchema(getFullSchemaName(responseBody.method, 'response'));
  const bodyParams = responseBody.params;

  assertPeer(METHODS.indexOf(bodySchemaName) !== -1, `Method not supported - ${bodySchemaName}`);
  assertPeer(ajv.validate(bodySchemaName, bodyParams),
    `Invalid params for method ${bodySchemaName}`
  );
}
module.exports = {
  validateRequest,
  validateRequestFormat,
};
