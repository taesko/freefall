const path = require('path');
const Koa = require('koa');
const Router = require('koa-router');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const serve = require('koa-static');
const views = require('koa-views');
const cors = require('@koa/cors');
const session = require('koa-session');
const db = require('./modules/db');
const auth = require('./modules/auth');
const users = require('./modules/users');
const { rpcAPILayer, daliPecheAPI } = require('./modules/api');
const log = require('./modules/log');
const { getContextForRoute } = require('./modules/render-contexts');

const app = new Koa();
const router = new Router();

app.keys = ['freefall is love freefall is life'];

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
  const airports = await db.select('airports');

  await ctx.render('index.html', {
    airports,
    ...await getContextForRoute(ctx, 'get', '/'),
  });
  await next();
});

router.get('/subscribe', async (ctx, next) => {
  const airports = db.select('airports');

  await ctx.render('subscribe.html', {
    airports,
    ...await getContextForRoute(ctx, 'get', '/subscribe'),
  });
  await next();
});

router.get('/unsubscribe', async (ctx) => {
  await ctx.render('unsubscribe.html', await getContextForRoute(ctx, 'get', '/unsubscribe'));
});

router.get('/login', async (ctx) => {
  if (await auth.isLoggedIn(ctx)) {
    log.info('User already logged in. Redirecting to /');
    ctx.redirect('/');
    return;
  }

  await ctx.render('login.html', await getContextForRoute(ctx, 'get', '/login'));
});

router.post('/login', async (ctx) => {
  const { email, password } = ctx.request.body;
  try {
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

  await ctx.render('login.html', await getContextForRoute(ctx, 'post', '/login'));
});

router.get('/logout', async (ctx, next) => {
  auth.logout(ctx);
  ctx.redirect('/');
  await next();
});

router.get('/register', async (ctx) => {
  if (await auth.isLoggedIn(ctx)) {
    ctx.redirect('/');
    return;
  }

  await ctx.render('register.html', await getContextForRoute(ctx, 'get', '/register'));
});

router.post('/register', async (ctx) => {
  if (await auth.isLoggedIn(ctx)) {
    ctx.redirect('/');
    return;
  }

  const errors = [];
  const {
    email,
    password,
    confirm_password: confirmPassword,
  } = ctx.request.body;
  log.info('Attempting to register user with email:', email);

  if (password !== confirmPassword) {
    errors.push('Passwords are not the same.');
  }

  if (await users.fetchUser({ email })) {
    errors.push('Email is already taken');
  }

  if (errors.length === 0) {
    // TODO fix errors in auth and try catch instead of using users.fetchUser
    await auth.register(email, password);
    log.info('Registered user with email and password: ', email, password);
    await auth.login(ctx, email, password);
    ctx.redirect('/');
    return;
  }

  ctx.state.register_errors = errors;
  await ctx.render('register.html', await getContextForRoute(ctx, 'post', '/register'));
});

router.get('/profile', async (ctx) => {
  if (!await auth.isLoggedIn(ctx)) {
    ctx.redirect('/login');
    return;
  }
  await ctx.render('profile.html', await getContextForRoute(ctx, 'get', '/profile'));
});

router.post('/', rpcAPILayer);

router.post('/api/dalipeche', daliPecheAPI);

app.use(router.routes());

app.listen(process.env.FREEFALL_PORT || 3000);
