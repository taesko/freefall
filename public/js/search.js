/* eslint-disable no-var,prefer-template,prefer-arrow-callback */
function start () {
  const $flightForm = $('#flight-form');
  const $submitBtn = $('#submit-button');

  const mainUtils = main();
  const assertApp = mainUtils.assertApp;
  const assertPeer = mainUtils.assertPeer;
  const assertUser = mainUtils.assertUser;
  const PROTOCOL_NAME = mainUtils.PROTOCOL_NAME;
  const CURRENT_PAGE_NAME = 'index.html';
  const api = getAPIMethods(mainUtils);

  var airports = []; // eslint-disable-line no-var
  var routes = []; // eslint-disable-line no-var
  var formParams = null; // eslint-disable-line no-var

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

  function showRoutesContainer () {
    $('#routes-container').removeAttr('hidden');
  }

  function hideRoutesContainer () {
    $('#routes-container').attr('hidden', 'true');
  }

  function showLoadMoreBtn () {
    $('#load-more-btn').removeAttr('hidden');
  }

  function hideLoadMoreBtn () {
    $('#load-more-btn').attr('hidden', 'true');
  }

  function renderRoutes ($routesContainer) {
    mainUtils.trace('renderRoutes');

    assertApp($routesContainer instanceof jQuery, {
      msg: 'Expected $routesContainer to be instance of jQuery, but was ' + typeof $routesContainer, // eslint-disable-line prefer-template
    });
    assertApp($routesContainer.length === 1, {
      msg: 'Expected only one element in jQuery object, but got ' + $routesContainer.length, // eslint-disable-line prefer-template
    });
    assertApp($routesContainer[0] instanceof window.HTMLDivElement, {
      msg: 'Expected element in jQuery object to be HTMLDivElement, but got ' + typeof $routesContainer[0], // eslint-disable-line prefer-template
    });
    assertApp(routes instanceof Array, {
      msg: 'Expected routes to be instance of array, but was ' + typeof routes, // eslint-disable-line prefer-template
    });

    if (routes.length > 0) {
      showRoutesContainer();
    } else {
      mainUtils.displayUserMessage('There is no information about such route at the moment. Please try again later!');
      hideRoutesContainer();
    }

    $routesContainer.children().not('#route').remove();

    _.each(routes, function (route) { // eslint-disable-line prefer-arrow-callback
      renderRoute(route);
    });
  }

  function renderRoute (route) {
    mainUtils.trace('renderRoute');

    assertApp(_.isObject(route), {
      msg: 'Expected route to be an object, but was ' + typeof route, // eslint-disable-line prefer-template
    });

    const routeId = String(mainUtils.getUniqueId());
    const departureDate = new Date(route.route[0].dtime);
    const arrivalDate = new Date(route.route[route.route.length - 1].atime);
    let attachmentTime = 0;

    for (var curr = 0; curr < route.route.length - 1; curr++) {
      const next = curr + 1;
      const currFlight = route.route[curr];
      const nextFlight = route.route[next];
      attachmentTime += (new Date(nextFlight.dtime).getTime() -
                         new Date(currFlight.atime).getTime());
    }

    const waitingHours = Math.round(attachmentTime / 1000 / 60 / 60);
    const waitingTimeText = waitingHours + ' hours';

    const $routeClone = $('#route').clone()
      .removeAttr('hidden')
      .attr('id', 'route-' + routeId); // eslint-disable-line prefer-template

    $routeClone.find('#route-price')
      .attr('id', 'route-price-' + routeId) // eslint-disable-line prefer-template
      .text(route.price);

    $routeClone.find('#route-buy')
      .attr('id', 'route-buy-' + routeId) // eslint-disable-line prefer-template
      .click(function () { // eslint-disable-line prefer-arrow-callback
        window.location.href = 'https://www.kiwi.com/us/booking?token=' + route.booking_token; // eslint-disable-line prefer-template
      });

    $routeClone.find('#route-departure')
      .attr('id', 'route-departure-' + routeId)
      .text(departureDate.toDateString());

    $routeClone.find('#route-arrival')
      .attr('id', 'route-arrival' + routeId)
      .text(arrivalDate.toDateString());

    $routeClone.find('#route-attachment-time')
      .attr('id', '#route-attachment-time-' + routeId)
      .text(waitingTimeText);

    $routeClone.find('#routes-table')
      .attr('id', 'routes-table-' + routeId); // eslint-disable-line prefer-template

    _.each(route.route, function (flight, index) { // eslint-disable-line prefer-arrow-callback
      const routeFlightId = String(mainUtils.getUniqueId());
      const $routeFlightClone = $routeClone.find('#route-flight')
        .clone()
        .attr('id', 'route-flight-' + routeFlightId) // eslint-disable-line prefer-template
        .removeAttr('hidden');

      $routeFlightClone.find('#route-flight-step')
        .attr('id', 'route-flight-step-' + routeFlightId) // eslint-disable-line prefer-template
        .text(index + 1);

      $routeFlightClone.find('#route-flight-airline-logo')
        .attr('id', 'route-flight-airline-logo-' + routeFlightId) // eslint-disable-line prefer-template
        .attr('src', flight.airline_logo);

      $routeFlightClone.find('#route-flight-airline-name')
        .attr('id', 'route-flight-airline-name-' + routeFlightId) // eslint-disable-line prefer-template
        .text(flight.airline_name);

      $routeFlightClone.find('#route-flight-departure-airport')
        .attr('id', 'route-flight-departure-airport-' + routeFlightId) // eslint-disable-line prefer-template
        .text(flight.airport_from);

      $routeFlightClone.find('#route-flight-departure-time')
        .attr('id', 'route-flight-departure-time-' + routeFlightId) // eslint-disable-line prefer-template
        .text(weeklyDateString(flight.dtime) + ' ' + timeStringFromDate(flight.dtime)); // eslint-disable-line prefer-template

      $routeFlightClone.find('#route-flight-arrival-airport')
        .attr('id', 'route-flight-arrival-airport-' + routeFlightId) // eslint-disable-line prefer-template
        .text(flight.airport_to);

      $routeFlightClone.find('#route-flight-arrival-time')
        .attr('id', 'route-flight-arrival-time-' + routeFlightId) // eslint-disable-line prefer-template
        .text(weeklyDateString(flight.atime) + ' ' + timeStringFromDate(flight.atime)); // eslint-disable-line prefer-template

      $routeFlightClone.find('#route-flight-duration')
        .attr('id', 'route-flight-duration-' + routeFlightId) // eslint-disable-line prefer-template
        .text(getFlightDuration(flight.dtime, flight.atime));

      $routeFlightClone.appendTo($routeClone.find('tbody'));
    });

    $routeClone.appendTo($('#routes-container'));
  }

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

  function getFlightDuration (departureTime, arrivalTime) {
    assertApp(departureTime instanceof Date, {
      msg: 'Expected departureTime to be instance of Date, but was "' + departureTime + '"', // eslint-disable-line prefer-template
    });

    assertApp(arrivalTime instanceof Date, {
      msg: 'Expected arrivalTime to be instance of Date, but was "' + arrivalTime + '"', // eslint-disable-line prefer-template
    });

    const duration = Math.abs(arrivalTime - departureTime);
    const hours = Math.floor(duration / 1000 / 60 / 60);
    const minutes = (duration / 1000 / 60) % 60;

    return hours + ' h, ' + minutes + ' m'; // eslint-disable-line prefer-template
  }

  function getSearchFormParams ($searchForm) {
    mainUtils.trace('executing getSearchFormParams');

    const searchFormParams = {
      v: '1.0', // TODO move to another function, this should not be here
      currency: 'USD',
      sort: 'price',
      limit: MAX_ROUTES_PER_PAGE,
      offset: 0,
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
      userMessage: 'Could not find airport "' + formData.to + '"', // eslint-disable-line prefer-template
    });

    searchFormParams.fly_from = airportFrom.id;
    searchFormParams.fly_to = airportTo.id;

    const wrongPriceToFormatMsg = 'Expected "price to" to be a positve integer, e.g. 1, 2, 3, ... 100.. etc!';

    if (formData['price-to']) {
      assertUser(Number.isInteger(Number(formData['price-to'])), {
        userMessage: wrongPriceToFormatMsg,
        msg: 'User did not enter an integer',
      });

      const priceToValue = parseInt(formData['price-to']);

      assertUser(priceToValue > 0, {
        userMessage: wrongPriceToFormatMsg,
        msg: 'User entered a negative integer',
      });

      searchFormParams.price_to = priceToValue;
    }

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const wrongDateFormatMsg = 'Expected format YYYY-MM-DD for date!';
    const invalidDateMsg = 'Invalid date!';

    if (formData['date-from']) {
      assertUser(datePattern.test(formData['date-from']), {
        userMessage: wrongDateFormatMsg,
        msg: wrongDateFormatMsg,
      });

      assertUser(Number.isInteger(Date.parse(formData['date-from'])), {
        userMessage: invalidDateMsg,
        msg: 'User entered invalid date in dateFrom',
      });

      searchFormParams.date_from = formData['date-from'];
    }

    if (formData['date-to']) {
      assertUser(datePattern.test(formData['date-to']), {
        userMessage: wrongDateFormatMsg,
        msg: wrongDateFormatMsg,
      });

      assertUser(Number.isInteger(Date.parse(formData['date-to'])), {
        userMessage: invalidDateMsg,
        msg: 'User entered invalid date in dateTo field',
      });

      searchFormParams.date_to = formData['date-to'];
    }

    mainUtils.trace('getSearchFormParams returning ' + JSON.stringify(searchFormParams) + ''); // eslint-disable-line prefer-template
    return searchFormParams;
  }

  function showWeather (airportFromIATACode, airportToIATACode) {
    $('#weather-container').removeAttr('hidden');
    $('#dalipeche-airport-from').getForecastByIATACode(airportFromIATACode);
    $('#dalipeche-airport-to').getForecastByIATACode(airportToIATACode);
  }

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    const $loadMoreBtn = $('#load-more-btn');
    mainUtils.restoreFormData(CURRENT_PAGE_NAME, 'flight-form');

    $('#flight-form').change(function () {
      mainUtils.saveFormData(CURRENT_PAGE_NAME, 'flight-form');
    });

    $('#clear-button').click(function () {
      mainUtils.clearFormData('flight-form');
      mainUtils.saveFormData(CURRENT_PAGE_NAME, 'flight-form');
    });

    $submitBtn.click(function (event) { // eslint-disable-line prefer-arrow-callback
      mainUtils.trace('Submit button clicked');

      event.preventDefault();

      formParams = getSearchFormParams($flightForm);

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

      api.search(formParams, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
        $submitBtn.prop('disabled', false);

        const messages = {
          '1000': 'Search success, results found.',
          '1001': 'There is no information about such routes at the moment. But we will check for you. Please come back in 15 minutes.',
          '1002': 'There is no information about such routes at the moment.',
          '2000': 'Search input was not correct.',
        };

        assertPeer(typeof messages[result.status_code] === 'string', {
          msg: 'Unexpected status code in search. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
        });

        const userMessage = messages[result.status_code] || 'An error has occurred. Please refresh the page and try again later.';
        assertUser(result.status_code === '1000', {
          userMessage: userMessage,
          msg: 'Search failed. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
        });

        if (result.routes.length >= MAX_ROUTES_PER_PAGE) {
          showLoadMoreBtn();
        } else {
          hideLoadMoreBtn();
        }

        routes = result.routes;
        renderRoutes($('#routes-container'));
      });
    });

    $loadMoreBtn.click(function (event) { // eslint-disable-line prefer-arrow-callback
      mainUtils.trace('Load more button clicked');

      const loadMoreBtnElement = event.target;

      loadMoreBtnElement.disabled = true;
      formParams.offset = routes.length;

      api.search(formParams, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
        loadMoreBtnElement.disabled = false;

        const messages = {
          '1000': 'Search success, results found.',
          '1001': 'There is no information about such routes at the moment. But we will check for you. Please come back in 15 minutes.',
          '1002': 'End of results.',
          '2000': 'Search input was not correct.',
        };

        assertPeer(typeof messages[result.status_code] === 'string', {
          msg: 'Unexpected status code in search. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
        });

        const userMessage = messages[result.status_code] || 'An error has occurred. Please refresh the page and try again later.';
        assertUser(result.status_code === '1000' || result.status_code === '1002', {
          userMessage: userMessage,
          msg: 'Search failed. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
        });

        if (result.routes.length >= MAX_ROUTES_PER_PAGE && result.status_code === '1000') {
          showLoadMoreBtn();
        } else {
          hideLoadMoreBtn();
        }

        routes = routes.concat(result.routes);
        renderRoutes($('#routes-container'));
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

    api.listAirports(PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
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
