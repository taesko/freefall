#!/usr/bin/env bash
if [ -z "$1" ]; then
    echo "Expected 1 arg for concurrency level!"
    exit 10
fi

if [ -z "$2" ]; then
    echo "Expected a second argument to specify the output directory of the tests."
    exit 20
else
    if [ -d "$2" ]; then
        output_dir=$2
    else
        echo "$2 is not a directory"
        exit 21
    fi
fi

if [ -z "$3" ]; then
    url="http://10.20.1.110:3000/"
else
    url="http://${3}/"
fi

number_of_requests=2000

echo "Benchmarking search"
ab -e "$output_dir/search.csv" -n ${number_of_requests} -c $1 -T 'application/json' -p ./scripts/ab-tests/request-bodies/search-body.json ${url} > "${output_dir}/search.stdout"
echo "Benchmarking subscribe"
ab -e "$output_dir/subscribe.csv" -n ${number_of_requests} -c $1 -T 'application/json' -p ./scripts/ab-tests/request-bodies/subscribe-body.json ${url} > "${output_dir}/subscribe.stdout"
echo "Benchmarking unsubscribe"
ab -e "$output_dir/unsubscribe.csv" -n ${number_of_requests} -c $1 -T 'application/json' -p ./scripts/ab-tests/request-bodies/unsubscribe-body.json ${url} > "${output_dir}/unsubscribe.stdout"
echo "Benchmarking homepage"
ab -e "$output_dir/get-homepage.csv" -n ${number_of_requests} -c $1 ${url} > "${output_dir}/get-homepage.stdout"
