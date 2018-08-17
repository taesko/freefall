const path = require('path');
const Koa = require('koa');
const Router = require('koa-router');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const serve = require('koa-static');
const views = require('koa-views');
const cors = require('@koa/cors');
const session = require('koa-session');
const { each, escape, isObject } = require('lodash');
const log = require('./modules/log');
const auth = require('./modules/auth');
const db = require('./modules/db');
const users = require('./modules/users');
const { getAdminContext } = require('./modules/render-contexts');
const { rpcAPILayer } = require('./modules/api');
const {
  assertApp,
  assertUser,
} = require('./modules/error-handling.js');

const app = new Koa();
const router = new Router();
const SESSION_CONFIG = {
  key: 'koa:sess:admin',
  maxAge: 1000 * 60 * 60 * 24, // 24 hours in miliseconds
};
const RESULTS_LIMIT = 5;

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

  let page;

  if (!ctx.query.page) {
    page = 1;
  } else {
    page = Number(ctx.query.page);
  }

  assertUser(Number.isInteger(page), 'Expected integer for page number!');
  assertUser(page >= 1, 'Expected positive integer for page number!');

  const offset = (page - 1) * RESULTS_LIMIT;
  const fetchesResponse = await dbClient.executeQuery(`

    SELECT
      fetches.id AS id,
      fetches.fetch_time as fetch_time,
      sum(api_fetches_count)::integer AS api_requests
    FROM subscriptions_fetches
    LEFT JOIN fetches
    ON subscriptions_fetches.fetch_id = fetches.id
    GROUP BY (fetches.id, fetches.fetch_time)
    ORDER BY fetches.id ASC
    LIMIT $1
    OFFSET $2;

  `, [RESULTS_LIMIT, offset]);

  assertApp(isObject(fetchesResponse), `got ${fetchesResponse}`);
  assertApp(Array.isArray(fetchesResponse.rows), `got ${fetchesResponse.rows}`);

  let totalAPIRequests = 0;

  const totalFetchesResponse = await dbClient.executeQuery(`

    SELECT COALESCE(sum(api_fetches_count)::integer, 0) AS total_api_requests
    FROM subscriptions_fetches;

  `);

  assertApp(isObject(totalFetchesResponse), `got ${totalFetchesResponse}`);
  assertApp(Array.isArray(totalFetchesResponse.rows), `got ${totalFetchesResponse.rows}`);
  assertApp(totalFetchesResponse.rows.length === 1, `got ${totalFetchesResponse.rows.length}`);
  assertApp(isObject(totalFetchesResponse.rows[0]), `got ${totalFetchesResponse.rows[0]}`);
  assertApp(Number.isInteger(totalFetchesResponse.rows[0].total_api_requests), `got ${totalFetchesResponse.rows[0].total_api_requests}`);

  const fetches = fetchesResponse.rows.map(row => {
    row.timestamp = row.fetch_time.toISOString();
    return row;
  });

  return ctx.render('fetches.html', Object.assign(defaultContext, {
    fetches,
    totalAPIRequests: totalFetchesResponse.rows[0].total_api_requests,
    page,
    next_page: fetches.length === RESULTS_LIMIT ? page + 1 : null,
    prev_page: page > 1 ? page - 1 : null,
  }));
});

