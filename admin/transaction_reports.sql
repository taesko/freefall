-- (1) Credits spent by given user:
SELECT COALESCE(sum(transfer_amount) * -1, 0) AS user_spent_credits
FROM account_transfers
WHERE 
	user_id = 1 AND
	transfer_amount < 0;

-- (2) All credits spent by users:
-- same as (1), except:
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
-- same as (3), except:
WHERE 
	subscription_id = 1 AND
	fetch_id = 1;