const { log } = require('./utils');
const errors = require('./error-handling');
const db = require('./db');

async function subscribeUser (
  user,
  {
    airportFromId,
    airportToId,
    dateFrom,
    dateTo,
  }) {
  const globalSub = await getGlobalSubscription(airportFromId, airportToId);
  let globalSubId;

  if (globalSub == null) {
    globalSubId = await subscribeGlobally(airportFromId, airportToId);
  } else {
    globalSubId = globalSub.id;
  }

  // TODO wat ?
  // can raise exception because database failed
  // can also raise exception because UNIQUE constraints failed (user is already subscribed)
  // both are an AppError ?
  return db.insert(
    'user_subscriptions',
    {
      user_id: user.id,
      subscription_id: globalSubId,
      fetch_id_of_last_send: null,
      date_from: dateFrom,
      date_to: dateTo,
    }
  );
}

async function removeUserSubscription (userSubscriptionId) {
  const result = await db.executeRun(
    `
      DELETE
      FROM user_subscriptions
      WHERE id = ?
    `,
    [userSubscriptionId],
  );
  // TODO assert peer or assert app ?
  log('result of removal is: ', result);
  errors.assertPeer(
    result.stmt.changes,
    `Failed to remove user subscription with id ${userSubscriptionId}. Subscription doesn't exist`,
  );
}

async function listUserSubscriptions (user) {
  return db.executeAll(
    `
      SELECT usub.id, usub.date_from, usub.date_to, 
        ap_from.id fly_from, ap_to.id fly_to
      FROM user_subscriptions usub
      JOIN users ON usub.user_id=users.id
      JOIN subscriptions sub ON usub.subscription_id=sub.id
      JOIN airports ap_from ON sub.airport_from_id=ap_from.id
      JOIN airports ap_to ON sub.airport_to_id=ap_to.id
      WHERE users.id=?
    `,
    user.id,
  );
}

async function listGlobalSubscriptions () {
  return db.select('subscriptions');
}

async function getGlobalSubscription (airportFromId, airportToId) {
  const resultRows = await db.selectWhere(
    'subscriptions',
    ['id'],
    {
      airport_from_id: airportFromId,
      airport_to_id: airportToId,
    },
  );

  // errors.assertApp(
  //   resultRows.length > 0,
  //   `Doesn't exist a global subscription where ids are: from=${airportFromId}, to=${airportToId}`,
  // );

  return resultRows[0];
}

async function globalSubscriptionExists (airportFromId, airportToId) {
  return !!await getGlobalSubscription(airportFromId, airportToId);
}

async function subscribeGlobally (airportFromId, airportToId) {
  log('Subscribing globally to airports', airportFromId, airportToId);
  airportFromId = +airportFromId;
  airportToId = +airportToId;

  errors.assertApp(
    !await globalSubscriptionExists(airportFromId, airportToId),
    `Cannot subscribe globally to airports with ids ${airportFromId}, ${airportToId}. Subscription already exists.`
  );

  return db.insert(
    'subscriptions',
    {
      airport_from_id: airportFromId,
      airport_to_id: airportToId,
    }
  );
}

module.exports = {
  subscribeUser,
  removeUserSubscription,
  listUserSubscriptions,
  listGlobalSubscriptions,
};
