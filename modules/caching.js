const { assertApp } = require('./error-handling');
const log = require('./log');

function Cache (name, maxSize = 2000) {
  const cache = Object.create(null);
  let size = 1000;

  assertApp(maxSize >= size);
  const freeSpaceIfFull = (cache) => {
    if (Object.keys(cache).length < size) {
      return;
    }

    log.info(`In cache '${name}' - freeing space`);
    for (const [key, value] of Object.entries(cache)) {
      if (value.expiresOn.getTime() < new Date().getTime()) {
        delete cache[key];
      }
    }

    const numberOfCachedObjects = Object.keys(cache).length;
    const newSize = numberOfCachedObjects * 2;
    if (newSize <= maxSize) {
      size = newSize;
      return;
    }

    log.debug(`In cache '${name}' - deleting unexpired items to free space below 80%.`);
    if (numberOfCachedObjects > size * (8 / 10)) {
      const numberToRemove = Math.floor(size * (2 / 10));
      const keys = Object.keys(cache);
      for (let k = 0; k <= numberToRemove; k++) {
        const key = keys[k];
        delete cache[key];
      }
    }
  };

  const store = (cache) => (key, expiresOn, value) => {
    assertApp(expiresOn instanceof Date, `got ${expiresOn}`);

    freeSpaceIfFull(cache);
    cache[key] = {
      expiresOn,
      cached: value,
    };
  };

  const retrieve = (cache) => (key) => {
    if (Object.prototype.hasOwnProperty.call(cache, key)) {
      const { cached, expiresOn } = cache[key];

      if (expiresOn.getTime() < new Date().getTime()) {
        log.info(`In cache '${name}' - key ${key} has expired`);
        delete cache[key];
        return undefined;
      } else {
        return cached;
      }
    } else {
      return undefined;
    }
  };

  const remove = (cache) => (key) => {
    delete cache[key];
  };

  return {
    store: store(cache),
    retrieve: retrieve(cache),
    remove: remove(cache),
  };
}

const SESSION_CACHE = Cache('SessionCache', 2000);
const USER_CACHE = Cache('UserCache', 2000);

module.exports = {
  Cache,
  SESSION_CACHE,
  USER_CACHE,
};
