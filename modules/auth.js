const users = require('./users');
const log = require('./log');
const { AppError } = require('./error-handling');

class InvalidCredentials extends AppError {}

class UserExists extends AppError {}

class AlreadyLoggedIn extends AppError {}

async function login (ctx, email, password) {
  password = users.hashPassword(password);

  log.info('Trying to login with email: ', email);

  if (await isLoggedIn(ctx)) {
    throw new AlreadyLoggedIn(`Already logged in as user with id ${ctx.session.userID}`);
  }
  const user = await users.fetchUser({ email, password });

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

async function register (email, password) {
  password = users.hashPassword(password);
  if (await users.fetchUser({ email, password })) {
    throw new UserExists(`Cannot register a user with the email ${email}, because the email is already in use.`);
  }

  await users.addUser({ email, password, role: 'user' }); // TODO magic value
}

async function isLoggedIn (ctx) {
  const id = ctx.session.userID;
  return id != null && await users.fetchUser({ userId: id }) != null;
}

async function getLoggedInUser (ctx) {
  return users.fetchUser({ userId: ctx.session.userID });
}

async function tokenHasRole (token, role) {
  const user = await users.fetchUser({ apiKey: token });

  return role === user.role;
}

function serializeUser (user) {
  return user.id;
}

module.exports = {
  login,
  logout,
  register,
  getLoggedInUser,
  isLoggedIn,
  tokenHasRole,
  UserExists,
  AlreadyLoggedIn,
  InvalidCredentials,
};
