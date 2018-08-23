function start () {
  const mainUtils = main();
  const assertApp = mainUtils.assertApp;
  const assertUser = mainUtils.assertUser;
  const UserError = mainUtils.UserError;
  const APIKeyRef = mainUtils.APIKeyRef;
  const PROTOCOL_NAME = mainUtils.PROTOCOL_NAME;
  const RESULTS_LIMIT = 20;

  const adminAPI = getAdminAPIMethods(mainUtils);
  const api = getAPIMethods(mainUtils);

  var airports = []; // eslint-disable-line no-var
  var userSubscriptions = []; // eslint-disable-line no-var
  var rowIdUserSubscriptionMap = {}; // eslint-disable-line no-var
  var userSubscriptionsOffset = 0; // eslint-disable-line no-var
  var guestSubscriptions = []; // eslint-disable-line no-var
  var rowIdGuestSubscriptionMap = {}; // eslint-disable-line no-var
  var guestSubscriptionsOffset = 0; // eslint-disable-line no-var

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

  function applyDatePicker () {
    const datepickerOptions = {
      dateFormat: 'yy-mm-dd',
    };

    $('.date-select').datepicker(datepickerOptions);
  }

  function applyAutocomplete (values) {
    $('.airport-select').autocomplete(values);
  }

  function showUserSubscriptionsResults () {
    $('#user-subscriptions-results').removeAttr('hidden');
    $('#no-subscriptions-msg').attr('hidden', 'true');
  }

  function hideUserSubscriptionsResults () {
    $('#no-subscriptions-msg').removeAttr('hidden');
    $('#user-subscriptions-results').attr('hidden', 'true');
  }

  function showGuestSubscriptionsResults () {
    $('#guest-subscriptions-results').removeAttr('hidden');
    $('#no-subscriptions-msg').attr('hidden', 'true');
  }

  function hideGuestSubscriptionsResults () {
    $('#no-subscriptions-msg').removeAttr('hidden');
    $('#guest-subscriptions-results').attr('hidden', 'true');
  }

  function clearGuestSubscriptionsTable ($guestSubscriptionsTable) {
    mainUtils.trace('clearGuestSubscriptionsTable');

    assertApp($guestSubscriptionsTable instanceof jQuery, {
      msg: 'Expected $guestSubscriptionsTable to be instance of jQuery, but was ' + typeof $guestSubscriptionsTable, // eslint-disable-line prefer-template
    });

    $guestSubscriptionsTable.find('tbody tr')
      .not('#guest-subscription-edit-mode')
      .not('#guest-subscription-view-mode')
      .remove();
  }

  function renderGuestSubscriptions ($guestSubscriptionsTable) {
    mainUtils.trace('renderGuestSubscriptions');

    if (guestSubscriptions.length > 0) {
      showGuestSubscriptionsResults();
    } else {
      hideGuestSubscriptionsResults();
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

    clearGuestSubscriptionsTable($guestSubscriptionsTable);
    rowIdGuestSubscriptionMap = {};

    const currentPage = guestSubscriptionsOffset / RESULTS_LIMIT + 1;
    $('#guest-subscriptions-current-page-label-top').text(currentPage);
    $('#guest-subscriptions-current-page-label-bottom').text(currentPage);

    _.each(guestSubscriptions, function (subscription) { // eslint-disable-line prefer-arrow-callback
      renderGuestSubscriptionRow('view', subscription);
    });
  }

  function renderGuestSubscriptionRow (mode, subscription, $row) {
    mainUtils.trace('renderGuestSubscriptionRow');

    assertApp(_.isObject(subscription), {
      msg: 'Expected subscription to be an object, but was ' + typeof subscription, // eslint-disable-line prefer-template
    });

    const subscriptionStringProps = ['id', 'fly_from', 'fly_to', 'created_at', 'updated_at'];

    _.each(subscriptionStringProps, function (prop) { // eslint-disable-line prefer-arrow-callback
      assertApp(typeof subscription[prop] === 'string', {
        msg: 'Expected subscription ' + prop + ' to be a string, but was ' + typeof subscription[prop], // eslint-disable-line prefer-template
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
        : mainUtils.getElementUniqueId($row[0], 'guest-subscription-');

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
    mainUtils.trace('renderGuestSubscriptionRowViewMode');

    const $guestSubscriptionViewModeClone = $('#guest-subscription-view-mode').clone()
      .removeAttr('hidden')
      .attr('id', 'guest-subscription-' + rowId); // eslint-disable-line prefer-template

    $guestSubscriptionViewModeClone.find('#guest-subscription-view-mode-airport-from')
      .attr('id', 'guest-subscription-view-mode-airport-from-' + rowId) // eslint-disable-line prefer-template
      .text(getAirportName(airports, subscription.fly_from));

    $guestSubscriptionViewModeClone.find('#guest-subscription-view-mode-airport-to')
      .attr('id', 'guest-subscription-view-mode-airport-to-' + rowId) // eslint-disable-line prefer-template
      .text(getAirportName(airports, subscription.fly_to));

    $guestSubscriptionViewModeClone.find('#guest-subscription-view-mode-created-at')
      .attr('id', 'guest-subscription-view-mode-created-at-' + rowId) // eslint-disable-line prefer-template
      .text(subscription.created_at);

    $guestSubscriptionViewModeClone.find('#guest-subscription-view-mode-updated-at')
      .attr('id', 'guest-subscription-view-mode-updated-at' + rowId) // eslint-disable-line prefer-template
      .text(subscription.updated_at);

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
    mainUtils.trace('renderGuestSubscriptionRowEditMode');

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

    $guestSubscriptionEditModeClone.find('#guest-subscription-edit-mode-created-at')
      .attr('id', 'guest-subscription-edit-mode-created-at-' + rowId) // eslint-disable-line prefer-template
      .text(subscription.created_at);

    $guestSubscriptionEditModeClone.find('#guest-subscription-edit-mode-updated-at')
      .attr('id', 'guest-subscription-edit-mode-updated-at-' + rowId) // eslint-disable-line prefer-template
      .text(subscription.updated_at);

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

  const onEditGuestSubscriptionClick = function (event) {
    mainUtils.trace('onEditGuestSubscriptionClick');

    mainUtils.displayUserMessage('Warning: this is a preview of edit guest subscription functionality. Work is in progess to implement this feature.', 'info');

    const rowId = mainUtils.getElementUniqueId(event.target, 'guest-subscription-view-mode-edit-btn-');
    const subscription = rowIdGuestSubscriptionMap[rowId];

    renderGuestSubscriptionRow(
      'edit',
      subscription,
      $('#guest-subscription-' + rowId) // eslint-disable-line prefer-template
    );
  };

  const onCancelGuestSubscriptionClick = function (event) {
    mainUtils.trace('onCancelGuestSubscriptionClick');

    const rowId = mainUtils.getElementUniqueId(event.target, 'guest-subscription-edit-mode-cancel-btn-');
    const subscription = rowIdGuestSubscriptionMap[rowId];

    renderGuestSubscriptionRow(
      'view',
      subscription,
      $('#guest-subscription-' + rowId) // eslint-disable-line prefer-template
    );
  };

  const onSaveGuestSubscriptionClick = function (event) {
    mainUtils.trace('onSaveGuestSubscriptionClick');

    throw new UserError({
      userMessage: 'Feature not implemented yet.',
      msg: 'Save guest subscription not implemented yet.',
    });

    const saveButton = event.target; // eslint-disable-line no-unreachable

    const rowId = mainUtils.getElementUniqueId(saveButton, 'guest-subscription-edit-mode-save-btn-');
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
      created_at: oldSubscription.created_at,
      updated_at: oldSubscription.updated_at, // result.updated_at
    };

    rowIdGuestSubscriptionMap[rowId] = newSubscription;
    guestSubscriptions = guestSubscriptions.map(function (subscription) { // eslint-disable-line prefer-arrow-callback
      if (subscription.id !== oldSubscription.id) {
        return subscription;
      }
      return newSubscription;
    });

    renderGuestSubscriptionRow( // eslint-disable-line no-unreachable
      'view',
      newSubscription,
      $('#guest-subscription-' + rowId) // eslint-disable-line prefer-template
    );
  };

  const onRemoveGuestSubscriptionClick = function (event) {
    mainUtils.trace('onRemoveGuestSubscriptionClick');

    throw new UserError({
      userMessage: 'Feature not implemented yet.',
      msg: 'Save guest subscription not implemented yet.',
    });

    const removeButton = event.target; // eslint-disable-line no-unreachable

    const rowId = mainUtils.getElementUniqueId(removeButton, 'guest-subscription-edit-mode-remove-btn-');
    const oldSubscription = rowIdGuestSubscriptionMap[rowId];

    removeButton.disabled = true;

    // TODO send request to server

    removeButton.disabled = false;

    guestSubscriptions = guestSubscriptions.filter(function (subscription) { // eslint-disable-line prefer-arrow-callback
      return subscription.id !== oldSubscription.id;
    });

    delete rowIdGuestSubscriptionMap[rowId]; // eslint-disable-line no-unreachable

    $('#guest-subscription-' + rowId).remove(); // eslint-disable-line prefer-template

    if (guestSubscriptions.length > 0) {
      showGuestSubscriptionsResults();
    } else {
      hideGuestSubscriptionsResults();
    }
  };

  const onSubscribeSubmit = function (event) {
    mainUtils.trace('subscribe submit button clicked');

    throw new UserError({
      userMessage: 'Feature not implemented yet.',
      msg: 'Save guest subscription not implemented yet.',
    });
  };

  function clearUserSubscriptionsTable ($userSubscriptionsTable) {
    mainUtils.trace('clearUserSubscriptionsTable');

    assertApp($userSubscriptionsTable instanceof jQuery, {
      msg: 'Expected $userSubscriptionsTable to be instance of jQuery, but was ' + typeof $userSubscriptionsTable, // eslint-disable-line prefer-template
    });

    $userSubscriptionsTable.find('tbody tr')
      .not('#user-subscription-edit-mode')
      .not('#user-subscription-view-mode')
      .remove();
  }

  function renderUserSubscriptions ($userSubscriptionsTable) {
    mainUtils.trace('renderUserSubscriptions');

    if (userSubscriptions.length > 0) {
      showUserSubscriptionsResults();
    } else {
      hideUserSubscriptionsResults();
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

    clearUserSubscriptionsTable($userSubscriptionsTable);
    rowIdUserSubscriptionMap = {};

    const currentPage = userSubscriptionsOffset / RESULTS_LIMIT + 1;
    $('#user-subscriptions-current-page-label-top').text(currentPage);
    $('#user-subscriptions-current-page-label-bottom').text(currentPage);

    _.each(userSubscriptions, function (subscription) { // eslint-disable-line prefer-arrow-callback
      renderUserSubscriptionRow('view', subscription);
    });
  }

  function renderUserSubscriptionRowViewMode (subscription, rowId, $row) {
    mainUtils.trace('renderUserSubscriptionRowViewMode');

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

    $userSubscriptionViewModeClone.find('#user-subscription-view-mode-created-at')
      .attr('id', 'user-subscription-view-mode-created-at-' + rowId) // eslint-disable-line prefer-template
      .text(subscription.created_at);

    $userSubscriptionViewModeClone.find('#user-subscription-view-mode-updated-at')
      .attr('id', 'user-subscription-view-mode-updated-at-' + rowId) // eslint-disable-line prefer-template
      .text(subscription.updated_at);

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

    $userSubscriptionEditModeClone.find('#user-subscription-edit-mode-created-at')
      .attr('id', 'user-subscription-edit-mode-created-at-' + rowId) // eslint-disable-line prefer-template
      .text(subscription.created_at);

    $userSubscriptionEditModeClone.find('#user-subscription-edit-mode-updated-at')
      .attr('id', 'user-subscription-edit-mode-updated-at-' + rowId) // eslint-disable-line prefer-template
      .text(subscription.updated_at);

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

    const subscriptionStringProps = ['id', 'fly_from', 'fly_to', 'date_from', 'date_to', 'created_at', 'updated_at'];

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
    mainUtils.trace('edit user subscription button click');

    const rowId = mainUtils.getElementUniqueId(event.target, 'user-subscription-view-mode-edit-btn-');
    const subscription = rowIdUserSubscriptionMap[rowId];

    renderUserSubscriptionRow(
      'edit',
      subscription,
      $('#user-subscription-' + rowId) // eslint-disable-line prefer-template
    );
  };

  const onCancelUserSubscriptionClick = function (event) {
    mainUtils.trace('user subscription cancel button click');

    const rowId = mainUtils.getElementUniqueId(event.target, 'user-subscription-edit-mode-cancel-btn-');
    const subscription = rowIdUserSubscriptionMap[rowId];

    renderUserSubscriptionRow(
      'view',
      subscription,
      $('#user-subscription-' + rowId) // eslint-disable-line prefer-template
    );
  };

  const onSaveUserSubscriptionClick = function (event) {
    mainUtils.trace('user subscription save button click');

    const saveButton = event.target;

    const rowId = mainUtils.getElementUniqueId(saveButton, 'user-subscription-edit-mode-save-btn-');
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

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const wrongDateFormatMsg = 'Expected format YYYY-MM-DD for date!';

    assertUser(datePattern.test(dateFrom), {
      userMessage: wrongDateFormatMsg,
      msg: wrongDateFormatMsg,
    });

    assertUser(Number.isInteger(Date.parse(dateFrom)), {
      userMessage: 'Invalid date!',
      msg: 'User entered invalid date in dateFrom field',
    });

    assertUser(datePattern.test(dateTo), {
      userMessage: wrongDateFormatMsg,
      msg: wrongDateFormatMsg,
    });

    assertUser(Number.isInteger(Date.parse(dateTo)), {
      userMessage: 'Invalid date!',
      msg: 'User entered invalid date in dateTo field',
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

    adminAPI.adminEditSubscription(
      editSubscriptionParams,
      PROTOCOL_NAME,
      function (result) { // eslint-disable-line prefer-arrow-callback
        saveButton.disabled = false;

        if (result.status_code === '1000') {
          const newSubscription = {
            id: oldSubscription.id,
            user: oldSubscription.user,
            fly_from: airportFromId,
            fly_to: airportToId,
            date_from: dateFrom,
            date_to: dateTo,
            created_at: oldSubscription.created_at,
            updated_at: result.updated_at,
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

          mainUtils.displayUserMessage('Successfully edited user subscription!', 'success');
        } else {
          mainUtils.displayUserMessage('Edit user subscription failed with status code: ' + result.status_code, 'error'); // eslint-disable-line prefer-template
        }
      }
    );
  };

  const onRemoveUserSubscriptionClick = function (event) {
    mainUtils.trace('user subscription remove button click');

    const removeButton = event.target;

    const rowId = mainUtils.getElementUniqueId(removeButton, 'user-subscription-edit-mode-remove-btn-');
    const oldSubscription = rowIdUserSubscriptionMap[rowId];

    removeButton.disabled = true;

    const unsubscribeParams = {
      v: '2.0',
      user_subscription_id: oldSubscription.id,
      api_key: APIKeyRef.APIKey,
    };

    adminAPI.adminUnsubscribe(
      unsubscribeParams,
      PROTOCOL_NAME,
      function (result) { // eslint-disable-line prefer-arrow-callback
        removeButton.disabled = false;

        if (result.status_code === '1000') {
          userSubscriptions = userSubscriptions.filter(function (subscription) { // eslint-disable-line prefer-arrow-callback
            return subscription.id !== oldSubscription.id;
          });

          delete rowIdUserSubscriptionMap[rowId];

          $('#user-subscription-' + rowId).remove(); // eslint-disable-line prefer-template

          if (userSubscriptions.length > 0) {
            showUserSubscriptionsResults();
          } else {
            hideUserSubscriptionsResults();
          }

          mainUtils.displayUserMessage('Successfully removed user subscription!', 'success');
        } else {
          mainUtils.displayUserMessage('Remove user subscription failed with status code: ' + result.status_code, 'error'); // eslint-disable-line prefer-template
        }
      }
    );
  };

  const onUserSubscriptionsTabClick = function () {
    mainUtils.trace('clicked users tab');

    if (userSubscriptions.length > 0) {
      showUserSubscriptionsResults();
    } else {
      hideUserSubscriptionsResults();
    }

    $('#user-subscriptions-section').removeAttr('hidden');
    $('#guest-subscriptions-section').attr('hidden', 'true');

    $('#user-subscriptions-tab').parent().addClass('active');
    $('#guest-subscriptions-tab').parent().removeClass('active');
  };

  const onGuestSubscriptionsTabClick = function () {
    mainUtils.trace('clicked guest tab');

    if (guestSubscriptions.length > 0) {
      showGuestSubscriptionsResults();
    } else {
      hideGuestSubscriptionsResults();
    }

    $('#guest-subscriptions-section').removeAttr('hidden');
    $('#user-subscriptions-section').attr('hidden', 'true');

    $('#guest-subscriptions-tab').parent().addClass('active');
    $('#user-subscriptions-tab').parent().removeClass('active');
  };

  const onUserSubscriptionsPreviousPageClick = function (event) { // eslint-disable-line prefer-arrow-callback
    mainUtils.trace('onUserSubscriptionsPreviousPageClick');

    const button = event.target;

    assertApp(typeof userSubscriptionsOffset === 'number', {
      msg: 'Expected userSubscriptionsOffset to be a number but was =' + userSubscriptionsOffset, // eslint-disable-line prefer-template
    });

    if (userSubscriptionsOffset === 0) {
      mainUtils.displayUserMessage('You are already on first page', 'info');
      return;
    } else {
      userSubscriptionsOffset = userSubscriptionsOffset - RESULTS_LIMIT;
    }

    assertApp(userSubscriptionsOffset >= 0, {
      msg: 'Expected userSubscriptionsOffset to be >= 0 but was =' + userSubscriptionsOffset, // eslint-disable-line prefer-template
    });

    assertUser(Number.isSafeInteger(userSubscriptionsOffset), {
      userMessage: 'Invalid results page!',
      msg: 'Expected userSubscriptionsOffset to be a safe integer, but was =' + userSubscriptionsOffset, // eslint-disable-line prefer-template
    });

    const params = {
      v: '2.0',
      api_key: APIKeyRef.APIKey,
      offset: userSubscriptionsOffset,
      limit: RESULTS_LIMIT,
    };

    button.disabled = true;

    adminAPI.adminListUserSubscriptions(
      params,
      PROTOCOL_NAME,
      function (result) { // eslint-disable-line prefer-arrow-callback
        button.disabled = false;
        userSubscriptions = result.user_subscriptions;

        renderUserSubscriptions($('#user-subscriptions-table'));
      }
    );
  };

  const onUserSubscriptionsNextPageClick = function (event) { // eslint-disable-line prefer-arrow-callback
    mainUtils.trace('onUserSubscriptionsNextPageClick');

    const button = event.target;

    assertApp(typeof userSubscriptionsOffset === 'number', {
      msg: 'Expected userSubscriptionsOffset to be a number but was =' + userSubscriptionsOffset, // eslint-disable-line prefer-template
    });

    const newOffset = userSubscriptionsOffset + RESULTS_LIMIT;

    assertApp(userSubscriptionsOffset >= 0, {
      msg: 'Expected userSubscriptionsOffset to be >= 0 but was =' + userSubscriptionsOffset, // eslint-disable-line prefer-template
    });

    assertUser(Number.isSafeInteger(newOffset), {
      userMessage: 'Invalid results page!',
      msg: 'Expected newOffset to be a safe integer, but was =' + newOffset, // eslint-disable-line prefer-template
    });

    const params = {
      v: '2.0',
      api_key: APIKeyRef.APIKey,
      offset: newOffset,
      limit: RESULTS_LIMIT,
    };

    button.disabled = true;

    adminAPI.adminListUserSubscriptions(
      params,
      PROTOCOL_NAME,
      function (result) { // eslint-disable-line prefer-arrow-callback
        button.disabled = false;

        if (result.user_subscriptions.length === 0) {
          mainUtils.displayUserMessage('You are already on last page!', 'info');
          return;
        }

        userSubscriptionsOffset = newOffset;
        userSubscriptions = result.user_subscriptions;

        renderUserSubscriptions($('#user-subscriptions-table'));
      }
    );
  };

  const onGuestSubscriptionsPreviousPageClick = function (event) { // eslint-disable-line prefer-arrow-callback
    mainUtils.trace('onGuestSubscriptionsPreviousPageClick');

    const button = event.target;

    assertApp(typeof guestSubscriptionsOffset === 'number', {
      msg: 'Expected offset to be a number but was =' + guestSubscriptionsOffset, // eslint-disable-line prefer-template
    });

    if (guestSubscriptionsOffset === 0) {
      mainUtils.displayUserMessage('You are already on first page', 'info');
      return;
    } else {
      guestSubscriptionsOffset = guestSubscriptionsOffset - RESULTS_LIMIT;
    }

    assertApp(guestSubscriptionsOffset >= 0, {
      msg: 'Expected guestSubscriptionsOffset to be >= 0 but was =' + guestSubscriptionsOffset, // eslint-disable-line prefer-template
    });

    assertUser(Number.isSafeInteger(guestSubscriptionsOffset), {
      userMessage: 'Invalid results page!',
      msg: 'Expected guestSubscriptionsOffset to be a safe integer, but was =' + guestSubscriptionsOffset, // eslint-disable-line prefer-template
    });

    const params = {
      v: '2.0',
      api_key: APIKeyRef.APIKey,
      offset: guestSubscriptionsOffset,
      limit: RESULTS_LIMIT,
    };

    button.disabled = true;

    adminAPI.adminListGuestSubscriptions(
      params,
      PROTOCOL_NAME,
      function (result) { // eslint-disable-line prefer-arrow-callback
        button.disabled = false;
        guestSubscriptions = result.guest_subscriptions;

        renderGuestSubscriptions($('#guest-subscriptions-table'));
      }
    );
  };

  const onGuestSubscriptionsNextPageClick = function (event) { // eslint-disable-line prefer-arrow-callback
    mainUtils.trace('onGuestSubscriptionsNextPageClick');

    const button = event.target;

    assertApp(typeof guestSubscriptionsOffset === 'number', {
      msg: 'Expected guestSubscriptionsOffset to be a number but was =' + guestSubscriptionsOffset, // eslint-disable-line prefer-template
    });

    const newOffset = guestSubscriptionsOffset + RESULTS_LIMIT;

    assertApp(guestSubscriptionsOffset >= 0, {
      msg: 'Expected guestSubscriptionsOffset to be >= 0 but was =' + guestSubscriptionsOffset, // eslint-disable-line prefer-template
    });

    assertUser(Number.isSafeInteger(newOffset), {
      userMessage: 'Invalid results page!',
      msg: 'Expected newOffset to be a safe integer, but was =' + newOffset, // eslint-disable-line prefer-template
    });

    const params = {
      v: '2.0',
      api_key: APIKeyRef.APIKey,
      offset: newOffset,
      limit: RESULTS_LIMIT,
    };

    button.disabled = true;

    adminAPI.adminListGuestSubscriptions(
      params,
      PROTOCOL_NAME,
      function (result) { // eslint-disable-line prefer-arrow-callback
        button.disabled = false;

        if (result.guest_subscriptions.length === 0) {
          mainUtils.displayUserMessage('You are already on last page!', 'info');
          return;
        }

        guestSubscriptionsOffset = newOffset;
        guestSubscriptions = result.guest_subscriptions;

        renderGuestSubscriptions($('#guest-subscriptions-table'));
      }
    );
  };

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    const $userSubscriptionsTab = $('#user-subscriptions-tab');
    const $guestSubscriptionsTab = $('#guest-subscriptions-tab');
    const $subscribeSubmitBtn = $('#subscribe-submit-btn');

    $('#user-subscriptions-next-page-btn-top').click(onUserSubscriptionsNextPageClick);
    $('#user-subscriptions-prev-page-btn-top').click(onUserSubscriptionsPreviousPageClick);
    $('#guest-subscriptions-next-page-btn-top').click(onGuestSubscriptionsNextPageClick);
    $('#guest-subscriptions-prev-page-btn-top').click(onGuestSubscriptionsPreviousPageClick);
    $('#user-subscriptions-next-page-btn-bottom').click(onUserSubscriptionsNextPageClick);
    $('#user-subscriptions-prev-page-btn-bottom').click(onUserSubscriptionsPreviousPageClick);
    $('#guest-subscriptions-next-page-btn-bottom').click(onGuestSubscriptionsNextPageClick);
    $('#guest-subscriptions-prev-page-btn-bottom').click(onGuestSubscriptionsPreviousPageClick);

    adminAPI.adminGetAPIKey({
      v: '2.0',
    }, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      if (result.status_code === '1000') {
        APIKeyRef.APIKey = result.api_key;

        const params = {
          v: '2.0',
          api_key: APIKeyRef.APIKey,
          offset: 0,
          limit: RESULTS_LIMIT,
        };

        adminAPI.adminListUserSubscriptions(
          params,
          PROTOCOL_NAME,
          function (result) { // eslint-disable-line prefer-arrow-callback
            userSubscriptions = result.user_subscriptions;

            renderUserSubscriptions($('#user-subscriptions-table'));
          }
        );

        adminAPI.adminListGuestSubscriptions(
          params,
          PROTOCOL_NAME,
          function (result) { // eslint-disable-line prefer-arrow-callback
            guestSubscriptions = result.guest_subscriptions;

            renderGuestSubscriptions($('#guest-subscriptions-table'));
          }
        );
      } else {
        mainUtils.displayUserMessage('Could not get API key for your account. Please try to log out and log back in your account!', 'error');
      }
    });

    api.listAirports(PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      airports = result.airports;

      const toAirportName = function (airport) { // eslint-disable-line prefer-arrow-callback
        return airport.name;
      };

      const airportNames = airports.map(toAirportName);

      $userSubscriptionsTab.click(onUserSubscriptionsTabClick);
      $guestSubscriptionsTab.click(onGuestSubscriptionsTabClick);

      applyAutocomplete(airportNames);
    });

    $subscribeSubmitBtn.click(onSubscribeSubmit);

    applyDatePicker();
  });
}

start();
