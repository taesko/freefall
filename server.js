const path = require('path');
const Koa = require('koa');
const Router = require('koa-router');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const serve = require('koa-static');
const views = require('koa-views');
const cors = require('@koa/cors');
const session = require('koa-session');

const { assertApp } = require('./modules/error-handling');
const db = require('./modules/db');
const auth = require('./modules/auth');
const users = require('./modules/users');
const { rpcAPILayer } = require('./modules/api');
const methods = require('./methods/methods');
const { getExecuteMethod } = require('./methods/resolve-method');
const log = require('./modules/log');
const { getContextForRoute } = require('./modules/render-contexts');
const { escape } = require('lodash');

const app = new Koa();
const router = new Router();

app.keys = ['freefall is love freefall is life'];

app.use(logger());

app.use(async (ctx, next) => {
  log.request(ctx);
  await next();
  log.response(ctx);
});

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = 500;
    ctx.body = 'Our servers our currently experiencing problems. Please try again later.';
    ctx.app.emit('error', err, ctx);
  }
});

app.on('error', (err, ctx) => {
  log.critical('An unhandled error occurred: ', err);
  log.critical('Context of app is: ', ctx);
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
  options: {
    helpers: {
      is_active: (a, b) => {
        if (a === b) {
          return 'active';
        } else {
          return '';
        }
      },
      escape,
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

app.use(db.client);
app.use(db.session);

router.get('/', async (ctx, next) => {
  const airports = await ctx.state.dbClient.select('airports');

  await ctx.render('index.html', {
    airports,
    ...await getContextForRoute(ctx, 'get', '/'),
  });
  await next();
});

router.get('/login', auth.redirectWhenLoggedIn('/profile'), async (ctx) => {
  await ctx.render('login.html', await getContextForRoute(ctx, 'get', '/login'));
});

router.post('/login', auth.redirectWhenLoggedIn('/profile'), async (ctx) => {
  const { email, password } = ctx.request.body;
  // TODO if typeof email or password is not string this is a peer error
  // application currently does not support peer errors thrown from here
  if (email.length < 3 || password.length < 8) {
    ctx.state.login_error_message = 'Invalid username or password.';
    await ctx.render('login.html', await getContextForRoute(ctx, 'post', '/login'));
    return;
  }

  try {
    await auth.login(ctx, email, password);
    ctx.state.commitDB = true;
    ctx.redirect('/');

    return;
  } catch (e) {
    if (e instanceof auth.InvalidCredentials) {
      log.info('Invalid credentials on login. Setting ctx.state.login_error_message');
      ctx.state.login_error_message = 'Invalid username or password.';
    } else {
      throw e;
    }
  }

  await ctx.render('login.html', await getContextForRoute(ctx, 'post', '/login'));
});

router.get('/logout', auth.redirectWhenLoggedOut('/'), async (ctx, next) => {
  auth.logout(ctx);
  ctx.redirect('/');
  await next();
});

router.get('/register', auth.redirectWhenLoggedIn('/profile'), async (ctx) => {
  await ctx.render('register.html', await getContextForRoute(ctx, 'get', '/register'));
});

router.post('/register', auth.redirectWhenLoggedIn('/profile'), async (ctx) => {
  const errors = [];
  const {
    email,
    password,
    confirm_password: confirmPassword,
  } = ctx.request.body;

  if (password !== confirmPassword) {
    errors.push('Passwords are not the same.');
  }

  if (await users.emailIsTaken(ctx.state.dbClient, email)) {
    errors.push('Email is already taken');
  }
  if (email.length < 3) {
    errors.push('Email is too short.');
  }
  if (password.length < 8) {
    errors.push('Password is too short.');
  }

  if (errors.length > 0) {
    ctx.state.register_errors = errors;
    return ctx.render('register.html', await getContextForRoute(ctx, 'post', '/register'));
  }
  await auth.register(ctx, email, password);
  ctx.state.commitDB = true;
  ctx.state.login_error_message = 'Please visit your email and validate your account.';

  return ctx.render('login.html', await getContextForRoute(ctx, 'get', '/login'));
});

router.get('/register/verify', async (ctx) => {
  const { token } = ctx.request.query;
  const { dbClient } = ctx.state;

  try {
    await users.emailActivateUserAccount(dbClient, token);

    const { rows } = await dbClient.executeQuery(
      `
        SELECT users.id
        FROM users
        WHERE verification_token=$1
      `,
      [token]
    );
    assertApp(rows.length === 1, `failed login from verification token ${token}`);

    const { id } = rows[0];

    await auth.loginById(ctx, id);
    ctx.state.commitDB = true;
    return ctx.redirect('/profile');
  } catch (e) {
    if (e.code === 'INVALID_VERIFICATION_TOKEN') {
      ctx.body = 'Invalid or expired verification token';
      return;
    }
    throw e;
  }
});

router.get('/profile', auth.redirectWhenLoggedOut('/login'), async (ctx) => {
  await ctx.render('profile.html', await getContextForRoute(ctx, 'get', '/profile'));
});

const executeMethod = getExecuteMethod(methods);

router.post('/', rpcAPILayer(executeMethod));

app.use(router.routes());

app.listen(process.env.FREEFALL_PORT || 3000);
