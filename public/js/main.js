/* eslint-disable prefer-template */
'use strict';

function main () { // eslint-disable-line no-unused-vars
  const idGenerator = function () {
    var id = 1; // eslint-disable-line no-var

    return function () {
      return id++;
    };
  };

  const SERVER_URL = '/';
  const PROTOCOL_NAME = 'yamlrpc';
  const MAX_TRACE = 300;
  var $messagesList; // eslint-disable-line no-var
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
    if (error.userMessage) {
      displayUserMessage(error.userMessage, 'error');
    }
    console.exception(error);
    console.trace();
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

    var url = requestData.url; // eslint-disable-line no-var
    var data = requestData.data; // eslint-disable-line no-var
    var protocolName = requestData.protocolName; // eslint-disable-line no-var
    var xhr = new window.XMLHttpRequest(); // eslint-disable-line no-var
    var parser = getParser(protocolName); // eslint-disable-line no-var

    xhr.onreadystatechange = function () { // eslint-disable-line prefer-arrow-callback
      if (xhr.readyState === window.XMLHttpRequest.DONE) {
        if (xhr.status === 200) {
          const responseParsed = parser.parseResponse(xhr.responseText);
          if (typeof callback === 'function') {
            setTimeout(function () { // eslint-disable-line prefer-arrow-callback
              callback(
                responseParsed.error || null,
                responseParsed.result || null
              );
            }, 0);
          }
        } else if (xhr.status !== 204) {
          handleError({
            userMessage: 'Service is not available at the moment due to network or other issues',
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

  function saveFormData (page, formID) {
    assertApp(typeof page === 'string', { msg: 'got ' + page });
    assertApp(typeof formID === 'string', { msg: 'got ' + formID });

    if (formID[0] !== '#') {
      formID = '#' + formID;
    }

    const serialized = $(formID).serializeArray();
    for (const pair of serialized) {
      const name = pair.name;
      const value = pair.value;
      window.localStorage.setItem(page + '-' + formID + '-' + name, value);
    }
  }

  function restoreFormData (page, formID) {
    assertApp(typeof page === 'string', { msg: 'got ' + page });
    assertApp(typeof formID === 'string', { msg: 'got' + formID });

    if (formID[0] !== '#') {
      formID = '#' + formID;
    }

    const $form = $(formID);
    const serialized = $form.serializeArray();

    for (const pair of serialized) {
      const name = pair.name;
      const storedValue = window.localStorage.getItem(page + '-' + formID + '-' + name);
      if (storedValue) {
        $form.find('input[name=' + name + ']').val(storedValue);
      }
    }
  }

  function clearFormData (formID) {
    if (formID[0] !== '#') {
      formID = '#' + formID;
    }

    const $form = $(formID);
    for (const pair of $form.serializeArray()) {
      $form.find('input[name=' + pair.name + ']').val('');
    }
  }

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    $messagesList = $('#messages-list');
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
    saveFormData,
    restoreFormData,
    clearFormData,
    SERVER_URL: SERVER_URL,
    PROTOCOL_NAME: PROTOCOL_NAME,
    APIKeyRef: APIKeyRef,
  };
}
