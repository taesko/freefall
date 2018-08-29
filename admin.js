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
const adminAuth = require('./modules/admin-auth');
const db = require('./modules/db');
const users = require('./modules/users');
const { rpcAPILayer } = require('./modules/api');
const methods = require('./methods/methods');
const adminMethods = require('./methods/admin-methods');
const { getExecuteMethod } = require('./methods/resolve-method');
const {
  assertApp,
} = require('./modules/error-handling.js');
const crypto = require('crypto');

const app = new Koa();
const router = new Router();
const SESSION_CONFIG = {
  key: 'koa:sess:admin',
  maxAge: 1000 * 60 * 60 * 24, // 24 hours in miliseconds
};
const RESULTS_LIMIT = 20;

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
    ctx.body = `An unknown error occurred. Please restart the server and refresh the page.`;
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

router.get('/login', adminAuth.redirectWhenLoggedIn('/'), async (ctx) => {
  return ctx.render('login.html', {
    item: 'login',
  });
});

router.post('/login', adminAuth.redirectWhenLoggedIn('/'), async (ctx) => {
  const { email, password } = ctx.request.body;

  log.info('Trying to log in with email: ', email);

  if (typeof email !== 'string' || typeof password !== 'string') {
    ctx.state.login_error_message = 'Invalid username or password.';

    return ctx.render('login.html', {
      item: 'login',
      error_message: ctx.state.login_error_message || '',
    });
  }

  const passwordHashed = crypto.createHash('md5').update(password).digest('hex');

  const selectEmployeeResult = await ctx.state.dbClient.executeQuery(`

    SELECT *
    FROM employees
    WHERE
      email = $1 AND
      password = $2 AND
      active = true;

  `, [email, passwordHashed]);

  assertApp(isObject(selectEmployeeResult), `got ${selectEmployeeResult}`);
  assertApp(Array.isArray(selectEmployeeResult.rows), `got ${selectEmployeeResult.rows}`);
  assertApp(
    selectEmployeeResult.rows.length <= 1,
    `got ${selectEmployeeResult.rows.length}`
  );

  if (selectEmployeeResult.rows.length === 0) {
    log.info('Invalid credentials on login. Setting ctx.state.login_error_message');
    ctx.state.login_error_message = 'Invalid username or password.';

    return ctx.render('login.html', {
      item: 'login',
      error_message: ctx.state.login_error_message || '',
    });
  }

  const employee = selectEmployeeResult.rows[0];

  assertApp(isObject(employee), `got ${employee}`);
  assertApp(typeof employee.id === 'number', `got ${employee.id}`);

  ctx.session.employeeID = employee.id;
  log.info('Logged in as employee', employee.id);

  return ctx.redirect('/');
});

router.get('/change_password', adminAuth.redirectWhenLoggedOut('/login'), async (ctx) => {
  const loggedInEmployee = await adminAuth.getLoggedInEmployee(ctx);

  assertApp(
    isObject(loggedInEmployee) ||
    loggedInEmployee === null,
    `got ${loggedInEmployee}`
  );

  if (loggedInEmployee == null) {
    ctx.session.employeeID = null;
    return ctx.redirect('/login');
  }

  return ctx.render('change-password.html', {
    item: 'change_password',
    employee: {
      email: loggedInEmployee.email,
    },
  });
});

