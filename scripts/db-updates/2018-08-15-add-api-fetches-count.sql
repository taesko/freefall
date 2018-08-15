ALTER TABLE subscriptions_fetches
ADD api_fetches_count integer NOT NULL DEFAULT 0 CHECK(api_fetches_count >= 0);

CREATE INDEX subscriptions_fetches_api_fetches_count_idx
ON subscriptions_fetches(api_fetches_count);
