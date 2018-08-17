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

  return dbClient.insert(
    'users',
    {
      email,
      password,
      role,
      api_key: generateAPIKey(email, password),
      active: false,
      verified: false,
      verification_token: generateVerificationToken(email, password),
    },
  );
}

async function reactivateUser (dbClient, userId) {
  const { rowCount } = await dbClient.executeQuery(
    `
      UPDATE users
      SET active=true
      WHERE id=$1 AND verified=true
    `,
    [userId],
  );
  errors.assertPeer(rowCount === 1, `got ${rowCount}`, 'USER_WAS_NOT_DEACTIVATED');
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

async function emailActivateUserAccount (dbClient, verificationToken) {
  const { rowCount } = await dbClient.executeQuery(
    `
      UPDATE users
      SET verified=true, active=true
      WHERE verification_token=$1 AND verified=false AND active=false -- do not reactivate deleted user accounts through the token
    `,
    [verificationToken],
  );

  errors.assertApp(rowCount <= 1, `got ${rowCount}`);
  errors.assertPeer(rowCount === 1, `got ${rowCount}`, 'INVALID_VERIFICATION_TOKEN');
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
  errors.assertApp(_.isObject(dbClient), `got ${dbClient}`);
  errors.assertApp(email == null || typeof email === 'string', `got ${email}`);
  errors.assertApp(password == null || typeof password === 'string', `got ${password}`);
  errors.assertApp(apiKey == null || typeof apiKey === 'string', `got ${apiKey}`);
  errors.assertApp(active == null || typeof active === 'boolean', `got ${active}`);

  if (password) {
    errors.assertApp(
      email != null,
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

async function listUsers (dbClient, limit, offset, hidePassword = false) {
  errors.assertApp(_.isObject(dbClient), `got ${typeof dbClient} but expected object`);

  errors.assertApp(typeof limit === 'number', `got ${limit}`);
  errors.assertApp(typeof offset === 'number', `got ${offset}`);

  let result = await dbClient.executeQuery(`

    SELECT *
    FROM users
    WHERE active = true
    ORDER BY id
    LIMIT $1
    OFFSET $2;

  `, [limit, offset]);

  errors.assertApp(_.isObject(result), `got ${result}`);
  errors.assertApp(Array.isArray(result.rows), `got ${result.rows}`);

  if (hidePassword) {
    result.rows = result.rows.map(row => {
      delete row.password;
      return row;
    });
  }

  return result.rows;
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

async function emailIsTaken (dbClient, email) {
  errors.assertApp(_.isObject(dbClient), `got ${dbClient}`);
  errors.assertApp(typeof email === 'string', `got ${email}`);

  const pgResult = await dbClient.executeQuery(
    `
      SELECT 1
      FROM users
      WHERE email=$1
    `,
    [email],
  );

  log.debug('emailIsTaken query result is: ', pgResult.rowCount, pgResult.rows);
  return pgResult.rowCount === 1;
}

function generateAPIKey (email, password) {
  // TODO ask ivan for filtering logs and trimming passwords
  log.info(`Generating API key for email=${email} and password`);

  return hashToken(`${email}:${password}`);
}

function generateVerificationToken (email, password) {
  return hashToken(`${email}:${password}:verification_token`);
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
  emailIsTaken,
  emailActivateUserAccount,
  hashPassword,
};
