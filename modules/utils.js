const fetch = require('node-fetch');
const { assertApp } = require('./error-handling');
const log = require('./log');

function toQueryString (params) {
  const paramsList = [];

  for (const [param, val] of Object.entries(params)) {
    paramsList.push([encodeURIComponent(param), encodeURIComponent(val)]);
  }

  return paramsList.map(pair => pair.join('=')).join('&');
}

async function requestJSON (url, parameters) {
  assertApp(
    typeof url === 'string',
    'Invalid url.'
  );

  let shouldPutQuestionMark = false;
  const questionMarkMatches = url.match(/\?/g);

  if (questionMarkMatches === null && parameters) {
    shouldPutQuestionMark = true;
  }

  const uri = url +
    ((shouldPutQuestionMark) ? '?' : '') +
    ((parameters) ? toQueryString(parameters) : '');

  log.debug(uri);
  const response = await fetch(uri);

  return response.json();
}

function hashFromEntries (entries) {
  return entries.reduce(
    (hash, [key, value]) => {
      hash[key] = value;
      return hash;
    },
    {}
  );
}

function cleanHash (hash) {
  const result = {};

  for (const [key, value] of Object.entries(hash)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}

function toSmallestCurrencyUnit (quantity) {
  return quantity * 100;
}

function fromSmallestCurrencyUnit (quantity) {
  return quantity / 100;
}

module.exports = {
  requestJSON,
  toSmallestCurrencyUnit,
  fromSmallestCurrencyUnit,
  hashFromEntries,
  cleanHash,
};
