const db = require('./db');
const { log } = require('./utils');
const { assertApp } = require('./error-handling');
const { search } = require('../methods/resolve-method');

async function newRoutesForEmailSub (emailSub) {
  const rows = await db.selectWhere(
    'subscriptions',
    ['airport_from_id', 'airport_to_id'],
    { 'id': emailSub.subscription_id },
  );

  assertApp(rows.length === 1,
    `email subscription with ID=${emailSub.id} has more than one subscription associated with it`,
  );

  const [airportFrom, airportTo] = rows[0];
  return search({
    airport_from: airportFrom,
    airport_to: airportTo,
    date_from: emailSub.date_from,
    date_to: emailSub.date_to,
  });
}

async function notifyEmailSubscriptions () {
  const emails = await db.selectEmailsToNotify();

  for (const email of emails) {
    try {
      log(await newRoutesForEmailSub(email));
    } catch (e) {
      log(e);
    }
  }
}

module.exports = {
  notifyEmailSubscriptions,
};
