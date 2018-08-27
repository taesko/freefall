BEGIN;
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
COMMIT;
