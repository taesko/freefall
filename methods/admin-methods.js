const { defineAPIMethod } = require('./resolve-method');
const { assertPeer, assertApp, assertUser, PeerError, errorCodes } = require('../modules/error-handling');
const { isObject } = require('lodash');
const log = require('../modules/log');
const adminAuth = require('../modules/admin-auth');
const moment = require('moment');
const subscriptions = require('../modules/subscriptions');
const users = require('../modules/users');
const accounting = require('../modules/accounting');

const MAX_CREDITS_DIFFERENCE = Math.pow(10, 12);

const adminListUsers = defineAPIMethod(
  {
    'ALU_NOT_ENOUGH_PERMISSIONS': { status_code: '2200' },
  },
  async (params, dbClient) => {
    assertPeer(
      await adminAuth.hasPermission(dbClient, params.api_key, 'admin_list_users'),
      'You do not have sufficient permission to call admin_list_users method.',
      'ALU_NOT_ENOUGH_PERMISSIONS',
    );

    const selectResult = await dbClient.executeQuery(`

      SELECT
        users.id,
        users.email,
        users.api_key,
        users.credits,
        users.verified,
        users.verification_token,
        users.active
      FROM users
      ORDER BY users.id
      LIMIT $1
      OFFSET $2;

    `, [params.limit, params.offset]);

    assertApp(isObject(selectResult), `got ${selectResult}`);
    assertApp(Array.isArray(selectResult.rows), `got ${selectResult.rows}`);

    const userList = selectResult.rows;

    for (const user of userList) {
      user.id = `${user.id}`;
    }

    return {
      users: userList,
    };
  },
);

const adminListGuestSubscriptions = defineAPIMethod(
  {
    'ALS_NOT_ENOUGH_PERMISSIONS': { status_code: '2200' },
  },
  async (params, dbClient) => {
    assertPeer(
      await adminAuth.hasPermission(dbClient, params.api_key, 'admin_list_guest_subscriptions'),
      'You do not have sufficient permission to call admin_list_subscriptions method.',
      'ALS_NOT_ENOUGH_PERMISSIONS',
    );

    const result = await dbClient.executeQuery(`

      SELECT *
      FROM subscriptions
      ORDER BY id
      LIMIT $1
      OFFSET $2;

    `, [
      params.limit,
      params.offset,
    ]);

    assertApp(isObject(result), `got ${result}`);
    assertApp(Array.isArray(result.rows), `got ${result.rows}`);

    const guestSubscr = result.rows.map(sub => {
      const createdAt = sub.created_at == null ? 'No information' : sub.created_at.toISOString();
      const updatedAt = sub.updated_at == null ? 'No information' : sub.updated_at.toISOString();

      return {
        id: `${sub.id}`,
        fly_from: `${sub.airport_from_id}`,
        fly_to: `${sub.airport_to_id}`,
        created_at: createdAt,
        updated_at: updatedAt,
      };
    });

    return {
      status_code: '1000',
      guest_subscriptions: guestSubscr,
    };
  },
);

