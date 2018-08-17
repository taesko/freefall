function getAdminAPIMethods (mainUtils) { // eslint-disable-line no-unused-vars
  const PeerError = mainUtils.PeerError;
  const assertPeer = mainUtils.assertPeer;
  const assertApp = mainUtils.assertApp;

  // const validateAdminListSubscriptionsReq =
  //   adminValidators.getValidateAdminListSubscriptionsReq();
  // const validateAdminListSubscriptionsRes =
  //   adminValidators.getValidateAdminListSubscriptionsRes();
  const validateAdminListUserSubscriptionsReq =
    adminValidators.getValidateAdminListUserSubscriptionsReq();
  const validateAdminListUserSubscriptionsRes =
    adminValidators.getValidateAdminListUserSubscriptionsRes();
  const validateAdminListGuestSubscriptionsReq =
    adminValidators.getValidateAdminListGuestSubscriptionsReq();
  const validateAdminListGuestSubscriptionsRes =
    adminValidators.getValidateAdminListGuestSubscriptionsRes();
  const validateAdminRemoveUserReq =
    adminValidators.getValidateAdminRemoveUserReq();
  const validateAdminRemoveUserRes =
    adminValidators.getValidateAdminRemoveUserRes();
  const validateAdminEditUserReq =
    adminValidators.getValidateAdminEditUserReq();
  const validateAdminEditUserRes =
    adminValidators.getValidateAdminEditUserRes();
  const validateAdminUnsubscribeReq =
    adminValidators.getValidateAdminUnsubscribeReq();
  const validateAdminUnsubscribeRes =
    adminValidators.getValidateAdminUnsubscribeRes();
  const validateAdminEditSubscriptionReq =
    adminValidators.getValidateAdminEditSubscriptionReq();
  const validateAdminEditSubscriptionRes =
    adminValidators.getValidateAdminEditSubscriptionRes();
  const validateAdminAlterUserCreditsReq =
    adminValidators.getValidateAdminAlterUserCreditsReq();
  const validateAdminAlterUserCreditsRes =
    adminValidators.getValidateAdminAlterUserCreditsRes();
  const validateAdminListUsersReq =
    adminValidators.getValidateAdminListUsersReq();
  const validateAdminListUsersRes =
    adminValidators.getValidateAdminListUsersRes();
  const validateAdminSubscribeReq =
    adminValidators.getValidateAdminSubscribeReq();
  const validateAdminSubscribeRes =
    adminValidators.getValidateAdminSubscribeRes();

  const adminListUsers = function (params, protocolName, callback) {
    mainUtils.trace('adminListUsers');

    assertApp(validateAdminListUsersReq(params), {
      msg: 'Params do not adhere to adminListUsersRequestSchema: ' + mainUtils.getValidatorMsg(validateAdminListUsersReq), // eslint-disable-line prefer-template
    });

    mainUtils.sendRequest({
      url: mainUtils.SERVER_URL,
      data: {
        method: 'admin_list_users',
        params: params,
      },
      protocolName: protocolName,
    }, function (error, result) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        mainUtils.trace('Error in adminListUsers:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateAdminListUsersRes(result), {
        msg: 'Params do not adhere to adminListUsersResponseSchema: ' + mainUtils.getValidatorMsg(validateAdminListUsersRes), // eslint-disable-line prefer-template
      });

      setTimeout(function () { // eslint-disable-line prefer-arrow-callback
        callback(result);
      }, 0);
    });
  };

  const adminRemoveUser = function (params, protocolName, callback) {
    mainUtils.trace('adminRemoveUser');

    assertApp(validateAdminRemoveUserReq(params), {
      msg: 'Params do not adhere to adminRemoveUserRequestSchema: ' + mainUtils.getValidatorMsg(validateAdminRemoveUserReq), // eslint-disable-line prefer-template
    });

    mainUtils.sendRequest({
      url: mainUtils.SERVER_URL,
      data: {
        method: 'admin_remove_user',
        params: params,
      },
      protocolName: protocolName,
    }, function (error, result) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        mainUtils.trace('Error in adminRemoveUser:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateAdminRemoveUserRes(result), {
        msg: 'Params do not adhere to adminRemoveUserResponseSchema: ' + mainUtils.getValidatorMsg(validateAdminRemoveUserRes), // eslint-disable-line prefer-template
      });

      setTimeout(function () { // eslint-disable-line prefer-arrow-callback
        callback(result);
      }, 0);
    });
  };

  const adminEditUser = function (params, protocolName, callback) {
    mainUtils.trace('adminEditUser');

    assertApp(validateAdminEditUserReq(params), {
      msg: 'Params do not adhere to adminEditUserRequestSchema: ' + mainUtils.getValidatorMsg(validateAdminEditUserReq), // eslint-disable-line prefer-template
    });

    mainUtils.sendRequest({
      url: mainUtils.SERVER_URL,
      data: {
        method: 'admin_edit_user',
        params: params,
      },
      protocolName: protocolName,
    }, function (error, result) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        mainUtils.trace('Error in adminEditUser:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateAdminEditUserRes(result), {
        msg: 'Params do not adhere to adminEditUserResponseSchema: ' + mainUtils.getValidatorMsg(validateAdminEditUserRes), // eslint-disable-line prefer-template
      });

      setTimeout(function () { // eslint-disable-line prefer-arrow-callback
        callback(result);
      }, 0);
    });
  };

  //  const adminListSubscriptions = function (params, protocolName, callback) {
  //    mainUtils.trace('adminListSubscriptions');
  //
  //    assertApp(validateAdminListSubscriptionsReq(params), {
  //      msg: 'Params do not adhere to adminListSubscriptionsRequestSchema: ' + mainUtils.getValidatorMsg(validateAdminListSubscriptionsReq), // eslint-disable-line prefer-template
  //    });
  //
  //    mainUtils.sendRequest({
  //      url: mainUtils.SERVER_URL,
  //      data: {
  //        method: 'admin_list_subscriptions',
  //        params: params,
  //      },
  //      protocolName: protocolName,
  //    }, function (error, result) { // eslint-disable-line prefer-arrow-callback
  //      if (error) {
  //        mainUtils.trace('Error in adminListSubscriptions:' + JSON.stringify(error)); // eslint-disable-line prefer-template
  //        throw new PeerError({
  //          msg: error.message,
  //        });
  //      }
  //
  //      assertPeer(validateAdminListSubscriptionsRes(result), {
  //        msg: 'Params do not adhere to adminListSubscriptionsResponseSchema: ' + mainUtils.getValidatorMsg(validateAdminListSubscriptionsRes), // eslint-disable-line prefer-template
  //      });
  //
  //      setTimeout(function () { // eslint-disable-line prefer-arrow-callback
  //        callback(result);
  //      }, 0);
  //    });
  //  };

  const adminListUserSubscriptions = function (params, protocolName, callback) {
    mainUtils.trace('adminListUserSubscriptions');

    assertApp(validateAdminListUserSubscriptionsReq(params), {
      msg: 'Params do not adhere to adminListUserSubscriptionsRequestSchema: ' + mainUtils.getValidatorMsg(validateAdminListUserSubscriptionsReq), // eslint-disable-line prefer-template
    });

    mainUtils.sendRequest({
      url: mainUtils.SERVER_URL,
      data: {
        method: 'admin_list_user_subscriptions',
        params: params,
      },
      protocolName: protocolName,
    }, function (error, result) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        mainUtils.trace('Error in adminListUserSubscriptions:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateAdminListUserSubscriptionsRes(result), {
        msg: 'Params do not adhere to adminListUserSubscriptionsResponseSchema: ' + mainUtils.getValidatorMsg(validateAdminListUserSubscriptionsRes), // eslint-disable-line prefer-template
      });

      setTimeout(function () { // eslint-disable-line prefer-arrow-callback
        callback(result);
      }, 0);
    });
  };

  const adminListGuestSubscriptions =
    function (params, protocolName, callback) {
      mainUtils.trace('adminListGuestSubscriptions');

      assertApp(validateAdminListGuestSubscriptionsReq(params), {
        msg: 'Params do not adhere to adminListGuestSubscriptionsRequestSchema: ' + mainUtils.getValidatorMsg(validateAdminListGuestSubscriptionsReq), // eslint-disable-line prefer-template
      });

      mainUtils.sendRequest({
        url: mainUtils.SERVER_URL,
        data: {
          method: 'admin_list_guest_subscriptions',
          params: params,
        },
        protocolName: protocolName,
      }, function (error, result) { // eslint-disable-line prefer-arrow-callback
        if (error) {
          mainUtils.trace('Error in adminListGuestSubscriptions:' + JSON.stringify(error)); // eslint-disable-line prefer-template
          throw new PeerError({
            msg: error.message,
          });
        }

        assertPeer(validateAdminListGuestSubscriptionsRes(result), {
          msg: 'Params do not adhere to adminListGuestSubscriptionsResponseSchema: ' + mainUtils.getValidatorMsg(validateAdminListGuestSubscriptionsRes), // eslint-disable-line prefer-template
        });

        setTimeout(function () { // eslint-disable-line prefer-arrow-callback
          callback(result);
        }, 0);
      });
    };

  const adminSubscribe = function (params, protocolName, callback) {
    mainUtils.trace('adminSubscrbe');

    assertApp(validateAdminSubscribeReq(params), {
      msg: 'Params do not adhere to adminSubscribeRequestSchema: ' + mainUtils.getValidatorMsg(validateAdminSubscribeReq), // eslint-disable-line prefer-template
    });

    mainUtils.sendRequest({
      url: mainUtils.SERVER_URL,
      data: {
        method: 'admin_subscribe',
        params: params,
      },
      protocolName: protocolName,
    }, function (error, result) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        mainUtils.trace('Error in adminSubscribe:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateAdminSubscribeRes(result), {
        msg: 'Params do not adhere to adminSubscribeResponseSchema: ' + mainUtils.getValidatorMsg(validateAdminSubscribeRes), // eslint-disable-line prefer-template
      });

      setTimeout(function () { // eslint-disable-line prefer-arrow-callback
        callback(result);
      }, 0);
    });
  };

  const adminUnsubscribe = function (params, protocolName, callback) {
    mainUtils.trace('adminUnsubscribe');

    assertApp(validateAdminUnsubscribeReq(params), {
      msg: 'Params do not adhere to adminUnsubscribeRequestSchema: ' + mainUtils.getValidatorMsg(validateAdminUnsubscribeReq), // eslint-disable-line prefer-template
    });

    mainUtils.sendRequest({
      url: mainUtils.SERVER_URL,
      data: {
        method: 'admin_unsubscribe',
        params: params,
      },
      protocolName: protocolName,
    }, function (error, result) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        mainUtils.trace('Error in adminUnsubscribe:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateAdminUnsubscribeRes(result), {
        msg: 'Params do not adhere to adminUnsubscribeResponseSchema: ' + mainUtils.getValidatorMsg(validateAdminUnsubscribeRes), // eslint-disable-line prefer-template
      });

      setTimeout(function () { // eslint-disable-line prefer-arrow-callback
        callback(result);
      }, 0);
    });
  };

  const adminEditSubscription = function (params, protocolName, callback) {
    mainUtils.trace('adminEditSubscription');

    assertApp(validateAdminEditSubscriptionReq(params), {
      msg: 'Params do not adhere to adminEditSubscriptionRequestSchema: ' + mainUtils.getValidatorMsg(validateAdminEditSubscriptionReq), // eslint-disable-line prefer-template
    });

    mainUtils.sendRequest({
      url: mainUtils.SERVER_URL,
      data: {
        method: 'admin_edit_subscription',
        params: params,
      },
      protocolName: protocolName,
    }, function (error, result) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        mainUtils.trace('Error in adminUnsubscribe:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateAdminEditSubscriptionRes(result), {
        msg: 'Params do not adhere to adminEditSubscriptionResponseSchema: ' + mainUtils.getValidatorMsg(validateAdminEditSubscriptionRes), // eslint-disable-line prefer-template
      });

      setTimeout(function () { // eslint-disable-line prefer-arrow-callback
        callback(result);
      }, 0);
    });
  };

  const adminAlterUserCredits = function (params, protocolName, callback) {
    assertApp(validateAdminAlterUserCreditsReq(params), {
      msg: 'Params do not adhere to adminAlterUserCreditsRequestSchema: ' + mainUtils.getValidatorMsg(validateAdminAlterUserCreditsReq), // eslint-disable-line prefer-template
    });

    mainUtils.sendRequest({
      url: mainUtils.SERVER_URL,
      data: {
        method: 'admin_alter_user_credits',
        params: params,
      },
      protocolName: protocolName,
    }, function (error, result) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        mainUtils.trace('Error in adminAlterUserCredits:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateAdminAlterUserCreditsRes(result), {
        msg: 'Params do not adhere to adminAlterUserCreditsResponseSchema: ' + mainUtils.getValidatorMsg(validateAdminAlterUserCreditsRes), // eslint-disable-line prefer-template
      });

      setTimeout(function () { // eslint-disable-line prefer-arrow-callback
        callback(result);
      }, 0);
    });
  };

  return {
    adminListUsers: adminListUsers,
    adminEditUser: adminEditUser,
    adminRemoveUser: adminRemoveUser,
    // adminListSubscriptions: adminListSubscriptions,
    adminListUserSubscriptions: adminListUserSubscriptions,
    adminListGuestSubscriptions: adminListGuestSubscriptions,
    adminSubscribe: adminSubscribe,
    adminUnsubscribe: adminUnsubscribe,
    adminEditSubscription: adminEditSubscription,
    adminAlterUserCredits: adminAlterUserCredits,
  };
}
