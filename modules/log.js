const util = require('util');

/* eslint-disable no-console */
const DEBUG = 'DEBUG';
const INFO = 'INFO';
const WARNING = 'WARNING';
const CRITICAL = 'CRITICAL';
const ERROR = 'ERROR';
const ORDER = [DEBUG, INFO, WARNING, ERROR, CRITICAL];
const LOG_TEMPLATE = '%s %s %s';

function logLevel () {
  return ORDER.find(lvl => lvl === process.env.FREEFALL_LOG_LEVEL) || INFO;
}

function shouldPrintLevel (level) {
  return ORDER.indexOf(level) >= ORDER.indexOf(logLevel());
}

/* Request and response are logged to stdout. While all other logs go to stderr. */

function request (ctx) {
  console.info(new Date(), 'GOT REQUEST', ctx.request);
}

function response (ctx) {
  console.info(new Date(), 'GOT RESPONSE', ctx.response);
}

function log (level, ...messages) {
  const message = util.format(messages[0], ...messages.slice(1));
  if (shouldPrintLevel(level)) {
    console.error(LOG_TEMPLATE, new Date().toISOString(), `${level}: `, message);
  }
}
const debug = (...messages) => log(DEBUG, ...messages);
const info = (...messages) => log(INFO, ...messages);
const warn = (...messages) => log(WARNING, ...messages);
const critical = (...messages) => log(CRITICAL, ...messages);
const error = (...messages) => log(ERROR, ...messages);

module.exports = {
  debug,
  info,
  warn,
  critical,
  error,
  request,
  response,
};
