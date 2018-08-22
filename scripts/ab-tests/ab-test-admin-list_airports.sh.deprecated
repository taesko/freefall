#!/usr/bin/env bash
if [ -z "$1" ]
  then echo "Expected 1 arg for concurrency level requests!"
  exit 1;
fi
if [ -z "$2" ];
    then
        url="http://localhost:3000"
    else
        url="$2"
fi

ab -n 2000 -c $1 -T 'application/json' -p ./request-bodies/admin-list_airports-body.json -C 'koa:sess:admin.sig=_U9pJKs2tz8PX4a39pEypsLc7dY' "$url/api"
