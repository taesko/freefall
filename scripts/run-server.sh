#!/usr/bin/env bash
if [ -z "$FREEFALL_PROFILING_ON" ]; then
    echo "$FREEFALL_PROFILING_ON"
    node /opt/freefall/server.js > $FREEFALL_STDOUT_FILE 2> $FREEFALL_STDERR_FILE
else
    echo "Profiling freefall"
    node --prof /opt/freefall/server.js > $FREEFALL_STDOUT_FILE 2> $FREEFALL_STDERR_FILE
fi
