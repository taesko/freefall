const _ = require('lodash');
const moment = require('moment');

const log = require('./log');
const errors = require('./error-handling');

// TODO fix logging in this module and return value of subscribeGlobally

async function subscribeUser (
  dbClient,
  userId,
  {
    airportFromId,
    airportToId,
    dateFrom,
    dateTo,
  }) {
  // TODO validate dates.
  errors.assertApp(_.isObject(dbClient), `got ${typeof dbClient} but expected object`);
  errors.assertApp(Number.isInteger(userId), `got ${typeof userId} but expected integer`);
  errors.assertPeer(
    moment(dateFrom).format('YYYY-MM-DD') < moment(dateTo).format('YYYY-MM-DD'),
    'date_from must be less than date_to',
    'SUBSCRIBE_USER_BAD_DATE',
  );

  log.info(
    `Subscribing user ${userId} with parameters - `,
    { airportFromId, airportToId, dateFrom, dateTo },
  );

  const globalSubId = await subscribeGloballyIfNotSubscribed(
    dbClient,
    airportFromId,
    airportToId
  );
  log.info('Found global subscriptions between airports', airportFromId, airportToId);

  log.info('Searching for inactive user subscription');

  const [sub] = await dbClient.selectWhere(
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

    const result = await dbClient.updateWhere(
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

    return sub;
  }

  log.info('Inserting new user subscription');

  let result;

  try {
    result = await dbClient.insert(
      'users_subscriptions',
      {
        user_id: userId,
        subscription_id: globalSubId,
        fetch_id_of_last_send: null,
        date_from: dateFrom,
        date_to: dateTo,
      },
    );
  } catch (e) {
    if (e.code === '23505') {
      throw errors.PeerError(
        `already subscribed with these parameters`,
        errors.errorCodes.subscriptionExists,
      );
    } else {
      throw e;
    }
  }

  return result;
}

async function updateUserSubscription (
  dbClient,
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
  errors.assertApp(_.isObject(dbClient), `got ${typeof dbClient} but expected object`);
  errors.assertApp(
    Number.isInteger(userSubscriptionId),
    `got ${typeof userSubscriptionId} but expected integer`,
  );
  errors.assertPeer(
    moment(dateFrom).format('YYYY-MM-DD') < moment(dateTo).format('YYYY-MM-DD'),
    'date_from must be less than date_to',
    'UPDATE_SUBSCR_BAD_DATE',
  );

  const globalSubscriptionId = await getGlobalSubscription(
    dbClient,
    airportFromId,
    airportToId,
  ).then(s => {
    if (s == null) {
      s = subscribeGlobally(dbClient, airportFromId, airportToId);
    }

    return s.id;
  });

  const result = await dbClient.updateWhere(
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

async function removeUserSubscription (dbClient, userSubscriptionId) {
  errors.assertApp(_.isObject(dbClient), `got ${typeof dbClient} but expected object`);
  errors.assertApp(
    Number.isInteger(userSubscriptionId),
    `got ${typeof userSubscriptionId} but expected integer`,
  );

  const result = await dbClient.updateWhere('users_subscriptions',
    { active: 0 },
    { id: userSubscriptionId },
  );

  errors.assertPeer(
    result.length === 1,
    `User subscription with id ${userSubscriptionId} does not exist.`,
    'RUS_BAD_ID',
  );
}

async function removeAllSubscriptionsOfUser (dbClient, userId) {
  errors.assertApp(_.isObject(dbClient), `got ${typeof dbClient} but expected object`);
  errors.assertApp(Number.isInteger(userId), `got ${typeof userId} but expected integer`);

  // TODO circular dependency
  // is it needed to check this ?
  const [exists] = await dbClient.selectWhere('users', '*', { id: userId });

  errors.assertPeer(
    exists,
    `User with id ${userId} does not exist.`,
    errors.errorCodes.userDoesNotExist,
  );

  return dbClient.updateWhere('users_subscriptions', { active: 0 }, { user_id: userId });
}

async function listUserSubscriptionsHelper (dbClient, userId) {
  errors.assertApp(_.isObject(dbClient), `got ${typeof dbClient} but expected object`);
  errors.assertApp(
    userId == null || Number.isInteger(userId),
    `got ${typeof userId} but expected integer`,
  );

  // TODO no longer valid because users can be inactive

  let whereClause;
  let values;

  if (userId) {
    whereClause = 'WHERE user_sub.active=true AND users.id = $1';
    values = [userId];
  } else {
    whereClause = 'WHERE user_sub.active=true';
    values = null;
  }

  const { rows } = await dbClient.executeQuery(
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

async function listUserSubscriptions (dbClient, userId) {
  errors.assertApp(_.isObject(dbClient), `got ${typeof dbClient} but expected object`);
  errors.assertApp(Number.isInteger(userId), `got ${typeof userId} but expected number.`);

  return listUserSubscriptionsHelper(dbClient, userId);
}

async function listAllUserSubscriptions (dbClient) {
  errors.assertApp(_.isObject(dbClient), `got ${typeof dbClient} but expected object`);
  return listUserSubscriptionsHelper(dbClient);
}

async function listGlobalSubscriptions (dbClient) {
  errors.assertApp(_.isObject(dbClient), `got ${typeof dbClient} but expected object`);

  return dbClient.select('subscriptions');
}

async function getGlobalSubscription (dbClient, airportFromId, airportToId) {
  errors.assertApp(_.isObject(dbClient), `got ${typeof dbClient} but expected object`);
  errors.assertApp(Number.isInteger(airportFromId),
    `got ${typeof airportFromId} but expected number`,
  );
  errors.assertApp(Number.isInteger(airportToId), `got ${typeof airportToId} but expected number`);

  log.debug('Finding global subscription between airports', airportFromId, airportToId);

  const [sub] = await dbClient.selectWhere(
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

async function globalSubscriptionExists (dbClient, airportFromId, airportToId) {
  errors.assertApp(_.isObject(dbClient), `got ${typeof dbClient} but expected object`);
  errors.assertApp(
    Number.isInteger(airportFromId),
    `got ${typeof airportFromId} but expected number`,
  );
  errors.assertApp(Number.isInteger(airportToId), `got ${typeof airportToId} but expected number`);

  return await getGlobalSubscription(
    dbClient,
    airportFromId,
    airportToId,
  ) != null;
}

async function subscribeGloballyIfNotSubscribed (
  dbClient,
  airportFromId,
  airportToId
) {
  errors.assertApp(_.isObject(dbClient), `got ${typeof dbClient} but expected object`);
  errors.assertApp(Number.isInteger(airportFromId),
    `got ${typeof airportFromId} but expected number`,
  );
  errors.assertApp(Number.isInteger(airportToId), `got ${typeof airportToId} but expected number`);

  log.info('Subscribing globally to airports', airportFromId, airportToId);
  airportFromId = +airportFromId;
  airportToId = +airportToId;

  // errors.assertApp(
  //   !await globalSubscriptionExists(dbClient, airportFromId, airportToId),
  //   `Cannot subscribe globally to airports with ids ${airportFromId}, ${airportToId}. Subscription already exists.`,
  // );

  // TODO raises error when airport doesn't exist
  await dbClient.executeQuery(
    `
      INSERT INTO subscriptions
        (airport_from_id, airport_to_id)
      VALUES
        ($1, $2)
      ON CONFLICT DO NOTHING
    `,
    [airportFromId, airportToId],
  );

  const subRows = await dbClient.selectWhere(
    'subscriptions',
    '*',
    {
      airport_from_id: airportFromId,
      airport_to_id: airportToId,
    },
  );

  // TODO what happens when someone deletes the subscription?
  errors.assertApp(
    subRows.length === 1,
    'Inserted global subscription but could not find it later. TODO CASE NOT HANDLED',
  );

  const sub = subRows[0];

  log.info('Fetched global subscription with id', sub.id);

  return sub.id;
}

async function subscribeGlobally (dbClient, airportFromId, airportToId) {
  errors.assertApp(_.isObject(dbClient), `got ${typeof dbClient} but expected object`);
  errors.assertApp(Number.isInteger(airportFromId),
    `got ${typeof airportFromId} but expected number`,
  );
  errors.assertApp(Number.isInteger(airportToId), `got ${typeof airportToId} but expected number`);

  log.info('Subscribing globally to airports', airportFromId, airportToId);
  airportFromId = +airportFromId;
  airportToId = +airportToId;

  errors.assertApp(
    !await globalSubscriptionExists(dbClient, airportFromId, airportToId),
    `Cannot subscribe globally to airports with ids ${airportFromId}, ${airportToId}. Subscription already exists.`,
  );

  // TODO raises error when airport doesn't exist
  const sub = await dbClient.insert(
    'subscriptions',
    {
      airport_from_id: airportFromId,
      airport_to_id: airportToId,
    },
  );

  log.info('Subscribed globally to airports with an id of', sub.id);

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
