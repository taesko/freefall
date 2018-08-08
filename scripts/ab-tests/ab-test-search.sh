if [ -z "$1" ]
  then
    echo "Expected 1 arg for concurrency level!"
    exit 1
fi

ab -n 2000 -c $1 -T 'application/json' -p ./request-bodies/search-body.json http://localhost:3000/
