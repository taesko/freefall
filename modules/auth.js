
const users = require('./users');
const log = require('./log');
const { AppError, assertApp } = require('./error-handling');

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
    throw new AlreadyLoggedIn(`Already logged in.`);
  }
  const user = await users.fetchUser(dbClient, { email, password });

  if (!user) {
    throw new InvalidCredentials(`Failed to login with email=${email} and password=${password}.`);
  }
  const { rows } = await dbClient.executeQuery(
    `
    INSERT INTO login_sessions
      (user_id)
    VALUES
      ($1)
    ON CONFLICT ON CONSTRAINT login_sessions_user_id_key DO
     UPDATE SET expiration_date = current_timestamp + interval '1 day'
    RETURNING *
    `,
    [user.id],
  );
  const { token } = rows[0];

  ctx.session.login_token = token;
  ctx.state.commitDB = true;
  log.info('User with ID ', user.id);
}

function logout (ctx) {
  log.info('Logging out from session:', ctx.session);
  ctx.session.login_token = null;
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
  const token = ctx.session.login_token;

  const { rows } = await ctx.state.dbClient.executeQuery(
    `
      SELECT 1
      FROM login_sessions
      WHERE token=$1 AND expiration_date > current_timestamp
    `,
    [token]
  );
  log.info('USER IS LOGGED IN', rows.length === 1);
  assertApp(rows.length <= 1);

  return rows.length === 1;
}

async function getLoggedInUser (ctx) {
  const { rows } = await ctx.state.dbClient.executeQuery(
    `
      SELECT *
      FROM users 
      WHERE id = (
        SELECT user_id 
        FROM login_sessions
        WHERE token=$1 AND 
          expiration_date > current_timestamp
        )
      AND active=true AND verified=true
    `,
    [ctx.session.login_token]
  );
  assertApp(rows.length <= 1);
  return rows[0];
}

async function tokenHasRole (dbClient, token, role) {
  const user = await users.fetchUser(dbClient, { apiKey: token });

  return role === user.role;
}

module.exports = {
  redirectWhenLoggedOut,
  redirectWhenLoggedIn,
  login,
  logout,
  register,
  getLoggedInUser,
  isLoggedIn,
  UserExists,
  AlreadyLoggedIn,
  InvalidCredentials,
  tokenHasRole,
};
