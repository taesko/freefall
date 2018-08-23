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

CREATE TABLE employees (
  id serial PRIMARY KEY,
  email text NOT NULL CHECK (char_length(email) >= 3),
  password text NOT NULL,
  api_key text UNIQUE NOT NULL,
  active boolean NOT NULL DEFAULT TRUE,
  UNIQUE(email)
);

CREATE INDEX employees_password_idx
ON employees(password);
CREATE INDEX employees_active_idx
ON employees(active);

CREATE TABLE employees_roles (
  id serial PRIMARY KEY,
  employee_id integer REFERENCES employees UNIQUE,
  role_id integer REFERENCES roles,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO employees
  (email, password, api_key)
  SELECT
    email,
    password,
    api_key
  FROM users
  WHERE role = 'admin';

CREATE INDEX employees_roles_employee_id_idx
ON employees_roles(employee_id);
CREATE INDEX employees_roles_role_id_idx
ON employees_roles(role_id);
CREATE INDEX employees_roles_created_at_idx
ON employees_roles(created_at);
CREATE INDEX employees_roles_updated_at_idx
ON employees_roles(updated_at);

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
  ('unsubscribe'),
  ('admin_list_user_info'),
  ('admin_list_transfers');

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
  (3, 23),
  (1, 24),
  (1, 25);

-- All employees were admins before this update
INSERT INTO employees_roles
  (employee_id, role_id)
  SELECT
    id,
    1
  FROM employees;

CREATE TABLE account_transfers_by_employees (
  id serial PRIMARY KEY,
  account_transfer_id integer NOT NULL UNIQUE REFERENCES account_transfers,
  employee_id integer NOT NULL REFERENCES employees
);

INSERT INTO account_transfers_by_employees
  (account_transfer_id, employee_id)
  SELECT
    account_transfers_by_admin.account_transfer_id,
    employees.id
  FROM account_transfers_by_admin
  JOIN users
    ON users.id = account_transfers_by_admin.admin_user_id
  JOIN employees
    ON users.email = employees.email;

CREATE INDEX account_transfers_by_employees_employee_id_idx
ON account_transfers_by_employees(employee_id);

DROP INDEX account_transfers_by_admin_admin_user_id_idx;
DROP TABLE account_transfers_by_admin;
DROP FUNCTION IF EXISTS is_admin(integer);

DELETE FROM users
WHERE role = 'admin';

DROP INDEX users_role_idx;

ALTER TABLE users
DROP COLUMN role;

DROP TYPE user_role;

COMMIT;
