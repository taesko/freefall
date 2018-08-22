DROP TABLE IF EXISTS account_transfers_by_admin;
DROP TABLE IF EXISTS subscriptions_fetches_account_transfers;
DROP TABLE IF EXISTS user_subscription_account_transfers;
DROP TABLE IF EXISTS account_transfers;
DROP TABLE IF EXISTS routes_flights;
DROP TABLE IF EXISTS flights;
DROP TABLE IF EXISTS routes;
DROP TABLE IF EXISTS users_subscriptions;
DROP TABLE IF EXISTS subscriptions_fetches;
DROP TABLE IF EXISTS fetches;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS airports;
DROP TABLE IF EXISTS airlines;
DROP TABLE IF EXISTS users;
DROP TYPE IF EXISTS user_role;

CREATE TYPE user_role AS ENUM ('admin', 'customer');
CREATE TYPE dalipeche_fetch_status AS ENUM (
  'pending', -- request was sent but hasn't been handled. Status is only temporary and should be updated after handling the response
  'no_response', -- unknown tax
  'bad_response', -- unknown tax
  'free_request', -- tax = 0
  'failed_request', -- tax = 1
  'successful_request' -- tax = 2
);

CREATE TABLE airports (
  id serial PRIMARY KEY NOT NULL,
  iata_code text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE
);

CREATE TABLE airlines (
  id serial PRIMARY KEY NOT NULL,
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  logo_url text UNIQUE
);

CREATE TABLE subscriptions (
  id serial PRIMARY KEY NOT NULL,
  airport_from_id integer NOT NULL,
  airport_to_id integer NOT NULL,
  is_roundtrip boolean NOT NULL DEFAULT FALSE,
  created_at timestamp DEFAULT now(), -- timestamps were added additionally and there are already records without timestamps, so they should be null
  updated_at timestamp DEFAULT now(),
  UNIQUE(airport_from_id, airport_to_id, is_roundtrip),
  CHECK(airport_from_id <> airport_to_id),
  FOREIGN KEY(airport_from_id) REFERENCES airports(id),
  FOREIGN KEY(airport_to_id) REFERENCES airports(id)
);

CREATE INDEX subscriptions_airport_from_id_idx
ON subscriptions(airport_from_id);
CREATE INDEX subscriptions_airport_to_id_idx
ON subscriptions(airport_to_id);
CREATE INDEX subscriptions_is_roundtrip_idx
ON subscriptions(is_roundtrip);
CREATE INDEX subscriptions_created_at_idx
ON subscriptions(created_at);
CREATE INDEX subscriptions_updated_at_idx
ON subscriptions(updated_at);

CREATE TABLE fetches (
  id serial PRIMARY KEY NOT NULL,
  fetch_time timestamp NOT NULL
);

CREATE INDEX fetches_fetch_time_idx
ON fetches(fetch_time);

CREATE TABLE subscriptions_fetches (
  id serial PRIMARY KEY NOT NULL,
  subscription_id integer NOT NULL,
  fetch_id integer NOT NULL,
  api_fetches_count integer NOT NULL DEFAULT 0 CHECK(api_fetches_count >= 0),
  FOREIGN KEY(subscription_id) REFERENCES subscriptions(id) ON DELETE RESTRICT,
  FOREIGN KEY(fetch_id) REFERENCES fetches(id) ON DELETE RESTRICT,
  UNIQUE(subscription_id, fetch_id)
);

CREATE INDEX subscriptions_fetches_subscription_id_idx
ON subscriptions_fetches(subscription_id);
CREATE INDEX subscriptions_fetches_fetch_id_idx
ON subscriptions_fetches(fetch_id);
CREATE INDEX subscriptions_fetches_api_fetches_count_idx
ON subscriptions_fetches(api_fetches_count);

CREATE TABLE dalipeche_fetches (
    id serial PRIMARY KEY NOT NULL,
    api_key text NOT NULL,
    fetch_time timestamp NOT NULL,
    status dalipeche_fetch_status NOT NULL
);

CREATE VIEW dalipeche_fetches_reports_view AS
    SELECT id, api_key, fetch_time, status,
        CASE
            WHEN status='successful_request' THEN 2
            WHEN status='failed_request' THEN 1
            WHEN status='free_request' THEN 0
            WHEN status='no_response' THEN 0
            WHEN status='bad_response' THEN 0 -- TODO throw exception on ELSE in postgresql ?
            WHEN status='pending' THEN 0
        END AS tax_amount
    FROM dalipeche_fetches;

