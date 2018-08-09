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
    url="http://10.20.1.110:3000/"
    echo "Defaulting to ${url}"
else
    url="http://${2}/"
fi

number_of_requests=2000

function run_post_benchmark {
    for concurrency in 100 500 1000; do
        output_file="${output_dir}/${1}-${concurrency}.stdout"
        echo "Benchmarking $1 with ${concurrency} concurrency."
        echo "Output file is ${output_file}"
        ab -n ${number_of_requests} -c ${concurrency} -T 'application/json' -p "./scripts/ab-tests/request-bodies/${1}-body.json" ${url} > ${output_file}
    done
}

function run_get_benchmark {
    for concurrency in 100 500 1000; do
        output_file="${output_dir}/$1-${concurrency}.stdout"
        echo "Benchmarking $1 with ${concurrency} concurrency";
        echo "Output file is ${output_file}"
        ab -n ${number_of_requests} -c ${concurrency} ${url} > ${output_file}
    done
}

run_post_benchmark "search"
run_post_benchmark "subscribe"
run_post_benchmark "unsubscribe"
run_get_benchmark "get-homepage"
