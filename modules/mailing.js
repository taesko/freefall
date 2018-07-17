const db = require('./db');
const { log } = require('./utils');
const { assertApp } = require('./error-handling');
const { defineMethods, search } = require('../methods/resolve-method');
const mailer = require('nodemailer');

db.dbConnect();
const callAPI = defineMethods(search);

const [FREEFALL_MAIL, mailTransporter] = (function init () {
  const username = process.env.FREEFALL_EMAIL;
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

async function sendEmails (destinationEmail, {
  subject = 'Freefall subscriptions',
  text = `A flight has been found that might be to your liking. Head over to our site to check it out.`,
}) {
  const mail = {
    from: `Freefall solutions <${FREEFALL_MAIL}>`,
    to: destinationEmail,
    subject,
    text,
  };

  log('Sending email to', destinationEmail);
  return new Promise((resolve, reject) => {
    log('executing promise');
    mailTransporter.sendMail(mail, (error, response) => {
      if (error) {
        log('promise rejected with error: ', error);
        reject(error);
      } else {
        log('promise resolved with response: ', response);
        resolve(response);
      }
    });
  });
}

async function sendNotifications () {
  const notifications = await findNotificationsToSend();

  for (const email of Object.keys(notifications)) {
    await sendEmails(email, {});
  }
}

async function selectEmailsToNotify (db) {
  // TODO esub -> subcr or es
  // renames are 4 symbols max
  return db.all(`
      SELECT esub.id, esub.email, esub.subscription_id, esub.date_from, esub.date_to 
      FROM email_subscriptions esub
      LEFT JOIN fetches ON esub.fetch_id_of_last_send = fetches.id
      GROUP BY esub.id
      HAVING fetches.timestamp IS NULL OR 
        fetches.timestamp < MAX(fetches.timestamp);
  `);
}

async function newRoutesForEmailSub (emailSub) {
  const rows = await db.selectWhere(
    'subscriptions',
    ['airport_from_id', 'airport_to_id'],
    { 'id': emailSub.subscription_id },
  );

  assertApp(rows.length === 1,
    `email subscription with ID=${emailSub.id} has more than one subscription associated with it`,
  );

  log('found subscription for email', emailSub, rows[0]);
  const params = {
    v: '1.0',
    fly_from: rows[0].airport_from_id.toString(),
    fly_to: rows[0].airport_to_id.toString(),
    date_from: emailSub.date_from,
    date_to: emailSub.date_to,
  };

  log('searching with params', params);
  return callAPI(
    'search',
    params,
    db,
  );
}

async function findNotificationsToSend () {
  const emails = await selectEmailsToNotify(db);
  const notifications = {};

  for (const email of emails) {
    try {
      const routes = await newRoutesForEmailSub(email);
      log('search API response for email', email, 'is', Object.keys(routes), routes.status_code);
      if (+routes.status_code === 1000) {
        log(email.email, 'needs to be notified');
        notifications[email.email] = routes;
      } else {
        log(email.email, 'does not need to be notified');
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

module.exports = {
  sendNotifications,
};
