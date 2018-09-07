const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const ajv = new Ajv();
const { assertApp, assertPeer, UserError } = require('./error-handling');
const log = require('./log');

const SCHEMAS_DIR = path.join(__dirname, '..', 'api_schemas');
const FORMATS = {
  'text/json': 'json',
  'application/json': 'json',
  'text/yaml': 'yaml',
};

const REQUESTS_SCHEMAS_DIR = path.join(SCHEMAS_DIR, 'requests');
const RESPONSE_SCHEMAS_DIR = path.join(SCHEMAS_DIR, 'responses');
const USER_ERROR_KEYWORDS = [
  'format',
  'minimum',
  'maximum',
  'multipleOf',
  'multipleOf',
  'pattern',
  'enum',
  'const',
];

(function registerSchemas () { // TODO check if read file is .json
  const schemas = discoverSchemaPaths() // TODO log what schema is being parsed
    .map(path => {
      log.info('Parsing schema on path', path);
      return [path, JSON.parse(fs.readFileSync(path))];
    })
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

function validateProtocol (obj, protocol = 'jsonrpc', type = 'request') {
  const assert = (type === 'request') ? assertPeer : assertApp;

  assert(
    ajv.validate(getSchemaId(type, protocol), obj),
    `Bad protocol. Error: ${ajv.errorsText()}`,
  );
}

function validateAPIRequest (method, params) {
  log.info('Validating request for method', method);

  const schemaName = getSchemaId('request', method);

  log.debug('Using schema', schemaName);

  const isValid = ajv.validate(schemaName, params);

  if (isValid) {
    return;
  }

  const isUserError = ajv.errors.some(
    error => USER_ERROR_KEYWORDS.includes(error.keyword)
  );

  log.debug('AJV errors are: ', ajv.errors);
  assertPeer(isUserError, `Invalid params for method ${method}. Error: ${ajv.errorsText()}`);

  throw new UserError(`Invalid data for method ${method}. Error: ${ajv.errorsText()}`);
}

function validateAPIResponse (apiResult, method) {
  log.info('Validating response for method', method);

  const schemaId = getSchemaId('response', method);

  assertApp(
    ajv.validate(schemaId, apiResult),
    `invalid error response for method ${method}. Error: ${ajv.errorsText()}. Response: ${JSON.stringify(
      apiResult)}`,
  );
}

function daliPecheRequestIsValid (requestBody) {
  const valid = ajv.validate('request/dalipeche', requestBody);

  if (!valid) {
    log.info(`Invalid client request. ${ajv.errorsText()}`);
  }

  return valid;
}

function daliPecheResponseIsValid (responseBody) {
  const valid = ajv.validate('response/dalipeche', responseBody);
  if (!valid) {
    log.info(`Invalid DaliPeche response. ${ajv.errorsText()}`);
  }
  return valid;
}

module.exports = {
  validateProtocol,
  validateAPIRequest,
  validateAPIResponse,
  validateRequestFormat,
  daliPecheRequestIsValid,
  daliPecheResponseIsValid,
};
