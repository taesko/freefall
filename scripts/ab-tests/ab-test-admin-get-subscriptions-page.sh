if [ -z "$1" ]
  then
    echo "Expected 1 arg for concurrency level!"
    exit 1
fi

ab -n 2000 -c $1 -C 'koa:sess:admin=eyJ1c2VySUQiOjEsIl9leHBpcmUiOjE1MzM3OTkyOTQzMjUsIl9tYXhBZ2UiOjg2NDAwMDAwfQ==; koa:sess:admin.sig=_U9pJKs2tz8PX4a39pEypsLc7dY' http://localhost:3001/subscriptions
