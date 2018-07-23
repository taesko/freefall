'use strict';

function start () {
  const mainUtils = main();
  const listAirports = mainUtils.listAirports;
  const sendRequest = mainUtils.sendRequest;
  const assertUser = mainUtils.assertUser;
  const assertPeer = mainUtils.assertPeer;
  const assertApp = mainUtils.assertApp;
  const PeerError = mainUtils.PeerError;
  const trace = mainUtils.trace;
  const getValidatorMsg = mainUtils.getValidatorMsg;
  const getAirportName = mainUtils.getAirportName;
  const getAirportId = mainUtils.getAirportId;
  const SERVER_URL = mainUtils.SERVER_URL;
  const getUniqueId = mainUtils.getUniqueId;
  const displayUserMessage = mainUtils.displayUserMessage;
  const getAPIKey = mainUtils.getAPIKey;
  const getElementUniqueId = mainUtils.getElementUniqueId;
  const validateErrorRes = validators.getValidateErrorRes();
  const validateListSubscriptionsRes = validators.getValidateListSubscriptionsRes();
  const validateSubscribeReq = validators.getValidateSubscribeReq();
  const validateUnsubscribeReq = validators.getValidateUnsubscribeReq();
  const validateSubscribeRes = validators.getValidateSubscribeRes();
  const validateUnsubscribeRes = validators.getValidateUnsubscribeRes();

  var airports = []; // eslint-disable-line no-var
  var subscriptions = []; // eslint-disable-line no-var
  var rowIdSubscriptionMap = {}; // eslint-disable-line no-var
  var APIKey; // eslint-disable-line no-var

  function renderSubscriptions ($subscriptionsTable, subscriptions) {
    trace('renderSubscriptions');

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
      const rowId = String(getUniqueId());
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
    trace('edit button click');

    const rowId = getElementUniqueId(event.target, 'edit-btn-');
    const rowValues = rowIdSubscriptionMap[rowId];
    const rowElement = $('#row-' + rowId)[0]; // eslint-disable-line prefer-template

    // TODO - change to hidden row and clone
    renderRowEditMode(rowElement, [
      '<input id="airport-from-' + rowId + '" class="form-control airport-select" name="from" type="text" placeholder="Airport from" list="from-airports" value="' + getAirportName(airports, rowValues.fly_from) + '" required>', // eslint-disable-line prefer-template
      '<input id="airport-to-' + rowId + '" name="to" class="form-control airport-select" type="text" placeholder="Airport to" list="to-airports" value="' + getAirportName(airports, rowValues.fly_to) + '" required>', // eslint-disable-line prefer-template
      '<input id="date-from-' + rowId + '" class="form-control date-select" name="date-from" type="text" placeholder="Date from" value="' + rowValues.date_from + '" required>', // eslint-disable-line prefer-template
      '<input id="date-to-' + rowId + '" name="date-to" class="form-control date-select" type="text" placeholder="Date to" value="' + rowValues.date_to + '" required>', // eslint-disable-line prefer-template
      'options',
    ]);
  };

  const onSaveClick = function (event) {
    trace('save button click');

    const saveButton = event.target;
    saveButton.disabled = true;

    const rowId = getElementUniqueId(event.target, 'save-btn-');
    const rowValues = rowIdSubscriptionMap[rowId];

    const airportFrom = $('#airport-from-' + rowId).val(); // eslint-disable-line prefer-template
    const airportTo = $('#airport-to-' + rowId).val(); // eslint-disable-line prefer-template
    const dateFrom = $('#date-from-' + rowId).val(); // eslint-disable-line prefer-template
    const dateTo = $('#date-to-' + rowId).val(); // eslint-disable-line prefer-template

    unsubscribe({
      v: '2.0',
      user_subscription_id: rowValues.id,
      api_key: APIKey,
    }, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
      if (result.status_code === 2000) {
        trace('unsubscribe method error');

        displayUserMessage('There is no information about this flight at the moment. Please come back in 15 minutes.', 'info');
      } else if (result.status_code >= 1000 && result.status_code < 2000) {
        trace('unsubscribe method success');

        // displayUserMessage('Successfully unsubscribed!', 'success');
        subscribe({
          v: '2.0',
          fly_from: getAirportId(airports, airportFrom),
          fly_to: getAirportId(airports, airportTo),
          date_from: dateFrom,
          date_to: dateTo,
          api_key: APIKey,
        }, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
          if (result.status_code === 2000) {
            trace('subscribe method error');

            // TODO handle ERROR
          } else if (result.status_code >= 1000 && result.status_code < 2000) {
            trace('subscribe method success');

            subscriptions = subscriptions.map(function (subscription) { // eslint-disable-line prefer-arrow-callback
              if (subscription.id !== rowValues.id) {
                return subscription;
              }

              const newSubscription = {
                id: result.subscription_id,
                fly_from: getAirportId(airports, airportFrom),
                fly_to: getAirportId(airports, airportTo),
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
    trace('cancel button click');

    const rowId = getElementUniqueId(event.target, 'cancel-btn-');
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
    trace('remove button click');

    const removeButton = event.target;
    removeButton.disabled = true;
    const rowId = getElementUniqueId(event.target, 'remove-btn-');
    const rowValues = rowIdSubscriptionMap[rowId];

    // TODO asserts

    unsubscribe({
      v: '2.0',
      user_subscription_id: rowValues.id,
      api_key: APIKey,
    }, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
      if (result.status_code === 2000) {
        trace('unsubscribe method error');

        // TODO handle ERROR
      } else if (result.status_code >= 1000 && result.status_code < 2000) {
        trace('unsubscribe method success');

        subscriptions = subscriptions.filter(function (subscription) { // eslint-disable-line prefer-arrow-callback
          return subscription.id !== rowValues.id;
        });

        delete rowIdSubscriptionMap[rowId];

        $('#row-' + rowId).remove(); // eslint-disable-line prefer-template
      }
    });
  };

  const onSubscribeSubmitClick = function (event) {
    trace('Subscribe submit click');

    const subscribeBtn = event.target;
    subscribeBtn.disabled = true;

    const airportFrom = $('#subscribe-airport-from').val();
    const airportTo = $('#subscribe-airport-to').val();
    const dateFrom = $('#subscribe-date-from').val();
    const dateTo = $('#subscribe-date-to').val();

    subscribe({
      v: '2.0',
      fly_from: getAirportId(airports, airportFrom),
      fly_to: getAirportId(airports, airportTo),
      date_from: dateFrom,
      date_to: dateTo,
      api_key: APIKey,
    }, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
      if (result.status_code === 2000) {
        trace('subscribe method error');

        // TODO handle ERROR
      } else if (result.status_code >= 1000 && result.status_code < 2000) {
        trace('subscribe method success');

        const newSubscription = {
          id: result.subscription_id,
          fly_from: getAirportId(airports, airportFrom),
          fly_to: getAirportId(airports, airportTo),
          date_from: dateFrom,
          date_to: dateTo,
        };

        subscriptions = subscriptions.concat([newSubscription]);

        // TODO check if table empty

        const newRow = $('#subscriptions-table tbody')[0].insertRow();
        const rowId = String(getUniqueId());
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

        subscribeBtn.disabled = false;
      }
    });
  };

  function renderRowEditMode (rowElement, rowValues) {
    trace('renderRowEditMode');

    assertApp(rowElement instanceof window.HTMLTableRowElement, {
      msg: 'Expected rowElement to be HTMLTableRowElement, but got ' + typeof rowElement, // eslint-disable-line prefer-template
    });

    assertApp(rowValues instanceof Array, {
      msg: 'Expected rowValues to be an array, but got ' + typeof rowValues, // eslint-disable-line prefer-template
    });

    $(rowElement).find('td').remove();

    const rowId = getElementUniqueId(rowElement, 'row-');

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
    trace('renderRowViewMode');

    assertApp(rowElement instanceof window.HTMLTableRowElement, {
      msg: 'Expected rowElement to be HTMLTableRowElement, but got ' + typeof rowElement, // eslint-disable-line prefer-template
    });

    assertApp(rowValues instanceof Array, {
      msg: 'Expected rowValues to be an array, but got ' + typeof rowValues, // eslint-disable-line prefer-template
    });

    $(rowElement).find('td').remove();

    const rowId = getElementUniqueId(rowElement, 'row-');

    var i; // eslint-disable-line no-var

    for (i = 0; i < rowValues.length; i++) {
      const newCol = rowElement.insertCell(i);

      if (rowValues[i] === 'options') {
        $('<button id="edit-btn-' + rowId + '" type="button" class="btn btn-primary">Edit</button>') // eslint-disable-line prefer-template
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

  function listSubscriptions (protocolName, callback) {
    trace('listSubscriptions(' + protocolName + '), typeof arg=' + typeof protocolName + ''); // eslint-disable-line prefer-template

    sendRequest({
      url: SERVER_URL,
      data: {
        method: 'list_subscriptions',
        params: {
          v: '2.0',
          api_key: APIKey,
        },
      },
      protocolName: protocolName,
    }, function (result, error) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        assertPeer(validateErrorRes(error), {
          msg: 'Params do not adhere to errorResponseSchema: ' + getValidatorMsg(validateErrorRes), // eslint-disable-line prefer-template
        });

        trace('Error in listSubscriptions:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateListSubscriptionsRes(result), {
        msg: 'Params do not adhere to validateSubscriptionsResponseSchema: ' + getValidatorMsg(validateListSubscriptionsRes), // eslint-disable-line prefer-template
      });

      callback(result);
    });
  }

  function unsubscribe (params, protocolName, callback) {
    trace('unsubscribe(' + JSON.stringify(params) + '), typeof arg=' + typeof params + ''); // eslint-disable-line prefer-template

    assertApp(validateUnsubscribeReq(params), {
      msg: 'Params do not adhere to unsubscribeRequestSchema: ' + getValidatorMsg(validateUnsubscribeReq), // eslint-disable-line prefer-template
    });

    sendRequest({
      url: SERVER_URL,
      data: {
        method: 'unsubscribe',
        params: params,
      },
      protocolName: protocolName,
    }, function (result, error) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        assertPeer(validateErrorRes(error), {
          msg: 'Params do not adhere to errorResponseSchema: ' + getValidatorMsg(validateErrorRes), // eslint-disable-line prefer-template
        });

        trace('Error in unsubscribe:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateUnsubscribeRes(result), {
        msg: 'Params do not adhere to unsubscribeResponseSchema: ' + getValidatorMsg(validateUnsubscribeRes), // eslint-disable-line prefer-template
      });

      callback(result);
    });
  }

  function subscribe (params, protocolName, callback) {
    trace('subscribe(' + JSON.stringify(params) + '), typeof arg=' + typeof params + ''); // eslint-disable-line prefer-template

    assertApp(validateSubscribeReq(params), {
      msg: 'Params do not adhere to subscriptionRequestSchema: ' + getValidatorMsg(validateSubscribeReq), // eslint-disable-line prefer-template
    });

    const airportFrom = getAirportName(airports, params.fly_from);
    const airportTo = getAirportName(airports, params.fly_to);

    assertApp(typeof airportFrom === 'string', {
      msg: 'Could not find airport "' + params.fly_from + '"', // eslint-disable-line prefer-template
    });
    assertApp(typeof airportTo === 'string', {
      msg: 'Could not find airport "' + params.fly_to + '"', // eslint-disable-line prefer-template
    });

    sendRequest({
      url: SERVER_URL,
      data: {
        method: 'subscribe',
        params: params,
      },
      protocolName: protocolName,
    }, function (result, error) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        assertPeer(validateErrorRes(error), {
          msg: 'Params do not adhere to errorResponseSchema: ' + getValidatorMsg(validateErrorRes), // eslint-disable-line prefer-template
        });

        trace('Error in subscribe:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateSubscribeRes(result), {
        msg: 'Params do not adhere to subscriptionResponseSchema: ' + getValidatorMsg(validateSubscribeRes), // eslint-disable-line prefer-template
      });
      assertUser(result.status_code >= 1000 && result.status_code < 2000, {
        userMessage: 'Already subscribed for flights from ' + airportFrom + ' to ' + airportTo + '.', // eslint-disable-line prefer-template
        msg: 'Tried to subscribe but subscription already existed. Sent params: ' + params + '. Got result: ' + result + '', // eslint-disable-line prefer-template
      });

      callback(result);
    });
  }

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    const $subscribeSubmitBtn = $('#subscribe-submit-btn');

    $subscribeSubmitBtn.click(onSubscribeSubmitClick);

    getAPIKey({
      v: '2.0',
    }, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
      if (result.status_code < 1000 || result.status_code >= 2000) {
        window.location.replace('/login');
      } else {
        APIKey = result.api_key;
        const $subsTable = $('#subscriptions-table');

        listAirports('jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
          airports = result.airports;

          const toAirportName = function (airport) { // eslint-disable-line prefer-arrow-callback
            return airport.name;
          };

          const airportNames = airports.map(toAirportName);

          applyAutocomplete(airportNames);

          listSubscriptions('jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
            subscriptions = result.subscriptions;
            renderSubscriptions($subsTable, subscriptions);
          });
        });

        applyDatePicker();
      }
    });
  });
}

start();