router.post('/change_password', adminAuth.redirectWhenLoggedOut('/login'), async (ctx) => {
  const loggedInEmployee = await adminAuth.getLoggedInEmployee(ctx);

  assertApp(
    isObject(loggedInEmployee) ||
    loggedInEmployee === null,
    `got ${loggedInEmployee}`
  );

  if (loggedInEmployee == null) {
    ctx.session.employeeID = null;
    return ctx.redirect('/login');
  }

  const oldPassword = ctx.request.body['old-password'];
  const newPassword = ctx.request.body['new-password'];
  const confirmNewPassword = ctx.request.body['confirm-new-password'];

  if (
    typeof oldPassword !== 'string' ||
    typeof newPassword !== 'string' ||
    typeof confirmNewPassword !== 'string'
  ) {
    log.info('Invalid form format was sent.');

    return ctx.render('change-password.html', {
      item: 'change_password',
      employee: {
        email: loggedInEmployee.email,
      },
      error_message: 'Change password failed. Invalid form was sent.',
    });
  }

  if (newPassword !== confirmNewPassword) {
    log.info('New password and confirm new password do not match');

    return ctx.render('change-password.html', {
      item: 'change_password',
      employee: {
        email: loggedInEmployee.email,
      },
      error_message: 'Change password failed. New password and confirm new password do not match.',
    });
  }

  const oldPasswordHashed = crypto.createHash('md5').update(oldPassword).digest('hex');

  const selectEmployeeResult = await ctx.state.dbClient.executeQuery(`

    SELECT *
    FROM employees
    WHERE
      email = $1 AND
      active = true AND
      password = $2;

  `, [
    loggedInEmployee.email,
    oldPasswordHashed,
  ]);

  assertApp(isObject(selectEmployeeResult), `got ${selectEmployeeResult}`);
  assertApp(Array.isArray(selectEmployeeResult.rows), `got ${selectEmployeeResult.rows}`);
  assertApp(
    selectEmployeeResult.rows.length <= 1,
    `got ${selectEmployeeResult.rows.length}`
  );

  if (selectEmployeeResult.rows.length === 0) {
    log.info('Wrong old password');

    return ctx.render('change-password.html', {
      item: 'change_password',
      employee: {
        email: loggedInEmployee.email,
      },
      error_message: 'Change password failed. Old password was not correct.',
    });
  }

  const newPasswordHashed = crypto.createHash('md5').update(newPassword).digest('hex');

  await ctx.state.dbClient.executeQuery(`

    UPDATE employees
    SET password = $1
    WHERE id = $2;

  `, [
    newPasswordHashed,
    loggedInEmployee.id,
  ]);

  ctx.state.commitDB = true;

  return ctx.render('change-password.html', {
    item: 'change_password',
    employee: {
      email: loggedInEmployee.email,
    },
    success_message: 'Successfully changed password!',
  });
});

router.get(
  '/',
  adminAuth.redirectWhenLoggedIn('/subscriptions'),
  adminAuth.redirectWhenLoggedOut('/login'),
  async () => {
    assertApp(
      false,
      `adminAuth module asserted that ctx is neither logged in nor logged out.`,
    );
  }
);

router.get('/logout', adminAuth.redirectWhenLoggedOut('/'), async (ctx) => {
  log.info('Logging out from session:', ctx.session);
  ctx.session.employeeID = null;
  ctx.redirect('/');
});

router.get('/subscriptions', adminAuth.redirectWhenLoggedOut('/login'), async (ctx) => {
  const loggedInEmployee = await adminAuth.getLoggedInEmployee(ctx);

  assertApp(
    isObject(loggedInEmployee) ||
    loggedInEmployee === null,
    `got ${loggedInEmployee}`
  );

  if (loggedInEmployee == null) {
    ctx.session.employeeID = null;
    return ctx.redirect('/login');
  }

  assertApp(typeof loggedInEmployee.api_key === 'string', `got ${loggedInEmployee.api_key}`);
  assertApp(typeof loggedInEmployee.email === 'string', `got ${loggedInEmployee.email}`);

  const guestSubscriptionsPermissionStatus = await adminAuth.hasPermission(
    ctx.state.dbClient,
    loggedInEmployee.api_key,
    'admin_list_guest_subscriptions'
  );

  const userSubscriptionsPermissionStatus = await adminAuth.hasPermission(
    ctx.state.dbClient,
    loggedInEmployee.api_key,
    'admin_list_user_subscriptions'
  );

  assertApp(
    typeof guestSubscriptionsPermissionStatus === 'boolean',
    `got ${guestSubscriptionsPermissionStatus}`
  );

  assertApp(
    typeof userSubscriptionsPermissionStatus === 'boolean',
    `got ${userSubscriptionsPermissionStatus}`
  );

  if (
    !guestSubscriptionsPermissionStatus ||
    !userSubscriptionsPermissionStatus
  ) {
    ctx.status = 403;
    ctx.body = 'Permission denied!';
    return;
  }

  return ctx.render('subscriptions.html', {
    item: 'subscriptions',
    employee: {
      email: loggedInEmployee.email,
    },
  });
});

