#!/usr/bin/python3
import argparse
import datetime
import requests
import itertools

UNIQUE_ID_ITER = itertools.count(1)
TODAY = datetime.date.today()
FUTURE = datetime.date.today().replace(month=TODAY.month + 1 % 12)


class PeerError(Exception):
    def __init__(self, msg, code):
        super().__init__(msg)

        self.code = code


def assert_peer(condition, msg, code):
    if not condition:
        raise PeerError(msg, code)


def call_method(host, port, method, params):
    payload = dict(
        id=next(UNIQUE_ID_ITER),
        method=method,
        params=params,
        jsonrpc='2.0',
    )
    url = 'http://{host}:{port}/'.format(host=host, port=port)

    print('Sending {method} request to {host}:{port} with params: \n\t{params}'.format(**locals()))

    response = requests.post(url, json=payload).json()

    try:
        if 'error' in response:
            print('{} failed. Error object found in response:\n\t{}'.format(method, response['error']))
            raise PeerError('Status code is not ok', 'METHOD_FAILED')
        elif 'status_code' in response['result'] and '2000' <= response['result']['status_code'] < '3000':
            print('{} failed. status_code={}'.format(method, response['result']['status_code']))
            raise PeerError('Status code is not ok', 'METHOD_FAILED')
    except KeyError:
        print('{} failed. Response has missing properties. Response:\n\t{}'.format(method, response))
        print('Cannot fill database with subscriptions. Exiting...')
        raise PeerError('Server did not send a proper response', 'BAD_SERVER_RESPONSE')

    return response


def list_airports(host, port, api_key):
    return call_method(
        host=host,
        port=port,
        method='list_airports',
        params=dict(api_key=api_key, v='2.0')
    )


def subscribe(host, port, api_key, fly_from, fly_to, date_from, date_to):
    return call_method(
        host=host,
        port=port,
        method='subscribe',
        params=dict(
            v='2.0',
            api_key=api_key,
            fly_from=fly_from,
            fly_to=fly_to,
            date_from=date_from,
            date_to=date_to
        )
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('api_key', help='api key to use when subscribing.')
    parser.add_argument('-m', '--max-count', help='how many subscriptions to create.', default=1000)
    parser.add_argument('-H', '--host', help='host of the freefall server.', default='localhost')
    parser.add_argument('-P', '--port', help='port of the freefall server.', default=3000)

    args = parser.parse_args()

    try:
        response = list_airports(host=args.host, port=args.port, api_key=args.api_key)
    except PeerError:
        print('Cannot fill database with subscriptions. Exiting')
        return 1

    airports = response['result']['airports']
    airport_ids = (a['id'] for a in airports)
    failed_count = 0

    for index, values in enumerate(itertools.combinations(airport_ids, 2)):
        fly_from, fly_to = values
        if index > args.max_count:
            break

        try:
            subscribe(
                host=args.host,
                port=args.port,
                api_key=args.api_key,
                fly_from=fly_from,
                fly_to=fly_to,
                date_from=str(TODAY),
                date_to=str(FUTURE)
            )
        except PeerError as e:
            if e.code == 'METHOD_FAILED':
                failed_count += 1
                continue
            else:
                raise

        print('Successfully subscribed to airports', fly_from, fly_to)

    print('Failed requests - ', failed_count)


if __name__ == '__main__':
    main()
