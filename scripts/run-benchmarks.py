import re
import argparse
import pathlib


BODIES_DIR = pathlib.Path('./scripts/ab-tests/request-bodies')
METHOD_BODIES = {
    'search': BODIES_DIR/'search-body.json',
    'subscribe': BODIES_DIR/'subscribe-body.json',
    'unsubscribe': BODIES_DIR/'unsubscribe-body.json',
    'admin-list-airports': BODIES_DIR/'admin-list-airports-body.json'
}


def parse_ab_output(output):
    time_per_requests = re.findall('Time per request: (.*)\[ms\]')

def benchmark_search(url, n=2000, c=1000):

def main():
    parser = argparse.ArgumentParser()

    parser.add_argument('url')
    parser.add_argument('benchmark', choices=['all', ])

    args = parser.parse_args()