const adminListUserSubscriptions = defineAPIMethod(
  {
    'ALS_INVALID_USER_ID': { status_code: '2000' },
    'ALS_BAD_USER_ID': { status_code: '2100' },
    'ALS_NOT_ENOUGH_PERMISSIONS': { status_code: '2200' },
  },
  async (params, dbClient) => {
    assertPeer(
      await adminAuth.hasPermission(dbClient, params.api_key, 'admin_list_user_subscriptions'),
      'You do not have sufficient permission to call admin_list_subscriptions method.',
      'ALS_NOT_ENOUGH_PERMISSIONS',
    );

    let userId;

    if (params.user_id) {
      userId = +params.user_id;
      assertPeer(Number.isInteger(userId), `got ${userId}`, 'ALS_BAD_USER_ID');
      const exists = await users.userExists(dbClient, { userId });
      assertPeer(exists, `got ${userId}`, 'ALS_INVALID_USER_ID');
    }

    // TODO set MAX limit from config
    assertPeer(Number.isSafeInteger(params.offset), `got ${params.offset}`, 'ALS_BAD_OFFSET');
    assertPeer(Number.isSafeInteger(params.limit), `got ${params.limit}`, 'ALS_BAD_LIMIT');

    let userSubscr;

    if (userId) {
      const result = await dbClient.executeQuery(`

        SELECT
          user_sub.id,
          user_sub.date_from,
          user_sub.date_to,
          ap_from.id fly_from,
          ap_to.id fly_to,
          users.id user_id,
          users.email user_email,
          user_sub.created_at created_at,
          user_sub.updated_at updated_at
        FROM users_subscriptions user_sub
        JOIN users ON user_sub.user_id=users.id
        JOIN subscriptions sub ON user_sub.subscription_id=sub.id
        JOIN airports ap_from ON sub.airport_from_id=ap_from.id
        JOIN airports ap_to ON sub.airport_to_id=ap_to.id
        WHERE
          user_sub.active=true AND
          users.id = $1
        ORDER BY user_sub.id
        LIMIT $2
        OFFSET $3;

      `, [
        userId,
        params.limit,
        params.offset,
      ]);

      assertApp(isObject(result), `got ${result}`);
      assertApp(Array.isArray(result.rows), `got ${result.rows}`);

      userSubscr = result.rows;
    } else {
      const result = await dbClient.executeQuery(`

        SELECT
          user_sub.id,
          user_sub.date_from,
          user_sub.date_to,
          ap_from.id fly_from,
          ap_to.id fly_to,
          users.id user_id,
          users.email user_email,
          user_sub.created_at created_at,
          user_sub.updated_at updated_at
        FROM users_subscriptions user_sub
        JOIN users ON user_sub.user_id=users.id
        JOIN subscriptions sub ON user_sub.subscription_id=sub.id
        JOIN airports ap_from ON sub.airport_from_id=ap_from.id
        JOIN airports ap_to ON sub.airport_to_id=ap_to.id
        WHERE
          user_sub.active=true
        ORDER BY user_sub.id
        LIMIT $1
        OFFSET $2;

      `, [
        params.limit,
        params.offset,
      ]);

      assertApp(isObject(result), `got ${result}`);
      assertApp(Array.isArray(result.rows), `got ${result.rows}`);

      userSubscr = result.rows;
    }

    userSubscr = userSubscr.map(sub => {
      const createdAt = sub.created_at == null ? 'No information' : sub.created_at.toISOString();
      const updatedAt = sub.updated_at == null ? 'No information' : sub.updated_at.toISOString();

      return {
        id: `${sub.id}`,
        user: {
          id: `${sub.user_id}`,
          email: `${sub.user_email}`,
        },
        date_from: moment(sub.date_from).format('Y-MM-DD'),
        date_to: moment(sub.date_to).format('Y-MM-DD'),
        fly_from: `${sub.fly_from}`,
        fly_to: `${sub.fly_to}`,
        created_at: createdAt,
        updated_at: updatedAt,
      };
    });

    return {
      status_code: '1000',
      user_subscriptions: userSubscr,
    };
  },
);

