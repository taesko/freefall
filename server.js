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
const { rpcAPILayer } = require('./modules/api');
const { log } = require('./modules/utils');
const { getContextForRoute } = require('./modules/render-contexts');

const app = new Koa();
const router = new Router();

app.keys = ['freefall is love freefall is life'];

app.on('error', (err, ctx) => {
  log(err);
  log('context of app is: ', ctx);
});

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.body = 'Our servers our currently experiencing problems. Please try again later.';
  }
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
  const airports = await db.select('airports', ['id', 'iata_code', 'name']);
  await ctx.render('index.html', {
    airports,
    ...await getContextForRoute(ctx, 'get', '/'),
  });
  await next();
});

router.get('/subscribe', async (ctx, next) => {
  const airports = db.select('airports', ['id', 'iata_code', 'name']);
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
  log('getting login page.');
  if (await auth.isLoggedIn(ctx)) {
    log('User already logged in. Redirecting to /');
    ctx.redirect('/');
    return;
  }

  await ctx.render('login.html', await getContextForRoute(ctx, 'get', '/login'));
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
  log('Attempting to register user with credentials:', ctx.request.body);

  const errors = [];
  const {
    email,
    password,
    confirm_password: confirmPassword,
  } = ctx.request.body;

  if (password !== confirmPassword) {
    errors.push('Passwords are not the same.');
  }

  if (await auth.emailIsRegistered(email)) {
    errors.push('Email is already taken');
  }

  if (errors.length === 0) {
    await auth.register(email, password);
    await auth.login(ctx, email, password);
    ctx.redirect('/');
    return;
  }

  ctx.state.register_errors = errors;
  await ctx.render('register.html', await getContextForRoute(ctx, 'post', '/register'));
});

router.get('/profile', async (ctx) => {
  await ctx.render('profile.html', await getContextForRoute(ctx, 'get', '/profile'));
});

router.post('/', rpcAPILayer);

app.use(router.routes());

app.listen(process.env.FREEFALL_PORT || 3000);

// console.log('Listening on 3000...');
