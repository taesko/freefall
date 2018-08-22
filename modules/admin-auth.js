const log = require('./log');
const { assertApp } = require('./error-handling');
const _ = require('lodash');

async function isLoggedIn (ctx) {
  const id = ctx.session.employeeID;

  if (id == null) {
    return false;
  }

  assertApp(typeof id === 'number', `got ${id}`);

  const selectResult = await ctx.state.dbClient(`

    SELECT *
    FROM employees
    WHERE id = $1;

  `, [id]);

  assertApp(_.isObject(selectResult), `got ${selectResult}`);
  assertApp(Array.isArray(selectResult.rows), `got ${selectResult.rows}`);
  assertApp(selectResult.rows.length <= 1, `got ${selectResult.rows.length}`);

  return selectResult.rows.length === 1;
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
};
