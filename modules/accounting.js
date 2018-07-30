const { assertApp, assertPeer, AppError, PeerError, errorCodes } = require('./error-handling');
const log = require('./log');
const users = require('./users');
const subscriptions = require('./subscriptions');
const db = require('db');
const SUBSCRIPTION_COST = 100;

async function taxUser (userId, amount) {
  assertApp(typeof userId === 'number');
  assertApp(typeof amount === 'number' && amount > 0);
  assertPeer(await users.userExists(userId));
  // Does taxing 0 count as a transaction ?

  log.info(`Taxing user ${userId} with amount=${amount}`);

  const creditUpdate = await db.executeQuery(
    `
      UPDATE users
      SET credits = credits - $1
      WHERE 
        id=$2 AND
        active=true AND
        credits - $1 >= 0
      RETURNING *
    `,
    [amount, userId],
  );
  const { rows: creditRows } = creditUpdate;

  assertApp(
    Array.isArray(creditRows),
    `executeQuery returned a non-array value - ${typeof creditRows}`,
  );

  if (creditRows.length === 0) {
    throw new PeerError(`User ${userId} does not have enough credits.`, errorCodes.notEnoughCredits);
  } else if (creditRows.length > 1) {
    throw new AppError(`Tried to only tax user with id ${userId} but taxed ${creditRows.length} users.`);
  }

  log.info(`Set credits of user ${userId} to ${creditRows[0].credits}`);
  log.info(`Recording account transfer for ${userId}.`);

  const transferRows = await db.insert(
    'account_transfers',
    {
      user_id: userId,
      transfer_amount: -amount,
      transferred_at: new Date().toISOString(),
    },
  );

  assertApp(
    transferRows.length === 1,
    `inserted multiple account_transfers rows: ${transferRows.length} total`,
  );

  log.info(`Account transfer id is ${transferRows[0].id}`);

  return transferRows[0];
}

async function taxSubscribe (userId, userSubscriptionId) {
  assertApp(typeof userId === 'number');
  assertApp(typeof userSubscriptionId === 'number');

  log.info(`Taxing user ${userId} for subscription ${userSubscriptionId}`);

  const transfer = await taxUser(userId, SUBSCRIPTION_COST);

  log.info(`Linking account transfer ${transfer.id} with user subscription ${userSubscriptionId}`);

  const rows = await db.insert(
    'user_subscription_account_transfers',
    {
      'account_transfer_id': transfer.id,
      'user_subscription_id': userSubscriptionId,
    },
  );

  assertApp(
    rows.length === 1,
    `Failed to insert account_transfer id ${transfer.id} and user_subscription id ${userSubscriptionId} into table user_subscription_account_transfers.`
  );

  return rows[0];
}

module.exports = {
  taxSubscribe,
};