// const adminListSubscriptions = defineAPIMethod(
//   {
//     'ALS_INVALID_USER_ID': { status_code: '2000' },
//     'ALS_BAD_USER_ID': { status_code: '2100' },
//     'ALS_NOT_ENOUGH_PERMISSIONS': { status_code: '2200' },
//   },
//   async (params, dbClient) => {
//     assertPeer(
//       await adminAuth.hasPermission(dbClient, params.api_key, 'admin_list_subscriptions'),
//       'You do not have sufficient permission to call admin_list_subscriptions method.',
//       'ALS_NOT_ENOUGH_PERMISSIONS',
//     );
//
//     let userId;
//
//     if (params.user_id) {
//       userId = +params.user_id;
//       assertPeer(Number.isInteger(userId), `got ${userId}`, 'ALS_BAD_USER_ID');
//       const exists = await users.userExists(dbClient, { userId });
//       assertPeer(exists, `got ${userId}`, 'ALS_INVALID_USER_ID');
//     }
//
//     let userSubscr;
//     let guestSubscr;
//
//     if (userId) {
//       userSubscr = await subscriptions.listUserSubscriptions(
//         dbClient,
//         userId,
//       );
//       // TODO ask ivan if guestSubscr should be null or empty array
//       guestSubscr = [];
//     } else {
//       userSubscr = await subscriptions.listAllUserSubscriptions(dbClient);
//       guestSubscr = await subscriptions.listGlobalSubscriptions(dbClient);
//       guestSubscr = guestSubscr.map(sub => {
//         return {
//           id: `${sub.id}`,
//           fly_from: `${sub.airport_from_id}`,
//           fly_to: `${sub.airport_to_id}`,
//           created_at:
//             sub.created_at == null ?
//               'No information' : sub.created_at.toISOString(),
//           updated_at:
//             sub.updated_at == null ?
//               'No information' : sub.updated_at.toISOString(),
//         };
//       });
//     }
//
//     userSubscr = userSubscr.map(sub => {
//       const createdAt = sub.created_at == null ? 'No information' : sub.created_at.toISOString();
//       const updatedAt = sub.updated_at == null ? 'No information' : sub.updated_at.toISOString();
//
//       return {
//         id: `${sub.id}`,
//         user: {
//           id: `${sub.user_id}`,
//           email: `${sub.user_email}`,
//         },
//         date_from: moment(sub.date_from).format('Y-MM-DD'),
//         date_to: moment(sub.date_to).format('Y-MM-DD'),
//         fly_from: `${sub.fly_from}`,
//         fly_to: `${sub.fly_to}`,
//         created_at: createdAt,
//         updated_at: updatedAt,
//       };
//     });
//
//     return {
//       status_code: '1000',
//       user_subscriptions: userSubscr,
//       guest_subscriptions: guestSubscr,
//     };
//   },
// );

const adminSubscribe = defineAPIMethod(
  {
    'ASUBSCR_NOT_ENOUGH_PERMISSIONS': { status_code: '2200' },
    'ASUBSCR_BAD_FLY_FROM': { status_code: '2100' },
    'ASUBSCR_BAD_FLY_TO': { status_code: '2100' },
    'ASUBSCR_BAD_USER_ID': { status_code: '2100' },
    [errorCodes.subscriptionExists]: { status_code: '2000' },
    [errorCodes.subscriptionDoesNotExist]: { status_code: '2000' },
  },
  async (params, dbClient) => {
    assertPeer(
      await adminAuth.hasPermission(dbClient, params.api_key, 'admin_subscribe'),
      'You do not have sufficient permission to call admin_list_subscriptions method.',
      'ASUBSCR_NOT_ENOUGH_PERMISSIONS',
    );

    const flyFrom = +params.fly_from;
    const flyTo = +params.fly_to;
    const dateFrom = params.date_from;
    const dateTo = params.date_to;
    const userId = +params.user_id;

    assertPeer(Number.isInteger(flyFrom), `got ${flyFrom}`, 'ASUBSCR_BAD_FLY_FROM');
    assertPeer(Number.isInteger(flyTo), `got ${flyTo}`, 'ASUBSCR_BAD_FLY_TO');
    assertPeer(Number.isInteger(userId), `got ${userId}`, 'ASUBSCR_BAD_USER_ID');

    let subscriptionId;
    let statusCode;

    try {
      subscriptionId = await subscriptions.subscribeUser(
        dbClient,
        userId,
        {
          airportFromId: flyFrom,
          airportToId: flyTo,
          dateFrom,
          dateTo,
        },
      );
      statusCode = 1000;
    } catch (e) {
      if (e instanceof PeerError) {
        log.warn(
          'An error occurred while executing method admin_subscribe with params',
          params,
        );
        subscriptionId = null;
        statusCode = 2000;
      } else {
        throw e;
      }
    }

    return {
      subscription_id: `${subscriptionId}`,
      status_code: `${statusCode}`,
    };
  },
);

