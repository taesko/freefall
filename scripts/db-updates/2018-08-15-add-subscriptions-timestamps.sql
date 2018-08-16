ALTER TABLE subscriptions ADD COLUMN created_at timestamp; -- there are already records without timestamps, so timestamps cannot be NOT NULL
-- setting DEFAULT on ADD COLUMN will make all previously existing records without timestamps to have a timestamp now(), which would be incorrect
ALTER TABLE subscriptions ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE subscriptions ADD COLUMN updated_at timestamp;
ALTER TABLE subscriptions ALTER COLUMN updated_at SET DEFAULT now();

CREATE INDEX subscriptions_created_at_idx
ON subscriptions(created_at);
CREATE INDEX subscriptions_updated_at_idx
ON subscriptions(updated_at);

ALTER TABLE users_subscriptions ADD COLUMN created_at timestamp;
ALTER TABLE users_subscriptions ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE users_subscriptions ADD COLUMN updated_at timestamp;
ALTER TABLE users_subscriptions ALTER COLUMN updated_at SET DEFAULT now();

CREATE INDEX users_subscriptions_created_at_idx
ON users_subscriptions(created_at);
CREATE INDEX users_subscriptions_updated_at_idx
ON users_subscriptions(updated_at);
