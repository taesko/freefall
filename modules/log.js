/* eslint-disable no-console */
const DEBUG = 'DEBUG';
const INFO = 'INFO';
const WARNING = 'WARNING';
const CRITICAL = 'CRITICAL';
const ERROR = 'ERROR';
const ORDER = [DEBUG, INFO, WARNING, ERROR, CRITICAL];

function stringify (...messages) {
  return messages.map(value => {
    let result;

    if (typeof value === 'string' || typeof value === 'number') {
      result = value;
    } else {
      result = JSON.stringify(value);
    }

    return result;
  }).join(' ');
}

function logLevel () {
  return ORDER.find(lvl => lvl === process.env.FREEFALL_LOG_LEVEL) || INFO;
}

function shouldPrintLevel (level) {
  return ORDER.indexOf(level) >= ORDER.indexOf(logLevel());
}

function debug (...messages) {
  if (shouldPrintLevel(DEBUG)) {
    console.info('DEBUG: ', stringify(...messages));
  }
}

function info (...messages) {
  if (shouldPrintLevel(INFO)) {
    console.info('INFO: ', stringify(...messages));
  }
}

function warn (...messages) {
  if (shouldPrintLevel(WARNING)) {
    console.info('WARNING: ', stringify(...messages));
  }
}

function critical (...messages) {
  if (shouldPrintLevel(CRITICAL)) {
    console.info('CRITICAL: ', stringify(...messages));
  }
}

function error (...messages) {
  if (shouldPrintLevel(ERROR)) {
    console.info('EXCEPTION occurred:', stringify(...messages));
  }
}

module.exports = {
  debug,
  info,
  warn,
  critical,
  error,
};
