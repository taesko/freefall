const { AppError } = require('./error-handling');
const { log } = require('./utils');
const passport = require('passport');

const users = [
  {
    id: 1,
    email: 'taeskow@gmail.com',
    password: '123456',
  },
];

async function fetchUserByCredentials ({ email, password }) {
  return users.find(user => user.email === email && user.password === password);
}

async function fetchUserById (id) {
  return users.find(user => user.id === id);
}

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  let user;

  try {
    user = await fetchUserById(id);
  } catch (e) {
    log('Tried to deserializeUser but couldn\'t fetch user by id: ', id);
    done(e);
  }

  if (!user) {
    done(new AppError(
      `Couldn't deserialize user by id ${id}. There is no user with this id`,
    ));
  } else {
    done(null, user);
  }
});

const LocalStrategy = require('passport-local').Strategy;

passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password',
    session: false, // TODO flip when using koa-session
  },
  async (email, password, done) => {
    // can this even be async ?
    let user;

    try {
      user = await fetchUserByCredentials({ email: email, password: password });
    } catch (e) {
      log(`Tried to execute LocalStrategy for params email=${email} and password=${password}. But fetchUserByCredentials failed`);
      done(e);
    }

    if (user) {
      done(null, user);
    } else {
      done(null, false); // why false ?
    }
  },
));