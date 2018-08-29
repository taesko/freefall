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

  function showUserSubscriptionsResults () {
    $('#user-subscriptions-results').removeAttr('hidden');
    $('#no-subscriptions-msg').attr('hidden', true);
  }

  function hideUserSubscriptionsResults () {
    $('#no-subscriptions-msg').removeAttr('hidden');
    $('#user-subscriptions-results').attr('hidden', true);
  }

  function showGuestSubscriptionsResults () {
    $('#guest-subscriptions-results').removeAttr('hidden');
    $('#no-subscriptions-msg').attr('hidden', true);
  }

  function hideGuestSubscriptionsResults () {
    $('#no-subscriptions-msg').removeAttr('hidden');
    $('#guest-subscriptions-results').attr('hidden', true);
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
      // no need for edit mode
    };

    assertApp(typeof modes[mode] === 'function', {
      msg: 'Expected mode to be allowed mode, but was ' + mode, // eslint-disable-line prefer-template
    });

    modes[mode](subscription, rowId, $row);
  }

  function renderGuestSubscriptionRowViewMode (subscription, rowId, $row) {
    mainUtils.trace('renderGuestSubscriptionRowViewMode');

    const $guestSubscriptionViewModeClone = $('#guest-subscription-view-mode').clone()
      .removeAttr('hidden')
      .attr('id', 'guest-subscription-' + rowId); // eslint-disable-line prefer-template

    $guestSubscriptionViewModeClone.find('#guest-subscription-view-mode-id')
      .attr('id', 'guest-subscription-view-mode-id-' + rowId) // eslint-disable-line prefer-template
      .text(subscription.id);

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

    if ($row == null) {
      $guestSubscriptionViewModeClone.appendTo(
        $('#guest-subscriptions-table tbody')
      );
    } else {
      $row.replaceWith($guestSubscriptionViewModeClone);
    }
  }

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

    $userSubscriptionViewModeClone.find('#user-subscription-view-mode-id')
      .attr('id', 'user-subscription-view-mode-id-' + rowId) // eslint-disable-line prefer-template
      .text(subscription.id);

    $userSubscriptionViewModeClone.find('#user-subscription-view-mode-user-email')
      .attr('id', 'user-subscription-view-mode-user-email-' + rowId) // eslint-disable-line prefer-template
      .text(subscription.user.email);

    $userSubscriptionViewModeClone.find('#user-subscription-view-mode-user-link')
      .attr('id', 'user-subscription-view-mode-user-link-' + rowId) // eslint-disable-line prefer-template
      .attr('href', '/users/' + subscription.user.id); // eslint-disable-line prefer-template

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

    if ($row == null) {
      $userSubscriptionViewModeClone.appendTo(
        $('#user-subscriptions-table tbody')
      );
    } else {
      $row.replaceWith($userSubscriptionViewModeClone);
    }
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
      // no need for edit mode
    };

    assertApp(typeof modes[mode] === 'function', {
      msg: 'Expected mode to be allowed mode, but was ' + mode, // eslint-disable-line prefer-template
    });

    modes[mode](subscription, rowId, $row);
  }

  const onUserSubscriptionsTabClick = function () {
    mainUtils.trace('clicked users tab');

    if (userSubscriptions.length > 0) {
      showUserSubscriptionsResults();
    } else {
      hideUserSubscriptionsResults();
    }

    $('#user-subscriptions-section').removeAttr('hidden');
    $('#guest-subscriptions-section').attr('hidden', true);

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
    $('#user-subscriptions-section').attr('hidden', true);

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
        // TODO error handling
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
        // TODO error handling
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
        // TODO error handling
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
        // TODO error handling
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
            // TODO error handling
            renderUserSubscriptions($('#user-subscriptions-table'));
          }
        );

        adminAPI.adminListGuestSubscriptions(
          params,
          PROTOCOL_NAME,
          function (result) { // eslint-disable-line prefer-arrow-callback
            guestSubscriptions = result.guest_subscriptions;
            // TODO error handling
            renderGuestSubscriptions($('#guest-subscriptions-table'));
          }
        );
      } else {
        mainUtils.displayUserMessage('Could not get API key for your account. Please try to log out and log back in your account!', 'error');
      }
    });

    api.listAirports(PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      airports = result.airports;

      $userSubscriptionsTab.click(onUserSubscriptionsTabClick);
      $guestSubscriptionsTab.click(onGuestSubscriptionsTabClick);
    });
  });
}

start();
