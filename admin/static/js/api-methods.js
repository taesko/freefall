function getAPIMethods (mainUtils) {
  const PeerError = mainUtils.PeerError;
  const assertPeer = mainUtils.assertPeer;
  const assertApp = mainUtils.assertApp;
  const assertUser = mainUtils.assertUser;

  const validateErrorRes = validators.getValidateErrorRes();
  const validateListSubscriptionsRes = validators.getValidateListSubscriptionsRes();
  const validateSubscribeReq = validators.getValidateSubscribeReq();
  const validateUnsubscribeReq = validators.getValidateUnsubscribeReq();
  const validateSubscribeRes = validators.getValidateSubscribeRes();
  const validateUnsubscribeRes = validators.getValidateUnsubscribeRes();
  const validateListAirportsRes = validators.getValidateListAirportsRes();
  const validateGetAPIKeyRes = validators.getValidateGetAPIKeyRes();
  const validateSearchReq = validators.getValidateSearchReq()
  const validateSearchRes = validators.getValidateSearchRes();

  assertApp(_.isObject(mainUtils), 'Expected mainUtils arg of getAPIMethods to be an object, but was' + typeof mainUtils); // eslint-disable-line prefer-template

  const listAirports = function (protocolName, callback) {
    mainUtils.trace('listAirports(' + protocolName + '), typeof arg=' + typeof protocolName + ''); // eslint-disable-line prefer-template

    mainUtils.sendRequest({
      url: mainUtils.SERVER_URL,
      data: {
        method: 'list_airports',
        params: {
          v: '2.0',
        },
      },
      protocolName: protocolName,
    }, function (result, error) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        assertPeer(validateErrorRes(error), {
          msg: 'Params do not adhere to errorResponseSchema: ' + mainUtils.getValidatorMsg(validateErrorRes), // eslint-disable-line prefer-template
        });

        mainUtils.trace('Error in listAirports:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateListAirportsRes(result), {
        msg: 'Params do not adhere to listAirportsResponseSchema: ' + mainUtils.getValidatorMsg(validateListAirportsRes), // eslint-disable-line prefer-template
      });

      setTimeout(function () { // eslint-disable-line prefer-arrow-callback
        callback(result);
      }, 0);
    });
  };

  const getAPIKey = function (params, protocolName, callback) {
    mainUtils.trace('getAPIKey(' + JSON.stringify(params) + '), typeof arg=' + typeof params + ''); // eslint-disable-line prefer-template

    mainUtils.sendRequest({
      url: mainUtils.SERVER_URL,
      data: {
        method: 'get_api_key',
        params: params,
      },
      protocolName: protocolName,
    }, function (result, error) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        assertPeer(validateErrorRes(error), {
          msg: 'Params do not adhere to errorResponseSchema: ' + mainUtils.getValidatorMsg(validateErrorRes), // eslint-disable-line prefer-template
        });

        mainUtils.trace('Error in subscribe:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateGetAPIKeyRes(result), {
        msg: 'Params do not adhere to getAPIKeyResponseSchema: ' + mainUtils.getValidatorMsg(validateGetAPIKeyRes), // eslint-disable-line prefer-template
      });

      setTimeout(function () { // eslint-disable-line prefer-arrow-callback
        callback(result);
      }, 0);
    });
  };

  const listSubscriptions = function (protocolName, callback) {
    mainUtils.trace('listSubscriptions(' + protocolName + '), typeof arg=' + typeof protocolName + ''); // eslint-disable-line prefer-template

    mainUtils.sendRequest({
      url: mainUtils.SERVER_URL,
      data: {
        method: 'list_subscriptions',
        params: {
          v: '2.0',
          api_key: mainUtils.APIKeyRef.APIKey,
        },
      },
      protocolName: protocolName,
    }, function (result, error) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        assertPeer(validateErrorRes(error), {
          msg: 'Params do not adhere to errorResponseSchema: ' + mainUtils.getValidatorMsg(validateErrorRes), // eslint-disable-line prefer-template
        });

        mainUtils.trace('Error in listSubscriptions:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateListSubscriptionsRes(result), {
        msg: 'Params do not adhere to validateSubscriptionsResponseSchema: ' + mainUtils.getValidatorMsg(validateListSubscriptionsRes), // eslint-disable-line prefer-template
      });

      setTimeout(function () { // eslint-disable-line prefer-arrow-callback
        callback(result);
      }, 0);
    });
  };

  const unsubscribe = function (params, protocolName, callback) {
    mainUtils.trace('unsubscribe(' + JSON.stringify(params) + '), typeof arg=' + typeof params + ''); // eslint-disable-line prefer-template

    assertApp(validateUnsubscribeReq(params), {
      msg: 'Params do not adhere to unsubscribeRequestSchema: ' + mainUtils.getValidatorMsg(validateUnsubscribeReq), // eslint-disable-line prefer-template
    });

    mainUtils.sendRequest({
      url: mainUtils.SERVER_URL,
      data: {
        method: 'unsubscribe',
        params: params,
      },
      protocolName: protocolName,
    }, function (result, error) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        assertPeer(validateErrorRes(error), {
          msg: 'Params do not adhere to errorResponseSchema: ' + mainUtils.getValidatorMsg(validateErrorRes), // eslint-disable-line prefer-template
        });

        mainUtils.trace('Error in unsubscribe:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateUnsubscribeRes(result), {
        msg: 'Params do not adhere to unsubscribeResponseSchema: ' + mainUtils.getValidatorMsg(validateUnsubscribeRes), // eslint-disable-line prefer-template
      });

      setTimeout(function () { // eslint-disable-line prefer-arrow-callback
        callback(result);
      }, 0);
    });
  };

  const subscribe = function (params, protocolName, callback) {
    mainUtils.trace('subscribe(' + JSON.stringify(params) + '), typeof arg=' + typeof params + ''); // eslint-disable-line prefer-template

    assertApp(validateSubscribeReq(params), {
      msg: 'Params do not adhere to subscriptionRequestSchema: ' + mainUtils.getValidatorMsg(validateSubscribeReq), // eslint-disable-line prefer-template
    });

    mainUtils.sendRequest({
      url: mainUtils.SERVER_URL,
      data: {
        method: 'subscribe',
        params: params,
      },
      protocolName: protocolName,
    }, function (result, error) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        assertPeer(validateErrorRes(error), {
          msg: 'Params do not adhere to errorResponseSchema: ' + mainUtils.getValidatorMsg(validateErrorRes), // eslint-disable-line prefer-template
        });

        mainUtils.trace('Error in subscribe:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateSubscribeRes(result), {
        msg: 'Params do not adhere to subscriptionResponseSchema: ' + mainUtils.getValidatorMsg(validateSubscribeRes), // eslint-disable-line prefer-template
      });
      assertUser(result.status_code >= 1000 && result.status_code < 2000, {
        userMessage: 'Subscribe failed.', // eslint-disable-line prefer-template
        msg: 'Subscribe failed with status code: ' + result.status_code, // eslint-disable-line prefer-template
      });

      setTimeout(function () { // eslint-disable-line prefer-arrow-callback
        callback(result);
      }, 0);
    });
  };

  const search = function (params, protocolName, callback) {
    const sortRoute = function (route) {
      const comparison = function (a, b) {
        return a.dtime - b.dtime;
      };

      const result = route.slice(0);

      result.sort(comparison);

      return result;
    };

    mainUtils.trace('search(' + JSON.stringify(params) + '), typeof arg=' + typeof params + ''); // eslint-disable-line prefer-template
    // JSON.stringify - handle potential exception in a new function - stringifyObject

    assertApp(validateSearchReq(params), {
      msg: 'Params do not adhere to searchRequestSchema: ' + mainUtils.getValidatorMsg(validateSearchReq), // eslint-disable-line prefer-template
    });

    mainUtils.sendRequest({
      url: mainUtils.SERVER_URL,
      data: {
        method: 'search',
        params: params,
      },
      protocolName: protocolName,
    }, function (result, error) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        assertPeer(validateErrorRes(error), {
          msg: 'Params do not adhere to errorResponseSchema: ' + mainUtils.getValidatorMsg(validateErrorRes), // eslint-disable-line prefer-template
        });

        mainUtils.trace('Error in search:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateSearchRes(result), {
        msg: 'Params do not adhere to searchResponseSchema: ' + mainUtils.getValidatorMsg(validateSearchRes), // eslint-disable-line prefer-template
      });

      var i, k; // eslint-disable-line no-var

      for (i = 0; i < result.routes.length; i++) {
        // server doesn't provide currency yet
        if (result.currency) {
          result.routes[i].price += ' ' + result.currency + ''; // eslint-disable-line prefer-template
        } else {
          result.routes[i].price += ' $';
        }

        for (k = 0; k < result.routes[i].route.length; k++) {
          result.routes[i].route[k].dtime = new Date(result.routes[i].route[k].dtime);
          result.routes[i].route[k].atime = new Date(result.routes[i].route[k].atime);

          // server doesn't provide city_from and city_to yet
          result.routes[i].route[k].cityFrom = result.routes[i].route[k].cityFrom || '';
          result.routes[i].route[k].cityTo = result.routes[i].route[k].cityTo || '';
        }

        result.routes[i].route = sortRoute(result.routes[i].route);
        result.routes[i].dtime = result.routes[i].route[0].dtime;
        result.routes[i].atime = result.routes[i].route[result.routes[i].route.length - 1].atime;
      }

      result.routes = _.sortBy(result.routes, [function (routeObj) {
        return routeObj.dtime;
      }]);

      setTimeout(function () { // eslint-disable-line prefer-arrow-callback
        callback(result);
      }, 0);
    });
  };

  return {
    listAirports: listAirports,
    listSubscriptions: listSubscriptions,
    getAPIKey: getAPIKey,
    unsubscribe: unsubscribe,
    subscribe: subscribe,
    search: search,
  };
}
