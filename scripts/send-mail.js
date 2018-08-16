/* eslint-disable camelcase */
const path = require('path');
const { Client } = require('pg');
const mailer = require('nodemailer');
const log = require('../modules/log');
const db = require('../modules/db');
const { assertApp } = require('../modules/error-handling');

const DEFAULT_EMAIL = 'freefall.subscriptions';
const DEFAULT_PASSWORD = 'onetosix';
const FREEFALL_ADDRESS = 'http://10.20.1.128:3000';

const [FREEFALL_MAIL, mailTransporter] = (function init () {
  // TODO get another environment variable for service
  const username = process.env.FREEFALL_EMAIL || DEFAULT_EMAIL; // TODO rename to username
  const password = process.env.FREEFALL_PASSWORD || DEFAULT_PASSWORD;
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
      SELECT DISTINCT 
        users.id, users.email,
        airports_from.name airport_from, airports_to.name airport_to
      FROM users_subscriptions
      JOIN users ON users_subscriptions.user_id = users.id
      JOIN subscriptions ON users_subscriptions.subscription_id = subscriptions.id
      JOIN subscriptions_fetches ON  subscriptions.id = subscriptions_fetches.subscription_id
      JOIN fetches ON subscriptions_fetches.fetch_id = fetches.id
      JOIN airports airports_from ON subscriptions.airport_from_id = airports_from.id
      JOIN airports airports_to ON subscriptions.airport_to_id = airports_to.id
      WHERE 
        fetch_id_of_last_send IS NULL OR
        fetch_id_of_last_send < fetches.id
      ;
  `);

  const { rows: fetchIdRows } = await client.executeQuery(
    `
      SELECT id
      FROM fetches
      ORDER BY fetch_time DESC
      LIMIT 1
    `,
  );

  assertApp(fetchIdRows.length === 1);
  const currentFetchId = fetchIdRows[0].id;
  log.info('Most recent fetch id is: ', currentFetchId);

  const emailsToSend = {};

  for (const { id, email, airport_from, airport_to } of emailRows) {
    emailsToSend[id] = emailsToSend[id] || [];
    emailsToSend[id].push({ id, email, airport_from, airport_to });
  }

  log.info('Emails to send are: ', emailsToSend);

  for (const [id, subscriptions] of Object.entries(emailsToSend)) {
    const email = subscriptions[0].email;
    const content = generateMailContent(subscriptions);

    await client.executeQuery('BEGIN');
    try {
      await sendEmail(email, { text: content });
      log.info(
        'Updating fetch_id_of_last_send of subscriptions of user with email',
        email,
        'to',
        currentFetchId,
      );
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

function generateMailContent (subscriptions) {
  assertApp(Array.isArray(subscriptions), `got ${typeof subscriptions}`);

  const mainContent = subscriptions
    .map(({ airport_from: from, airport_to: to }) => {
      assertApp(typeof from === 'string', `got ${typeof from}`);
      assertApp(typeof to === 'string', `got ${typeof to}`);

      return `${from} -----> ${to}`;
    })
    .join('\n');

  return `We have new information about the following flights:
  ${mainContent}`;
}

async function sendVerificationTokens (client) {
  const { rows } = await client.executeQuery(
    `
      SELECT email, verification_token
      FROM users
      WHERE verified=false
    `
  );

  return Promise.all(rows.map(({ email, verification_token }) => {
    const subject = 'Freefall account activation';
    const route = path.join(FREEFALL_ADDRESS, 'register', 'verify');
    const query = `?token=${verification_token}`;
    const link = route + query;
    const text = `Visit this link here to activate your account:\n${link}.`;

    log.info('Send email for verification of account to', email);
    return sendEmail(email, { subject, text });
  }));
}

async function main () {
  const client = new Client();
  await client.connect();
  const dbClient = db.wrapPgClient(client);
  try {
    await sendVerificationTokens(dbClient);
    await notifyEmails(dbClient);
  } finally {
    client.end();
  }
}

main()
  .catch(reason => log.critical('Failed to notify emails. Reason:', reason));
