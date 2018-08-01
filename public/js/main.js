'use strict';

function main () {
  const idGenerator = function () {
    var id = 1; // eslint-disable-line no-var

    return function () {
      return id++;
    };
  };

  const SERVER_URL = '/';
  // const SERVER_URL = 'http://127.0.0.1:3000';
  const MAX_TRACE = 300;
  var $messagesList; // eslint-disable-line no-var
  const validateSendErrorReq = validators.getValidateSendErrorReq();
  const validateSendErrorRes = validators.getValidateSendErrorRes();
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
    }, 'jsonrpc');

    handleError(messages, 'error');
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
    BaseError.call(this, messages, true);
  };

  const inherit = function (childClass, parentClass) {
    childClass.prototype = Object.create(parentClass.prototype);
    childClass.prototype.constructor = childClass;
  };

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
    console.log(error);

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

  const onCloseMessageClick = function (event) {
    const closeMessageButton = event.target;

    const uniqueId = getElementUniqueId(closeMessageButton, 'close-msg-btn-');
    $('#msg-' + uniqueId).remove(); // eslint-disable-line prefer-template
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

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    $messagesList = $('#messages-list');
  });

  window.addEventListener('error', function (error) { // eslint-disable-line prefer-arrow-callback
    handleError(error);
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
    sendError: sendError,
    getUniqueId: getUniqueId,
    getElementUniqueId: getElementUniqueId,
    SERVER_URL: SERVER_URL,
    APIKeyRef: APIKeyRef,
  };
}
