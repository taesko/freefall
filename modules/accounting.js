const { assertApp, assertPeer, AppError, PeerError, errorCodes } = require('./error-handling');
const log = require('./log');
const users = require('./users');
const db = require('./db');
const SUBSCRIPTION_COST = 100;

async function depositCredits (userId, amount) {
  assertApp(typeof userId === 'number');
  assertApp(typeof amount === 'number');
  assertApp(amount > 0, 'tried to deposit a non-positive amount of credits.');
  assertPeer(await users.userExists({ userId }));

  log.info(`Depositing ${amount} credits into user ${userId}.`);

  const { rows: creditRows } = await db.executeQuery(
    `
      UPDATE users
      SET credits = credits + $1
      WHERE
        id=$2 AND
        active=true
      RETURNING *
    `,
    [amount, userId],
  );

  assertApp(
    Array.isArray(creditRows),
    `database returned invalid data type while depositing credits - ${typeof creditRows}`,
  );
  assertApp(
    creditRows.length === 1,
    `deposited on too many/too few users. row count - ${creditRows.length}`,
  );

  log.info(`New credits of user ${userId} are = ${amount}`);

  const accountTransfer = await db.insert(
    'account_transfers',
    {
      user_id: userId,
      transfer_amount: amount,
      transferred_at: new Date().toISOString(),
    },
  );

  log.info('Account transfer id is - ', accountTransfer.id);

  return accountTransfer;
}

async function taxUser (userId, amount) {
  assertApp(typeof userId === 'number');
  assertApp(typeof amount === 'number' && amount > 0);
  assertPeer(await users.userExists({ userId }));
  // Does taxing 0 count as a transaction ?

  log.info(`Taxing user ${userId} with amount=${amount}`);

  const { rows: creditRows } = await db.executeQuery(
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

  const accountTransfer = await db.insert(
    'account_transfers',
    {
      user_id: userId,
      transfer_amount: -amount,
      transferred_at: new Date().toISOString(),
    },
  );

  log.info(`Account transfer id is ${accountTransfer.id}`);

  return accountTransfer;
}

async function taxSubscribe (userId, userSubscriptionId) {
  assertApp(typeof userId === 'number');
  assertApp(typeof userSubscriptionId === 'number');

  log.info(`Taxing user ${userId} for subscription ${userSubscriptionId}`);

  const transfer = await taxUser(userId, SUBSCRIPTION_COST);

  log.info(`Linking account transfer ${transfer.id} with user subscription ${userSubscriptionId}`);

  const subTransfer = await db.insert(
    'user_subscription_account_transfers',
    {
      'account_transfer_id': transfer.id,
      'user_subscription_id': userSubscriptionId,
    },
  );

  log.info('user_subscription_account_transfer id is', subTransfer.id);

  return subTransfer;
}

module.exports = {
  depositCredits: db.executeInTransaction(depositCredits),
  taxUser: db.executeInTransaction(taxUser),
  taxSubscribe: db.executeInTransaction(taxSubscribe),
};
