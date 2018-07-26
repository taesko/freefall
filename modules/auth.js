const crypto = require('crypto');
const db = require('./db');
const { AppError } = require('./error-handling');
const log = require('./log');

class InvalidCredentials extends AppError {}

class UserExists extends AppError {}

class AlreadyLoggedIn extends AppError {}

const USER_ROLES = {
  admin: 'admin',
  user: 'user',
};

db.dbConnect();

async function login (ctx, email, password) {
  log.info('Trying to login with email: ', email);

  if (await isLoggedIn(ctx)) {
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
  log.info('Logged in as user', user);
}

function logout (ctx) {
  log.info('Logging out from session:', ctx.session);
  ctx.session.userID = null;
}

async function register (email, password) {
  if (await fetchUserByCredentials({ email, password })) {
    throw new UserExists(`Cannot register a user with the email ${email}, because the email is already in use.`);
  }

  const apiKey = hashToken(`${email}:${password}`);

  try {
    await db.insert(
      'users',
      {
        email,
        password: hashPassword(password),
        api_key: apiKey,
        role: USER_ROLES.user,
      },
    );
  } catch (e) {
    log.info(`Couldn't register user with email=${email}.`);
    throw e;
  }
}

async function isLoggedIn (ctx) {
  const id = ctx.session.userID;
  return id != null && await fetchUserById(id) != null;
}

async function getLoggedInUser (ctx) {
  return fetchUserById(ctx.session.userID);
}

async function tokenHasRole (token, role) {
  const [user] = await db.selectWhere(
    'users',
    '*',
    { api_key: token, role },
  );

  return !!user;
}

function serializeUser (user) {
  return user.id;
}

async function fetchUserByAPIKey (token) {
  const [user] = await db.selectWhere(
    'users',
    '*',
    { api_key: token },
  );

  return user;
}

async function fetchUserById (id) {
  const [user] = await db.selectWhere('users', '*', { id });
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
    [email, hashPassword(password)],
  );
  return user;
}

async function emailIsRegistered (email) {
  const result = await db.selectWhere('users', '*', { email });
  return result.length !== 0;
}

module.exports = {
  login,
  logout,
  register,
  emailIsRegistered,
  getLoggedInUser,
  isLoggedIn,
  fetchUserByAPIKey,
  fetchUserById,
  tokenHasRole,
  hashPassword,
  UserExists,
  AlreadyLoggedIn,
  InvalidCredentials,
};
