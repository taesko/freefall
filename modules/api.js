const { defineParsers, jsonParser, yamlParser } = require('./normalize');
const {
  validateRequestFormat,
  validateProtocol,
  validateAPIRequest,
  validateAPIResponse,
} = require('./validate');
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
    let format;

    try {
      format = validateRequestFormat({
        headerParam: ctx.headers['content-type'],
        queryParam: ctx.query.format,
      });
    } catch (e) {
      if (e instanceof PeerError) {
        format = 'json';
      } else {
        throw e;
      }
    }
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

  validateProtocol(parsed, protocol, 'request');

  // TODO modularize and pass a format/protocol parameter
  const { method, params, id, jsonrpc: version } = normalizeRequest(parsed);

  validateAPIRequest(method, params);

  log.info(
    'Executing method=', method,
    'with params=', params,
    'Request id', id,
    'version', version,
  );

  const result = await methods.execute({
    methodName: method,
    params: params,
    db: ctx.state.dbClient,
    appCtx: ctx,
  });

  // TODO this is a horrible back
  if (result.status_code >= '2000' && result.status_code <= '3000') {
    ctx.state.api.caughtPeerError = true;
  }

  validateAPIResponse(result, method, `${format}rpc`);

  const responseBody = buildRPCResponse({
    protocol,
    id,
    version,
    resultObject: result,
  });

  validateProtocol(responseBody, protocol, 'response');
  ctx.status = 200;
  ctx.body = multiParser.stringify(responseBody, format);
  ctx.type = 'application/json';

  log.info('Response validated. Setting ctx body.');
  await next();
}

async function daliPecheErrorHandling (ctx, next) {
  try {
    await next();
  } catch (e) {
    const response = {};
    if (e.code === 'DALIPECHE_SERVICE_DOWN') {
      log.info('Dalipeche service is unavailable setting HTTP code 503.');
      ctx.status = 503;
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

  const dbClient = ctx.state.dbClient;
  const forecastResponse = await forecast.fetchForecast(dbClient, bodyParams);
  const forecastParsed = multiParser.parse(forecastResponse, 'json');

  // TODO move this functionality on a separate koa instance and assert API KEY integrity here
  ctx.body = multiParser.stringify(forecastParsed, 'json');
  ctx.state.commitDB = true;
}

module.exports = {
  rpcAPILayer: compose([errorHandling, api]),
  daliPecheAPI: compose([daliPecheErrorHandling, daliPecheAPI]),
};