router.get('/users', adminAuth.redirectWhenLoggedOut('/login'), async (ctx) => {
  const loggedInEmployee = await adminAuth.getLoggedInEmployee(ctx);

  assertApp(
    isObject(loggedInEmployee) ||
    loggedInEmployee === null,
    `got ${loggedInEmployee}`
  );

  if (loggedInEmployee == null) {
    ctx.session.employeeID = null;
    return ctx.redirect('/login');
  }

  assertApp(typeof loggedInEmployee.api_key === 'string', `got ${loggedInEmployee.api_key}`);
  assertApp(typeof loggedInEmployee.email === 'string', `got ${loggedInEmployee.email}`);

  const permissionStatus = await adminAuth.hasPermission(
    ctx.state.dbClient,
    loggedInEmployee.api_key,
    'admin_list_users'
  );

  assertApp(typeof permissionStatus === 'boolean', `got ${permissionStatus}`);

  if (!permissionStatus) {
    ctx.status = 403;
    ctx.body = 'Permission denied!';
    return;
  }

  return ctx.render('users.html', {
    item: 'users',
    employee: {
      email: loggedInEmployee.email,
    },
  });
});

router.get('/users/:user_id', adminAuth.redirectWhenLoggedOut('/login'), async (ctx) => {
  const loggedInEmployee = await adminAuth.getLoggedInEmployee(ctx);

  assertApp(
    isObject(loggedInEmployee) ||
    loggedInEmployee === null,
    `got ${loggedInEmployee}`
  );

  if (loggedInEmployee == null) {
    ctx.session.employeeID = null;
    return ctx.redirect('/login');
  }

  assertApp(typeof loggedInEmployee.api_key === 'string', `got ${loggedInEmployee.api_key}`);
  assertApp(typeof loggedInEmployee.email === 'string', `got ${loggedInEmployee.email}`);

  const permissionStatus = await adminAuth.hasPermission(
    ctx.state.dbClient,
    loggedInEmployee.api_key,
    'admin_list_user_info'
  );

  assertApp(typeof permissionStatus === 'boolean', `got ${permissionStatus}`);

  if (!permissionStatus) {
    ctx.status = 403;
    ctx.body = 'Permission denied!';
    return;
  }

  const dbClient = ctx.state.dbClient;
  const user = await users.fetchUser(dbClient, { userId: ctx.params.user_id });

  if (!user) {
    ctx.status = 404;
  } else {
    return ctx.render('user.html', {
      user_credentials: user,
      item: 'user',
      employee: {
        email: loggedInEmployee.email,
      },
    });
  }
});

router.get('/employees', adminAuth.redirectWhenLoggedOut('/login'), async (ctx) => {
  const loggedInEmployee = await adminAuth.getLoggedInEmployee(ctx);

  assertApp(
    isObject(loggedInEmployee) ||
    loggedInEmployee === null,
    `got ${loggedInEmployee}`
  );

  if (loggedInEmployee == null) {
    ctx.session.employeeID = null;
    return ctx.redirect('/login');
  }

  assertApp(typeof loggedInEmployee.api_key === 'string', `got ${loggedInEmployee.api_key}`);
  assertApp(typeof loggedInEmployee.email === 'string', `got ${loggedInEmployee.email}`);

  const permissionStatus = await adminAuth.hasPermission(
    ctx.state.dbClient,
    loggedInEmployee.api_key,
    'admin_list_employees'
  );

  assertApp(typeof permissionStatus === 'boolean', `got ${permissionStatus}`);

  if (!permissionStatus) {
    ctx.status = 403;
    ctx.body = 'Permission denied!';
    return;
  }

  return ctx.render('employees.html', {
    item: 'employees',
    employee: {
      email: loggedInEmployee.email,
    },
  });
});

