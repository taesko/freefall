const { defineParsers, jsonParser, yamlParser } = require('./normalize');
const { validateRequest, validateRequestFormat, validateResponse } = require('./validate');
const { PeerError, UserError, assertPeer } = require('./error-handling');
const compose = require('koa-compose');
const methods = require('../methods/resolve-method');
const { buildRPCResponse, buildRPCErrorResponse, normalizeRequest } = require('./protocol');
const log = require('./log');
const forecast = require('./forecast');

const multiParser = defineParsers(jsonParser, yamlParser);

async function errorHandling (ctx, next) {
  ctx.state.api = {};
  try {
    await next();
  } catch (err) {
    log.critical(err);
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
    log.critical('error occurred and ctx.body was set to:', ctx.body);
  }
}

async function api (ctx, next) {
  const format = validateRequestFormat({
    headerParam: ctx.headers['content-type'],
    queryParam: ctx.query.format,
  });
  log.info('Getting post request to api. Format specified by peer is: ', format);
  const protocol = `${format}rpc`;
  // koa body has already parsed the json
  const parsed = format === 'json' ? ctx.request.body : multiParser.parse(ctx.request.body, format);
  ctx.state.api.requestId = parsed.id;

  validateRequest(parsed, protocol);

  // TODO modularize and pass a format/protocol parameter
  const requestBody = normalizeRequest(parsed);

  log.info('Executing method', requestBody.method);
  log.debug('With params: ', requestBody.params);

  const result = await methods.execute({
    methodName: requestBody.method,
    params: requestBody.params,
    db: ctx.db,
    appCtx: ctx,
  });

  const responseBody = buildRPCResponse({
    protocol,
    id: requestBody.id,
    version: requestBody.jsonrpc,
    resultObject: result,
  });

  // TODO move inside validate
  try {
    validateResponse(responseBody, parsed.method, `${format}rpc`);
  } catch (e) {
    log.critical('Build an invalid response: ', responseBody);
    throw e;
  }
  ctx.status = 200;
  ctx.body = multiParser.stringify(responseBody, format);

  log.info('Response validated. Setting ctx body.');
  log.debug('Set ctx.body to', ctx.body);
  await next();
}

async function daliPecheErrorHandling (ctx, next) {
  try {
    await next();
  } catch (e) {
    const response = {};
    if (e instanceof PeerError) {
      response.msg = "Couldn't connect to DaliPeche service. Because the service did not reply.";
      response.code = e.code;
    } else {
      throw e;
    }

    ctx.body = response;
  }
}

async function daliPecheAPI (ctx) {
  const { key, city, iataCode } = ctx.request.body;
  assertPeer(city ^ iataCode, 'Need to specify only one of city or iataCode params.');

  const bodyParams = { key };

  if (city) {
    assertPeer(typeof city === 'string', 'city param must be a string.');
    bodyParams.city = city;
  } else {
    assertPeer(typeof iataCode === 'string', 'iataCode param must be a string.');
    bodyParams.iataCode = iataCode;
  }

  ctx.body = await forecast.fetchForecast(bodyParams);
}

module.exports = {
  rpcAPILayer: compose([errorHandling, api]),
  daliPecheAPI: compose([daliPecheErrorHandling, daliPecheAPI]),
};
