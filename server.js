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
const { escape } = require('lodash');

const app = new Koa();
const router = new Router();

app.keys = ['freefall is love freefall is life'];

app.use(async (ctx, next) => {
  log.debug('GOT REQUEST', ctx.request);
  await next();
  log.debug('SENDING BACK RESPONSE', ctx.response);
});

app.use(async (ctx, next) => {
  ctx.state.errorResponseIsSet = false;
  try {
    await next();
  } catch (err) {
    if (!ctx.state.errorResponseIsSet) {
      ctx.status = 500;
      ctx.body = 'Our servers our currently experiencing problems. Please try again later.';
    }
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

app.use(db.client);
app.use(db.session);

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
  try {
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
  log.info('Attempting to register user with email:', email);

  if (password !== confirmPassword) {
    errors.push('Passwords are not the same.');
  }

  if (await users.userExists(ctx.state.dbClient, { email })) {
    errors.push('Email is already taken');
  }

  if (errors.length === 0) {
    // TODO fix errors in auth and try catch instead of using users.fetchUser
    await auth.register(ctx, email, password);
    log.info('Registered user with email and password: ', email, password);
    await auth.login(ctx, email, password);
    ctx.redirect('/');
    return;
  }

  ctx.state.register_errors = errors;
  await ctx.render('register.html', await getContextForRoute(ctx, 'post', '/register'));
});

router.get('/profile', auth.redirectWhenLoggedOut('/login'), async (ctx) => {
  await ctx.render('profile.html', await getContextForRoute(ctx, 'get', '/profile'));
});

router.post('/', rpcAPILayer);

router.post('/api/dalipeche', daliPecheAPI);

app.use(router.routes());

app.listen(process.env.FREEFALL_PORT || 3000);
