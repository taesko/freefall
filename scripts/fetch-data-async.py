from urllib.parse import urlencode
import asyncio
import aiohttp
import asyncpg
import sys
import re
from datetime import date, datetime
from dateutil.relativedelta import relativedelta

ROUTES_LIMIT = 30
SERVER_TIME_FORMAT = '%Y-%m-%dT%H:%M:%SZ'
KIWI_API_DATE_FORMAT = '%d/%m/%Y'
TIMEOUT = 15

loop = None

class BaseError(Exception):
    def __init__(self, msg):
        super().__init__(msg)
        self.msg = msg
        handle_error(self.msg)


class AppError(BaseError):
    def __init__(self, msg):
        super().__init__(msg)


class PeerError(BaseError):
    def __init__(self, msg):
        super().__init__(msg)


class UserError(BaseError):
    def __init__(self, msg):
        super().__init__(msg)


def assert_app(condition, msg):
    if not condition:
        raise AppError(msg)


def assert_peer(condition, msg):
    if not condition:
        raise PeerError(msg)


def assert_user(condition, msg):
    if not condition:
        raise UserError(msg)


def handle_error(error):
    log(error)
    sys.exit()


def log(msg):
    print(msg)


async def request(http_client, URL, params=None, max_retries=5):
    assert_app(
        isinstance(http_client, aiohttp.client.ClientSession),
        'Expected http_client to be aiohttp.client.ClientSession, but was "{0}"'.format(type(http_client)))
    assert_app(
        isinstance(URL, str),
        'Expected url to be str, but was {0}, value "{1}"'.format(type(URL), URL))
    assert_app(
        params is None or isinstance(params, dict),
        'Expected params to be None or dict, but was {0}, value "{1}"'.format(type(params), params))
    assert_app(
        isinstance(max_retries, int),
        'Expected max_retries to be int, but was "{0}"'.format(type(max_retries)))

    uri = URL;

    if '?' not in URL and params is not None:
        uri += '?'

    if params is not None:
        uri += urlencode(params)

    log(uri)

    try:
        async with http_client.get(uri) as response:
            parsed = await response.json()
    except aiohttp.ClientError as e:
        raise PeerError(e) # TODO timeout

    return parsed


def assert_db_connection(conn, msg):
    assert_app(isinstance(conn, asyncpg.Connection), msg)
    assert_app(not conn.is_closed(), msg)


def stringify_columns(columns):
    assert_app(isinstance(columns, list), 'Expected argument "columns" in stringify_columns function to be list, but was {0}'.format(type(columns)))
    assert_app(len(columns) > 0, 'Expected list "columns" to have a length > 0, but length was {0}'.format(len(columns)))
    assert_app(all(isinstance(col, str) for col in columns), 'All elements in arg "columns" in stringify_columns function are required to be str.')

    return ', '.join(columns)

def to_smallest_currency_unit(quantity):
    return quantity * 100


async def select(conn, table, columns):
    assert_app(isinstance(table, str), 'Expected argument "table" in select function to be str, but was {0}'.format(type(table)))
    assert_app(isinstance(columns, list), 'Expected argument "columns" in select function to be list, but was {0}'.format(type(columns)))
    assert_db_connection(conn, 'select function called without connection to db.')

    result = await conn.fetch('SELECT {0} FROM {1};'.format(stringify_columns(columns), table))

    return result


async def select_where(conn, table, columns, where):
    assert_app(isinstance(table, str), 'Expected argument "table" in select_where function to be str, but was {0}'.format(type(table)))
    assert_app(isinstance(columns, list), 'Expected argument "columns" in select_where function to be list, but was {0}'.format(type(columns)))
    assert_app(isinstance(where, dict), 'Expected argument "where" in select_where function to be a dict, but was {0}'.format(type(where)))
    assert_app(len(where) == 1, 'Expected argument "where" in select_where function to be a dict of length=1, but length={0}'.format(len(where)))
    assert_db_connection(conn, 'select_where function called without connection to db.')

    whereCol = list(where.keys())[0]

    result = await conn.fetch('SELECT {0} FROM {1} WHERE {2} = $1;'.format(stringify_columns(columns), table, whereCol), where[whereCol])

    assert_app(isinstance(result, list), 'Expected result in select_where function to be a list, but was {0}'.format(type(result)))

    return result


