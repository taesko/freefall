BEGIN;
-- have to drop table because enum value needs to be dropped
DROP TABLE dalipeche_fetches CASCADE;
DROP TYPE dalipeche_tax_reason;
CREATE TYPE dalipeche_fetch_status AS ENUM (
  'pending', -- request was sent but hasn't been handled. Status is only temporary and should be updated after handling the response
  'no_response', -- unknown tax
  'bad_response', -- unknown tax
  'free_request', -- tax = 0
  'failed_request', -- tax = 1
  'successful_request' -- tax = 2
);
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
COMMIT;
