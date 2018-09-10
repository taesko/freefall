const crypto = require('crypto');
const { defineAPIMethod } = require('./resolve-method');
const { assertPeer, assertApp, assertUser, UserError } = require('../modules/error-handling');
const { isObject } = require('lodash');
const adminAuth = require('../modules/admin-auth');
const moment = require('moment');
const users = require('../modules/users');
const {
  getAccountTransfers,
  registerTransferByEmployee,
} = require('../modules/accounting');
const caching = require('../modules/caching');

const MAX_CREDITS_DIFFERENCE = Math.pow(10, 12);
const MIN_USER_EMAIL_LENGTH = 3;
const MIN_USER_PASSWORD_LENGTH = 8;

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
      WHERE active = true
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

const adminRemoveUser = defineAPIMethod(
  {
    'ARU_INVALID_API_KEY': { status_code: '2100' },
    'ARU_UNKNOWN_USER': { status_code: '2201' },
    'ARU_BAD_PARAMETERS_FORMAT': { status_code: '2101' },
  },
  async (params, dbClient) => {
    assertUser(
      await adminAuth.hasPermission(dbClient, params.api_key, 'admin_remove_user'),
      'You do not have sufficient permission to call admin_remove_user method.',
      'ARU_INVALID_API_KEY'
    );

    const userId = Number(params.user_id);

    assertUser(
      Number.isSafeInteger(userId),
      'User id is not of expected format!',
      'ARU_BAD_PARAMETERS_FORMAT'
    );

    // no need for try catch,
    // if it fails, it must be an app error
    await dbClient.executeQuery(`

      UPDATE users_subscriptions
      SET active = false
      WHERE user_id = $1;

    `, [
      userId,
    ]);

    // no need for try catch,
    // if it fails, it must be an app error
    const deactivateUserResult = await dbClient.executeQuery(`

      UPDATE users
      SET active = false
      WHERE id = $1
      RETURNING *;

    `, [
      userId,
    ]);

    assertApp(isObject(deactivateUserResult), `got ${deactivateUserResult}`);
    assertApp(Array.isArray(deactivateUserResult.rows), `got ${deactivateUserResult.rows}`);
    assertApp(deactivateUserResult.rows.length <= 1, `got ${deactivateUserResult.rows.length}`);

    assertUser(
      deactivateUserResult.rows.length === 1,
      'User does not exist!',
      'ARU_UNKNOWN_USER'
    );

    // no need for try catch
    // if it fails then it's an app error
    const deleteLoginSessionResult = await dbClient.executeQuery(`

      DELETE FROM login_sessions
      WHERE user_id = $1
      RETURNING *;

    `);

    assertApp(isObject(deleteLoginSessionResult), `${deleteLoginSessionResult}`);
    assertApp(Array.isArray(deleteLoginSessionResult.rows), `got ${deleteLoginSessionResult.rows}`);
    assertApp(deleteLoginSessionResult.rows.length <= 1, `got ${deleteLoginSessionResult.rows.length}`);

    if (deleteLoginSessionResult.rows.length === 1) {
      const token = deleteLoginSessionResult.rows[0].token;
      caching.SESSION_CACHE.remove(token);
    }

    return { status_code: '1000' };
  }
);

