module.exports = (() => {
  const path = require('path');
  const sqlite = require('sqlite');
  const { assertApp, assertPeer } = require('./error-handling');
  const { isObject } = require('lodash');
  const { log } = require('./utils');
  let db;
  let dbInitialized = false;

  async function dbConnect () {
    if (
      dbInitialized
    ) {
      log('Already connected to freefall.db...');
    } else {
      log('Connecting to freefall.db...');
      dbInitialized = true;
      db = await sqlite.open(path.join(__dirname, '../freefall.db'));
      await db.run('PRAGMA foreign_keys = ON;');
      await db.run('PRAGMA integrity_check;');
      log('freefall.db OK');
    }
  }

  function assertDB () {
    assertApp(
      isObject(db) &&
      isObject(db.driver) &&
      db.driver.open,
      'No database connection.',
    );
  }

  function stringifyColumns (columns) {
    if (columns == null || columns === '*') {
      return '*';
    } else {
      return columns.join(', ');
    }
  }

  function buildWhereClause (where) {
    if (where == null) {
      return { whereClause: `WHERE 1`, valueHash: {} };
    }

    assertApp(isObject(where), 'buildWhereClause\'s parameter must be a hash.');

    const whereEntries = Object.entries(where);
    const whereColumns = whereEntries.map(([column]) => `${column}=$where_value_${column}`)
      .join(' AND ');
    const valueHash = whereEntries
      .map(([column, value]) => [`$where_value_${column}`, value])
      .reduce(
        (hash, entries) => {
          hash[entries[0]] = entries[1];
          return hash;
        },
        {},
      );

    return { whereClause: `WHERE ${whereColumns}`, valueHash };
  }

  async function executeAll (...args) {
    assertDB();
    return db.all(...args);
  }

  async function executeRun (...args) {
    assertDB();
    return db.run(...args);
  }

  async function select (table, columns = '*') {
    assertDB();
    assertApp(
      typeof table === 'string',
      'Expected string for a name of table',
    );

    return db.all(`SELECT ${stringifyColumns(columns)} FROM ${table};`);
  }

  async function selectWhere (table, columns, where) {
    assertDB();
    assertApp(
      typeof table === 'string' &&
      isObject(where) &&
      'Invalid select data',
    );

    const { whereClause, valueHash } = buildWhereClause(where);
    const query = `SELECT ${stringifyColumns(columns)} FROM ${table} ${whereClause}`;

    log('Executing query', query, 'replaced with hash:', valueHash);

    return db.all(
      query,
      valueHash,
    );
  }

  async function selectRoutesFlights (fetchId, params) {
    assertDB();
    assertApp(
      Number.isInteger(fetchId),
      'Invalid fetch id.',
    );

    const queryParams = [fetchId];

    let query = `

      SELECT
      routes.id AS routeId,
      routes.booking_token AS bookingToken,
      routes.price,
      airlines.name AS airlineName,
      airlines.logo_url AS logoURL,
      afrom.name AS afromName,
      afrom.id AS afromId,
      ato.name AS atoName,
      ato.id AS atoId,
      flights.dtime,
      flights.atime,
      flights.flight_number AS flightNumber,
      routes_flights.is_return AS isReturn
      FROM routes
      LEFT JOIN routes_flights ON routes_flights.route_id = routes.id
      LEFT JOIN flights ON routes_flights.flight_id = flights.id
      LEFT JOIN airports as afrom ON afrom.id = flights.airport_from_id
      LEFT JOIN airports as ato ON ato.id = flights.airport_to_id
      LEFT JOIN airlines ON airlines.id = flights.airline_id
      WHERE routes.fetch_id = ?

    `;

    if (params.price_to) {
      assertPeer(Number.isInteger(params.price_to), 'Invalid price in search request.');
      query += ' AND routes.price <= ? ';
      queryParams.push(params.price_to);
    }

    // TODO finish filtration

    if (params.date_from) {
      assertPeer(typeof params.date_from === 'string', 'Invalid date_from in search request.');
      query += ' AND flights.dtime >= ?';
      queryParams.push(params.date_from);
    }

    if (params.date_to) {
      assertPeer(typeof params.date_to === 'string', 'Invalid date_to in search request.');
      query += ' AND flights.atime <= ?';
      queryParams.push(params.date_to);
    }

    query += ';';

    const routesFlights = await db.all(query, queryParams);

    assertApp(
      Array.isArray(routesFlights),
      'Invalid db routes and flights response.',
    );

    return routesFlights;
  }

  async function selectSubscriptions (airportFromId, airportToId) {
    assertDB();
    assertApp(
      Number.isInteger(airportFromId) &&
      Number.isInteger(airportToId),
      'Invalid airport ids.',
    );

    const subscriptions = await db.all(`

      SELECT fetches.id AS fetchId, fetches.timestamp FROM fetches
      LEFT JOIN subscriptions ON fetches.subscription_id = subscriptions.id
      WHERE subscriptions.airport_from_id = ? AND subscriptions.airport_to_id = ?
      GROUP BY subscriptions.airport_from_id, subscriptions.airport_to_id
      HAVING MAX(fetches.timestamp);

    `, [airportFromId, airportToId]);

    assertApp(
      Array.isArray(subscriptions),
      'Invalid db select subscription response.',
    );

    return subscriptions;
  }

  async function insert (table, data) {
    assertDB();
    assertApp(
      typeof table === 'string' &&
      isObject(data),
      'Invalid insert data.',
    );

    const columns = [];
    const values = [];

    for (const [col, value] of Object.entries(data)) {
      columns.push(col);
      values.push(value);
    }

    const columnsStringified = columns.join(', ');
    const rowStringified = Array(values.length).fill('?').join(', ');
    const insertResult = await db.run(`INSERT INTO ${table} (${columnsStringified}) VALUES (${rowStringified});`,
      values,
    );

    assertApp(
      isObject(insertResult) &&
      isObject(insertResult.stmt) &&
      Number.isInteger(insertResult.stmt.lastID),
      'Incorrect db response.',
    );

    return insertResult.stmt.lastID;
  }

  async function insertDataFetch (subscriptionId) {
    assertDB();

    const newFetchResult = await db.run(
      'INSERT INTO fetches(timestamp, subscription_id) VALUES (strftime(\'%Y-%m-%dT%H:%M:%SZ\' ,\'now\'), ?);',
      [subscriptionId],
    );

    assertApp(
      isObject(newFetchResult) &&
      isObject(newFetchResult.stmt) &&
      Number.isInteger(newFetchResult.stmt.lastID),
      'Incorrect db response.',
    );

    return newFetchResult.stmt.lastID;
  }

  async function insertIfNotExists (table, data, existsCheck) {
    assertDB();

    const found = await selectWhere(table, Object.keys(data), existsCheck);

    assertApp(Array.isArray(found), 'Invalid db response.');

    if (found.length > 0) {
      assertApp(found.length === 1, 'Invalid db response.');

      // return flightIdResult[0].id;
      return false;
    }

    const insertResult = await insert(table, data);

    assertApp(
      Number.isInteger(insertResult),
      'Incorrect db response.',
    );

    return true;
  }

  async function update (table, setHash, whereHash) {
    assertApp(
      isObject(setHash),
      `update function requires setHash to be an object. setHash=${setHash}`,
    );

    const {
      whereClause,
      valueHash: whereValueHash,
    } = buildWhereClause(whereHash);
    const updateColumns = Object.entries(setHash)
      .map(([column]) => `${column}=$update_value_${column}`)
      .join(', ');
    const updateValueHash = Object.entries(setHash)
      .map(([column, value]) => [`$update_value_${column}`, value])
      .reduce(
        (hash, [column, value]) => {
          hash[column] = value;
          return hash;
        },
        {},
      );
    const valueHash = Object.assign(updateValueHash, whereValueHash);
    const query = `UPDATE ${table} SET ${updateColumns} ${whereClause}`;
    log('Executing query: ', query, 'replace with hash', valueHash);

    return executeRun(query, valueHash);
  }

  async function updateWhere (table, setHash, whereHash) {
    assertApp(
      isObject(setHash) && isObject(whereHash),
      `updateWhere function requires setHash and whereHash parameters to be objects. setHash=${setHash} whereHash=${whereHash}`,
    );

    return update(table, setHash, whereHash);
  }

  // TODO move out with selectSubs...
  async function updateEmailSub (email) {
    // TODO bad name rename if you can
    let rows;

    try {
      rows = await db.all(`
      SELECT id, MAX(DateTime(timestamp))
      FROM fetches
    `);
    } catch (e) {
      assertApp(false, `Couldn't fetch most recent fetch id. Reason: ${e}`);
    }

    assertApp(
      rows.length === 1,
      'There are different recent fetches with the same timestamp',
    );

    const fetchId = rows[0].id;

    const query = await db.prepare(
      `
      UPDATE user_subscriptions
      SET fetch_id_of_last_send=?
      WHERE user_id IN (
        SELECT id 
        FROM users
        WHERE email=?
      )
      `,
      [fetchId, email],
    );

    log('Updating subscription on email', email, 'to most recent fetch_id', fetchId);
    log('Executing query', query);

    return query.all();
  }

  return {
    executeAll,
    executeRun,
    select,
    insert,
    insertDataFetch,
    insertIfNotExists,
    selectSubscriptions,
    selectRoutesFlights,
    selectWhere,
    update,
    updateWhere,
    updateEmailSub,
    dbConnect,
  };
})();
