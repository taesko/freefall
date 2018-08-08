#!/usr/bin/env bash
if [ -z "$1" ]
  then
    echo "Expected 1 arg for concurrency level!"
    exit 1
fi
if [ -z "$2" ];
    then
        url="http://localhost:3000/"
    else
        url="$2"
fi

ab -e output.csv -n 2000 -c $1 -T 'application/json' -p ./request-bodies/search-body.json ${url}