async def insert(conn, table, data):
    assert_app(isinstance(table, str), 'Expected argument "table" in insert function to be str, but was {0}'.format(type(table)))
    assert_app(isinstance(data, dict), 'Expected argument "data" in insert function to be dict, but was {0}'.format(type(data)))
    assert_db_connection(conn, 'insert function called without connection to db.')

    columns = []
    values = []

    for col, val in data.items():
        columns.append(col)
        values.append(val)

    rowStringified = ', '.join(['${0}'.format(i) for i in range(1, len(columns) + 1)])

    insert_result = await conn.fetch('INSERT INTO {0} ({1}) VALUES ({2}) RETURNING *;'.format(table, stringify_columns(columns), rowStringified), *values)

    assert_app(isinstance(insert_result, list), 'Expected insert_result to be list, but was {0}'.format(type(insert_result)))
    assert_app(len(insert_result) == 1, 'Expected insert_result to have length=1, but got length={0}'.format(len(insert_result)))

    inserted_item = insert_result[0]

    assert_app(isinstance(inserted_item, asyncpg.Record), 'Expected inserted_item to be a asyncpg.Record, but was {0}'.format(type(inserted_item)))
    assert_app('id' in inserted_item, 'inserted_item does not have a key "id"')
    assert_app(isinstance(inserted_item['id'], int), 'Expected inserted_item["id"] to be an int, but was {0}'.format(type(inserted_item['id'])))

    return inserted_item


async def insert_data_fetch(conn):
    assert_db_connection(conn, 'insert_data_fetch function called without connection to db.')

    insert_result = await conn.fetch('INSERT INTO fetches(fetch_time) VALUES (now()) RETURNING id;');

    assert_app(isinstance(insert_result, list), 'Expected insert_result to be list, but was {0}'.format(type(insert_result)))
    assert_app(len(insert_result) == 1, 'Expected insert_result to have length=1, but got length={0}'.format(len(insert_result)))

    inserted_item = insert_result[0]

    assert_app(isinstance(inserted_item, asyncpg.Record), 'Expected inserted_item to be a asyncpg.Record, but was {0}'.format(type(inserted_item)))
    assert_app('id' in inserted_item, 'inserted_item does not have a key "id"')
    assert_app(isinstance(inserted_item['id'], int), 'Expected inserted_item["id"] to be an int, but was {0}'.format(type(inserted_item['id'])))

    return inserted_item['id']


async def insert_if_not_exists(conn, table, data, exists_check):
    # TODO ask if transaction needed
    assert_db_connection(conn, 'insert_if_not_exists function called without connection to db.')
    assert_app(isinstance(table, str), 'Expected argument "table" in insert_if_not_exists function to be str, but was {0}'.format(type(table)))
    assert_app(isinstance(data, dict), 'Expected argument "data" in insert_if_not_exists function to be dict, but was {0}'.format(type(data)))
    assert_app(isinstance(exists_check, dict), 'Expected argument "exists_check" in insert_if_not_exists function to be dict, but was {0}'.format(type(exists_check)))

    found = await select_where(conn, table, list(data.keys()), exists_check)

    assert_app(isinstance(found, list), 'Expected result after exist check in insert_if_not_exists function to be list, but was {0}'.format(type(found)))

    if len(found) > 0:
        assert_app(len(found) == 1, 'Expected length of found in insert_if_not_exists function to be 1, but was {0}'.format(len(found)))

        return False

    inserted = await insert(conn, table, data)

    assert_app(isinstance(inserted, asyncpg.Record), 'Expected inserted to be an asyncpg.Record, but was {0}'.format(type(inserted)))

    return True


async def get_airport_id(pool, iata_code):
    assert_app(isinstance(pool, asyncpg.pool.Pool), 'Expected pool to be asyncpg.pool.Pool, but was "{0}"'.format(type(pool)))
    assert_app(isinstance(iata_code, str), 'Expected iata_code to be a string, but was "{0}"'.format(type(iata_code)))

    try:
        conn = await pool.acquire()
        select_result = await select_where(conn, 'airports', ['id'], {
            'iata_code': iata_code
        })

        assert_app(isinstance(select_result, list), 'Expected airports select result to be a list, but was {0}'.format(type(select_result)))
        assert_app(len(select_result) == 1, 'Expected only one airports select result, but got {0}'.format(len(select_result)))
        assert_app(isinstance(select_result[0], asyncpg.Record), 'Expected element in airport select result to be asyncpg.Record, but was {0}'.format(select_result[0]))
        assert_app('id' in select_result[0].keys(), 'Key "id" not found in airport select result.')
        assert_app(isinstance(select_result[0]['id'], int), 'Expected id in airport select result element to be int, but was {0}'.format(select_result[0]['id']))

        return select_result[0]['id']
    finally:
        await pool.release(conn)


