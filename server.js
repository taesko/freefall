const url = require('url');
const path = require('path');
const Koa = require('koa');
const Router = require('koa-router');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const serve = require('koa-static');
const views = require('koa-views');
const cors = require('@koa/cors');
const session = require('koa-session');

const { assertApp, UserError } = require('./modules/error-handling');
const db = require('./modules/db');
const auth = require('./modules/auth');
const users = require('./modules/users');
const { rpcAPILayer } = require('./modules/api');
const methods = require('./methods/methods');
const config = require('./modules/config');
const { getExecuteMethod } = require('./methods/resolve-method');
const log = require('./modules/log');
const { getContextForRoute } = require('./modules/render-contexts');
const { escape } = require('lodash');

const app = new Koa();
const router = new Router();

const MIN_EMAIL_LENGTH = 3;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;

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

  ctx.state.errors = ctx.state.errors || {};

  // TODO if typeof email or password is not string this is a peer error
  // application currently does not support peer errors thrown from here
  if (
    email.length < MIN_EMAIL_LENGTH ||
    password.length < MIN_PASSWORD_LENGTH
  ) {
    ctx.state.errors['LOGIN_INVALID_CREDENTIALS'] = {};
    await ctx.render('login.html', await getContextForRoute(ctx, 'post', '/login'));
    return;
  }

  try {
    await auth.login(ctx, email, password);
    ctx.state.commitDB = true;
    ctx.redirect('/');

    return;
  } catch (e) {
    if (e instanceof UserError) {
      if (e.code === 'LOGIN_UNVERIFIED_EMAIL') {
        const { rows: userRows } = await ctx.state.dbClient.executeQuery(
          'SELECT * FROM users WHERE email=$1',
          [email]
        );
        const [user] = userRows;
        const relUrl = url.resolve(config.address, config.routes.verify_email);
        const query = `?token=${encodeURIComponent(user.verification_token)}&resend=true`;
        const link = relUrl + query;
        ctx.state.errors['LOGIN_UNVERIFIED_EMAIL'] = {
          email,
          link,
        };
      } else {
        ctx.state.errors[e.code] = {};
      }

      log.info(`Login failed with code ${e.code}. Setting ctx.state.errors`);
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
  if (email.length < MIN_EMAIL_LENGTH) {
    errors.push('Email is too short.');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
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

router.get(config.routes.verify_email, async (ctx) => {
  const { token, resend } = ctx.request.query;
  const { dbClient } = ctx.state;

  if (resend) {
    await dbClient.executeQuery(
      `
      UPDATE users 
      SET sent_verification_email=false 
      WHERE verification_token=$1 AND verified=false
      `,
      [token]
    );
    ctx.state.commitDB = true;
    ctx.body = 'We re-sent a verification link to your email.';
    return;
  }

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

router.get('/register/password-reset', async (ctx) => {
  return ctx.render(
    'password-reset.html',
    await getContextForRoute(ctx, 'post', '/password-reset')
  );
});

router.post('/register/password-reset', async (ctx) => {
  const { email } = ctx.request.body;
  const { resend } = ctx.request.body;
  log.debug('body is', ctx.request.body);

  if (
    typeof email !== 'string' ||
    email.length < MIN_EMAIL_LENGTH ||
    email.length > MAX_EMAIL_LENGTH) {
    ctx.state.password_reset_errors = ['Please provide a valid email address.'];

    return ctx.render(
      'password-reset.html',
      await getContextForRoute(ctx, 'post', '/register/password-reset'),
    );
  }

  if (!await users.userExists(ctx.state.dbClient, { email })) {
    log.info('User entered an unregistered email address.');
    ctx.state.password_reset_messages = [`Sent a password reset email to ${email}.`];

    return ctx.render(
      'password-reset.html',
      await getContextForRoute(ctx, 'post', '/register/password-reset'),
    );
  }

  if (resend) {
    log.info(`User ${email} requested to resent his password reset email.`);
    await ctx.state.dbClient.executeQuery(
      `
      UPDATE password_resets
      SET sent_email=false
      WHERE user_id = (SELECT id FROM users WHERE email=$1)
      `,
      [email],
    );
    ctx.state.password_reset_messages = ['Sent password reset email again.'];
  } else {
    log.info(`User ${email} wants a password reset.`);
    try {
      await ctx.state.dbClient.executeQuery(
        `
      INSERT INTO password_resets
        (user_id)
      VALUES
        ((SELECT id FROM users WHERE email=$1))
      `,
        [email],
      );
      ctx.state.password_reset_messages = [`Sent a password reset email to ${email}.`];
    } catch (e) {
      log.error(e);
      assertApp(e.code === '23505');
      log.info(`Already sent a password reset email to ${email}`);
      ctx.state.password_reset_errors = [`Already sent a password reset email to ${email}`];

      return ctx.render(
        'password-reset.html',
        await getContextForRoute(ctx, 'post', '/register/password-reset'),
      );
    }
  }

  ctx.state.commitDB = true;

  return ctx.render(
    'password-reset.html',
    await getContextForRoute(ctx, 'post', '/register/password-reset'),
  );
});

router.get('/register/password-reset/reset', async (ctx) => {
  const { token } = ctx.request.query;
  const dbClient = ctx.state.dbClient;
  const invalidTokenMsg = 'Your password reset link has expired. Please request a new one.';
  if (token == null) {
    log.info('User has a null token.');
    ctx.state.password_reset_errors = [invalidTokenMsg];
    return ctx.render(
      'password-reset.html',
      await getContextForRoute(ctx, 'post', '/register/password-reset'),
    );
  }

  const { rows } = await dbClient.executeQuery(
    `
    SELECT user_id, new_password
    FROM password_resets
    WHERE token=$1
    `,
    [token],
  );

  if (rows.length === 0) {
    log.info('User had an invalid token.');
    ctx.state.password_reset_errors = [invalidTokenMsg];
  } else {
    assertApp(rows.length === 1, `got ${token}`);

    log.info('Password reset token is valid. Resetting user password');

    const { user_id: userId, new_password: newPassword } = rows[0];
    const password = users.hashPassword(newPassword);
    await users.editUser(dbClient, userId, { password });
    await dbClient.executeQuery(
      `
        DELETE FROM password_resets
        WHERE token=$1
      `,
      [token],
    );
    ctx.state.password_reset_messages = [
      'Successfully reset your password.',
      'Please change it through your profile page after logging in.',
    ];
    ctx.state.commitDB = true;
  }

  return ctx.render(
    'password-reset.html',
    await getContextForRoute(ctx, 'post', '/register/password-reset'),
  );
});

router.get('/profile', auth.redirectWhenLoggedOut('/login'), async (ctx) => {
  await ctx.render('profile.html', await getContextForRoute(ctx, 'get', '/profile'));
});

router.get('/profile/settings', auth.redirectWhenLoggedOut('/login'), async (ctx) => {
  const context = await getContextForRoute(ctx, 'get', '/profile/settings');
  await ctx.render('settings.html', context);
});

const executeMethod = getExecuteMethod(methods);

router.post('/', rpcAPILayer(executeMethod));

app.use(router.routes());

app.listen(process.env.FREEFALL_PORT || 3000);