CREATE TABLE users (
  id serial PRIMARY KEY NOT NULL,
  email text NOT NULL CONSTRAINT check_email_length CHECK (char_length(email) >= 3),
  password text NOT NULL,
  api_key text UNIQUE NOT NULL,
  role user_role NOT NULL,
  active boolean NOT NULL DEFAULT TRUE,
  verified boolean NOT NULL DEFAULT FALSE,
  verification_token text NOT NULL UNIQUE,
  credits integer NOT NULL DEFAULT 0,
  CHECK(credits >= 0),
  UNIQUE(email)
);

CREATE INDEX users_password_idx
ON users(password);
CREATE INDEX users_role_idx
ON users(role);
CREATE INDEX users_active_idx
ON users(active);
CREATE INDEX users_credits_idx
ON users(credits);

CREATE TABLE users_subscriptions (
  id serial PRIMARY KEY NOT NULL,
  user_id integer NOT NULL,
  subscription_id integer NOT NULL,
  fetch_id_of_last_send integer,
  date_from date NOT NULL,
  date_to date NOT NULL,
  active boolean NOT NULL DEFAULT TRUE,
  created_at timestamp DEFAULT now(), -- timestamps were added additionally and there are already records without timestamps, so they should be null
  updated_at timestamp DEFAULT now(),
  UNIQUE(user_id, subscription_id, date_from, date_to),
  CHECK(date_from < date_to),
  FOREIGN KEY(subscription_id) REFERENCES subscriptions(id),
  FOREIGN KEY(fetch_id_of_last_send) REFERENCES fetches(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

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
CREATE INDEX users_subscriptions_created_at_idx
ON users_subscriptions(created_at);
CREATE INDEX users_subscriptions_updated_at_idx
ON users_subscriptions(updated_at);

CREATE FUNCTION generate_session_token() RETURNS text AS $$
DECLARE
    new_token text;
    done bool;
BEGIN
    done := false;
    WHILE NOT done LOOP
        new_token := md5(random()::text);
        done := NOT EXISTS(SELECT 1 FROM login_sessions WHERE token=new_token);
    END LOOP;
    RETURN new_token;
END;
$$ LANGUAGE plpgsql VOLATILE;

CREATE TABLE login_sessions (
    id serial PRIMARY KEY,
    user_id integer UNIQUE NOT NULL REFERENCES users ON DELETE CASCADE,
    expiration_date timestamp NOT NULL DEFAULT current_timestamp + interval '1 day',
    token text UNIQUE NOT NULL CHECK (char_length(token) > 25) DEFAULT generate_session_token()
)

CREATE TABLE routes (
  id serial PRIMARY KEY NOT NULL,
  booking_token text NOT NULL UNIQUE,
  subscription_fetch_id integer NOT NULL,
  price integer NOT NULL, -- stored as cents
  CHECK(price >= 0),
  FOREIGN KEY(subscription_fetch_id) REFERENCES subscriptions_fetches(id) ON DELETE RESTRICT
);

CREATE INDEX routes_subscription_fetch_id_idx
ON routes(subscription_fetch_id);
CREATE INDEX routes_price_idx
ON routes(price);

CREATE TABLE flights (
  id serial PRIMARY KEY NOT NULL,
  airline_id integer NOT NULL,
  flight_number text NOT NULL,
  airport_from_id integer NOT NULL,
  airport_to_id integer NOT NULL,
  dtime timestamp NOT NULL,
  atime timestamp NOT NULL,
  remote_id text NOT NULL UNIQUE,
  FOREIGN KEY (airline_id) REFERENCES airlines(id),
  FOREIGN KEY (airport_from_id) REFERENCES airports(id),
  FOREIGN KEY (airport_to_id) REFERENCES airports(id),
  CHECK(airport_from_id <> airport_to_id)
);

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

CREATE TABLE routes_flights (
  id serial PRIMARY KEY NOT NULL,
  route_id integer NOT NULL,
  flight_id integer NOT NULL,
  is_return boolean NOT NULL DEFAULT FALSE,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE RESTRICT,
  FOREIGN KEY (flight_id) REFERENCES flights(id),
  UNIQUE(flight_id, route_id, is_return)
);

CREATE INDEX routes_flights_route_id_idx
ON routes_flights(route_id);
CREATE INDEX routes_flights_flight_id_idx
ON routes_flights(flight_id);
CREATE INDEX routes_flights_is_return_idx
ON routes_flights(is_return);

CREATE TABLE account_transfers (
  id serial PRIMARY KEY NOT NULL,
  user_id integer NOT NULL,
  transfer_amount integer NOT NULL,
  transferred_at timestamp NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX account_transfers_user_id_idx
ON account_transfers(user_id);
CREATE INDEX account_transfers_transfer_amount_idx
ON account_transfers(transfer_amount);
CREATE INDEX account_transfers_transferred_at
ON account_transfers(transferred_at);

CREATE TABLE user_subscription_account_transfers (
  id serial PRIMARY KEY NOT NULL,
  account_transfer_id integer NOT NULL UNIQUE,
  user_subscription_id integer NOT NULL UNIQUE,
  FOREIGN KEY (account_transfer_id) REFERENCES account_transfers(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_subscription_id) REFERENCES users_subscriptions(id) ON DELETE RESTRICT
);

CREATE TABLE subscriptions_fetches_account_transfers (
  id serial PRIMARY KEY NOT NULL,
  account_transfer_id integer NOT NULL UNIQUE,
  subscription_fetch_id integer NOT NULL, -- subscription_fetch_id is not linked to a user so multiple account_transfers are possible.
  FOREIGN KEY (account_transfer_id) REFERENCES account_transfers(id) ON DELETE RESTRICT,
  FOREIGN KEY (subscription_fetch_id) REFERENCES subscriptions_fetches(id) ON DELETE RESTRICT
);

CREATE INDEX subscr_fetches_account_transfers_subscription_fetch_id_idx
ON subscriptions_fetches_account_transfers(subscription_fetch_id);

CREATE OR REPLACE FUNCTION is_admin (user_id integer)
  RETURNS boolean AS
$$
  DECLARE
    selected_user_role user_role;
  BEGIN
    SELECT INTO selected_user_role role
    FROM users
    WHERE id = user_id;
    IF FOUND THEN
      IF selected_user_role = 'admin' THEN
        RETURN true;
      ELSE
        RETURN false;
      END IF;
    ELSE
      RETURN false;
    END IF;
  END;
$$
LANGUAGE plpgsql;

CREATE TABLE account_transfers_by_admin (
  id serial PRIMARY KEY,
  account_transfer_id integer NOT NULL UNIQUE REFERENCES account_transfers,
  admin_user_id integer NOT NULL REFERENCES users CHECK (is_admin(admin_user_id))
);

CREATE INDEX account_transfers_by_admin_admin_user_id_idx
ON account_transfers_by_admin(admin_user_id);

CREATE OR REPLACE VIEW search_view AS
    SELECT
      routes.id AS route_id,
      routes.booking_token,
      routes.price,
      routes.subscription_fetch_id AS subscription_fetch_id,
      airlines.name AS airline_name,
      airlines.logo_url AS airline_logo,
      afrom.name::text AS airport_from,
      ato.name::text AS airport_to,
      afrom.id AS airport_from_id,
      ato.id AS airport_to_id,
      to_char(flights.dtime::timestamp, 'YYYY-MM-DD"T"HH24:MI:SSZ') dtime,
      to_char(flights.atime::timestamp, 'YYYY-MM-DD"T"HH24:MI:SSZ') atime,
      flights.flight_number AS flight_number,
      routes_flights.is_return AS return
    FROM routes
    LEFT JOIN routes_flights ON routes_flights.route_id = routes.id
    LEFT JOIN flights ON routes_flights.flight_id = flights.id
    LEFT JOIN airports AS afrom ON afrom.id = flights.airport_from_id
    LEFT JOIN airports AS ato ON ato.id = flights.airport_to_id
    LEFT JOIN airlines ON airlines.id = flights.airline_id
    LEFT JOIN subscriptions_fetches ON routes.subscription_fetch_id=subscriptions_fetches.id
    LEFT JOIN fetches ON subscriptions_fetches.fetch_id=fetches.id

CREATE OR REPLACE VIEW users_subscrs_public_data_view AS
    SELECT user_sub.id, user_sub.date_from, user_sub.date_to,
      ap_from.id airport_from_id, ap_to.id airport_to_id,
      users.id user_id, users.email user_email, user_sub.created_at, user_sub.updated_at,
      user_sub.active AS subscription_is_active
    FROM users_subscriptions user_sub
    JOIN users ON user_sub.user_id=users.id
    JOIN subscriptions sub ON user_sub.subscription_id=sub.id
    JOIN airports ap_from ON sub.airport_from_id=ap_from.id
    JOIN airports ap_to ON sub.airport_to_id=ap_to.id
