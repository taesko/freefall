const {assertApp, assertPeer, AppError} = require('./error-handling');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const ajv = new Ajv();

const PROTOCOLS = ['jsonrpc'];
const METHODS = ['search', 'subscribe', 'unsubscribe'];
const SCHEMA_NAMES = [...PROTOCOLS, ...METHODS];
const SCHEMAS_DIR = path.join(__dirname, '..', 'api_schemas');

const FORMATS = {
  'text/json': 'json',
  'application/json': 'json',
  'text/yaml': 'yaml',
};

function getAPIRequestSchema (name) {
  const schemaPath = path.join(SCHEMAS_DIR, `${name}.json`);

  console.log('schema path: ', schemaPath);

  assertApp(
    fs.existsSync(schemaPath),
    'Missing schema', name
  );

  return fs.readFileSync(schemaPath);
}

for (const schemaName of SCHEMA_NAMES) {
  try {
    ajv.addSchema(getAPIRequestSchema(schemaName), schemaName);
  } catch (e) {
    throw new AppError(`Cannot add ${schemaName} schema to ajv. Reason: ${e}`);
  }
}

function validateRequest (responseBody, protocol = 'jsonrpc') {
  assertApp(PROTOCOLS.indexOf(protocol) !== -1, `Cannot validate protocol - ${protocol}`);
  assertPeer(ajv.validate(protocol, responseBody));

  const bodySchemaName = responseBody.method;
  const bodyParams = responseBody.params;

  assertPeer(METHODS.indexOf(bodySchemaName) !== -1, `Method not supported - ${bodySchemaName}`);
  assertPeer(ajv.validate(bodySchemaName, bodyParams),
    `Invalid params for method ${bodySchemaName}`
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
module.exports = {
  validateRequest,
  validateRequestFormat,
};
