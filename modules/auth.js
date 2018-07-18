const { AppError } = require('./error-handling');

class InvalidCredentials extends AppError {}

const users = [
  {
    id: 1,
    email: 'taeskow@gmail.com',
    password: '123456',
  },
];

async function login (ctx, email, password) {
  let user;

  try {
    user = fetchUserByCredentials({ email, password });
  } catch (e) {
    throw new AppError(`Tried to login with email=${email} and password=${password}. But failed checking credentials through database. Error: ${e}`);
  }

  if (!user) {
    throw new InvalidCredentials(`Tried to login with email=${email} and password=${password}.`);
  }

  ctx.session.userID = serializeUser(user);
}

function logout (ctx) {
  ctx.session.userID = null;
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
  return users.find(user => user.id === id);
}

async function fetchUserByCredentials ({ email, password }) {
  return users.find(user => user.email === email && user.password === password);
}

module.exports = {
  login,
  logout,
  getLoggedInUser,
  isLoggedIn,
};
