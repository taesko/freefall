#!/usr/bin/env bash

/usr/bin/node /opt/freefall/dalipeche-proxy.js > /opt/freefall/logs/dalipeche_proxy_stdout.log 2> /opt/freefall/logs/dalipeche_proxy_stderr.log
echo "ERROR: node server exited"
exit 1