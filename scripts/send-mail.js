const db = require('../modules/db');
const { log } = require('../modules/utils');
const { assertApp } = require('../modules/error-handling');
const { execute: callAPI } = require('../methods/resolve-method');
const mailer = require('nodemailer');

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

async function sendNotifications () {
  const notifications = await findNotificationsToSend();
  for (const email of Object.keys(notifications)) {
    try {
      await sendEmail(email, {});
      log('sent notification to', email);
    } catch (e) {
      log('failed to send notification to', email);
      continue;
    }
    try {
      await db.updateEmailSub(email);
    } catch (e) {
      // should this crash ?
      assertApp(
        false,
        `Failed to update email sub for email ${email} after sending notification. Reason: ${e}`,
      );
    }
  }
}

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
        log('Got error response for email', mail, 'Error:', error);
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
}

async function selectEmailsToNotify (db) {
  return db.all(`
      SELECT *
      FROM email_subscriptions
      WHERE fetch_id_of_last_send IS NULL OR
       fetch_id_of_last_send NOT IN 
        (
        SELECT id 
        FROM fetches
        WHERE timestamp=(select MAX(timestamp) from fetches)
        )
      ;
  `);
}

async function newRoutesForEmailSub (emailSub) {
  // TODO rename or refactor
  const rows = await db.selectWhere(
    'subscriptions',
    ['airport_from_id', 'airport_to_id'],
    { 'id': emailSub.subscription_id },
  );

  // TODO ask Ivan if database constraints should be double checked like this
  // alternative results in removing rows[0]
  assertApp(rows.length === 1,
    `email subscription with ID=${emailSub.id} has more than one subscription associated with it`,
  );

  const params = {
    v: '1.0',
    fly_from: rows[0].airport_from_id.toString(),
    fly_to: rows[0].airport_to_id.toString(),
    date_from: emailSub.date_from,
    date_to: emailSub.date_to,
  };

  log('Searching flights for email', emailSub.email, 'with params: \n\t', params);
  return callAPI(
    'search',
    params,
    db,
  );
}

async function findNotificationsToSend () {
  // TODO rename to emailRecords
  const emails = await selectEmailsToNotify(db);
  const notifications = {};

  log('emails that are awaiting notification are: \n\t', emails.map(e => e.email));

  for (const email of emails) {
    try {
      const routes = await newRoutesForEmailSub(email);
      if (+routes.status_code === 1000) {
        log(email.email, 'will be notified');
        notifications[email.email] = routes;
      } else {
        log(email.email, 'will NOT be notified');
      }
    } catch (e) {
      log(
        'Tried to find if email', email.email,
        'needs to be notified but an error occurred:', e,
      );
    }
  }

  return notifications;
}

async function start () {
  await db.dbConnect();
  return sendNotifications();
}

start();