router.get('/transfers', auth.redirectWhenLoggedOut('/login'), async (ctx) => {
  const dbClient = ctx.state.dbClient;
  const defaultContext = await getAdminContext(ctx, 'get', '/transfers');
  const accountTransfersUsersRows =
    await dbClient.selectAccountTransfersUsers();
  const accountTransfers = accountTransfersUsersRows.map(row => {
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

  const usersTotalSpentCredits = await dbClient.executeQuery(`

    SELECT COALESCE(sum(transfer_amount) * -1, 0)::integer AS user_spent_credits
    FROM account_transfers
    WHERE
      transfer_amount < 0;

  `);

  assertApp(isObject(usersTotalSpentCredits), `got ${usersTotalSpentCredits}`);
  assertApp(Array.isArray(usersTotalSpentCredits.rows), `got ${usersTotalSpentCredits.rows}`);
  assertApp(usersTotalSpentCredits.rows.length === 1, `got ${usersTotalSpentCredits.rows}`);
  assertApp(isObject(usersTotalSpentCredits.rows[0]), `got ${usersTotalSpentCredits.rows[0]}`);
  assertApp(typeof usersTotalSpentCredits.rows[0].user_spent_credits === 'number', `got ${usersTotalSpentCredits.rows[0].user_spent_credits}`);

  const usersTotalCredits = await dbClient.executeQuery(`

    SELECT COALESCE(sum(credits), 0)::integer AS users_credits
    FROM users;

  `);

  assertApp(isObject(usersTotalCredits), `got ${usersTotalCredits}`);
  assertApp(Array.isArray(usersTotalCredits.rows), `got ${usersTotalCredits.rows}`);
  assertApp(usersTotalCredits.rows.length === 1, `got ${usersTotalCredits.rows}`);
  assertApp(isObject(usersTotalCredits.rows[0]), `got ${usersTotalCredits.rows[0]}`);
  assertApp(typeof usersTotalCredits.rows[0].users_credits === 'number', `got ${usersTotalCredits.rows[0].users_credits}`);

  const totalCreditsLoaded = await dbClient.executeQuery(`

    SELECT COALESCE(sum(transfer_amount), 0)::integer AS users_given_credits
    FROM account_transfers_by_admin
    LEFT JOIN account_transfers
    ON account_transfers_by_admin.account_transfer_id = account_transfers.id
    WHERE transfer_amount > 0;

  `);

  assertApp(isObject(totalCreditsLoaded), `got ${totalCreditsLoaded}`);
  assertApp(Array.isArray(totalCreditsLoaded.rows), `got ${totalCreditsLoaded.rows}`);
  assertApp(totalCreditsLoaded.rows.length === 1, `got ${totalCreditsLoaded.rows}`);
  assertApp(isObject(totalCreditsLoaded.rows[0]), `got ${totalCreditsLoaded.rows[0]}`);
  assertApp(typeof totalCreditsLoaded.rows[0].users_given_credits === 'number', `got ${totalCreditsLoaded.rows[0].users_given_credits}`);

  const dalipecheAPITotalRequests = await dbClient.executeQuery(`

    SELECT count(*)::integer AS dalipeche_api_requests
    FROM dalipeche_fetches;

  `);

  assertApp(isObject(dalipecheAPITotalRequests), `got ${dalipecheAPITotalRequests}`);
  assertApp(Array.isArray(dalipecheAPITotalRequests.rows), `got ${dalipecheAPITotalRequests.rows}`);
  assertApp(dalipecheAPITotalRequests.rows.length === 1, `got ${dalipecheAPITotalRequests.rows}`);
  assertApp(isObject(dalipecheAPITotalRequests.rows[0]), `got ${dalipecheAPITotalRequests.rows[0]}`);
  assertApp(typeof dalipecheAPITotalRequests.rows[0].dalipeche_api_requests === 'number', `got ${dalipecheAPITotalRequests.rows[0].dalipeche_api_requests}`);

  return ctx.render('account-transfers.html', {
    ...defaultContext,
    account_transfers: accountTransfers,
    users_total_spent_credits:
      usersTotalSpentCredits.rows[0].user_spent_credits,
    users_total_credits: usersTotalCredits.rows[0].users_credits,
    total_credits_loaded: totalCreditsLoaded.rows[0].users_given_credits,
    dalipeche_api_total_requests:
      dalipecheAPITotalRequests.rows[0].dalipeche_api_requests,
  });
});

router.post('/api', rpcAPILayer);

app.use(router.routes());

app.listen(process.env.FREEFALL_ADMIN_PORT || 3001);