const adminEditUser = defineAPIMethod(
  {
    'AEU_EMAIL_TAKEN': { status_code: '2001' },
    'AEU_USER_NOT_EXIST': { status_code: '2002' },
    'AEU_INVALID_API_KEY_': { status_code: '2100' },
    'AEU_BAD_PARAMETERS_FORMAT': { status_code: '2200' },
    'AEU_EMAIL_TOO_SHORT': { status_code: '2201' },
    'AEU_PASSWORD_TOO_SHORT': { status_code: '2202' },
    'AEU_INVALID_EMAIL': { status_code: '2203' },
  },
  async (params, dbClient) => {
    assertUser(
      await adminAuth.hasPermission(dbClient, params.api_key, 'admin_edit_user'),
      'You do not have permission to call admin_edit_user method!',
      'AEU_INVALID_API_KEY'
    );

    const userId = Number(params.user_id);

    assertUser(
      Number.isSafeInteger(userId),
      'User id is not of expected format!',
      'AEU_BAD_PARAMETERS_FORMAT'
    );

    let email = null;
    let hashedPassword = null;

    if (params.password) {
      assertUser(
        params.password.length >= MIN_USER_PASSWORD_LENGTH,
        'Password too short!',
        'AEU_PASSWORD_TOO_SHORT'
      );

      hashedPassword = users.hashPassword(params.password);
    }

    if (params.email) {
      assertUser(
        params.email.indexOf('@') !== -1,
        'Invalid email!',
        'AEU_INVALID_EMAIL'
      );

      assertUser(
        params.email.length >= MIN_USER_EMAIL_LENGTH,
        'Email too short!',
        'AEU_EMAIL_TOO_SHORT'
      );

      email = params.email;
    }

    let updateUserResult;

    try {
      updateUserResult = await dbClient.executeQuery(`

        UPDATE users
        SET
          email = COALESCE($1, email),
          password = COALESCE($2, password)
        WHERE
          active = true AND
          id = $3
          RETURNING *;

      `, [
        email,
        hashedPassword,
        userId,
      ]);
    } catch (error) {
      // TODO verify emails
      if (error.code === '23514' && error.constraint === 'check_email_length') {
        throw new UserError('Email too short!', 'AEU_EMAIL_TOO_SHORT');
      } else if (error.code === '23505') {
        throw new UserError('Email already taken!', 'AEU_EMAIL_TAKEN');
      } else {
        throw error;
      }
    }

    assertApp(isObject(updateUserResult), `got ${updateUserResult}`);
    assertApp(Array.isArray(updateUserResult.rows), `got ${updateUserResult.rows}`);
    assertApp(updateUserResult.rows.length <= 1, `got ${updateUserResult.rows.length}`);

    assertUser(
      updateUserResult.rows.length === 1,
      'User does not exist!',
      'AEU_USER_NOT_EXIST'
    );

    return { status_code: '1000' };
  }
);

