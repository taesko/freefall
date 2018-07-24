class CustomError extends Error {
  constructor (errMsg, errCode = '0') {
    super(errMsg);
    this.code = errCode;
  }
}
class PeerError extends CustomError {}
class AppError extends CustomError {}
class UserError extends CustomError {}

/*
  0 - null error code
  2000-3000 - Peer errors
    2000-2100 - Protocol errors
    2100-2200 - Subscription errors
    2200-2300 - Permission, authentication and registration of users errors
    2900-3000 - Uncatalogued errors
  3000-4000 - User errors
  4000-5000 - App errors
*/
const errorCodes = {
  subscriptionExists: '2100',
  subscriptionDoesNotExist: '2101',
  userDoesNotExist: '2200',
  userAlreadyExists: '2201',
  notEnoughPermissions: '2210',
  unknownAirport: '2900',
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

module.exports = {
  assertApp,
  assertPeer,
  assertUser,
  PeerError,
  AppError,
  UserError,
  errorCodes,
};
