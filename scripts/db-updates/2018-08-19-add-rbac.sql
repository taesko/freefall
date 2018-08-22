BEGIN;

CREATE TABLE roles (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX roles_name_idx
ON roles(name);
CREATE INDEX roles_created_at_idx
ON roles(created_at);
CREATE INDEX roles_updated_at_idx
ON roles(updated_at);

CREATE TABLE permissions (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX permissions_name_idx
ON permissions(name);
CREATE INDEX permissions_created_at_idx
ON permissions(created_at);
CREATE INDEX permissions_updated_at_idx
ON permissions(updated_at);

CREATE TABLE roles_permissions (
  id serial PRIMARY KEY,
  role_id integer NOT NULL REFERENCES roles,
  permission_id integer NOT NULL REFERENCES permissions,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

CREATE INDEX roles_permissions_role_id_idx
ON roles_permissions(role_id);
CREATE INDEX roles_permissions_permission_id_idx
ON roles_permissions(permission_id);
CREATE INDEX roles_permissions_created_at_idx
ON roles_permissions(created_at);
CREATE INDEX roles_permissions_updated_at_idx
ON roles_permissions(updated_at);

CREATE TABLE users_roles (
  id serial PRIMARY KEY,
  user_id integer REFERENCES users UNIQUE,
  role_id integer REFERENCES roles,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX users_roles_user_id_idx
ON users_roles(user_id);
CREATE INDEX users_roles_role_id_idx
ON users_roles(role_id);
CREATE INDEX users_roles_created_at_idx
ON users_roles(created_at);
CREATE INDEX users_roles_updated_at_idx
ON users_roles(updated_at);

INSERT INTO roles
  (name)
VALUES
  ('admin'),
  ('customer'),
  ('accountant');

INSERT INTO permissions
  (name)
VALUES
  ('admin_add_role'),
  ('admin_edit_role'),
  ('admin_remove_role'),
  ('admin_list_permissions'),
  ('admin_list_roles'),
  ('admin_alter_user_credits'),
  ('admin_edit_subscription'),
  ('admin_edit_user'),
  ('admin_list_fetches'),
  ('admin_list_guest_subscriptions'),
  ('admin_list_user_subscriptions'),
  ('admin_list_users'),
  ('admin_remove_user'),
  ('admin_subscribe'),
  ('admin_unsubscribe'),
  ('edit_subscription'),
  ('get_api_key'),
  ('list_airports'),
  ('list_subscriptions'),
  ('search'),
  ('senderror'),
  ('subscribe'),
  ('unsubscribe');

INSERT INTO roles_permissions
  (role_id, permission_id)
VALUES
  (1, 1),
  (1, 2),
  (1, 3),
  (1, 4),
  (1, 5),
  (1, 6),
  (1, 7),
  (1, 8),
  (1, 9),
  (1, 10),
  (1, 11),
  (1, 12),
  (1, 13),
  (1, 14),
  (1, 15),
  (1, 16),
  (1, 17),
  (1, 18),
  (1, 19),
  (1, 20),
  (1, 21),
  (1, 22),
  (1, 23),
  (2, 16),
  (2, 17),
  (2, 18),
  (2, 19),
  (2, 20),
  (2, 21),
  (2, 22),
  (2, 23),
  (3, 9),
  (3, 10),
  (3, 11),
  (3, 12),
  (3, 16),
  (3, 17),
  (3, 18),
  (3, 19),
  (3, 20),
  (3, 21),
  (3, 22),
  (3, 23);

INSERT INTO users_roles
  (user_id, role_id)
  SELECT users.id, roles.id
  FROM users
  LEFT JOIN roles
  ON users.role::text = roles.name;

CREATE OR REPLACE FUNCTION is_admin (user_id integer)
  RETURNS boolean AS
$$
  DECLARE
    selected_user_role text;
  BEGIN
    SELECT INTO selected_user_role roles.name
    FROM users_roles
    LEFT JOIN roles
    ON users_roles.role_id = roles.id
    WHERE users_roles.id = user_id;
    IF FOUND THEN
      IF selected_user_role = 'admin' THEN
        RETURN true;
      ELSE
        RETURN false;
      END IF;
    ELSE
      RETURN false;
    END IF;
  END;
$$
LANGUAGE plpgsql;

DROP INDEX users_role_idx;

ALTER TABLE users
DROP COLUMN role;

DROP TYPE user_role;

COMMIT;
