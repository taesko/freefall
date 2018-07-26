const crypto = require('crypto');
const errors = require('error-handling');
const db = require('db');
const utils = require('utils');

async function addUser (email, password, role) {
  errors.assertPeer(
    !userExists(email),
    `Failed adding user, because email ${email} is taken`,
    errors.errorCodes.emailTaken,
  );

  return db.insert(
    'users',
    {
      email,
      password: hashPassword(password),
      role,
    },
  );
}

async function removeUser (userId) {
  const result = await db.updateWhere(
    'users',
    { active: 0 },
    { id: userId },
  );

  errors.assertPeer(
    result.stmt.changes > 0,
    `Cannot remove user with id ${userId}`,
    errors.errorCodes.userDoesNotExist,
  );
}

async function editUser (userId, { email, password, apiKey }) {
  errors.assertPeer(
    email && await fetchUser({ email }) != null,
    `Cannot update email of ${userId} to ${email} is already taken`,
    errors.errorCodes.emailTaken,
  );
  errors.assertPeer(
    apiKey && await fetchUser({ apiKey }) != null,
    `Cannot update api key of user ${userId} to ${apiKey}`,
    errors.errorCodes.apiKeyTaken,
  );

  const user = await fetchUser({ userId });

  errors.assertPeer(
    user,
    `Cannot edit user with id ${userId}`,
    errors.errorCodes.userDoesNotExist,
  );

  const setHash = utils.cleanHash({ email, password, apiKey, });
  const result = db.updateWhere(
    'users',
    setHash,
    { id: userId },
  );

  errors.assertApp(
    result.stmt.changes > 0,
    `Cannot edit user with id ${userId}`,
    errors.errorCodes.databaseError,
  );
}

async function userExists (email) {
  const [exists] = await db.selectWhere('users', '*', { email });

  return !!exists;
}

async function fetchUser ({ userId, email, password, apiKey }) {
  let whereHash = {};

  if (userId) {
    whereHash.id = userId;
  }
  if (email) {
    whereHash.email = email;
  }
  if (password) {
    whereHash.password = password;
  }
  if (apiKey) {
    whereHash.api_key = apiKey;
  }

  errors.assertApp(
    Object.keys(whereHash).length > 0,
    'fetchUser function requires at least one parameter',
  );

  const [user] = db.selectWhere('user', '*', whereHash);

  return user;
}

async function listUsers (hidePassword = false) {
  let rows = await db.select('users');

  if (hidePassword) {
    rows = rows.map(row => {
      delete row.password;
      return row;
    });
  }

  return rows;
}

function generateAPIKey (email, password) {
  return hashToken(`${email}:${password}`);
}

function hashToken (token) {
  return crypto.createHash('md5').update(token).digest('hex');
}

function hashPassword (password) {
  return crypto.createHash('md5').update(password).digest('hex');
}