const adminAlterUserCredits = defineAPIMethod(
  {
    'AAUC_INVALID_API_KEY': { status_code: '2100' },
    'AAUC_INSUFFICIENT_CREDITS': { status_code: '2101' },
    'AAUC_INVALID_CREDITS_DIFFERENCE': { status_code: '2104' },
    'AAUC_UNKNOWN_USER': { status_code: '2102' },
    'AAUC_BAD_PARAMETERS_FORMAT': { status_code: '2103' },
  },
  async (params, dbClient) => {
    assertUser(
      await adminAuth.hasPermission(dbClient, params.api_key, 'admin_alter_user_credits'),
      'You do not have permission to call admin_alter_user_credits method!',
      'AAUC_INVALID_API_KEY'
    );

    const userId = Number(params.user_id);
    const creditsDifference = Number(params.credits_difference);

    assertUser(
      Number.isSafeInteger(userId),
      'User id was not in expected format!',
      'AAUC_BAD_PARAMETERS_FORMAT'
    );

    assertUser(
      Number.isSafeInteger(creditsDifference),
      'Credits difference was not in expected format!',
      'AAUC_BAD_PARAMETERS_FORMAT'
    );

    assertUser(
      Math.abs(creditsDifference) <= MAX_CREDITS_DIFFERENCE,
      'Credits difference too large!',
      'AAUC_INVALID_CREDITS_DIFFERENCE'
    );

    assertUser(
      creditsDifference !== 0,
      'Credits difference can not be 0!',
      'AAUC_INVALID_CREDITS_DIFFERENCE'
    );

    let accountTransferInsertResult, updateCreditsResult;

    try {
      updateCreditsResult = await dbClient.executeQuery(`

        UPDATE users
        SET credits = credits + $1
        WHERE
          id=$2 AND
          active=true
        RETURNING *;

      `, [
        creditsDifference,
        userId,
      ]);

      accountTransferInsertResult = await dbClient.executeQuery(`

        INSERT INTO account_transfers
          (user_id, transfer_amount, transferred_at)
        VALUES
          ($1, $2, $3)
        RETURNING *;

      `, [
        userId,
        creditsDifference,
        (new Date()).toISOString(),
      ]);
    } catch (error) {
      if (error.code === '23503') { // foreign key constraint, for account_transfers user_id
        throw new UserError('User does not exist!', 'AAUC_UNKNOWN_USER');
      } else if (error.code === '23514' && error.constraint === 'users_credits_check') { // check constraint, for user credits amount >= 0
        throw new UserError('User does not have enough credits!', 'AAUC_INSUFFICIENT_CREDITS');
      } else {
        throw error;
      }
    }

    assertApp(isObject(updateCreditsResult), `got ${updateCreditsResult}`);
    assertApp(Array.isArray(updateCreditsResult.rows), `got ${updateCreditsResult}`);
    assertApp(updateCreditsResult.rows.length <= 1, `got ${updateCreditsResult.rows.length}`);

    assertUser(
      updateCreditsResult.rows.length === 1,
      'User does not exist!',
      'AAUC_UNKNOWN_USER'
    );

    assertApp(isObject(accountTransferInsertResult), `got ${accountTransferInsertResult}`);
    assertApp(Array.isArray(accountTransferInsertResult.rows), `got ${accountTransferInsertResult}`);
    assertApp(accountTransferInsertResult.rows.length === 1, `got ${accountTransferInsertResult.rows.length}`);

    const accountTransferId = accountTransferInsertResult.rows[0].id;

    const selectEmployeeResult = await dbClient.executeQuery(`

      SELECT *
      FROM employees
      WHERE api_key = $1;

    `, [params.api_key]);

    assertApp(isObject(selectEmployeeResult), `got ${selectEmployeeResult}`);
    assertApp(Array.isArray(selectEmployeeResult.rows), `got ${selectEmployeeResult.rows}`);
    assertApp(selectEmployeeResult.rows.length <= 1, `got ${selectEmployeeResult.rows.length}`);

    assertUser(
      selectEmployeeResult.rows.length === 1,
      'Employee does not exist!',
      'AAUC_INVALID_API_KEY'
    );

    const employeeId = selectEmployeeResult.rows[0].id;

    try {
      await registerTransferByEmployee(
        dbClient,
        accountTransferId,
        employeeId,
      );
    } catch (error) {
      if (error.code === '23503' && error.constraint === 'account_transfers_by_employees_employee_id_fkey') {
        throw new UserError('Employee does not exist!', 'AAUC_INVALID_API_KEY');
      } else {
        throw error;
      }
    }

    return {
      status_code: '1000',
    };
  }
);

