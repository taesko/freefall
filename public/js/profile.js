/* eslint-disable prefer-template,prefer-arrow-callback,camelcase */
'use strict';

function start () {
  const mainUtils = main();

  const UserError = mainUtils.UserError;
  const assertUser = mainUtils.assertUser;
  const assertPeer = mainUtils.assertPeer;
  const assertApp = mainUtils.assertApp;
  const PROTOCOL_NAME = mainUtils.PROTOCOL_NAME;

  const api = getAPIMethods(mainUtils);

  var airports = []; // eslint-disable-line no-var
  var subscriptions = []; // eslint-disable-line no-var
  var rowIdSubscriptionMap = {}; // eslint-disable-line no-var
  var APIKeyRef = mainUtils.APIKeyRef; // eslint-disable-line no-var
  const CREDIT_HISTORY_PAGE_LIMIT = 5;

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

    if (subscriptions.length > 0) {
      showSubscriptionsTable();
    } else {
      hideSubscriptionTable();
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

    rowIdSubscriptionMap = {};

    _.each(subscriptions, function (subscription) { // eslint-disable-line prefer-arrow-callback
      renderSubscriptionRow('view', subscription);
    });
  }

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
    }, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      saveButton.disabled = false;

      const messages = {
        '1000': 'Successfully edited subscription.',
        '2000': 'Such subscription already exists.',
        '2100': 'Bad request parameters format.',
        '2101': 'Such route does not exist. Departure airport or arrival airport could not be found.',
        '2102': 'Invalid dates. Date to can not be earlier than date from.',
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

    subscribeBtn.disabled = true;

    api.subscribe({
      v: '2.0',
      fly_from: airportFromId,
      fly_to: airportToId,
      date_from: dateFrom,
      date_to: dateTo,
      api_key: APIKeyRef.APIKey,
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
      };

      subscriptions = subscriptions.concat([newSubscription]);
      const rowId = String(mainUtils.getUniqueId());

      rowIdSubscriptionMap[rowId] = newSubscription;
      renderSubscriptionRow('view', newSubscription);
      mainUtils.displayUserMessage('Successfully subscribed!', 'success');
    });
  };

  function renderSubscriptionRow (mode, subscription, $row) {
    mainUtils.trace('renderSubscriptionRow');

    assertApp(_.isObject(subscription), {
      msg: 'Expected subscription to be an object, but was ' + typeof subscription, // eslint-disable-line prefer-template
    });

    const subscriptionStringProps = ['id', 'fly_from', 'fly_to', 'date_from', 'date_to'];

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

    modes[mode](subscription, rowId, $row);

    applyDatePicker();
    applyAutocomplete(airports.map(function (airport) { // eslint-disable-line prefer-arrow-callback
      return airport.name;
    }));
  }

  function renderSubscriptionRowViewMode (subscription, rowId, $row) {
    mainUtils.trace('renderSubscriptionRowViewMode');

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

    $subscriptionViewModeClone.find('#subscription-view-mode-edit-btn')
      .attr('id', 'subscription-view-mode-edit-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onEditClick);

    if ($row == null) {
      $subscriptionViewModeClone.appendTo(
        $('#subscriptions-table tbody')
      );
    } else {
      $row.replaceWith($subscriptionViewModeClone);
    }
  }

  function renderSubscriptionRowEditMode (subscription, rowId, $row) {
    mainUtils.trace('renderSubscriptionRowEditMode');

    const $subscriptionEditModeClone = $('#subscription-edit-mode').clone()
      .removeAttr('hidden')
      .attr('id', 'subscription-' + rowId); // eslint-disable-line prefer-template

    $subscriptionEditModeClone.find('#subscription-edit-mode-airport-from')
      .addClass('airport-select')
      .attr('id', 'subscription-edit-mode-airport-from-' + rowId) // eslint-disable-line prefer-template
      .attr('list', 'subscription-airport-from-' + rowId) // eslint-disable-line prefer-template
      .attr('value', getAirportName(airports, subscription.fly_from));

    $subscriptionEditModeClone.find('#subscription-edit-mode-airport-to')
      .addClass('airport-select')
      .attr('id', 'subscription-edit-mode-airport-to-' + rowId) // eslint-disable-line prefer-template
      .attr('list', 'user-subscription-airport-to-' + rowId) // eslint-disable-line prefer-template
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
    $('.airport-select').autocomplete(values);
  }

  function displaySubscriptions () {
    $('#credit-history-tab').hide();
    $('#subscriptions-tab').show();
  }

  function displayCreditHistory () {
    $('#credit-history-tab').show();
    $('#subscriptions-tab').hide();

    if ($('#credit-history-table tbody tr:not(:first)').length === 0) {
      loadMoreCreditHistory();
    }
  }

  function loadMoreCreditHistory () {
    const $creditsTable = $('#credit-history-table');
    const offset = $creditsTable.find('tbody tr:not(:first)').length;
    const params = {
      limit: CREDIT_HISTORY_PAGE_LIMIT,
      offset: offset,
    };

    api.creditHistory(params, PROTOCOL_NAME, function (result) {
      assertApp(result.status_code >= '1000', { msg: result.status_code + '' });
      assertApp(result.status_code < '2000', { msg: result.status_code + '' });

      const history = result.credit_history;
      if (offset === 0 && history.length === 0) {
        $creditsTable.hide();
        $('#no-credit-history-msg').show();
        $('#credit-history-load-more-btn').hide();
      } else if (history.length < CREDIT_HISTORY_PAGE_LIMIT) {
        renderCreditHistory($creditsTable, history);
        $('#credit-history-load-more-btn').hide();
      } else {
        renderCreditHistory($creditsTable, history);
      }
    });
  }

  function renderCreditHistory ($table, history) {
    // $table.find('tr:not(:first)').remove();
    const $tableRowTemplate = $table.find('#credit-history-template-row');

    for (const historyHash of history) {
      const {
        fly_from,
        fly_to,
        date_from,
        date_to,
      } = subscriptions.find(s => s.id === historyHash.id);
      const { name: airportFrom } = airports.find(a => a.id === fly_from);
      const { name: airportTo } = airports.find(a => a.id === fly_to);
      const $tableRow = $tableRowTemplate.clone()
        .removeAttr('id')
        .show();
      renderRow($tableRow, {
        airport_from: airportFrom,
        airport_to: airportTo,
        date_from: date_from,
        date_to: date_to,
        transferred_at: new Date(historyHash.transferred_at).toLocaleString(),
        transfer_amount: historyHash.transfer_amount,
        reason: historyHash.reason,
      });
      $table.find('tbody tr:last').after($tableRow);
    }

    function renderRow ($tableRow, historyHash) {
      const requiredProperties = [
        'airport_from',
        'airport_to',
        'date_from',
        'date_to',
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

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    $('#subscribe-submit-btn').click(onSubscribeSubmitClick);
    $('#display-credit-history-btn').click(displayCreditHistory);
    $('#display-subscriptions-btn').click(displaySubscriptions);
    $('#credit-history-load-more-btn').click(loadMoreCreditHistory);

    api.getAPIKey({
      v: '2.0',
    }, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      if (result.status_code === '1000') {
        APIKeyRef.APIKey = result.api_key;
        const $subscriptionsTable = $('#subscriptions-table');

        api.listAirports(PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
          airports = result.airports;

          const toAirportName = function (airport) { // eslint-disable-line prefer-arrow-callback
            return airport.name;
          };

          const airportNames = airports.map(toAirportName);

          applyAutocomplete(airportNames);

          api.listSubscriptions(PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
            subscriptions = result.subscriptions;
            renderSubscriptions($subscriptionsTable, subscriptions);
          });
        });

        applyDatePicker();
      } else {
        window.location.replace('/login');
      }
    });
  });
}

start();
