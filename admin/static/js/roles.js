function start () {
  const mainUtils = main();
  const ApplicationError = mainUtils.ApplicationError;
  const assertApp = mainUtils.assertApp;
  const assertUser = mainUtils.assertUser;
  const assertPeer = mainUtils.assertPeer;
  const PROTOCOL_NAME = mainUtils.PROTOCOL_NAME;
  const RESULTS_LIMIT = 20;

  const adminAPI = getAdminAPIMethods(mainUtils);

  var permissions = []; // eslint-disable-line no-var
  var permissionsOffset = 0; // eslint-disable-line no-var
  var roles = []; // eslint-disable-line no-var
  var rolesOffset = 0; // eslint-disable-line no-var
  var newRolePermissions = []; // eslint-disable-line no-var
  var rowIdNewRolePermissionMap = {}; // eslint-disable-line no-var
  var APIKeyRef = mainUtils.APIKeyRef; // eslint-disable-line no-var

  function showPermissions () {
    $('#permissions-results').removeAttr('hidden');
  }

  function hidePermissions () {
    $('#permissions-results').attr('hidden', true);
  }

  function showRoles () {
    $('#roles-results').removeAttr('hidden');
  }

  function hideRoles () {
    $('#roles-results').attr('hidden', true);
  }

  function clearPermissionsTable ($permissionsTable) {
    mainUtils.trace('clearPermissionsTable');

    assertApp($permissionsTable instanceof jQuery, {
      msg: 'Expected $permissionsTable to be instance of jQuery, but was =' + $permissionsTable, // eslint-disable-line prefer-template
    });

    $permissionsTable.find('tbody tr')
      .not('#permission')
      .remove();
  }

  function clearRolesTable ($rolesTable) {
    mainUtils.trace('clearRolesTable');

    assertApp($rolesTable instanceof jQuery, {
      msg: 'Expected $rolesTable to be instance of jQuery, but was =' + $rolesTable, // eslint-disable-line prefer-template
    });

    $rolesTable.find('tbody')
      .children()
      .not('#role-view-mode')
      .not('#role-edit-mode')
      .remove();
  }

  function renderRolesTable ($rolesTable) {
    mainUtils.trace('renderRolesTable');

    assertApp($rolesTable instanceof jQuery, {
      msg: 'Expected $rolesTable to be instance of jQuery, but was ' + typeof $rolesTable, // eslint-disable-line prefer-template
    });
    assertApp($rolesTable.length === 1, {
      msg: 'Expected only one element in jQuery object, but got ' + $rolesTable.length, // eslint-disable-line prefer-template
    });
    assertApp($rolesTable[0] instanceof window.HTMLTableElement, {
      msg: 'Expected element in jQuery object to be HTMLTableElement, but got ' + typeof $rolesTable[0], // eslint-disable-line prefer-template
    });
    assertApp(roles instanceof Array, {
      msg: 'Expected roles to be instance of array, but was ' + typeof roles, // eslint-disable-line prefer-template
    });

    clearRolesTable($rolesTable);

    const currentPage = rolesOffset / RESULTS_LIMIT + 1;
    // TODO labels

    _.each(roles, function (role) { // eslint-disable-line prefer-arrow-callback
      renderRoleRow('view', role);
    });
  }

  function renderRoleRow (mode, role, $row) {
    mainUtils.trace('renderRoleRow');

    assertApp(_.isObject(role), {
      msg: 'Expected role to be an object, but was =' + role, // eslint-disable-line prefer-template
    });

    assertApp(
      $row == null ||
      $row instanceof jQuery, {
        msg: 'Unexpected type of $row, $row =' + $row, // eslint-disable-line prefer-template
      }
    );

    var rowId = // eslint-disable-line no-var
      ($row == null) ? String(mainUtils.getUniqueId())
        : mainUtils.getElementUniqueId($row[0], 'role-');

    const modes = {
      'view': renderRoleRowViewMode,
      // no need for edit mode
    };

    assertApp(typeof modes[mode] === 'function', {
      msg: 'Expected mode to be allowed mode, but was ' + mode, // eslint-disable-line prefer-template
    });

    modes[mode](role, rowId, $row);

    // TODO apply autocomplete
  }

  function renderRoleRowViewMode (role, rowId, $row) {
    mainUtils.trace('renderRoleRowViewMode');

    const $roleViewModeClone = $('#role-view-mode').clone()
      .removeAttr('hidden')
      .attr('id', 'role-' + rowId); // eslint-disable-line prefer-template

    $roleViewModeClone.find('#role-id-view-mode')
      .attr('id', 'role-id-' + rowId) // eslint-disable-line prefer-template
      .text(role.id);

    $roleViewModeClone.find('#role-name-view-mode')
      .attr('id', 'role-name-' + rowId) // eslint-disable-line prefer-template
      .text(role.name);

    $roleViewModeClone.find('#role-created-at-view-mode')
      .attr('id', 'role-created-at-' + rowId) // eslint-disable-line prefer-template
      .text(role.created_at);

    $roleViewModeClone.find('#role-updated-at-view-mode')
      .attr('id', 'role-updated-at-' + rowId) // eslint-disable-line prefer-template
      .text(role.updated_at);

    $roleViewModeClone.find('#role-open-view-mode')
      .attr('id', 'role-open-' + rowId) // eslint-disable-line prefer-template
      .attr('onclick', 'location.href="/roles/' + Number(role.id) + '";'); // eslint-disable-line prefer-template

    if ($row == null) {
      $roleViewModeClone.appendTo(
        $('#roles-table tbody')
      );
    } else {
      $row.replaceWith($roleViewModeClone);
    }
  }

  function renderPermissionsTable ($permissionsTable) {
    mainUtils.trace('renderPermissionsTable');

    assertApp($permissionsTable instanceof jQuery, {
      msg: 'Expected $permissionsTable to be instance of jQuery, but was ' + typeof $permissionsTable, // eslint-disable-line prefer-template
    });
    assertApp($permissionsTable.length === 1, {
      msg: 'Expected only one element in jQuery object, but got ' + $permissionsTable.length, // eslint-disable-line prefer-template
    });
    assertApp($permissionsTable[0] instanceof window.HTMLTableElement, {
      msg: 'Expected element in jQuery object to be HTMLTableElement, but got ' + typeof $permissionsTable[0], // eslint-disable-line prefer-template
    });
    assertApp(permissions instanceof Array, {
      msg: 'Expected permissions to be instance of array, but was ' + typeof permissions, // eslint-disable-line prefer-template
    });

    clearPermissionsTable($permissionsTable);

    const currentPage = permissionsOffset / RESULTS_LIMIT + 1;
    // TODO labels

    _.each(permissions, function (permission) { // eslint-disable-line prefer-arrow-callback
      renderPermissionRow('view', permission);
    });
  }

  function renderPermissionRow (mode, permission, $row) {
    mainUtils.trace('renderPermissionRow');

    assertApp(_.isObject(permission), {
      msg: 'Expected permission to be an object, but was =' + permission, // eslint-disable-line prefer-template
    });

    assertApp(
      $row == null ||
      $row instanceof jQuery, {
        msg: 'Unexpected type of $row, $row=' + $row, // eslint-disable-line prefer-template
      }
    );

    var rowId = // eslint-disable-line no-var
      ($row == null) ? String(mainUtils.getUniqueId())
        : mainUtils.getElementUniqueId($row[0], 'permission-');

    const modes = {
      'view': renderPermissionRowViewMode,
      // no need for edit mode
    };

    assertApp(typeof modes[mode] === 'function', {
      msg: 'Expected mode to be allowed mode, but was =' + mode, // eslint-disable-line prefer-template
    });

    modes[mode](permission, rowId, $row);
  }

  function renderPermissionRowViewMode (permission, rowId, $row) {
    mainUtils.trace('renderPermissionRowViewMode');

    const $permissionClone = $('#permission').clone()
      .removeAttr('hidden')
      .attr('id', 'permission-' + rowId); // eslint-disable-line prefer-template

    $permissionClone.find('#permission-id')
      .attr('id', 'permission-id-' + rowId) // eslint-disable-line prefer-template
      .text(permission.id);

    $permissionClone.find('#permission-name')
      .attr('id', 'permission-name-' + rowId) // eslint-disable-line prefer-template
      .text(permission.name);

    $permissionClone.find('#permission-created-at')
      .attr('id', 'permission-created-at-' + rowId) // eslint-disable-line prefer-template
      .text(permission.created_at);

    $permissionClone.find('#permission-updated-at')
      .attr('id', 'permission-updated-at-' + rowId) // eslint-disable-line prefer-template
      .text(permission.updated_at);

    if ($row == null) {
      $permissionClone.appendTo(
        $('#permissions-table tbody')
      );
    } else {
      $row.replaceWith($permissionClone);
    }
  }

  function clearNewRolePermissionsTable ($newRolePermissionsTable) {
    mainUtils.trace('clearNewRolePermissionsTable');

    $newRolePermissionsTable.find('tbody')
      .children()
      .not('#new-role-permission-view-mode')
      .not('#new-role-permission-edit-mode')
      .remove();
  }

  function renderNewRolePermissionsTable ($newRolePermissionsTable, mode) {
    mainUtils.trace('renderNewRolePermissionsTable');

    assertApp($newRolePermissionsTable instanceof jQuery, {
      msg: 'Expected $newRolePermissionsTable to be instance of jQuery, but was ' + typeof $newRolePermissionsTable, // eslint-disable-line prefer-template
    });
    assertApp($newRolePermissionsTable.length === 1, {
      msg: 'Expected only one element in jQuery object, but got ' + $newRolePermissionsTable.length, // eslint-disable-line prefer-template
    });
    assertApp($newRolePermissionsTable[0] instanceof window.HTMLTableElement, {
      msg: 'Expected element in jQuery object to be HTMLTableElement, but got ' + typeof $newRolePermissionsTable[0], // eslint-disable-line prefer-template
    });
    assertApp(permissions instanceof Array, {
      msg: 'Expected permissions to be instance of array, but was ' + typeof permissions, // eslint-disable-line prefer-template
    });
    assertApp(typeof mode === 'string', {
      msg: 'Expected mode to be string, but mode=' + mode, // eslint-disable-line prefer-template
    });
    assertApp(['view', 'edit'].indexOf(mode) >= 0, {
      msg: 'Got unexpected mode=' + mode, // eslint-disable-line prefer-template
    });

    clearNewRolePermissionsTable($newRolePermissionsTable);
    rowIdNewRolePermissionMap = {};

    _.each(newRolePermissions, function (newRolePermission) { // eslint-disable-line prefer-arrow-callback
      renderNewRolePermissionRow(mode, newRolePermission);
    });
  }

  function renderNewRolePermissionRow (mode, permission, $row) {
    mainUtils.trace('renderNewRolePermissionRow');

    assertApp(_.isObject(permission), {
      msg: 'Expected permission to be an object, but was =' + permission, // eslint-disable-line prefer-template
    });

    assertApp(
      $row == null ||
      $row instanceof jQuery, {
        msg: 'Unexpected type of $row, $row =' + $row, // eslint-disable-line prefer-template
      }
    );

    var rowId = // eslint-disable-line no-var
      ($row == null) ? String(mainUtils.getUniqueId())
        : mainUtils.getElementUniqueId($row[0], 'role-');

    rowIdNewRolePermissionMap[rowId] = permission;

    const modes = {
      'edit': renderNewRolePermissionRowEditMode,
      // no need for view mode
    };

    assertApp(typeof modes[mode] === 'function', {
      msg: 'Expected mode to be allowed mode, but was ' + mode, // eslint-disable-line prefer-template
    });

    modes[mode](permission, rowId, $row);
  }

  function renderNewRolePermissionRowEditMode (permission, rowId, $row) {
    mainUtils.trace('renderNewRolePermissionRowEditMode');

    const $rolePermissionEditModeClone = $('#new-role-permission-edit-mode').clone()
      .removeAttr('hidden')
      .attr('id', 'new-role-permission-' + rowId); // eslint-disable-line prefer-template

    $rolePermissionEditModeClone.find('#new-role-permission-name-edit-mode')
      .attr('id', 'new-role-permission-name-' + rowId) // eslint-disable-line prefer-template
      .text(permission.name);

    $rolePermissionEditModeClone.find('#remove-new-role-permission-btn-edit-mode')
      .attr('id', 'remove-new-role-permission-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onRemoveNewRolePermissionClick);

    if ($row == null) {
      $rolePermissionEditModeClone.appendTo(
        $('#new-role-permissions-table tbody')
      );
    } else {
      $row.replaceWith($rolePermissionEditModeClone);
    }
  }

  const onRolesTabClick = function () {
    mainUtils.trace('onRolesTabClick');

    if (roles.length > 0) {
      showRoles();
    } else {
      hideRoles();
    }

    $('#roles-section').removeAttr('hidden');
    $('#permissions-section').attr('hidden', true);

    $('#roles-tab').parent().addClass('active');
    $('#permissions-tab').parent().removeClass('active');
  };

  const onPermissionsTabClick = function () {
    mainUtils.trace('onPermissionsTabClick');

    if (permissions.length > 0) {
      showPermissions();
    } else {
      hidePermissions();
    }

    $('#permissions-section').removeAttr('hidden');
    $('#roles-section').attr('hidden', true);

    $('#permissions-tab').parent().addClass('active');
    $('#roles-tab').parent().removeClass('active');
  };

  const onNewRolePermissionSubmitClick = function (event) {
    mainUtils.trace('onNewRolePermissionSubmitClick');
    event.preventDefault();

    const form = event.target;
    const formData = $(form).serializeArray();

    var i; // eslint-disable-line no-var
    var newRolePermissionName; // eslint-disable-line no-var

    for (i = 0; i < formData.length; i++) {
      assertApp(_.isObject(formData[i]), {
        msg: 'Expected each item in formData to be an object, but current item=' + formData[i], // eslint-disable-line prefer-template
      });
      assertApp(typeof formData[i].name === 'string', {
        msg: 'Expected item in formData to have property "name" of type string, but property "name" =' + formData[i].name, // eslint-disable-line prefer-template
      });
      assertApp(typeof formData[i].value === 'string', {
        msg: 'Expected item in formData to have property "value" of type string, but property "value" =' + formData[i].value, // eslint-disable-line prefer-template
      });

      if (formData[i].name === 'permission-select') {
        newRolePermissionName = formData[i].value.trim();
      } else {
        throw new ApplicationError({
          msg: 'Unknown formData name: ' + formData[i].name, // eslint-disable-line prefer-template
        });
      }
    }

    assertApp(typeof newRolePermissionName === 'string', {
      msg: 'Expected newRolePermissionName to be string, but newRolePermissionName=' + newRolePermissionName, // eslint-disable-line prefer-template
    });

    assertUser(newRolePermissionName.length > 0, {
      msg: 'New role permission name was empty when user clicked button Add permission',
      userMessage: 'Please choose a permission!',
    });

    var permission; // eslint-disable-line no-var

    for (i = 0; i < permissions.length; i++) {
      if (permissions[i].name === newRolePermissionName) {
        permission = permissions[i];
        break;
      }
    }

    assertUser(_.isObject(permission), {
      msg: 'User entered name of permission that does not exist.',
      userMessage: 'Selected permission could not be found!',
    });

    for (i = 0; i < newRolePermissions.length; i++) {
      assertApp(newRolePermissions[i].id !== permission.id, {
        msg: 'User entered name of permission that is already assigned or selected to be assigned to role.',
        userMessage: 'Permission already selected to be assigned to role!',
      });
    }

    newRolePermissions.push(permission);
    renderNewRolePermissionRow('edit', permission);
    form.reset();

    return false;
  };

  const onRemoveNewRolePermissionClick = function (event) {
    mainUtils.trace('onRemoveNewRolePermissionClick');

    const removeButton = event.target;
    const rowId = mainUtils.getElementUniqueId(removeButton, 'remove-new-role-permission-btn-');

    const newRolePermission = rowIdNewRolePermissionMap[rowId];
    delete rowIdNewRolePermissionMap[rowId];

    newRolePermissions = newRolePermissions.filter(function (rp) { // eslint-disable-line prefer-arrow-callback
      return rp.id !== newRolePermission.id;
    });

    renderNewRolePermissionsTable($('#new-role-permissions-table'), 'edit');
  };

  const onNewRoleSubmitClick = function (event) {
    mainUtils.trace('onNewRoleSubmitClick');
    event.preventDefault();

    const form = event.target;
    const formData = $(form).serializeArray();

    var i; // eslint-disable-line no-var
    var newRoleName; // eslint-disable-line no-var

    for (i = 0; i < formData.length; i++) {
      assertApp(_.isObject(formData[i]), {
        msg: 'Expected each item in formData to be an object, but current item=' + formData[i], // eslint-disable-line prefer-template
      });
      assertApp(typeof formData[i].name === 'string', {
        msg: 'Expected item in formData to have property "name" of type string, but property "name" =' + formData[i].name, // eslint-disable-line prefer-template
      });
      assertApp(typeof formData[i].value === 'string', {
        msg: 'Expected item in formData to have property "value" of type string, but property "value" =' + formData[i].value, // eslint-disable-line prefer-template
      });

      if (formData[i].name === 'role-name') {
        newRoleName = formData[i].value.trim();
      } else {
        throw new ApplicationError({
          msg: 'Unknown formData name: ' + formData[i].name, // eslint-disable-line prefer-template
        });
      }
    }

    assertApp(typeof newRoleName === 'string', {
      msg: 'Expected newRoleName to be string, but newRoleName=' + newRoleName, // eslint-disable-line prefer-template
    });

    assertUser(newRoleName.length > 0, {
      msg: 'New role name was empty when user clicked button Submit',
      userMessage: 'Please choose a name for role!',
    });

    assertApp(Array.isArray(newRolePermissions), {
      msg: 'Expected newRolePermissions to be array, but newRolePermissions=' + newRolePermissions, // eslint-disable-line prefer-template
    });

    const addRoleParams = {
      v: '2.0',
      api_key: APIKeyRef.APIKey,
      role_name: newRoleName,
      permissions: newRolePermissions.map(function (newRolePermission) { // eslint-disable-line prefer-arrow-callback
        return newRolePermission.id;
      }),
    };

    $(form).off('submit').submit(function (event) { // eslint-disable-line prefer-arrow-callback
      event.preventDefault();
      return false;
    });

    mainUtils.showLoader();

    adminAPI.adminAddRole(
      addRoleParams,
      PROTOCOL_NAME,
      function (result) { // eslint-disable-line prefer-arrow-callback
        $(form).off('submit').submit(onNewRoleSubmitClick);
        newRolePermissions = [];

        const messages = {
          '1000': 'Successfully added new role!',
          '2100': 'Your API key does not support this operation!',
          '2101': 'The form you sent was not in expected format. Please correct any wrong inputs and try again!',
          '2102': 'You have assigned permissions that were not recognised! Please, try again!',
          '2103': 'Role already exists!',
        };

        assertPeer(typeof messages[result.status_code] === 'string', {
          msg: 'Unexpected status code in adminEditRole. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
        });

        const msg = 'Admin add role failed with status code: ' + result.status_code; // eslint-disable-line prefer-template
        const userMessage = messages[result.status_code] || msg;
        assertUser(result.status_code === '1000', {
          msg: msg,
          userMessage: userMessage,
        });

        // TODO if role_id null
        const listRolesParams = {
          v: '2.0',
          api_key: APIKeyRef.APIKey,
          role_id: result.role_id,
          offset: 0,
          limit: RESULTS_LIMIT,
        };

        adminAPI.adminListRoles(
          listRolesParams,
          PROTOCOL_NAME,
          function (result) { // eslint-disable-line prefer-arrow-callback
            mainUtils.hideLoader();

            const messages = {
              '1000': 'Successfully listed roles!',
              '2100': 'Your API key does not support this operation!',
              '2101': 'Could not list roles. Please refresh the page and try again!',
            };

            assertPeer(typeof messages[result.status_code] === 'string', {
              msg: 'Unexpected status code in adminListRoles. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
            });

            const msg = 'Admin list roles failed with status code: ' + result.status_code; // eslint-disable-line prefer-template
            const userMessage = messages[result.status_code] || msg;

            assertUser(result.status_code === '1000', {
              userMessage: userMessage,
              msg: msg,
            });

            assertUser(result.roles.length === 1, {
              msg: 'Newly added role could not be found on server',
              userMessage: 'Newly added role has just been removed! Please try adding it again!',
            });

            const newRole = result.roles[0];
            renderRoleRow('view', newRole);
            clearNewRolePermissionsTable($('#new-role-permissions-table'));

            form.reset();
          }
        );
        mainUtils.displayUserMessage('Successfully added new role!', 'success');
      }
    );

    return false;
  };

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    const $rolesTab = $('#roles-tab');
    const $permissionsTab = $('#permissions-tab');

    $('#new-role-permission-form').submit(onNewRolePermissionSubmitClick);
    $('#new-role-form').submit(onNewRoleSubmitClick);

    adminAPI.adminGetAPIKey({
      v: '2.0',
    }, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      const messages = {
        '1000': 'Successfully got admin API key',
        '2000': 'Admin get API key failed',
      };

      assertPeer(typeof messages[result.status_code] === 'string', {
        msg: 'Unexpected status code in adminGetAPIKey. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
      });

      const msg = 'Admin get API key failed with status code: ' + result.status_code; // eslint-disable-line prefer-template
      const userMessage = messages[result.status_code] || msg;

      assertUser(result.status_code === '1000', {
        userMessage: userMessage,
        msg: msg,
      });

      APIKeyRef.APIKey = result.api_key;

      adminAPI.adminListPermissions(
        {
          v: '2.0',
          api_key: APIKeyRef.APIKey,
        },
        PROTOCOL_NAME,
        function (result) { // eslint-disable-line prefer-arrow-callback
          const messages = {
            '1000': 'Successfully listed permissions!',
            '2100': 'Your API key does not support this operation!',
            '2101': 'Could not list permissions. Please refresh the page and try again!',
          };

          assertPeer(typeof messages[result.status_code] === 'string', {
            msg: 'Unexpected status code in adminListPermissions. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
          });

          const msg = 'Admin list permissions failed with status code: ' + result.status_code; // eslint-disable-line prefer-template
          const userMessage = messages[result.status_code] || msg;
          assertUser(result.status_code === '1000', {
            userMessage: userMessage,
            msg: msg,
          });

          permissions = result.permissions;
          $('.permission-select').autocomplete(permissions.map(function (permission) { // eslint-disable-line prefer-arrow-callback
            return permission.name;
          }));

          $permissionsTab.click(onPermissionsTabClick);
          renderPermissionsTable($('#permissions-table'));

          adminAPI.adminListRoles(
            {
              v: '2.0',
              api_key: APIKeyRef.APIKey,
              offset: 0,
              limit: RESULTS_LIMIT,
            },
            PROTOCOL_NAME,
            function (result) { // eslint-disable-line prefer-arrow-callback
              mainUtils.hideLoader();

              const messages = {
                '1000': 'Successfully listed roles!',
                '2100': 'Your API key does not support this operation!',
                '2101': 'Could not list roles. Please refresh the page and try again!',
              };

              assertPeer(typeof messages[result.status_code] === 'string', {
                msg: 'Unexpected status code in adminListRoles. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
              });

              const msg = 'Admin list roles failed with status code: ' + result.status_code; // eslint-disable-line prefer-template
              const userMessage = messages[result.status_code] || msg;

              assertUser(result.status_code === '1000', {
                userMessage: userMessage,
                msg: msg,
              });

              // TODO check if role permissions are valid according to collected permissions
              roles = result.roles;

              $rolesTab.click(onRolesTabClick);
              renderRolesTable($('#roles-table'));
            }
          );
        }
      );
    });
  });
}

start();