async function adminUnsubscribe (params, dbClient) {
  assertPeer(
    await adminAuth.hasPermission(dbClient, params.api_key, 'admin_unsubscribe'),
    'You do not have sufficient permission to call admin_list_subscriptions method.',
  );

  async function removeSubscription (params, dbClient) {
    let statusCode;

    const subId = +params.user_subscription_id;

    try {
      await subscriptions.removeUserSubscription(dbClient, subId);
      statusCode = '1000';
    } catch (e) {
      if (e instanceof PeerError) {
        log.warn(
          'An error occurred while executing method admin_unsubscribe with params',
          params,
        );
        statusCode = '2000';
      } else {
        throw e;
      }
    }

    return { status_code: `${statusCode}` };
  }

  async function removeAllSubscriptions (params, dbClient) {
    const userId = +params.user_id;
    assertPeer(Number.isInteger(userId), 'user_id must be an integer wrapped in string.');
    let statusCode;
    try {
      await subscriptions.removeAllSubscriptionsOfUser(dbClient, userId);
      statusCode = '1000';
    } catch (e) {
      if (e instanceof PeerError) {
        log.warn(
          'An error occurred while executing method admin_unsubscribe with params',
          params,
        );
        statusCode = '2000';
      } else {
        throw e;
      }
    }
    // this method never fails ?
    return { status_code: statusCode };
  }

  if (params.user_id) {
    return removeAllSubscriptions(params, dbClient);
  } else {
    return removeSubscription(params, dbClient);
  }
}

async function adminEditSubscription (params, dbClient) {
  if (!await adminAuth.hasPermission(dbClient, params.api_key, 'admin_edit_subscription')) {
    return {
      status_code: '2200',
    };
  }

  const userSubId = +params.user_subscription_id;
  const airportFromId = +params.fly_from;
  const airportToId = +params.fly_to;
  const dateFrom = params.date_from;
  const dateTo = params.date_to;

  try {
    const updatedSubscription = await subscriptions.updateUserSubscription(
      dbClient,
      userSubId,
      {
        airportFromId,
        airportToId,
        dateFrom,
        dateTo,
      },
    );

    assertApp(isObject(updatedSubscription), `got ${updatedSubscription}`);

    assertApp(updatedSubscription.updated_at instanceof Date, `got ${updatedSubscription.updated_at}`);

    const updatedAt = updatedSubscription.updated_at.toISOString();

    return {
      updated_at: updatedAt,
      status_code: '1000',
    };
  } catch (e) {
    if (e instanceof PeerError) {
      // TODO somehow make this a decorator ?
      log.warn(
        'An error occurred while executing method admin_edit_subscription with params',
        params,
      );
      if (e.code === 'UPDATE_SUBSCR_BAD_DATE') {
        return { status_code: '2100' };
      } else {
        return { status_code: '2000' };
      }
    } else {
      throw e;
    }
  }
}

async function adminRemoveUser (params, dbClient) {
  assertPeer(
    await adminAuth.hasPermission(dbClient, params.api_key, 'admin_remove_user'),
    'You do not have sufficient permission to call admin_list_subscriptions method.',
  );

  let statusCode;
  const userId = +params.user_id;

  assertPeer(Number.isInteger(userId));

  try {
    await users.removeUser(dbClient, userId);
    statusCode = '1000';
  } catch (e) {
    if (e instanceof PeerError) {
      statusCode = '2000';
    } else {
      throw e;
    }
  }

  return { status_code: statusCode };
}

