const path = require('path');
const Koa = require('koa');
const Router = require('koa-router');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const serve = require('koa-static');
const views = require('koa-views');
const cors = require('@koa/cors');
const session = require('koa-session');
const log = require('./modules/utils');
const auth = require('./modules/auth');
const { getAdminContext } = require('./modules/render-contexts');

const app = new Koa();
const router = new Router();
const SESSION_CONFIG = {
  key: 'koa:sess',
  maxAge: 1000 * 60 * 60 * 24, // 24 hours in miliseconds
};

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (e) {
    log('Unhandled error reached the top layer.', e);
    ctx.status = 500;
    ctx.body = `An unknown error occurred. Please restart the server and refresh the page.\n${e}`;
    ctx.app.emit('error', e, ctx);
  }
});

app.use(logger());

app.use(session(SESSION_CONFIG, app));

app.use(cors({
  origin: '*',
}));

app.use(bodyParser({
  extendTypes: {
    text: ['text/yaml', 'application/json'],
  },
  enableTypes: ['text', 'form'],
}));

app.use(serve(path.join(__dirname, 'admin')));

router.get('/login', async (ctx) => {
  if (await auth.isLoggedIn(ctx)) {
    ctx.redirect('/');
    return;
  }
  return ctx.render('login.html', {});
});

router.post('/login', async (ctx) => {
  try {
    if (ctx.request.body.email !== 'admin@freefall.org') {
      // noinspection ExceptionCaughtLocallyJS
      throw auth.InvalidCredentials('Tried to login with a non-admin account.');
    }
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

  return ctx.redirect('/login', {error_message: ctx.state.login_error_message});
});

router.get('/subscriptions', async (ctx) => {
  return ctx.render('subscriptions.html', getAdminContext('get', '/subscriptions'));
});

router.get('/users', async (ctx) => {
  return ctx.render('users.html', getAdminContext('get', '/users'));
});

router.get('/users/:user_id:', async (ctx) => {
  return ctx.render('user.html', {});
});

router.get('/fetches', async (ctx) => {
  return ctx.render('fetches.html', getAdminContext('get', '/fetches'));
});
