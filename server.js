const path = require('path');
const Koa = require('koa');
const Router = require('koa-router');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const serve = require('koa-static');
const views = require('koa-views');
const cors = require('@koa/cors');
const {
  defineMethods,
  search,
  subscribe,
  unsubscribe,
  sendError,
} = require('./methods/resolve-method');
const { defineParsers, jsonParser, yamlParser } = require('./modules/normalize');
const { buildRPCResponse, buildRPCErrorResponse, normalizeRequest } = require('./modules/protocol');
const { PeerError, UserError } = require('./modules/error-handling');
const db = require('./modules/db');
const { log } = require('./modules/utils');
const { validateRequest, validateRequestFormat, validateResponse } = require('./modules/validate');

const multiParser = defineParsers(jsonParser, yamlParser);
const execute = defineMethods(
  search, subscribe, unsubscribe, sendError,
);

const app = new Koa();
const router = new Router();

app.on('error', (err, ctx) => {
  log(err);
  log('context of app is: ', ctx);
});

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    // TODO don't try to report through jsonrpc if it wasn't an API call that raised the error.
    log(err);
    // assertPeer(0, `The password: ${ pass } is not valid`)

    ctx.status = 200;

    const format = validateRequestFormat({
      headerParam: ctx.headers['content-type'],
      queryParam: ctx.query.format,
    });
    const protocol = `${format}rpc`;
    const version = '1.0';
    const id = 1; // TODO ignore for now
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
});

db.dbConnect();
app.context.db = db;

app.use(logger());
app.use(cors({
  origin: '*',
}));
app.use(bodyParser({ // TODO crashes on bad json, best avoid the inner parser
  extendTypes: {
    text: ['text/yaml'],
  },
  enableTypes: ['json', 'form', 'text'],
}));
app.use(serve(path.join(__dirname, 'public')));
app.use(views(path.join(__dirname, 'templates/'), {
  map: {
    html: 'mustache',
  },
}));

router.get('/', async (ctx, next) => {
  const airports = await db.select('airports', ['id', 'iata_code', 'name']);
  await ctx.render('index.html', {
    airports,
  });
  await next();
});

router.get('/subscribe', async (ctx, next) => {
  const airports = db.select('airports', ['id', 'iata_code', 'name']);
  await ctx.render('subscribe.html', {
    airports,
  });
  await next();
});

router.post('/', async (ctx, next) => {
  log('getting post request');
  const format = validateRequestFormat({
    headerParam: ctx.headers['content-type'],
    queryParam: ctx.query.format,
  });
  log('got post request with body: ', ctx.request.body, 'and format: ', format);
  const protocol = `${format}rpc`; // {json: jsonrpc, yaml: yamlrpc}[format];
  const parsed = format === 'json' ? ctx.request.body : multiParser.parse(ctx.request.body, format);

  validateRequest(parsed, protocol);

  // TODO modularize and pass a format/protocol parameter
  const requestBody = normalizeRequest(parsed);

  log('Executing method', requestBody.method, 'with params', requestBody.params);

  const result = await execute(requestBody.method, requestBody.params, ctx.db);

  log('executed method', requestBody.method);

  const responseBody = buildRPCResponse({
    protocol,
    id: requestBody.id,
    version: requestBody.jsonrpc,
    resultObject: result,
  });

  validateResponse(responseBody, parsed.method, `${format}rpc`);
  ctx.status = 200;
  ctx.body = multiParser.stringify(responseBody, format);
  await next();
});

app.use(router.routes());

app.listen(process.env.FREEFALL_PORT || 3000);

// console.log('Listening on 3000...');