async function adminEditUser (params, dbClient) {
  if (!await adminAuth.hasPermission(dbClient, params.api_key, 'admin_edit_user')) {
    return { status_code: '2100' };
  }
  if (!Number.isInteger(+params.user_id)) {
    return { status_code: '2200' };
  }

  let statusCode;
  const userId = +params.user_id;
  const { email } = params;
  let password;

  if (params.password) {
    password = users.hashPassword(params.password);
  }

  if (email.indexOf('@') === -1) {
    return { status_code: '2203' };
  }

  if (params.role) {
    if (!Number.isSafeInteger(params.role)) {
      return { status_code: '2204' };
    }

    const selectResult = await dbClient.executeQuery(`

      SELECT *
      FROM roles
      WHERE id = $1;

    `, [params.role]);

    assertApp(isObject(selectResult), `got ${selectResult}`);
    assertApp(Array.isArray(selectResult.rows), `got ${selectResult.rows}`);

    if (selectResult.rows.length !== 1) {
      return { status_code: '2204' };
    }

    await dbClient.executeQuery(`

      UPDATE users_roles
      SET
        role_id = $1,
        updated_at = now()
      WHERE user_id = $2;

    `, [params.role, userId]);
  }

  try {
    await users.editUser(
      dbClient,
      userId,
      {
        email,
        password,
      },
    );
    statusCode = '1000';
  } catch (e) {
    // TODO verify emails
    if (e.code === 'FF_SHORT_EMAIL') {
      statusCode = '2201';
    } else if (e.code === 'FF_SHORT_PASSWORD') {
      statusCode = '2202';
    } else if (e.code === errorCodes.emailTaken) {
      statusCode = '2204';
    } else if (e instanceof PeerError) {
      statusCode = '2000';
    } else {
      throw e;
    }
  }

  return { status_code: statusCode };
}

async function adminListFetches (params, dbClient) {
  assertPeer(
    await adminAuth.hasPermission(dbClient, params.api_key, 'admin_list_fetches'),
    'You do not have sufficient permission to call admin_list_subscriptions method.',
  );

  const fetches = await dbClient.select('fetches');
  return {
    status_code: '1000',
    fetches,
  };
}

async function adminAlterUserCredits (params, dbClient) {
  if (!await adminAuth.hasPermission(dbClient, params.api_key, 'admin_alter_user_credits')) {
    return {
      status_code: '2100',
    };
  }

  if (!Number.isInteger(Number(params.user_id))) {
    return {
      status_code: '2103', // user not found or parameter error ?
    };
  }
  if (!Number.isInteger(+params.credits_difference)) {
    return { status_code: '2103' };
  }

  const selectEmployeeResult = await dbClient.executeQuery(`

    SELECT *
    FROM employees
    WHERE api_key = $1;

  `, [params.api_key]);

  assertApp(isObject(selectEmployeeResult), `got ${selectEmployeeResult}`);
  assertApp(Array.isArray(selectEmployeeResult.rows), `got ${selectEmployeeResult.rows}`);
  assertApp(selectEmployeeResult.rows.length === 1, `got ${selectEmployeeResult.rows.length}`);

  const employeeId = selectEmployeeResult.rows[0].id;

  const userId = Number(params.user_id);
  const amount = Math.abs(params.credits_difference);

  let accountTransfer;

  if (Math.abs(+params.credits_difference) > MAX_CREDITS_DIFFERENCE) {
    return { status_code: '2103' }; // TODO set a new status code at the front end
  } else if (params.credits_difference === 0) {
    return { status_code: '2103' }; // TODO does not fail when user id does not exist.
  } else if (params.credits_difference > 0) {
    try {
      accountTransfer = await accounting.depositCredits(
        dbClient,
        userId,
        amount,
      );
    } catch (e) {
      if (e.code === errorCodes.userDoesNotExist) {
        return { status_code: '2102' };
      } else {
        throw e;
      }
    }
  } else {
    try {
      accountTransfer = await accounting.taxUser(dbClient, userId, amount);
    } catch (e) {
      if (e.code === errorCodes.notEnoughCredits) {
        return { status_code: '2101' };
      } else {
        throw e;
      }
    }
  }

  await accounting.registerTransferByEmployee(
    dbClient,
    accountTransfer.id,
    employeeId,
  );

  return {
    status_code: '1000',
  };
}

