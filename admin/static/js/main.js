'use strict';

function main () { // eslint-disable-line no-unused-vars
  const idGenerator = function () {
    var id = 1; // eslint-disable-line no-var

    return function () {
      return id++;
    };
  };

  const SERVER_URL = '/api';
  // const SERVER_URL = 'http://127.0.0.1:3000';
  const PROTOCOL_NAME = 'yamlrpc';
  const MAX_TRACE = 300;
  const validateSendErrorReq = validators.getValidateSendErrorReq();
  const APIKeyRef = {};

  const traceLog = [];

  const getUniqueId = idGenerator();

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
    }, PROTOCOL_NAME);

    handleError(messages);
  };

  const ApplicationError = function (messages) {
    messages.userMessage = messages.userMessage ||
      'Application encountered an unexpected condition. Please refresh the page.';

    BaseError.call(this, messages, true);
  };

  const PeerError = function (messages) {
    messages.userMessage = messages.userMessage ||
      'Service is not available at the moment. Please refresh the page and try again later.';

    BaseError.call(this, messages, true);
  };

  const UserError = function (messages) {
    // 10% of user errors should be sent
    const shouldSend = Math.floor(Math.random() * 10) === 0;
    BaseError.call(this, messages, shouldSend);
  };

  const inherit = function (childClass, parentClass) {
    childClass.prototype = Object.create(parentClass.prototype);
    childClass.prototype.constructor = childClass;
  };

  const assertApp = function (condition, errorParams) {
    if (typeof condition !== 'boolean') {
      throw new ApplicationError({
        msg: 'Expected condition to be boolean, but condition=' + condition, // eslint-disable-line prefer-template
      });
    }

    if (!condition) {
      throw new ApplicationError(errorParams);
    }
  };

  const assertPeer = function (condition, errorParams) {
    if (typeof condition !== 'boolean') {
      throw new ApplicationError({
        msg: 'Expected condition to be boolean, but condition=' + condition, // eslint-disable-line prefer-template
      });
    }

    if (!condition) {
      throw new PeerError(errorParams);
    }
  };

  const assertUser = function (condition, errorParams) {
    if (typeof condition !== 'boolean') {
      throw new ApplicationError({
        msg: 'Expected condition to be boolean, but condition=' + condition, // eslint-disable-line prefer-template
      });
    }

    if (!condition) {
      throw new UserError(errorParams);
    }
  };

  // maybe getAJVError
  const getValidatorMsg = function (validator) {
    assertApp(_.isObject(validator), {
      msg: 'Expected validator to be an object, but was ' + typeof validator, // eslint-disable-line prefer-template
    });
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
    if (error.userMessage) {
      displayUserMessage(error.userMessage, 'error');
    }
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

    assertApp(!isNaN(idResult), {
      msg: 'Expected element unique id to be a number, but its value was: ' + idResult, // eslint-disable-line prefer-template
    });

    return idResult;
  };

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
      'info': 'info-dialog-titlebar',
      'error': 'error-dialog-titlebar',
      'success': 'success-dialog-titlebar',
    };

    const msgId = getUniqueId();
    const $messageClone = $('#message').clone()
      .attr('id', 'message-' + msgId) // eslint-disable-line prefer-template
      .attr('title', type)
      .removeAttr('hidden');

    $messageClone.find('#message-text')
      .attr('id', 'message-text-' + msgId) // eslint-disable-line prefer-template
      .text(msg);

    $messageClone.dialog({
      classes: {
        'ui-dialog-titlebar': msgTypeToClassMap[type],
      },
      show: {
        effect: 'highlight',
        duration: 500,
      },
    });
    $messageClone.appendTo($('messages-list'));
  };

  const sendError = function (params, protocolName) {
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
    });
  };

  const sendRequest = function (requestData, callback) {
    trace('sendRequest');

    assertApp(_.isObject(requestData), {
      msg: 'Expected requestData in sendRequest to be an object, but was "' + typeof requestData + "'", // eslint-disable-line prefer-template
    });

    assertApp(!callback || typeof callback === 'function', {
      msg: 'Expected callback to be falsey or function, but was "' + typeof callback + '"', // eslint-disable-line prefer-template
    });

    var parser = getParser(requestData.protocolName); // eslint-disable-line no-var

    getAjaxResponseText({
      url: requestData.url,
      method: 'POST',
      contentType: parser.contentType,
      body: parser.stringifyRequest(requestData.data, getUniqueId())
    }, function (response) { // eslint-disable-line prefer-arrow-callback
      if (response.status === 200) {
        const responseParsed = parser.parseResponse(response.responseText);
        if (typeof callback === 'function') {
          setTimeout(function () { // eslint-disable-line prefer-arrow-callback
            callback(
              responseParsed.error || null,
              responseParsed.result || null
            );
          }, 0);
        }
      } else if (response.status !== 204) {
        handleError({
          userMessage: 'Service is not available at the moment due to network or other issues.',
        });
      }
    });
  };

  const getAjaxResponseText = function (params, callback) {
    assertApp(typeof params.url === 'string', {
      msg: 'Expected url in params to be string, but params.url=' + params.url, // eslint-disable-line prefer-template
    });
    const expectedRequestMethods = [
      'GET',
      'HEAD',
      'POST',
      'PUT',
      'DELETE',
      'CONNECT',
      'OPTIONS',
      'TRACE',
      'PATCH',
    ];
    assertApp(expectedRequestMethods.indexOf(params.method) >= 0, {
      msg: 'Unexpected method in params, method=' + params.method, // eslint-disable-line prefer-template
    });
    assertApp(params.body === null || typeof params.body === 'string', {
      msg: 'Expected body in params to be string, but body=' + params.body, // eslint-disable-line prefer-template
    });
    assertApp(typeof params.contentType === 'string', {
      msg: 'Expected contentType in params to be string, but contentType=' + params.contentType, // eslint-disable-line prefer-template
    });
    assertApp(_.isFunction(callback), {
      msg: 'Expected callback function, but callback=' + callback, // eslint-disable-line prefer-template
    });

    var xhr = new window.XMLHttpRequest(); // eslint-disable-line no-var

    xhr.onreadystatechange = function () { // eslint-disable-line prefer-arrow-callback
      if (xhr.readyState === window.XMLHttpRequest.DONE) {
        setTimeout(function () { // eslint-disable-line prefer-arrow-callback
          callback({
            status: xhr.status,
            responseText: xhr.responseText,
          });
        }, 0);
      }
    };

    xhr.open(params.method, params.url);
    xhr.setRequestHeader('Content-Type', params.contentType);
    xhr.send(params.body);
  };

  inherit(BaseError, Error);
  inherit(ApplicationError, BaseError);
  inherit(PeerError, BaseError);
  inherit(UserError, BaseError);

  const getParser = getParserGetter({
    ApplicationError: ApplicationError,
    PeerError: PeerError,
    UserError: UserError,
    assertApp: assertApp,
    assertPeer: assertPeer,
    assertUser: assertUser,
  });

  return {
    ApplicationError: ApplicationError,
    PeerError: PeerError,
    UserError: UserError,
    assertApp: assertApp,
    assertPeer: assertPeer,
    assertUser: assertUser,
    handleError: handleError,
    displayUserMessage: displayUserMessage,
    getValidatorMsg: getValidatorMsg,
    trace: trace,
    traceLog: traceLog,
    sendRequest: sendRequest,
    getAjaxResponseText: getAjaxResponseText,
    sendError: sendError,
    getUniqueId: getUniqueId,
    getElementUniqueId: getElementUniqueId,
    SERVER_URL: SERVER_URL,
    PROTOCOL_NAME: PROTOCOL_NAME,
    APIKeyRef: APIKeyRef,
  };
}