const adminAddRole = defineAPIMethod(
  {
    'AAR_INVALID_API_KEY': { status_code: '2100', role_id: null },
    'AAR_BAD_PARAMETERS_FORMAT': { status_code: '2101', role_id: null },
    'AAR_UNKNOWN_PERMISSIONS': { status_code: '2102', role_id: null },
    'AAR_ALREADY_EXISTS': { status_code: '2103', role_id: null },
  },
  async (params, dbClient) => {
    assertUser(
      await adminAuth.hasPermission(dbClient, params.api_key, 'admin_add_role'),
      'You do not have sufficient permission to call admin_add_role method.',
      'AAR_INVALID_API_KEY'
    );

    let insertResult;

    try {
      insertResult = await dbClient.executeQuery(`

        INSERT INTO roles
          (name)
        VALUES
          ($1)
        RETURNING *;

      `, [params.role_name]);
    } catch (error) {
      if (error.code === '23505') { // unique constraint violation
        throw new UserError('Role with this name already exists!', 'AAR_ALREADY_EXISTS');
      } else {
        throw error;
      }
    }

    assertApp(isObject(insertResult), `got ${insertResult}`);
    assertApp(Array.isArray(insertResult.rows), `got ${insertResult.rows}`);
    assertApp(insertResult.rows.length === 1, `got ${insertResult.rows.length}`);
    assertApp(typeof insertResult.rows[0].id === 'number', `got ${insertResult.rows[0].id}`);

    const roleId = insertResult.rows[0].id;

    assertUser(
      (new Set(params.permissions)).size === params.permissions.length,
      'Expected permission ids to be unique!',
      'AAR_BAD_PARAMETERS_FORMAT'
    );

    for (const permissionId of params.permissions) {
      try {
        await dbClient.executeQuery(`

          INSERT INTO roles_permissions
            (role_id, permission_id)
          VALUES
            ($1, $2);

        `, [roleId, permissionId]);
      } catch (error) {
        if (error.code === '23503' && error.constraint === 'roles_permissions_permission_id_fkey') { // foreign key constraint violation
          throw new UserError('Attempted to create a role with unknown permissions!', 'AAR_UNKNOWN_PERMISSIONS');
        } else {
          throw error;
        }
      }
    }

    return {
      status_code: '1000',
      role_id: roleId,
    };
  }
);

