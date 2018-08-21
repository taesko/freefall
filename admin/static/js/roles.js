function start () {
  const mainUtils = main();
  const assertApp = mainUtils.assertApp;
  const assertUser = mainUtils.assertUser;
  const PROTOCOL_NAME = mainUtils.PROTOCOL_NAME;
  const RESULTS_LIMIT = 20;

  const adminAPI = getAdminAPIMethods(mainUtils);
  const api = getAPIMethods(mainUtils);

  var permissions = []; // eslint-disable-line no-var
  var permissionsOffset = 0; // eslint-disable-line no-var
  var roles = []; // eslint-disable-line no-var
  var rolesOffset = 0; // eslint-disable-line no-var
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
          function (result) { // eslint-disable-line prefer-arrow-callback
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
                renderRolesTable($('#roles-table'));
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
