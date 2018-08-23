const log = require('./log');
const { assertApp } = require('./error-handling');
const _ = require('lodash');

async function isLoggedIn (ctx) {
  const id = ctx.session.employeeID;

  if (id == null) {
    return false;
  }

  assertApp(typeof id === 'number', `got ${id}`);

  const selectResult = await ctx.state.dbClient.executeQuery(`

    SELECT *
    FROM employees
    WHERE id = $1;

  `, [id]);

  assertApp(_.isObject(selectResult), `got ${selectResult}`);
  assertApp(Array.isArray(selectResult.rows), `got ${selectResult.rows}`);
  assertApp(selectResult.rows.length <= 1, `got ${selectResult.rows.length}`);

  return selectResult.rows.length === 1;
}

async function getLoggedInEmployee (ctx) {
  const selectEmployeeResult = await ctx.state.dbClient.executeQuery(`

    SELECT *
    FROM employees
    WHERE id = $1;

  `, [ctx.session.employeeID]);

  assertApp(_.isObject(selectEmployeeResult), `got ${selectEmployeeResult}`);
  assertApp(
    Array.isArray(selectEmployeeResult.rows),
    `got ${selectEmployeeResult.rows}`
  );
  assertApp(
    selectEmployeeResult.rows.length <= 1,
    `got ${selectEmployeeResult.rows.length}`
  );

  if (selectEmployeeResult.rows.length === 1) {
    return selectEmployeeResult.rows[0];
  } else {
    return null;
  }
}

async function hasPermission (dbClient, token, permission) {
  assertApp(typeof permission === 'string', `got ${permission}`);

  const dbResponse = await dbClient.executeQuery(`

    SELECT permissions.name AS permission
    FROM employees
    LEFT JOIN employees_roles
    ON employees_roles.employee_id = employees.id
    LEFT JOIN roles_permissions
    ON employees_roles.role_id = roles_permissions.role_id
    LEFT JOIN permissions
    ON roles_permissions.permission_id = permissions.id
    WHERE employees.api_key = $1;

  `, [token]);

  assertApp(_.isObject(dbResponse), `got ${dbResponse}`);
  assertApp(Array.isArray(dbResponse.rows), `got ${dbResponse.rows}`);

  const employeePermissions = dbResponse.rows.map((row) => {
    assertApp(_.isObject(row), `got ${row}`);
    assertApp(typeof row.permission === 'string', `got ${row.permission}`);

    return row.permission;
  });

  return employeePermissions.includes(permission);
}

const redirectWhenLoggedOut = (redirectRoute) => async (ctx, next) => {
  assertApp(typeof redirectRoute === 'string');
  if (!await isLoggedIn(ctx)) {
    // invalidate cookie because deleted user accounts have a valid id in the database
    // this causes problems like register() method automatically logging them in
    log.info('Employee is not logged in. Invalidating cookie and redirecting to', redirectRoute);
    ctx.session.employeeID = null;
    ctx.redirect(redirectRoute);
  } else {
    await next();
  }
};

const redirectWhenLoggedIn = (redirectRoute) => async (ctx, next) => {
  assertApp(typeof redirectRoute === 'string');
  // TODO what happens when an employee has a deactivated account that becomes active during
  // await next()
  if (await isLoggedIn(ctx)) {
    log.info('Employee is logged in. Redirecting to', redirectRoute);
    ctx.redirect(redirectRoute);
  } else {
    await next();
  }
};

module.exports = {
  redirectWhenLoggedIn,
  redirectWhenLoggedOut,
  isLoggedIn,
  getLoggedInEmployee,
  hasPermission,
};
