DROP TABLE IF EXISTS routes_flights;
DROP TABLE IF EXISTS flights;
DROP TABLE IF EXISTS routes;
DROP TABLE IF EXISTS user_subscriptions;
DROP TABLE IF EXISTS fetches;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS airports;
DROP TABLE IF EXISTS airlines;
DROP TABLE IF EXISTS users;

CREATE TABLE airports (
  id serial PRIMARY KEY,
  iata_code text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE
);

CREATE TABLE airlines (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  logo_url text UNIQUE
);

CREATE TABLE subscriptions (
  id serial PRIMARY KEY,
  airport_from_id integer NOT NULL,
  airport_to_id integer NOT NULL,
  is_roundtrip boolean NOT NULL DEFAULT FALSE,
  UNIQUE(airport_from_id, airport_to_id, is_roundtrip),
  CHECK(airport_from_id <> airport_to_id),
  FOREIGN KEY(airport_from_id) REFERENCES airports(id),
  FOREIGN KEY(airport_to_id) REFERENCES airports(id)
);

CREATE TABLE fetches (
  id serial PRIMARY KEY,
  fetch_time timestamp NOT NULL,
  subscription_id integer NOT NULL,
  FOREIGN KEY(subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

CREATE TABLE users (
    id integer PRIMARY KEY,
    email text NOT NULL,
    password text NOT NULL,
    api_key text UNIQUE NOT NULL,
    role text NOT NULL,
    active boolean NOT NULL DEFAULT TRUE,
    credits integer NOT NULL DEFAULT 0,
    UNIQUE(email)
);

CREATE TABLE user_subscriptions (
    id serial PRIMARY KEY,
    user_id integer NOT NULL,
    subscription_id integer NOT NULL,
    fetch_id_of_last_send integer,
    date_from date NOT NULL,
    date_to date NOT NULL,
    active boolean NOT NULL DEFAULT TRUE,
    UNIQUE(user_id, subscription_id, date_from, date_to),
    CHECK(date_from < date_to)
    FOREIGN KEY(subscription_id) REFERENCES subscriptions(id),
    FOREIGN KEY(fetch_id_of_last_send) REFERENCES fetches(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE routes (
  id serial PRIMARY KEY,
  booking_token text NOT NULL UNIQUE,
  fetch_id integer NOT NULL,
  price integer NOT NULL, -- stored as cents
  FOREIGN KEY(fetch_id) REFERENCES fetches(id) ON DELETE CASCADE
);

CREATE TABLE flights (
  id serial PRIMARY KEY,
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

CREATE TABLE routes_flights (
  id serial PRIMARY KEY,
  route_id integer NOT NULL,
  flight_id integer NOT NULL,
  is_return boolean NOT NULL DEFAULT FALSE,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
  FOREIGN KEY (flight_id) REFERENCES flights(id),
  UNIQUE(flight_id, route_id, is_return)
);

CREATE TABLE account_transfers (
	id serial PRIMARY KEY,
	credits integer NOT NULL,
);