'use strict';

function start () {
  const mainUtils = main();

  const UserError = mainUtils.UserError;
  const assertUser = mainUtils.assertUser;
  const assertApp = mainUtils.assertApp;

  const api = getAPIMethods(mainUtils);

  var airports = []; // eslint-disable-line no-var
  var subscriptions = []; // eslint-disable-line no-var
  var rowIdSubscriptionMap = {}; // eslint-disable-line no-var
  var APIKeyRef = mainUtils.APIKeyRef; // eslint-disable-line no-var

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

  function showSubscriptionsTable ($subscriptionsTable) {
    $('#subscriptions-table').removeAttr('hidden');
    $('#no-subscriptions-msg').attr('hidden', 'true');
  }

  function hideSubscriptionTable ($subscriptionsTable) {
    $('#subscriptions-table').attr('hidden', 'true');
    $('#no-subscriptions-msg').removeAttr('hidden');
  }

  function renderSubscriptions ($subscriptionsTable, subscriptions) {
    mainUtils.trace('renderSubscriptions');

    if (subscriptions.length > 0) {
      showSubscriptionsTable($('#subscriptions-table'));
    } else {
      hideSubscriptionTable($('#subscriptions-table'));
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

    $subscriptionsTable.find('tbody').remove();
    const $tableBody = $('<tbody></tbody>').appendTo($subscriptionsTable);
    rowIdSubscriptionMap = {};

    _.each(subscriptions, function (subscription) { // eslint-disable-line prefer-arrow-callback
      assertApp(_.isObject(subscription), {
        msg: 'Expected subscription to be an object, but was ' + typeof subscription, // eslint-disable-line prefer-template
      });

      const subscriptionProps = ['id', 'fly_from', 'fly_to', 'date_from', 'date_to'];

      _.each(subscriptionProps, function (prop) { // eslint-disable-line prefer-arrow-callback
        assertApp(typeof subscription[prop] === 'string', {
          msg: 'Expected subscription ' + prop + ' to be a string, but was ' + typeof subscription[prop], // eslint-disable-line prefer-template
        });
      });

      const airportFromName = getAirportName(airports, subscription.fly_from);
      const airportToName = getAirportName(airports, subscription.fly_to);

      const newRow = $tableBody[0].insertRow();
      const rowId = String(mainUtils.getUniqueId());
      const rowValues = [
        airportFromName,
        airportToName,
        subscription.date_from,
        subscription.date_to,
        'options',
      ];

      rowIdSubscriptionMap[rowId] = subscription;

      $(newRow).attr('id', 'row-' + rowId); // eslint-disable-line prefer-template
      renderRowViewMode(newRow, rowValues);
    });
  }

  const onEditClick = function (event) {
    mainUtils.trace('edit button click');

    const rowId = mainUtils.getElementUniqueId(event.target, 'edit-btn-');
    const rowValues = rowIdSubscriptionMap[rowId];
    const rowElement = $('#row-' + rowId)[0]; // eslint-disable-line prefer-template

    // TODO - change to hidden row and clone
    renderRowEditMode(rowElement, [
      '<input id="airport-from-' + rowId + '" class="form-control airport-select" name="from" type="text" placeholder="Airport from" list="from-airports-' + rowId + '" value="' + getAirportName(airports, rowValues.fly_from) + '" required>', // eslint-disable-line prefer-template
      '<input id="airport-to-' + rowId + '" name="to" class="form-control airport-select" type="text" placeholder="Airport to" list="to-airports-' + rowId + '" value="' + getAirportName(airports, rowValues.fly_to) + '" required>', // eslint-disable-line prefer-template
      '<input id="date-from-' + rowId + '" class="form-control date-select" name="date-from" type="text" placeholder="Date from" value="' + rowValues.date_from + '" required>', // eslint-disable-line prefer-template
      '<input id="date-to-' + rowId + '" name="date-to" class="form-control date-select" type="text" placeholder="Date to" value="' + rowValues.date_to + '" required>', // eslint-disable-line prefer-template
      'options',
    ]);
  };

  const onSaveClick = function (event) {
    mainUtils.trace('save button click');

    const saveButton = event.target;

    const rowId = mainUtils.getElementUniqueId(event.target, 'save-btn-');
    const rowValues = rowIdSubscriptionMap[rowId];

    const airportFrom = $('#airport-from-' + rowId).val(); // eslint-disable-line prefer-template
    const airportTo = $('#airport-to-' + rowId).val(); // eslint-disable-line prefer-template
    const dateFrom = $('#date-from-' + rowId).val(); // eslint-disable-line prefer-template
    const dateTo = $('#date-to-' + rowId).val(); // eslint-disable-line prefer-template

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

    api.unsubscribe({
      v: '2.0',
      user_subscription_id: rowValues.id,
      api_key: APIKeyRef.APIKey,
    }, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
      if (result.status_code === 2000) {
        mainUtils.trace('unsubscribe method error');

        mainUtils.displayUserMessage('There is no information about this flight at the moment. Please come back in 15 minutes.', 'info');
      } else if (result.status_code >= 1000 && result.status_code < 2000) {
        mainUtils.trace('unsubscribe method success');

        // displayUserMessage('Successfully unsubscribed!', 'success');
        api.subscribe({
          v: '2.0',
          fly_from: airportFromId,
          fly_to: airportToId,
          date_from: dateFrom,
          date_to: dateTo,
          api_key: APIKeyRef.APIKey,
        }, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
          saveButton.disabled = false;

          if (result.status_code === 2000) {
            mainUtils.trace('subscribe method error');

            // TODO handle ERROR
          } else if (result.status_code >= 1000 && result.status_code < 2000) {
            mainUtils.trace('subscribe method success');

            subscriptions = subscriptions.map(function (subscription) { // eslint-disable-line prefer-arrow-callback
              if (subscription.id !== rowValues.id) {
                return subscription;
              }

              const newSubscription = {
                id: result.subscription_id,
                fly_from: airportFromId,
                fly_to: airportToId,
                date_from: dateFrom,
                date_to: dateTo,
              };

              rowIdSubscriptionMap[rowId] = newSubscription;

              return newSubscription;
            });

            const rowElement = $('#row-' + rowId)[0]; // eslint-disable-line prefer-template

            renderRowViewMode(rowElement, [
              airportFrom,
              airportTo,
              dateFrom,
              dateTo,
              'options',
            ]);
          }
        });
      }
    });
  };

  const onCancelClick = function (event) {
    mainUtils.trace('cancel button click');

    const rowId = mainUtils.getElementUniqueId(event.target, 'cancel-btn-');
    const rowValues = rowIdSubscriptionMap[rowId];
    const rowElement = $('#row-' + rowId)[0]; // eslint-disable-line prefer-template

    renderRowViewMode(rowElement, [
      getAirportName(airports, rowValues.fly_from),
      getAirportName(airports, rowValues.fly_to),
      rowValues.date_from,
      rowValues.date_to,
      'options',
    ]);
  };

  const onRemoveClick = function (event) {
    mainUtils.trace('remove button click');

    const removeButton = event.target;
    const rowId = mainUtils.getElementUniqueId(event.target, 'remove-btn-');
    const rowValues = rowIdSubscriptionMap[rowId];

    // TODO asserts

    removeButton.disabled = true;

    api.unsubscribe({
      v: '2.0',
      user_subscription_id: rowValues.id,
      api_key: APIKeyRef.APIKey,
    }, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
      removeButton.disabled = false;

      if (result.status_code === 2000) {
        mainUtils.trace('unsubscribe method error');

        // TODO handle ERROR
      } else if (result.status_code >= 1000 && result.status_code < 2000) {
        mainUtils.trace('unsubscribe method success');

        subscriptions = subscriptions.filter(function (subscription) { // eslint-disable-line prefer-arrow-callback
          return subscription.id !== rowValues.id;
        });

        delete rowIdSubscriptionMap[rowId];

        $('#row-' + rowId).remove(); // eslint-disable-line prefer-template

        if (subscriptions.length > 0) {
          showSubscriptionsTable($('#subscriptions-table'));
        } else {
          hideSubscriptionTable($('#subscriptions-table'));
        }
      }
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

    subscribeBtn.disabled = true;

    api.subscribe({
      v: '2.0',
      fly_from: airportFromId,
      fly_to: airportToId,
      date_from: dateFrom,
      date_to: dateTo,
      api_key: APIKeyRef.APIKey,
    }, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
      subscribeBtn.disabled = false;

      if (result.status_code === 2000) {
        mainUtils.trace('subscribe method error');

        // TODO handle ERROR
      } else if (result.status_code >= 1000 && result.status_code < 2000) {
        mainUtils.trace('subscribe method success');

        const newSubscription = {
          id: result.subscription_id,
          fly_from: airportFromId,
          fly_to: airportToId,
          date_from: dateFrom,
          date_to: dateTo,
        };

        subscriptions = subscriptions.concat([newSubscription]);

        // TODO check if table empty

        const newRow = $('#subscriptions-table tbody')[0].insertRow();
        const rowId = String(mainUtils.getUniqueId());
        const rowValues = [
          airportFrom,
          airportTo,
          dateFrom,
          dateTo,
          'options',
        ];

        rowIdSubscriptionMap[rowId] = newSubscription;
        $(newRow).attr('id', 'row-' + rowId); // eslint-disable-line prefer-template

        renderRowViewMode(newRow, rowValues);
      }
    });
  };

  function renderRowEditMode (rowElement, rowValues) {
    mainUtils.trace('renderRowEditMode');

    assertApp(rowElement instanceof window.HTMLTableRowElement, {
      msg: 'Expected rowElement to be HTMLTableRowElement, but got ' + typeof rowElement, // eslint-disable-line prefer-template
    });

    assertApp(rowValues instanceof Array, {
      msg: 'Expected rowValues to be an array, but got ' + typeof rowValues, // eslint-disable-line prefer-template
    });

    $(rowElement).find('td').remove();

    const rowId = mainUtils.getElementUniqueId(rowElement, 'row-');

    var i; // eslint-disable-line no-var

    for (i = 0; i < rowValues.length; i++) {
      const newCol = rowElement.insertCell(i);

      if (rowValues[i] === 'options') {
        $('<button id="save-btn-' + rowId + '" type="button" class="btn btn-primary">Save</button>') // eslint-disable-line prefer-template
          .appendTo(newCol)
          .click(onSaveClick);

        $('<button id="cancel-btn-' + rowId + '" type="button" class="btn btn-default">Cancel</button>') // eslint-disable-line prefer-template
          .appendTo(newCol)
          .click(onCancelClick);

        $('<button id="remove-btn-' + rowId + '" type="button" class="btn btn-danger">Remove</button>') // eslint-disable-line prefer-template
          .appendTo(newCol)
          .click(onRemoveClick);

        continue;
      }

      $(newCol).append(rowValues[i]);
    }

    applyDatePicker();
    applyAutocomplete(airports.map(function (airport) { // eslint-disable-line prefer-arrow-callback
      return airport.name;
    }));
  }

  function renderRowViewMode (rowElement, rowValues) {
    mainUtils.trace('renderRowViewMode');

    if (subscriptions.length > 0) {
      showSubscriptionsTable($('#subscriptions-table'));
    } else {
      hideSubscriptionTable($('#subscriptions-table'));
    }

    assertApp(rowElement instanceof window.HTMLTableRowElement, {
      msg: 'Expected rowElement to be HTMLTableRowElement, but got ' + typeof rowElement, // eslint-disable-line prefer-template
    });

    assertApp(rowValues instanceof Array, {
      msg: 'Expected rowValues to be an array, but got ' + typeof rowValues, // eslint-disable-line prefer-template
    });

    $(rowElement).find('td').remove();

    const rowId = mainUtils.getElementUniqueId(rowElement, 'row-');

    var i; // eslint-disable-line no-var

    for (i = 0; i < rowValues.length; i++) {
      const newCol = rowElement.insertCell(i);

      if (rowValues[i] === 'options') {
        $('<button id="edit-btn-' + rowId + '" type="button" class="btn btn-primary btn-block">Edit</button>') // eslint-disable-line prefer-template
          .appendTo(newCol)
          .click(onEditClick);

        continue;
      }

      $(newCol).text(rowValues[i]);
    }
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

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    const $subscribeSubmitBtn = $('#subscribe-submit-btn');

    $subscribeSubmitBtn.click(onSubscribeSubmitClick);

    api.getAPIKey({
      v: '2.0',
    }, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
      if (result.status_code < 1000 || result.status_code >= 2000) {
        window.location.replace('/login');
      } else {
        APIKeyRef.APIKey = result.api_key;
        const $subscriptionsTable = $('#subscriptions-table');

        api.listAirports('jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
          airports = result.airports;

          const toAirportName = function (airport) { // eslint-disable-line prefer-arrow-callback
            return airport.name;
          };

          const airportNames = airports.map(toAirportName);

          applyAutocomplete(airportNames);

          api.listSubscriptions('jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
            subscriptions = result.subscriptions;
            renderSubscriptions($subscriptionsTable, subscriptions);
          });
        });

        applyDatePicker();
      }
    });
  });
}

start();
