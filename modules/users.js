const _ = require('lodash');
const crypto = require('crypto');

const errors = require('./error-handling');
const utils = require('./utils');
const subscriptions = require('./subscriptions');
const log = require('./log');

/*
  Users are never deleted from the database but this should be transparent to the code
  that uses this module. Therefore addUser will either insert a new user account or reactive dead
  ones. But it will never overwrite an active one.

  TODO perhaps reactivating old users should be limited to admins only.
 */
async function addUser (dbClient, { email, password, role = 'customer' }) {
  errors.assertApp(_.isObject(dbClient), `got ${typeof dbClient} but expected object`);
  errors.assertApp(typeof email === 'string', `got ${typeof email} but expected string`);
  errors.assertApp(typeof password === 'string', `got ${typeof password} but expected string`);

  log.info(`Adding user with email=${email} and role=${role}`);

  errors.assertPeer(email.length >= 3, 'bad email.', 'FF_SHORT_EMAIL');
  errors.assertPeer(password.length >= 8, 'bad password.', 'FF_SHORT_PASSWORD');
  errors.assertPeer(
    !await userExists(dbClient, { email }),
    `Failed adding user, because email ${email} is taken`,
    errors.errorCodes.emailTaken,
  );

  const [user] = await dbClient.selectWhere(
    'users',
    '*',
    { email },
  );

  if (user) {
    log.info(`User with email=${email} was previously registered. Updating his credentials and activating account.`);
    await dbClient.updateWhere(
      'users',
      { password, role, active: true },
      { id: user.id },
    );

    return user.id;
  }

  return dbClient.insert(
    'users',
    {
      email,
      password,
      role,
      api_key: generateAPIKey(email, password),
    },
  );
}

async function removeUser (dbClient, userId) {
  errors.assertApp(_.isObject(dbClient), `got ${typeof dbClient} but expected object`);
  errors.assertApp(typeof userId === 'number');
  // hard coded admin user
  errors.assertPeer(userId !== 1, 'Cannot remove main admin account.');

  log.info(`Removing user with id=${userId}`, typeof userId);
  await subscriptions.removeAllSubscriptionsOfUser(dbClient, userId);
  const result = await dbClient.updateWhere(
    'users',
    { active: false },
    { id: userId },
  );

  errors.assertPeer(
    result.length !== 0,
    `Cannot remove user with id ${userId}`,
    errors.errorCodes.userDoesNotExist,
  );
  errors.assertApp(
    result.length === 1,
    'Removed too much users',
  );
}

async function editUser (dbClient, userId, { email, password, apiKey }) {
  errors.assertApp(_.isObject(dbClient), `got ${typeof dbClient} but expected object`);
  errors.assertApp(
    email != null || password != null || apiKey != null,
    `third argument to editUser does not have any of the required fields.`,
  );

  const setHash = utils.cleanHash({ email, password, api_key: apiKey });
  const user = await fetchUser(dbClient, { userId });

  errors.assertPeer(
    user != null,
    'tried to edit user that did not exist',
    errors.errorCodes.userDoesNotExist,
  );

  log.info(`Updating user with id=${userId}. New columns are going to be: `, setHash);

  if (email && email !== user.email) {
    errors.assertPeer(
      !await anyUserExists(dbClient, { email }),
      `Cannot update email of ${userId} to ${email} - email is already taken`,
      errors.errorCodes.emailTaken,
    );
  }
  if (apiKey && apiKey !== user.api_key) {
    errors.assertPeer(
      !await anyUserExists(dbClient, { apiKey }),
      `Cannot update api key of user ${userId} to ${apiKey} - API key is taken`,
      errors.errorCodes.apiKeyTaken,
    );
  }

  errors.assertPeer(
    user,
    `Cannot edit user with id ${userId}`,
    errors.errorCodes.userDoesNotExist,
  );

  const result = await dbClient.updateWhere(
    'users',
    setHash,
    { id: userId },
  );

  errors.assertApp(result.length <= 1, 'Edited too many users.');
  errors.assertApp(
    result.length === 1,
    `Cannot edit user with id ${userId}`,
    errors.errorCodes.databaseError,
  );
}

/*
  Fetch the unique user from database that has the specified columns.

  If password parameter is given then it must be supplied with an email parameter.
 */
async function fetchUser (
  dbClient,
  {
    userId,
    email,
    password,
    apiKey,
    active = true,
  }) {
  errors.assertApp(_.isObject(dbClient), `got ${typeof dbClient} but expected object`);
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
    Object.keys(whereHash).length > 1,
    'fetchUser function requires at least one parameter',
  );

  const [user] = await dbClient.selectWhere('users', '*', whereHash);

  log.debug('Fetched user', user);

  return user;
}

async function listUsers (dbClient, hidePassword = false) {
  errors.assertApp(_.isObject(dbClient), `got ${typeof dbClient} but expected object`);
  let rows = await dbClient.selectWhere('users', '*', { active: true });

  if (hidePassword) {
    rows = rows.map(row => {
      delete row.password;
      return row;
    });
  }

  return rows;
}

async function userExists (
  dbClient,
  {
    userId,
    email,
    password,
    apiKey,
  }) {
  errors.assertApp(_.isObject(dbClient), `got ${typeof dbClient} but expected object`);
  return await fetchUser(dbClient, { userId, email, password, apiKey }) != null;
}

async function inactiveUserExists (
  dbClient,
  {
    userId,
    email,
    password,
    apiKey,
  }) {
  errors.assertApp(_.isObject(dbClient), `got ${typeof dbClient} but expected object`);
  return await fetchUser(
    dbClient,
    {
      userId,
      email,
      password,
      apiKey,
      active: false,
    },
  ) != null;
}

async function anyUserExists (dbClient, { userId, email, password, apiKey }) {
  const active = await userExists(
    dbClient,
    {
      userId,
      email,
      password,
      apiKey,
    },
  );
  const inactive = await inactiveUserExists(
    dbClient,
    {
      userId,
      email,
      password,
      apiKey,
    },
  );

  return active || inactive;
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
  userExists,
  hashPassword,
};
