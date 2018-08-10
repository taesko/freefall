const log = require('./log');

class CustomError extends Error {
  constructor (errMsg, errCode = '0') {
    super(errMsg);
    this.code = errCode;
    log.error(
      `code ${errCode} message: ${errMsg}  stack trace:\n\t`,
      this,
    );
  }
}
class PeerError extends CustomError {}
class AppError extends CustomError {}
class UserError extends CustomError {}
class SystemError extends CustomError {}

/*
  0 - null error code
  2000-3000 - Peer errors
    2000-2100 - Protocol errors
    2100-2200 - Subscription errors
    2200-2300 - Permission, authentication and registration of users errors
    2800-2900 - HTTP connection errors to external API's
    2900-3000 - Uncatalogued errors
  3000-4000 - User errors
  4000-5000 - App errors
  5000-6000 - System errors
*/
const errorCodes = {
  subscriptionExists: '2100',
  subscriptionDoesNotExist: '2101',
  notEnoughCredits: '2102',
  userDoesNotExist: '2200',
  emailTaken: '2201',
  apiKeyTaken: '2202',
  notEnoughPermissions: '2210',
  serviceDown: '2800',
  unknownAirport: '2900',
  databaseError: '4000',
  badFunctionArgs: '4100',
  missingEnvVar: '5000',
};

function assertApp (assert, errMsg, errCode) {
  if (!assert) {
    throw new AppError(errMsg, errCode);
  }
}

function assertUser (assert, errMsg, errCode) {
  if (!assert) {
    throw new UserError(errMsg, errCode);
  }
}

function assertPeer (assert, errMsg, errCode) {
  if (!assert) {
    throw new PeerError(errMsg, errCode);
  }
}

function assertSystem (assert, errMsg, errCode) {
  if (!assert) {
    throw new SystemError(errMsg, errCode);
  }
}

module.exports = {
  assertApp,
  assertPeer,
  assertUser,
  assertSystem,
  PeerError,
  AppError,
  UserError,
  SystemError,
  errorCodes,
};
