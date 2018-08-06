const log = require('./log');
const auth = require('./auth');

const mainContextFunctions = {};
const addContextForRoute = defineContextAdder(mainContextFunctions);

addContextForRoute('get', '/', indexPageContext);
addContextForRoute('get', '/subscribe', subscribePageContext);
addContextForRoute('get', '/unsubscribe', unsubscribePageContext);
addContextForRoute('get', '/login', loginPageContext);
addContextForRoute('post', '/login', loginPageContext);
addContextForRoute('get', '/register', registerPageContext);
addContextForRoute('post', '/register', registerPageContext);
addContextForRoute('get', '/profile', profilePageContext);
addContextForRoute('get', '/transfers', accountTransfersContext);

const adminContextFunctions = {};
const addAdminContext = defineContextAdder(adminContextFunctions);

addAdminContext('get', '/login', loginPageContext);

async function defaultContext (appCtx) {
  if (await auth.isLoggedIn(appCtx)) {
    const user = await auth.getLoggedInUser(appCtx);

    delete user.password;

    return { user };
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
  let errMsg;

  if (appCtx.state.register_errors) {
    errMsg = appCtx.state.register_errors.join('\n');
  } else {
    errMsg = '';
  }

  return {
    item: 'register',
    error_message: errMsg,
  };
}

function profilePageContext () {
  return {
    item: 'profile',
  };
}

function accountTransfersContext () {
  return {
    item: 'transfers',
  };
}

function defineContextAdder (contextFunctions) {
  return (request, route, ...functions) => {
    request = request.toUpperCase();
    route = route.toLowerCase();

    log.info(
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
  };
}

function defineContext (contextFunctions) {
  return async (appCtx, request, route) => {
    // TODO use a hash with decorators
    let context = await defaultContext(appCtx);

    request = request.toUpperCase();
    route = route.toLowerCase();

    if (
      contextFunctions[route] == null ||
      contextFunctions[route][request] == null
    ) {
      log.debug('Missing context function for', request, '-', route, 'using default:', context);
      return context;
    }

    for (const getContext of contextFunctions[route][request]) {
      context = Object.assign(context, await getContext(appCtx));
    }
    log.debug('Context for request/route', request, '-', route, 'is', context);
    return context;
  };
}

module.exports = {
  getContextForRoute: defineContext(mainContextFunctions),
  getAdminContext: defineContext(adminContextFunctions),
};
