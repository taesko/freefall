'use strict';

function start () {
  const mainUtils = main();
  const listAirports = mainUtils.listAirports;
  const sendRequest = mainUtils.sendRequest;
  const assertPeer = mainUtils.assertPeer;
  const assertApp = mainUtils.assertApp;
  const PeerError = mainUtils.PeerError;
  const trace = mainUtils.trace;
  const getValidatorMsg = mainUtils.getValidatorMsg;
  const getAirportName = mainUtils.getAirportName;
  const getAirportId = mainUtils.getAirportId;
  const SERVER_URL = mainUtils.SERVER_URL;
  const getId = mainUtils.getId;
  const validateErrorRes = validators.getValidateErrorRes();
  const validateListSubscriptionsRes = validators.getValidateListSubscriptionsRes();

  var airports = []; // eslint-disable-line no-var
  var subscriptions = []; // eslint-disable-line no-var
  var rowIdSubscriptionMap = {}; // eslint-disable-line no-var

  function renderSubscriptions ($subscriptionsTable, subscriptions) {
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
    $subscriptionsTable.append('<tbody></tbody>');
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

      const newRow = $subscriptionsTable.find('tbody')[0].insertRow();
      const rowId = String(getId());
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

  function onEditClick (event) {
    const rowId = getRowId(event.target, 'edit-btn-');
    const rowValues = rowIdSubscriptionMap[rowId];
    const rowElement = $('#row-' + rowId)[0]; // eslint-disable-line prefer-template

    renderRowEditMode(rowElement, [
      '<input id="from-input" class="form-control" name="from" type="text" placeholder="Airport from" list="from-airports" value="' + getAirportName(airports, rowValues.fly_from) + '" required>', // eslint-disable-line prefer-template
      '<input id="to-input" name="to" class="form-control" type="text" placeholder="Airport to" list="to-airports" value="' + getAirportName(airports, rowValues.fly_to) + '" required>', // eslint-disable-line prefer-template
      '<input id="date-from" class="form-control" name="date-from" type="text" placeholder="Date from" value="' + rowValues.date_from + '" required>', // eslint-disable-line prefer-template
      '<input id="date-to" name="date-to" class="form-control" type="text" placeholder="Date to" value="' + rowValues.date_to + '" required>', // eslint-disable-line prefer-template
      'options',
    ]);
  }

  function onSaveClick (event) {
    const rowId = getRowId(event.target, 'save-btn-');
    const rowValues = rowIdSubscriptionMap[rowId];

    const airportFrom = $('#from-input').val();
    const airportTo = $('#to-input').val();
    const dateFrom = $('#date-from').val();
    const dateTo = $('#date-to').val();

    subscriptions = subscriptions.map(function (subscription) { // eslint-disable-line prefer-arrow-callback
      if (subscription.id !== rowValues.id) {
        return subscription;
      }

      return {
        id: subscription.id,
        fly_from: getAirportId(airports, airportFrom),
        fly_to: getAirportId(airports, airportTo),
        date_from: dateFrom,
        date_to: dateTo,
      };
    });

    renderSubscriptions($('#subscriptions-table'), subscriptions);
  }

  function onCancelClick (event) {
    const rowId = getRowId(event.target, 'cancel-btn-');
    const rowValues = rowIdSubscriptionMap[rowId];
    const rowElement = $('#row-' + rowId)[0]; // eslint-disable-line prefer-template

    renderRowViewMode(rowElement, [
      getAirportName(airports, rowValues.fly_from),
      getAirportName(airports, rowValues.fly_to),
      rowValues.date_from,
      rowValues.date_to,
      'options',
    ]);
  }

  function onRemoveClick (event) {
    const rowId = getRowId(event.target, 'remove-btn-');
    const rowValues = rowIdSubscriptionMap[rowId];
    subscriptions = subscriptions.filter(function (subscription) { // eslint-disable-line prefer-arrow-callback
      return subscription.id !== rowValues.id;
    });

    // TODO asserts
    // TODO send remove request

    renderSubscriptions($('#subscriptions-table'), subscriptions);
  }

  function renderRowEditMode (rowElement, rowValues) {
    assertApp(rowElement instanceof window.HTMLTableRowElement, {
      msg: 'Expected rowElement to be HTMLTableRowElement, but got ' + typeof rowElement, // eslint-disable-line prefer-template
    });

    assertApp(rowValues instanceof Array, {
      msg: 'Expected rowValues to be an array, but got ' + typeof rowValues, // eslint-disable-line prefer-template
    });

    $(rowElement).find('td').remove();

    const rowId = getRowId(rowElement, 'row-');

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
    assertApp(rowElement instanceof window.HTMLTableRowElement, {
      msg: 'Expected rowElement to be HTMLTableRowElement, but got ' + typeof rowElement, // eslint-disable-line prefer-template
    });

    assertApp(rowValues instanceof Array, {
      msg: 'Expected rowValues to be an array, but got ' + typeof rowValues, // eslint-disable-line prefer-template
    });

    $(rowElement).find('td').remove();

    const rowId = getRowId(rowElement, 'row-');

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

  function getRowId (element, idPrefix) {
    assertApp(element instanceof window.HTMLElement, {
      msg: 'Expected element to be HTMLElement, but got ' + typeof element, // eslint-disable-line prefer-template
    });

    const idAttr = $(element).attr('id');

    assertApp(typeof idAttr === 'string', {
      msg: 'Expected element to have a string id attribute, but id attribute is ' + typeof idAttr, // eslint-disable-line prefer-template
    });

    const idResult = idAttr.replace(idPrefix, '');

    assertApp(idResult.length > 0, {
      msg: 'Expected result id to be a string with length > 0, but length is ' + idResult.length, // eslint-disable-line prefer-template
    });

    return idResult;
  }

  function applyDatePicker () {
    const datepickerOptions = {
      dateFormat: 'yy-mm-dd',
    };

    $('#date-from').datepicker(datepickerOptions);
    $('#date-to').datepicker(datepickerOptions);
  }

  function applyAutocomplete (values) {
    $('#from-input').autocomplete(values);
    $('#to-input').autocomplete(values);
  }

  function listSubscriptions (protocolName, callback) {
    trace('listSubscriptions(' + protocolName + '), typeof arg=' + typeof protocolName + ''); // eslint-disable-line prefer-template

    sendRequest({
      url: SERVER_URL,
      data: {
        method: 'list_subscriptions',
        params: {
          v: '2.0',
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

      result = {
        subscriptions: [
          {
            id: '11',
            fly_from: '2',
            fly_to: '3',
            date_from: '2018-07-19',
            date_to: '2018-07-19',
          },
          {
            id: '10',
            fly_from: '2',
            fly_to: '3',
            date_from: '2018-07-19',
            date_to: '2018-07-19',
          },
        ],
      };

      // TODO callback with real results
      callback(result);
    });
  }

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    const $subsTable = $('#subscriptions-table');

    listAirports('jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
      airports = result.airports;

      const airportNames = airports.map(function (airport) { // eslint-disable-line prefer-arrow-callback
        return airport.name;
      });

      applyAutocomplete(airportNames);

      listSubscriptions('jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
        subscriptions = result.subscriptions;
        renderSubscriptions($subsTable, subscriptions);
      });
    });

    applyDatePicker();
  });
}

start();
