#!/usr/bin/env bash
ab -n 2000 -c 100 -T 'application/json' -p ./scripts/ab-tests/request-bodies/unsubscribe-body.json http://localhost:3000/
