const {
  isObject,
  isFunction,
} = require('lodash');
const { Pool } = require('pg');

const log = require('./log');
const profiling = require('./profiling');
const { assertApp, assertPeer } = require('./error-handling');

const pool = new Pool();

pool.on('error', (err, client) => {
  log.critical('Unexpected error on idle client:', client);
  log.error(err);
});

// eslint-disable-next-line prefer-arrow-callback
const client = profiling.profileAsync(async function client (ctx, next) {
  const pgClient = await pool.connect();
  // TODO find out a client id and log it
  log.info('Created a new client connection to database.');

  // TODO make this a class so it can be checked with isinstance ?
  ctx.state.dbClient = wrapPgClient(pgClient);

  // TODO is client.on error needed ?
  try {
    await next();
  } finally {
    pgClient.release();
    log.info('Released client connection');
  }
});
log.info('Profiled client function is', client);

function wrapPgClient (client) {
  return {
    executeQuery: executeQuery(client),
    select: select(client),
    insert: insert(client),
    insertDataFetch: insertDataFetch(client),
    insertIfNotExists: insertIfNotExists(client),
    selectSubscriptions: selectSubscriptions(client),
    selectRoutesFlights: selectRoutesFlights(client),
    selectAccountTransfersUsers: selectAccountTransfersUsers(client),
    selectWhere: selectWhere(client),
    update: update(client),
    updateWhere: updateWhere(client),
    updateEmailSub: updateEmailSub(client),
  };
}

async function session (ctx, next) {
  const client = ctx.state.dbClient;
  assertApp(client != null, 'Cannot begin transaction - ctx.state.dbClient is null');

  await client.executeQuery('BEGIN');
  ctx.state.commitDB = false;
  try {
    await next();
    if (ctx.state.commitDB) {
      await client.executeQuery('COMMIT');
    } else {
      await client.executeQuery('ROLLBACK');
    }
  } catch (e) {
    await client.executeQuery('ROLLBACK');
    throw e;
  }
}

/*
* Replaces each named parameter(e.g. $email) in the query with an appropriate
* postgres bind parameter (e.g. $1) and returns the new query and an array
* of values that can be passed to dbClient.executeQuery.
*
* The only named parameters that are processed are those that are properties of the
* <parameters> argument.
*
* The <offset> argument can be provided to replace with bind parameters that begin
* after that number.
 */
function processNamedParameters (query, parameters, offset = 0) {
  assertApp(typeof query === 'string');
  assertApp(isObject(parameters));
  assertApp(Number.isInteger(offset));

  const replacedParams = {};
  const regexPattern = Object.keys(parameters).map(key => {
    assertApp(!key.startsWith('$'), 'Parameter properties cannot start with $');
    return `\\$${key}`;
  })
    .join('|');
  const regex = new RegExp(regexPattern, 'g');
  let placeholderIndex = offset;

  log.info('Processing regex of query is', regex);
  log.debug(`Original query string is ${query}`);

  const processedQuery = query.replace(regex, matched => {
    matched = matched.slice(1);
    const alreadyMatched = replacedParams[matched];

    let placeholder;

    if (alreadyMatched != null) {
      placeholder = `$${alreadyMatched.placeholderIndex}`;
    } else {
      placeholderIndex++;

      const value = parameters[matched];

      replacedParams[matched] = { value, placeholderIndex };
      placeholder = `$${placeholderIndex}`;
    }

    return placeholder;
  });

  log.info(`Processed named parameters are ${Object.keys(replacedParams).join(',')}`);
  const processedValues = Array(placeholderIndex - offset).fill(null);

  for (const { placeholderIndex, value } of Object.values(replacedParams)) {
    processedValues[placeholderIndex - offset - 1] = value;
  }

  return { query: processedQuery, values: processedValues };
}

