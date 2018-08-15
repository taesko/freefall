#!/usr/bin/env bash
if [ -z "$1" ]; then
    echo "Expected first argument to specify the output directory of the tests."
    exit 20
else
    if [ -d "$1" ]; then
        output_dir=$1
    else
        echo "$1 is not a directory"
        exit 21
    fi
fi

if [ -z "$2" ]; then
    echo "Second argument not specified for url to benchmark"
    url="http://10.20.1.128:3000"
    admin_url="http://10.20.1.128:3001"
    echo "Defaulting to ${url} on port 3000 (server) and 3001 (admin)"
else
    url="http://${2}:3000"
    admin_url="http://${2}:3001"
fi

number_of_requests=2000

function run_post_benchmark {
    if [ "$2" = "admin" ]; then
        target_url="${admin_url}/api"
    else
        target_url="${url}/"
    fi

    for concurrency in 5 20 50 100 500 1000; do
        output_file="${output_dir}/${1}-${concurrency}.stdout"
        echo "Benchmarking $1 with ${concurrency} concurrency on url ${target_url}."
        echo "Output file is ${output_file}"
        ab -n ${number_of_requests} -c ${concurrency} -T 'application/json' -p "./scripts/ab-tests/request-bodies/${1}_body.json" ${target_url} > ${output_file}
    done
}

function run_get_benchmark {
    if [ "$2" = "admin" ]; then
        target_url="${admin_url}/"
    else
        target_url="${url}/"
    fi

    for concurrency in 5 20 50 100 500 1000; do
        output_file="${output_dir}/$1-${concurrency}.stdout"
        echo "Benchmarking $1 with ${concurrency} concurrency";
        echo "Output file is ${output_file}"
        ab -n ${number_of_requests} -c ${concurrency} ${target_url} > ${output_file}
    done
}

run_post_benchmark "search"
run_post_benchmark "subscribe"
run_post_benchmark "unsubscribe"
run_post_benchmark "edit_subscription"
run_post_benchmark "list_airports"
run_post_benchmark "list_subscriptions"
run_post_benchmark "admin_list_subscriptions" admin
run_get_benchmark "get-homepage"
