if [ -z "$1" ]
  then
    echo "Expected 1 arg for concurrency level!"
    exit 1
fi

ab -n 2000 -c $1 http://localhost:3000/
