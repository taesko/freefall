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
addContextForRoute('get', '/register/password-reset', passwordResetPageContext);
addContextForRoute('post', '/register/password-reset', passwordResetPageContext);
addContextForRoute('get', '/profile', profilePageContext);

const adminContextFunctions = {};
const addAdminContext = defineContextAdder(adminContextFunctions);

addAdminContext('get', '/login', loginPageContext);
addAdminContext('get', '/transfers', accountTransfersContext);
addAdminContext('get', '/roles', rolesPageContext);
addAdminContext('get', '/fetches', fetchesPageContext);
addAdminContext('get', '/subscriptions', subscriptionsPageContext);
addAdminContext('get', '/users', usersPageContext);
addAdminContext('get', '/roles/:role_id', rolePageContext);

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
    errors: appCtx.errors,
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

function passwordResetPageContext (appCtx) {
  const errors = appCtx.state.password_reset_errors || [];
  const messages = appCtx.state.password_reset_messages || [];
  return { error_message: errors.concat(messages).join('\n') };
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

function fetchesPageContext () {
  return {
    item: 'fetches',
  };
}

function subscriptionsPageContext () {
  return {
    item: 'subscriptions',
  };
}

function usersPageContext () {
  return {
    item: 'users',
  };
}

function rolesPageContext () {
  return {
    item: 'roles',
  };
}

function rolePageContext () {
  return {
    item: 'role',
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
};
