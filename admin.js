const path = require('path');
const Koa = require('koa');
const Router = require('koa-router');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const serve = require('koa-static');
const views = require('koa-views');
const cors = require('@koa/cors');
const session = require('koa-session');
const { each } = require('lodash');
const log = require('./modules/log');
const auth = require('./modules/auth');
const db = require('./modules/db');
const users = require('./modules/users');
const { getAdminContext } = require('./modules/render-contexts');
const { rpcAPILayer } = require('./modules/api');
const { assertApp } = require('./modules/error-handling.js');

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

app.use(db.client);
app.use(db.session);

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

router.get('/login', auth.redirectWhenLoggedIn('/'), async (ctx) => {
  return ctx.render('login.html', await getAdminContext(ctx, 'get', '/login'));
});

router.post('/login', auth.redirectWhenLoggedIn('/'), async (ctx) => {
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
    if (e instanceof auth.InvalidCredentials) {
      log.info('Invalid credentials on login. Setting ctx.state.login_error_message');
      ctx.state.login_error_message = 'Invalid username or password.';
    } else {
      throw e;
    }
  }

  return ctx.redirect('/login', { error_message: ctx.state.login_error_message });
});

router.get(
  '/',
  auth.redirectWhenLoggedIn('/subscriptions'),
  auth.redirectWhenLoggedOut('/login'),
  async (ctx) => {
    assertApp(
      false,
      `auth module asserted that ctx is neither logged in nor logged out.`,
    );
  }
);

router.get('/logout', auth.redirectWhenLoggedOut('/'), async (ctx) => {
  await auth.logout(ctx);
  ctx.redirect('/');
});

router.get('/subscriptions', auth.redirectWhenLoggedOut('/login'), async (ctx) => {
  return ctx.render('subscriptions.html', await getAdminContext(ctx, 'get', '/subscriptions'));
});

router.get('/users', auth.redirectWhenLoggedOut('/login'), async (ctx) => {
  return ctx.render('users.html', await getAdminContext(ctx, 'get', '/users'));
});

router.get('/users/:user_id', auth.redirectWhenLoggedOut('/login'), async (ctx) => {
  const dbClient = ctx.state.dbClient;
  const defaultContext = await getAdminContext(ctx, 'get', '/users/:user_id');
  const user = await users.fetchUser(dbClient, { userId: ctx.params.user_id });

  if (!user) {
    ctx.status = 404;
  } else {
    return ctx.render('user.html', Object.assign(defaultContext, { user_credentials: user }));
  }
});

router.get('/fetches', auth.redirectWhenLoggedOut('/login'), async (ctx) => {
  const dbClient = ctx.state.dbClient;
  const defaultContext = await getAdminContext(ctx, 'get', '/fetches');
  const rows = await dbClient.select('fetches');
  const fetches = rows.map(row => {
    row.timestamp = row.fetch_time.toISOString();
    return row;
  });

  return ctx.render('fetches.html', Object.assign(defaultContext, { fetches }));
});

router.get('/transfers', auth.redirectWhenLoggedOut('/login'), async (ctx) => {
  const dbClient = ctx.state.dbClient;
  const defaultContext = await getAdminContext(ctx, 'get', '/transfers');
  const rows = await dbClient.selectAccountTransfersUsers();
  const accountTransfers = rows.map(row => {
    const expectRowProps = [
      {
        name: 'account_transfer_id',
        test: Number.isInteger,
      },
      {
        name: 'user_id',
        test: Number.isInteger,
      },
      {
        name: 'email',
        test: (value) => typeof value === 'string',
      },
      {
        name: 'transfer_amount',
        test: Number.isInteger,
      },
      {
        name: 'transferred_at',
        test: (value) => value instanceof Date,
      },
    ];

    each(expectRowProps, (prop) => {
      assertApp(prop.test(row[prop.name]), `Property "${prop.name}" does not pass test for expected type.`);
    });

    row.user = {
      email: row.email,
      id: row.user_id,
    };
    row.transferred_at = row.transferred_at.toISOString();

    return row;
  });

  return ctx.render('account-transfers.html', {
    ...defaultContext,
    account_transfers: accountTransfers,
  });
});

router.post('/api', rpcAPILayer);

app.use(router.routes());

app.listen(process.env.FREEFALL_ADMIN_PORT || 3001);