router.get('/employees/:employee_id', adminAuth.redirectWhenLoggedOut('/login'), async (ctx) => {
  const loggedInEmployee = await adminAuth.getLoggedInEmployee(ctx);

  assertApp(
    isObject(loggedInEmployee) ||
    loggedInEmployee === null,
    `got ${loggedInEmployee}`
  );

  if (loggedInEmployee == null) {
    ctx.session.employeeID = null;
    return ctx.redirect('/login');
  }

  assertApp(typeof loggedInEmployee.api_key === 'string', `got ${loggedInEmployee.api_key}`);
  assertApp(typeof loggedInEmployee.email === 'string', `got ${loggedInEmployee.email}`);

  const permissionStatus = await adminAuth.hasPermission(
    ctx.state.dbClient,
    loggedInEmployee.api_key,
    'admin_list_employee_info'
  );

  assertApp(typeof permissionStatus === 'boolean', `got ${permissionStatus}`);

  if (!permissionStatus) {
    ctx.status = 403;
    ctx.body = 'Permission denied!';
    return;
  }

  const employeeId = Number(ctx.params.employee_id);

  if (!Number.isSafeInteger(employeeId)) {
    ctx.status = 400;
    ctx.body = 'Invalid parameter employee id!';
    return;
  }

  const employeeSelectResult = await ctx.state.dbClient.executeQuery(`

    SELECT
      employees.id,
      employees.email,
      employees.active,
      employees_roles.role_id,
      employees_roles.updated_at AS role_updated_at
    FROM employees
    JOIN employees_roles
      ON employees.id = employees_roles.employee_id
    WHERE
      employees.id = $1 AND
      employees.active = true;

  `, [
    employeeId,
  ]);

  assertApp(isObject(employeeSelectResult), `got ${employeeSelectResult}`);
  assertApp(
    Array.isArray(employeeSelectResult.rows),
    `got ${employeeSelectResult.rows}`
  );
  assertApp(
    employeeSelectResult.rows.length <= 1,
    `got ${employeeSelectResult.rows.length}`
  );

  if (employeeSelectResult.rows.length === 0) {
    ctx.status = 404;
    ctx.body = 'Employee not found!';
    return;
  }

  const employee = employeeSelectResult.rows[0];

  return ctx.render('employee.html', {
    item: 'employee',
    employee: {
      email: loggedInEmployee.email,
    },
    employee_credentials: {
      id: employee.id,
      email: employee.email,
      active: employee.active,
      role_id: employee.role_id,
      role_updated_at: employee.role_updated_at.toISOString(),
    },
  });
});

router.get('/roles', adminAuth.redirectWhenLoggedOut('/login'), async (ctx) => {
  const loggedInEmployee = await adminAuth.getLoggedInEmployee(ctx);

  assertApp(
    isObject(loggedInEmployee) ||
    loggedInEmployee === null,
    `got ${loggedInEmployee}`
  );

  if (loggedInEmployee == null) {
    ctx.session.employeeID = null;
    return ctx.redirect('/login');
  }

  assertApp(typeof loggedInEmployee.api_key === 'string', `got ${loggedInEmployee.api_key}`);
  assertApp(typeof loggedInEmployee.email === 'string', `got ${loggedInEmployee.email}`);

  const permissionStatus = await adminAuth.hasPermission(
    ctx.state.dbClient,
    loggedInEmployee.api_key,
    'admin_list_roles'
  );

  assertApp(typeof permissionStatus === 'boolean', `got ${permissionStatus}`);

  if (!permissionStatus) {
    ctx.status = 403;
    ctx.body = 'Permission denied!';
    return;
  }

  return ctx.render('roles.html', {
    item: 'roles',
    employee: {
      email: loggedInEmployee.email,
    },
  });
});

