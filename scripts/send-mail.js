const { Client } = require('pg');
const mailer = require('nodemailer');
const log = require('../modules/log');
const db = require('../modules/db');
const { assertApp } = require('../modules/error-handling');

const [FREEFALL_MAIL, mailTransporter] = (function init () {
  // TODO get another environment variable for service
  const username = process.env.FREEFALL_EMAIL; // TODO rename to username
  const password = process.env.FREEFALL_PASSWORD;
  assertApp(
    username && password,
    `Cannot send email if the FREEFALL_EMAIL and FREEFALL_PASSWORD variables are not set.`,
  );
  return [
    `${username}@gmail.com`,
    mailer.createTransport({
      service: 'gmail',
      auth: {
        user: username,
        pass: password,
      },
    }),
  ];
})();

async function sendEmail (destinationEmail, {
  subject = 'Freefall subscriptions',
  text = `A flight has been found that might be to your liking. Head over to our site to check it out.`,
}) {
  const mail = {
    from: `Freefall solutions <${FREEFALL_MAIL}>`,
    to: destinationEmail,
    subject,
    text,
  };

  return new Promise((resolve, reject) => {
    mailTransporter.sendMail(mail, (error, response) => {
      if (error) {
        log.warn('Got error response for email', mail, 'Error:', error);
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
}

async function notifyEmails (client) {
  const { rows: emailRows } = await client.executeQuery(`
      SELECT users.id, users.email
      FROM users_subscriptions
      JOIN users ON users_subscriptions.user_id = users.id
      JOIN subscriptions ON users_subscriptions.subscription_id = subscriptions.id
      JOIN subscriptions_fetches ON  subscriptions.id = subscriptions_fetches.subscription_id
      WHERE 
        fetch_id_of_last_send IS NULL OR
        fetch_id_of_last_send < subscriptions_fetches.fetch_id
      ;
  `);

  const { rows: fetchIdRows } = await client.executeQuery(
    `
      SELECT id
      FROM fetches
      ORDER BY fetch_time
      LIMIT 1
    `
  );
  assertApp(fetchIdRows.length === 1);
  const currentFetchId = fetchIdRows[0].id;
  log.info('Most recent fetch id is: ', currentFetchId);

  for (const {id, email} of emailRows) {
    await client.executeQuery('BEGIN');
    try {
      await sendEmail(email, {});
      log.info('Updating fetch_id_of_last_send of subscriptions of user with email', email);
      await client.executeQuery(
        `
          UPDATE users_subscriptions
          SET fetch_id_of_last_send = $1
          WHERE users_subscriptions.user_id = $2
        `,
        [currentFetchId, id],
      );
      await client.executeQuery('COMMIT');
    } catch (e) {
      log.critical(`Couldn't send notification to email ${email}. Reason:`, e);
      await client.executeQuery('ROLLBACK');
    }
  }
}

async function main () {
  const client = new Client();
  await client.connect();
  try {
    await notifyEmails(db.wrapPgClient(client));
  } finally {
    client.end();
  }
}

main()
  .catch(reason => log.critical('Failed to notify emails. Reason:', reason));
