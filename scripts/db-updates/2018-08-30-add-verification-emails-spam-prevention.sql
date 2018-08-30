BEGIN;
ALTER TABLE users ADD COLUMN sent_verification_email boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN created_at timestamp NOT NULL DEFAULT now();
COMMIT;
