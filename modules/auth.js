
const users = require('./users');
const log = require('./log');
const { AppError, assertApp } = require('./error-handling');
const { isObject } = require('lodash');

class InvalidCredentials extends AppError {}

class UserExists extends AppError {}

class AlreadyLoggedIn extends AppError {}

const redirectWhenLoggedOut = (redirectRoute) => async (ctx, next) => {
  assertApp(typeof redirectRoute === 'string');
  if (!await isLoggedIn(ctx)) {
    // invalidate cookie because deleted user accounts have a valid id in the database
    // this causes problems like register() method automatically logging them in
    log.info('User is not logged in. Invalidating cookie and redirecting to', redirectRoute);
    ctx.session.userID = null;
    ctx.redirect(redirectRoute);
  } else {
    await next();
  }
};

const redirectWhenLoggedIn = (redirectRoute) => async (ctx, next) => {
  assertApp(typeof redirectRoute === 'string');
  // TODO what happens when a user has a deactivated account that becomes active during
  // await next()
  if (await isLoggedIn(ctx)) {
    log.info('User is logged in. Redirecting to', redirectRoute);
    ctx.redirect(redirectRoute);
  } else {
    await next();
  }
};

async function login (ctx, email, password) {
  const dbClient = ctx.state.dbClient;
  password = users.hashPassword(password);

  log.info('Trying to login with email: ', email);

  if (await isLoggedIn(ctx)) {
    throw new AlreadyLoggedIn(`Already logged in as user with id ${ctx.session.userID}`);
  }
  const user = await users.fetchUser(dbClient, { email, password });

  if (!user) {
    throw new InvalidCredentials(`Failed to login with email=${email} and password=${password}.`);
  }

  ctx.session.userID = serializeUser(user);
  log.info('Logged in as user', user.id);
}

function logout (ctx) {
  log.info('Logging out from session:', ctx.session);
  ctx.session.userID = null;
}

async function register (ctx, email, password) {
  const dbClient = ctx.state.dbClient;

  log.info('Attempting to register user with email:', email);

  // TODO handle empty string email;
  password = users.hashPassword(password);

  log.info(`Checking if email ${email} is taken.`);

  if (await users.emailIsTaken(dbClient, email)) {
    throw new UserExists(`Cannot register a user with the email ${email}, because the email is already in use.`,
      'REGISTER_EMAIL_TAKEN',
    );
  }

  log.info('Registering user with email and password: ', email, password);

  return users.addUser(dbClient, { email, password, role: 'customer' });
}

async function isLoggedIn (ctx) {
  const id = ctx.session.userID;

  return (
    id != null &&
    await users.fetchUser(ctx.state.dbClient, { userId: id }) != null
  );
}

async function getLoggedInUser (ctx) {
  return users.fetchUser(ctx.state.dbClient, { userId: ctx.session.userID });
}

async function hasPermission (dbClient, token, permission) {
  assertApp(typeof permission === 'string', `got ${permission}`);

  const dbResponse = await dbClient.executeQuery(`

    SELECT permissions.name AS permission
    FROM users
    LEFT JOIN users_roles
    ON users_roles.user_id = users.id
    LEFT JOIN roles_permissions
    ON users_roles.role_id = roles_permissions.role_id
    LEFT JOIN permissions
    ON roles_permissions.permission_id = permissions.id
    WHERE users.api_key = $1;

  `, [token]);

  assertApp(isObject(dbResponse), `got ${dbResponse}`);
  assertApp(Array.isArray(dbResponse.rows), `got ${dbResponse.rows}`);

  const userPermissions = dbResponse.rows.map((row) => {
    assertApp(isObject(row), `got ${row}`);
    assertApp(typeof row.permission === 'string', `got ${row.permission}`);

    return row.permission;
  });

  return userPermissions.includes(permission);
}

function serializeUser (user) {
  return user.id;
}

module.exports = {
  redirectWhenLoggedOut,
  redirectWhenLoggedIn,
  login,
  logout,
  register,
  getLoggedInUser,
  isLoggedIn,
  hasPermission,
  UserExists,
  AlreadyLoggedIn,
  InvalidCredentials,
};
