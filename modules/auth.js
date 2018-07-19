const db = require('./db');
const { AppError } = require('./error-handling');
const { log } = require('./utils');

class InvalidCredentials extends AppError {}

class UserExists extends AppError {}

class AlreadyLoggedIn extends AppError {}

db.dbConnect();

async function login (ctx, email, password) {
  log('Trying to login with credentials: ', email, password);

  if (ctx.session.userID != null) {
    throw new AlreadyLoggedIn(`Already logged in as user with id ${ctx.session.userID}`);
  }
  let user;

  try {
    user = await fetchUserByCredentials({ email, password });
  } catch (e) {
    throw new AppError(`Tried to login with email=${email} and password=${password}. But failed checking credentials through database. ${e}`);
  }

  if (!user) {
    throw new InvalidCredentials(`Failed to login with email=${email} and password=${password}.`);
  }

  ctx.session.userID = serializeUser(user);
  log('Logged in as user', user);
}

function logout (ctx) {
  log('Logging out from session:', ctx.session);
  ctx.session.userID = null;
}

async function register (email, password) {
  if (await fetchUserByCredentials({ email, password })) {
    throw new UserExists(`Cannot register a user with the email ${email}, because the email is already in use.`);
  }

  try {
    await db.insert('users', { email, password });
  } catch (e) {
    log(`Couldn't register user with credentials email=${email} password=${password}. ${e}`);
    throw e;
  }
}

function isLoggedIn (ctx) {
  return ctx.session.userID != null;
}

async function getLoggedInUser (ctx) {
  return fetchUserById(ctx.session.userID);
}

function serializeUser (user) {
  return user.id;
}

async function fetchUserById (id) {
  const [user] = await db.selectWhere('users', ['id', 'email', 'password'], { id });
  return user;
}

async function fetchUserByCredentials ({ email, password }) {
  const [user] = await db.executeAll(
    `
    SELECT *
    FROM users
    WHERE email=? AND password=?
    ;
    `,
    [email, password],
  );
  return user;
}

async function emailIsRegistered (email) {
  const result = await db.selectWhere('users', ['email'], { email });
  return result.length !== 0;
}

module.exports = {
  login,
  logout,
  register,
  emailIsRegistered,
  getLoggedInUser,
  isLoggedIn,
  UserExists,
  AlreadyLoggedIn,
  InvalidCredentials,
};
