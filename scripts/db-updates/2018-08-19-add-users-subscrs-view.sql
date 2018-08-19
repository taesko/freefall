CREATE OR REPLACE VIEW users_subscrs_public_data_view AS
    SELECT user_sub.id, user_sub.date_from, user_sub.date_to,
      ap_from.id airport_from_id, ap_to.id airport_to_id,
      users.id user_id, users.email user_email, user_sub.created_at, user_sub.updated_at,
      user_sub.active AS subscription_is_active
    FROM users_subscriptions user_sub
    JOIN users ON user_sub.user_id=users.id
    JOIN subscriptions sub ON user_sub.subscription_id=sub.id
    JOIN airports ap_from ON sub.airport_from_id=ap_from.id
    JOIN airports ap_to ON sub.airport_to_id=ap_to.id