async def get_flight(pool, flight):
    assert_app(isinstance(pool, asyncpg.pool.Pool), 'Expected pool to be asyncpg.pool.Pool, but was "{0}"'.format(type(pool)))
    assert_app(isinstance(flight, dict), 'Expected flight to be a dict, but was "{0}"'.format(type(flight)))

    expect_flight_keys = ['flight_no', 'dTimeUTC', 'aTimeUTC', 'return', 'flyFrom', 'flyTo', 'airline', 'id']

    for key in expect_flight_keys:
        assert_app(key in flight, 'Key {0} not found in flight'.format(key))

    integer_keys = ['flight_no', 'dTimeUTC', 'aTimeUTC']

    for key in integer_keys:
        assert_app(isinstance(flight[key], int), 'Expected {0} in flight to be int, but was {1}'.format(key, type(flight[key])))

    string_keys = ['flyFrom', 'flyTo', 'airline', 'id']

    for key in string_keys:
        assert_app(isinstance(flight[key], str), 'Expected {0} in flight to be str, but was {1}'.format(key, type(flight[key])))

    assert_app(flight['return'] in [0, 1], 'Expected return in flight to be 0 or 1, but was {0}'.format(flight['return']))
    assert_app(flight['flyFrom'] != flight['flyTo'], 'Expected different values for flyFrom and flyTo, but got {0} and {1}'.format(flight['flyFrom'], flight['flyTo']))

    airport_codes = [
        flight['flyFrom'],
        flight['flyTo']
    ]

    airport_id_tasks = [loop.create_task(get_airport_id(pool, iata_code)) for iata_code in airport_codes]

    if len(airport_id_tasks) > 0:
        await asyncio.wait(airport_id_tasks)

    airport_ids = [task.result() for task in airport_id_tasks]

    for airport_id in airport_ids:
        assert_app(isinstance(airport_id, int), 'Expected airport_id to be int, but was "{0}"'.format(type(airport_id)))

    try:
        conn = await pool.acquire()
        airline_id_result = await select_where(conn, 'airlines', ['id'], {
            'code': flight['airline']
        })

        assert_app(isinstance(airline_id_result, list), 'Expected airline select result to be a list, but was {0}'.format(type(airline_id_result)))
        assert_app(len(airline_id_result) == 1, 'Expected only one airline select result, but got {0}'.format(len(airline_id_result)))
        assert_app(isinstance(airline_id_result[0], asyncpg.Record), 'Expected element in airline select result to be asyncpg.Record, but was {0}'.format(airline_id_result[0]))
        assert_app('id' in airline_id_result[0].keys(), 'Key "id" not found in airline id result.')
        assert_app(isinstance(airline_id_result[0]['id'], int), 'Expected id in airline select result element to be int, but was {0}'.format(airline_id_result[0]['id']))

        log('Inserting if not exists flight {0} {1} from {2} to {3} departure time {4} ...'.format(
            flight['airline'],
            flight['flight_no'],
            flight['flyFrom'],
            flight['flyTo'],
            datetime.fromtimestamp(flight['dTimeUTC'])))

        # TODO ask if transaction needed
        await insert_if_not_exists(conn, 'flights', {
            'airline_id': airline_id_result[0]['id'],
            'airport_from_id': airport_ids[0],
            'airport_to_id': airport_ids[1],
            'dtime': datetime.fromtimestamp(flight['dTimeUTC']),
            'atime': datetime.fromtimestamp(flight['aTimeUTC']),
            'flight_number': str(flight['flight_no']),
            'remote_id': flight['id']
        }, {
            'remote_id': flight['id']
        })
    #except: # TODO
    finally:
        await pool.release(conn)


