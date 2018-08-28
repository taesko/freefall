const redis = require('redis');

const { assertApp } = require('./error-handling');
const log = require('./log');

const MAX_CACHED_SESSIONS = Math.pow(1, 6);
const MAX_CACHED_USERS = Math.pow(1, 4);

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
        remove(cache)(key);
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
        remove(cache)(key);
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
        remove(cache)(key);
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

function SyncedCache (name, maxSize = 2000) {
  const cache = Object.create(null);
  let size = 0;
  const channelName = `channel-cache-${name}`;
  const publishClient = redis.createClient();
  const subscribedClient = redis.createClient();

  subscribedClient.subscribe(channelName);

  subscribedClient.on('message', (channel, message) => {
    log.info(`key ${message} was removed from another process`);
    remove(cache)(message);
  });

  const freeExpiredIfFull = (cache) => {
    if (Object.keys(cache).length < size) {
      return;
    }

    log.info(`In cache '${name}' - freeing space`);
    for (const [key, value] of Object.entries(cache)) {
      if (value.expiresOn.getTime() < new Date().getTime()) {
        remove(cache)(key);
      }
    }

    const numberOfCachedObjects = Object.keys(cache).length;
    const newSize = numberOfCachedObjects * 2;
    if (newSize <= maxSize) {
      size = newSize;
    }
  };

  const store = (cache) => (key, expiresOn, value) => {
    assertApp(expiresOn instanceof Date, `got ${expiresOn}`);

    freeExpiredIfFull(cache);
    if (size >= maxSize) {
      log.warn(`Cache ${name} is full.`);
      return;
    }

    cache[key] = {
      expiresOn,
      cached: value,
    };
    size += 1;
  };

  const retrieve = (cache) => (key) => {
    if (Object.prototype.hasOwnProperty.call(cache, key)) {
      const { cached, expiresOn } = cache[key];

      if (expiresOn.getTime() < new Date().getTime()) {
        log.info(`In cache '${name}' - key ${key} has expired`);
        remove(cache)(key);
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
    if (size > 0) {
      size -= 1;
    }
  };
  const removeAndSync = (cache) => (key) => {
    remove(cache)(key);
    publishClient.publish(channelName, key);
  };

  return {
    store: store(cache),
    retrieve: retrieve(cache),
    remove: removeAndSync(cache),
  };
}

const SESSION_CACHE = SyncedCache('login-sessions', MAX_CACHED_SESSIONS);
const USER_CACHE = Cache('users', MAX_CACHED_USERS);

module.exports = {
  Cache,
  SESSION_CACHE,
  USER_CACHE,
};
