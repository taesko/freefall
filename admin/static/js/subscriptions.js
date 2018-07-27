function start () {
  const mainUtils = main();
  const trace = mainUtils.trace;
  const assertApp = mainUtils.assertApp;
  const assertUser = mainUtils.assertUser;
  const getAirportName = mainUtils.getAirportName;
  const getAirportId = mainUtils.getAirportId;
  const getUniqueId = mainUtils.getUniqueId;
  const getAPIKey = mainUtils.getAPIKey;
  const listAirports = mainUtils.listAirports;
  const getElementUniqueId = mainUtils.getElementUniqueId;
  const sendRequest = mainUtils.sendRequest;
  const getValidatorMsg = mainUtils.getValidatorMsg;
  const SERVER_URL = mainUtils.SERVER_URL;
  const assertPeer = mainUtils.assertPeer;
  const PeerError = mainUtils.PeerError;
  const UserError = mainUtils.UserError;
  const displayUserMessage = mainUtils.displayUserMessage;
  const validateErrorRes = validators.getValidateErrorRes();
  const validateAdminListSubscriptionsReq = adminValidators.getValidateAdminListSubscriptionsReq();
  const validateAdminListSubscriptionsRes = adminValidators.getValidateAdminListSubscriptionsRes();
  const validateAdminSubscribeReq = adminValidators.getValidateAdminSubscribeReq();
  const validateAdminSubscribeRes = adminValidators.getValidateAdminSubscribeRes();
  const validateAdminUnsubscribeReq = adminValidators.getValidateAdminUnsubscribeReq();
  const validateAdminUnsubscribeRes = adminValidators.getValidateAdminUnsubscribeRes();
  const validateAdminEditSubscriptionReq = adminValidators.getValidateAdminEditSubscriptionReq();
  const validateAdminEditSubscriptionRes = adminValidators.getValidateAdminEditSubscriptionRes();

  var airports = []; // eslint-disable-line no-var
  var userSubscriptions = []; // eslint-disable-line no-var
  var rowIdUserSubscriptionMap = {}; // eslint-disable-line no-var
  var guestSubscriptions = []; // eslint-disable-line no-var
  var rowIdGuestSubscriptionMap = {}; // eslint-disable-line no-var
  var APIKey; // eslint-disable-line no-var

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

  function showGuestSubscriptionsTable () {
    $('#guest-subscriptions-table').removeAttr('hidden');
    $('#no-subscriptions-msg').attr('hidden', 'true');
  }

  function hideGuestSubscriptionsTable () {
    $('#no-subscriptions-msg').removeAttr('hidden');
    $('#guest-subscriptions-table').attr('hidden', 'true');
  }

  function renderGuestSubscriptions ($guestSubscriptionsTable) {
    trace('renderGuestSubscriptions');

    if (guestSubscriptions.length > 0) {
      showGuestSubscriptionsTable();
    } else {
      hideGuestSubscriptionsTable();
    }

    assertApp($guestSubscriptionsTable instanceof jQuery, {
      msg: 'Expected $guestSubscriptionsTable to be instance of jQuery, but was ' + typeof $guestSubscriptionsTable, // eslint-disable-line prefer-template
    });
    assertApp($guestSubscriptionsTable.length === 1, {
      msg: 'Expected only one element in jQuery object, but got ' + $guestSubscriptionsTable.length, // eslint-disable-line prefer-template
    });
    assertApp($guestSubscriptionsTable[0] instanceof window.HTMLTableElement, {
      msg: 'Expected element in jQuery object to be HTMLTableElement, but got ' + typeof $guestSubscriptionsTable[0], // eslint-disable-line prefer-template
    });
    assertApp(userSubscriptions instanceof Array, {
      msg: 'Expected userSubscriptions to be instance of array, but was ' + typeof userSubscriptions, // eslint-disable-line prefer-template
    });

    rowIdGuestSubscriptionMap = {};

    _.each(guestSubscriptions, function (subscription) { // eslint-disable-line prefer-arrow-callback
      renderGuestSubscriptionRow('view', subscription);
    });
  }

  function renderGuestSubscriptionRow (mode, subscription, $row) {
    trace('renderGuestSubscriptionRow');

    assertApp(_.isObject(subscription), {
      msg: 'Expected subscription to be an object, but was ' + typeof subscription, // eslint-disable-line prefer-template
    });

    const subscriptionStringProps = ['id', 'fly_from', 'fly_to'];

    _.each(subscriptionStringProps, function (prop) { // eslint-disable-line prefer-arrow-callback
      assertApp(typeof subscription[prop] === 'string', {
        msg: 'Expected subscription ' + prop + ' to be a string, but was ' + typeof subscription[prop], // eslint-disable-line prefer-template
      });
    });

    assertApp(
      $row == null ||
      $row instanceof jQuery,
      'Unexpected type of $row ' + typeof $row, // eslint-disable-line prefer-template
    );

    var rowId = // eslint-disable-line no-var
      ($row == null) ? String(getUniqueId())
        : getElementUniqueId($row[0], 'guest-subscription-');

    rowIdGuestSubscriptionMap[rowId] = subscription;

    const modes = {
      'view': renderGuestSubscriptionRowViewMode,
      'edit': renderGuestSubscriptionRowEditMode,
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

  function renderGuestSubscriptionRowViewMode (subscription, rowId, $row) {
    trace('renderGuestSubscriptionRowViewMode');

    const $guestSubscriptionViewModeClone = $('#guest-subscription-view-mode').clone()
      .removeAttr('hidden')
      .attr('id', 'guest-subscription-' + rowId); // eslint-disable-line prefer-template

    $guestSubscriptionViewModeClone.find('#guest-subscription-view-mode-airport-from')
      .attr('id', 'guest-subscription-view-mode-airport-from-' + rowId) // eslint-disable-line prefer-template
      .text(getAirportName(airports, subscription.fly_from));

    $guestSubscriptionViewModeClone.find('#guest-subscription-view-mode-airport-to')
      .attr('id', 'guest-subscription-view-mode-airport-to-' + rowId) // eslint-disable-line prefer-template
      .text(getAirportName(airports, subscription.fly_to));

    $guestSubscriptionViewModeClone.find('#guest-subscription-view-mode-edit-btn')
      .attr('id', 'guest-subscription-view-mode-edit-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onEditGuestSubscriptionClick);

    if ($row == null) {
      $guestSubscriptionViewModeClone.appendTo(
        $('#guest-subscriptions-table tbody')
      );
    } else {
      $row.replaceWith($guestSubscriptionViewModeClone);
    }
  }

  function renderGuestSubscriptionRowEditMode (subscription, rowId, $row) {
    trace('renderGuestSubscriptionRowEditMode');

    const $guestSubscriptionEditModeClone = $('#guest-subscription-edit-mode').clone()
      .removeAttr('hidden')
      .attr('id', 'guest-subscription-' + rowId); // eslint-disable-line prefer-template

    $guestSubscriptionEditModeClone.find('#guest-subscription-edit-mode-airport-from')
      .addClass('airport-select')
      .attr('id', 'guest-subscription-edit-mode-airport-from-' + rowId) // eslint-disable-line prefer-template
      .attr('list', 'guest-subscription-airport-from-' + rowId) // eslint-disable-line prefer-template
      .attr('value', getAirportName(airports, subscription.fly_from));

    $guestSubscriptionEditModeClone.find('#guest-subscription-edit-mode-airport-to')
      .addClass('airport-select')
      .attr('id', 'guest-subscription-edit-mode-airport-to-' + rowId) // eslint-disable-line prefer-template
      .attr('list', 'guest-subscription-airport-to-' + rowId) // eslint-disable-line prefer-template
      .attr('value', getAirportName(airports, subscription.fly_to));

    $guestSubscriptionEditModeClone.find('#guest-subscription-edit-mode-save-btn')
      .attr('id', 'guest-subscription-edit-mode-save-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onSaveGuestSubscriptionClick);

    $guestSubscriptionEditModeClone.find('#guest-subscription-edit-mode-cancel-btn')
      .attr('id', 'guest-subscription-edit-mode-cancel-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onCancelGuestSubscriptionClick);

    $guestSubscriptionEditModeClone.find('#guest-subscription-edit-mode-remove-btn')
      .attr('id', 'guest-subscription-edit-mode-remove-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onRemoveGuestSubscriptionClick);

    $row.replaceWith($guestSubscriptionEditModeClone);
  }

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

  function adminSubscribe (params, protocolName, callback) {
    trace('adminSubscrbe');

    assertApp(validateAdminSubscribeReq(params), {
      msg: 'Params do not adhere to adminSubscribeRequestSchema: ' + getValidatorMsg(validateAdminSubscribeReq), // eslint-disable-line prefer-template
    });

    sendRequest({
      url: SERVER_URL,
      data: {
        method: 'admin_subscribe',
        params: params,
      },
      protocolName: protocolName,
    }, function (result, error) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        assertPeer(validateErrorRes(error), {
          msg: 'Params do not adhere to errorResponseSchema: ' + getValidatorMsg(validateErrorRes), // eslint-disable-line prefer-template
        });

        trace('Error in adminSubscribe:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateAdminSubscribeRes(result), {
        msg: 'Params do not adhere to adminSubscribeResponseSchema: ' + getValidatorMsg(validateAdminSubscribeRes), // eslint-disable-line prefer-template
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

  const onEditGuestSubscriptionClick = function (event) {
    trace('onEditGuestSubscriptionClick');

    displayUserMessage('Warning: this is a preview of edit guest subscription functionality. Work is in progess to implement this feature.', 'info');

    const rowId = getElementUniqueId(event.target, 'guest-subscription-view-mode-edit-btn-');
    const subscription = rowIdGuestSubscriptionMap[rowId];

    renderGuestSubscriptionRow(
      'edit',
      subscription,
      $('#guest-subscription-' + rowId) // eslint-disable-line prefer-template
    );
  };

  const onCancelGuestSubscriptionClick = function (event) {
    trace('onCancelGuestSubscriptionClick');

    const rowId = getElementUniqueId(event.target, 'guest-subscription-edit-mode-cancel-btn-');
    const subscription = rowIdGuestSubscriptionMap[rowId];

    renderGuestSubscriptionRow(
      'view',
      subscription,
      $('#guest-subscription-' + rowId) // eslint-disable-line prefer-template
    );
  };

  const onSaveGuestSubscriptionClick = function (event) {
    trace('onSaveGuestSubscriptionClick');

    throw new UserError({
      userMessage: 'Feature not implemented yet.',
      msg: 'Save guest subscription not implemented yet.',
    });

    const saveButton = event.target;

    const rowId = getElementUniqueId(saveButton, 'guest-subscription-edit-mode-save-btn-');
    const oldSubscription = rowIdGuestSubscriptionMap[rowId];

    const airportFrom = $('#guest-subscription-edit-mode-airport-from-' + rowId).val(); // eslint-disable-line prefer-template
    const airportTo = $('#guest-subscription-edit-mode-airport-to-' + rowId).val(); // eslint-disable-line prefer-template

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

    // TODO send request

    saveButton.disabled = false;

    const newSubscription = {
      id: oldSubscription.id, // result.subscription_id,
      fly_from: airportFromId,
      fly_to: airportToId,
    };

    rowIdGuestSubscriptionMap[rowId] = newSubscription;
    guestSubscriptions = guestSubscriptions.map(function (subscription) { // eslint-disable-line prefer-arrow-callback
      if (subscription.id !== oldSubscription.id) {
        return subscription;
      }
      return newSubscription;
    });

    renderGuestSubscriptionRow(
      'view',
      newSubscription,
      $('#guest-subscription-' + rowId) // eslint-disable-line prefer-template
    );
  };

  const onRemoveGuestSubscriptionClick = function (event) {
    trace('onRemoveGuestSubscriptionClick');

    throw new UserError({
      userMessage: 'Feature not implemented yet.',
      msg: 'Save guest subscription not implemented yet.',
    });

    const removeButton = event.target;

    const rowId = getElementUniqueId(removeButton, 'guest-subscription-edit-mode-remove-btn-');
    const oldSubscription = rowIdGuestSubscriptionMap[rowId];

    removeButton.disabled = true;

    // TODO send request to server

    removeButton.disabled = false;

    guestSubscriptions = guestSubscriptions.filter(function (subscription) { // eslint-disable-line prefer-arrow-callback
      return subscription.id !== oldSubscription.id;
    });

    delete rowIdGuestSubscriptionMap[rowId];

    $('#guest-subscription-' + rowId).remove(); // eslint-disable-line prefer-template

    if (guestSubscriptions.length > 0) {
      showGuestSubscriptionsTable();
    } else {
      hideGuestSubscriptionsTable();
    }
  };

  const onSubscribeSubmit = function (event) {
    trace('subscribe submit button clicked');

    throw new UserError({
      userMessage: 'Feature not implemented yet.',
      msg: 'Save guest subscription not implemented yet.',
    });
  };

  function renderUserSubscriptions ($userSubscriptionsTable) {
    trace('renderUserSubscriptions');

    if (userSubscriptions.length > 0) {
      showUserSubscriptionsTable();
    } else {
      hideUserSubscriptionsTable();
    }

    assertApp($userSubscriptionsTable instanceof jQuery, {
      msg: 'Expected $userSubscriptionsTable to be instance of jQuery, but was ' + typeof $userSubscriptionsTable, // eslint-disable-line prefer-template
    });
    assertApp($userSubscriptionsTable.length === 1, {
      msg: 'Expected only one element in jQuery object, but got ' + $userSubscriptionsTable.length, // eslint-disable-line prefer-template
    });
    assertApp($userSubscriptionsTable[0] instanceof window.HTMLTableElement, {
      msg: 'Expected element in jQuery object to be HTMLTableElement, but got ' + typeof $userSubscriptionsTable[0], // eslint-disable-line prefer-template
    });
    assertApp(userSubscriptions instanceof Array, {
      msg: 'Expected userSubscriptions to be instance of array, but was ' + typeof userSubscriptions, // eslint-disable-line prefer-template
    });

    rowIdUserSubscriptionMap = {};

    _.each(userSubscriptions, function (subscription) { // eslint-disable-line prefer-arrow-callback
      renderUserSubscriptionRow('view', subscription);
    });
  }

  function renderUserSubscriptionRowViewMode (subscription, rowId, $row) {
    trace('renderUserSubscriptionRowViewMode');

    const $userSubscriptionViewModeClone = $('#user-subscription-view-mode').clone()
      .removeAttr('hidden')
      .attr('id', 'user-subscription-' + rowId); // eslint-disable-line prefer-template

    $userSubscriptionViewModeClone.find('#user-subscription-view-mode-user-email')
      .attr('id', 'user-subscription-view-mode-user-email-' + rowId) // eslint-disable-line prefer-template
      .attr('href', '/users/' + subscription.user.id) // eslint-disable-line prefer-template
      .text(subscription.user.email);

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

    $userSubscriptionEditModeClone.find('#user-subscription-edit-mode-user-email')
      .attr('id', 'user-subscription-edit-mode-user-email-' + rowId) // eslint-disable-line prefer-template
      .attr('href', '/users/' + subscription.user.id) // eslint-disable-line prefer-template
      .text(subscription.user.email);

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
      $row instanceof jQuery,
      'Unexpected type of $row ' + typeof $row, // eslint-disable-line prefer-template
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
    trace('edit user subscription button click');

    const rowId = getElementUniqueId(event.target, 'user-subscription-view-mode-edit-btn-');
    const subscription = rowIdUserSubscriptionMap[rowId];

    renderUserSubscriptionRow(
      'edit',
      subscription,
      $('#user-subscription-' + rowId) // eslint-disable-line prefer-template
    );
  };

  const onCancelUserSubscriptionClick = function (event) {
    trace('user subscription cancel button click');

    const rowId = getElementUniqueId(event.target, 'user-subscription-edit-mode-cancel-btn-');
    const subscription = rowIdUserSubscriptionMap[rowId];

    renderUserSubscriptionRow(
      'view',
      subscription,
      $('#user-subscription-' + rowId) // eslint-disable-line prefer-template
    );
  };

  const onSaveUserSubscriptionClick = function (event) {
    trace('user subscription save button click');

    const saveButton = event.target;

    const rowId = getElementUniqueId(saveButton, 'user-subscription-edit-mode-save-btn-');
    const oldSubscription = rowIdUserSubscriptionMap[rowId];

    const airportFrom = $('#user-subscription-edit-mode-airport-from-' + rowId).val(); // eslint-disable-line prefer-template
    const airportTo = $('#user-subscription-edit-mode-airport-to-' + rowId).val(); // eslint-disable-line prefer-template
    const dateFrom = $('#user-subscription-edit-mode-date-from-' + rowId).val(); // eslint-disable-line prefer-template
    const dateTo = $('#user-subscription-edit-mode-date-to-' + rowId).val(); // eslint-disable-line prefer-template

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
        userSubscriptions = userSubscriptions.map(function (subscription) { // eslint-disable-line prefer-arrow-callback
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

  const onRemoveUserSubscriptionClick = function (event) {
    trace('user subscription remove button click');

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
      } else if (result.status_code >= 1000 && result.status_code < 2000) {
        removeButton.disabled = false;

        userSubscriptions = userSubscriptions.filter(function (subscription) { // eslint-disable-line prefer-arrow-callback
          return subscription.id !== oldSubscription.id;
        });

        delete rowIdUserSubscriptionMap[rowId];

        $('#user-subscription-' + rowId).remove(); // eslint-disable-line prefer-template

        if (userSubscriptions.length > 0) {
          showUserSubscriptionsTable();
        } else {
          hideUserSubscriptionsTable();
        }
        displayUserMessage('Successfully removed user subscription!', 'success');
      }
    });
  };

  const onUserSubscriptionsTabClick = function () {
    trace('clicked users tab');

    if (userSubscriptions.length > 0) {
      showUserSubscriptionsTable();
    } else {
      hideUserSubscriptionsTable();
    }

    $('#user-subscriptions-section').removeAttr('hidden');
    $('#guest-subscriptions-section').attr('hidden', 'true');

    $('#user-subscriptions-tab').parent().addClass('active');
    $('#guest-subscriptions-tab').parent().removeClass('active');
  };

  const onGuestSubscriptionsTabClick = function () {
    trace('clicked guest tab');

    if (guestSubscriptions.length > 0) {
      showGuestSubscriptionsTable();
    } else {
      hideGuestSubscriptionsTable();
    }

    $('#guest-subscriptions-section').removeAttr('hidden');
    $('#user-subscriptions-section').attr('hidden', 'true');

    $('#guest-subscriptions-tab').parent().addClass('active');
    $('#user-subscriptions-tab').parent().removeClass('active');
  };

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    const $userSubscriptionsTab = $('#user-subscriptions-tab');
    const $guestSubscriptionsTab = $('#guest-subscriptions-tab');
    const $subscribeSubmitBtn = $('#subscribe-submit-btn');

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

        adminListSubscriptions(params, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
          userSubscriptions = result.user_subscriptions;
          guestSubscriptions = result.guest_subscriptions;

          renderUserSubscriptions($('#user-subscriptions-table'));
          renderGuestSubscriptions($('#guest-subscriptions-table'));
        });
      }
    });

    listAirports('jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
      airports = result.airports;

      const toAirportName = function (airport) { // eslint-disable-line prefer-arrow-callback
        return airport.name;
      };

      const airportNames = airports.map(toAirportName);

      // userSubscriptions = [
      //   {
      //     id: '2',
      //     user: {
      //       id: '5',
      //       email: 'sample@text.com',
      //     },
      //     fly_from: '2',
      //     fly_to: '3',
      //     date_from: '2018-07-23',
      //     date_to: '2018-10-23',
      //   },
      //   {
      //     id: '3',
      //     user: {
      //       id: '6',
      //       email: 'sample@yahoo.com',
      //     },
      //     fly_from: '3',
      //     fly_to: '2',
      //     date_from: '2018-08-23',
      //     date_to: '2018-11-23',
      //   },
      // ];
      // guestSubscriptions = [
      //   {
      //     id: '4',
      //     fly_from: '1',
      //     fly_to: '5',
      //   },
      //   {
      //     id: '6',
      //     fly_from: '1',
      //     fly_to: '18',
      //   },
      // ];

      $userSubscriptionsTab.click(onUserSubscriptionsTabClick);
      $guestSubscriptionsTab.click(onGuestSubscriptionsTabClick);

      // renderUserSubscriptions($('#user-subscriptions-table'));
      // renderGuestSubscriptions($('#guest-subscriptions-table'));

      applyAutocomplete(airportNames);
    });

    $subscribeSubmitBtn.click(onSubscribeSubmit);

    applyDatePicker();
  });
}

start();
