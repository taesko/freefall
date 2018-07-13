INSERT INTO subscriptions
	(airport_from_id, airport_to_id, date_from, date_to)
VALUES
	(2, 3, strftime('%Y-%m-%dT%H:%M:%S', 'now', '+1 month'), strftime('%Y-%m-%dT%H:%M:%S', 'now', '+2 month'));
