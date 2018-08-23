\i ./scripts/create-database.sql

INSERT INTO airports
	(iata_code, name)
VALUES
	('LHR', 'Heathrow'),
	('SOF', 'Sofia'),
	('JFK', 'John F. Kennedy International'),
	('SFO', 'San Francisco International'),
	('HND', 'Haneda');

INSERT INTO subscriptions
	(airport_from_id, airport_to_id)
VALUES
	(2, 3);

INSERT INTO users
    (email, password, api_key, role, verification_token, active, verified)
VALUES
    ('admin@freefall.org', '5f4dcc3b5aa765d61d8327deb882cf99',
     'admin_api_key_magical_uncrackable_string', 'admin',
     'admin_verification_token',
     true,
     true
     ); -- password is hashed
