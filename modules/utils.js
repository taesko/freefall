const _ = require('lodash');
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

async function requestJSONDepreciate (url, parameters) {
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

function hashFromEntriesDepreciate (entries) {
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

function * batchMap (collection, func, count) {
  assertApp(_.isObject(collection));
  assertApp(_.isFunction(func));
  assertApp(Number.isInteger(count));
  assertApp(count > 0);

  let itemCount = 0;
  let batch = [];

  for (const [index, element] of Object.entries(collection)) {
    if (itemCount === count) {
      yield batch;
      batch = [];
      itemCount = 0;
    }
    batch.push(func(element, index, collection));
    itemCount++;
  }
  if (batch.length > 0) {
    yield batch;
  }
}

function toSmallestCurrencyUnit (quantity) {
  return quantity * 100;
}

function fromSmallestCurrencyUnitDepreciate (quantity) {
  return quantity / 100;
}

module.exports = {
  requestJSONDepreciate: requestJSONDepreciate,
  toSmallestCurrencyUnit,
  fromSmallestCurrencyUnitDepreciate: fromSmallestCurrencyUnitDepreciate,
  hashFromEntriesDepreciate: hashFromEntriesDepreciate,
  cleanHash,
  batchMap,
};