async def insert_route_flight(pool, inserted_route, flight):
    assert_app(isinstance(pool, asyncpg.pool.Pool), 'Expected pool to be asyncpg.pool.Pool, but was "{0}"'.format(type(pool)))
    assert_app(isinstance(inserted_route, asyncpg.Record), 'Expected inserted_route to be asyncpg.Record, but was "{0}"'.format(type(inserted_route)))

    expect_inserted_route_int_keys = ['id']

    for key in expect_inserted_route_int_keys:
        assert_app(key in inserted_route, 'Key "{0}" not found in inserted_route'.format(key))
        assert_app(isinstance(inserted_route[key], int), 'Expected "{0}" in inserted_route to be int, but was "{1}"'.format(inserted_route[key], type(inserted_route[key])))

    assert_app(isinstance(flight, dict), 'Expected flight to be a dict, but was "{0}"'.format(type(flight)))

    expect_flight_keys = ['flight_no', 'dTimeUTC', 'return', 'flyFrom', 'flyTo', 'airline', 'id']

    for key in expect_flight_keys:
        assert_app(key in flight, 'Key {0} not found in flight'.format(key))

    integer_keys = ['flight_no', 'dTimeUTC']

    for key in integer_keys:
        assert_app(isinstance(flight[key], int), 'Expected {0} in flight to be int, but was {1}'.format(key, type(flight[key])))

    string_keys = ['flyFrom', 'flyTo', 'airline', 'id']

    for key in string_keys:
        assert_app(isinstance(flight[key], str), 'Expected {0} in flight to be str, but was {1}'.format(key, type(flight[key])))

    assert_app(flight['return'] in [0, 1], 'Expected return in flight to be 0 or 1, but was {0}'.format(flight['return']))
    assert_app(flight['flyFrom'] != flight['flyTo'], 'Expected different values for flyFrom and flyTo, but got {0} and {1}'.format(flight['flyFrom'], flight['flyTo']))

    log('Inserting route {0} flight {1} {2} from {3} to {4} departure time {5} ...'.format(
        inserted_route['id'],
        flight['airline'],
        flight['flight_no'],
        flight['flyFrom'],
        flight['flyTo'],
        datetime.fromtimestamp(flight['dTimeUTC']).strftime(SERVER_TIME_FORMAT)))

    try:
        conn = await pool.acquire()

        flight_id_results = await select_where(conn, 'flights', ['id'], {
            'remote_id': flight['id']
        })

        assert_app(isinstance(flight_id_results, list), 'Expected flight_id_results to be a list, but was {0}'.format(type(flight_id_results)))
        assert_app(len(flight_id_results) == 1, 'Expected only one flight_id_result, but got {0}'.format(len(flight_id_results)))
        assert_app(isinstance(flight_id_results[0], asyncpg.Record), 'Expected element in flight_id_results to be asyncpg.Record, but was {0}'.format(type(flight_id_results[0])))
        assert_app('id' in flight_id_results[0].keys(), 'Key "id" not found in flight_id_results element')
        assert_app(isinstance(flight_id_results[0]['id'], int), 'Flight id is not an int, but a {0}'.format(flight_id_results[0]['id']))

        await insert(conn, 'routes_flights', {
            'flight_id': flight_id_results[0]['id'],
            'route_id': inserted_route['id'],
            'is_return': bool(flight['return'])
        })
    #except: # TODO
    finally:
        await pool.release(conn)


async def insert_route(pool, route, subscription_fetch_id):
    assert_app(isinstance(pool, asyncpg.pool.Pool), 'Expected pool to be asyncpg.pool.Pool, but was "{0}"'.format(type(pool)))
    assert_app(isinstance(route, dict), 'Expected route to be a dict, but was "{0}"'.format(type(route)))

    expect_route_keys = ['booking_token', 'price', 'route']

    for key in expect_route_keys:
        assert_app(key in route, 'Key "{0}" not found in route'.format(key))

    assert_app(isinstance(route['booking_token'], str), 'Expected booking_token in route to be str, but was "{0}"'.format(type(route['booking_token'])))
    assert_app(isinstance(route['price'], int), 'Expected price in route to be int, but was "{0}"'.format(type(route['price'])))
    assert_app(isinstance(route['route'], list), 'Expected route in route to be list, but was "{0}"'.format(type(route['route'])))

    assert_app(isinstance(subscription_fetch_id, int), 'Expected subscription_fetch_id to be int, but was "{0}"'.format(type(subscription_fetch_id)))

    price_smallest_currency_unit = to_smallest_currency_unit(route['price'])

    assert_app(isinstance(price_smallest_currency_unit, int), 'Expected price_smallest_currency_unit to be int, but was "{0}"'.format(type(price_smallest_currency_unit)))

    try:
        conn = await pool.acquire()
        inserted_route = await insert(conn, 'routes', {
            'booking_token': route['booking_token'],
            'price': price_smallest_currency_unit,
            'subscription_fetch_id': subscription_fetch_id
        })

        assert_app(isinstance(inserted_route, asyncpg.Record), 'Expected inserted_route to be asyncpg.Record, but was "{0}"'.format(type(inserted_route)))

    #except: # TODO
    finally:
        await pool.release(conn)

    insert_route_flight_tasks = [loop.create_task(insert_route_flight(pool, inserted_route, flight)) for flight in route['route']]

    if len(insert_route_flight_tasks) > 0:
        await asyncio.wait(insert_route_flight_tasks)


