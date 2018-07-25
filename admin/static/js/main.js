'use strict';

function main () {
  const BaseError = function (messages, shouldSend) {
    const error = Error.call(this, messages.msg);

    this.userMessage = messages.userMessage;
    this.msg = messages.msg;

    shouldSend &&
    sendError({
      v: '2.0',
      msg: messages.msg,
      trace: traceLog,
      stack_trace: error.stack,
    }, 'jsonrpc');

    handleError(messages, 'error');
  };

  // BaseError.prototype = Object.create(Error.prototype);
  // BaseError.prototype.constructor = BaseError;

  const ApplicationError = function (messages) {
    messages.userMessage = messages.userMessage ||
      'Application encountered an unexpected condition. Please refresh the page.';

    BaseError.call(this, messages, true);
  };

  // ApplicationError.prototype = Object.create(BaseError.prototype);
  // ApplicationError.prototype.constructor = ApplicationError;

  const PeerError = function (messages) {
    messages.userMessage = messages.userMessage ||
      'Service is not available at the moment. Please refresh the page and try again later.';

    BaseError.call(this, messages, true);
  };

  // PeerError.prototype = Object.create(BaseError.prototype);
  // PeerError.prototype.constructor = PeerError;

  const UserError = function (messages) {
    BaseError.call(this, messages, true);
  };

  const inherit = function (childClass, parentClass) {
    childClass.prototype = Object.create(parentClass.prototype);
    childClass.prototype.constructor = childClass;
  };

  inherit(BaseError, Error);
  inherit(ApplicationError, BaseError);
  inherit(PeerError, BaseError);
  inherit(UserError, BaseError);

  // UserError.prototype = Object.create(BaseError.prototype);
  // UserError.prototype.constructor = UserError;

  const assertApp = function (condition, errorParams) {
    if (!condition) {
      throw new ApplicationError(errorParams);
    }
  };

  const assertPeer = function (condition, errorParams) {
    if (!condition) {
      throw new PeerError(errorParams);
    }
  };

  const assertUser = function (condition, errorParams) {
    if (!condition) {
      throw new UserError(errorParams);
    }
  };

  const idGenerator = function () {
    var id = 1; // eslint-disable-line no-var

    return function () {
      return id++;
    };
  };

  // maybe getAJVError
  const getValidatorMsg = function (validator) {
    assertApp(_.isObject(validator), {
      msg: 'Expected validator to be an object, but was ' + typeof validator, // eslint-disable-line prefer-template
    }); // eslint-disable-line prefer-template
    assertApp(
      validator.errors instanceof Array ||
      validator.errors === null, {
        msg: 'Expected validator errors to be array or null, but was ' + typeof validator.errors, // eslint-disable-line prefer-template
      }
    );

    if (validator.errors === null) {
      return '';
    } else {
      return validator.errors.map(function (error) { // eslint-disable-line prefer-arrow-callback
        assertApp(_.isObject(error), {
          msg: 'Expected validation error to be an object, but was ' + typeof error, // eslint-disable-line prefer-template
        });
        assertApp(typeof error.message === 'string', {
          msg: 'Expected validation error message to be a string, but was ' + typeof error.message, // eslint-disable-line prefer-template
        });

        return error.message;
      }).join(';');
    }
  };

  const handleError = function (error) {
    console.log(error);

    if (error.userMessage) {
      displayUserMessage(error.userMessage, 'error');
    }
  };

  const yamlParser = function () {
    const parseYAML = function (yaml) {
      try {
        return jsyaml.safeLoad(yaml);
      } catch (error) {
        throw new PeerError({
          msg: 'Invalid yamlrpc format. Cannot parse YAML.',
        });
      }
    };

    const normalizeYAMLRequest = function (yaml) {
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

    const normalizeYAMLResponse = function (yaml) {
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

    const stringifyYAML = function (yaml) {
      try {
        return jsyaml.safeDump(yaml);
      } catch (error) {
        throw new ApplicationError({
          msg: error,
        });
      }
    };

    const parseRequest = function (data) {
      const normalized = normalizeYAMLRequest(parseYAML(data));
      normalized.version = normalized.yamlrpc;
      return normalized;
    };

    const parseResponse = function (response) {
      const normalized = normalizeYAMLResponse(parseYAML(response));
      return normalized;
    };

    const stringifyResponse = function (data, id = null, yamlrpc = '2.0') {
      return stringifyYAML({
        result: data,
        yamlrpc: yamlrpc,
        id: id,
      });
    };

    const stringifyRequest = function (data, id = null, yamlrpc = '2.0') {
      const { method, params } = data;
      return stringifyYAML({
        action: method,
        parameters: params,
        yamlrpc: yamlrpc,
        id: id,
      });
    };

    const error = function (error, yamlrpc = '2.0') {
      return stringifyYAML({
        yamlrpc: yamlrpc,
        error: error,
        id: null,
      });
    };

    return {
      name: 'yamlrpc',
      contentType: 'text/yaml',
      format: 'yaml',
      parseRequest: parseRequest,
      parseResponse: parseResponse,
      stringifyResponse: stringifyResponse,
      stringifyRequest: stringifyRequest,
      error: error,
    };
  };

  const jsonParser = function () {
    const parseRequest = function (data) {
      data.version = data.jsonrpc;
      return data;
    };

    const parseResponse = function (response) {
      const data = JSON.parse(response);
      data.version = data.jsonrpc;
      return data;
    };

    const stringifyRequest = function (data, id = null, jsonrpc = '2.0') {
      const { method, params } = data;
      return JSON.stringify({
        method: method,
        params: params,
        jsonrpc: jsonrpc,
        id: id,
      });
    };

    const stringifyResponse = function (data, id = null, jsonrpc = '2.0') {
      try {
        return JSON.stringify({
          jsonrpc: jsonrpc,
          id: id,
          result: data,
        });
      } catch (error) {
        throw new ApplicationError({
          msg: error,
        });
      }
    };

    const error = function (error, jsonrpc = '2.0') {
      try {
        return JSON.stringify({
          jsonrpc: jsonrpc,
          error: error,
          id: null,
        });
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
      parseRequest: parseRequest,
      parseResponse: parseResponse,
      stringifyResponse: stringifyResponse,
      stringifyRequest: stringifyRequest,
      error: error,
    };
  };

  const defineParsers = function (args) {
    const parsers = args.map(function (arg) { // eslint-disable-line prefer-arrow-callback
      return arg();
    });

    const getParser = function (parsers) {
      return function (name) {
        assertApp(typeof name === 'string', {
          msg: 'Can\'t get parser \'' + name + '\', typeof=' + typeof name + '', // eslint-disable-line prefer-template
        });

        var i; // eslint-disable-line no-var

        for (i = 0; i < parsers.length; i++) {
          if (parsers[i].name === name) {
            return parsers[i];
          }
        }

        throw new ApplicationError({
          msg: 'No parser with name \'' + name + '\'', // eslint-disable-line prefer-template
        });
      };
    };

    return getParser(parsers);
  };

  const getElementUniqueId = function (element, idPrefix) {
    trace('getElementUniqueId');

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
  };

  const onCloseMessageClick = function (event) {
    const closeMessageButton = event.target;

    console.log(closeMessageButton);

    const uniqueId = getElementUniqueId(closeMessageButton, 'close-msg-btn-');
    $('#msg-' + uniqueId).remove(); // eslint-disable-line prefer-template
  };

  // const SERVER_URL = '/';
  const SERVER_URL = 'http://127.0.0.1:3000';
  const MAX_TRACE = 300;
  var $messagesList; // eslint-disable-line no-var
  const validateSendErrorReq = validators.getValidateSendErrorReq();
  const validateSendErrorRes = validators.getValidateSendErrorRes();
  const validateErrorRes = validators.getValidateErrorRes();
  const validateListAirportsRes = validators.getValidateListAirportsRes();
  const validateGetAPIKeyRes = validators.getValidateGetAPIKeyRes();
  const traceLog = [];

  const getParser = defineParsers([jsonParser, yamlParser]);
  const getUniqueId = idGenerator();

  const trace = function (msg) {
    if (traceLog.length > MAX_TRACE) {
      traceLog.shift();
    }
    traceLog.push(msg);
  };

  const displayUserMessage = function (msg, type = 'info') {
    const allowedMsgTypes = ['info', 'error', 'success'];

    assertApp(
      typeof type === 'string' &&
      allowedMsgTypes.indexOf(type) !== -1,
      'Invalid message type "' + type + '"' // eslint-disable-line prefer-template
    );

    const msgTypeToClassMap = {
      'info': 'bg-info',
      'error': 'bg-danger',
      'success': 'bg-success',
    };

    const msgId = getUniqueId();
    const closeMessageButton = $('<button type="button" class="close" aria-label="Close">X</button>')
      .attr('id', 'close-msg-btn-' + msgId) // eslint-disable-line prefer-template
      .click(onCloseMessageClick);

    $('<p></p>')
      .addClass(msgTypeToClassMap[type])
      .attr('id', 'msg-' + msgId) // eslint-disable-line prefer-template
      .text(msg)
      .append(closeMessageButton)
      .appendTo($messagesList);
  };

  const sendError = function (params, protocolName) {
    console.log(params);
    assertApp(validateSendErrorReq(params), {
      msg: 'Params do not adhere to sendErrorRequestSchema: ' + getValidatorMsg(validateSendErrorReq), // eslint-disable-line prefer-template
    });

    sendRequest({
      url: SERVER_URL,
      data: {
        method: 'senderror',
        params: params,
      },
      protocolName: protocolName,
    }, function (result, error) { // eslint-disable-line prefer-arrow-callback
      assertPeer(validateSendErrorRes(result), {
        msg: 'Params do not adhere to sendErrorResponseSchema: ' + getValidatorMsg(validateSendErrorRes), // eslint-disable-line prefer-template
      });
    });
  };

  const sendRequest = function (requestData, callback) {
    trace('sendRequest');

    var url = requestData.url; // eslint-disable-line no-var
    var data = requestData.data; // eslint-disable-line no-var
    var protocolName = requestData.protocolName; // eslint-disable-line no-var
    var xhr = new window.XMLHttpRequest(); // eslint-disable-line no-var
    var parser = getParser(protocolName); // eslint-disable-line no-var

    xhr.onreadystatechange = function () { // eslint-disable-line prefer-arrow-callback
      if (xhr.readyState === window.XMLHttpRequest.DONE) {
        if (xhr.status === 200) {
          const responseParsed = parser.parseResponse(xhr.responseText);
          callback(responseParsed.result || null, responseParsed.error || null); // TODO handle error;
        } else if (xhr.status !== 204) {
          handleError({
            userMessage: 'Service is not available at the moment due to network issues',
          });
        }
      }
    };

    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', parser.contentType);
    xhr.send(parser.stringifyRequest(data, getUniqueId()));
  };

  const listAirports = function (protocolName, callback) {
    trace('listAirports(' + protocolName + '), typeof arg=' + typeof protocolName + ''); // eslint-disable-line prefer-template

    sendRequest({
      url: SERVER_URL,
      data: {
        method: 'list_airports',
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

        trace('Error in listAirports:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateListAirportsRes(result), {
        msg: 'Params do not adhere to listAirportsResponseSchema: ' + getValidatorMsg(validateListAirportsRes), // eslint-disable-line prefer-template
      });

      callback(result);
    });
  };

  const getAirportName = function (airports, id) {
    trace('getAirportName(airports, ' + id + '), typeof arg=' + typeof id + ''); // eslint-disable-line prefer-template

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
  };

  const getAirportId = function (airports, name) {
    trace('getAirportId(airports, ' + name + '), typeof arg=' + typeof name + ''); // eslint-disable-line prefer-template

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
  };

  const getAPIKey = function (params, protocolName, callback) {
    trace('getAPIKey(' + JSON.stringify(params) + '), typeof arg=' + typeof params + ''); // eslint-disable-line prefer-template

    sendRequest({
      url: SERVER_URL,
      data: {
        method: 'get_api_key',
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

      assertPeer(validateGetAPIKeyRes(result), {
        msg: 'Params do not adhere to getAPIKeyResponseSchema: ' + getValidatorMsg(validateGetAPIKeyRes), // eslint-disable-line prefer-template
      });

      callback(result);
    });
  };

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    $messagesList = $('#messages-list');
  });

  window.addEventListener('error', function (error) { // eslint-disable-line prefer-arrow-callback
    handleError(error);
  });

  return {
    BaseError: BaseError,
    ApplicationError: ApplicationError,
    PeerError: PeerError,
    UserError: UserError,
    handleError: handleError,
    displayUserMessage: displayUserMessage,
    assertApp: assertApp,
    assertPeer: assertPeer,
    assertUser: assertUser,
    getValidatorMsg: getValidatorMsg,
    trace: trace,
    sendRequest: sendRequest,
    sendError: sendError,
    listAirports: listAirports,
    getAirportName: getAirportName,
    getAirportId: getAirportId,
    getUniqueId: getUniqueId,
    getElementUniqueId: getElementUniqueId,
    getAPIKey: getAPIKey,
    yamlParser: yamlParser,
    jsonParser: jsonParser,
    defineParsers: defineParsers,
    SERVER_URL: SERVER_URL,
  };
}