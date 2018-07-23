const { defineParsers, jsonParser, yamlParser } = require('./normalize');
const { validateRequest, validateRequestFormat, validateResponse } = require('./validate');
const { PeerError, UserError } = require('./error-handling');
const compose = require('koa-compose');
const {
  defineMethods,
  search,
  subscribe,
  unsubscribe,
  listAirports,
  getAPIKey,
  listSubscriptions,
  listUsers,
  sendError,
} = require('../methods/resolve-method');
const { buildRPCResponse, buildRPCErrorResponse, normalizeRequest } = require('./protocol');
const { log } = require('./utils');

const multiParser = defineParsers(jsonParser, yamlParser);
const execute = defineMethods(
  search,
  subscribe,
  unsubscribe,
  listAirports,
  getAPIKey,
  listSubscriptions,
  listUsers,
  sendError,
);

async function errorHandling (ctx, next) {
  ctx.state.api = {};
  try {
    await next();
  } catch (err) {
    log(err);
    // assertPeer(0, `The password: ${ pass } is not valid`)

    ctx.status = 200;

    const format = validateRequestFormat({
      headerParam: ctx.headers['content-type'],
      queryParam: ctx.query.format,
    });
    const protocol = `${format}rpc`;
    const version = '1.0';
    const id = ctx.state.api.requestId || 1; // TODO ignore for now
    let code;
    let message;

    if (err instanceof PeerError) {
      code = -32600;
      message = err.message;
    } else if (err instanceof UserError) {
      code = 5000;
      message = err.message;
    } else {
      code = 5000;
      message = 'App error';
    }

    const response = buildRPCErrorResponse({
      protocol,
      version,
      id,
      code,
      message,
      errorObject: {}, // TODO think about what to put inside here
    });

    ctx.body = multiParser.stringify(response, format);
    log('error occurred and ctx.body was set to:', ctx.body);
  }
}

async function api (ctx, next) {
  log('Getting post request: ', ctx.request);
  const format = validateRequestFormat({
    headerParam: ctx.headers['content-type'],
    queryParam: ctx.query.format,
  });
  log('Format specified by peer is: ', format);
  const protocol = `${format}rpc`;
  const parsed = format === 'json' ? ctx.request.body : multiParser.parse(ctx.request.body, format);
  ctx.state.api.requestId = parsed.id;

  validateRequest(parsed, protocol);

  // TODO modularize and pass a format/protocol parameter
  const requestBody = normalizeRequest(parsed);

  log('Executing method', requestBody.method, 'with params', requestBody.params);

  const result = await execute({
    methodName: requestBody.method,
    params: requestBody.params,
    db: ctx.db,
    appCtx: ctx,
  });

  log('Executed method', requestBody.method, 'with params', requestBody.params);

  const responseBody = buildRPCResponse({
    protocol,
    id: requestBody.id,
    version: requestBody.jsonrpc,
    resultObject: result,
  });

  validateResponse(responseBody, parsed.method, `${format}rpc`);
  ctx.status = 200;
  ctx.body = multiParser.stringify(responseBody, format);

  log('Response validated. Setting ctx body.');
  await next();
}

module.exports = {
  rpcAPILayer: compose([errorHandling, api]),
};
