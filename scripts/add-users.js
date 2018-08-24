const log = require('../modules/log');
const users = require('../modules/users');
const accounting = require('../modules/accounting');
const db = require('../modules/db');

const TEST_CREDITS = 2000;
const demoUsers = [
  { email: 'antonio@freefall.org', password: 'onetosix' },
  { email: 'hristo@freefall.org', password: 'onetosix' },
];

async function main () {
  const pgClient = await db.pool.connect();
  const client = db.wrapPgClient(pgClient);

  await client.executeQuery('BEGIN');

  try {
    for (const credentials of demoUsers) {
      const { email } = credentials;
      const password = users.hashPassword(credentials.password);
      const user = await users.addUser(client, { email, password });
      await accounting.depositCredits(client, user.id, TEST_CREDITS);
    }

    await client.executeQuery('COMMIT');
  } catch (e) {
    log.critical('ROLLING BACK.');
    await client.executeQuery('ROLLBACK');
    throw e;
  } finally {
    pgClient.release();
  }
}

main()
  .then(() => log.info('Inserted users: ', demoUsers))
  .catch(reason => {
    log.critical('Script failed due to error - ', reason);
  });
