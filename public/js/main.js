'use strict';

function start () {
  class BaseError extends Error {
    constructor ({userMessage, msg}) {
      super(userMessage);

      this.userMessage = userMessage;
      this.msg = msg;

      sendError({
        msg,
        trace: traceLog,
      }, 'jsonrpc');
    }
  }

  class ApplicationError extends BaseError {
    constructor ({userMessage, msg}) {
      if (!userMessage) {
        userMessage = 'Application encountered an unexpected condition. Please refresh the page.';
      }
      super({userMessage, msg});

      window.alert(userMessage);
    }
  }

  class PeerError extends BaseError {
    constructor ({userMessage, msg}) {
      if (!userMessage) {
        userMessage = 'Service is not available at the moment. Please refresh the page and try' +
                      ' later.';
      }
      super({userMessage, msg});
    }
  }

  class UserError extends BaseError {
    constructor ({userMessage, msg}) {
      super({userMessage, msg});
    }
  }

  function assertApp (condition, errorParams) {
    if (!condition) {
      throw new ApplicationError(errorParams);
    }
  }

  function assertPeer (condition, errorParams) {
    if (!condition) {
      throw new PeerError(errorParams);
    }
  }

  function assertUser (condition, errorParams) {
    if (!condition) {
      throw new UserError(errorParams);
    }
  }

  function * idGenerator () {
    let requestId = 1;

    while (true) {
      yield requestId++;
    }
  }

  const MAX_ROUTES_PER_PAGE = 5;
  const SERVER_URL = '/';
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
  const MAX_TRACE = 300;
  let $errorBar; // closures
  const errorMessagesQueue = [];
  const validateSearchReq = getValidateSearchReq();
  const validateSearchRes = getValidateSearchRes();
  const validateSubscriptionReq = getValidateSubscriptionReq();
  const validateSubscriptionRes = getValidateSubscriptionRes();
  const validateSendErrorReq = getValidateSendErrorReq();
  const validateSendErrorRes = getValidateSendErrorRes();
  const traceLog = [];

  const getParser = defineParsers(jsonParser, yamlParser);
  const getId = idGenerator();

  function trace (msg) {
    if (traceLog.length > MAX_TRACE) {
      traceLog.shift();
    }
    traceLog.push(msg);
  }

  function objToString (obj) { // maybe JSON.stringify
    return Object.entries(obj).map(pair => pair.join(':')).join(',');
  }

  (function setupErrorMessages () {
    setInterval(() => {
      if (!$errorBar) {
        return;
      }

      if (errorMessagesQueue.length !== 0) {
        $errorBar.text(errorMessagesQueue.shift());
      } else {
        $errorBar.text('');
      }
    },
    5000);
  })();

  function displayErrorMessage (errMsg) {
    errorMessagesQueue.push(errMsg);
  }

  const AIRPORT_HASH = airportDump();

  function getAirport (term) {
    trace(`getAirport(${term}), typeof arg=${typeof term}`);

    term = term.toLowerCase();

    for (const airport of Object.values(AIRPORT_HASH)) {
      const strings = [
        airport.id,
        airport.iataID.toLowerCase(),
        airport.latinName.toLowerCase(),
        airport.nationalName.toLowerCase(),
        airport.cityName.toLowerCase(),
      ];

      if (_.includes(strings, term)) {
        trace(`getAirport(${term}) returning ${strings.join(',')}`);
        return airport;
      }
    }
    trace(`getAirport(${term}) returning undefined`);
    throw new UserError({
      userMessage: 'Could not find an airport. Please try again.',
      msg: `Term '${term}', provided by user, could not be resolved to an airport`,
    });
  }

  /**
   * Make a search method call to the server and retrieve possible routes
   * All parameters must be JS primitives with their corresponding type in
   * the API docs.
   *
   **/
  async function search (params, requestFormat) {
    trace(`search(${objToString(params)}), typeof arg=${typeof params}`);

    assertApp(validateSearchReq(params), {
      msg: 'Params do not adhere to searchRequestSchema.',
    });

    const { result } = await sendRequest(SERVER_URL, {
      method: 'search',
      params,
    }, requestFormat);

    assertPeer(validateSearchRes(result), {
      msg: 'Params do not adhere to searchResponseSchema.',
    });

    for (const routeObj of result.routes) {
      // server doesn't provide currency yet
      if (result.currency) {
        routeObj.price += ` ${result.currency}`;
      } else {
        routeObj.price += ' $';
      }

      for (const flight of routeObj.route) {
        flight.dtime = new Date(flight.dtime);
        flight.atime = new Date(flight.atime);

        // server doesn't provide city_from and city_to yet
        flight.cityFrom = flight.cityFrom || '';
        flight.cityTo = flight.cityTo || '';
      }

      routeObj.route = sortRoute(routeObj.route);
      routeObj.dtime = routeObj.route[0].dtime;
      routeObj.atime = routeObj.route[routeObj.route.length - 1].atime;
    }

    result.routes = _.sortBy(result.routes, [routeObj => routeObj.dtime]);

    return result;
  }

  async function subscribe (params, requestFormat) {
    trace(`subscribe(${objToString(params)}), typeof arg=${typeof params}`);

    assertApp(validateSubscriptionReq(params), {
      msg: 'Params do not adhere to subscriptionRequestSchema',
    });

    const { latinName: fromAirportLatinName } = getAirport(params.fly_from);
    const { latinName: toAirportLatinName } = getAirport(params.fly_to);

    try {
      const { result } = await sendRequest(SERVER_URL, {
        method: 'subscribe',
        params,
      }, requestFormat);

      assertPeer(validateSubscriptionRes(result), {
        msg: 'Params do not adhere to subscriptionResponseSchema',
      });
      assertUser(result.status_code >= 1000 && result.status_code < 2000, {
        userMessage: `Already subscribed for flights from ${fromAirportLatinName} to ${toAirportLatinName}.`,
        msg: `Tried to subscribe but subscription already existed. Sent params: ${params}. Got result: ${result}`,
      });

      return params;
    } catch (e) {
      e.userMessage = `Failed to subscribe for flights from airport ${fromAirportLatinName} to airport ${toAirportLatinName}.`;
      throw e;
    }
  }

  async function unsubscribe (params, requestFormat) {
    trace(`unsubscribe(${objToString(params)}), typeof arg=${typeof params}`);

    assertApp(validateSubscriptionReq(params), {
      msg: 'Params do not adhere to subscriptionRequestSchema',
    });

    const { latinName: fromAirportLatinName } = getAirport(params.fly_from);
    const { latinName: toAirportLatinName } = getAirport(params.fly_to);

    try {
      const { result } = await sendRequest(SERVER_URL, {
        method: 'unsubscribe',
        params,
      }, requestFormat);

      assertPeer(validateSubscriptionRes(result), {
        msg: 'Params do not adhere to subscriptionResponseSchema',
      });
      assertUser(result.status_code >= 1000 && result.status_code < 2000, {
        userMessage: `You aren't subscribed for flights from airport ${fromAirportLatinName} to airport ${toAirportLatinName}.`,
        msg: `Server returned ${result.status_code} status code. Sent params: ${params}. Got result: ${result}`,
      });

      return params;
    } catch (e) {
      e.userMessage = `Failed to unsubscribe for flights from airport ${fromAirportLatinName} to airport ${toAirportLatinName}.`;
      throw e;
    }
  }

  async function sendError (params, requestFormat) {
    assertApp(validateSendErrorReq(params), {
      msg: 'Params do not adhere to sendErrorRequestSchema',
    });

    try {
      const { result } = await sendRequest(SERVER_URL, {
        method: 'senderror',
        params,
      }, requestFormat);

      assertPeer(validateSendErrorRes(result), {
        msg: 'Params do not adhere to sendErrorResponseSchema',
      });
    } catch (e) {
      e.userMessage = 'An error occurred in the application. Please refresh the page and try again.';
      throw e;
    }
  }

  async function sendRequest (url, data, protocolName) {
    let serverResponse;
    const parser = getParser(protocolName);

    const { id } = getId.next();

    try {
      serverResponse = await window.fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': parser.contentType,
        },
        body: parser.stringifyRequest(data, id),
      });
    } catch (e) {
      // TODO - check if JSON.stringify threw an error
      throw new PeerError({
        userMessage: 'Service is not available at the moment due to network issues',
        msg: `Couldn't connect to server at url: ${url}. Sent POST request with data: ${data}`,
      });
    }

    assertPeer(
      serverResponse.ok,
      {
        userMessage: 'There was a problem with your request. Please, try again.',
        msg: `Sent POST request with data: ${data}. Got NOT OK response back: ${serverResponse}`,
      }
    );

    const responseParsed = await parser.parseResponse(serverResponse);

    return {
      result: responseParsed.result || null,
      error: responseParsed.error || null, // TODO handle error
    };
  }

  function sortRoute (route) {
    function comparison (a, b) {
      return a.dtime - b.dtime;
    }

    const result = route.slice(0);

    result.sort(comparison);

    return result;
  }

  function timeStringFromDate (date) {
    const hours = date.getUTCHours()
      .toString()
      .padStart(2, '0');
    const minutes = date.getUTCMinutes()
      .toString()
      .padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  function weeklyDateString (date) {
    const monthName = MONTH_NAMES[date.getMonth()];
    const dayName = WEEK_DAYS[date.getDay()];

    return `${dayName} ${date.getDate()} ${monthName}`;
  }

  function setupLoading ($button, $routesList) {
    const step = 5;

    $button.click(() => {
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

  function displaySearchResult (searchResult, $routesList, templates) {
    trace(`executing displaySearchResult`);

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
      displayErrorMessage(`There are no known flights.`);
    } else {
      $('#load-more-button').show();
    }

    for (let i = 0; i < searchResult.routes.length; i++) {
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
        .text(`${weeklyDateString(route.dtime)} ${timeStringFromDate(route.dtime)}`);
      $($timeElements[1])
        .attr('datetime', route.dtime)
        .text(`${weeklyDateString(route.atime)} ${timeStringFromDate(route.atime)}`);
    }
  }

  function fillList ($listTemplate, route, $flightItemTemplate) {
    $listTemplate.find('li:not(:first)')
      .remove();

    for (const flight of route) {
      $listTemplate.append(makeFlightItem(flight, $flightItemTemplate));
    }

    $listTemplate.show();

    return $listTemplate;
  }

  function makeFlightItem (flight, $itemTemplate) {
    const $clone = $itemTemplate.clone()
      .removeAttr('id')
      .removeClass('hidden');

    let duration = flight.atime.getTime() - flight.dtime.getTime();

    duration = (duration / 1000 / 60 / 60).toFixed(2);
    duration = (`${duration} hours`).replace(':');

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
      .text(`${flight.airport_from} -----> ${flight.airport_to}`);

    return $clone;
  }

  function getSearchFormParams ($searchForm) {
    trace(`executing getSearchFormParams`);

    const searchFormParams = {
      v: '1.0', // TODO move to another function, this should not be here
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

    const { id: airportFromId } = getAirport(formData.from);
    const { id: airportToId } = getAirport(formData.to);

    assertUser(airportFromId, {
      userMessage: `${formData.from} is not a location that has an airport!`,
      msg: `User entered a string in departure input, that cannot be resolved to an airport - ${formData.from}`,
    });
    assertUser(airportToId, {
      userMessage: `${formData.to} is not a location that has an airport!`,
      msg: `User entered a string in arrival input, that cannot be resolved to an airport - ${formData.to}`,
    });

    searchFormParams.fly_from = airportFromId;
    searchFormParams.fly_to = airportToId;
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

    trace(`getSearchFormParams returning ${objToString(searchFormParams)}`);
    return searchFormParams;
  }

  function objectifyForm (formArray) {
    return formArray.reduce(
      (obj, entry) => {
        if (entry.value != null && entry.value !== '') { // '' check not needed
          obj[entry.name] = entry.value; // overwrites similar names
        }
        return obj;
      },
      {});
  }

  function yamlParser () {
    const parseYAML = (yaml) => {
      try {
        return jsyaml.safeLoad(yaml);
      } catch (error) {
        throw new PeerError({
          msg: 'Invalid yamlrpc format. Cannot parse YAML.',
        });
      }
    };

    const normalizeYAMLRequest = (yaml) => {
      assertPeer(
        _.isObject(yaml) &&
        _.isObject(yaml.parameters) &&
        typeof yaml.yamlrpc === 'string' &&
        typeof yaml.action === 'string', {
          msg: 'Invalid yamlrpc request format.',
        }
      );

      return {
        yamlrpc: yaml.yamlrpc,
        method: yaml.action,
        params: yaml.parameters,
        id: yaml.id,
      };
    };

    const normalizeYAMLResponse = (yaml) => {
      assertPeer(
        _.isObject(yaml) &&
        (
          (!_.isObject(yaml.result) && _.isObject(yaml.error)) ||
          (_.isObject(yaml.result) && !_.isObject(yaml.error))
        ) &&
        typeof yaml.yamlrpc === 'string', {
          msg: 'Invalid yamlrpc response format.',
        }
      );

      const normalized = {
        id: yaml.id,
        yamlrpc: yaml.yamlrpc,
      };

      if (_.isObject(yaml.result)) {
        normalized.result = yaml.result;
      } else {
        normalized.error = yaml.error;
      }

      return normalized;
    };

    const stringifyYAML = (yaml) => {
      try {
        return jsyaml.safeDump(yaml);
      } catch (error) {
        throw new ApplicationError({
          msg: error,
        });
      }
    };

    const parseRequest = (data) => {
      const normalized = normalizeYAMLRequest(parseYAML(data));
      return {
        ...normalized,
        version: normalized.yamlrpc,
      };
    };

    const parseResponse = async (response) => {
      const data = await response.text();
      const normalized = normalizeYAMLResponse(parseYAML(data));
      return normalized;
    };

    const stringifyResponse = (data, id = null, yamlrpc = '2.0') => {
      return stringifyYAML({ result: data, yamlrpc, id });
    };

    const stringifyRequest = (data, id = null, yamlrpc = '2.0') => {
      const { method, params } = data;
      return stringifyYAML({
        action: method,
        parameters: params,
        yamlrpc,
        id,
      });
    };

    const error = (error, yamlrpc = '2.0') => {
      return stringifyYAML({ yamlrpc, error, id: null });
    };

    return {
      name: 'yamlrpc',
      contentType: 'text/yaml',
      format: 'yaml',
      parseRequest,
      parseResponse,
      stringifyResponse,
      stringifyRequest,
      error,
    };
  }

  function jsonParser () {
    const parseRequest = (data) => {
      return {
        ...data,
        version: data.jsonrpc,
      };
    };

    const parseResponse = async (response) => {
      const data = await response.json();
      return {
        ...data,
        version: data.jsonrpc,
      };
    };

    const stringifyRequest = (data, id = null, jsonrpc = '2.0') => {
      const { method, params } = data;
      return JSON.stringify({
        method,
        params,
        jsonrpc,
        id,
      });
    };

    const stringifyResponse = (data, id = null, jsonrpc = '2.0') => {
      try {
        return JSON.stringify({ jsonrpc, id, result: data });
      } catch (error) {
        throw new ApplicationError({
          msg: error,
        });
      }
    };

    const error = (error, jsonrpc = '2.0') => {
      try {
        return JSON.stringify({ jsonrpc, error, id: null });
      } catch (error) {
        throw new ApplicationError({
          msg: error,
        });
      }
    };

    return {
      name: 'jsonrpc',
      contentType: 'application/json',
      format: 'json',
      parseRequest,
      parseResponse,
      stringifyResponse,
      stringifyRequest,
      error,
    };
  }

  function defineParsers (...args) {
    const parsers = args.map((arg) => arg());

    const getParser = (parsers) => (name) => {
      assertApp(typeof name === 'string', {
        msg: `Can't get parser '${name}', typeof=${typeof name}`,
      });

      for (const parser of parsers) {
        if (parser.name === name) {
          return parser;
        }
      }

      throw new ApplicationError({
        msg: `No parser with name '${name}'`,
      });
    };

    return getParser(parsers);
  }

  $(document).ready(() => {
    // $('#test').autocomplete();
    $errorBar = $('#errorBar');

    const $allRoutesList = $('#all-routes-list'); // consts
    const $routeItemTemplate = $('#flights-list-item-template');
    const $flightItemTemplate = $('#flight-item-template');

    const $flightForm = $('#flight-form-input');

    $('#subscribe-button').click(async () => {
      trace(`Subscribe button clicked`);

      let formParams;
      try {
        formParams = getSearchFormParams($flightForm);
      } catch (e) {
        handleError(e);
        return false;
      }

      try {
        const result = await subscribe({
          v: formParams.v,
          fly_from: formParams.fly_from,
          fly_to: formParams.fly_to,
        }, formParams.format);

        if (result.status_code >= 1000 && result.status_code < 2000) {
          displaySearchResult(
            result,
            $allRoutesList,
            { $routeItemTemplate, $flightItemTemplate }
          );
        } else if (result.status_code === 2000) {
          displayErrorMessage('There is no information about this flight at the moment. Please come back in 15 minutes.');
        }
      } catch (e) {
        handleError(e);
      }

      return false;
    });

    $('#unsubscribe-button').click(async () => {
      trace(`Unsubscribe button clicked`);

      let formParams;
      try {
        formParams = getSearchFormParams($flightForm);
      } catch (e) {
        handleError(e);
        return false;
      }

      try {
        const result = await unsubscribe({
          v: formParams.v,
          fly_from: formParams.fly_from,
          fly_to: formParams.fly_to,
        }, formParams.format);

        if (result.status_code >= 1000 && result.status_code < 2000) {
          displaySearchResult(
            result,
            $allRoutesList,
            { $routeItemTemplate, $flightItemTemplate }
          );
        } else if (result.status_code === 2000) {
          displayErrorMessage('There is no information about this flight at the moment. Please come back in 15 minutes.');
        }
      } catch (e) {
        handleError(e);
      }
    });

    $('#submit-button').click(async (event) => {
      trace(`Submit button clicked`);

      event.preventDefault();
      let formParams;

      try {
        formParams = getSearchFormParams($flightForm);
      } catch (e) {
        handleError(e);
        return false;
      }

      try {
        const format = formParams.format;

        delete formParams.format;

        const result = await search(formParams, format);

        if (result.status_code >= 1000 && result.status_code < 2000) {
          displaySearchResult(
            result,
            $allRoutesList,
            { $routeItemTemplate, $flightItemTemplate }
          );
        } else if (result.status_code === 2000) {
          displayErrorMessage('There is no information about this flight at the moment. Please come back in 15 minutes.');
        }
      } catch (e) {
        handleError(e);
      }

      return false;
    });

    $flightForm.on('submit', event => {
      event.preventDefault();
    });

    const airportsByNames = Object.values(AIRPORT_HASH)
      .reduce(
        (hash, airport) => {
          hash[airport.latinName] = airport;
          hash[airport.nationalName] = airport;
          hash[airport.cityName] = airport;
          return hash;
        },
        {}
      );

    $('#from-input').autocomplete(airportsByNames);
    $('#to-input').autocomplete(airportsByNames);
    setupLoading($('#load-more-button'), $allRoutesList);
  });

  window.addEventListener('error', (error) => {
    handleError(error);

    // suppress
    return true;
  });

  function handleError (error) {
    console.log(error);

    if (error.userMessage) {
      displayErrorMessage(error.userMessage);
    }
  }
}

start();
