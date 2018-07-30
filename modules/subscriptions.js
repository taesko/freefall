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

  log.info('Searching for inactive user subscription');

  const [sub] = await db.selectWhere(
    'users_subscriptions',
    '*',
    {
      user_id: userId,
      subscription_id: globalSubId,
      date_from: dateFrom,
      date_to: dateTo,
    },
  );

  if (sub) {
    log.info('Found inactive user subscription with id: ', sub.id);
    errors.assertPeer(
      sub.active === false,
      `Cannot subscribe userId=${userId}, because subscription with id=${sub.id} already has the same filters.`,
      errors.errorCodes.subscriptionExists,
    );

    const result = await db.updateWhere(
      'users_subscriptions',
      {
        active: 1,
      },
      {
        id: sub.id,
      },
    );

    errors.assertApp(
      result.length === 1,
      `Failed to re-activate user subscription with id ${sub.id}`,
      errors.errorCodes.databaseError,
    );

    return sub.id;
  }

  log.info('Inserting new user subscription');

  return db.insert(
    'users_subscriptions',
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
    'users_subscriptions',
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
    result.length === 1,
    `User subscription with id ${userSubscriptionId} does not exist.`,
    errors.errorCodes.subscriptionDoesNotExist,
  );
}

async function removeUserSubscription (userSubscriptionId) {
  const result = await db.updateWhere('users_subscriptions',
    { active: 0 },
    { id: userSubscriptionId },
  );

  errors.assertPeer(
    result.length === 1,
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

  return db.updateWhere('users_subscriptions', { active: 0 }, { user_id: userId });
}

async function listUserSubscriptionsHelper (userId) {
  // TODO no longer valid because users can be inactive
  const whereHash = {
    'user_sub.active': 1,
  };

  if (userId) {
    whereHash['users.id'] = userId;
  }

  const { whereClause, values } = db.buildWhereClause(whereHash);

  const { rows } = await db.executeQuery(
    `
    SELECT user_sub.id, user_sub.date_from, user_sub.date_to, 
      ap_from.id fly_from, ap_to.id fly_to,
      users.id user_id, users.email user_email
    FROM users_subscriptions user_sub
    JOIN users ON user_sub.user_id=users.id
    JOIN subscriptions sub ON user_sub.subscription_id=sub.id
    JOIN airports ap_from ON sub.airport_from_id=ap_from.id
    JOIN airports ap_to ON sub.airport_to_id=ap_to.id
    ${whereClause}
  `,
    values,
  );

  errors.assertApp(Array.isArray(rows));

  return rows;
}

async function listUserSubscriptions (userId) {
  errors.assertApp(Number.isInteger(userId));

  return listUserSubscriptionsHelper(userId);
}

async function listAllUserSubscriptions () {
  return listUserSubscriptionsHelper();
}

async function listGlobalSubscriptions () {
  return db.select('subscriptions');
}

async function getGlobalSubscription (airportFromId, airportToId) {
  log.debug('Finding global subscription between airports', airportFromId, airportToId);

  const [sub] = await db.selectWhere(
    'subscriptions',
    ['id'],
    {
      airport_from_id: airportFromId,
      airport_to_id: airportToId,
    },
  );

  log.debug('Found global subscription', sub);

  return sub;
}

async function globalSubscriptionExists (airportFromId, airportToId) {
  return await getGlobalSubscription(airportFromId, airportToId) != null;
}

async function subscribeGlobally (airportFromId, airportToId) {
  log.info('Subscribing globally to airports', airportFromId, airportToId);
  airportFromId = +airportFromId;
  airportToId = +airportToId;

  errors.assertApp(
    !await globalSubscriptionExists(airportFromId, airportToId),
    `Cannot subscribe globally to airports with ids ${airportFromId}, ${airportToId}. Subscription already exists.`,
  );

  const sub = await db.insert(
    'subscriptions',
    {
      airport_from_id: airportFromId,
      airport_to_id: airportToId,
    },
  );

  return sub.id;
}

module.exports = {
  subscribeUser,
  removeUserSubscription,
  removeAllSubscriptionsOfUser,
  updateUserSubscription,
  listUserSubscriptions,
  listAllUserSubscriptions,
  subscribeGlobally,
  listGlobalSubscriptions,
  globalSubscriptionExists,
};
