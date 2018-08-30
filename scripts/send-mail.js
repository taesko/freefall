/* eslint-disable camelcase */
const path = require('path');
const { Client } = require('pg');
const mailer = require('nodemailer');
const log = require('../modules/log');
const db = require('../modules/db');
const moment = require('moment');
const { assertApp } = require('../modules/error-handling');

const DEFAULT_EMAIL = 'freefall.subscriptions';
const DEFAULT_PASSWORD = 'onetosix';
const FREEFALL_ADDRESS = '10.20.1.128:3000';
const TODAY = moment();
const NOTIFY_UNTIL_DATE = moment().add(7, 'days');

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
        airports_from.name airport_from, airports_to.name airport_to,
        users_subscriptions.date_from
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

  if (fetchIdRows.length === 0) { // we haven't fetched data yet.
    log.info('Database does not contain any fetched data yet.');
    return;
  }

  assertApp(fetchIdRows.length === 1, `got ${fetchIdRows}`);
  const currentFetchId = fetchIdRows[0].id;
  log.info('Most recent fetch id is: ', currentFetchId);

  const emailsToSend = {};

  for (const { id, email, airport_from, airport_to, date_from } of emailRows) {
    if (
      moment(date_from).format('YYYY-MM-DD') >= TODAY.format('YYYY-MM-DD') &&
      moment(date_from).format('YYYY-MM-DD') <= NOTIFY_UNTIL_DATE.format('YYYY-MM-DD')
    ) {
      emailsToSend[id] = emailsToSend[id] || [];
      emailsToSend[id].push({ id, email, airport_from, airport_to });
    }
  }

  log.info('Notification emails to send are: ', emailsToSend);

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
    .join('\n\t');

  return `Come visit our site at ${FREEFALL_ADDRESS} to see new information about the following flights:\n\t${mainContent}`;
}

async function sendVerificationTokens (client) {
  const tokensExpiredBefore = moment().subtract(1, 'days');
  await client.executeQuery(
    `
    DELETE FROM users
    WHERE verified=false AND created_at < $1
    `,
    [tokensExpiredBefore]
  );
  const { rows } = await client.executeQuery(
    `
    SELECT email, verification_token
    FROM users
    WHERE verified=false and sent_verification_email=false
    `,
  );

  const successful = [];

  try {
    log.info('Sending emails for verification');
    await Promise.all(rows.map(async ({ email, verification_token }) => {
      const subject = 'Freefall account activation';
      const route = path.join(FREEFALL_ADDRESS, 'register', 'verify');
      const query = `?token=${verification_token}`;
      const link = route + query;
      const text = `Visit this link here to activate your account:\n${link}.`;

      log.info('Send email for verification of account to', email);
      await sendEmail(email, { subject, text });
      successful.push(email);
    }));
  } finally {
    if (successful.length !== 0) {
      const placeholders = successful.map((element, index) => `$${index + 1}`)
        .join(',');
      await client.executeQuery(
        `
      UPDATE users
      SET sent_verification_email=true
      WHERE email IN (${placeholders})
      `,
        successful,
      );
    }
  }
}

async function sendPasswordResets (client) {
  await client.executeQuery(
    `
    DELETE FROM password_resets
    WHERE expires_on < current_timestamp
    `
  );

  log.info('Cleaned expired password resets.');

  const { rows } = await client.executeQuery(
    `
    SELECT users.email, password_resets.new_password, password_resets.token
    FROM password_resets
    JOIN users ON users.id=password_resets.user_id
    WHERE sent_email=false
    `
  );

  for (const {email, new_password, token} of rows) {
    log.info('Sending password reset email to', email);
    const subject = 'Freefall password reset';
    const route = path.join(FREEFALL_ADDRESS, 'register', 'password-reset', 'reset');
    const query = `?token=${token}`;
    const link = route + query;
    const text = [
      'Someone tried to reset your Freefall account password.',
      'If this was not you please ignore this email.',
      `Clicking the link below will reset your password to '${new_password}'`,
      link,
    ].join('\n');

    await sendEmail(email, {subject, text});
    await client.executeQuery(
      `
      UPDATE password_resets
      SET sent_email=true
      WHERE user_id = (SELECT id FROM users WHERE email=$1)
      `,
      [email],
    );
  }
}

async function main () {
  const client = new Client();
  await client.connect();
  const dbClient = db.wrapPgClient(client);
  try {
    await Promise.all([
      sendVerificationTokens(dbClient),
      sendPasswordResets(dbClient),
      notifyEmails(dbClient),
    ]);
  } finally {
    client.end();
  }
}

main()
  .catch(reason => log.critical('Failed to notify emails. Reason:', reason));