async def get_subscription_data(pool, http_client, airport_end_points, subscription_fetch_id):
    assert_app(isinstance(pool, asyncpg.pool.Pool), 'Expected pool to be asyncpg.pool.Pool, but was "{0}"'.format(type(pool)))
    assert_app(
        isinstance(http_client, aiohttp.client.ClientSession),
        'Expected http_client to be aiohttp.client.ClientSession, but was "{0}"'.format(type(http_client)))

    assert_app(isinstance(airport_end_points, dict), 'Expected airport_end_points to be dict, but was "{0}"'.format(type(airport_end_points)))

    for label, end_point in airport_end_points.items():
        assert_app(
            isinstance(end_point, str),
            'Expected {0} to be str, but got value "{1}" of type "{2}"'.format(label, end_point, type(end_point)))

    assert_app(isinstance(subscription_fetch_id, int), 'Expected subscription_fetch_id to be int, but was "{0}"'.format(type(subscription_fetch_id)))

    offset = 0
    next_page_available = True

    query_params = {
        'flyFrom': airport_end_points['airport_from'],
        'to': airport_end_points['airport_to'],
        'dateFrom': date.today().strftime(KIWI_API_DATE_FORMAT),
        'dateTo': (date.today() + relativedelta(months=+1)).strftime(KIWI_API_DATE_FORMAT),
        'typeFlight': 'oneway',
        'partner': 'picky',
        'v': '2',
        'xml': '0',
        'locale': 'en',
        'curr': 'USD',
        'offset': offset,
        'limit': ROUTES_LIMIT,
    }

    while next_page_available:
        next_page_available = False

        flights_dict = {}
        airports_set = set()

        try:
            conn = await pool.acquire()

            log('Incrementing api_fetches_count for subscription_fetch {0}'.format(subscription_fetch_id))

            await conn.execute('''

                UPDATE subscriptions_fetches
                SET api_fetches_count = api_fetches_count + 1
                WHERE id = $1;

            ''', subscription_fetch_id)
        finally:
            await pool.release(conn)

        response = await request(http_client, 'https://api.skypicker.com/flights', query_params)
        query_params['offset'] += ROUTES_LIMIT

        assert_peer(
            isinstance(response, dict),
            'API sent invalid data response. Expected type dict but got {0}'.format(type(response)))
        expect_response_keys = ['data', 'currency', '_next']

        for key in expect_response_keys:
            assert_peer(key in response, 'Key {0} not found in response'.format(key))
        assert_peer(isinstance(response['currency'], str), 'Expected currency in response to be str, but was {0}'.format(type(response['currency'])))
        assert_peer(isinstance(response['data'], list), 'Expected data in response to be list, but was {0}'.format(type(response['data'])))

        for route in response['data']:
            assert_peer(isinstance(route, dict), 'Expected route in data to be dict, but was {0}'.format(type(route)))
            expect_route_keys = ['route', 'booking_token', 'price']

            for key in expect_route_keys:
                assert_peer(key in route, 'Key {0} not found in route'.format(key))

            assert_peer(isinstance(route['booking_token'], str), 'Expected booking_token in route to be str, but was {0}'.format(type(route['booking_token'])))
            assert_peer(isinstance(route['price'], int), 'Expected price in route to be int but was {0}'.format(type(route['price'])))
            assert_peer(isinstance(route['route'], list), 'Expected route in route to be list, but was {0}'.format(type(route['route'])))

            for flight in route['route']:
                assert_peer(isinstance(flight, dict), 'Expected flight in route item to be dict, but was {0}'.format(type(flight)))
                expect_flight_keys = ['flight_no', 'aTimeUTC', 'dTimeUTC', 'return', 'flyFrom', 'flyTo', 'airline', 'id']

                for key in expect_flight_keys:
                    assert_peer(key in flight, 'Key {0} not found in flight'.format(key))

                integer_keys = ['flight_no', 'aTimeUTC', 'dTimeUTC']

                for key in integer_keys:
                    assert_peer(isinstance(flight[key], int), 'Expected {0} in flight to be int, but was {1}'.format(key, type(flight[key])))

                string_keys = ['flyFrom', 'flyTo', 'airline', 'id']

                for key in string_keys:
                    assert_peer(isinstance(flight[key], str), 'Expected {0} in flight to be str, but was {1}'.format(key, type(flight[key])))

                assert_peer(flight['return'] in [0, 1], 'Expected return in flight to be 0 or 1, but was {0}'.format(flight['return']))
                assert_peer(flight['flyFrom'] != flight['flyTo'], 'Expected different values for flyFrom and flyTo, but got {0} and {1}'.format(flight['flyFrom'], flight['flyTo']))

                if flight['id'] not in flights_dict:
                    flights_dict[flight['id']] = flight
                airports_set.add(flight['flyFrom'])
                airports_set.add(flight['flyTo'])

        log('From {0} to {1} (offset: {2}): data for {3} airports. Getting data...'.format(
            airport_end_points['airport_from'],
            airport_end_points['airport_to'],
            offset,
            len(airports_set)))

        get_airport_if_not_exists_tasks = [loop.create_task(get_airport_if_not_exists(pool, http_client, airport_iata_code)) for airport_iata_code in airports_set]

        if len(get_airport_if_not_exists_tasks) > 0:
            await asyncio.wait(get_airport_if_not_exists_tasks)

        log('Finished getting data for airports.')
        log('From {0} to {1} (offset: {2}): data for {3} flights. Getting data...'.format(
            airport_end_points['airport_from'],
            airport_end_points['airport_to'],
            offset,
            len(flights_dict)))

        get_flight_tasks = [loop.create_task(get_flight(pool, flight)) for flight in flights_dict.values()]

        if len(get_flight_tasks) > 0:
            await asyncio.wait(get_flight_tasks)

        log('Finished getting data for flights')
        log('From {0} to {1} (offset: {2}): data for {3} routes. Getting data...'.format(
            airport_end_points['airport_from'],
            airport_end_points['airport_to'],
            offset,
            len(response['data'])))

        insert_route_tasks = [loop.create_task(insert_route(pool, route, subscription_fetch_id)) for route in response['data']]

        if len(insert_route_tasks) > 0:
            await asyncio.wait(insert_route_tasks)

        if isinstance(response['_next'], str):
            next_page_available = True


