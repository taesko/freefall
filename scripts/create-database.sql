BEGIN;

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
-- DROP TYPE IF EXISTS user_role;

CREATE TYPE dalipeche_fetch_status AS ENUM (
  'pending', -- request was sent but hasn't been handled. Status is only temporary and should be updated after handling the response
  'no_response', -- unknown tax
  'bad_response', -- unknown tax
  'free_request', -- tax = 0
  'failed_request', -- tax = 1
  'successful_request' -- tax = 2
);

CREATE TABLE roles (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX roles_name_idx
ON roles(name);
CREATE INDEX roles_created_at_idx
ON roles(created_at);
CREATE INDEX roles_updated_at_idx
ON roles(updated_at);

CREATE TABLE permissions (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX permissions_name_idx
ON permissions(name);
CREATE INDEX permissions_created_at_idx
ON permissions(created_at);
CREATE INDEX permissions_updated_at_idx
ON permissions(updated_at);

CREATE TABLE roles_permissions (
  id serial PRIMARY KEY,
  role_id integer NOT NULL REFERENCES roles,
  permission_id integer NOT NULL REFERENCES permissions,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

CREATE INDEX roles_permissions_role_id_idx
ON roles_permissions(role_id);
CREATE INDEX roles_permissions_permission_id_idx
ON roles_permissions(permission_id);
CREATE INDEX roles_permissions_created_at_idx
ON roles_permissions(created_at);
CREATE INDEX roles_permissions_updated_at_idx
ON roles_permissions(updated_at);

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
  active boolean NOT NULL DEFAULT TRUE,
  verified boolean NOT NULL DEFAULT FALSE,
  sent_verification_email boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  verification_token text NOT NULL UNIQUE,
  credits integer NOT NULL DEFAULT 0,
  CHECK(credits >= 0),
  UNIQUE(email)
);

CREATE INDEX users_password_idx
ON users(password);
CREATE INDEX users_active_idx
ON users(active);
CREATE INDEX users_credits_idx
ON users(credits);

CREATE TABLE employees (
  id serial PRIMARY KEY,
  email text NOT NULL CHECK (char_length(email) >= 3),
  password text NOT NULL,
  api_key text UNIQUE NOT NULL,
  active boolean NOT NULL DEFAULT TRUE,
  UNIQUE(email)
);

CREATE INDEX employees_password_idx
ON employees(password);
CREATE INDEX employees_active_idx
ON employees(active);

CREATE TABLE employees_roles (
  id serial PRIMARY KEY,
  employee_id integer REFERENCES employees UNIQUE,
  role_id integer REFERENCES roles,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX employees_roles_employee_id_idx
ON employees_roles(employee_id);
CREATE INDEX employees_roles_role_id_idx
ON employees_roles(role_id);
CREATE INDEX employees_roles_created_at_idx
ON employees_roles(created_at);
CREATE INDEX employees_roles_updated_at_idx
ON employees_roles(updated_at);

CREATE TABLE subscription_plans (
    id serial PRIMARY KEY,
    name text NOT NULL UNIQUE,
    initial_tax integer NOT NULL,
    fetch_tax integer NOT NULL,
    tax_interval interval NOT NULL
);

INSERT INTO subscription_plans
    (name, initial_tax, fetch_tax, tax_interval)
VALUES
    ('daily', 50, 1000, '1 day'),
    ('weekly', 50, 500, '1 week'),
    ('monthly', 50, 100, '1 month');

CREATE TABLE users_subscriptions (
  id serial PRIMARY KEY NOT NULL,
  user_id integer NOT NULL,
  subscription_id integer NOT NULL,
  fetch_id_of_last_send integer,
  date_from date NOT NULL,
  date_to date NOT NULL,
  subscription_plan_id integer NOT NULL REFERENCES subscription_plans,
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
);

CREATE FUNCTION generate_pw_reset_token() RETURNS text AS $$
DECLARE
    new_token text;
    done bool;
BEGIN
    done := false;
    WHILE NOT done LOOP
        new_token := md5(random()::text);
        done := NOT EXISTS(SELECT 1 FROM password_resets WHERE token=new_token);
    END LOOP;
    RETURN new_token;
END;
$$ LANGUAGE plpgsql VOLATILE;

CREATE TABLE password_resets (
    id serial PRIMARY KEY,
    user_id integer UNIQUE NOT NULL REFERENCES users ON DELETE CASCADE,
    new_password text NOT NULL CHECK (char_length(new_password) >= 8) DEFAULT substring(md5(random()::text) from 1 for 8),
    expires_on timestamp NOT NULL DEFAULT current_timestamp + interval '1 hour',
    sent_email boolean NOT NULL DEFAULT FALSE,
    token text UNIQUE NOT NULL CHECK (char_length(token) > 25) DEFAULT generate_pw_reset_token()
);

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

CREATE TABLE account_transfers_by_employees (
  id serial PRIMARY KEY,
  account_transfer_id integer NOT NULL UNIQUE REFERENCES account_transfers,
  employee_id integer NOT NULL REFERENCES employees
);

CREATE INDEX account_transfers_by_employees_employee_id_idx
ON account_transfers_by_employees(employee_id);

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
    LEFT JOIN fetches ON subscriptions_fetches.fetch_id=fetches.id;

CREATE OR REPLACE VIEW users_subscrs_public_data_view AS
    SELECT user_sub.id, user_sub.date_from, user_sub.date_to,
      ap_from.id airport_from_id, ap_to.id airport_to_id,
      users.id user_id, users.email user_email, user_sub.created_at, user_sub.updated_at,
      user_sub.active AS subscription_is_active
    FROM users_subscriptions user_sub
    JOIN users ON user_sub.user_id=users.id
    JOIN subscriptions sub ON user_sub.subscription_id=sub.id
    JOIN airports ap_from ON sub.airport_from_id=ap_from.id
    JOIN airports ap_to ON sub.airport_to_id=ap_to.id;

INSERT INTO roles
  (name)
VALUES
  ('admin'),
  ('customer'),
  ('accountant');

INSERT INTO permissions
  (name)
VALUES
  ('admin_add_role'),
  ('admin_edit_role'),
  ('admin_remove_role'),
  ('admin_list_permissions'),
  ('admin_list_roles'),
  ('admin_alter_user_credits'),
  ('admin_edit_subscription'),
  ('admin_edit_user'),
  ('admin_list_fetches'),
  ('admin_list_guest_subscriptions'),
  ('admin_list_user_subscriptions'),
  ('admin_list_users'),
  ('admin_remove_user'),
  ('admin_subscribe'),
  ('admin_unsubscribe'),
  ('edit_subscription'),
  ('get_api_key'),
  ('list_airports'),
  ('list_subscriptions'),
  ('search'),
  ('senderror'),
  ('subscribe'),
  ('unsubscribe'),
  ('admin_list_user_info'),
  ('admin_list_transfers'),
  ('admin_list_employees'),
  ('admin_list_employee_info'),
  ('admin_add_employee'),
  ('admin_remove_employee'),
  ('admin_edit_employee');

INSERT INTO roles_permissions
  (role_id, permission_id)
VALUES
  (1, 1),
  (1, 2),
  (1, 3),
  (1, 4),
  (1, 5),
  (1, 6),
  (1, 7),
  (1, 8),
  (1, 9),
  (1, 10),
  (1, 11),
  (1, 12),
  (1, 13),
  (1, 14),
  (1, 15),
  (1, 16),
  (1, 17),
  (1, 18),
  (1, 19),
  (1, 20),
  (1, 21),
  (1, 22),
  (1, 23),
  (2, 16),
  (2, 17),
  (2, 18),
  (2, 19),
  (2, 20),
  (2, 21),
  (2, 22),
  (2, 23),
  (3, 9),
  (3, 10),
  (3, 11),
  (3, 12),
  (3, 16),
  (3, 17),
  (3, 18),
  (3, 19),
  (3, 20),
  (3, 21),
  (3, 22),
  (3, 23),
  (1, 24),
  (1, 25),
  (1, 26),
  (1, 27),
  (1, 28),
  (1, 29),
  (1, 30);

INSERT INTO employees
  (email, password, api_key)
VALUES
  ('admin@freefall.org', '6db49c57fdd2fb00650e06d2661e6d4e', 'admin_api_key_magical_uncrackable_string');

INSERT INTO employees_roles
  (employee_id, role_id)
VALUES (1, 1);

CREATE TYPE api_methods AS ENUM (
  'export_credit_history'
);

CREATE TABLE api_usage (
  id           serial PRIMARY KEY,
  user_id      integer     NOT NULL REFERENCES users,
  api_method   api_methods NOT NULL,
  requested_on timestamp DEFAULT now(),
  UNIQUE (user_id, api_method, requested_on),
  CHECK (NOT is_user_rate_limited(
      user_id,
      api_method,
      CASE
      WHEN api_method = 'export_credit_history'
        THEN '1 minute' :: interval
      ELSE '1 millisecond' :: interval
      END
  ))
);

CREATE OR REPLACE FUNCTION is_user_rate_limited(
  user_id_          integer,
  api_method_       api_methods,
  allowed_interval interval
)
  RETURNS boolean AS $$
BEGIN
  RETURN now() - allowed_interval < (SELECT MAX(au.requested_on)
                                     FROM api_usage AS au
                                     WHERE user_id_ = au.user_id
                                       AND api_method_ = au.api_method);
END;
$$
LANGUAGE plpgsql;

END;

