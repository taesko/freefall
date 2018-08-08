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

cookie='koa:sess:admin=eyJ1c2VySUQiOjEsIl9leHBpcmUiOjE1MzM3OTkyOTQzMjUsIl9tYXhBZ2UiOjg2NDAwMDAwfQ==; koa:sess:admin.sig=_U9pJKs2tz8PX4a39pEypsLc7dY'

ab -n 2000 -c $1 -C ${cookie} "$url/subscriptions"
