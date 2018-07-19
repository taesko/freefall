const path = require('path');
const Koa = require('koa');
const Router = require('koa-router');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const serve = require('koa-static');
const views = require('koa-views');
const cors = require('@koa/cors');
const session = require('koa-session');
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
const auth = require('./modules/auth');
const { log } = require('./modules/utils');
const { validateRequest, validateRequestFormat, validateResponse } = require('./modules/validate');

const multiParser = defineParsers(jsonParser, yamlParser);
const execute = defineMethods(
  search, subscribe, unsubscribe, sendError,
);

const app = new Koa();
const router = new Router();

app.keys = ['freefall is love freefall is life'];

app.on('error', (err, ctx) => {
  log(err);
  log('context of app is: ', ctx);
});

const SESSION_CONFIG = {
  key: 'koa:sess',
  maxAge: 1000 * 60 * 60 * 24, // 24 hours in miliseconds
  // overwrite: true,
  // httpOnly: true,
  // signed: false,
  // rolling: false,
  // renew: false,
};

app.use(session(SESSION_CONFIG, app));

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
    html: 'handlebars',
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

router.get('/unsubscribe', async (ctx) => {
  await ctx.render('unsubscribe.html', {});
});

router.get('/login', async (ctx) => {
  await ctx.render('login.html', {});
});

router.post('/login', async (ctx, next) => {
  log('trying to login user. Current session: ', ctx.session);
  try {
    await auth.login(ctx, ctx.request.body.email, ctx.request.body.password);
  } catch (e) {
    if (e instanceof auth.AlreadyLoggedIn) {
      ctx.redirect('/');
    } else if (e instanceof auth.InvalidCredentials) {
      log('invalid credentials on login. Redirecting to /login');
      ctx.redirect('/login');
    } else {
      throw e;
    }
  }
  ctx.redirect('/');
  await next();
});

router.get('/logout', async (ctx, next) => {
  auth.logout(ctx);
  ctx.redirect('/');
  await next();
});

router.get('/old', async (ctx) => {
  await ctx.render('index-ff20.html', {});
});

router.get('/old/subscribe', async (ctx) => {
  await ctx.render('subscribe-ff20.html', {});
});

router.get('/old/unsubscribe', async (ctx) => {
  await ctx.render('unsubscribe-ff20.html', {});
});

router.post('/', async (ctx, next) => {
  // TODO set ctx.state to hold current jsonrpc request and don't try to report errors when it isn't
  log('getting post request');
  const format = validateRequestFormat({
    headerParam: ctx.headers['content-type'],
    queryParam: ctx.query.format,
  });
  log('got post request with body: ', ctx.request.body, 'and format: ', format);
  const protocol = `${format}rpc`;
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
