const auth = require('./auth');

function defaultContext (appCtx) {
  if (auth.isLoggedIn(appCtx)) {
    const { email } = auth.getLoggedInUser(appCtx);

    return {
      username: email,
    };
  }

  return {};
}

function loginPageContext (appCtx) {
  const context = { item: 'login' };

  context.error_message = appCtx.state.login_error_message || '';

  return context;
}

function getContextForRoute (appCtx, route, request = 'get') {
  // TODO use a hash with decorators
  if (route === '/login') {
    return Object.assign(
      defaultContext(appCtx),
      loginPageContext(appCtx),
    );
  } else {
    return defaultContext(appCtx);
  }
}

module.exports = {
  getContextForRoute,
};