const adminAddRole = defineAPIMethod(
  {
    'AAR_INVALID_API_KEY': { status_code: '2100', role_id: null },
    'AAR_BAD_PARAMETERS_FORMAT': { status_code: '2101', role_id: null },
    'AAR_UNKNOWN_PERMISSIONS': { status_code: '2102', role_id: null },
  },
  async (params, dbClient) => {
    assertUser(
      await adminAuth.hasPermission(dbClient, params.api_key, 'admin_add_role'),
      'You do not have sufficient permission to call admin_add_role method.',
      'AAR_INVALID_API_KEY'
    );

    const insertResult = await dbClient.executeQuery(`

      INSERT INTO roles
        (name)
      VALUES
        ($1)
      RETURNING *;

    `, [params.role_name]);

    assertApp(isObject(insertResult), `got ${insertResult}`);
    assertApp(Array.isArray(insertResult.rows), `got ${insertResult.rows}`);
    assertApp(insertResult.rows.length === 1, `got ${insertResult.rows.length}`);
    assertApp(typeof insertResult.rows[0].id === 'number', `got ${insertResult.rows[0].id}`);

    const roleId = insertResult.rows[0].id;

    for (const permissionId of params.permissions) {
      const selectPermissionResult = await dbClient.executeQuery(`

        SELECT *
        FROM permissions
        WHERE id = $1;

      `, [permissionId]);

      assertApp(isObject(selectPermissionResult), `got ${selectPermissionResult}`);
      assertApp(Array.isArray(selectPermissionResult.rows), `got ${selectPermissionResult.rows}`);

      assertUser(
        selectPermissionResult.rows.length === 1,
        'Attempted to create a role with unknown permissions!',
        'AAR_UNKNOWN_PERMISSIONS'
      );

      await dbClient.executeQuery(`

        INSERT INTO roles_permissions
          (role_id, permission_id)
        VALUES
          ($1, $2);

      `, [roleId, permissionId]);
    }

    return {
      status_code: '1000',
      role_id: roleId,
    };
  }
);

const adminEditRole = defineAPIMethod(
  {
    'AER_INVALID_ADMIN_API_KEY': { status_code: '2100' },
    'AER_BAD_PARAMETERS_FORMAT': { status_code: '2101' },
    'AER_UNKNOWN_PERMISSIONS': { status_code: '2102' },
    'AER_UNKNOWN_ROLE': { status_code: '2103' },
  },
  async (params, dbClient) => {
    assertUser(
      await adminAuth.hasPermission(dbClient, params.api_key, 'admin_edit_role'),
      'You do not have sufficient permissions to call admin_edit_role_method',
      'AER_INVALID_ADMIN_API_KEY'
    );

    assertUser(
      typeof params.role_name === 'string' ||
      (Array.isArray(params.permissions) && params.permissions.length > 0),
      'No values for parameters to update!',
      'AER_BAD_PARAMETERS_FORMAT'
    );

    const selectResult = await dbClient.executeQuery(`

      SELECT *
      FROM roles
      WHERE id = $1;

    `, [params.role_id]);

    assertApp(isObject(selectResult), `got ${selectResult}`);
    assertApp(Array.isArray(selectResult.rows), `got ${selectResult.rows}`);

    assertUser(
      selectResult.rows.length === 1,
      'Could found selected role!',
      'AER_UNKNOWN_ROLE'
    );

    if (params.role_name) {
      await dbClient.executeQuery(`

        UPDATE roles
        SET
          name = $1,
          updated_at = now()
        WHERE id = $2;

      `, [params.role_name, params.role_id]);
    }

    if (params.permissions && params.permissions.length > 0) {
      await dbClient.executeQuery(`

        DELETE FROM roles_permissions
        WHERE role_id = $1;

      `, [params.role_id]);

      for (const permissionId of params.permissions) {
        const selectPermissionResult = await dbClient.executeQuery(`

          SELECT *
          FROM permissions
          WHERE id = $1;

        `, [permissionId]);

        assertApp(isObject(selectPermissionResult), `got ${selectPermissionResult}`);
        assertApp(Array.isArray(selectPermissionResult.rows), `got ${selectPermissionResult.rows}`);

        assertUser(
          selectPermissionResult.rows.length === 1,
          'Attempted to give unknown permission to role!',
          'AER_UNKNOWN_PERMISSIONS'
        );

        await dbClient.executeQuery(`

          INSERT INTO roles_permissions
            (role_id, permission_id)
          VALUES
            ($1, $2);

        `, [params.role_id, permissionId]);
      }
    }

    return { status_code: '1000' };
  }
);

