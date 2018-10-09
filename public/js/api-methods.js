/* eslint-disable prefer-arrow-callback,prefer-template,no-console */
function getAPIMethods (mainUtils) { // eslint-disable-line no-unused-vars
  const PeerError = mainUtils.PeerError;
  const assertPeer = mainUtils.assertPeer;
  const assertApp = mainUtils.assertApp;

  const validateListSubscriptionsRes =
    validators.getValidateListSubscriptionsRes();
  const validateSubscribeReq = validators.getValidateSubscribeReq();
  const validateUnsubscribeReq = validators.getValidateUnsubscribeReq();
  const validateSubscribeRes = validators.getValidateSubscribeRes();
  const validateUnsubscribeRes = validators.getValidateUnsubscribeRes();
  const validateListAirportsRes = validators.getValidateListAirportsRes();
  const validateGetAPIKeyRes = validators.getValidateGetAPIKeyRes();
  const validateSearchReq = validators.getValidateSearchReq();
  const validateSearchRes =
    validators.getValidateSearchRes();
  const validateEditSubscriptionReq =
    validators.getValidateEditSubscriptionReq();
  const validateEditSubscriptionRes =
    validators.getValidateEditSubscriptionRes();

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
    }, function (error, result) { // eslint-disable-line prefer-arrow-callback
      if (error) {
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
    }, function (error, result) { // eslint-disable-line prefer-arrow-callback
      if (error) {
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

  const listSubscriptions = function (params, protocolName, callback) {
    mainUtils.trace('listSubscriptions(' + protocolName + '), typeof arg=' + typeof protocolName + ''); // eslint-disable-line prefer-template

    params.api_key = mainUtils.APIKeyRef.APIKey;
    params.v = '2.0';

    mainUtils.sendRequest({
      url: mainUtils.SERVER_URL,
      data: {
        method: 'list_subscriptions',
        params: params,
      },
      protocolName: protocolName,
    }, function (error, result) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        mainUtils.trace('Error in listSubscriptions:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateListSubscriptionsRes(result), {
        msg: 'Params do not adhere to listSubscriptionsResponseSchema: ' + mainUtils.getValidatorMsg(validateListSubscriptionsRes), // eslint-disable-line prefer-template
      });

      setTimeout(function () { // eslint-disable-line prefer-arrow-callback
        callback(result);
      }, 0);
    });
  };

  const creditHistory = function (params, protocolName, callback) {
    params.api_key = mainUtils.APIKeyRef.APIKey;
    params.v = '2.0';

    mainUtils.trace('creditHistory(' + JSON.stringify(params) + '), typeof arg=' + typeof params + ''); // eslint-disable-line prefer-template
    // TODO json schema validation
    mainUtils.sendRequest({
      url: mainUtils.SERVER_URL,
      data: {
        method: 'credit_history',
        params: params,
      },
      protocolName: protocolName,
    }, function (error, result) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        mainUtils.trace('Error in credit_history:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }
      // TODO validate response of result with json schema

      setTimeout(function () { // eslint-disable-line prefer-arrow-callback
        callback(result);
      }, 0);
    });
  };

  const exportCreditHistory = function (params, protocolName, callback) {
    assertApp(_.isObject(params));

    params.api_key = mainUtils.APIKeyRef.APIKey;
    params.v = '2.0';
    callback = callback || function () {};

    mainUtils.trace('exportCreditHistory(' + JSON.stringify(params) + '), typeof arg=' + typeof params + ''); // eslint-disable-line prefer-template

    const xhr = new window.XMLHttpRequest();
    xhr.open('POST', mainUtils.EXPORT_SERVER_URL, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function savingExport () {
      if (this.status === 200) {
        // eslint-disable-next-line no-var
        var filename = '';
        const disposition = xhr.getResponseHeader('Content-Disposition');
        if (disposition && disposition.indexOf('filename') !== -1) {
          const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
          const matches = filenameRegex.exec(disposition);
          if (matches != null && matches[1]) {
            filename = matches[1].replace(/['"]/g, '');
          }
        }

        const type = xhr.getResponseHeader('Content-Type');

        if (type === 'application/json') {
          return callback(
            new PeerError({ userMessage: 'Exporting failed. ' }),
          );
        }

        const blob = new window.File([this.response], filename, { type: type });
        const URL = window.URL;
        const objectURL = URL.createObjectURL(blob);
        if (filename) {
          const link = document.createElement('a');

          link.href = objectURL;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
        } else {
          window.location = objectURL;
        }
        setTimeout(function () {
          URL.revokeObjectURL(objectURL);
          // eslint-disable-next-line no-console
          console.log(
            'Revoked object url %s for file %s',
            objectURL,
            filename,
          );
        }, 2000);
        setTimeout(callback, 0);
      } else {
        callback(new PeerError({
          userMessage: 'Could not export your file. Please try again later.',
        }));
      }
    };
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'export_credit_history',
        params: params,
      }
    ));
  };

  const depositHistory = function (params, protocolName, callback) {
    params.api_key = mainUtils.APIKeyRef.APIKey;
    params.v = '2.0';

    mainUtils.trace('depositHistory(' + JSON.stringify(params) + '), typeof arg=' + typeof params + ''); // eslint-disable-line prefer-template
    // TODO json schema validation
    mainUtils.sendRequest({
      url: mainUtils.SERVER_URL,
      data: {
        method: 'deposit_history',
        params: params,
      },
      protocolName: protocolName,
    }, function (error, result) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        mainUtils.trace('Error in deposit_history:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }
      // TODO validate response of result with json schema

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
    }, function (error, result) { // eslint-disable-line prefer-arrow-callback
      if (error) {
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
      msg: 'Params do not adhere to subscribeRequestSchema: ' + mainUtils.getValidatorMsg(validateSubscribeReq), // eslint-disable-line prefer-template
    });

    mainUtils.sendRequest({
      url: mainUtils.SERVER_URL,
      data: {
        method: 'subscribe',
        params: params,
      },
      protocolName: protocolName,
    }, function (error, result) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        mainUtils.trace('Error in subscribe:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateSubscribeRes(result), {
        msg: 'Params do not adhere to subscribeResponseSchema: ' + mainUtils.getValidatorMsg(validateSubscribeRes), // eslint-disable-line prefer-template
      });

      setTimeout(function () { // eslint-disable-line prefer-arrow-callback
        callback(result);
      }, 0);
    });
  };

  const editSubscription = function (params, protocolName, callback) {
    mainUtils.trace('editSubscription');

    assertApp(validateEditSubscriptionReq(params), {
      msg: 'Params do not adhere to editSubscriptionRequestSchema: ' + mainUtils.getValidatorMsg(validateEditSubscriptionReq), // eslint-disable-line prefer-template
    });

    mainUtils.sendRequest({
      url: mainUtils.SERVER_URL,
      data: {
        method: 'edit_subscription',
        params: params,
      },
      protocolName: protocolName,
    }, function (error, result) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        mainUtils.trace('Error in editSubscription:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateEditSubscriptionRes(result), {
        msg: 'Params do not adhere to editSubscriptionResponseSchema: ' + mainUtils.getValidatorMsg(validateEditSubscriptionRes), // eslint-disable-line prefer-template
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
    }, function (error, result) { // eslint-disable-line prefer-arrow-callback
      if (error) {
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
          result.routes[i].route[k].dtime =
            new Date(result.routes[i].route[k].dtime);
          result.routes[i].route[k].atime =
            new Date(result.routes[i].route[k].atime);

          // server doesn't provide city_from and city_to yet
          result.routes[i].route[k].cityFrom = result.routes[i].route[k].cityFrom || '';
          result.routes[i].route[k].cityTo = result.routes[i].route[k].cityTo || '';
        }

        result.routes[i].route = sortRoute(result.routes[i].route);
        result.routes[i].dtime = result.routes[i].route[0].dtime;
        result.routes[i].atime =
          result.routes[i].route[result.routes[i].route.length - 1].atime;
      }

      result.routes = _.sortBy(result.routes, [function (routeObj) {
        return routeObj.dtime;
      }]);

      setTimeout(function () { // eslint-disable-line prefer-arrow-callback
        callback(result);
      }, 0);
    });
  };

  const modifyCredentials = function (params, protocolName, callback) {
    mainUtils.trace('modifyCredentials');

    // assertApp(validateEditSubscriptionReq(params), {
    //   msg: 'Params do not adhere to modifyCredentials: ' + mainUtils.getValidatorMsg(validateEditSubscriptionReq), // eslint-disable-line prefer-template
    // });

    mainUtils.sendRequest({
      url: mainUtils.SERVER_URL,
      data: {
        method: 'modify_credentials',
        params: params,
      },
      protocolName: protocolName,
    }, function (error, result) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        mainUtils.trace('Error in modifyCredentials:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      // assertPeer(validateEditSubscriptionRes(result), {
      //   msg: 'Params do not adhere to modifyCredentials: ' + mainUtils.getValidatorMsg(validateEditSubscriptionRes), // eslint-disable-line prefer-template
      // });

      setTimeout(function () { // eslint-disable-line prefer-arrow-callback
        callback(result);
      }, 0);
    });
  };
  return {
    listAirports: listAirports,
    listSubscriptions: listSubscriptions,
    creditHistory: creditHistory,
    depositHistory: depositHistory,
    exportCreditHistory: exportCreditHistory,
    getAPIKey: getAPIKey,
    unsubscribe: unsubscribe,
    subscribe: subscribe,
    search: search,
    editSubscription: editSubscription,
    modifyCredentials: modifyCredentials,
  };
}
