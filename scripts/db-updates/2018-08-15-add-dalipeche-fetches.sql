CREATE TYPE dalipeche_tax_reason AS ENUM ('successful_request', 'failed_request', 'bad_request', 'bad_response');

CREATE TABLE dalipeche_fetches (
    id serial PRIMARY KEY NOT NULL,
    api_key text NOT NULL,
    fetch_time timestamp NOT NULL,
    tax_reason dalipeche_tax_reason NOT NULL
);

CREATE VIEW dalipeche_fetches_reports_view AS
    SELECT id, api_key, fetch_time, tax_reason,
        CASE
            WHEN tax_reason='successful_request' THEN 2
            WHEN tax_reason='failed_request' THEN 1
            WHEN tax_reason='bad_request' THEN 0
            WHEN tax_reason='bad_response' THEN 0 -- TODO throw exception on ELSE in postgresql ?
        END AS tax_amount
    FROM dalipeche_fetches;
