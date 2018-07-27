const log = require('./log');
const errors = require('./error-handling');
const db = require('./db');

async function subscribeUser (
  userId,
  {
    airportFromId,
    airportToId,
    dateFrom,
    dateTo,
  }) {
  // TODO validate dates.
  const globalSub = await getGlobalSubscription(airportFromId, airportToId);
  let globalSubId;

  if (globalSub == null) {
    globalSubId = await subscribeGlobally(airportFromId, airportToId);
  } else {
    globalSubId = globalSub.id;
  }

  const [sub] = await db.selectWhere(
    'user_subscriptions',
    '*',
    {
      user_id: userId,
      subscription_id: globalSubId,
      date_from: dateFrom,
      date_to: dateTo,
    },
  );

  if (sub) {
    errors.assertPeer(
      sub.active === 0,
      `Cannot subscribe userId=${userId}, because subscription with id=${sub.id} already has the same filters.`,
      errors.errorCodes.subscriptionExists,
    );

    const result = await db.updateWhere(
      'user_subscriptions',
      {
        active: 1,
      },
      {
        id: sub.id,
      },
    );

    errors.assertApp(
      result.stmt.changes,
      `Failed to re-activate user subscription with id ${sub.id}`,
      errors.errorCodes.databaseError,
    );

    return sub.id;
  }

  return db.insert(
    'user_subscriptions',
    {
      user_id: userId,
      subscription_id: globalSubId,
      fetch_id_of_last_send: null,
      date_from: dateFrom,
      date_to: dateTo,
    },
  );
}

async function updateUserSubscription (
  userSubscriptionId,
  {
    airportFromId,
    airportToId,
    dateFrom,
    dateTo,
  }) {
  // TODO ask ivan about differences between throwing exceptions and getting null instead of object
  // advantages to throwing is that the exception is built from inside the function and has more
  // information
  const globalSubscriptionId = await getGlobalSubscription(
    airportFromId,
    airportToId,
  ).then(s => {
    return (s != null) ? s.id : subscribeGlobally(airportFromId, airportToId);
  });

  const result = await db.updateWhere(
    'user_subscriptions',
    {
      subscription_id: globalSubscriptionId,
      date_from: dateFrom,
      date_to: dateTo,
      active: 1,
    },
    {
      id: userSubscriptionId,
    },
  );

  errors.assertPeer(
    result.stmt.changes,
    `User subscription with id ${userSubscriptionId} does not exist.`,
    errors.errorCodes.subscriptionDoesNotExist,
  );
}

async function removeUserSubscription (userSubscriptionId) {
  const result = await db.updateWhere('user_subscriptions',
    { active: 0 },
    { id: userSubscriptionId },
  );

  errors.assertPeer(
    result.stmt.changes > 0,
    `User subscription with id ${userSubscriptionId} does not exist.`,
    errors.errorCodes.subscriptionDoesNotExist,
  );
}

async function removeAllSubscriptionsOfUser (userId) {
  // TODO circular dependency
  const [exists] = await db.selectWhere('users', '*', { id: userId });

  errors.assertPeer(
    exists,
    `User with id ${userId} does not exist.`,
    errors.errorCodes.userDoesNotExist,
  );

  return db.updateWhere('user_subscriptions', { active: 0 }, { user_id: userId });
}

async function listUserSubscriptions (userId) {
  // TODO no longer valid because users can be inactive
  return db.selectWhere('user_subscriptions', '*', { user_id: userId, active: 1 });
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

  return resultRows[0];
}

async function globalSubscriptionExists (airportFromId, airportToId) {
  return !!await getGlobalSubscription(airportFromId, airportToId);
}

async function subscribeGlobally (airportFromId, airportToId) {
  log.info('Subscribing globally to airports', airportFromId, airportToId);
  airportFromId = +airportFromId;
  airportToId = +airportToId;

  errors.assertApp(
    !await globalSubscriptionExists(airportFromId, airportToId),
    `Cannot subscribe globally to airports with ids ${airportFromId}, ${airportToId}. Subscription already exists.`,
  );

  return db.insert(
    'subscriptions',
    {
      airport_from_id: airportFromId,
      airport_to_id: airportToId,
    },
  );
}

module.exports = {
  subscribeUser,
  removeUserSubscription,
  removeAllSubscriptionsOfUser,
  updateUserSubscription,
  listUserSubscriptions,
  subscribeGlobally,
  listGlobalSubscriptions,
};
