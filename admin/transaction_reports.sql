-- (1) Credits spent by given user:
SELECT COALESCE(sum(transfer_amount) * -1, 0) AS user_spent_credits
FROM account_transfers
WHERE
	user_id = 1 AND
	transfer_amount < 0;

-- (2) All credits spent by users:
SELECT COALESCE(sum(transfer_amount) * -1, 0) AS user_spent_credits
FROM account_transfers
WHERE
	transfer_amount < 0;

-- (3) Credits spent by users for a subscription:
SELECT COALESCE(sum(transfer_amount) * -1, 0) AS users_subscription_spent_credits
FROM subscriptions_fetches_account_transfers
LEFT JOIN account_transfers
ON subscriptions_fetches_account_transfers.account_transfer_id = account_transfers.id
LEFT JOIN subscriptions_fetches
ON subscriptions_fetches_account_transfers.subscription_fetch_id = subscriptions_fetches.id
WHERE subscription_id = 1;

-- (4) Credits spent by users for a subscription in a given fetch:
SELECT COALESCE(sum(transfer_amount) * -1, 0) AS users_subscription_spent_credits
FROM subscriptions_fetches_account_transfers
LEFT JOIN account_transfers
ON subscriptions_fetches_account_transfers.account_transfer_id = account_transfers.id
LEFT JOIN subscriptions_fetches
ON subscriptions_fetches_account_transfers.subscription_fetch_id = subscriptions_fetches.id
WHERE subscription_id = 1;
WHERE
	subscription_id = 1 AND
	fetch_id = 1;

-- (5) Credits, given to all users by all admins
SELECT COALESCE(sum(transfer_amount), 0) AS users_given_credits
FROM account_transfers_by_admin
LEFT JOIN account_transfers
ON account_transfers_by_admin.account_transfer_id = account_transfers.id
WHERE transfer_amount > 0;

-- (6) Sum of all users' credits
SELECT COALESCE(sum(credits), 0) AS users_credits
FROM users;