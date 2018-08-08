/* eslint-disable no-console */
const DEBUG = 'DEBUG';
const INFO = 'INFO';
const WARNING = 'WARNING';
const CRITICAL = 'CRITICAL';
const ERROR = 'ERROR';
const ORDER = [DEBUG, INFO, WARNING, ERROR, CRITICAL];

function logLevel () {
  return ORDER.find(lvl => lvl === process.env.FREEFALL_LOG_LEVEL) || INFO;
}

function shouldPrintLevel (level) {
  return ORDER.indexOf(level) >= ORDER.indexOf(logLevel());
}

/* Request and response are logged to stdout. While all other logs go to stderr. */

function request (ctx) {
  console.info('GOT REQUEST', ctx.request);
}

function response (ctx) {
  console.info('GOT RESPONSE', ctx.response);
}

function debug (...messages) {
  if (shouldPrintLevel(DEBUG)) {
    console.error('DEBUG: ', ...messages);
  }
}

function info (...messages) {
  if (shouldPrintLevel(INFO)) {
    console.error('INFO', ...messages);
  }
}

function warn (...messages) {
  if (shouldPrintLevel(WARNING)) {
    console.error('WARNING: ', ...messages);
  }
}

function critical (...messages) {
  if (shouldPrintLevel(CRITICAL)) {
    console.error('CRITICAL: ', ...messages);
  }
}

function error (...messages) {
  if (shouldPrintLevel(ERROR)) {
    console.error('Exception occurred:', ...messages);
  }
}

module.exports = {
  debug,
  info,
  warn,
  critical,
  error,
  request,
  response,
};
