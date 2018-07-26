const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const ajv = new Ajv();
const { assertApp, assertPeer } = require('./error-handling');
const log = require('./log');

const SCHEMAS_DIR = path.join(__dirname, '..', 'api_schemas');
const FORMATS = {
  'text/json': 'json',
  'application/json': 'json',
  'text/yaml': 'yaml',
};

const REQUESTS_SCHEMAS_DIR = path.join(SCHEMAS_DIR, 'requests');
const RESPONSE_SCHEMAS_DIR = path.join(SCHEMAS_DIR, 'responses');

(function registerSchemas () {
  const schemas = discoverSchemaPaths()
    .map(path => [path, JSON.parse(fs.readFileSync(path))])
    .reduce(
      (hash, entry) => {
        hash[entry[0]] = entry[1];
        return hash;
      },
      {},
    );

  for (const [path, schema] of Object.entries(schemas)) {
    try {
      ajv.addSchema(schema);
      log.info(`Registered schema on path=${path}`);
    } catch (e) {
      log.critical(`Couldn't add schema on path=${path}. Reason: ${e}`);
    }
  }
})();

function discoverSchemaPaths () {
  const requests = fs.readdirSync(REQUESTS_SCHEMAS_DIR)
    .map(fileName => path.join(REQUESTS_SCHEMAS_DIR, fileName));
  const responses = fs.readdirSync(RESPONSE_SCHEMAS_DIR)
    .map(fileName => path.join(RESPONSE_SCHEMAS_DIR, fileName));

  return requests.concat(responses);
}

function getSchemaId (type, name) {
  const hash = {
    'request': `request/${name}`,
    'response': `response/${name}`,
  };
  const id = hash[type];

  assertApp(
    id != null,
    'Invalid parameter type to getSchemaId. Expected one of: [\'request\', \'response\']',
  );

  return id;
}

function validateProtocol (obj, protocol = 'jsonrpc', type = 'request') {
  assertPeer(
    ajv.validate(getSchemaId(type, protocol), obj),
    `Bad protocol. Error: ${ajv.errorsText()}`,
  );
}

function validateRequest (requestBody, protocol = 'jsonrpc') {
  validateProtocol(requestBody, protocol, 'request');

  log.info('Validating request for method', requestBody.method);

  const method = requestBody.method;
  const apiParams = requestBody.params;
  const schemaName = getSchemaId('request', method);

  log.debug('Using schema', schemaName);

  assertPeer(ajv.validate(schemaName, apiParams),
    `Invalid params for method ${method}. Error: ${ajv.errorsText()}`,
  );
}

function validateRequestFormat ({ headerParam, queryParam }) {
  const [contentFormat] = headerParam.split(';'); // ignore charset:utf-8
  const headerFormat = FORMATS[contentFormat];
  const queryFormat = FORMATS[queryParam];
  assertPeer(
    headerFormat || queryFormat,
    `neither of header parameter ${headerParam} and query parameter ${queryParam} are valid format parameters`,
  );
  assertPeer(
    !(
      headerFormat && queryFormat &&
      headerFormat.toLowerCase() === queryFormat.toLowerCase()
    ),
    `header param ${headerParam} and query param ${queryParam} have different values.`,
  );

  return headerFormat || queryFormat;
}

function validateResponse (responseBody, method, protocol = 'jsonrpc') {
  log.info('Validating response for method', method, 'by protocol', protocol);
  validateProtocol(responseBody, protocol, 'response');

  log.debug('Validating body response for method', method, 'body: ', responseBody);
  const schemaName = (responseBody.error == null) ? method : 'error';
  const schemaId = getSchemaId('response', schemaName);
  assertApp(
    ajv.validate(schemaId, responseBody.error || responseBody.result),
    `invalid error response for method ${method}. Error: ${ajv.errorsText()}`,
  );
}

module.exports = {
  validateRequest,
  validateResponse,
  validateRequestFormat,
};
