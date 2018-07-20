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
const { getContextForRoute } = require('./modules/render-contexts');

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
    hbs: 'handlebars',
  },
  options: {
    helpers: {
      is_active: (a, b) => {
        if (a === b) {
          return 'active';
        } else {
          return '';
        }
      },
    },
    partials: {
      menu: 'menu',
      heading: 'heading',
      messages: 'messages',
      auth_message_success: 'auth-message-success',
      auth_message_error: 'auth-message-error',
    },
  },
}));

router.get('/', async (ctx, next) => {
  const airports = await db.select('airports', ['id', 'iata_code', 'name']);
  await ctx.render('index-ff20.hbs', {
    airports,
    ...await getContextForRoute(ctx, 'get', '/'),
  });
  await next();
});

router.get('/subscribe', async (ctx, next) => {
  const airports = db.select('airports', ['id', 'iata_code', 'name']);
  await ctx.render('subscribe-ff20.hbs', {
    airports,
    ...await getContextForRoute(ctx, 'get', '/subscribe'),
  });
  await next();
});

router.get('/unsubscribe', async (ctx) => {
  await ctx.render('unsubscribe-ff20.hbs', await getContextForRoute(ctx, 'get', '/unsubscribe'));
});

router.get('/login', async (ctx) => {
  log('getting login page.');
  if (auth.isLoggedIn(ctx)) {
    log('User already logged in. Redirecting to /');
    ctx.redirect('/');
    return;
  }

  await ctx.render('login.hbs', await getContextForRoute(ctx, 'get', '/login'));
});

router.post('/login', async (ctx) => {
  log('trying to login user. Current session: ', ctx.session);

  try {
    await auth.login(ctx, ctx.request.body.email, ctx.request.body.password);
    ctx.redirect('/');
    return;
  } catch (e) {
    if (e instanceof auth.AlreadyLoggedIn) {
      log('User already logged in. Redirect to /');
      ctx.redirect('/');
      return;
    } else if (e instanceof auth.InvalidCredentials) {
      log('Invalid credentials on login. Setting ctx.state.login_error_message');
      ctx.state.login_error_message = 'Invalid username or password.';
    } else {
      throw e;
    }
  }

  await ctx.render('login.hbs', await getContextForRoute(ctx, 'post', '/login'));
});

router.get('/logout', async (ctx, next) => {
  auth.logout(ctx);
  ctx.redirect('/');
  await next();
});

router.get('/register', async (ctx) => {
  if (auth.isLoggedIn(ctx)) {
    ctx.redirect('/');
    return;
  }

  await ctx.render('register.hbs', await getContextForRoute(ctx, 'get', '/register'));
});

router.post('/register', async (ctx) => {
  if (auth.isLoggedIn(ctx)) {
    ctx.redirect('/');
    return;
  }

  const errors = [];
  const {
    email,
    password,
    confirm_password: confirmPassword,
  } = ctx.request.body;

  if (password !== confirmPassword) {
    errors.push('Passwords are not the same.');
  }

  if (auth.emailIsRegistered(email)) {
    errors.push('Email is already taken');
  }

  if (errors.length === 0) {
    await auth.register(email, password);
  }

  ctx.state.register_errors = errors;
  await ctx.render('register.hbs', await getContextForRoute(ctx, 'post', '/register'));
});

router.get('/profile', async (ctx) => {
  await ctx.render('profile.hbs', await getContextForRoute(ctx, 'get', '/profile'));
});

router.get('/old', async (ctx) => {
  const airports = await db.select('airports', ['id', 'iata_code', 'name']);
  await ctx.render('index-ff20.hbs', {
    airports,
    item: 'search',
  });
});

router.get('/old/subscribe', async (ctx) => {
  const airports = db.select('airports', ['id', 'iata_code', 'name']);
  await ctx.render('subscribe-ff20.hbs', {
    airports,
    item: 'subscribe',
  });
});

router.get('/old/unsubscribe', async (ctx) => {
  await ctx.render('unsubscribe-ff20.hbs', {
    item: 'unsubscribe',
  });
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
