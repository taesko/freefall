function start () {
  const mainUtils = main();
  const assertApp = mainUtils.assertApp;
  const assertPeer = mainUtils.assertPeer;
  const assertUser = mainUtils.assertUser;
  const UserError = mainUtils.UserError;
  const PROTOCOL_NAME = mainUtils.PROTOCOL_NAME;
  const APIKeyRef = mainUtils.APIKeyRef;

  const adminAPI = getAdminAPIMethods(mainUtils);
  const api = getAPIMethods(mainUtils);

  var subscriptions = []; // eslint-disable-line no-var
  var rowIdUserSubscriptionMap = {}; // eslint-disable-line no-var
  var airports = []; // eslint-disable-line no-var

  function getAirportName (airports, id) {
    mainUtils.trace('getAirportName(airports, ' + id + '), typeof arg=' + typeof id + ''); // eslint-disable-line prefer-template

    assertApp(airports instanceof Array, {
      msg: 'Expected airports to be instance of array, but was ' + typeof airports, // eslint-disable-line prefer-template
    });

    assertApp(typeof id === 'string', {
      msg: 'Expected id to be a string, but was ' + typeof id, // eslint-disable-line prefer-template
    });

    var i; // eslint-disable-line no-var

    for (i = 0; i < airports.length; i++) {
      const expectedProps = ['id', 'name'];

      _.each(expectedProps, function (prop) { // eslint-disable-line prefer-arrow-callback
        assertApp(typeof airports[i][prop] === 'string', {
          msg: 'Expected airport ' + prop + ' to be string, but was ' + typeof airports[i][prop], // eslint-disable-line prefer-template
        });
      });

      if (airports[i].id === id) {
        return airports[i].name;
      }
    }

    throw new UserError({
      msg: 'Could not find airport with id ' + id, // eslint-disable-line prefer-template
    });
  }

  function getAirportId (airports, name) {
    mainUtils.trace('getAirportId(airports, ' + name + '), typeof arg=' + typeof name + ''); // eslint-disable-line prefer-template

    assertApp(airports instanceof Array, {
      msg: 'Expected airports to be instance of array, but was ' + typeof airports, // eslint-disable-line prefer-template
    });

    assertApp(typeof name === 'string', {
      msg: 'Expected name to be a string, but was ' + typeof name, // eslint-disable-line prefer-template
    });

    const normalizedName = name.trim().toLowerCase();

    var i; // eslint-disable-line no-var
    for (i = 0; i < airports.length; i++) {
      const expectedProps = ['id', 'name'];

      _.each(expectedProps, function (prop) { // eslint-disable-line prefer-arrow-callback
        assertApp(typeof airports[i][prop] === 'string', {
          msg: 'Expected airport ' + prop + ' to be string, but was ' + typeof airports[i][prop], // eslint-disable-line prefer-template
        });
      });

      if (airports[i].name.trim().toLowerCase() === normalizedName) {
        return airports[i].id;
      }
    }

    return null;
  }

  function renderUserRow (mode, user) {
    mainUtils.trace('renderUserRow');

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
    mainUtils.trace('renderUserRowViewMode');

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
    mainUtils.trace('renderUserRowEditMode');

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
    mainUtils.trace('onSaveUserClick');

    const saveButton = event.target;

    const newEmail = $('#user-edit-mode-email').val().trim();
    const newPassword = $('#user-edit-mode-password').val().trim();

    const params = {
      v: '2.0',
      api_key: APIKeyRef.APIKey,
      user_id: userGlobal.id,
    };

    if (newEmail.length > 0) {
      params.email = newEmail;
    }

    if (newPassword.length > 0) {
      params.password = newPassword;
    }

    saveButton.disabled = true;

    adminAPI.adminEditUser(params, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      saveButton.disabled = false;

      const messages = {
        '1000': 'Successfully updated user!',
        '2201': 'Edit user failed: Email is already taken.',
      };

      assertPeer(typeof messages[result.status_code] === 'string', {
        msg: 'Unexpected status code in search. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
      });

      const userMessage = messages[result.status_code] || 'Edit user failed with status code: ' + result.status_code; // eslint-disable-line prefer-template
      assertUser(result.status_code === '1000', {
        userMessage: userMessage,
        msg: 'Edit user failed. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
      });

      if (newEmail.length > 0) {
        userGlobal.email = newEmail;
      }

      renderUserRow('view', userGlobal);
      mainUtils.displayUserMessage('Successfully updated user!', 'success');
    });
  };

  const onCancelEditUserClick = function (event) {
    mainUtils.trace('onCancelEditUserClick');

    renderUserRow('view', userGlobal);
  };

  const onRemoveUserClick = function (event) {
    mainUtils.trace('onRemoveUserClick');

    const removeButton = event.target;
    removeButton.disabled = true;

    const removeUserParams = {
      v: '2.0',
      user_id: userGlobal.id,
      api_key: APIKeyRef.APIKey,
    };

    adminAPI.adminRemoveUser(removeUserParams, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      if (result.status_code === '1000') {
        window.location.replace('/users');
      } else {
        mainUtils.displayUserMessage('Remove user failed with status code: ' + result.status_code, 'error'); // eslint-disable-line prefer-template
      }
    });
  };

  const onEditUserClick = function (event) {
    mainUtils.trace('onEditUserClick');

    renderUserRow('edit', userGlobal);
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
    mainUtils.trace('renderUserSubscriptions');

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
    mainUtils.trace('renderUserSubscriptionRowViewMode');

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
    mainUtils.trace('renderUserSubscriptionRowEditMode');

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
    mainUtils.trace('renderUserSubscriptionRow');

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
      ($row == null) ? String(mainUtils.getUniqueId())
        : mainUtils.getElementUniqueId($row[0], 'user-subscription-');

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
    mainUtils.trace('onEditUserSubscriptionClick');

    const rowId = mainUtils.getElementUniqueId(event.target, 'user-subscription-view-mode-edit-btn-');
    const userSubscription = rowIdUserSubscriptionMap[rowId];

    renderUserSubscriptionRow(
      'edit',
      userSubscription,
      $('#user-subscription-' + rowId) // eslint-disable-line prefer-template
    );
  };

  const onCancelUserSubscriptionClick = function (event) {
    mainUtils.trace('onCancelUserSubscriptionClick');

    const rowId = mainUtils.getElementUniqueId(event.target, 'user-subscription-edit-mode-cancel-btn-');
    const userSubscription = rowIdUserSubscriptionMap[rowId];

    renderUserSubscriptionRow(
      'view',
      userSubscription,
      $('#user-subscription-' + rowId) // eslint-disable-line prefer-template
    );
  };

  const onRemoveUserSubscriptionClick = function (event) {
    mainUtils.trace('onRemoveUserSubscriptionClick');

    const removeButton = event.target;

    const rowId = mainUtils.getElementUniqueId(removeButton, 'user-subscription-edit-mode-remove-btn-');
    const oldSubscription = rowIdUserSubscriptionMap[rowId];

    removeButton.disabled = true;

    const unsubscribeParams = {
      v: '2.0',
      user_subscription_id: oldSubscription.id,
      api_key: APIKeyRef.APIKey,
    };

    adminAPI.adminUnsubscribe(unsubscribeParams, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      removeButton.disabled = false;

      if (result.status_code === '1000') {
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

        mainUtils.displayUserMessage('Successfully deleted user subscription!', 'success');
      } else {
        mainUtils.displayUserMessage('Remove user subscription failed with status code: ' + result.status_code, 'error'); // eslint-disable-line prefer-template
      }
    });
  };

  const onSaveUserSubscriptionClick = function (event) {
    mainUtils.trace('onSaveUserSubscriptionClick');

    const saveButton = event.target;

    const rowId = mainUtils.getElementUniqueId(saveButton, 'user-subscription-edit-mode-save-btn-');
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
      api_key: APIKeyRef.APIKey,
      user_subscription_id: oldSubscription.id,
      fly_from: airportFromId,
      fly_to: airportToId,
      date_from: dateFrom,
      date_to: dateTo,
    };

    adminAPI.adminEditSubscription(editSubscriptionParams, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      saveButton.disabled = false;

      if (result.status_code === '1000') {
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

        mainUtils.displayUserMessage('Successfully edited user subscription!', 'success');
      } else {
        mainUtils.displayUserMessage('Edit user subscription failed with status code: ' + result.status_code, 'error'); // eslint-disable-line prefer-template
      }
    });
  };

  const onUserCreditsSubmitClick = function (event) {
    mainUtils.trace('onUserCreditsSubmitClick');

    const submitButton = event.target;
    const userCreditsChange = $('#user-credits-change').val().trim();

    assertUser(userCreditsChange.length > 0, {
      userMessage: 'Please choose a value for credit change!',
      msg: 'User submitted "' + userCreditsChange + '", which was recognised as an empty input.', // eslint-disable-line prefer-template
    });

    assertUser(Number.isInteger(Number(userCreditsChange)), {
      userMessage: 'Change credit value is not an integer (2, 200, -16, etc..)!',
      msg: 'User submitted "' + userCreditsChange + '", which was not recognised as an integer.', // eslint-disable-line prefer-template
    });

    submitButton.disabled = true;

    const alterUserCreditsParams = {
      v: '2.0',
      api_key: APIKeyRef.APIKey,
      user_id: userGlobal.id,
      credits_difference: Number(userCreditsChange),
    };

    adminAPI.adminAlterUserCredits(alterUserCreditsParams, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      submitButton.disabled = false;
      $('#user-credits-change').val(0);

      const messages = {
        '1000': 'Successfully altered user credits!',
        '2100': 'Invalid api key!',
        '2101': 'User does not have enough credits for this transaction!',
        '2102': 'User not found',
      };

      assertPeer(typeof messages[result.status_code] === 'string', {
        msg: 'Unexpected status code in search. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
      });

      const userMessage = messages[result.status_code] || 'Alter user credits failed with status code: ' + result.status_code; // eslint-disable-line prefer-template
      assertUser(result.status_code === '1000', {
        userMessage: userMessage,
        msg: 'Edit user failed. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
      });

      userGlobal.credits += Number(userCreditsChange);
      renderUserRow('view', userGlobal);
      mainUtils.displayUserMessage('Successfully altered user credits!', 'success');
    });
  };

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    api.getAPIKey({
      v: '2.0',
    }, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      if (result.status_code === '1000') {
        APIKeyRef.APIKey = result.api_key;

        const params = {
          v: '2.0',
          user_id: userGlobal.id,
          api_key: APIKeyRef.APIKey,
        };

        api.listAirports(PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
          airports = result.airports;

          const adminListSubscriptionsCallback = function (result) {
            subscriptions = result.user_subscriptions;

            renderUserSubscriptions($('#user-subscriptions-table'));
          };

          adminAPI.adminListSubscriptions(params, PROTOCOL_NAME, adminListSubscriptionsCallback);
        });
      } else {
        window.location.replace('/login');
      }
    });

    renderUserRow('view', userGlobal);

    $('#user-view-mode-edit-btn').click(onEditUserClick);
    $('#user-edit-mode-save-btn').click(onSaveUserClick);
    $('#user-edit-mode-cancel-btn').click(onCancelEditUserClick);
    $('#user-edit-mode-remove-btn').click(onRemoveUserClick);
    $('#user-credits-submit-btn').click(onUserCreditsSubmitClick);
  });
}

start();
