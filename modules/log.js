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

function debug (...messages) {
  if (shouldPrintLevel(DEBUG)) {
    console.debug(...messages);
  }
}

function info (...messages) {
  if (shouldPrintLevel(INFO)) {
    console.info(...messages);
  }
}

function warn (...messages) {
  if (shouldPrintLevel(WARNING)) {
    console.warn(...messages);
  }
}

function critical (...messages) {
  if (shouldPrintLevel(CRITICAL)) {
    console.error(...messages);
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
};
