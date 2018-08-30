const _ = require('lodash');
const moment = require('moment');

const log = require('./log');
const errors = require('./error-handling');

const SUBSCRIPTION_PLANS = {
  monthly: {
    name: 'monthly',
    price: 100,
    initialTax: 50,
    shouldTax: (timeOfLastTaxing) => {
      const timeOfNextTax = moment(timeOfLastTaxing).add('1', 'month').format('Y-MM-DD');
      return timeOfNextTax.format('Y-MM-DD') <= moment().format('Y-MM-DD');
    },
  },
  weekly: {
    name: 'weekly',
    price: 500,
    initialTax: 50,
    shouldTax: (timeOfLastTaxing) => {
      const timeOfNextTax = moment(timeOfLastTaxing).add('1', 'week').format('Y-MM-DD');
      return timeOfNextTax.format('Y-MM-DD') <= moment().format('Y-MM-DD');
    },
  },
  daily: {
    name: 'daily',
    price: 1000,
    initialTax: 50,
    shouldTax: (timeOfLastTaxing) => {
      const timeOfNextTax = moment(timeOfLastTaxing).add('1', 'day').format('Y-MM-DD');
      return timeOfNextTax.format('Y-MM-DD') <= moment().format('Y-MM-DD');
    },
  },
};

// TODO fix logging in this module and return value of subscribeGlobally
async function subscribeUser (
  dbClient,
  userId,
  {
    airportFromId,
    airportToId,
    dateFrom,
    dateTo,
    plan = 'monthly',
  }) {
  // TODO validate dates.
  errors.assertApp(_.isObject(dbClient), `got ${typeof dbClient} but expected object`);
  errors.assertApp(Number.isInteger(userId), `got ${typeof userId} but expected integer`);
  errors.assertPeer(
    moment(dateFrom).format('YYYY-MM-DD') < moment(dateTo).format('YYYY-MM-DD'),
    'date_from must be less than date_to',
    'SUBSCRIBE_BAD_DATE',
  );

  const planRecord = await fetchSubscriptionPlan(dbClient, plan);
  errors.assertUser(planRecord, `${plan} is not a valid plan`, 'SUBSCRIBE_INVALID_PLAN');

  log.info(
    `Subscribing user ${userId} with parameters - `,
    { airportFromId, airportToId, dateFrom, dateTo },
  );

  const globalSubId = await subscribeGloballyIfNotSubscribed(
    dbClient,
    airportFromId,
    airportToId,
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
    log.info('User is updating plan or reviving inactive subscription with id - ', sub.id);
    errors.assertPeer(
      sub.active === false || sub.subscription_plan_id !== planRecord.id,
      `Cannot subscribe userId=${userId}, because subscription with id=${sub.id} already has the same filters.`,
      errors.errorCodes.subscriptionExists,
    );

    // race condition happens on multiple concurrent requests
    // two connections can successfully update the subscription
    // use WHERE active=false to only allow the first one to go through.
    const { rows: updatedRows } = await dbClient.executeQuery(
      `
      UPDATE users_subscriptions
      SET 
        active=true,
         subscription_plan_id=(SELECT id FROM subscription_plans WHERE name=$2),
         updated_at=now()
      WHERE 
        id=$1 AND 
        (active=false OR (active=true AND 
                          subscription_plan_id != (SELECT id FROM subscription_plans WHERE name=$2)))
      RETURNING *
      `,
      [sub.id, plan],
    );

    // query may update 0 rows because an earlier concurrent query already updated them.
    // TODO is this check needed ?
    errors.assertPeer(
      updatedRows.length === 1,
      `user subscription ${sub.id} was reactivated from another request.`,
      errors.errorCodes.subscriptionExists,
    );

    log.info('Reactivated old user subscription with id: ', sub.id);
    return sub;
  }

  log.info('Inserting new user subscription');

  let result;

  try {
    const { rows } = await dbClient.executeQuery(
      `
      INSERT INTO users_subscriptions
        (user_id, subscription_id, fetch_id_of_last_send, date_from, date_to, subscription_plan_id)
      VALUES
        ($1, $2, $3, $4, $5, (SELECT id FROM subscription_plans WHERE name=$6))
      RETURNING *
      `,
      [userId, globalSubId, null, dateFrom, dateTo, plan],
    );
    errors.assertApp(rows.length === 1);
    result = rows[0];
  } catch (e) {
    if (e.code === '23505') { // unique constraint failed
      throw new errors.PeerError(
        `already subscribed with these parameters`,
        errors.errorCodes.subscriptionExists,
      );
    } else {
      throw e;
    }
  }

  log.info('Inserted new user subscription id: ', result.id);
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
    plan = 'monthly',
  }) {
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
  const planRecord = await fetchSubscriptionPlan(dbClient, plan);
  errors.assertUser(planRecord, `${plan} is not a valid plan`, 'UPDATE_SUBSCR_INVALID_PLAN');

  const globalSubscriptionId = await subscribeGloballyIfNotSubscribed(
    dbClient,
    airportFromId,
    airportToId,
  );

  const result = await dbClient.executeQuery(
    `
    UPDATE users_subscriptions
    SET
      subscription_id = $2,
      date_from = $3,
      date_to = $4,
      subscription_plan_id = (SELECT id FROM subscription_plans WHERE name=$5),
      updated_at = now()
    WHERE id = $1
    RETURNING *;
    `,
    [
      userSubscriptionId,
      globalSubscriptionId,
      dateFrom,
      dateTo,
      plan,
    ]
  );

  errors.assertApp(_.isObject(result), `got ${result}`);
  errors.assertApp(Array.isArray(result.rows), `got ${result.rows}`);

  errors.assertPeer( // TODO this is not peer error
    result.rows.length === 1,
    `User subscription with id ${userSubscriptionId} does not exist.`,
    errors.errorCodes.subscriptionDoesNotExist,
  );

  return result.rows[0];
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
    SELECT
      user_sub.id,
      user_sub.date_from,
      user_sub.date_to,
      ap_from.id fly_from,
      ap_to.id fly_to,
      users.id user_id,
      users.email user_email,
      user_sub.created_at created_at,
      user_sub.updated_at updated_at
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
  airportToId,
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
  let sub;

  try {
    sub = await dbClient.insert(
      'subscriptions',
      {
        airport_from_id: airportFromId,
        airport_to_id: airportToId,
      },
    );
  } catch (e) {
    if (e.code === '23503') {
      throw new errors.PeerError(
        'cannot subscribe globally because airport ids do not exist',
        'FF_INVALID_AIRPORT_ID',
      );
    } else {
      throw e;
    }
  }

  log.info('Subscribed globally to airports with an id of', sub.id);

  return sub.id;
}

async function fetchSubscriptionPlan (dbClient, name) {
  const { rows } = await dbClient.executeQuery(
    `SELECT * FROM subscription_plans WHERE name=$1`,
    [name],
  );
  errors.assertApp(rows.length <= 1);

  const plan = rows[0];

  log.info('Found subscription plan', plan);

  return plan;
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
  fetchSubscriptionPlan,
  SUBSCRIPTION_PLANS,
};
