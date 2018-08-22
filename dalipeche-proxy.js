const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const Router = require('koa-router');
const _ = require('lodash');

const { assertApp, UserError, PeerError, assertSystem } = require('./modules/error-handling');
const REQUIRED_CONFIG = [
  'DALIPECHE_PROXY_PORT',
  'DALIPECHE_ADDRESS',
  'DALIPECHE_PORT',
  'DALIPECHE_API_KEY',
];
for (const env of REQUIRED_CONFIG) {
  assertSystem(_.has(process.env, env), `Missing environment variable ${env}`);
}

const { daliPecheRequestIsValid, daliPecheResponseIsValid } = require('./modules/validate');
const log = require('./modules/log');
const db = require('./modules/db');
const forecast = require('./modules/forecast');
const { defineParsers, jsonParser } = require('./modules/normalize');

const multiParser = defineParsers(jsonParser);

const app = new Koa();
const router = new Router();

app.use(async (ctx, next) => {
  log.request(ctx);
  await next();
  log.response(ctx);
});
app.use(db.client);
app.use(bodyParser());

router.get('/', async (ctx) => {
  ctx.body = `Welcome to the DaliPeche proxy. Please issue a post request to this route to use the service.`;
});

router.post('/', DaliPecheErrorHandling, validateUserRequests, sendRequestToDaliPeche);

app.use(router.routes());

async function DaliPecheErrorHandling (ctx, next) {
  log.debug('ENTERING DALI PECHE ERROR HANDLING');
  try {
    await next();
  } catch (e) {
    log.error('In DaliPeche error handling layer: ', e);
    const userMsg = 'Freefall servers are experiencing problems, sorry!';
    if (e instanceof PeerError || e instanceof UserError) {
      log.critical('Unhandled Peer or User error in DaliPeche service: ', e);
    }
    ctx.status = 500;
    ctx.body = userMsg;
  }
}

async function validateUserRequests (ctx, next) {
  log.debug('Validating user request.');
  let reqParams;

  try {
    reqParams = multiParser.parse(ctx.request.rawBody, 'json');
  } catch (e) {
    // TODO catch syntax error by code
    ctx.body = JSON.stringify({
      statusCode: forecast.STATUS_CODES.invalidParams,
    });
    ctx.status = 200;
    return;
  }

  const reqBody = forecast.buildPostRequestBody(reqParams);

  if (!daliPecheRequestIsValid(reqBody)) {
    log.info('build invalid reqBody', reqBody, 'from params', reqParams);
    ctx.body = JSON.stringify({
      statusCode: forecast.STATUS_CODES.invalidParams,
    });
    ctx.status = 200;
    return;
  }

  ctx.request.body = reqBody;
  return next();
}

async function sendRequestToDaliPeche (ctx, next) {
  assertApp(_.isObject(ctx.state.dbClient));
  assertApp(_.isObject(ctx.request.body));
  const dbClient = ctx.state.dbClient;

  log.info('Recording pending state for fetch.');
  const { id: fetchID } = await forecast.recordFetch(
    dbClient,
    forecast.FETCH_STATUS.pending
  );
  log.info('Pending fetch id is', fetchID, '. Beginning fetchForecast');

  const { FETCH_STATUS } = forecast;

  // TODO catch timeout
  let rawRes;

  try {
    rawRes = await forecast.fetchForecast(dbClient, ctx.request.body);
  } catch (e) {
    log.warn('Error occurred while fetching forecast:', e);

    if (e.code === 'DALIPECHE_SERVICE_DOWN') {
      ctx.status = 500;
      ctx.body = 'DaliPeche service is down';
      await forecast.updateFetch(dbClient, fetchID, FETCH_STATUS.noResponse);
      return;
    }
    throw e;
  }

  // Made a request to DaliPeche and got back a response
  // Whatever the response is let the client handle it and only update the db accordingly.
  // TODO status codes from DaliPeche
  ctx.status = 200;
  ctx.body = rawRes;

  let parsedRes;

  try {
    parsedRes = JSON.parse(rawRes);
  } catch (e) {
    log.warn('Parsing DaliPeche response failed with ', e);
    await forecast.updateFetch(dbClient, fetchID, FETCH_STATUS.badResponse);
    return next;
  }

  if (!daliPecheResponseIsValid(parsedRes)) {
    log.warn('DaliPeche service returned an invalid response: ', parsedRes);
    await forecast.updateFetch(dbClient, fetchID, FETCH_STATUS.badResponse);
    return next;
  }

  await forecast.updateFetch(
    dbClient,
    fetchID,
    forecast.fetchStatusFromResponse(parsedRes)
  );

  return next();
}

app.listen(process.env.DALIPECHE_PROXY_PORT);
