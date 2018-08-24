BEGIN;
CREATE TYPE subscription_plan AS ENUM (
    'monthly', -- check and notify for flights once a month
    'weekly', -- check and notify for flights once a week
    'daily' -- check and notify for flights once a day
);
ALTER TABLE users_subscriptions ADD COLUMN plan subscription_plan NOT NULL DEFAULT 'monthly';
ALTER TABLE users_subscriptions ALTER COLUMN plan DROP DEFAULT;
COMMIT;