const adminRemoveRole = defineAPIMethod(
  {
    'ARR_INVALID_ADMIN_API_KEY': { status_code: '2100' },
    'ARR_BAD_PARAMETERS_FORMAT': { status_code: '2101' },
    'ARR_UNKNOWN_ROLE': { status_code: '2102' },
    'ARR_ROLE_IN_POSSESSION': { status_code: '2201' },
  },
  async (params, dbClient) => {
    assertUser(
      await adminAuth.hasPermission(dbClient, params.api_key, 'admin_remove_role'),
      'You do not have permissions to call admin_remove_role method!',
      'ARR_INVALID_ADMIN_API_KEY'
    );

    const selectRoleResult = await dbClient.executeQuery(`

      SELECT *
      FROM roles
      WHERE id = $1;

    `, [params.role_id]);

    assertApp(isObject(selectRoleResult), `got ${selectRoleResult}`);
    assertApp(Array.isArray(selectRoleResult.rows), `got ${selectRoleResult.rows}`);

    assertUser(
      selectRoleResult.rows.length === 1,
      'Selected role could not be found!',
      'ARR_UNKNOWN_ROLE'
    );

    const selectEmployeeRolePossessionResult = await dbClient.executeQuery(`

      SELECT COUNT(*)::integer AS employee_role_possession_count
      FROM employees_roles
      WHERE role_id = $1;

    `, [params.role_id]);

    assertApp(
      isObject(selectEmployeeRolePossessionResult),
      `got ${selectEmployeeRolePossessionResult}`
    );
    assertApp(
      Array.isArray(selectEmployeeRolePossessionResult.rows),
      `got ${selectEmployeeRolePossessionResult.rows}`
    );
    assertApp(
      selectEmployeeRolePossessionResult.rows.length === 1,
      `got ${selectEmployeeRolePossessionResult.rows.length}`
    );

    const employeeRolePossessionCount =
      selectEmployeeRolePossessionResult.rows[0].employee_role_possession_count;

    assertApp(
      typeof employeeRolePossessionCount === 'number',
      `got ${employeeRolePossessionCount}`
    );

    assertUser(
      employeeRolePossessionCount === 0,
      'Cannot delete role, there are employees having this role!',
      'ARR_ROLE_IN_POSSESSION'
    );

    await dbClient.executeQuery(`

      DELETE FROM roles_permissions
      WHERE role_id = $1;

    `, [params.role_id]);

    await dbClient.executeQuery(`

      DELETE FROM roles
      WHERE id = $1;

    `, [params.role_id]);

    return { status_code: '1000' };
  }
);

const adminListPermissions = defineAPIMethod(
  {
    'ALP_INVALID_ADMIN_API_KEY': { status_code: '2100', permissions: [] },
    'ALP_BAD_PARAMETERS_FORMAT': { status_code: '2101', permissions: [] },
  },
  async (params, dbClient) => {
    assertUser(
      await adminAuth.hasPermission(dbClient, params.api_key, 'admin_list_permissions'),
      'You do not have permissions to call admin_list_permissions method',
      'ALP_INVALID_ADMIN_API_KEY'
    );

    const selectResult = await dbClient.executeQuery(`

      SELECT *
      FROM permissions
      ORDER BY id ASC;

    `);

    assertApp(isObject(selectResult), `got ${selectResult}`);
    assertApp(Array.isArray(selectResult.rows), `got ${selectResult.rows}`);

    const permissions = selectResult.rows.map((row) => {
      assertApp(row.created_at instanceof Date, `got ${row.created_at}`);
      assertApp(row.updated_at instanceof Date, `got ${row.updated_at}`);

      return {
        id: row.id,
        name: row.name,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
      };
    });

    return {
      status_code: '1000',
      permissions,
    };
  }
);

