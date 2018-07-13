const path = require('path');
const Koa = require('koa');
const Router = require('koa-router');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const serve = require('koa-static');
const send = require('koa-send');
const cors = require('@koa/cors');
const {
  defineMethods,
  search,
  subscribe,
  unsubscribe,
  sendError,
} = require('./methods/resolve-method');
const { defineParsers, jsonParser, yamlParser } = require('./modules/normalize');
const { PeerError, UserError } = require('./modules/error-handling');
const db = require('./modules/db');
const { log } = require('./modules/utils');
const { validateRequest, validateRequestFormat, validateResponse } = require('./modules/validate');

const parser = defineParsers(jsonParser, yamlParser);
const execute = defineMethods(search, subscribe, unsubscribe, sendError);

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
    log(err);
    // assertPeer(0, `The password: ${ pass } is not valid`)

    ctx.status = 200;

    const metadata = {
      type: {
        contentType: ctx.headers['content-type'],
        format: ctx.query.format,
      },
      version: '1.0',
      id: 1,
    };
    if (err instanceof PeerError) {
      ctx.body = parser.error({
        code: -32600,
        message: err.message,
      }, metadata);
    } else if (err instanceof UserError) {
      ctx.body = parser.stringify({
        code: 5000,
        message: err.message,
      }, metadata);
    } else {
      ctx.body = parser.stringify({
        code: 5000,
        message: 'App error',
      }, metadata);
    }
  }
});

db.dbConnect();

app.use(logger());
app.use(cors({
  origin: '*',
}));
app.use(bodyParser({
  extendTypes: {
    text: ['text/yaml'],
  },
  enableTypes: ['json', 'form', 'text'],
}));
app.use(serve(path.join(__dirname, 'public')));

app.context.db = db;

router.post('/', async (ctx, next) => {
  const format = validateRequestFormat({
    headerParam: ctx.headers['content-type'],
    queryParam: ctx.query.format,
  });
  const parsed = parser.parse(ctx.request.body, {
    contentType: ctx.headers['content-type'],
    format: ctx.query.format,
  });

  validateRequest(parsed, `${format}rpc`);

  const result = await execute(parsed.method, parsed.params, ctx.db);
  const stringified = parser.stringify(result, {
    type: {
      contentType: ctx.headers['content-type'],
      format: ctx.query.format,
    },
    version: parsed.version,
    id: parsed.id,
  });

  validateResponse(stringified, parsed.method, `${format}rpc`);

  ctx.status = 200;
  ctx.body = stringified;
  await next();
});

router.get('/', async (ctx, next) => {
  ctx.status = 200;
  await send(ctx, 'public/index.html');
  await next();
});

app.use(router.routes());

app.listen(3000);

// console.log('Listening on 3000...');
