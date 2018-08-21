function start() {
  const mainUtils = main();
  const assertApp = mainUtils.assertApp;
  const assertUser = mainUtils.assertUser;
  const getUniqueId = mainUtils.getUniqueId;
  const PROTOCOL_NAME = mainUtils.PROTOCOL_NAME;
  const RESULTS_LIMIT = 20;

  const adminAPI = getAdminAPIMethods(mainUtils);
  const api = getAPIMethods(mainUtils);

  var permissions = []; // eslint-disable-line no-var
  var rowIdPermissionMap = {}; // eslint-disable-line no-var
  var permissionsOffset = 0; // eslint-disable-line no-var
  var roles = []; // eslint-disable-line no-var
  var rolesOffset = 0; // eslint-disable-line no-var
  var rowIdRoleMap = {}; // eslint-disable-line no-var
  var rowIdRolePermissionsEditModeMap = {}; // eslint-disable-line no-var
  var APIKeyRef = mainUtils.APIKeyRef; // eslint-disable-line no-var

  function applyAutocomplete (values) {
    $('.permission-select').autocomplete(values);
  }

  function showPermissions () {
    $('#permissions-results').removeAttr('hidden');
  }

  function hidePermissions () {
    $('#permissions-results').attr('hidden', 'true');
  }

  function showRoles () {
    $('#roles-results').removeAttr('hidden');
  }

  function hideRoles () {
    $('#roles-results').attr('hidden', 'true');
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

  function clearRolesResults ($rolesResults) {
    mainUtils.trace('clearRolesResults');

    assertApp($rolesResults instanceof jQuery, {
      msg: 'Expected $rolesResults to be instance of jQuery, but was =' + $rolesResults, // eslint-disable-line prefer-template
    });

    $rolesResults.children()
      .not('#role-view-mode')
      .not('#role-edit-mode')
      .remove();
  }

  function renderRolesResults ($rolesResults) {
    mainUtils.trace('renderRolesResults');

    assertApp($rolesResults instanceof jQuery, {
      msg: 'Expected $rolesResults to be instance of jQuery, but was ' + typeof $rolesResults, // eslint-disable-line prefer-template
    });
    assertApp($rolesResults.length === 1, {
      msg: 'Expected only one element in jQuery object, but got ' + $rolesResults.length, // eslint-disable-line prefer-template
    });
    assertApp($rolesResults[0] instanceof window.HTMLDivElement, {
      msg: 'Expected element in jQuery object to be HTMLDivElement, but got ' + typeof $rolesResults[0], // eslint-disable-line prefer-template
    });
    assertApp(roles instanceof Array, {
      msg: 'Expected roles to be instance of array, but was ' + typeof roles, // eslint-disable-line prefer-template
    });

    clearRolesResults($rolesResults);
    rowIdRoleMap = {};
    rowIdRolePermissionsEditModeMap = {};

    const currentPage = rolesOffset / RESULTS_LIMIT + 1;
    // TODO labels

    _.each(roles, function (role) { // eslint-diable-line prefer-arrow-callback
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

    $roleViewModeClone.find('#role-edit-btn')
      .attr('id', 'role-edit-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onEditRoleClick);

    const $rolePermissionsTableTbodyClone =
      $roleViewModeClone.find('table#role-permissions-table-view-mode tbody');

    _.each(role.permissions, function (permissionId) { // eslint-disable-line prefer-arrow-callback
      var permission; // eslint-disable-line no-var
      var i; // eslint-disable-line no-var

      for (i = 0; i < permissions.length; i++) {
        if (permissions[i].id === permissionId) {
          permission = permissions[i];
          break;
        }
      }

      assertApp(_.isObject(permission), {
        msg: 'Permission, assigned to role, not found',
      });

      const $rolePermissionClone = $('#role-permission-view-mode').clone()
        .attr('id', 'role-permission-' + rowId); // eslint-disable-line prefer-template

      $rolePermissionClone.find('#role-permission-name-view-mode')
        .attr('id', 'role-permission-name-' + rowId) // eslint-disable-line prefer-template
        .text(permission.name);

      $rolePermissionsTableTbodyClone.append($rolePermissionClone);
    });

    $roleViewModeClone.find('#role-permissions-table-view-mode')
      .attr('id', 'role-permissions-table-' + rowId); // eslint-disable-line prefer-template

    if ($row == null) {
      $roleViewModeClone.appendTo(
        $('#roles-results')
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

    $roleEditModeClone.find('#role-save-btn')
      .attr('id', 'role-save-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onSaveRoleClick);

    $roleEditModeClone.find('#role-cancel-btn')
      .attr('id', 'role-cancel-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onCancelEditRoleClick);

    $roleEditModeClone.find('#role-remove-btn')
      .attr('id', 'role-remove-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onRemoveRoleClick);

    $roleEditModeClone.find('#add-role-permission')
      .attr('id', 'add-role-permission-' + rowId); // eslint-disable-line prefer-template

    $roleEditModeClone.find('#add-role-permission-submit-btn')
      .attr('id', 'add-role-permission-submit-btn-' + rowId)
      .click(onAddRolePermissionClick); // eslint-disable-line prefer-template

    const $rolePermissionsTableTbodyClone =
      $roleEditModeClone.find('table#role-permissions-table-edit-mode tbody');

    _.each(role.permissions, function (permissionId) { // eslint-disable-line prefer-arrow-callback
      const $rolePermissionClone = $('#role-permission-edit-mode').clone()
        .attr('id', 'role-permission-' + rowId); // eslint-disable-line prefer-template

      $rolePermissionClone.find('#role-permission-name-edit-mode')
        .attr('id', 'role-permission-name-' + rowId) // eslint-disable-line prefer-template
        .text(permissions.find(p => p.id === permissionId).name);

      $rolePermissionClone.find('#remove-role-permission-btn')
        .attr('id', 'remove-role-permission-btn-' + rowId) // eslint-disable-line prefer-template
        .click(onRemoveRolePermissionClick);

      $rolePermissionsTableTbodyClone.append($rolePermissionClone);
    });

    $roleEditModeClone.find('#role-permissions-table-edit-mode')
      .attr('id', 'role-permissions-table-' + rowId); // eslint-disable-line prefer-template
  }

  const onEditRoleClick = function (event) {
    mainUtils.trace('onEditRoleClick');

    const rowId = mainUtils.getElementUniqueId(event.target, 'role-edit-btn-');
    const role = rowIdRoleMap[rowId];

    renderRoleRow(
      'edit',
      role,
      $('#role-' + rowId) // eslint-disable-line prefer-template
    );
  };

  const onCancelEditRoleClick = function (event) {
    mainUtils.trace('onCancelEditRoleClick');

    const rowId = mainUtils.getElementUniqueId(event.target, 'role-cancel-btn-');
    const role = rowIdRoleMap[rowId];

    renderRoleRow(
      'view',
      role,
      $('#role-' + rowId) // eslint-disable-line prefer-template
    );
  };

  const onSaveRoleClick = function (event) {
    mainUtils.trace('onSaveRoleClick');

    const saveButton = event.target;

    const rowId = mainUtils.getElementUniqueId(saveButton, 'role-save-btn-');
    const oldRole = rowIdRoleMap[rowId];

    const roleName = $('#role-name-edit-mode-' + rowId).val().trim(); // eslint-disable-line prefer-template
    const rolePermissions = rowIdRolePermissionsEditModeMap[rowId];

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
      permissions: rolePermissions,
    };

    adminAPI.adminEditRole(
      editRoleParams,
      PROTOCOL_NAME,
      function (result) { // eslint-disable-line prefer-arrow-callback
        saveButton.disabled = false;

        if (result.status_code === '1000') {
          const newRole = {
            id: oldRole.id,
            name: roleName,
            permissions: rolePermissions,
            created_at: oldRole.created_at,
            updated_at: oldRole.updated_at, // TODO change to result.updated_at and add support for this on server
          };

          rowIdRoleMap[rowId] = newRole;
          roles = roles.map(function (role) { // eslint-disable-line prefer-arrow-callback
            if (role.id !== oldRole.id) {
              return role;
            }
            return newRole;
          });

          delete rowIdRolePermissionsEditModeMap[rowId];

          renderRoleRow(
            'view',
            newRole,
            $('role-' + rowId) // eslint-disable-line prefer-template
          );

          mainUtils.displayUserMessage('Successfully edited role!', 'success');
        } else {
          mainUtils.displayUserMessage('Edit role failed with status code: ' + result.status_code, 'error'); // eslint-disable-line prefer-template
          // TODO show more descriptive error messages
        }
      }
    );
  };

  const onRemoveRoleClick = function (event) {
    mainUtils.trace('onRemoveRoleClick');

    const removeButton = event.target;

    const rowId = mainUtils.getElementUniqueId(removeButton, 'role-remove-btn-');
    const oldRole = rowIdRoleMap[rowId];

    removeButton.disabled = true;

    const removeRoleParams = {
      v: '2.0',
      role_id: oldRole.id,
      api_key: APIKeyRef.APIKey,
    };

    adminAPI.adminRemoveRole(
      removeRoleParams,
      PROTOCOL_NAME,
      function (result) { // eslint-disable-line prefer-arrow-callback
        removeButton.disabled = false;

        if (result.status_code === '1000') {
          roles = roles.filter(function (role) { // eslint-disable-line prefer-arrow-callback
            return role.id !== oldSubscription.id;
          });

          delete rowIdRoleMap[rowId];
          delete rowIdRolePermissionsEditModeMap[rowId];

          $('#role-' + rowId).remove(); // eslint-disable-line prefer-template

          if (roles.length > 0) {
            showRoles();
          } else {
            hideRoles();
          }

          mainUtils.displayUserMessage('Successfully removed role!', 'success');
        } else {
          mainUtils.displayUserMessage('Remove role failed with status code: ' + result.status_code, 'error'); // eslint-disable-line prefer-template
          // TODO show more descriptive error messages
        }
      }
    );
  };

  const onRemoveRolePermissionClick = function (event) {
    mainUtils.trace('onRemoveRolePermissionClick');

    // TODO
  }

  const onAddRolePermissionClick = function (event) {
    mainUtils.trace('onAddRolePermissionClick');

    // TODO
  };

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
    rowIdPermissionMap = {};

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

    rowIdPermissionMap[rowId] = permission;

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

  const onRolesTabClick = function () {
    mainUtils.trace('onRolesTabClick');

    if (roles.length > 0) {
      showRoles();
    } else {
      hideRoles();
    }

    $('#roles-section').removeAttr('hidden');
    $('#permissions-section').attr('hidden', 'true');

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
    $('#roles-section').attr('hidden', 'true');

    $('#permissions-tab').parent().addClass('active');
    $('#roles-tab').parent().removeClass('active');
  };

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    const $rolesTab = $('#roles-tab');
    const $permissionsTab = $('#permissions-tab');

    api.getAPIKey({
      v: '2.0',
    }, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      if (result.status_code === '1000') {
        APIKeyRef.APIKey = result.api_key;

        adminAPI.adminListPermissions(
          {
            v: '2.0',
            api_key: APIKeyRef.APIKey,
          },
          PROTOCOL_NAME,
          function (result) {
            // TODO error handling
            permissions = result.permissions;

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
                // TODO error handling
                // TODO check if role permissions are valid according to collected permissions
                roles = result.roles;

                $rolesTab.click(onRolesTabClick);
                renderRolesResults($('#roles-results'));
              }
            );
          }
        );
      } else {
        window.location.replace('/login');
      }
    });
  });
}

start();
