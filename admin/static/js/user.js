function start () {
  const mainUtils = main();
  const getAPIKey = mainUtils.getAPIKey;
  const trace = mainUtils.trace;
  const assertApp = mainUtils.assertApp;
  const assertPeer = mainUtils.assertPeer;
  const PeerError = mainUtils.PeerError;
  const sendRequest = mainUtils.sendRequest;
  const getValidatorMsg = mainUtils.getValidatorMsg;
  const SERVER_URL = mainUtils.SERVER_URL;

  const validateErrorRes = validators.getValidateErrorRes();
  const validateAdminListSubscriptionsReq = adminValidators.getValidateAdminListSubscriptionsReq();
  const validateAdminListSubscriptionsRes = adminValidators.getValidateAdminListSubscriptionsRes();

  var APIKey; // eslint-disable-line no-var

  function adminListSubscriptions (params, protocolName, callback) {
    trace('adminListSubscriptions');

    assertApp(validateAdminListSubscriptionsReq(params), {
      msg: 'Params do not adhere to adminListSubscriptionsRequestSchema: ' + getValidatorMsg(validateAdminListSubscriptionsReq), // eslint-disable-line prefer-template
    });

    sendRequest({
      url: SERVER_URL,
      data: {
        method: 'admin_list_subscriptions',
        params: params,
      },
      protocolName: protocolName,
    }, function (result, error) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        assertPeer(validateErrorRes(error), {
          msg: 'Params do not adhere to errorResponseSchema: ' + getValidatorMsg(validateErrorRes), // eslint-disable-line prefer-template
        });

        trace('Error in adminListSubscriptions:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateAdminListSubscriptionsRes(result), {
        msg: 'Params do not adhere to adminListSubscriptionsResponseSchema: ' + getValidatorMsg(validateAdminListSubscriptionsRes), // eslint-disable-line prefer-template
      });

      callback(result);
    });
  }

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    console.log(user);
    getAPIKey({
      v: '2.0',
    }, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
      if (result.status_code < 1000 || result.status_code >= 2000) {
        window.location.replace('/login');
      } else {
        APIKey = result.api_key;

        const params = {
          v: '2.0',
          api_key: APIKey,
        };

        // adminListUsers(params, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
        //   users = result.users;

        //   renderUsers($('#users-table'));
        // });
      }
    });
  });
}

start();