const adminEditRole = defineAPIMethod(
  {
    'AER_INVALID_ADMIN_API_KEY': { status_code: '2100', updated_at: null },
    'AER_BAD_PARAMETERS_FORMAT': { status_code: '2101', updated_at: null },
    'AER_UNKNOWN_PERMISSIONS': { status_code: '2102', updated_at: null },
    'AER_UNKNOWN_ROLE': { status_code: '2103', updated_at: null },
    'AER_ROLE_NAME_EXISTS': { status_code: '2104', updated_at: null },
    'AER_REQUEST_CONFLICT': { status_code: '2201', updated_at: null },
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

    let roleUpdatedAt = selectResult.rows[0].updated_at;

    if (params.role_name) {
      let updateRoleResult;

      try {
        updateRoleResult = await dbClient.executeQuery(`

          UPDATE roles
          SET
            name = $1,
            updated_at = now()
          WHERE id = $2
          RETURNING *;

        `, [params.role_name, params.role_id]);
      } catch (error) {
        if (error.code === '23505') { // unique key constraint violation
          throw new UserError('Role with that name already exists!', 'AER_ROLE_NAME_EXISTS');
        } else {
          throw error;
        }
      }

      assertApp(isObject(updateRoleResult), `got ${updateRoleResult}`);
      assertApp(Array.isArray(updateRoleResult.rows), `got ${updateRoleResult.rows}`);
      assertApp(updateRoleResult.rows.length <= 1, `got ${updateRoleResult.rows.length}`);

      assertUser(
        updateRoleResult.rows.length === 1,
        'Could not find selected role!',
        'AER_UNKNOWN_ROLE'
      );

      roleUpdatedAt = updateRoleResult.rows[0].updated_at;
    }

    if (params.permissions && params.permissions.length > 0) {
      assertUser(
        (new Set(params.permissions)).size === params.permissions.length,
        'Expected permission ids to be unique!',
        'AER_BAD_PARAMETERS_FORMAT'
      );

      await dbClient.executeQuery(`

        DELETE FROM roles_permissions
        WHERE role_id = $1;

      `, [params.role_id]);

      for (const permissionId of params.permissions) {
        let insertRolePermissionResult;

        try {
          insertRolePermissionResult = await dbClient.executeQuery(`

            INSERT INTO roles_permissions
              (role_id, permission_id)
            VALUES
              ($1, $2)
            RETURNING *;

          `, [params.role_id, permissionId]);
        } catch (error) {
          if (error.code === '23503' && error.constraint === 'roles_permissions_permission_id_fkey') {
            throw new UserError('Attempted to give unknown permission to role!', 'AER_UNKNOWN_PERMISSIONS');
          } else if (error.code === '23503' && error.constraint === 'roles_permissions_role_id_fkey') {
            throw new UserError('Could not find selected role!', 'AER_UNKNOWN_ROLE');
          } else if (error.code === '23505') { // unique key constraint violation
            throw new UserError('Role permission unexpectedly already inserted. There was a request conflict.', 'AER_REQUEST_CONFLICT');
          } else {
            throw error;
          }
        }

        assertApp(isObject(insertRolePermissionResult), `got ${insertRolePermissionResult}`);
        assertApp(Array.isArray(insertRolePermissionResult.rows), `got ${insertRolePermissionResult.rows}`);
        assertApp(insertRolePermissionResult.rows.length === 1, `got ${insertRolePermissionResult.rows.length}`);

        roleUpdatedAt = insertRolePermissionResult.rows[0].updated_at;
      }
    }

    return {
      status_code: '1000',
      updated_at: roleUpdatedAt.toISOString(),
    };
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
      'ALR_BAD_PARAMETERS_FORMAT'
    );

    assertUser(
      Number.isSafeInteger(params.offset) && params.offset >= 0,
      'Expected offset to be a positive integer!',
      'ALR_BAD_PARAMETERS_FORMAT'
    );

    let rolesSelect;

    if (params.role_id) {
      const roleId = Number(params.role_id);
      assertUser(
        Number.isSafeInteger(roleId),
        'Expected role_id to be an integer!',
        'ALR_BAD_PARAMETERS_FORMAT'
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

const adminAddEmployee = defineAPIMethod(
  {
    'AAE_INVALID_ADMIN_API_KEY': { status_code: '2100', employee: null },
    'AAE_BAD_PARAMETERS_FORMAT': { status_code: '2101', employee: null },
    'AAE_EMPLOYEE_EXISTS': { status_code: '2201', employee: null },
    'AAE_UNKNOWN_ROLE': { status_code: '2202', employee: null },
  },
  async (params, dbClient) => {
    assertUser(
      await adminAuth.hasPermission(dbClient, params.api_key, 'admin_add_employee'),
      'You do not have permission to call admin_add_employee method!',
      'AAE_INVALID_ADMIN_API_KEY'
    );

    assertUser(
      params.email.indexOf('@') >= 0,
      'Email is not in expected format!',
      'AAE_BAD_PARAMETERS_FORMAT'
    );

    const passwordHashed = crypto.createHash('md5').update(params.password).digest('hex');
    const newAPIKey = crypto.createHash('md5').update(`${params.email}:${params.password}`).digest('hex');

    let employeeInsertResult;

    try {
      employeeInsertResult = await dbClient.executeQuery(`

        INSERT INTO employees
          (email, password, api_key)
        VALUES
          ($1, $2, $3)
        RETURNING *;

      `, [
        params.email,
        passwordHashed,
        newAPIKey,
      ]);
    } catch (error) {
      if (error.code === '23505') { // unique key constraint violation
        throw new UserError('Employee already exists!', 'AAE_EMPLOYEE_EXISTS');
      } else if (error.code === '23514') { // check violation
        throw new UserError('Parameters not in correct format', 'AAE_BAD_PARAMETERS_FORMAT');
      } else {
        throw error;
      }
    }

    assertApp(isObject(employeeInsertResult), `got ${employeeInsertResult}`);
    assertApp(
      Array.isArray(employeeInsertResult.rows),
      `got ${employeeInsertResult.rows}`
    );
    assertApp(
      employeeInsertResult.rows.length === 1,
      `got ${employeeInsertResult.rows.length}`
    );

    const newEmployee = employeeInsertResult.rows[0];
    let employeeRoleInsertResult;

    try {
      employeeRoleInsertResult = await dbClient.executeQuery(`

        INSERT INTO employees_roles
          (employee_id, role_id)
        VALUES
          ($1, $2)
        RETURNING *;

      `, [
        newEmployee.id,
        params.role_id,
      ]);
    } catch (error) {
      if (error.code === '23503' && error.constraint === 'employees_roles_role_id_fkey') {
        throw new UserError('You have tried to set an unknown role', 'AAE_UNKNOWN_ROLE');
      } else {
        throw error;
      }
    }

    assertApp(
      isObject(employeeRoleInsertResult),
      `got ${employeeRoleInsertResult}`
    );
    assertApp(
      Array.isArray(employeeRoleInsertResult.rows),
      `got ${employeeRoleInsertResult.rows}`
    );
    assertApp(
      employeeRoleInsertResult.rows.length === 1,
      `got ${employeeRoleInsertResult.rows.length}`
    );

    const newEmployeeRole = employeeRoleInsertResult.rows[0];

    return {
      status_code: '1000',
      employee: {
        id: String(newEmployee.id),
        email: newEmployee.email,
        active: newEmployee.active,
        role_id: params.role_id,
        role_updated_at: newEmployeeRole.updated_at.toISOString(),
      },
    };
  }
);

const adminEditEmployee = defineAPIMethod(
  {
    'AEE_INVALID_ADMIN_API_KEY': { status_code: '2100', employee: null },
    'AEE_BAD_PARAMETERS_FORMAT': { status_code: '2101', employee: null },
    'AEE_EMPLOYEE_NOT_FOUND': { status_code: '2201', employee: null },
    'AEE_UNKNOWN_ROLE': { status_code: '2202', employee: null },
    'AEE_EMAIL_TAKEN': { status_code: '2203', employee: null },
  },
  async (params, dbClient) => {
    assertUser(
      await adminAuth.hasPermission(dbClient, params.api_key, 'admin_edit_employee'),
      'You do not have permission to call admin_edit_employee method!',
      'AEE_INVALID_ADMIN_API_KEY'
    );

    const employeeId = Number(params.employee_id);

    assertUser(
      Number.isSafeInteger(employeeId),
      'Employee id is not of expected format!',
      'AEE_BAD_PARAMETERS_FORMAT'
    );

    const setParams = {
      email: null,
      password: null,
      role_id: null,
    };

    if (params.email) {
      assertUser(
        params.email.indexOf('@') >= 0,
        'Email is not in expected format!',
        'AEE_BAD_PARAMETERS_FORMAT'
      );

      setParams.email = params.email;
    }

    if (params.password) {
      setParams.password = crypto.createHash('md5').update(params.password).digest('hex');
    }

    if (params.role_id) {
      const roleSelectResult = await dbClient.executeQuery(`

        SELECT *
        FROM roles
        WHERE id = $1;

      `, [
        params.role_id,
      ]);

      assertApp(isObject(roleSelectResult), `got ${roleSelectResult}`);
      assertApp(
        Array.isArray(roleSelectResult.rows),
        `got ${roleSelectResult.rows}`
      );
      assertApp(
        roleSelectResult.rows.length <= 1,
        `got ${roleSelectResult.rows.length}`
      );

      assertUser(
        roleSelectResult.rows.length === 1,
        'You have tried to set an unknown role',
        'AEE_UNKNOWN_ROLE'
      );

      setParams.role_id = params.role_id;
    }

    let employeeUpdateResult;

    try {
      employeeUpdateResult = await dbClient.executeQuery(`

        UPDATE employees
        SET
          email = COALESCE($1, email),
          password = COALESCE($2, password)
        WHERE id = $3
        RETURNING *;

      `, [
        setParams.email,
        setParams.password,
        employeeId,
      ]);
    } catch (error) {
      if (error.code === '23505') { // unique key constraint violation
        throw new UserError('Email already taken!', 'AEE_EMAIL_TAKEN');
      } else if (error.code === '23514') { // check constraint violation
        throw new UserError('Params were not in expected format.', 'AEE_BAD_PARAMETERS_FORMAT');
      } else {
        throw error;
      }
    }

    assertApp(isObject(employeeUpdateResult), `got ${employeeUpdateResult}`);
    assertApp(
      Array.isArray(employeeUpdateResult.rows),
      `got ${employeeUpdateResult.rows}`
    );
    assertApp(
      employeeUpdateResult.rows.length <= 1,
      `got ${employeeUpdateResult.rows.length}`
    );

    assertUser(
      employeeUpdateResult.rows.length === 1,
      'Employee not found!',
      'AEE_EMPLOYEE_NOT_FOUND'
    );

    let employeeRoleUpdateResult;

    try {
      employeeRoleUpdateResult = await dbClient.executeQuery(`

        UPDATE employees_roles
        SET
          role_id = COALESCE($1, role_id),
          updated_at = now()
        WHERE employee_id = $2
        RETURNING *;

      `, [
        setParams.role_id,
        employeeId,
      ]);
    } catch (error) {
      if (error.code === '23503' && error.constraint === 'employees_roles_role_id_fkey') {
        throw new UserError('You have tried to set an unknown role', 'AEE_UNKNOWN_ROLE');
      } else {
        throw error;
      }
    }

    assertApp(isObject(employeeRoleUpdateResult), `got ${employeeRoleUpdateResult}`);
    assertApp(
      Array.isArray(employeeRoleUpdateResult.rows),
      `got ${employeeRoleUpdateResult.rows}`
    );

    // Each employee must have exactly one role in this rbac implementation
    assertUser(
      employeeRoleUpdateResult.rows.length === 1,
      'Employee not found!',
      'AEE_EMPLOYEE_NOT_FOUND'
    );

    const editedEmployee = employeeUpdateResult.rows[0];
    const editedEmployeeRole = employeeRoleUpdateResult.rows[0];

    return {
      status_code: '1000',
      employee: {
        id: String(editedEmployee.id),
        email: editedEmployee.email,
        active: editedEmployee.active,
        role_id: editedEmployeeRole.role_id,
        role_updated_at: editedEmployeeRole.updated_at.toISOString(),
      },
    };
  }
);

const adminRemoveEmployee = defineAPIMethod(
  {
    'ARE_INVALID_ADMIN_API_KEY': { status_code: '2100' },
    'ARE_BAD_PARAMETERS_FORMAT': { status_code: '2101' },
    'ARE_EMPLOYEE_NOT_FOUND': { status_code: '2201' },
  },
  async (params, dbClient) => {
    assertUser(
      await adminAuth.hasPermission(dbClient, params.api_key, 'admin_remove_employee'),
      'You do not have permission to call admin_remove_employee method!',
      'ARE_INVALID_ADMIN_API_KEY'
    );

    const employeeId = Number(params.employee_id);

    assertUser(
      Number.isSafeInteger(employeeId),
      'Employee id is not of expected format!',
      'ARE_BAD_PARAMETERS_FORMAT'
    );

    const employeeUpdateResult = await dbClient.executeQuery(`

      UPDATE employees
      SET active = false
      WHERE id = $1
      RETURNING *;

    `, [
      employeeId,
    ]);

    assertApp(isObject(employeeUpdateResult), `got ${employeeUpdateResult}`);
    assertApp(
      Array.isArray(employeeUpdateResult.rows),
      `got ${employeeUpdateResult.rows}`
    );
    assertApp(
      employeeUpdateResult.rows.length <= 1,
      `got ${employeeUpdateResult.rows.length}`
    );

    assertUser(
      employeeUpdateResult.rows.length === 1,
      'Employee id not found!',
      'ARE_EMPLOYEE_NOT_FOUND'
    );

    return {
      status_code: '1000',
    };
  }
);

const adminListEmployees = defineAPIMethod(
  {
    'ALE_INVALID_ADMIN_API_KEY': { status_code: '2100', employees: [] },
    'ALE_BAD_PARAMETERS_FORMAT': { status_code: '2101', employees: [] },
  },
  async (params, dbClient) => {
    assertUser(
      await adminAuth.hasPermission(dbClient, params.api_key, 'admin_list_employees'),
      'You do not have permissions to call admin_list_employees method!',
      'ALE_INVALID_ADMIN_API_KEY'
    );

    assertUser(
      params.limit > 0 && params.limit <= 20,
      'Expected limit to be 0 < limit <= 20',
      'ALE_BAD_PARAMETERS_FORMAT'
    );

    assertUser(
      Number.isSafeInteger(params.offset) && params.offset >= 0,
      'Expected offset to be a positive integer!',
      'ALE_BAD_PARAMETERS_FORMAT'
    );

    const employeesSelectResult = await dbClient.executeQuery(`

      SELECT
        employees.id::text,
        employees.email,
        employees.active,
        employees_roles.role_id,
        employees_roles.updated_at AS role_updated_at
      FROM employees
      JOIN employees_roles
        ON employees.id = employees_roles.employee_id
      WHERE employees.active = true
      ORDER BY employees.id
      LIMIT $1
      OFFSET $2;

    `, [
      params.limit,
      params.offset,
    ]);

    assertApp(isObject(employeesSelectResult), `got ${employeesSelectResult}`);
    assertApp(
      Array.isArray(employeesSelectResult.rows),
      `got ${employeesSelectResult.rows}`
    );

    return {
      status_code: '1000',
      employees: employeesSelectResult.rows.map((row) => {
        return {
          ...row,
          role_updated_at: row.role_updated_at.toISOString(),
        };
      }),
    };
  }
);

const adminListAccountTransfers = defineAPIMethod(
  {
    'ALAT_INVALID_ADMIN_API_KEY': { status_code: '2100', account_transfers: [] },
    'ALAT_BAD_PATAMETERS': { status_code: '2101', account_transfers: [] },
  },
  async (params, dbClient) => {
    assertUser(
      await adminAuth.hasPermission(dbClient, params.api_key, 'admin_list_transfers'),
      'You do not have permissions to call admin_list_account_transfers method!',
      'ALAT_INVALID_ADMIN_API_KEY'
    );

    // setting default filters
    const filters = {
      user_email: null,
      deposits: true,
      withdrawals: true,
      transfers_by_employees: true,
      new_subsctiption_taxes: true,
      new_fetch_taxes: true,
      date_from: null,
      date_to: null,
    };

    if (params.user_email) {
      filters.user_email = params.user_email;
    }

    // TODO validate dates

    if (params.type && params.type !== 'all') {
      if (params.type !== 'deposits') {
        filters.deposits = false;
      }

      if (params.type !== 'withdrawals') {
        filters.withdrawals = false;
      }
    }

    if (params.reason && params.reason !== 'all') {
      if (params.reason !== 'employee') {
        filters.transfers_by_employees = false;
      }

      if (params.reason !== 'new-subscription') {
        filters.new_subsctiption_taxes = false;
      }

      if (params.reason !== 'fetch') {
        filters.new_fetch_taxes = false;
      }
    }

    const accountTransfers = await getAccountTransfers(dbClient, filters);

    return {
      status_code: '1000',
      account_transfers: accountTransfers,
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
  admin_add_employee: adminAddEmployee,
  admin_edit_employee: adminEditEmployee,
  admin_remove_employee: adminRemoveEmployee,
  admin_list_employees: adminListEmployees,
  admin_list_user_subscriptions: adminListUserSubscriptions,
  admin_list_guest_subscriptions: adminListGuestSubscriptions,
  admin_list_users: adminListUsers,
  admin_remove_user: adminRemoveUser,
  admin_edit_user: adminEditUser,
  admin_alter_user_credits: adminAlterUserCredits,
  admin_list_account_transfers: adminListAccountTransfers,
  admin_get_api_key: adminGetAPIKey,
};
