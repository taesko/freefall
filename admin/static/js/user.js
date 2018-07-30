function start () {
  const mainUtils = main();
  const user = getUserCredentials();
  const getAPIKey = mainUtils.getAPIKey;
  const trace = mainUtils.trace;
  const assertApp = mainUtils.assertApp;
  const assertPeer = mainUtils.assertPeer;
  const assertUser = mainUtils.assertUser;
  const PeerError = mainUtils.PeerError;
  const sendRequest = mainUtils.sendRequest;
  const getValidatorMsg = mainUtils.getValidatorMsg;
  const SERVER_URL = mainUtils.SERVER_URL;
  const getAirportName = mainUtils.getAirportName;
  const getAirportId = mainUtils.getAirportId;
  const listAirports = mainUtils.listAirports;
  const getUniqueId = mainUtils.getUniqueId;
  const getElementUniqueId = mainUtils.getElementUniqueId;
  const displayUserMessage = mainUtils.displayUserMessage;

  const validateErrorRes = validators.getValidateErrorRes();
  const validateAdminListSubscriptionsReq = adminValidators.getValidateAdminListSubscriptionsReq();
  const validateAdminListSubscriptionsRes = adminValidators.getValidateAdminListSubscriptionsRes();
  const validateAdminRemoveUserReq = adminValidators.getValidateAdminRemoveUserReq();
  const validateAdminRemoveUserRes = adminValidators.getValidateAdminRemoveUserRes();
  const validateAdminEditUserReq = adminValidators.getValidateAdminEditUserReq();
  const validateAdminEditUserRes = adminValidators.getValidateAdminEditUserRes();
  const validateAdminUnsubscribeReq = adminValidators.getValidateAdminUnsubscribeReq();
  const validateAdminUnsubscribeRes = adminValidators.getValidateAdminUnsubscribeRes();
  const validateAdminEditSubscriptionReq = adminValidators.getValidateAdminEditSubscriptionReq();
  const validateAdminEditSubscriptionRes = adminValidators.getValidateAdminEditSubscriptionRes();

  var APIKey; // eslint-disable-line no-var
  var subscriptions = []; // eslint-disable-line no-var
  var rowIdUserSubscriptionMap = {}; // eslint-disable-line no-var
  var airports = []; // eslint-disable-line no-var

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

      // temporary fix:
      result.guest_subscriptions = [];

      assertPeer(validateAdminListSubscriptionsRes(result), {
        msg: 'Params do not adhere to adminListSubscriptionsResponseSchema: ' + getValidatorMsg(validateAdminListSubscriptionsRes), // eslint-disable-line prefer-template
      });

      callback(result);
    });
  }

  function adminRemoveUser (params, protocolName, callback) {
    trace('adminRemoveUser');

    assertApp(validateAdminRemoveUserReq(params), {
      msg: 'Params do not adhere to adminRemoveUserRequestSchema: ' + getValidatorMsg(validateAdminRemoveUserReq), // eslint-disable-line prefer-template
    });

    sendRequest({
      url: SERVER_URL,
      data: {
        method: 'admin_remove_user',
        params: params,
      },
      protocolName: protocolName,
    }, function (result, error) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        assertPeer(validateErrorRes(error), {
          msg: 'Params do not adhere to errorResponseSchema: ' + getValidatorMsg(validateErrorRes), // eslint-disable-line prefer-template
        });

        trace('Error in adminRemoveUser:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateAdminRemoveUserRes(result), {
        msg: 'Params do not adhere to adminRemoveUserResponseSchema: ' + getValidatorMsg(validateAdminRemoveUserRes), // eslint-disable-line prefer-template
      });

      callback(result);
    });
  }

  function adminEditUser (params, protocolName, callback) {
    trace('adminEditUser');

    assertApp(validateAdminEditUserReq(params), {
      msg: 'Params do not adhere to adminEditUserRequestSchema: ' + getValidatorMsg(validateAdminEditUserReq), // eslint-disable-line prefer-template
    });

    sendRequest({
      url: SERVER_URL,
      data: {
        method: 'admin_edit_user',
        params: params,
      },
      protocolName: protocolName,
    }, function (result, error) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        assertPeer(validateErrorRes(error), {
          msg: 'Params do not adhere to errorResponseSchema: ' + getValidatorMsg(validateErrorRes), // eslint-disable-line prefer-template
        });

        trace('Error in adminEditUser:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateAdminEditUserRes(result), {
        msg: 'Params do not adhere to adminEditUserResponseSchema: ' + getValidatorMsg(validateAdminEditUserRes), // eslint-disable-line prefer-template
      });

      callback(result);
    });
  }

  function adminUnsubscribe (params, protocolName, callback) {
    trace('adminUnsubscribe');

    assertApp(validateAdminUnsubscribeReq(params), {
      msg: 'Params do not adhere to adminUnsubscribeRequestSchema: ' + getValidatorMsg(validateAdminUnsubscribeReq) // eslint-disable-line prefer-template
    });

    sendRequest({
      url: SERVER_URL,
      data: {
        method: 'admin_unsubscribe',
        params: params,
      },
      protocolName: protocolName,
    }, function (result, error) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        assertPeer(validateErrorRes(error), {
          msg: 'Params do not adhere to errorResponseSchema: ' + getValidatorMsg(validateErrorRes), // eslint-disable-line prefer-template
        });

        trace('Error in adminUnsubscribe:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateAdminUnsubscribeRes(result), {
        msg: 'Params do not adhere to adminUnsubscribeResponseSchema: ' + getValidatorMsg(validateAdminUnsubscribeRes), // eslint-disable-line prefer-template
      });

      callback(result);
    });
  }

  function adminEditSubscription (params, protocolName, callback) {
    trace('adminEditSubscription');

    assertApp(validateAdminEditSubscriptionReq(params), {
      msg: 'Params do not adhere to adminEditSubscriptionRequestSchema: ' + getValidatorMsg(validateAdminEditSubscriptionReq) // eslint-disable-line prefer-template
    });

    sendRequest({
      url: SERVER_URL,
      data: {
        method: 'admin_edit_subscription',
        params: params,
      },
      protocolName: protocolName,
    }, function (result, error) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        assertPeer(validateErrorRes(error), {
          msg: 'Params do not adhere to errorResponseSchema: ' + getValidatorMsg(validateErrorRes), // eslint-disable-line prefer-template
        });

        trace('Error in adminUnsubscribe:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateAdminEditSubscriptionRes(result), {
        msg: 'Params do not adhere to adminEditSubscriptionResponseSchema: ' + getValidatorMsg(validateAdminEditSubscriptionRes), // eslint-disable-line prefer-template
      });

      callback(result);
    });
  }

  function renderUserRow (mode, user) {
    trace('renderUserRow');

    assertApp(_.isObject(user), {
      msg: 'Expected user to be an object, but was ' + typeof user, // eslint-disable-line prefer-template
    });

    const userStringProps = ['id', 'email'];

    _.each(userStringProps, function (prop) { // eslint-disable-line prefer-arrow-callback
      assertApp(typeof user[prop] === 'string', {
        msg: 'Expected user ' + prop + ' to be a string, but was ' + typeof user[prop], // eslint-disable-line prefer-template
      });
    });

    const modes = {
      'view': renderUserRowViewMode,
      'edit': renderUserRowEditMode,
    };

    assertApp(typeof modes[mode] === 'function', {
      msg: 'Expected mode to be allowed mode, but was ' + mode, // eslint-disable-line prefer-template
    });

    modes[mode](user);
  }

  function renderUserRowViewMode (user) {
    trace('renderUserRowViewMode');

    $('#user-edit-mode').attr('hidden', 'true');

    const $userViewMode = $('#user-view-mode')
      .removeAttr('hidden');

    $userViewMode.find('#user-view-mode-id')
      .text(user.id);

    $userViewMode.find('#user-view-mode-email')
      .attr('href', '/users/' + user.id) // eslint-disable-line prefer-template
      .text(user.email);

    $userViewMode.find('#user-view-mode-credits')
      .text(user.credits);
  }

  function renderUserRowEditMode (user) {
    trace('renderUserRowEditMode');

    $('#user-view-mode').attr('hidden', 'true');

    const $userEditMode = $('#user-edit-mode')
      .removeAttr('hidden');

    $userEditMode.find('#user-edit-mode-id')
      .text(user.id);

    $userEditMode.find('#user-edit-mode-email')
      .attr('value', user.email);

    $userEditMode.find('#user-edit-mode-credits')
      .text(user.credits);
  }

  const onSaveUserClick = function (event) {
    trace('onSaveUserClick');
    displayUserMessage('Feature not implemented yet.', 'error');

    const saveButton = event.target;

    const newEmail = $('#user-edit-mode-email').val().trim();
    const newPassword = $('#user-edit-mode-password').val().trim();

    const params = {
      v: '2.0',
      api_key: APIKey,
      user_id: user.id,
    };

    if (newEmail.length > 0) {
      params.email = newEmail;
    }

    if (newPassword.length > 0) {
      params.password = newPassword;
    }

    saveButton.disabled = true;

    adminEditUser(params, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
      if (result.status_code === 2000) {
        displayUserMessage('Edit user failed with status code: ' + result.status_code, 'error'); // eslint-disable-line prefer-template
      } else if (result.status_code >= 1000 && result.status_code < 2000) {
        saveButton.disabled = false;
        renderUserRow('view', user);
        displayUserMessage('Successfully updated user!', 'success');
      }
    });
  };

  const onCancelEditUserClick = function (event) {
    trace('onCancelEditUserClick');

    renderUserRow('view', user);
  };

  const onRemoveUserClick = function (event) {
    trace('onRemoveUserClick');

    const removeButton = event.target;
    removeButton.disabled = true;

    const removeUserParams = {
      v: '2.0',
      user_id: user.id,
      api_key: APIKey,
    };

    adminRemoveUser(removeUserParams, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
      if (result.status_code === 2000) {
        displayUserMessage('Remove user failed with status code: ' + result.status_code, 'error'); // eslint-disable-line prefer-template
      } else if (result.status_code >= 1000 && result.status_code < 2000) {
        window.location.replace('/users');
      }
    });
  };

  const onEditUserClick = function (event) {
    trace('onEditUserClick');

    renderUserRow('edit', user);
  };

  function applyDatePicker () {
    const datepickerOptions = {
      dateFormat: 'yy-mm-dd',
    };

    $('.date-select').datepicker(datepickerOptions);
  }

  function applyAutocomplete (values) {
    $('.airport-select').autocomplete(values);
  }

  function showUserSubscriptionsTable () {
    $('#user-subscriptions-table').removeAttr('hidden');
    $('#no-subscriptions-msg').attr('hidden', 'true');
  }

  function hideUserSubscriptionsTable () {
    $('#no-subscriptions-msg').removeAttr('hidden');
    $('#user-subscriptions-table').attr('hidden', 'true');
  }

  function renderUserSubscriptions ($subscriptionsTable) {
    trace('renderUserSubscriptions');

    if (subscriptions.length > 0) {
      showUserSubscriptionsTable();
    } else {
      hideUserSubscriptionsTable();
    }

    assertApp($subscriptionsTable instanceof jQuery, {
      msg: 'Expected $subscriptionsTable to be instance of jQuery, but was ' + typeof $subscriptionsTable, // eslint-disable-line prefer-template
    });
    assertApp($subscriptionsTable.length === 1, {
      msg: 'Expected only one element in jQuery object, but got ' + $subscriptionsTable.length, // eslint-disable-line prefer-template
    });
    assertApp($subscriptionsTable[0] instanceof window.HTMLTableElement, {
      msg: 'Expected element in jQuery object to be HTMLTableElement, but got ' + typeof $subscriptionsTable[0], // eslint-disable-line prefer-template
    });
    assertApp(subscriptions instanceof Array, {
      msg: 'Expected subscriptions to be instance of array, but was ' + typeof subscriptions, // eslint-disable-line prefer-template
    });

    rowIdUserSubscriptionMap = {};

    _.each(subscriptions, function (subscription) { // eslint-disable-line prefer-arrow-callback
      renderUserSubscriptionRow('view', subscription);
    });
  }

  function renderUserSubscriptionRowViewMode (subscription, rowId, $row) {
    trace('renderUserSubscriptionRowViewMode');

    const $userSubscriptionViewModeClone = $('#user-subscription-view-mode').clone()
      .removeAttr('hidden')
      .attr('id', 'user-subscription-' + rowId); // eslint-disable-line prefer-template

    $userSubscriptionViewModeClone.find('#user-subscription-view-mode-airport-from')
      .attr('id', 'user-subscription-view-mode-airport-from-' + rowId) // eslint-disable-line prefer-template
      .text(getAirportName(airports, subscription.fly_from));

    $userSubscriptionViewModeClone.find('#user-subscription-view-mode-airport-to')
      .attr('id', 'user-subscription-view-mode-airport-to-' + rowId) // eslint-disable-line prefer-template
      .text(getAirportName(airports, subscription.fly_to));

    $userSubscriptionViewModeClone.find('#user-subscription-view-mode-date-from')
      .attr('id', 'user-subscription-view-mode-date-from-' + rowId) // eslint-disable-line prefer-template
      .text(subscription.date_from);

    $userSubscriptionViewModeClone.find('#user-subscription-view-mode-date-to')
      .attr('id', 'user-subscription-view-mode-date-to-' + rowId) // eslint-disable-line prefer-template
      .text(subscription.date_to);

    $userSubscriptionViewModeClone.find('#user-subscription-view-mode-edit-btn')
      .attr('id', 'user-subscription-view-mode-edit-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onEditUserSubscriptionClick);

    if ($row == null) {
      $userSubscriptionViewModeClone.appendTo(
        $('#user-subscriptions-table tbody')
      );
    } else {
      $row.replaceWith($userSubscriptionViewModeClone);
    }
  }

  function renderUserSubscriptionRowEditMode (subscription, rowId, $row) {
    trace('renderUserSubscriptionRowEditMode');

    const $userSubscriptionEditModeClone = $('#user-subscription-edit-mode').clone()
      .removeAttr('hidden')
      .attr('id', 'user-subscription-' + rowId); // eslint-disable-line prefer-template

    $userSubscriptionEditModeClone.find('#user-subscription-edit-mode-airport-from')
      .addClass('airport-select')
      .attr('id', 'user-subscription-edit-mode-airport-from-' + rowId) // eslint-disable-line prefer-template
      .attr('list', 'user-subscription-airport-from-' + rowId) // eslint-disable-line prefer-template
      .attr('value', getAirportName(airports, subscription.fly_from));

    $userSubscriptionEditModeClone.find('#user-subscription-edit-mode-airport-to')
      .addClass('airport-select')
      .attr('id', 'user-subscription-edit-mode-airport-to-' + rowId) // eslint-disable-line prefer-template
      .attr('list', 'user-subscription-airport-to-' + rowId) // eslint-disable-line prefer-template
      .attr('value', getAirportName(airports, subscription.fly_to));

    $userSubscriptionEditModeClone.find('#user-subscription-edit-mode-date-from')
      .addClass('date-select') // Necessary!! items with date-select class will be used with jQuery datepicker (see function applyDatePicker).
      // datepicker won't work with the new clone element if the original cloned element has date-select class (datepicker adds hasDatepicker class and ignores elements with this class)
      .attr('id', 'user-subscription-edit-mode-date-from-' + rowId) // eslint-disable-line prefer-template
      .attr('value', subscription.date_from);

    $userSubscriptionEditModeClone.find('#user-subscription-edit-mode-date-to')
      .addClass('date-select') // Necessary!! items with date-select class will be used with jQuery datepicker (see function applyDatePicker).
      // datepicker won't work with the new clone element if the original cloned element has date-select class (datepicker adds hasDatepicker class and ignores elements with this class)
      .attr('id', 'user-subscription-edit-mode-date-to-' + rowId) // eslint-disable-line prefer-template
      .attr('value', subscription.date_to);

    $userSubscriptionEditModeClone.find('#user-subscription-edit-mode-save-btn')
      .attr('id', 'user-subscription-edit-mode-save-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onSaveUserSubscriptionClick);

    $userSubscriptionEditModeClone.find('#user-subscription-edit-mode-cancel-btn')
      .attr('id', 'user-subscription-edit-mode-cancel-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onCancelUserSubscriptionClick);

    $userSubscriptionEditModeClone.find('#user-subscription-edit-mode-remove-btn')
      .attr('id', 'user-subscription-edit-mode-remove-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onRemoveUserSubscriptionClick);

    $row.replaceWith($userSubscriptionEditModeClone);
  }

  function renderUserSubscriptionRow (mode, subscription, $row) {
    trace('renderUserSubscriptionRow');

    assertApp(_.isObject(subscription), {
      msg: 'Expected subscription to be an object, but was ' + typeof subscription, // eslint-disable-line prefer-template
    });

    const subscriptionStringProps = ['id', 'fly_from', 'fly_to', 'date_from', 'date_to'];

    _.each(subscriptionStringProps, function (prop) { // eslint-disable-line prefer-arrow-callback
      assertApp(typeof subscription[prop] === 'string', {
        msg: 'Expected subscription ' + prop + ' to be a string, but was ' + typeof subscription[prop], // eslint-disable-line prefer-template
      });
    });

    assertApp(_.isObject(subscription.user), {
      msg: 'Expected subscription.user to be an object, but was ' + typeof subscription.user, // eslint-disable-line prefer-template
    });

    const userStringProps = ['id', 'email'];

    _.each(userStringProps, function (prop) { // eslint-disable-line prefer-arrow-callback
      assertApp(typeof subscription.user[prop] === 'string', {
        msg: 'Expected user ' + prop + ' to be a string, but was ' + typeof subscription.user[prop], // eslint-disable-line prefer-template
      });
    });

    assertApp(
      $row == null ||
      $row instanceof jQuery, {
        msg: 'Unexpected type of $row ' + typeof $row, // eslint-disable-line prefer-template
      }
    );

    var rowId = // eslint-disable-line no-var
      ($row == null) ? String(getUniqueId())
        : getElementUniqueId($row[0], 'user-subscription-');

    rowIdUserSubscriptionMap[rowId] = subscription;

    const modes = {
      'view': renderUserSubscriptionRowViewMode,
      'edit': renderUserSubscriptionRowEditMode,
    };

    assertApp(typeof modes[mode] === 'function', {
      msg: 'Expected mode to be allowed mode, but was ' + mode, // eslint-disable-line prefer-template
    });

    modes[mode](subscription, rowId, $row);

    applyDatePicker();
    applyAutocomplete(airports.map(function (airport) { // eslint-disable-line prefer-arrow-callback
      return airport.name;
    }));
  }

  const onEditUserSubscriptionClick = function (event) {
    trace('onEditUserSubscriptionClick');

    const rowId = getElementUniqueId(event.target, 'user-subscription-view-mode-edit-btn-');
    const userSubscription = rowIdUserSubscriptionMap[rowId];

    renderUserSubscriptionRow(
      'edit',
      userSubscription,
      $('#user-subscription-' + rowId) // eslint-disable-line prefer-template
    );
  };

  const onCancelUserSubscriptionClick = function (event) {
    trace('onCancelUserSubscriptionClick');

    const rowId = getElementUniqueId(event.target, 'user-subscription-edit-mode-cancel-btn-');
    const userSubscription = rowIdUserSubscriptionMap[rowId];

    renderUserSubscriptionRow(
      'view',
      userSubscription,
      $('#user-subscription-' + rowId) // eslint-disable-line prefer-template
    );
  };

  const onRemoveUserSubscriptionClick = function (event) {
    trace('onRemoveUserSubscriptionClick');

    const removeButton = event.target;

    const rowId = getElementUniqueId(removeButton, 'user-subscription-edit-mode-remove-btn-');
    const oldSubscription = rowIdUserSubscriptionMap[rowId];

    removeButton.disabled = true;

    const unsubscribeParams = {
      v: '2.0',
      user_subscription_id: oldSubscription.id,
      api_key: APIKey,
    };

    adminUnsubscribe(unsubscribeParams, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
      if (result.status_code === 2000) {
        displayUserMessage('Remove user subscription failed with status code: ' + result.status_code, 'error'); // eslint-disable-line prefer-template
        removeButton.disabled = false;
      } else if (result.status_code >= 1000 && result.status_code < 2000) {
        removeButton.disabled = false;

        subscriptions = subscriptions.filter(function (subscription) { // eslint-disable-line prefer-arrow-callback
          return subscription.id !== oldSubscription.id;
        });

        delete rowIdUserSubscriptionMap[rowId];

        $('#user-subscription-' + rowId).remove(); // eslint-disable-line prefer-template

        if (subscriptions.length > 0) {
          showUserSubscriptionsTable();
        } else {
          hideUserSubscriptionsTable();
        }

        displayUserMessage('Successfully deleted user subscription!', 'success');
      }
    });
  };

  const onSaveUserSubscriptionClick = function (event) {
    trace('onSaveUserSubscriptionClick');

    const saveButton = event.target;

    const rowId = getElementUniqueId(saveButton, 'user-subscription-edit-mode-save-btn-');
    const oldSubscription = rowIdUserSubscriptionMap[rowId];

    const airportFrom = $('#user-subscription-edit-mode-airport-from-' + rowId).val().trim(); // eslint-disable-line prefer-template
    const airportTo = $('#user-subscription-edit-mode-airport-to-' + rowId).val().trim(); // eslint-disable-line prefer-template
    const dateFrom = $('#user-subscription-edit-mode-date-from-' + rowId).val().trim(); // eslint-disable-line prefer-template
    const dateTo = $('#user-subscription-edit-mode-date-to-' + rowId).val().trim(); // eslint-disable-line prefer-template

    const airportFromId = getAirportId(airports, airportFrom);
    const airportToId = getAirportId(airports, airportTo);

    assertUser(typeof airportFromId === 'string', {
      userMessage: 'Could not find selected departure airport.',
      msg: 'Expected airportFromId to be a string, but was ' + typeof airportFromId, // eslint-disable-line prefer-template
    });

    assertUser(typeof airportToId === 'string', {
      userMessage: 'Could not find selected arrival airport.',
      msg: 'Expected airportToId to be a string, but was ' + typeof airportToId, // eslint-disable-line prefer-template
    });

    saveButton.disabled = true;

    const editSubscriptionParams = {
      v: '2.0',
      api_key: APIKey,
      user_subscription_id: oldSubscription.id,
      fly_from: airportFromId,
      fly_to: airportToId,
      date_from: dateFrom,
      date_to: dateTo,
    };

    adminEditSubscription(editSubscriptionParams, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
      saveButton.disabled = false;

      if (result.status_code < 1000 || result.status_code >= 2000) {
        displayUserMessage('Edit user subscription failed with status code: ' + result.status_code, 'error'); // eslint-disable-line prefer-template
      } else {
        const newSubscription = {
          id: oldSubscription.id,
          user: oldSubscription.user,
          fly_from: airportFromId,
          fly_to: airportToId,
          date_from: dateFrom,
          date_to: dateTo,
        };

        rowIdUserSubscriptionMap[rowId] = newSubscription;
        subscriptions = subscriptions.map(function (subscription) { // eslint-disable-line prefer-arrow-callback
          if (subscription.id !== oldSubscription.id) {
            return subscription;
          }
          return newSubscription;
        });

        renderUserSubscriptionRow(
          'view',
          newSubscription,
          $('#user-subscription-' + rowId) // eslint-disable-line prefer-template
        );

        displayUserMessage('Successfully edited user subscription!', 'success');
      }
    });
  };

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    getAPIKey({
      v: '2.0',
    }, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
      if (result.status_code < 1000 || result.status_code >= 2000) {
        window.location.replace('/login');
      } else {
        APIKey = result.api_key;

        const params = {
          v: '2.0',
          user_id: user.id,
          api_key: APIKey,
        };

        listAirports('jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
          airports = result.airports;

          const adminListSubscriptionsCallback = function (result) {
            subscriptions = result.user_subscriptions;

            renderUserSubscriptions($('#user-subscriptions-table'));
          };

          adminListSubscriptions(params, 'jsonrpc', adminListSubscriptionsCallback);
        });
      }
    });

    renderUserRow('view', user);

    $('#user-view-mode-edit-btn').click(onEditUserClick);
    $('#user-edit-mode-save-btn').click(onSaveUserClick);
    $('#user-edit-mode-cancel-btn').click(onCancelEditUserClick);
    $('#user-edit-mode-remove-btn').click(onRemoveUserClick);
  });
}

start();
