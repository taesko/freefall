#!/usr/bin/env bash
PGUSER=freefall \
PGPASSWORD=freefall \
PGDATABASE=freefall \
FREEFALL_EMAIL=freefall.subscriptions \
FREEFALL_PASSWORD=onetosix \
node ./scripts/send-mail.js
