#!/usr/bin/env bash
ab -n 2000 -c 1000 -T 'application/json' -p ./scripts/ab-tests/request-bodies/search-body.json http://10.20.1.110:3000/