router.get('/roles/:role_id', adminAuth.redirectWhenLoggedOut('/login'), async (ctx) => {
  const loggedInEmployee = await adminAuth.getLoggedInEmployee(ctx);

  assertApp(
    isObject(loggedInEmployee) ||
    loggedInEmployee === null,
    `got ${loggedInEmployee}`
  );

  if (loggedInEmployee == null) {
    ctx.session.employeeID = null;
    return ctx.redirect('/login');
  }

  assertApp(typeof loggedInEmployee.api_key === 'string', `got ${loggedInEmployee.api_key}`);
  assertApp(typeof loggedInEmployee.email === 'string', `got ${loggedInEmployee.email}`);

  const permissionStatus = await adminAuth.hasPermission(
    ctx.state.dbClient,
    loggedInEmployee.api_key,
    'admin_list_roles'
  );

  assertApp(typeof permissionStatus === 'boolean', `got ${permissionStatus}`);

  if (!permissionStatus) {
    ctx.status = 403;
    ctx.body = 'Permission denied!';
    return;
  }

  const roleId = Number(ctx.params.role_id);

  if (!Number.isSafeInteger(roleId)) {
    ctx.status = 400;
    ctx.body = 'Expected role_id to be integer!';
    return;
  }

  return ctx.render('role.html', {
    item: 'role',
    role_id: roleId,
    employee: {
      email: loggedInEmployee.email,
    },
  });
});

router.get('/fetches', adminAuth.redirectWhenLoggedOut('/login'), async (ctx) => {
  const loggedInEmployee = await adminAuth.getLoggedInEmployee(ctx);

  assertApp(
    isObject(loggedInEmployee) ||
    loggedInEmployee === null,
    `got ${loggedInEmployee}`
  );

  if (loggedInEmployee == null) {
    ctx.session.employeeID = null;
    return ctx.redirect('/login');
  }

  assertApp(typeof loggedInEmployee.api_key === 'string', `got ${loggedInEmployee.api_key}`);
  assertApp(typeof loggedInEmployee.email === 'string', `got ${loggedInEmployee.email}`);

  const permissionStatus = await adminAuth.hasPermission(
    ctx.state.dbClient,
    loggedInEmployee.api_key,
    'admin_list_fetches'
  );

  assertApp(typeof permissionStatus === 'boolean', `got ${permissionStatus}`);

  if (!permissionStatus) {
    ctx.status = 403;
    ctx.body = 'Permission denied!';
    return;
  }

  const dbClient = ctx.state.dbClient;
  let page;

  if (!ctx.query.page) {
    page = 1;
  } else {
    page = Number(ctx.query.page);
  }

  if (!Number.isInteger(page) || page < 1) {
    ctx.body = 'Expected positive integer for page number!';
    ctx.status = 400;
    return;
  }

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

  return ctx.render('fetches.html', {
    item: 'fetches',
    employee: {
      email: loggedInEmployee.email,
    },
    fetches,
    totalAPIRequests: totalFetchesResponse.rows[0].total_api_requests,
    page,
    next_page: fetches.length === RESULTS_LIMIT ? page + 1 : null,
    prev_page: page > 1 ? page - 1 : null,
  });
});

