const { defineParsers, jsonParser, yamlParser } = require('./normalize');
const {
  validateRequestFormat,
  validateProtocol,
  validateAPIRequest,
  validateAPIResponse,
} = require('./validate');
const { PeerError, UserError } = require('./error-handling');
const compose = require('koa-compose');
const methods = require('../methods/resolve-method');
const { buildRPCResponse, buildRPCErrorResponse, normalizeRequest } = require('./protocol');
const log = require('./log');

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
  log.debug('Post body is: ', ctx.request.body);
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

module.exports = {
  rpcAPILayer: compose([errorHandling, api]),
};
