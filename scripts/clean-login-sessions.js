const { Client } = require('pg');
const log = require('../modules/log');
const db = require('../modules/db');

async function start () {
  log.info('Starting cleanup of login sessions.');
  const client = new Client();
  await client.connect();
  const dbClient = db.wrapPgClient(client);
  try {
    await dbClient.executeQuery(
      `
        DELETE FROM login_sessions
        WHERE expiration_date < current_timestamp
      `
    );
  } finally {
    client.end();
  }
}

start().then(() => {
  log.info('Finished cleaning expired login sessions.');
}).catch(log.error);
