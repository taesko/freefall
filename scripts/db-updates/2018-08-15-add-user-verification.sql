BEGIN;
ALTER TABLE users ADD COLUMN verified boolean NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN verification_token text;
UPDATE users SET verified=true, verification_token=timeofday();
ALTER TABLE users ADD CONSTRAINT verification_token_uniq_constraint UNIQUE (verification_token);
ALTER TABLE users ALTER COLUMN verification_token SET NOT NULL;
COMMIT;