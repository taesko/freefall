#!/usr/bin/env bash
FREEFALL_PORT=3005 \
FREEFALL_LOG_LEVEL=DEBUG \
PGUSER=freefall \
PGPASSWORD=freefall \
PGDATABASE=freefall \
DALIPECHE_ADDRESS=10.20.1.145 \
DALIPECHE_PORT=3001 \
node ./admin.js
