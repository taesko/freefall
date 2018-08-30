BEGIN;
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
ALTER TABLE users_subscriptions ADD COLUMN subscription_plan_new_column integer REFERENCES subscription_plans;
UPDATE users_subscriptions
SET subscription_plan_new_column = (
        SELECT id FROM subscription_plans WHERE name=users_subscriptions.plan::text
    );
ALTER TABLE users_subscriptions ALTER COLUMN subscription_plan_new_column SET NOT NULL;
ALTER TABLE users_subscriptions DROP COLUMN plan;
ALTER TABLE users_subscriptions RENAME COLUMN subscription_plan_new_column TO subscription_plan_id;
DROP TYPE subscription_plan;
COMMIT;