function stringifyColumns (columns) {
  // TODO fix escaping of columns
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

/*
* Builds the columns of a SELECT statement that can be used with a GROUP BY.
*
* The <columnCallbacks> argument is required to be a hash from column names to
* functions with signature isGroupedBy => {}. The functions should return null
* for columns that will be dropped and otherwise a string which will be the expression
* in the select.
 */
function buildGroupableSelect (columnCallbacks, groupBy) {
  assertApp(isObject(columnCallbacks));
  assertApp(Array.isArray(columnCallbacks));

  const droppedColumns = [];
  const columns = Object.entries(columnCallbacks)
    .map(([column, func]) => {
      const result = func(groupBy.includes(column));

      assertApp(typeof result === 'string', `got ${func}`);

      return result;
    })
    .filter(columnString => {
      const dropped = columnString != null;

      if (dropped) {
        droppedColumns.push(dropped);
      }

      return dropped;
    })
    .join(',\n');

  return { columns, droppedColumns };
}

function buildGroupingParams (selectColumns, groupings) {
  // assert correct format
  for (const selectColumn of selectColumns) {
    assertApp(typeof selectColumn.isSet === 'boolean');
    assertApp(typeof selectColumn.isGroupable === 'boolean');
    assertApp(typeof selectColumn.isAggregatable === 'boolean');
    assertApp(!(selectColumn.isGroupable && selectColumn.isAggregatable));

    if (selectColumn.isSet) {
      assertApp(Array.isArray(selectColumn.set));

      for (const column of selectColumn.set) {
        assertApp(column.table === null || typeof column.table === 'string');
        assertApp(typeof column.column === 'string');
        assertApp(column.alias === null || typeof column.alias === 'string');
        assertApp(column.transform === null || isFunction(column.transform));
      }
    } else {
      assertApp(selectColumn.table === null || typeof selectColumn.table === 'string');
      assertApp(typeof selectColumn.column === 'string');
      assertApp(selectColumn.alias === null || typeof selectColumn.alias === 'string');
      assertApp(
        selectColumn.transform === null ||
        isFunction(selectColumn.transform)
      );
    }

    if (selectColumn.isGroupable) {
      assertApp(typeof selectColumn.groupingsSettingName === 'string');
    }

    if (selectColumn.isAggregatable) {
      assertApp(typeof selectColumn.aggregateFunction === 'string');
    }
  }

  const querySelectColumns = [];
  const queryGroupBy = [];

  const areGroupings = Object.values(groupings)
    .some((grouping) => grouping != null);

  for (const selectColumn of selectColumns) {
    const columns = [];

    if (selectColumn.isSet) {
      const { set, ...setOptions } = selectColumn;

      columns.push(...selectColumn.set.map(column => ({
        ...column,
        ...setOptions,
      })));
    } else {
      columns.push(selectColumn);
    }

    for (const column of columns) {
      let querySelectColumn = '';
      const isNullColumn = areGroupings &&
        !column.isAggregatable &&
        (
          !column.isGroupable ||
          groupings[column.groupingsSettingName] == null
        );

      if (isNullColumn) {
        querySelectColumn = 'NULL';
      } else {
        let escapedColumn;

        if (column.table) {
          escapedColumn = `"${column.table}"."${column.column}"`;
        } else {
          escapedColumn = `"${column.column}"`;
        }

        if (column.transform != null) {
          querySelectColumn = column.transform(
            escapedColumn,
            groupings[column.groupingsSettingName]
          );
        } else {
          querySelectColumn = escapedColumn;
        }

        if (areGroupings) {
          assertApp(!(column.isAggregatable && column.isGroupable), 'Column can not be both groupable and aggregatable!');

          if (column.isAggregatable) {
            querySelectColumn = `"${column.aggregateFunction}"(${querySelectColumn})`;
          } else {
            queryGroupBy.push(querySelectColumns.length + 1);
          }
        }

        if (column.alias != null) {
          querySelectColumn += ` AS "${column.alias}"`;
        }
      }

      querySelectColumns.push(querySelectColumn);
    }
  }

  return {
    selectColumnsPart: querySelectColumns.join(','),
    groupColumns: queryGroupBy.join(','),
  };
}

const _executeQuery = profiling.profileAsync(
  async (client, query, values) => {
    // TODO is it possible for a client to be released by pg due to error and not be handled ?
    assertApp(typeof query === 'string');
    assertApp(values == null || Array.isArray(values));

    // TODO find out how to log client
    log.debug('Executing query', query, 'replaced with values: ', values);
    return client.query(query, values);
  },
  { name: '_executeQuery' },
);
const executeQuery = (client) => async (query, values) => {
  return _executeQuery(client, query, values);
};

const select = (client) => async (table, columns = '*') => {
  assertApp(
    typeof table === 'string',
    'Expected string for a name of table',
  );
  assertApp(columns === '*' || Array.isArray(columns));

  const { rows } = await executeQuery(client)(`SELECT ${stringifyColumns(columns)} FROM ${table};`);

  assertApp(Array.isArray(rows));

  return rows;
};

const selectWhere = (client) => async (table, columns, where) => {
  assertApp(
    typeof table === 'string' &&
    isObject(where) &&
    'Invalid select data',
  );

  const { whereClause, values } = buildWhereClause(where);
  const query = `SELECT ${stringifyColumns(columns)} FROM ${table} ${whereClause}`;

  const { rows } = await executeQuery(client)(
    query,
    values,
  );

  assertApp(Array.isArray(rows));

  return rows;
};

const selectRoutesFlights = (client) => async (fetchId, params) => {
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

  const { rows } = await executeQuery(client)(query, queryParams);

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
};

const selectSubscriptions = (client) => async (airportFromId, airportToId) => {
  assertApp(
    Number.isInteger(airportFromId) &&
    Number.isInteger(airportToId),
    'Invalid airport ids.',
  );

  const { rows } = await executeQuery(client)(
    `
      SELECT fetches.id AS fetch_id, fetches.fetch_time as timestamp
      FROM subscriptions_fetches
      LEFT JOIN fetches ON fetches.id = subscriptions_fetches.fetch_id
      LEFT JOIN subscriptions ON subscriptions.id = subscriptions_fetches.subscription_id
      WHERE
        subscriptions.airport_from_id = $1 AND
        subscriptions.airport_to_id = $2 AND
        fetches.fetch_time = (SELECT MAX(fetches.fetch_time) FROM fetches);
    `,
    [airportFromId, airportToId],
  );

  assertApp(
    Array.isArray(rows),
    `Invalid db select subscription response. Got ${typeof rows} ${rows}`,
  );

  return rows.map(row => {
    row.fetchId = row.fetch_id;
    delete row.fetch_id;

    row.timestamp = row.timestamp.toISOString();

    return row;
  });
};

const selectAccountTransfersUsers = (client) => async () => {
  const selectResult = await executeQuery(client)(
    `
    SELECT
      account_transfers.id AS account_transfer_id,
      transfer_amount,
      transferred_at,
      account_transfers.user_id AS account_owner_id,
      u1.email AS account_owner_email,
      u2.id AS user_transferrer_id,
      u2.email AS user_transferrer_email,
      a1.name AS user_subscr_airport_from_name,
      a2.name AS user_subscr_airport_to_name,
      users_subscriptions.date_from AS user_subscr_date_from,
      users_subscriptions.date_from AS user_subscr_date_to,
      a3.name AS subscr_airport_from_name,
      a4.name AS subscr_airport_to_name,
      fetch_time
    FROM account_transfers
    LEFT JOIN users u1
    ON account_transfers.user_id = u1.id
    LEFT JOIN user_subscription_account_transfers
    ON user_subscription_account_transfers.account_transfer_id = account_transfers.id
    LEFT JOIN subscriptions_fetches_account_transfers
    ON subscriptions_fetches_account_transfers.account_transfer_id = account_transfers.id
    LEFT JOIN account_transfers_by_admin
    ON account_transfers_by_admin.account_transfer_id = account_transfers.id
    LEFT JOIN users u2
    ON u2.id = account_transfers_by_admin.admin_user_id
    LEFT JOIN users_subscriptions
    ON user_subscription_account_transfers.user_subscription_id = users_subscriptions.id
    LEFT JOIN subscriptions s1
    ON users_subscriptions.subscription_id = s1.id
    LEFT JOIN airports a1
    ON s1.airport_from_id = a1.id
    LEFT JOIN airports a2
    ON s1.airport_to_id = a2.id
    LEFT JOIN subscriptions_fetches
    ON subscriptions_fetches_account_transfers.subscription_fetch_id = subscriptions_fetches.id
    LEFT JOIN subscriptions s2
    ON subscriptions_fetches.subscription_id = s2.id
    LEFT JOIN airports a3
    ON s2.airport_from_id = a3.id
    LEFT JOIN airports a4
    ON s2.airport_to_id = a4.id
    LEFT JOIN fetches
    ON subscriptions_fetches.fetch_id = fetches.id
    ORDER BY account_transfer_id;
  `);

  assertApp(isObject(selectResult),
    `Expected selectResult to be an object, but was ${typeof selectResult}`,
  );
  assertApp(Array.isArray(selectResult.rows),
    `Expected selectResult.rows to be array, but was ${typeof selectResult.rows}`,
  );

  return selectResult.rows;
};

const insert = (client) => async (table, data) => {
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
  const { rows } = await executeQuery(client)(
    `INSERT INTO ${table} (${columnsStringified}) VALUES (${rowStringified}) RETURNING *;`,
    values,
  );

  assertApp(Array.isArray(rows), 'Incorrect db response.');

  return rows[0];
};

const insertDataFetch = (client) => async (subscriptionId) => {
  const { rows } = await executeQuery(client)(
    'INSERT INTO fetches(timestamp, subscription_id) VALUES (strftime(\'%Y-%m-%dT%H:%M:%SZ\' ,\'now\'), $1);',
    [subscriptionId],
  );

  assertApp(Array.isArray(rows), 'Incorrect db response.');

  return rows[0];
};

const insertIfNotExists = (client) => async (table, data, existsCheck) => {
  assertApp(typeof table === 'string');
  assertApp(isObject(data));
  assertApp(isObject(existsCheck));

  const found = await selectWhere(client)(
    table,
    Object.keys(data),
    existsCheck,
  );

  assertApp(Array.isArray(found), 'Invalid db response.');

  if (found.length > 0) {
    assertApp(found.length === 1, 'Invalid db response.'); // multiple rows exist ?
    return false;
  }

  await insert(table, data);

  return true;
};

const update = (client) => async (table, setHash, whereHash) => {
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
  const values = [...setValues, ...whereValues];
  const query = `UPDATE ${table} ${setClause} ${whereClause} RETURNING *`;
  const { rows } = await executeQuery(client)(query, values);

  assertApp(Array.isArray(rows));

  return rows;
};

const updateWhere = (client) => async (table, setHash, whereHash) => {
  assertApp(
    isObject(setHash) && isObject(whereHash),
    `updateWhere function requires setHash and whereHash parameters to be objects. setHash=${setHash} whereHash=${whereHash}`,
  );

  return update(client)(table, setHash, whereHash);
};

// TODO move out with selectSubs...
const updateEmailSub = (client) => async (email) => {
  // TODO bad name rename if you can
  let rows;

  try {
    rows = await executeQuery(client)(
      `
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

  const { rows: updatedRows } = await executeQuery(client, query, values);

  assertApp(Array.isArray(updatedRows) && updatedRows.length === 1);

  return updatedRows[0];
};

module.exports = {
  // executeQuery,
  // buildWhereClause,
  // select,
  // insert,
  // insertDataFetch,
  // insertIfNotExists,
  // selectSubscriptions,
  // selectRoutesFlights,
  // selectAccountTransfersUsers,
  // selectWhere,
  // update,
  // updateWhere,
  // updateEmailSub,
  client,
  session,
  pool,
  wrapPgClient,
  processNamedParameters,
  buildGroupableSelect,
  buildGroupingParams,
};
