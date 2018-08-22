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
)
