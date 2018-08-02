const { defineParsers, jsonParser, yamlParser } = require('./normalize');
const { validateRequest, validateRequestFormat, validateResponse } = require('./validate');
const { PeerError, UserError, assertPeer, assertApp } = require('./error-handling');
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
    if (
      ctx.state.api.caughtPeerError != null &&
      ctx.state.api.caughtPeerError === true
    ) {
      log.info('API method finished successfully but with a PeerError. Setting state.commitDB');
      ctx.state.commitDB = false;
    } else {
      ctx.state.commitDB = true;
    }
  } catch (err) {
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
    log.critical('Unhandled error occurred in the API layer and ctx.body was set to:', ctx.body);
    log.critical(err);
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
    db: ctx.state.dbClient,
    appCtx: ctx,
  });

  // TODO this is a horrible back
  if (result.status_code >= '2000' && result.status_code <= '3000') {
    ctx.state.api.caughtPeerError = true;
  }

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
  ctx.type = 'application/json';

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
      // TODO fix error handling to sent an HTTP status code.
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
  assertPeer(
    (city == null && typeof iataCode === 'string') ||
    (typeof city === 'string' && iataCode == null),
    'Need to specify only one of city or iataCode params.'
  );

  const bodyParams = { key };

  if (city) {
    assertPeer(typeof city === 'string', 'city param must be a string.');
    bodyParams.city = city;
  } else {
    assertPeer(typeof iataCode === 'string', 'iataCode param must be a string.');
    bodyParams.iataCode = iataCode;
  }

  const forecastResponse = await forecast.fetchForecast(bodyParams);
  const forecastParsed = multiParser.parse(forecastResponse, 'json');

  assertApp(
    forecastParsed.statusCode !== 33,
    `API key - ${forecast.API_KEY} for DaliPeche service is invalid.`
  );

  ctx.body = multiParser.stringify(forecastParsed, 'json');
}

module.exports = {
  rpcAPILayer: compose([errorHandling, api]),
  daliPecheAPI: compose([daliPecheErrorHandling, daliPecheAPI]),
};
