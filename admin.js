const path = require('path');
const Koa = require('koa');
const Router = require('koa-router');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const serve = require('koa-static');
const views = require('koa-views');
const cors = require('@koa/cors');
const session = require('koa-session');
const log = require('./modules/log');
const auth = require('./modules/auth');
const db = require('./modules/db');
const users = require('./modules/users');
const { getAdminContext } = require('./modules/render-contexts');
const { rpcAPILayer } = require('./modules/api');

const app = new Koa();
const router = new Router();
const SESSION_CONFIG = {
  key: 'koa:sess:admin',
  maxAge: 1000 * 60 * 60 * 24, // 24 hours in miliseconds
};

app.keys = ['freefall is love freefall is life'];

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (e) {
    log.critical('Unhandled error reached the top layer.', e);
    ctx.status = 500;
    ctx.body = `An unknown error occurred. Please restart the server and refresh the page.\n${e}`;
    ctx.app.emit('error', e, ctx);
  }
});

app.context.db = db;

app.use(session(SESSION_CONFIG, app));

app.use(logger());

app.use(cors({
  origin: '*',
}));

app.use(bodyParser({
  extendTypes: {
    text: ['text/yaml'],
  },
  enableTypes: ['text', 'form', 'json'],
}));

app.use(serve(path.join(__dirname, 'admin', 'static')));
app.use(views(path.join(__dirname, 'admin', 'templates'), {
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

router.get('/', async (ctx) => {
  if (await auth.isLoggedIn(ctx)) {
    ctx.redirect('/subscriptions');
  } else {
    ctx.redirect('/login');
  }
});

router.get('/login', async (ctx) => {
  if (await auth.isLoggedIn(ctx)) {
    ctx.redirect('/');
    return;
  }
  return ctx.render('login.html', await getAdminContext(ctx, 'get', '/login'));
});

router.post('/login', async (ctx) => {
  try {
    if (ctx.request.body.email !== 'admin@freefall.org') {
      // noinspection ExceptionCaughtLocallyJS
      throw new auth.InvalidCredentials('Tried to login with a non-admin account.');
    }
    const { email, password } = ctx.request.body;
    await auth.login(ctx, email, password);
    ctx.redirect('/');

    return;
  } catch (e) {
    if (e instanceof auth.AlreadyLoggedIn) {
      log.info('User already logged in. Redirect to /');
      ctx.redirect('/');
      return;
    } else if (e instanceof auth.InvalidCredentials) {
      log.info('Invalid credentials on login. Setting ctx.state.login_error_message');
      ctx.state.login_error_message = 'Invalid username or password.';
    } else {
      throw e;
    }
  }

  return ctx.redirect('/login', { error_message: ctx.state.login_error_message });
});

router.get('/logout', async (ctx) => {
  if (await auth.isLoggedIn(ctx)) {
    await auth.logout(ctx);
  }

  ctx.redirect('/');
});

router.get('/subscriptions', async (ctx) => {
  if (!await auth.isLoggedIn(ctx)) {
    ctx.redirect('/');
    return;
  }
  return ctx.render('subscriptions.html', await getAdminContext(ctx, 'get', '/subscriptions'));
});

router.get('/users', async (ctx) => {
  if (!await auth.isLoggedIn(ctx)) {
    ctx.redirect('/');
    return;
  }
  return ctx.render('users.html', await getAdminContext(ctx, 'get', '/users'));
});

router.get('/users/:user_id', async (ctx) => {
  if (!await auth.isLoggedIn(ctx)) {
    ctx.redirect('/');
    return;
  }

  const defaultContext = await getAdminContext(ctx, 'get', '/users/:user_id');
  const user = await users.fetchUser({ userId: ctx.params.user_id });

  if (!user) {
    ctx.status = 404;
  } else {
    return ctx.render('user.html', Object.assign(defaultContext, { user_credentials: user }));
  }
});

router.get('/fetches', async (ctx) => {
  if (!await auth.isLoggedIn(ctx)) {
    ctx.redirect('/');
    return;
  }
  const defaultContext = await getAdminContext(ctx, 'get', '/fetches');
  const fetches = await db.select('fetches');

  return ctx.render('fetches.html', Object.assign(defaultContext, { fetches }));
});

router.post('/api', rpcAPILayer);

app.use(router.routes());

app.listen(process.env.FREEFALL_ADMIN_PORT || 3001);