async def get_airport_if_not_exists(pool, http_client, iata_code):
    assert_app(isinstance(pool, asyncpg.pool.Pool), 'Expected pool to be asyncpg.pool.Pool, but was "{0}"'.format(type(pool)))
    # TODO ask if transaction here is necessary
    assert_app(
        isinstance(http_client, aiohttp.client.ClientSession),
        'Expected http_client to be aiohttp.client.ClientSession, but was "{0}"'.format(type(http_client)))
    assert_app(isinstance(iata_code, str), 'Expected iata_code to be str, but was "{0}"'.format(type(iata_code)))

    try:
        conn = await pool.acquire()
        airports = await select_where(conn, 'airports', ['id'], {
            'iata_code': iata_code
        })

        assert_app(isinstance(airports, list), 'Expected array of airports from database but got {0}'.format(type(airports)))

        if len(airports) > 0:
            assert_app(len(airports) == 1, 'Expected one airport, but got {0}'.format(len(airports)))
            assert_app(isinstance(airports[0], asyncpg.Record), 'Expected airport data to be asyncpg.Record, but got {0}'.format(type(airports[0])))
            assert_app('id' in airports[0].keys(), 'Key "id" not found in dict airports[0]')
            assert_app(
                isinstance(airports[0]['id'], int),
                'Expected id of airport data to be int, but got {0}'.format(type(airports[0]['id'])))

            return airports[0]['id']

        response = await request(http_client, 'https://api.skypicker.com/locations', {
            'term': iata_code,
            'locale': 'en-US',
            'location_types': 'airport',
            'limit': 1
        })

        assert_peer(isinstance(response, dict), 'Expected airports response to be dict, but was {0}'.format(type(response)))
        assert_peer('locations' in response, 'Key "locations" not found in dict airports response')
        assert_peer(isinstance(response['locations'], list), 'Expected airports["locations"] to be list, but was {0}'.format(type(response['locations'])))
        assert_peer(len(response['locations']) == 1, 'Expected only one location found for airport search but got {0}'.format(len(response['locations'])))
        assert_peer(isinstance(response['locations'][0], dict), 'Expected location to be a dict, but was {0}'.format(type(response['locations'][0])))

        location = response['locations'][0]
        expect_location_keys = ['code', 'name']

        for key in expect_location_keys:
            assert_peer(key in location, 'Key {0} not found in location')
            assert_peer(isinstance(location[key], str), 'Expected location["{0}"] to be str, but was {1}'.format(key, type(location[key])))

        inserted_airport = await insert(conn, 'airports', {
            'iata_code': location['code'],
            'name': '{0}, {1}'.format(location['name'], location['code'])
        })

        assert_app(isinstance(inserted_airport, asyncpg.Record), 'Expected inserted_airport to be asyncpg.Record, but was "{0}"'.format(type(inserted_airport)))

        return inserted_airport
    #except: # TODO
    finally:
        await pool.release(conn)


