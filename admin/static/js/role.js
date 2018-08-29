function start () {
  const mainUtils = main();
  const assertApp = mainUtils.assertApp;
  const assertUser = mainUtils.assertUser;
  const assertPeer = mainUtils.assertPeer;
  const PROTOCOL_NAME = mainUtils.PROTOCOL_NAME;
  const RESULTS_LIMIT = 20;

  const adminAPI = getAdminAPIMethods(mainUtils);

  var role; // eslint-disable-line no-var
  var permissions = []; // eslint-disable-line no-var
  var rowIdRoleMap = {}; // eslint-disable-line no-var
  var rolePermissions = []; // eslint-disable-line no-var
  var rowIdRolePermissionMap = {}; // eslint-disable-line no-var
  var APIKeyRef = mainUtils.APIKeyRef; // eslint-disable-line no-var

  function applyAutocomplete (values) {
    $('.permission-select').autocomplete(values);
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

    rowIdRoleMap[rowId] = role;

    const modes = {
      'view': renderRoleRowViewMode,
      'edit': renderRoleRowEditMode,
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

    $roleViewModeClone.find('#role-name-view-mode')
      .attr('id', 'role-name-' + rowId) // eslint-disable-line prefer-template
      .text(role.name);

    $roleViewModeClone.find('#role-created-at-view-mode')
      .attr('id', 'role-created-at-' + rowId) // eslint-disable-line prefer-template
      .text(role.created_at);

    $roleViewModeClone.find('#role-updated-at-view-mode')
      .attr('id', 'role-updated-at-' + rowId) // eslint-disable-line prefer-template
      .text(role.updated_at);

    $roleViewModeClone.find('#role-edit-btn-view-mode')
      .attr('id', 'role-edit-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onEditRoleClick);

    $roleViewModeClone.find('#role-remove-btn-view-mode')
      .attr('id', 'role-remove-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onRemoveRoleClick);

    if ($row == null) {
      $roleViewModeClone.appendTo(
        $('#roles-section')
      );
    } else {
      $row.replaceWith($roleViewModeClone);
    }
  }

  function renderRoleRowEditMode (role, rowId, $row) {
    mainUtils.trace('renderRoleRowEditMode');

    const $roleEditModeClone = $('#role-edit-mode').clone()
      .removeAttr('hidden')
      .attr('id', 'role-' + rowId); // eslint-disable-line prefer-template

    $roleEditModeClone.find('#role-name-edit-mode')
      .attr('id', 'role-name-' + rowId) // eslint-disable-line prefer-template
      .attr('placeholder', role.name)
      .attr('value', role.name);

    $roleEditModeClone.find('#role-created-at-edit-mode')
      .attr('id', 'role-created-at-' + rowId) // eslint-disable-line prefer-template
      .text(role.created_at);

    $roleEditModeClone.find('#role-updated-at-edit-mode')
      .attr('id', 'role-updated-at-' + rowId) // eslint-disable-line prefer-template
      .text(role.updated_at);

    $roleEditModeClone.find('#role-save-btn-edit-mode')
      .attr('id', 'role-save-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onSaveRoleClick);

    $roleEditModeClone.find('#role-cancel-btn-edit-mode')
      .attr('id', 'role-cancel-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onCancelEditRoleClick);

    $roleEditModeClone.find('#add-role-permission')
      .attr('id', 'add-role-permission-' + rowId); // eslint-disable-line prefer-template

    $roleEditModeClone.find('#add-role-permission-submit-btn')
      .attr('id', 'add-role-permission-submit-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onAddRolePermissionClick);

    if ($row == null) {
      $roleEditModeClone.appendTo(
        $('#roles-section')
      );
    } else {
      $row.replaceWith($roleEditModeClone);
    }
  }

  const onEditRoleClick = function (event) {
    mainUtils.trace('onEditRoleClick');

    const rowId = mainUtils.getElementUniqueId(event.target, 'role-edit-btn-');

    renderRoleRow(
      'edit',
      role,
      $('#role-' + rowId) // eslint-disable-line prefer-template
    );

    renderRolePermissionsTable($('#role-permissions-table'), 'edit');
  };

  const onCancelEditRoleClick = function (event) {
    mainUtils.trace('onCancelEditRoleClick');

    const rowId = mainUtils.getElementUniqueId(event.target, 'role-cancel-btn-');

    renderRoleRow(
      'view',
      role,
      $('#role-' + rowId) // eslint-disable-line prefer-template
    );

    rolePermissions = permissions.filter(function (p) { // eslint-disable-line prefer-arrow-callback
      return role.permissions.indexOf(p.id) >= 0;
    });

    renderRolePermissionsTable($('#role-permissions-table'), 'view');
  };

  const onSaveRoleClick = function (event) {
    mainUtils.trace('onSaveRoleClick');

    const saveButton = event.target;

    const rowId = mainUtils.getElementUniqueId(saveButton, 'role-save-btn-');
    const oldRole = rowIdRoleMap[rowId];

    const roleName = $('#role-name-' + rowId).val().trim(); // eslint-disable-line prefer-template

    assertApp(Array.isArray(rolePermissions), {
      msg: 'Expected rolePermissions to be array, but rolePermissions=' + rolePermissions, // eslint-disable-line prefer-template
    });

    assertUser(roleName.length > 0, {
      userMessage: 'Please choose a name for role!',
      msg: 'Expected roleName to be a string with length > 0, but user entered "' + roleName + '"', // eslint-disable-line prefer-template
    });

    saveButton.disabled = true;

    const editRoleParams = {
      v: '2.0',
      api_key: APIKeyRef.APIKey,
      role_id: oldRole.id,
      role_name: roleName,
      permissions: rolePermissions.map(function (rolePermission) { // eslint-disable-line prefer-arrow-callback
        return rolePermission.id;
      }),
    };

    adminAPI.adminEditRole(
      editRoleParams,
      PROTOCOL_NAME,
      function (result) { // eslint-disable-line prefer-arrow-callback
        saveButton.disabled = false;

        const messages = {
          '1000': 'Successfully edited role!',
          '2100': 'Your API key does not support this operation!',
          '2101': 'The form you sent was not in expected format. Please correct any wrong inputs and try again!',
          '2102': 'You have assigned permissions that were not recognized! Please, try again!',
          '2103': 'You have sent a form for editing a role that does not exist!',
        };

        assertPeer(typeof messages[result.status_code] === 'string', {
          msg: 'Unexpected status code in adminEditRole. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
        });

        const msg = 'Edit role failed with status code: ' + result.status_code; // eslint-disable-line prefer-template
        const userMessage = messages[result.status_code] || msg;
        assertUser(result.status_code === '1000', {
          msg: msg,
          userMessage: userMessage,
        });

        const newRole = {
          id: oldRole.id,
          name: roleName,
          permissions: rolePermissions,
          created_at: oldRole.created_at,
          updated_at: oldRole.updated_at, // TODO change to result.updated_at and add support for this on server
        };

        rowIdRoleMap[rowId] = newRole;
        role = newRole;

        renderRoleRow(
          'view',
          newRole,
          $('#role-' + rowId) // eslint-disable-line prefer-template
        );

        renderRolePermissionsTable($('#role-permissions-table'), 'view');

        mainUtils.displayUserMessage('Successfully edited role!', 'success');
      }
    );
  };

  const onRemoveRoleClick = function (event) {
    mainUtils.trace('onRemoveRoleClick');

    const removeButton = event.target;

    removeButton.disabled = true;

    const removeRoleParams = {
      v: '2.0',
      role_id: role.id,
      api_key: APIKeyRef.APIKey,
    };

    adminAPI.adminRemoveRole(
      removeRoleParams,
      PROTOCOL_NAME,
      function (result) { // eslint-disable-line prefer-arrow-callback
        removeButton.disabled = false;

        const messages = {
          '1000': 'Successfully removed role!',
          '2100': 'Your API key does not support this operation!',
          '2101': 'The form you sent was not in expected format. Please correct any wrong inputs and try again!',
          '2102': 'The role you tried to delete does not exist! Please refresh the page and try again!',
          '2201': 'Role is assigned to employeed and can not be deleted.',
        };

        assertPeer(typeof messages[result.status_code] === 'string', {
          msg: 'Unexpected status code in adminRemoveRole. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
        });

        const msg = 'Remove role failed with status code:' + result.status_code; // eslint-disable-line prefer-template
        const userMessage = messages[result.status_code] || msg;

        assertUser(result.status_code === '1000', {
          userMessage: userMessage,
          msg: msg,
        });

        window.location.replace('/roles');
      }
    );
  };

  const onRemoveRolePermissionClick = function (event) {
    mainUtils.trace('onRemoveRolePermissionClick');

    const removeButton = event.target;
    const rowId = mainUtils.getElementUniqueId(removeButton, 'remove-role-permission-btn-');

    const rolePermission = rowIdRolePermissionMap[rowId];
    delete rowIdRolePermissionMap[rowId];

    rolePermissions = rolePermissions.filter(function (rp) { // eslint-disable-line prefer-arrow-callback
      return rp.id !== rolePermission.id;
    });

    renderRolePermissionsTable($('#role-permissions-table'), 'edit');
  };

  const onAddRolePermissionClick = function (event) {
    mainUtils.trace('onAddRolePermissionClick');

    const rowId = mainUtils.getElementUniqueId(event.target, 'add-role-permission-submit-btn-');
    const newRolePermission = $('#add-role-permission-' + rowId).val().trim(); // eslint-disable-line prefer-template

    assertUser(newRolePermission.length > 0, {
      msg: 'New role permission name was empty when user clicked button Add permission',
      userMessage: 'Please choose a permission!',
    });

    var permission; // eslint-disable-line no-var
    var i; // eslint-disable-line no-var

    for (i = 0; i < permissions.length; i++) {
      if (permissions[i].name === newRolePermission) {
        permission = permissions[i];
        break;
      }
    }

    assertUser(_.isObject(permission), {
      msg: 'User entered name of permission that does not exist',
      userMessage: 'Selected permission could not be found!',
    });

    for (i = 0; i < rolePermissions.length; i++) {
      assertApp(rolePermissions[i].id !== permission.id, {
        msg: 'User entered name of permission that is already assigned or selected to be assigned to role.',
        userMessage: 'Permission already selected to be assigned to role!',
      });
    }

    rolePermissions.push(permission);
    renderRolePermissionRow('edit', permission);
  };

  function clearRolePermissionsTable ($rolePermissionsTable) {
    mainUtils.trace('clearRolePermissionsTable');

    $rolePermissionsTable.find('tbody')
      .children()
      .not('#role-permission-view-mode')
      .not('#role-permission-edit-mode')
      .remove();
  }

  function renderRolePermissionsTable ($rolePermissionsTable, mode) {
    mainUtils.trace('renderRolePermissionsTable');

    assertApp($rolePermissionsTable instanceof jQuery, {
      msg: 'Expected $rolePermissionsTable to be instance of jQuery, but was ' + typeof $rolePermissionsTable, // eslint-disable-line prefer-template
    });
    assertApp($rolePermissionsTable.length === 1, {
      msg: 'Expected only one element in jQuery object, but got ' + $rolePermissionsTable.length, // eslint-disable-line prefer-template
    });
    assertApp($rolePermissionsTable[0] instanceof window.HTMLTableElement, {
      msg: 'Expected element in jQuery object to be HTMLTableElement, but got ' + typeof $rolePermissionsTable[0], // eslint-disable-line prefer-template
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

    clearRolePermissionsTable($rolePermissionsTable);
    rowIdRolePermissionMap = {};

    _.each(rolePermissions, function (rolePermission) { // eslint-disable-line prefer-arrow-callback
      renderRolePermissionRow(mode, rolePermission);
    });
  }

  function renderRolePermissionRow (mode, rolePermission, $row) {
    mainUtils.trace('renderRolePermissionRow');

    assertApp(_.isObject(rolePermission), {
      msg: 'Expected rolePermission to be an object, but was =' + rolePermission, // eslint-disable-line prefer-template
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

    rowIdRolePermissionMap[rowId] = rolePermission;

    const modes = {
      'view': renderPermissionRowViewMode,
      'edit': renderPermissionRowEditMode,
    };

    assertApp(typeof modes[mode] === 'function', {
      msg: 'Expected mode to be allowed mode, but was =' + mode, // eslint-disable-line prefer-template
    });

    modes[mode](rolePermission, rowId, $row);
  }

  function renderPermissionRowViewMode (rolePermission, rowId, $row) {
    mainUtils.trace('renderPermissionRowViewMode');

    const $rolePermissionClone = $('#role-permission-view-mode').clone()
      .removeAttr('hidden')
      .attr('id', 'role-permission-' + rowId); // eslint-disable-line prefer-template

    $rolePermissionClone.find('#role-permission-id-view-mode')
      .attr('id', 'role-permission-id-' + rowId) // eslint-disable-line prefer-template
      .text(rolePermission.id);

    $rolePermissionClone.find('#role-permission-name-view-mode')
      .attr('id', 'role-permission-name-' + rowId) // eslint-disable-line prefer-template
      .text(rolePermission.name);

    $rolePermissionClone.find('#role-permission-created-at-view-mode')
      .attr('id', 'role-permission-created-at-' + rowId) // eslint-disable-line prefer-template
      .text(rolePermission.created_at);

    $rolePermissionClone.find('#role-permission-updated-at-view-mode')
      .attr('id', 'role-permission-updated-at-' + rowId) // eslint-disable-line prefer-template
      .text(rolePermission.updated_at);

    if ($row == null) {
      $rolePermissionClone.appendTo(
        $('#role-permissions-table tbody')
      );
    } else {
      $row.replaceWith($rolePermissionClone);
    }
  }

  function renderPermissionRowEditMode (rolePermission, rowId, $row) {
    mainUtils.trace('renderPermissionRowEditMode');

    const $rolePermissionClone = $('#role-permission-edit-mode').clone()
      .removeAttr('hidden')
      .attr('id', 'role-permission-' + rowId); // eslint-disable-line prefer-template

    $rolePermissionClone.find('#role-permission-id-edit-mode')
      .attr('id', 'role-permission-id-' + rowId) // eslint-disable-line prefer-template
      .text(rolePermission.id);

    $rolePermissionClone.find('#role-permission-name-edit-mode')
      .attr('id', 'role-permission-name-' + rowId) // eslint-disable-line prefer-template
      .text(rolePermission.name);

    $rolePermissionClone.find('#role-permission-created-at-edit-mode')
      .attr('id', 'role-permission-created-at-' + rowId) // eslint-disable-line prefer-template
      .text(rolePermission.created_at);

    $rolePermissionClone.find('#role-permission-updated-at-edit-mode')
      .attr('id', 'role-permission-updated-at-' + rowId) // eslint-disable-line prefer-template
      .text(rolePermission.updated_at);

    $rolePermissionClone.find('#remove-role-permission-btn-edit-mode')
      .attr('id', 'remove-role-permission-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onRemoveRolePermissionClick);

    if ($row == null) {
      $rolePermissionClone.appendTo(
        $('#role-permissions-table tbody')
      );
    } else {
      $row.replaceWith($rolePermissionClone);
    }
  }

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    adminAPI.adminGetAPIKey({
      v: '2.0',
    }, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      const messages = {
        '1000': 'Successfully got admin API key',
        '2000': 'Admin get API key failed',
      };

      assertPeer(typeof messages[result.status_code] === 'string', {
        msg: 'Unexpected status code in adminListPermissions. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
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

          adminAPI.adminListRoles(
            {
              v: '2.0',
              role_id: Number(roleIdGlobal),
              api_key: APIKeyRef.APIKey,
              offset: 0,
              limit: RESULTS_LIMIT,
            },
            PROTOCOL_NAME,
            function (result) { // eslint-disable-line prefer-arrow-callback
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
              assertPeer(result.roles.length <= 1, {
                msg: 'Expected one or zero roles as result, got ' + result.roles.length, // eslint-disable-line prefer-template
              });

              if (result.roles.length === 0) {
                mainUtils.displayUserMessage('Role not found!', 'error');
                return;
              }

              role = result.roles[0];

              renderRoleRow('view', role);

              rolePermissions = permissions.filter(function (p) { // eslint-disable-line prefer-arrow-callback
                return role.permissions.indexOf(p.id) >= 0;
              });

              renderRolePermissionsTable($('#role-permissions-table'), 'view');
            }
          );
        }
      );
    });
  });
}

start();
