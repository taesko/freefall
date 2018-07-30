const { Pool } = require('pg');
const log = require('./log');
const { assertApp, assertPeer } = require('./error-handling');
const { isObject } = require('lodash');

const pool = new Pool();

pool.on('error', (err, client) => {
  log.critical('Unexpected error on idle client:', client);
  log.error(err);
});

async function useClient (ctx, next) {
  const client = await pool.connect();
  log.info('Created a new client connection to database.', client);
  ctx.state.pgClient = client;

  try {
    await next();
  } finally {
    client.release();
    log.info('Released client connection', client);
  }
}

function stringifyColumns (columns) {
  if (columns == null || columns === '*') {
    return '*';
  } else {
    assertApp(columns.length > 0);
    return columns.join(', ');
  }
}

function buildWhereClause (where, startIndex = 1) {
  assertApp(isObject(where), 'buildWhereClause\'s parameter must be a hash.');
  assertApp(Number.isInteger(startIndex));

  const whereColumns = Object.entries(where)
    .map(([column, value], currentIndex) => {
      const placeholder = startIndex + currentIndex;
      return `${column}=$${placeholder}`;
    })
    .join(' AND ');
  const values = Object.values(where);

  return {
    whereClause: `WHERE ${whereColumns}`,
    values,
  };
}

function buildSetClause (setHash, startIndex = 1) {
  assertApp(isObject(setHash));
  assertApp(Number.isInteger(startIndex));

  const entries = Object.entries(setHash);
  let setClause = entries.map(entry => entry[0])
    .map((column, currentIndex) => {
      const placeholder = startIndex + currentIndex;
      return `${column}=$${placeholder}`;
    })
    .join(', ');
  setClause = `SET ${setClause}`;
  const setValues = entries.map(entry => entry[1]);

  return {
    setClause,
    setValues,
  };
}

async function executeQuery (...args) {
  log.debug('Executing query with args', args);
  return pool.query(...args);
}

async function select (table, columns = '*') {
  assertApp(
    typeof table === 'string',
    'Expected string for a name of table',
  );
  assertApp(columns === '*' || Array.isArray(columns));

  const { rows } = await executeQuery(`SELECT ${stringifyColumns(columns)} FROM ${table};`);

  assertApp(Array.isArray(rows));

  return rows;
}

async function selectWhere (table, columns, where) {
  assertApp(
    typeof table === 'string' &&
    isObject(where) &&
    'Invalid select data',
  );

  const { whereClause, values } = buildWhereClause(where);
  const query = `SELECT ${stringifyColumns(columns)} FROM ${table} ${whereClause}`;

  const { rows } = await executeQuery(
    query,
    values,
  );

  assertApp(Array.isArray(rows));

  return rows;
}

async function selectRoutesFlights (fetchId, params) {
  assertApp(
    Number.isInteger(fetchId),
    'Invalid fetch id.',
  );

  const queryParams = [fetchId];

  let query = `

      SELECT
      routes.id AS route_id,
      routes.booking_token AS booking_token,
      routes.price,
      airlines.name AS airline_name,
      airlines.logo_url AS logo_url,
      afrom.name AS afrom_name,
      afrom.id AS afrom_id,
      ato.name AS ato_name,
      ato.id AS ato_id,
      flights.dtime,
      flights.atime,
      flights.flight_number AS flight_number,
      routes_flights.is_return AS is_return
      FROM routes
      LEFT JOIN routes_flights ON routes_flights.route_id = routes.id
      LEFT JOIN flights ON routes_flights.flight_id = flights.id
      LEFT JOIN airports as afrom ON afrom.id = flights.airport_from_id
      LEFT JOIN airports as ato ON ato.id = flights.airport_to_id
      LEFT JOIN airlines ON airlines.id = flights.airline_id
      LEFT JOIN subscriptions_fetches ON routes.subscription_fetch_id=subscriptions_fetches.id
      LEFT JOIN fetches ON subscriptions_fetches.fetch_id=fetches.id
      WHERE fetches.id = $1

    `;

  if (params.price_to) {
    assertPeer(Number.isInteger(params.price_to), 'Invalid price in search request.');
    queryParams.push(params.price_to);
    query += ` AND routes.price <= $${queryParams.length} `;
  }

  // TODO finish filtration

  if (params.date_from) {
    assertPeer(typeof params.date_from === 'string', 'Invalid date_from in search request.');
    queryParams.push(params.date_from);
    query += ` AND flights.dtime >= $${queryParams.length}`;
  }

  if (params.date_to) {
    assertPeer(typeof params.date_to === 'string', 'Invalid date_to in search request.');
    queryParams.push(params.date_to);
    query += ` AND flights.atime <= $${queryParams.length}`;
  }

  query += ';';

  const { rows } = await executeQuery(query, queryParams);

  assertApp(
    Array.isArray(rows),
    'Invalid db routes and flights response.',
  );

  // rename columns to camel case because pg doesn't support case sensitivity
  const renames = {
    'route_id': 'routeId',
    'booking_token': 'bookingToken',
    'airline_name': 'airlineName',
    'logo_url': 'logoURL',
    'afrom_name': 'afromName',
    'afrom_id': 'afromId',
    'ato_name': 'atoName',
    'ato_id': 'atoId',
    'flight_number': 'flightNumber',
    'is_return': 'isReturn',
  };

  return rows.map(row => {
    for (const [oldName, newName] of Object.entries(renames)) {
      row[newName] = row[oldName];
      delete row[oldName];
    }

    row.atime = row.atime.toISOString();
    row.dtime = row.dtime.toISOString();

    return row;
  });
}

