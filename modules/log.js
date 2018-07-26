/* eslint-disable no-console */
const DEBUG = 'DEBUG';
const INFO = 'INFO';
const WARNING = 'WARNING';
const CRITICAL = 'CRITICAL';
const ERROR = 'ERROR';
const ORDER = [DEBUG, INFO, WARNING, CRITICAL];

function logLevel () {
  return {
    DEBUG,
    INFO,
    WARNING,
    CRITICAL,
  }[process.env.FREEFALL_LOG_LEVEL] || INFO;
}

function shouldPrintLevel (level) {
  return ORDER.indexOf(level) >= ORDER.indexOf(logLevel());
}

function log (level, ...messages) {
  if (level !== ERROR && !shouldPrintLevel(level)) {
    return;
  }
  const logFunc = {
    DEBUG: console.debug,
    INFO: console.log,
    WARNING: console.warn,
    CRITICAL: console.error,
    ERROR: console.exception,
  }[level];

  logFunc(...messages);
}

function debug (...messages) {
  log(DEBUG, ...messages);
}

function info (...messages) {
  log(INFO, ...messages);
}

function warn (...messages) {
  log(WARNING, ...messages);
}

function critical (...messages) {
  log(CRITICAL, ...messages);
}

function error (...messages) {
  log(ERROR);
}

module.exports = {
  debug,
  info,
  warn,
  critical,
  error,
}
