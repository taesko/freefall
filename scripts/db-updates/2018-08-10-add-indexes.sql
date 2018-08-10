CREATE INDEX subscriptions_airport_from_id_idx
ON subscriptions(airport_from_id);
CREATE INDEX subscriptions_airport_to_id_idx
ON subscriptions(airport_to_id);
CREATE INDEX subscriptions_is_roundtrip_idx
ON subscriptions(is_roundtrip);
CREATE INDEX fetches_fetch_time_idx
ON fetches(fetch_time);
CREATE INDEX subscriptions_fetches_subscription_id_idx
ON subscriptions_fetches(subscription_id);
CREATE INDEX subscriptions_fetches_fetch_id_idx
ON subscriptions_fetches(fetch_id);
CREATE INDEX users_password_idx
ON users(password);
CREATE INDEX users_role_idx
ON users(role);
CREATE INDEX users_active_idx
ON users(active);
CREATE INDEX users_credits_idx
ON users(credits);
CREATE INDEX users_subscriptions_user_id_idx
ON users_subscriptions(user_id);
CREATE INDEX users_subscriptions_subscription_id_idx
ON users_subscriptions(subscription_id);
CREATE INDEX users_subscriptions_fetch_id_of_last_send_idx
ON users_subscriptions(fetch_id_of_last_send);
CREATE INDEX users_subscriptions_date_from_idx
ON users_subscriptions(date_from);
CREATE INDEX users_subscriptions_date_to_idx
ON users_subscriptions(date_to);
CREATE INDEX users_subscriptions_active_idx
ON users_subscriptions(active);
CREATE INDEX routes_subscription_fetch_id_idx
ON routes(subscription_fetch_id);
CREATE INDEX routes_price_idx
ON routes(price);
CREATE INDEX flights_airline_id_idx
ON flights(airline_id);
CREATE INDEX flights_flight_number_idx
ON flights(flight_number);
CREATE INDEX flights_airport_from_id_idx
ON flights(airport_from_id);
CREATE INDEX flights_airport_to_id_idx
ON flights(airport_to_id);
CREATE INDEX flights_dtime_idx
ON flights(dtime);
CREATE INDEX flights_atime_idx
ON flights(atime);
CREATE INDEX routes_flights_route_id_idx
ON routes_flights(route_id);
CREATE INDEX routes_flights_flight_id_idx
ON routes_flights(flight_id);
CREATE INDEX routes_flights_is_return_idx
ON routes_flights(is_return);
CREATE INDEX account_transfers_user_id_idx
ON account_transfers(user_id);
CREATE INDEX account_transfers_transfer_amount_idx
ON account_transfers(transfer_amount);
CREATE INDEX account_transfers_transferred_at
ON account_transfers(transferred_at);
CREATE INDEX subscr_fetches_account_transfers_subscription_fetch_id_idx
ON subscriptions_fetches_account_transfers(subscription_fetch_id);
CREATE INDEX account_transfers_by_admin_admin_user_id_idx
ON account_transfers_by_admin(admin_user_id);
