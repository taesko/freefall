const crypto = require('crypto');
const errors = require('./error-handling');
const db = require('./db');
const utils = require('./utils');
const subscriptions = require('./subscriptions');
const log = require('./log');

async function addUser ({ email, password, role }) {
  log.info(`Adding user with email=${email} and role=${role}`);
  errors.assertPeer(
    !await userExists({ email }),
    `Failed adding user, because email ${email} is taken`,
    errors.errorCodes.emailTaken,
  );

  const [user] = await db.selectWhere(
    'users',
    '*',
    { email },
  );

  if (user) {
    log.info(`User with email=${email} was previously registered. Updating his credentials and activating account.`);
    await db.updateWhere(
      'users',
      { password, role, active: 1 },
      { id: user.id },
    );

    return user.id;
  }

  return db.insert(
    'users',
    {
      email,
      password,
      role,
      api_key: generateAPIKey(email, password),
    },
  );
}

async function removeUser (userId) {
  log.info(`Removing user with id=${userId}`);
  await subscriptions.removeAllSubscriptionsOfUser(userId);
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
  const setHash = utils.cleanHash({ email, password, api_key: apiKey });

  log.info(`Updating user with id=${userId}. New columns are going to be: `, setHash);
  if (email) {
    errors.assertPeer(
      await fetchUser({ email }) != null,
      `Cannot update email of ${userId} to ${email} is already taken`,
      errors.errorCodes.emailTaken,
    );
  }
  if (apiKey) {
    errors.assertPeer(
      await fetchUser({ apiKey }) != null,
      `Cannot update api key of user ${userId} to ${apiKey}`,
      errors.errorCodes.apiKeyTaken,
    );
  }

  const user = await fetchUser({ userId });

  errors.assertPeer(
    user,
    `Cannot edit user with id ${userId}`,
    errors.errorCodes.userDoesNotExist,
  );

  const result = await db.updateWhere(
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

/*
  Fetch the unique user from database that has the specified columns.

  If password parameter is given then it must be supplied with an email parameter.
 */
async function fetchUser ({ userId, email, password, apiKey, active = 1 }) {
  if (password) {
    errors.assertApp(
      email,
      'fetchUser - if password parameter is given email must also be provided.',
      errors.errorCodes.badFunctionArgs,
    );
  }

  const whereHash = utils.cleanHash({
    id: userId,
    email,
    password,
    api_key: apiKey,
    active,
  });

  errors.assertApp(
    Object.keys(whereHash).length > 0,
    'fetchUser function requires at least one parameter',
  );

  const [user] = await db.selectWhere('users', '*', whereHash);

  return user;
}

async function listUsers (hidePassword = false) {
  let rows = await db.selectWhere('users', '*', { active: 1 });

  if (hidePassword) {
    rows = rows.map(row => {
      delete row.password;
      return row;
    });
  }

  return rows;
}

async function userExists ({ userId, email, password, apiKey }) {
  return await fetchUser({ userId, email, password, apiKey }) != null;
}

function generateAPIKey (email, password) {
  // TODO ask ivan for filtering logs and trimming passwords
  log.info(`Generating API key for email=${email} and password`);

  return hashToken(`${email}:${password}`);
}

function hashToken (token) {
  return crypto.createHash('md5').update(token).digest('hex');
}

function hashPassword (password) {
  return crypto.createHash('md5').update(password).digest('hex');
}

module.exports = {
  addUser,
  fetchUser,
  editUser,
  removeUser,
  listUsers,
  hashPassword,
};
