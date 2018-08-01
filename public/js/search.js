function start () {
  const $routeItemTemplate = $('#flights-list-item-template');
  const $flightItemTemplate = $('#flight-item-template');
  const $flightForm = $('#flight-form');
  const $submitBtn = $('#submit-button');

  const mainUtils = main();
  const assertApp = mainUtils.assertApp;
  const assertUser = mainUtils.assertUser;
  const trace = mainUtils.trace;
  const displayUserMessage = mainUtils.displayUserMessage;

  const api = getAPIMethods(mainUtils);

  var airports = []; // eslint-disable-line no-var

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const WEEK_DAYS = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];
  const MAX_ROUTES_PER_PAGE = 5;

  function getAirport (term, airports) {
    assertApp(typeof term === 'string', {
      msg: 'Expected arg. term in getAirport to be a string, but got ' + typeof term, // eslint-disable-line prefer-template
    });
    assertApp(airports instanceof Array, {
      msg: 'Expected arg. airport in getAirport to be an array, but got ' + typeof airports, // eslint-disable-line prefer-template
    });

    var i; // eslint-disable-line no-var

    for (i = 0; i < airports.length; i++) {
      assertApp(_.isObject(airports[i]), {
        msg: 'Expected airports[' + i + '] to be an object, but got ' + typeof airports[i], // eslint-disable-line prefer-template
      });

      for (var prop in airports[i]) { // eslint-disable-line no-var
        if (
          airports[i].hasOwnProperty(prop) &&
          airports[i][prop].toLowerCase().indexOf(term.toLowerCase()) !== -1
        ) {
          assertApp(typeof airports[i].id === 'string', {
            msg: 'Airport object found does not have a property "id"',
          });
          assertApp(typeof airports[i].iata_code === 'string', {
            msg: 'Airport object found does not have a property "iata_code"',
          });
          assertApp(typeof airports[i].name === 'string', {
            msg: 'Airport object found does not have a property "name"',
          });

          return airports[i];
        }
      }
    }

    return null;
  }

  function setupLoading ($button, $routesList) {
    const step = 5;

    $button.click(function () { // eslint-disable-line prefer-arrow-callback
      const loaded = $routesList.children()
        .filter(':visible').length; // SUGGEST store visible and not visible in an array?
      $routesList.children()
        .slice(loaded, loaded + step + 1)
        .show();

      if (loaded + step >= $routesList.children().length) {
        $button.hide();
      }
    });
  }

  function objectifyForm (formArray) {
    return formArray.reduce(function (obj, entry) { // eslint-disable-line prefer-arrow-callback
      if (entry.value != null && entry.value !== '') { // '' check not needed
        obj[entry.name] = entry.value; // overwrites similar names
      }
      return obj;
    },
    {});
  }

  function timeStringFromDate (date) {
    var hours = date.getUTCHours() // eslint-disable-line no-var
      .toString();

    if (hours.length < 2) {
      hours = '0' + hours; // eslint-disable-line prefer-template
    }

    var minutes = date.getUTCMinutes().toString(); // eslint-disable-line no-var

    if (minutes.length < 2) {
      minutes = '0' + minutes; // eslint-disable-line prefer-template
    }

    return '' + hours + ':' + minutes + ''; // eslint-disable-line prefer-template
  }

  function weeklyDateString (date) {
    const monthName = MONTH_NAMES[date.getMonth()];
    const dayName = WEEK_DAYS[date.getDay()];

    return '' + dayName + ' ' + date.getDate() + ' ' + monthName + ''; // eslint-disable-line prefer-template
  }

  function displaySearchResult (searchResult, $routesList, templates) {
    trace('executing displaySearchResult');

    const { $flightItemTemplate, $routeItemTemplate } = templates;

    $routesList.find('li:not(:first)')
      .remove();

    if (
      !_.isObject(searchResult) ||
      (Object.keys(searchResult).length === 0 && _.isObject(searchResult))
    ) {
      return;
    }

    if (searchResult.routes.length === 0) {
      $('#load-more-button').hide();
      displayUserMessage('There are no known flights.', 'info');
    } else {
      $('#load-more-button').show();
    }

    var i; // eslint-disable-line no-var
    for (i = 0; i < searchResult.routes.length; i++) {
      const route = searchResult.routes[i];
      const $clone = $routeItemTemplate.clone();
      const $routeList = $clone.find('ul');
      const $newRoute = fillList($routeList, route.route, $flightItemTemplate);

      if (i < MAX_ROUTES_PER_PAGE) {
        $clone.show();
      }

      $clone.find('.route-price')
        .text(route.price);
      $routesList.append($clone.append($newRoute));

      const $timeElements = $clone.find('time');

      $($timeElements[0])
        .attr('datetime', route.dtime)
        .text('' + weeklyDateString(route.dtime) + ' ' + timeStringFromDate(route.dtime) + ''); // eslint-disable-line prefer-template
      $($timeElements[1])
        .attr('datetime', route.dtime)
        .text('' + weeklyDateString(route.atime) + ' ' + timeStringFromDate(route.atime) + ''); // eslint-disable-line prefer-template
    }
  }

  function fillList ($listTemplate, route, $flightItemTemplate) {
    $listTemplate.find('li:not(:first)')
      .remove();

    var i; // eslint-disable-line no-var

    for (i = 0; i < route.length; i++) {
      $listTemplate.append(makeFlightItem(route[i], $flightItemTemplate));
    }

    $listTemplate.show();

    return $listTemplate;
  }

  function makeFlightItem (flight, $itemTemplate) {
    const $clone = $itemTemplate.clone()
      .removeAttr('id')
      .removeClass('hidden');

    var duration = Math.abs(flight.atime - flight.dtime); // eslint-disable-line no-var

    const hours = Math.floor(duration / 1000 / 60 / 60);
    const minutes = (duration / 1000 / 60) % 60;

    duration = hours + ' h, ' + minutes + ' m'; // eslint-disable-line prefer-template

    $clone.find('.airline-logo')
      .attr('src', flight.airline_logo);
    $clone.find('.airline-name')
      .text(flight.airline_name);
    $clone.find('.departure-time')
      .text(timeStringFromDate(flight.dtime));
    $clone.find('.arrival-time')
      .text(timeStringFromDate(flight.atime));
    $clone.find('.flight-date')
      .text(weeklyDateString(flight.dtime));
    $clone.find('.timezone')
      .text('UTC');
    $clone.find('.duration')
      .text(duration);
    // TODO later change to city when server implements the field
    $clone.find('.from-to-display')
      .text('' + flight.airport_from + ' -----> ' + flight.airport_to + ''); // eslint-disable-line prefer-template

    $clone.show();
    return $clone;
  }

  function getSearchFormParams ($searchForm) {
    trace('executing getSearchFormParams');

    const searchFormParams = {
      v: '1.0', // TODO move to another function, this should not be here
      currency: 'USD',
      sort: 'price',
    };
    const formData = objectifyForm($searchForm.serializeArray());

    assertApp(
      _.isObject(formData), {
        msg: 'formData is not an object',
      }
    );

    assertUser(
      typeof formData.from === 'string' &&
      typeof formData.to === 'string', {
        userMessage: 'Please choose your departure airport and arrival airport.',
        msg: 'User did not select flight from or flight to.',
      }
    );

    const airportFrom = getAirport(formData.from, airports); // eslint-disable-line no-var
    const airportTo = getAirport(formData.to, airports); // eslint-disable-line no-var

    assertUser(_.isObject(airportFrom), {
      msg: 'Could not find airport "' + formData.from + '"', // eslint-disable-line prefer-template
      userMessage: 'Could not find airport "' + formData.from + '"', // eslint-disable-line prefer-template
    });
    assertUser(_.isObject(airportTo), {
      msg: 'Could not find airport "' + formData.to + '"', // eslint-disable-line prefer-template
      userMessage: 'Could not find airport "' + formData.from + '"', // eslint-disable-line prefer-template
    });

    searchFormParams.fly_from = airportFrom.id;
    searchFormParams.fly_to = airportTo.id;
    searchFormParams.format = formData.format;

    if (formData['price-to']) {
      searchFormParams.price_to = parseInt(formData['price-to']);
    }

    if (formData['date-from']) {
      searchFormParams.date_from = formData['date-from'];
    }

    if (formData['date-to']) {
      searchFormParams.date_to = formData['date-to'];
    }

    trace('getSearchFormParams returning ' + JSON.stringify(searchFormParams) + ''); // eslint-disable-line prefer-template
    return searchFormParams;
  }

  function showWeather (airportFromIATACode, airportToIATACode) {
    $('#weather-container').removeAttr('hidden');
    $('#dalipeche-airport-from').getForecastByIATACode(airportFromIATACode);
    $('#dalipeche-airport-to').getForecastByIATACode(airportToIATACode);
  }

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    const $allRoutesList = $('#all-routes-list');

    $submitBtn.click(function (event) { // eslint-disable-line prefer-arrow-callback
      trace('Submit button clicked');

      event.preventDefault();

      var formParams; // eslint-disable-line no-var

      try {
        formParams = getSearchFormParams($flightForm);
      } catch (e) {
        mainUtils.handleError(e);
        return false;
      }

      const airportFrom = getAirport(formParams.fly_from, airports); // eslint-disable-line no-var
      const airportTo = getAirport(formParams.fly_to, airports); // eslint-disable-line no-var

      assertUser(_.isObject(airportFrom), {
        msg: 'Could not find airport "' + formParams.fly_from + '"', // eslint-disable-line prefer-template
        userMessage: 'Could not find airport "' + formParams.fly_from + '"', // eslint-disable-line prefer-template
      });
      assertUser(_.isObject(airportTo), {
        msg: 'Could not find airport "' + formParams.fly_to + '"', // eslint-disable-line prefer-template
        userMessage: 'Could not find airport "' + formParams.fly_to + '"', // eslint-disable-line prefer-template
      });

      showWeather(airportFrom.iata_code, airportTo.iata_code);

      $submitBtn.prop('disabled', true);

      api.search(formParams, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
        // use lexicographical/ordinal string comparison
        if (result.status_code >= '1000' && result.status_code < '2000') {
          displaySearchResult(
            result,
            $allRoutesList,
            {
              $routeItemTemplate: $routeItemTemplate,
              $flightItemTemplate: $flightItemTemplate,
            }
          );
        } else if (result.status_code === '2000' || result.status_code === '3000') {
          displayUserMessage('There is no information about this flight at the moment. Please come back in 15 minutes.', 'info');
        }

        $submitBtn.prop('disabled', false);
      });
    });

    $flightForm.on('submit', function (event) { // eslint-disable-line prefer-arrow-callback
      event.preventDefault();
    });

    const datepickerOptions = {
      dateFormat: 'yy-mm-dd',
    };

    $('#date-from').datepicker(datepickerOptions);
    $('#date-to').datepicker(datepickerOptions);

    setupLoading($('#load-more-button'), $allRoutesList);

    api.listAirports('jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
      airports = result.airports;

      const airportNames = airports.map(function (airport) { // eslint-disable-line prefer-arrow-callback
        return airport.name;
      });

      $('#from-input').autocomplete(airportNames);
      $('#to-input').autocomplete(airportNames);
    });
  });
}

start();
