const { assertPeer, assertApp, PeerError, UserError } = require('../modules/error-handling');
const { isObject, isFunction } = require('lodash');

function defineAPIMethod (errors, method) {
  assertApp(isObject(errors));
  assertApp(isFunction(method));

  async function apiMethod (params, db, appCtx) {
    let result;

    try {
      result = await method(params, db, appCtx);
    } catch (e) {
      if (e instanceof PeerError) {
        result = errors[e.code];
        assertApp(result != null, `Unhandled PeerError ${JSON.stringify(e)}`);
      } else if (e instanceof UserError) {
        result = errors[e.code];
        assertApp(result != null, `Unhandled UserError ${JSON.stringify(e)}`);
      } else {
        throw e;
      }
    }

    return result;
  }

  return apiMethod;
}

const getExecuteMethod = (methods) => async (executeMethodParams) => {
  const { methodName, params, db, appCtx } = executeMethodParams;

  assertPeer(
    typeof methodName === 'string',
    `Expected a name of method, got ${methodName}, type ${typeof methodName}`,
  );

  assertPeer(
    isObject(params),
    `Expected object params, got ${params}, not an object`,
  );

  assertPeer(
    isObject(db),
    `Expected db object, got ${db}`,
  );

  for (const [name, method] of Object.entries(methods)) {
    if (name === methodName) {
      return method(params, db, appCtx);
    }
  }
  throw new PeerError(`Unknown method '${methodName}'`);
};

module.exports = {
  defineAPIMethod,
  getExecuteMethod,
};
