/* eslint-disable prefer-template,prefer-arrow-callback,camelcase,prefer-spread,no-var */
'use strict';

function start () {
  const mainUtils = main();

  const UserError = mainUtils.UserError;
  const assertUser = mainUtils.assertUser;
  const assertPeer = mainUtils.assertPeer;
  const assertApp = mainUtils.assertApp;
  const PROTOCOL_NAME = mainUtils.PROTOCOL_NAME;
  const CURRENT_PAGE_NAME = 'profile.html';

  const api = getAPIMethods(mainUtils);

  var airports = []; // eslint-disable-line no-var
  var subscriptions = []; // eslint-disable-line no-var
  var rowIdSubscriptionMap = {}; // eslint-disable-line no-var
  var APIKeyRef = mainUtils.APIKeyRef; // eslint-disable-line no-var
  var searchFlyFrom = null;
  var searchFlyTo = null;
  var fromDepositDate = null;
  var toDepositDate = null;
  var creditHistoryFilters = {};
  const CREDIT_HISTORY_PAGE_LIMIT = 5;
  const SUBSCRIPTIONS_PAGE_LIMIT = 5;
  const ALLOWED_SUBSCRIPTION_PLANS = ['daily', 'weekly', 'monthly'];
  const SUBSCRIPTION_PLANS = {
    daily: { initialTax: 50 },
    weekly: { initialTax: 50 },
    monthly: { initialTax: 50 },
  };

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

  function showSubscriptionsTable () {
    $('#subscriptions-table').removeAttr('hidden');
    $('#no-subscriptions-msg').attr('hidden', 'true');
  }

  function hideSubscriptionTable () {
    $('#subscriptions-table').attr('hidden', 'true');
    $('#no-subscriptions-msg').removeAttr('hidden');
  }

  function renderSubscriptions ($subscriptionsTable, subscriptions) {
    mainUtils.trace('renderSubscriptions');

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

    // rowIdSubscriptionMap = {};

    _.each(subscriptions, function (subscription) { // eslint-disable-line prefer-arrow-callback
      renderSubscriptionRow('view', subscription);
    });
  }

  const onSearchClick = function (event) {
    mainUtils.trace('search button click');

    const rowId = mainUtils.getElementUniqueId(event.target, 'subscription-view-mode-search-btn-');
    const subscription = rowIdSubscriptionMap[rowId];
    const json = JSON.stringify(subscription);
    const indexHref = $('#index-route-link').attr('href');
    const queryString = '?display-subscription=target-subscription';

    assertApp(indexHref != null);
    assertApp(typeof indexHref === 'string');
    assertApp(indexHref.length > 0);

    window.localStorage.setItem('target-subscription', json);
    window.location = indexHref + queryString;
  };
  const onEditClick = function (event) {
    mainUtils.trace('edit button click');

    const rowId = mainUtils.getElementUniqueId(event.target, 'subscription-view-mode-edit-btn-');
    const subscription = rowIdSubscriptionMap[rowId];

    renderSubscriptionRow(
      'edit',
      subscription,
      $('#subscription-' + rowId) // eslint-disable-line prefer-template
    );
  };

  const onSaveClick = function (event) {
    mainUtils.trace('save button click');

    const saveButton = event.target;

    const rowId = mainUtils.getElementUniqueId(event.target, 'subscription-edit-mode-save-btn-');
    const oldSubscription = rowIdSubscriptionMap[rowId];

    const airportFrom = $('#subscription-edit-mode-airport-from-' + rowId).val(); // eslint-disable-line prefer-template
    const airportTo = $('#subscription-edit-mode-airport-to-' + rowId).val(); // eslint-disable-line prefer-template
    const dateFrom = $('#subscription-edit-mode-date-from-' + rowId).val(); // eslint-disable-line prefer-template
    const dateTo = $('#subscription-edit-mode-date-to-' + rowId).val(); // eslint-disable-line prefer-template
    const plan = $('#subscriptions-edit-mode-plan-' + rowId).val();

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

    api.editSubscription({
      v: '2.0',
      api_key: APIKeyRef.APIKey,
      user_subscription_id: oldSubscription.id,
      fly_from: airportFromId,
      fly_to: airportToId,
      date_from: dateFrom,
      date_to: dateTo,
      plan: plan,
    }, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      saveButton.disabled = false;

      const messages = {
        '1000': 'Successfully edited subscription.',
        '2000': 'Such subscription already exists.',
        '2100': 'Bad request parameters format.',
        '2101': 'Such route does not exist. Departure airport or arrival airport could not be found.',
        '2102': 'Invalid dates. Date to can not be earlier than date from.',
        '2105': 'Invalid subscription plan.',
        '2200': 'Your API key is incorrect, please contact tech support.',
      };

      assertPeer(typeof messages[result.status_code] === 'string', {
        msg: 'Unexpected status code in profile edit subscription. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
      });

      const userMessage = messages[result.status_code] || 'An error has occurred. Please refresh the page and try again later.';
      assertUser(result.status_code === '1000', {
        userMessage: userMessage,
        msg: 'Edit subscription failed. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
      });

      mainUtils.trace('edit subscription success');

      const editedSubscription = {
        id: oldSubscription.id,
        fly_from: airportFromId,
        fly_to: airportToId,
        date_from: dateFrom,
        date_to: dateTo,
        plan: plan,
      };

      rowIdSubscriptionMap[rowId] = editedSubscription;
      subscriptions = subscriptions.map(function (subscription) { // eslint-disable-line prefer-arrow-callback
        if (subscription.id !== editedSubscription.id) {
          return subscription;
        }

        return editedSubscription;
      });

      renderSubscriptionRow(
        'view',
        editedSubscription,
        $('#subscription-' + rowId) // eslint-disable-line prefer-template
      );
      mainUtils.displayUserMessage('Successfully edited subscription!', 'success');
    });
  };

  const onCancelClick = function (event) {
    mainUtils.trace('cancel button click');

    const rowId = mainUtils.getElementUniqueId(event.target, 'subscription-edit-mode-cancel-btn-');
    const subscription = rowIdSubscriptionMap[rowId];

    renderSubscriptionRow(
      'view',
      subscription,
      $('#subscription-' + rowId) // eslint-disable-line prefer-template
    );
  };

  const onRemoveClick = function (event) {
    mainUtils.trace('remove button click');

    const removeButton = event.target;
    const rowId = mainUtils.getElementUniqueId(removeButton, 'subscription-edit-mode-remove-btn-');
    const subscription = rowIdSubscriptionMap[rowId];

    const $modal = $('#confirm-unsubscribe-modal');
    $modal.find('#cu-modal-fly-from').text(subscription.fly_from);
    $modal.find('#cu-modal-fly-to').text(subscription.fly_to);
    $modal.find('#cu-modal-date-from').text(subscription.date_from);
    $modal.find('#cu-modal-date-to').text(subscription.date_to);
    $modal.find('#cu-modal-confirm-btn').unbind('click')
      .click(() => onConfirmRemoveClick(event));
    $modal.modal();
  };

  const onConfirmRemoveClick = function (event) {
    mainUtils.trace('remove button click');

    const removeButton = event.target;
    const rowId = mainUtils.getElementUniqueId(removeButton, 'subscription-edit-mode-remove-btn-');
    const oldSubscription = rowIdSubscriptionMap[rowId];

    // TODO asserts

    removeButton.disabled = true;

    api.unsubscribe({
      v: '2.0',
      user_subscription_id: oldSubscription.id,
      api_key: APIKeyRef.APIKey,
    }, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      removeButton.disabled = false;

      const messages = {
        '1000': 'Successfully unsubscribed!',
        '2000': 'Could not find subscription to remove. Please, refresh the page and try again.',
        '2100': 'Invalid unsubscribe parameters. Please, refresh the page and try again.',
        '2200': 'Your API key is incorrect, please contact tech support.',
      };

      assertPeer(typeof messages[result.status_code] === 'string', {
        msg: 'Unexpected status code in profile unsubscribe. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
      });

      const userMessage = messages[result.status_code] || 'An error has occurred. Please refresh the page and try again later.';
      assertUser(result.status_code === '1000', {
        userMessage: userMessage,
        msg: 'Subscribe failed. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
      });

      mainUtils.trace('unsubscribe method success');

      subscriptions = subscriptions.filter(function (subscription) { // eslint-disable-line prefer-arrow-callback
        return subscription.id !== oldSubscription.id;
      });

      delete rowIdSubscriptionMap[rowId];

      $('#subscription-' + rowId).remove(); // eslint-disable-line prefer-template

      if (subscriptions.length > 0) {
        showSubscriptionsTable();
      } else {
        hideSubscriptionTable();
      }

      mainUtils.displayUserMessage('Successfully unsubscribed!', 'success');
    });
  };

  const onSubscribeSubmitClick = function (event) {
    mainUtils.trace('Subscribe submit click');

    const subscribeBtn = event.target;

    const airportFrom = $('#subscribe-airport-from').val().trim();
    const airportTo = $('#subscribe-airport-to').val().trim();
    const dateFrom = $('#subscribe-date-from').val().trim();
    const dateTo = $('#subscribe-date-to').val().trim();
    const plan = $('#subscribe-plan').val().trim();

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

    assertUser(Number.isInteger(Date.parse(dateFrom)), {
      userMessage: 'Please select a valid date from!',
      msg: 'User entered an invalid date in dateFrom field',
    });

    assertUser(Number.isInteger(Date.parse(dateTo)), {
      userMessage: 'Please select a valid date to!',
      msg: 'User entered an invalid date in dateTo field',
    });

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const wrongDateFormatMsg = 'Expected format YYYY-MM-DD for date!';

    assertUser(datePattern.test(dateFrom), {
      userMessage: wrongDateFormatMsg,
      msg: wrongDateFormatMsg,
    });

    assertUser(datePattern.test(dateTo), {
      userMessage: wrongDateFormatMsg,
      msg: wrongDateFormatMsg,
    });

    assertUser(ALLOWED_SUBSCRIPTION_PLANS.indexOf(plan) !== -1, {
      userMessage: '"' + plan + '" is not a valid subscription plan.',
      msg: plan + ' is not a valid subscription plan.',
    });

    subscribeBtn.disabled = true;

    api.subscribe({
      v: '2.0',
      fly_from: airportFromId,
      fly_to: airportToId,
      date_from: dateFrom,
      date_to: dateTo,
      api_key: APIKeyRef.APIKey,
      plan: plan,
    }, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      subscribeBtn.disabled = false;

      const messages = {
        '1000': 'Successfully subscribed.',
        '2000': 'Already subscribed.',
        '2001': 'You do not have enough credits',
        '2100': 'The entered dates and/or airports are not correct.',
        '2200': 'Your API key is incorrect, please contact tech support.',
      };

      assertPeer(typeof messages[result.status_code] === 'string', {
        msg: 'Unexpected status code in profile subscribe. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
      });

      const userMessage = messages[result.status_code] || 'An error has occurred. Please refresh the page and try again later.';
      assertUser(result.status_code === '1000', {
        userMessage: userMessage,
        msg: 'Subscribe failed. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
      });

      mainUtils.trace('subscribe method success');

      const newSubscription = {
        id: result.subscription_id,
        fly_from: airportFromId,
        fly_to: airportToId,
        date_from: dateFrom,
        date_to: dateTo,
        plan: plan,
      };
      const newHistory = {
        airport_from_id: airportFromId,
        airport_to_id: airportToId,
        date_from: dateFrom,
        date_to: dateTo,
        subscription_status: true,
        transferred_at: new Date().toLocaleString(),
        transfer_amount: SUBSCRIPTION_PLANS[plan].initialTax,
        reason: 'initial tax',
      };
      const rowId = String(mainUtils.getUniqueId());
      subscriptions = subscriptions.concat([newSubscription]);

      rowIdSubscriptionMap[rowId] = newSubscription;
      renderSubscriptionRow('view', newSubscription, null, true);

      renderCreditHistoryTable($('#credit-history-table'), [newHistory], true);
      mainUtils.displayUserMessage('Successfully subscribed!', 'success');
    });
  };

  // TODO refactor later
  // eslint-disable-next-line max-params
  function renderSubscriptionRow (mode, subscription, $row, insertBefore) {
    mainUtils.trace('renderSubscriptionRow');

    insertBefore = insertBefore || false;

    assertApp(_.isObject(subscription), {
      msg: 'Expected subscription to be an object, but was ' + typeof subscription, // eslint-disable-line prefer-template
    });

    const subscriptionStringProps = ['id', 'fly_from', 'fly_to', 'date_from', 'date_to', 'plan'];

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
        : mainUtils.getElementUniqueId($row[0], 'subscription-');

    rowIdSubscriptionMap[rowId] = subscription;

    const modes = {
      'view': renderSubscriptionRowViewMode,
      'edit': renderSubscriptionRowEditMode,
    };

    assertApp(typeof modes[mode] === 'function', {
      msg: 'Expected mode to be allowed mode, but was ' + mode, // eslint-disable-line prefer-template
    });

    modes[mode](
      subscription,
      $row,
      { rowId: rowId, insertBefore: insertBefore }
    );

    applyDatePicker();
    // applyAutocomplete(airports.map(function (airport) { // eslint-disable-line prefer-arrow-callback
    //   return airport.name;
    // }));
  }

  function renderSubscriptionRowViewMode (
    subscription,
    $row,
    options,
  ) {
    mainUtils.trace('renderSubscriptionRowViewMode');
    const rowId = options.rowId;
    const insertBefore = options.insertBefore || false;

    assertApp(_.isObject(options));
    assertApp(typeof rowId === 'string');
    assertApp(typeof insertBefore === 'boolean');

    const $subscriptionViewModeClone = $('#subscription-view-mode').clone()
      .removeAttr('hidden')
      .attr('id', 'subscription-' + rowId); // eslint-disable-line prefer-template

    $subscriptionViewModeClone.find('#subscription-view-mode-airport-from')
      .attr('id', 'subscription-view-mode-airport-from-' + rowId) // eslint-disable-line prefer-template
      .text(getAirportName(airports, subscription.fly_from));

    $subscriptionViewModeClone.find('#subscription-view-mode-airport-to')
      .attr('id', 'subscription-view-mode-airport-to-' + rowId) // eslint-disable-line prefer-template
      .text(getAirportName(airports, subscription.fly_to));

    $subscriptionViewModeClone.find('#subscription-view-mode-date-from')
      .attr('id', 'subscription-view-mode-date-from-' + rowId) // eslint-disable-line prefer-template
      .text(subscription.date_from);

    $subscriptionViewModeClone.find('#subscription-view-mode-date-to')
      .attr('id', 'subscription-view-mode-date-to-' + rowId) // eslint-disable-line prefer-template
      .text(subscription.date_to);

    $subscriptionViewModeClone.find('#subscription-view-mode-plan')
      .attr('id', 'subscription-view-mode-plan-' + rowId)
      .text(subscription.plan);

    $subscriptionViewModeClone.find('#subscription-view-mode-search-btn')
      .attr('id', 'subscription-view-mode-search-btn-' + rowId)
      .click(onSearchClick);
    $subscriptionViewModeClone.find('#subscription-view-mode-edit-btn')
      .attr('id', 'subscription-view-mode-edit-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onEditClick);

    if ($row == null) {
      if (insertBefore) {
        $subscriptionViewModeClone.prependTo(
          $('#subscriptions-table tbody'),
        );
      } else {
        $subscriptionViewModeClone.appendTo(
          $('#subscriptions-table tbody'),
        );
      }
    } else {
      $row.replaceWith($subscriptionViewModeClone);
    }
  }

  function renderSubscriptionRowEditMode (
    subscription,
    $row,
    options,
  ) {
    mainUtils.trace('renderSubscriptionRowEditMode');
    const rowId = options.rowId;
    const insertBefore = options.insertBefore || false;

    assertApp(_.isObject(options));
    assertApp(typeof rowId === 'string');
    assertApp(typeof insertBefore === 'boolean');

    const $subscriptionEditModeClone = $('#subscription-edit-mode').clone()
      .removeAttr('hidden')
      .attr('id', 'subscription-' + rowId); // eslint-disable-line prefer-template

    $subscriptionEditModeClone.find('#subscription-edit-mode-airport-from')
      .addClass('airport-select')
      .attr('id', 'subscription-edit-mode-airport-from-' + rowId) // eslint-disable-line prefer-template
      // .attr('list', 'subscription-airport-from-' + rowId) // eslint-disable-line prefer-template
      .attr('value', getAirportName(airports, subscription.fly_from));

    $subscriptionEditModeClone.find('#subscription-edit-mode-airport-to')
      .addClass('airport-select')
      .attr('id', 'subscription-edit-mode-airport-to-' + rowId) // eslint-disable-line prefer-template
      // .attr('list', 'user-subscription-airport-to-' + rowId) // eslint-disable-line prefer-template
      .attr('value', getAirportName(airports, subscription.fly_to));

    $subscriptionEditModeClone.find('#subscription-edit-mode-date-from')
      .addClass('date-select') // Necessary!! items with date-select class will be used with jQuery datepicker (see function applyDatePicker).
      // datepicker won't work with the new clone element if the original cloned element has date-select class (datepicker adds hasDatepicker class and ignores elements with this class)
      .attr('id', 'subscription-edit-mode-date-from-' + rowId) // eslint-disable-line prefer-template
      .attr('value', subscription.date_from);

    $subscriptionEditModeClone.find('#subscription-edit-mode-date-to')
      .addClass('date-select') // Necessary!! items with date-select class will be used with jQuery datepicker (see function applyDatePicker).
      // datepicker won't work with the new clone element if the original cloned element has date-select class (datepicker adds hasDatepicker class and ignores elements with this class)
      .attr('id', 'subscription-edit-mode-date-to-' + rowId) // eslint-disable-line prefer-template
      .attr('value', subscription.date_to);

    $subscriptionEditModeClone.find('#subscription-edit-mode-plan')
      .attr('id', 'subscriptions-edit-mode-plan-' + rowId)
      .attr('value', subscription.plan);

    $subscriptionEditModeClone.find('#subscription-edit-mode-save-btn')
      .attr('id', 'subscription-edit-mode-save-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onSaveClick);

    $subscriptionEditModeClone.find('#subscription-edit-mode-cancel-btn')
      .attr('id', 'subscription-edit-mode-cancel-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onCancelClick);

    $subscriptionEditModeClone.find('#subscription-edit-mode-remove-btn')
      .attr('id', 'subscription-edit-mode-remove-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onRemoveClick);

    $row.replaceWith($subscriptionEditModeClone);
  }

  function applyDatePicker () {
    const datepickerOptions = {
      dateFormat: 'yy-mm-dd',
    };

    $('.date-select').datepicker(datepickerOptions);
  }

  function applyAutocomplete (values) {
    $('#airports-list').fillWithAirports(values);
  }

  function resetSubscriptions () {
    $('#subscriptions-table tbody tr:not(#subscription-edit-mode):not(#subscription-view-mode)')
      .remove();
    for (const prop of Object.keys(rowIdSubscriptionMap)) {
      delete rowIdSubscriptionMap[prop];
    }
    subscriptions.length = 0;
  }

  function displaySubscriptions () {
    const rows = $('#subscriptions-table tbody tr:not(#subscription-edit-mode):not(#subscription-view-mode)');

    if (rows.length === 0) {
      loadMoreSubscriptions(switchTab.bind({}, '#subscriptions-tab'));
    } else {
      switchTab('#subscriptions-tab');
    }
  }

  function loadMoreSubscriptions (callbackOnFinish) {
    assertApp(_.isFunction(callbackOnFinish), { msg: `got ${callbackOnFinish}` });
    const $subscriptionsTable = $('#subscriptions-table');
    const $loadMoreBtn = $('#subscriptions-load-more-btn');
    const $noContentMsg = $('#no-subscriptions-msg');
    const rows = $subscriptionsTable.find('tbody tr:not(#subscription-edit-mode):not(#subscription-view-mode)');
    const offset = rows.length;
    const params = {
      offset: offset,
      limit: SUBSCRIPTIONS_PAGE_LIMIT,
    };
    if (searchFlyFrom) {
      params.fly_from = searchFlyFrom;
    }
    if (searchFlyTo) {
      params.fly_to = searchFlyTo;
    }

    api.listSubscriptions(params, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      const newSubscrs = result.subscriptions;
      if (newSubscrs.length === 0 && offset === 0) {
        $subscriptionsTable.hide();
        $loadMoreBtn.hide();
        $noContentMsg.show();
      } else if (newSubscrs.length < SUBSCRIPTIONS_PAGE_LIMIT) {
        renderSubscriptions($subscriptionsTable, newSubscrs);
        $subscriptionsTable.show();
        $loadMoreBtn.hide();
        $noContentMsg.hide();
      } else {
        renderSubscriptions($subscriptionsTable, newSubscrs);
        $subscriptionsTable.show();
        $loadMoreBtn.show();
        $noContentMsg.hide();
      }

      subscriptions.push.apply(subscriptions, newSubscrs);

      if (callbackOnFinish) {
        callbackOnFinish();
      }
    });
  }

  function resetCreditHistory () {
    $('#credit-history-table tbody tr:not(:first)').remove();
  }

  function displayCreditHistory () {
    if ($('#credit-history-table tbody tr:not(:first)').length === 0) {
      loadMoreCreditHistory(switchTab.bind({}, '#credit-history-tab'));
    } else {
      switchTab('#credit-history-tab');
    }
  }

  function resetDepositHistory () {
    $('#deposit-history-table tbody tr:not(:first)').remove();
  }

  function displayDepositHistory () {
    if ($('#deposit-history-table tbody tr:not(:first)').length === 0) {
      loadMoreDepositHistory(switchTab.bind({}, '#deposit-history-tab'));
    } else {
      switchTab('#deposit-history-tab');
    }
  }

  function switchTab (tabID) {
    const tabs = {
      '#credit-history-tab': '#display-credit-history-btn',
      '#subscriptions-tab': '#display-subscriptions-btn',
      '#deposit-history-tab': '#display-deposit-history-btn',
    };

    for (const tab of Object.keys(tabs)) {
      if (tab !== tabID) {
        $(tab).hide();
        $(tabs[tab]).removeClass('active');
      }
    }

    $(tabID).show();
    $(tabs[tabID]).addClass('active');
  }

  function loadMoreCreditHistory (callbackOnFinish) {
    assertApp(_.isFunction(callbackOnFinish), { msg: `got ${callbackOnFinish}` });
    const $creditsTable = $('#credit-history-table');
    const $noContentMsg = $('#no-credit-history-msg');
    const $loadMoreBtn = $('#credit-history-load-more-btn');
    const offset = $creditsTable.find('tbody tr:not(:first)').length;
    const params = {
      limit: CREDIT_HISTORY_PAGE_LIMIT,
      offset: offset,
      ...creditHistoryFilters,
    };

    api.creditHistory(params, PROTOCOL_NAME, function (result) {
      assertApp(result.status_code >= '1000', { msg: result.status_code + '' });
      assertApp(result.status_code < '2000', { msg: result.status_code + '' });

      const creditHistory = result.credit_history;

      if (offset === 0 && creditHistory.length === 0) {
        $creditsTable.hide();
        $noContentMsg.show();
        $loadMoreBtn.hide();
      } else if (creditHistory.length < CREDIT_HISTORY_PAGE_LIMIT) {
        renderCreditHistoryTable($creditsTable, result);
        $noContentMsg.hide();
        $loadMoreBtn.hide();
      } else {
        renderCreditHistoryTable($creditsTable, result);
        $loadMoreBtn.show();
      }

      if (callbackOnFinish) {
        callbackOnFinish();
      }
    });
  }

  function renderCreditHistoryTable ($table, historyResult, insertBefore) {
    const history = historyResult.credit_history;

    function formatDate (date, accuracy, seperator) {
      if (date == null) {
        return 'ALL';
      } else if (accuracy == null) {
        accuracy = 'day';
      }
      if (typeof date === 'string') {
        date = new Date(date);
      }
      if (seperator == null) {
        seperator = '.';
      }

      assertApp(date instanceof Date, { msg: 'got ' + date });
      assertApp(typeof accuracy === 'string', { msg: 'got ' + date });
      assertApp(typeof seperator === 'string', { msg: 'got ' + seperator });

      const formats = {
        year: function (date) { return date.getFullYear(); },
        month: function (date) {
          const year = date.getFullYear();
          const month = leftPad(date.getMonth() + 1, 2);

          return year + seperator + month;
        },
        day: function (date) {
          const month = leftPad(date.getMonth() + 1, 2);
          const day = leftPad(date.getDate(), 2);

          return date.getFullYear() + seperator + month + seperator + day;
        },
      };

      assertApp(Object.keys(formats).includes(accuracy), {});

      return formats[accuracy](date);
    }
    function leftPad (string, amount, filler) {
      if (typeof string === 'number') {
        string = '' + string;
      }
      if (filler == null) {
        filler = '0';
      }

      assertApp(typeof string === 'string');
      assertApp(_.isNumber(amount), {});
      assertApp(typeof filler === 'string');

      const chars = [];
      for (let k = 0; k < amount - string.length; k++) {
        chars.push(filler);
      }
      for (const c of string) {
        chars.push(c);
      }

      return chars.join('');
    }

    $table.show();

    const $tableRowTemplate = $table.find('#credit-history-template-row');
    const missingFieldValue = 'ALL';

    for (const historyHash of history) {
      const { airport_from_id, airport_to_id } = historyHash;

      var airportFrom = airports.find(
        a => a.id === airport_from_id
      );
      var airportTo = airports.find(a => a.id === airport_to_id);

      airportFrom = airportFrom ? airportFrom.name : missingFieldValue;
      airportTo = airportTo ? airportTo.name : missingFieldValue;

      const statusTexts = {
        true: 'Active',
        false: 'Inactive',
        null: 'All',
        undefined: missingFieldValue,
      };
      const statusText = statusTexts[historyHash.active];
      const dateFrom = formatDate(historyHash.date_from);
      const dateTo = formatDate(historyHash.date_to);
      const transferredAt = formatDate(
        historyHash.transferred_at,
        historyResult.grouped_by.transferred_at,
      );
      const transferAmount = historyHash.transfer_amount;
      const reason = historyHash.reason || missingFieldValue;

      const $tableRow = $tableRowTemplate.clone()
        .removeAttr('id')
        .show();

      renderRow($tableRow, {
        airport_from: airportFrom,
        airport_to: airportTo,
        date_from: dateFrom,
        date_to: dateTo,
        subscr_status: statusText,
        transferred_at: transferredAt,
        transfer_amount: transferAmount,
        reason: reason,
      });

      if (insertBefore) {
        $table.find('tbody tr:first').before($tableRow);
      } else {
        $table.find('tbody tr:last').after($tableRow);
      }
    }

    function renderRow ($tableRow, historyHash) {
      const requiredProperties = [
        'airport_from',
        'airport_to',
        'date_from',
        'date_to',
        'subscr_status',
        'transferred_at',
        'transfer_amount',
        'reason',
      ];
      for (const prop of requiredProperties) {
        assertApp(_.has(historyHash, prop), { msg: 'missing property ' + prop });

        const id = '#credit-' + prop.replace('_', '-');

        $tableRow.find(id).text(historyHash[prop]);
      }
    }
  }

  function loadMoreDepositHistory (callbackOnFinish) {
    assertApp(_.isFunction(callbackOnFinish), { msg: `got ${callbackOnFinish}` });
    const $depositsTable = $('#deposit-history-table');
    const $loadMoreBtn = $('#deposit-history-load-more-btn');
    const $noMoreResultsMsg = $('#no-deposit-history-msg');
    const offset = $depositsTable.find('tbody tr:not(:first)').length;
    const params = {
      limit: CREDIT_HISTORY_PAGE_LIMIT,
      offset: offset,
    };
    if (fromDepositDate) {
      params.from = fromDepositDate.toISOString();
    }
    if (toDepositDate) {
      params.to = toDepositDate.toISOString();
    }

    api.depositHistory(params, PROTOCOL_NAME, function (result) {
      assertApp(result.status_code >= '1000', { msg: result.status_code + '' });
      assertApp(result.status_code < '2000', { msg: result.status_code + '' });

      const depositHistory = result.deposit_history;
      const $rowTemplate = $depositsTable.find('#deposit-history-template-row');

      if (offset === 0 && depositHistory.length === 0) {
        $depositsTable.hide();
        $noMoreResultsMsg.show();
        $loadMoreBtn.hide();
        callbackOnFinish();
        return;
      }

      if (depositHistory.length < CREDIT_HISTORY_PAGE_LIMIT) {
        $loadMoreBtn.hide();
      } else {
        $loadMoreBtn.show();
      }
      renderDepositHistoryTable($depositsTable, $rowTemplate, depositHistory);
      $depositsTable.show();
      $noMoreResultsMsg.hide();

      if (callbackOnFinish) {
        callbackOnFinish();
      }
    });
  }

  function renderDepositHistoryTable ($table, $rowTemplate, history) {
    assertApp($table instanceof jQuery, { msg: `got ${$table}` });
    assertApp($rowTemplate instanceof jQuery, { msg: `got ${$rowTemplate}` });
    assertApp(_.isArray(history), { msg: `got ${history}` });

    for (const deposit of history) {
      const $clone = $rowTemplate.clone()
        .removeAttr('id')
        .show();

      renderRow($clone, deposit);

      $table.find('tbody tr:last').after($clone);
    }

    function renderRow ($tableRow, depositHash) {
      const propToId = {
        'transferred_at': '#deposited-on',
        'transfer_amount': '#deposit-amount',
        'reason': '#deposit-reason',
      };

      for (const prop of Object.keys(propToId)) {
        $tableRow.find(propToId[prop]).text(depositHash[prop]);
      }
    }
  }

  function serializeCreditHistoryParams () {
    return mainUtils.serializeFormInput(
      '#search-credit-history',
      {
        status: function (value) {
          if (value !== 'any') {
            return value === 'active';
          }
        },
        transfer_amount: function (value) {
          return -Math.abs(+value);
        },
        group_by_active: function (value, serialized) {
          serialized.group_by = serialized.group_by || {};
          serialized.group_by.active = value;
        },
        group_by_reason: function (value, serialized) {
          serialized.group_by = serialized.group_by || {};
          serialized.group_by.reason = value;
        },
        transferred_at_date_groupings: function (value, serialized) {
          serialized.group_by = serialized.group_by || {};
          serialized.group_by.transferred_at = value;
        },
      }
    );
  }

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    const userActions = new mainUtils.UserActions();
    userActions.addAction(
      'list_deposit_history',
      {
        asyncFunc:
      }
    );
    $('#display-subscriptions-btn').click(displaySubscriptions);
    $('#subscriptions-load-more-btn').click(loadMoreSubscriptions.bind({}, displaySubscriptions));
    $('#search-subscriptions').submit(function (event) {
      event.preventDefault();
      return false;
    });
    $('#search-subscriptions-btn').click(function () {
      resetSubscriptions();
      searchFlyFrom = $('#search-airport-from').val().trim();
      searchFlyTo = $('#search-airport-to').val().trim();
      displaySubscriptions();
    });

    $('#display-credit-history-btn').click(displayCreditHistory);
    $('#export-credit-history-btn').click(function exportCreditHistory () {
      api.exportCreditHistory(
        serializeCreditHistoryParams(),
        PROTOCOL_NAME,
        function () {},
      );
    });
    $('#export-credit-history-table-btn').click(
      function exportCreditHistoryTable () {
        api.exportCreditHistory(
          creditHistoryFilters,
          PROTOCOL_NAME,
          function () {},
        );
      }
    );
    $('#credit-history-load-more-btn').click(loadMoreCreditHistory.bind({}, displayCreditHistory));
    const creditHistoryFiltersForm = $('#search-credit-history');
    creditHistoryFiltersForm.submit(function (event) {
      event.preventDefault();
      resetCreditHistory();

      creditHistoryFilters = serializeCreditHistoryParams();

      displayCreditHistory();
      return false;
    });

    $('#display-deposit-history-btn').click(displayDepositHistory);
    $('#deposit-history-load-more-btn').click(loadMoreDepositHistory.bind({}, displayDepositHistory));
    $('#search-deposit-history').submit(function (event) {
      event.preventDefault();
      return false;
    });
    $('#search-deposit-history-btn').click(function () {
      resetDepositHistory();
      fromDepositDate = $('#from-deposit-date').val().trim();
      fromDepositDate = fromDepositDate === '' ? null : new Date(fromDepositDate);
      toDepositDate = $('#to-deposit-date').val().trim();
      toDepositDate = toDepositDate === '' ? null : new Date(toDepositDate);
      displayDepositHistory();
    });

    $('#subscribe-submit-btn').click(onSubscribeSubmitClick);
    $('#subscribe-clear-btn').click(function () {
      mainUtils.clearFormData('#subscribe-form');
      mainUtils.saveFormData(CURRENT_PAGE_NAME, 'subscribe-form');
    });

    const $form = $('#subscribe-form');

    mainUtils.restoreFormData(CURRENT_PAGE_NAME, 'subscribe-form');
    $form.submit(function (event) {
      event.preventDefault();
      return false;
    });
    $form.change(function () {
      mainUtils.saveFormData(CURRENT_PAGE_NAME, 'subscribe-form');
    });

    api.getAPIKey({
      v: '2.0',
    }, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      if (result.status_code === '1000') {
        APIKeyRef.APIKey = result.api_key;

        api.listAirports(PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
          airports = result.airports;

          const toAirportName = function (airport) { // eslint-disable-line prefer-arrow-callback
            return airport.name;
          };

          const airportNames = airports.map(toAirportName);

          applyAutocomplete(airportNames);

          displaySubscriptions();
        });

        applyDatePicker();
      } else {
        window.location.replace('/login');
      }
    });
  });
}

start();
