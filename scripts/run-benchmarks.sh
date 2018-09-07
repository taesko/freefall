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
    url="http://${2}"
    admin_url="http://${2}:3001"
fi

number_of_requests=500
concurrency_levels=(5 10 50)

function run_post_benchmark {
    if [ "$2" = "admin" ]; then
        target_url="${admin_url}/api"
    else
        target_url="${url}/"
    fi

    for concurrency in "${concurrency_levels[@]}"; do
        output_file="${output_dir}/${1}-${concurrency}.stdout"
        echo "Benchmarking $1 with ${concurrency} concurrency on url ${target_url}."
        echo "Output file is ${output_file}"
        ab -n ${number_of_requests} -c ${concurrency} -T 'application/json' -p "./scripts/ab-tests/request-bodies/${1}_body.json" ${target_url} > ${output_file}
    done
}

function run_get_benchmark {
    cookie="$2";
    if [ "$3" = "admin" ]; then
        target_url="${admin_url}"
    else
        target_url="${url}"
    fi
    if [ -z "$1" ]; then
        rel="index"
        target_url="${target_url}/"
    else
        rel=${1}
        target_url="${target_url}/${1}"
    fi

    echo "Target url is ${target_url}"
    for concurrency in "${concurrency_levels[@]}"; do
        output_file="${output_dir}/${rel}-${concurrency}.stdout"
        echo "Benchmarking ${rel} with ${concurrency} concurrency";
        echo "Output file is ${output_file}"
        ab -n ${number_of_requests} -c ${concurrency} -C "${cookie}" ${target_url} > ${output_file}
    done
}

function run_dalipeche_benchmark {
    target_url="${url}/api/dalipeche/"
    post_body="./scripts/ab-tests/request-bodies/dalipeche-SOF-body.json"
    echo "Target url is ${target_url}"
    for concurrency in "${concurrency_levels[@]}"; do
        output_file="${output_dir}/dalipeche-${concurrency}.stdout"
        echo "Benchmarking dalipeche with ${concurrency} concurrency";
        echo "Output file is ${output_file}"
        ab -n ${number_of_requests} -c ${concurrency} -T 'application/json' -p ${post_body} ${target_url} > ${output_file}
    done
}

function run_profile_benchmark {
    target_url="${url}/profile"
    post_body="./scripts/ab-tests/request-bodies/login_body.form"
    echo "Target url is ${target_url}"
    for concurrency in "${concurrency_levels[@]}"; do
        output="${output_dir}/login-${concurrency}.stdout"
        echo "Benchmarking GET / profile with ${concurrency} concurrency and ${number_of_requests} number of requests";
        echo "Output file is ${output}"
        ab -n ${number_of_requests} -c ${concurrency} -C ${target_url} > ${output}
    done
}

logged_in_cookie="koa:sess:admin=eyJlbXBsb3llZUlEIjoxLCJfZXhwaXJlIjoxNTM2MjQzMzU2MTk1LCJfbWF4QWdlIjo4NjQwMDAwMH0=; koa:sess:admin.sig=FwqF6SZ7gU6QWWiao2WIuVbIy5Q; koa:sess=eyJsb2dpbl90b2tlbiI6ImFkYjZkY2JlOWNiYTMxMjU5NWU3NDYyMTJlYTZmZWVlIiwiX2V4cGlyZSI6MTUzNjI0OTMxMDc5MywiX21heEFnZSI6ODY0MDAwMDB9; koa:sess.sig=5LeMrvUL9XNIcA-ON_-se_0Zn6U"

run_get_benchmark "" ${logged_in_cookie}
run_get_benchmark "profile" "${logged_in_cookie}"
run_post_benchmark "search"
run_post_benchmark "subscribe"
run_post_benchmark "unsubscribe"
run_post_benchmark "edit_subscription"
run_post_benchmark "list_airports"
run_post_benchmark "list_subscriptions"
run_post_benchmark "admin_list_subscriptions" admin
run_dalipeche_benchmark

commit_hash=$(git log | head -n 1 | cut -d " " -f 2 | cut -c -5)
zip_file_name="benchmarks-${commit_hash}.zip"
zip -r $zip_file_name $output_dir
