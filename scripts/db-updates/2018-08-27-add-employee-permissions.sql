BEGIN;

INSERT INTO permissions
  (name)
VALUES
  ('admin_list_employees'),
  ('admin_list_employee_info'),
  ('admin_add_employee'),
  ('admin_remove_employee'),
  ('admin_edit_employee');

COMMIT;

\echo Employee permissions added. Please manually assign them to appropriate roles.