const adminListRoles = defineAPIMethod(
  {
    'ALR_INVALID_ADMIN_API_KEY': { status_code: '2100', roles: [] },
    'ALR_BAD_PARAMETERS_FORMAT': { status_code: '2101', roles: [] },
  },
  async (params, dbClient) => {
    assertUser(
      await adminAuth.hasPermission(dbClient, params.api_key, 'admin_list_roles'),
      'You do not have permissions to call admin_list_roles method!',
      'ALR_INVALID_ADMIN_API_KEY'
    );

    assertUser(
      params.limit > 0 && params.limit <= 20,
      'Expected limit to be 0 < limit <= 20',
      'ALP_BAD_PARAMETERS_FORMAT'
    );

    assertUser(
      Number.isSafeInteger(params.offset) && params.offset >= 0,
      'Expected offset to be a positive integer!',
      'ALP_BAD_PARAMETERS_FORMAT'
    );

    let rolesSelect;

    if (params.role_id) {
      const roleId = Number(params.role_id);
      assertUser(
        Number.isSafeInteger(roleId),
        'Expected role_id to be an integer!',
        'ALP_BAD_PARAMETERS_FORMAT'
      );

      rolesSelect = await dbClient.executeQuery(`

        SELECT *
        FROM roles
        WHERE id = $1;

      `, [roleId]);
    } else {
      rolesSelect = await dbClient.executeQuery(`

        SELECT *
        FROM roles
        ORDER BY id ASC
        LIMIT $1
        OFFSET $2;

      `, [params.limit, params.offset]);
    }

    assertApp(isObject(rolesSelect), `got ${rolesSelect}`);
    assertApp(Array.isArray(rolesSelect.rows), `got ${rolesSelect.rows}`);

    const roles = [];

    for (const role of rolesSelect.rows) {
      assertApp(role.created_at instanceof Date, `got ${role.created_at}`);
      assertApp(role.updated_at instanceof Date, `got ${role.updated_at}`);

      const roleElement = {
        id: role.id,
        name: role.name,
        created_at: role.created_at.toISOString(),
        updated_at: role.updated_at.toISOString(),
      };

      const permissionsSelect = await dbClient.executeQuery(`

        SELECT permissions.id
        FROM roles_permissions
        LEFT JOIN permissions
        ON permissions.id = roles_permissions.permission_id
        WHERE role_id = $1;

      `, [role.id]);

      assertApp(isObject(permissionsSelect), `got ${permissionsSelect}`);
      assertApp(Array.isArray(permissionsSelect.rows), `got ${permissionsSelect.rows}`);

      const permissions = permissionsSelect.rows.map((row) => {
        return row.id;
      });

      roleElement.permissions = permissions;
      roles.push(roleElement);
    }

    return {
      status_code: '1000',
      roles,
    };
  }
);

async function adminGetAPIKey (params, db, ctx) {
  const employee = await adminAuth.getLoggedInEmployee(ctx);

  assertApp(isObject(employee) || employee === null, `got ${employee}`);

  const apiKey = (employee == null) ? null : employee.api_key;
  const statusCode = (apiKey == null) ? '2000' : '1000';

  return {
    api_key: apiKey,
    status_code: statusCode,
  };
}

module.exports = {
  admin_add_role: adminAddRole,
  admin_edit_role: adminEditRole,
  admin_remove_role: adminRemoveRole,
  admin_list_roles: adminListRoles,
  admin_list_permissions: adminListPermissions,
  admin_list_user_subscriptions: adminListUserSubscriptions,
  admin_list_guest_subscriptions: adminListGuestSubscriptions,
  admin_list_users: adminListUsers,
  admin_subscribe: adminSubscribe,
  admin_unsubscribe: adminUnsubscribe,
  admin_edit_subscription: adminEditSubscription,
  admin_remove_user: adminRemoveUser,
  admin_edit_user: adminEditUser,
  admin_list_fetches: adminListFetches, // eslint-disable-line no-unused-vars
  admin_alter_user_credits: adminAlterUserCredits,
  admin_get_api_key: adminGetAPIKey,
};
