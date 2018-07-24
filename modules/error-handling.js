class CustomError extends Error {}
class PeerError extends CustomError {}
class AppError extends CustomError {}
class UserError extends CustomError {}

/*
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

function assertApp (assert, errMsg) {
  if (!assert) {
    throw new AppError(errMsg);
  }
}

function assertUser (assert, errMsg) {
  if (!assert) {
    throw new UserError(errMsg);
  }
}

function assertPeer (assert, errMsg) {
  if (!assert) {
    throw new PeerError(errMsg);
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