router.get('/transfers', adminAuth.redirectWhenLoggedOut('/login'), async (ctx) => {
  const loggedInEmployee = await adminAuth.getLoggedInEmployee(ctx);

  assertApp(
    isObject(loggedInEmployee) ||
    loggedInEmployee === null,
    `got ${loggedInEmployee}`
  );

  if (loggedInEmployee == null) {
    ctx.session.employeeID = null;
    return ctx.redirect('/login');
  }

  assertApp(typeof loggedInEmployee.api_key === 'string', `got ${loggedInEmployee.api_key}`);
  assertApp(typeof loggedInEmployee.email === 'string', `got ${loggedInEmployee.email}`);

  const permissionStatus = await adminAuth.hasPermission(
    ctx.state.dbClient,
    loggedInEmployee.api_key,
    'admin_list_transfers'
  );

  assertApp(typeof permissionStatus === 'boolean', `got ${permissionStatus}`);

  if (!permissionStatus) {
    ctx.status = 403;
    ctx.body = 'Permission denied!';
    return;
  }

  let page;

  if (!ctx.query.page) {
    page = 1;
  } else {
    page = Number(ctx.query.page);
  }

  if (!Number.isInteger(page) || page < 1) {
    ctx.body = 'Expected positive integer for page number!';
    ctx.status = 400;
    return;
  }

  const offset = (page - 1) * RESULTS_LIMIT;
  const dbClient = ctx.state.dbClient;
  const selectResult = await dbClient.executeQuery(`

    SELECT
      account_transfers.id AS account_transfer_id,
      transfer_amount,
      transferred_at,
      account_transfers.user_id AS account_owner_id,
      users.email AS account_owner_email,
      employees.id AS employee_transferrer_id,
      employees.email AS employee_transferrer_email,
      a1.name AS user_subscr_airport_from_name,
      a2.name AS user_subscr_airport_to_name,
      users_subscriptions.date_from AS user_subscr_date_from,
      users_subscriptions.date_from AS user_subscr_date_to,
      a3.name AS subscr_airport_from_name,
      a4.name AS subscr_airport_to_name,
      fetch_time
    FROM account_transfers
    LEFT JOIN users
      ON account_transfers.user_id = users.id
    LEFT JOIN user_subscription_account_transfers
      ON user_subscription_account_transfers.account_transfer_id = account_transfers.id
    LEFT JOIN subscriptions_fetches_account_transfers
      ON subscriptions_fetches_account_transfers.account_transfer_id = account_transfers.id
    LEFT JOIN account_transfers_by_employees
      ON account_transfers_by_employees.account_transfer_id = account_transfers.id
    LEFT JOIN employees
      ON employees.id = account_transfers_by_employees.employee_id
    LEFT JOIN users_subscriptions
      ON user_subscription_account_transfers.user_subscription_id = users_subscriptions.id
    LEFT JOIN subscriptions s1
      ON users_subscriptions.subscription_id = s1.id
    LEFT JOIN airports a1
      ON s1.airport_from_id = a1.id
    LEFT JOIN airports a2
      ON s1.airport_to_id = a2.id
    LEFT JOIN subscriptions_fetches
      ON subscriptions_fetches_account_transfers.subscription_fetch_id = subscriptions_fetches.id
    LEFT JOIN subscriptions s2
      ON subscriptions_fetches.subscription_id = s2.id
    LEFT JOIN airports a3
      ON s2.airport_from_id = a3.id
    LEFT JOIN airports a4
      ON s2.airport_to_id = a4.id
    LEFT JOIN fetches
      ON subscriptions_fetches.fetch_id = fetches.id
    ORDER BY account_transfer_id
    LIMIT $1
    OFFSET $2;

  `, [RESULTS_LIMIT, offset]);

  assertApp(isObject(selectResult), `Expected selectResult to be an object, but was ${typeof selectResult}`);
  assertApp(Array.isArray(selectResult.rows), `Expected selectResult.rows to be array, but was ${typeof selectResult.rows}`);

  const accountTransfersUsersRows = selectResult.rows;

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

    const transferByEmployeeGroupCheck = {
      name: 'transfer_by_employee',
      check: [
        {
          name: 'employee_transferrer_id',
          test: Number.isInteger,
        },
        {
          name: 'employee_transferrer_email',
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
      transferByEmployeeGroupCheck,
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
      deposit_amount: (row.transfer_amount > 0) ? row.transfer_amount : null,
      withdrawal_amount:
        (row.transfer_amount < 0) ? row.transfer_amount * -1 : null,
      transferred_at: row.transferred_at.toISOString(),
      employee_transferrer_id: row.employee_transferrer_id,
      employee_transferrer_email: row.employee_transferrer_email,
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
    FROM account_transfers_by_employees
    LEFT JOIN account_transfers
    ON account_transfers_by_employees.account_transfer_id = account_transfers.id
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
    item: 'transfers',
    employee: {
      email: loggedInEmployee.email,
    },
    account_transfers: accountTransfers,
    users_total_spent_credits:
      usersTotalSpentCredits.rows[0].user_spent_credits,
    users_total_credits: usersTotalCredits.rows[0].users_credits,
    total_credits_loaded: totalCreditsLoaded.rows[0].users_given_credits,
    dalipeche_api_total_requests:
      dalipecheAPITotalRequests.rows[0].dalipeche_api_requests,
    page,
    next_page: accountTransfers.length === RESULTS_LIMIT ? page + 1 : null,
    prev_page: page > 1 ? page - 1 : null,
  });
});

const executeMethod = getExecuteMethod({
  ...methods,
  ...adminMethods,
});

router.post('/api', rpcAPILayer(executeMethod));

app.use(router.routes());

app.listen(process.env.FREEFALL_ADMIN_PORT || 3001);