async function selectSubscriptions (airportFromId, airportToId) {
  assertApp(
    Number.isInteger(airportFromId) &&
    Number.isInteger(airportToId),
    'Invalid airport ids.',
  );

  const { rows } = await executeQuery(`
      SELECT fetches.id AS fetch_id, fetches.fetch_time as timestamp
      FROM fetches
      LEFT JOIN subscriptions_fetches ON fetches.id = subscriptions_fetches.fetch_id
      LEFT JOIN subscriptions ON subscriptions.id = subscriptions_fetches.fetch_id
      WHERE 
        subscriptions.airport_from_id = $1 AND
        subscriptions.airport_to_id = $2 AND
        fetches.fetch_time = (SELECT MAX(fetches.fetch_time) FROM fetches)
    `, [airportFromId, airportToId]);

  assertApp(
    Array.isArray(rows),
    'Invalid db select subscription response.',
    'Got: ', rows,
  );

  return rows.map(row => {
    row.fetchId = row.fetch_id;
    delete row.fetch_id;

    row.timestamp = row.timestamp.toISOString();

    return row;
  });
}

async function insert (table, data) {
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
  const rowStringified = Array(values.length)
    .fill('')
    .map((val, index) => `$${index + 1}`)
    .join(', ');
  const { rows } = await executeQuery(
    `INSERT INTO ${table} (${columnsStringified}) VALUES (${rowStringified}) RETURNING *;`,
    values,
  );

  assertApp(Array.isArray(rows), 'Incorrect db response.');

  return rows[0];
}

async function insertDataFetch (subscriptionId) {
  const { rows } = await executeQuery(
    'INSERT INTO fetches(timestamp, subscription_id) VALUES (strftime(\'%Y-%m-%dT%H:%M:%SZ\' ,\'now\'), $1);',
    [subscriptionId],
  );

  assertApp(Array.isArray(rows), 'Incorrect db response.');

  return rows[0];
}

async function insertIfNotExists (table, data, existsCheck) {
  assertApp(typeof table === 'string');
  assertApp(isObject(data));
  assertApp(isObject(existsCheck));

  const found = await selectWhere(table, Object.keys(data), existsCheck);

  assertApp(Array.isArray(found), 'Invalid db response.');

  if (found.length > 0) {
    assertApp(found.length === 1, 'Invalid db response.'); // multiple rows exist ?
    return false;
  }

  await insert(table, data);

  return true;
}

async function update (table, setHash, whereHash) {
  assertApp(
    isObject(setHash),
    `update function requires setHash to be an object. setHash=${setHash}`,
  );

  const { setClause, setValues } = buildSetClause(setHash);
  let whereClause = 'WHERE 1';
  let whereValues = [];
  if (whereHash) {
    const where = buildWhereClause(whereHash, setValues.length + 1);
    whereClause = where.whereClause;
    whereValues = where.values;
  }
  log.debug('whereValues are: ', whereValues);
  const values = [...setValues, ...whereValues];
  const query = `UPDATE ${table} ${setClause} ${whereClause} RETURNING *`;
  const { rows } = await executeQuery(query, values);

  assertApp(Array.isArray(rows));

  return rows;
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
    rows = await executeQuery(`
      SELECT id, MAX(DateTime(timestamp))
      FROM fetches
    `).rows;
  } catch (e) {
    assertApp(false, `Couldn't fetch most recent fetch id. Reason: ${e}`);
  }

  assertApp(
    Array.isArray(rows) && rows.length === 1,
    'There are different recent fetches with the same timestamp',
  );

  const fetchId = rows[0].id;

  const query = `
    UPDATE user_subscriptions
    SET fetch_id_of_last_send=$1
    WHERE user_id IN (
      SELECT id 
      FROM users
      WHERE email=$2
    )
    RETURNING *
    `;
  const values = [fetchId, email];

  log.info('Updating subscription on email', email, 'to most recent fetch_id', fetchId);

  const { rows: updatedRows } = await executeQuery(query, values);

  assertApp(Array.isArray(updatedRows) && updatedRows.length === 1);

  return updatedRows[0];
}

function dbConnect () {
  return false;
}

module.exports = {
  executeQuery,
  buildWhereClause,
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
  useClient,
  dbConnect, // TODO still used in .js scripts
};
