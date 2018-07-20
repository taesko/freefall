const { log } = require('./utils');
const auth = require('./auth');

const contextFunctions = {};

addContextForRoute('get', '/', indexPageContext);
addContextForRoute('get', '/subscribe', subscribePageContext);
addContextForRoute('get', '/unsubscribe', unsubscribePageContext);
addContextForRoute('get', '/login', loginPageContext);
addContextForRoute('post', '/login', loginPageContext);
addContextForRoute('get', '/register', registerPageContext);
addContextForRoute('post', '/register', registerPageContext);
addContextForRoute('get', '/profile', profilePageContext);

async function defaultContext (appCtx) {
  if (auth.isLoggedIn(appCtx)) {
    const { email } = await auth.getLoggedInUser(appCtx);

    return {
      username: email,
    };
  }

  return {};
}

function indexPageContext () {
  return {
    item: 'search',
  };
}

function subscribePageContext () {
  return {
    item: 'subscribe',
  };
}

function unsubscribePageContext () {
  return {
    item: 'unsubscribe',
  };
}

function loginPageContext (appCtx) {
  return {
    item: 'login',
    error_message: appCtx.state.login_error_message || '',
  };
}

function registerPageContext (appCtx) {
  return {
    item: 'register',
    error_messages: appCtx.state.register_errors,
  };
}

async function profilePageContext (appCtx) {
  const user = await auth.getLoggedInUser(appCtx);
  const context = {
    item: 'profile',
  };

  if (user) {
    delete user.password;
    context.user = user;
  }

  return context;
}

function addContextForRoute (request, route, ...functions) {
  request = request.toUpperCase();
  route = route.toLowerCase();

  log(
    'Adding context functions', functions,
    'for request', request,
    'on route', route,
  );

  if (contextFunctions[route] == null) {
    contextFunctions[route] = {};
  }

  if (contextFunctions[route][request] == null) {
    contextFunctions[route][request] = [];
  }

  contextFunctions[route][request].push(...functions);
}

async function getContextForRoute (appCtx, request, route) {
  // TODO use a hash with decorators
  let context = await defaultContext(appCtx);

  request = request.toUpperCase();
  route = route.toLowerCase();

  if (
    contextFunctions[route] == null ||
    contextFunctions[route][request] == null
  ) {
    log('Missing context function for', request, '-', route, 'using default:', context);
    return context;
  }

  for (const getContext of contextFunctions[route][request]) {
    context = Object.assign(context, await getContext(appCtx));
  }
  log('Context for request/route', request, '-', route, 'is', context);
  return context;
}

module.exports = {
  getContextForRoute,
};
