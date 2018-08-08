const path = require('path');
const Koa = require('koa');
const Router = require('koa-router');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const serve = require('koa-static');
const views = require('koa-views');
const cors = require('@koa/cors');
const session = require('koa-session');
const { each, escape } = require('lodash');
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

app.use(logger());

app.use(async (ctx, next) => {
  log.request(ctx);
  await next();
  log.response(ctx);
});

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

  return ctx.render('login.html', await getAdminContext(ctx, 'get', '/login'));
});

router.get(
  '/',
  auth.redirectWhenLoggedIn('/subscriptions'),
  auth.redirectWhenLoggedOut('/login'),
  async () => {
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
    const expectRequiredRowProps = [
      {
        name: 'account_transfer_id',
        test: Number.isInteger,
      },
      {
        name: 'transfer_amount',
        test: Number.isInteger,
      },
      {
        name: 'transferred_at',
        test: (value) => value instanceof Date,
      },
      {
        name: 'account_owner_id',
        test: Number.isInteger,
      },
      {
        name: 'account_owner_email',
        test: (value) => typeof value === 'string',
      },
    ];

    each(expectRequiredRowProps, (prop) => {
      assertApp(prop.test(row[prop.name]), `Property "${prop.name}" does not pass test for expected type.`);
    });

    const transferByAdminGroupCheck = {
      name: 'transfer_by_admin',
      check: [
        {
          name: 'user_transferrer_id',
          test: Number.isInteger,
        },
        {
          name: 'user_transferrer_email',
          test: (value) => typeof value === 'string',
        },
      ],
    };
    const newUserSubscriptionGroupCheck = {
      name: 'new_user_subscription',
      check: [
        {
          name: 'user_subscr_airport_from_name',
          test: (value) => typeof value === 'string',
        },
        {
          name: 'user_subscr_airport_to_name',
          test: (value) => typeof value === 'string',
        },
        {
          name: 'user_subscr_date_from',
          test: (value) => value instanceof Date,
        },
        {
          name: 'user_subscr_date_to',
          test: (value) => value instanceof Date,
        },
      ],
    };
    const newFetchGroupCheck = {
      name: 'new_fetch',
      check: [
        {
          name: 'subscr_airport_from_name',
          test: (value) => typeof value === 'string',
        },
        {
          name: 'subscr_airport_to_name',
          test: (value) => typeof value === 'string',
        },
        {
          name: 'fetch_time',
          test: (value) => value instanceof Date,
        },
      ],
    };
    const groupChecks = [
      transferByAdminGroupCheck,
      newUserSubscriptionGroupCheck,
      newFetchGroupCheck,
    ];
    // in null groups all props must be null
    // in a not null group all props must pass their test
    // there must be exactly one not null group
    let isFoundNotNullGroup = false;

    for (const groupCheck of groupChecks) {
      const check = groupCheck.check;

      if (isFoundNotNullGroup || row[check[0].name] == null) {
        each(check, (prop) => {
          assertApp(row[prop.name] == null, `Property "${prop.name}" does not pass test for expected type = null.`);
        });
        continue;
      }

      isFoundNotNullGroup = true;

      each(check, (prop) => {
        assertApp(prop.test(row[prop.name]), `Property "${prop.name}" does not pass test for expected type. (isFoundNotNullGroup = true)`);
      });
    }

    assertApp(isFoundNotNullGroup, 'Reason for transaction not found');

    const accountTransfer = {
      account_transfer_id: row.account_transfer_id,
      user: {
        email: row.account_owner_email,
        id: row.account_owner_id,
      },
      transfer_amount: row.transfer_amount,
      transferred_at: row.transferred_at.toISOString(),
      user_transferrer_id: row.user_transferrer_id,
      user_transferrer_email: row.user_transferrer_email,
      user_subscr_airport_from_name: row.user_subscr_airport_from_name,
      user_subscr_airport_to_name: row.user_subscr_airport_to_name,
      user_subscr_date_from: row.user_subscr_date_from &&
        row.user_subscr_date_from.toISOString(),
      user_subscr_date_to: row.user_subscr_date_to &&
        row.user_subscr_date_to.toISOString(),
      subscr_airport_from_name: row.subscr_airport_from_name,
      subscr_airport_to_name: row.subscr_airport_to_name,
      fetch_time: row.fetch_time && row.fetch_time.toISOString(),
    };

    log.debug(accountTransfer);

    return accountTransfer;
  });

  return ctx.render('account-transfers.html', {
    ...defaultContext,
    account_transfers: accountTransfers,
  });
});

router.post('/api', rpcAPILayer);

app.use(router.routes());

app.listen(process.env.FREEFALL_ADMIN_PORT || 3001);