async def charge_fetch_tax(conn, subscription_fetch, fetch_tax):
    assert_db_connection(conn, 'charge_fetch_tax called without connection to db')
    assert_app(conn.is_in_transaction(), 'Connection not in transaction, in charge_fetch_tax')
    assert_app(
        isinstance(subscription_fetch, asyncpg.Record),
        'Expected subscription_fetch to be asyncpg.Record, but was "{0}"'.format(type(subscription_fetch)))
    assert_app(isinstance(fetch_tax, int), 'Expected fetch_tax to be int, but was "{0}"'.format(type(fetch_tax)))

    expect_subscription_fetch_keys = ['id', 'subscription_id']

    for key in expect_subscription_fetch_keys:
        assert_app(key in subscription_fetch.keys(), 'Key "{0}" not found in subscription_fetch'.format(key))
        assert_app(
            isinstance(subscription_fetch[key], int),
            'Expected subscription_fetch[{0}] "{1}" to be int, but was "{2}"'.format(key, subscription_fetch[key], type(subscription_fetch[key])))

    log('Beginning transaction. Charging fetch_tax {0} for subscription_id {1}'.format(fetch_tax, subscription_fetch['subscription_id']))

    await conn.execute('''

        UPDATE users_subscriptions
        SET active = FALSE
        WHERE
        (
            user_id IN (
                SELECT id
                FROM users
                WHERE credits < $1
            ) OR
            date_to < now()
        );

    ''', fetch_tax)

    users = await conn.fetch('''

        UPDATE users
        SET credits = credits - $1
        WHERE id IN (
            SELECT user_id
            FROM users_subscriptions
            WHERE
                active = TRUE AND
                subscription_id = $2
        )
        RETURNING *;

    ''', fetch_tax, subscription_fetch['subscription_id'])

    assert_app(isinstance(users, list), 'Expected users to be list, but was {0}'.format(type(users)))

    log('Charged {0} users with fetch_tax {1} for subscription_id {2}'.format(len(users), fetch_tax, subscription_fetch['subscription_id']))

    for user in users:
        assert_app(isinstance(user, asyncpg.Record), 'Expected user to be asyncpg.Record, but was {0}'.format(type(user)))

        expect_user_keys = ['id']

        for key in expect_user_keys:
            assert_app(key in user, 'Key "{0}" not found in user'.format(key))

        log('Saving account transfer transfer_amount={0} for user_id={1}'.format(fetch_tax * -1, user['id']))

        insert_result = await conn.fetch('''

            INSERT INTO account_transfers
                (user_id, transfer_amount, transferred_at)
            VALUES
                ($1, $2, now())
            RETURNING *;

        ''', user['id'], fetch_tax * -1)

        assert_app(isinstance(insert_result, list), 'Expected insert_result to be a list, but was {0}'.format(type(insert_result)))
        assert_app(len(insert_result) == 1, 'Expected insert_result to have length=1, but got length={0}'.format(len(insert_result)))

        inserted_account_transfer = insert_result[0]

        assert_app(isinstance(inserted_account_transfer, asyncpg.Record), 'Expected inserted_account_transfer to be asyncpg.Record, but was {0}'.format(type(inserted_account_transfer)))

        expect_inserted_account_transfer_keys = ['id']

        for key in expect_inserted_account_transfer_keys:
            assert_app(key in inserted_account_transfer, 'Key "{0}" not found in inserted_account_transfer')

        log('Saving account transfer with id={0} as subscription-related fetch')

        await conn.execute('''

            INSERT INTO subscriptions_fetches_account_transfers
                (account_transfer_id, subscription_fetch_id)
            VALUES
                ($1, $2);

        ''', inserted_account_transfer['id'], subscription_fetch['id'])

    log('End of transaction. Charged fetch taxes for subscription_id {0}'.format(subscription_fetch['subscription_id']))


async def insert_airline(pool, airline):
    assert_app(isinstance(pool, asyncpg.pool.Pool), 'Expected pool to be asyncpg.pool.Pool, but was "{0}"'.format(type(pool)))
    # TODO ask if transaction is necessary
    try:
        conn = await pool.acquire()
        assert_peer(
            isinstance(airline, dict),
            'Expected airline to be a dict, but was "{0}"'.format(type(airline)))

        expect_airline_keys = ['id', 'name']

        for key in expect_airline_keys:
            assert_peer(key in airline, 'Key "{0}" not found in airline'.format(key))
            assert_peer(
                isinstance(airline[key], str),
                'Expected airline[{0}] "{1}" to be str, but was "{2}"'.format(key, airline[key], type(airline[key])))

        # check for FakeAirline:
        if airline['id'] == '__':
            return;

        iata_code_pattern = re.compile('^[A-Z0-9]+$')

        assert_peer(iata_code_pattern.match(airline['id']), 'Invalid iata code "{0}"'.format(airline['id']))

        log('Inserting if not exists airline {0} ({1})...'.format(airline['name'], airline['id']))

        await insert_if_not_exists(conn, 'airlines', {
            'name': '{0} {1}'.format(airline['name'], airline['id']),
            'code': airline['id'],
            'logo_url': 'https://images.kiwi.com/airlines/64/{0}.png'.format(airline['id'])
        }, {
            'code': airline['id']
        })
    #except: # TODO
    finally:
        await pool.release(conn)


async def start():
    fetch_tax = 500 # cents

    try:
        pool = await asyncpg.create_pool(database='freefall', user='freefall', password='freefall')

        async with aiohttp.ClientSession(conn_timeout=15) as http_client:
            airlines = await request(http_client, 'https://api.skypicker.com/airlines')

            assert_peer(
                isinstance(airlines, list),
                'Expected airlines to be a list, but was "{0}"'.format(type(airlines)))

            insert_airline_tasks = [loop.create_task(insert_airline(pool, airline)) for airline in airlines]

            if len(insert_airline_tasks) > 0:
                await asyncio.wait(insert_airline_tasks)

            try:
                conn = await pool.acquire()
                subscriptions = await select(conn, 'subscriptions', ['id', 'airport_from_id', 'airport_to_id'])

                assert_app(
                    isinstance(subscriptions, list),
                    'Expected subscriptions to be a list, but was "{0}"'.format(type(subscriptions)))

                fetch_id = await insert_data_fetch(conn)

                for sub in subscriptions:
                    assert_app(
                        isinstance(sub, asyncpg.Record),
                        'Expected subscription to be asyncpg.Record, but was "{0}"'.format(type(sub)))

                    expect_subscription_keys = ['id', 'airport_from_id', 'airport_to_id']

                    for key in expect_subscription_keys:
                        assert_app(key in sub.keys(), 'Key "{0}" not found in subscription'.format(key))
                        assert_app(
                            isinstance(sub[key], int),
                            'Expected sub[{0}] "{1}" to be int, but was "{2}"'.format(key, sub[key], type(sub[key])))

                    subscription_fetch = await insert(conn, 'subscriptions_fetches', {
                        'subscription_id': sub['id'],
                        'fetch_id': fetch_id
                    });

                    assert_app(isinstance(subscription_fetch, asyncpg.Record), 'Expected subscription_fetch to be a asyncpg.Record, but was {0}'.format(type(subscription_fetch)))
                    async with conn.transaction():
                        await charge_fetch_tax(conn, subscription_fetch, fetch_tax)

                    # TODO take airport_from and airport_to in paralel
                    airport_from = await select_where(conn, 'airports', ['id', 'iata_code', 'name'], {
                        'id': sub['airport_from_id']
                    })
                    airport_to = await select_where(conn, 'airports', ['id', 'iata_code', 'name'], {
                        'id': sub['airport_to_id']
                    })

                    assert_app(isinstance(airport_from, list), 'Expected airport_from to be a list, but was {0}'.format(type(airport_from)))
                    assert_app(len(airport_from) == 1, 'Expected the length of airport_from list to be 1, but was {0}'.format(len(airport_from)))
                    assert_app('iata_code' in airport_from[0], 'Key "iata_code" not found in airport_from[0]')
                    assert_app(isinstance(airport_from[0]['iata_code'], str), 'Expected airport_from[0]["iata_code"] to be str, but was {0}'.format(type(airport_from[0]['iata_code'])))
                    assert_app(isinstance(airport_to, list), 'Expected airport_to to be a list, but was {0}'.format(type(airport_to)))
                    assert_app(len(airport_to) == 1, 'Expected the length of airport_to list to be 1, but was {0}'.format(len(airport_to)))
                    assert_app('iata_code' in airport_to[0], 'Key "iata_code" not found in airport_to[0]')
                    assert_app(isinstance(airport_to[0]['iata_code'], str), 'Expected airport_to[0]["iata_code"] to be str, but was {0}'.format(type(airport_to[0]['iata_code'])))

                    await get_subscription_data(
                        pool,
                        http_client,
                        {
                            'airport_from': airport_from[0]['iata_code'],
                            'airport_to': airport_to[0]['iata_code']
                        },
                        subscription_fetch['id']
                    )

            #except: # TODO
            finally:
                await pool.release(conn)

            log('Done.')
    finally:
        await pool.close()


try:
    loop = asyncio.get_event_loop()
    loop.run_until_complete(start())
finally:
    loop.close()
