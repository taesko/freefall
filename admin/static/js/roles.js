function start() {
  const mainUtils = main();
  const assertApp = mainUtils.assertApp;
  const assertUser = mainUtils.assertUser;
  const getUniqueId = mainUtils.getUniqueId;
  const PROTOCOL_NAME = mainUtils.PROTOCOL_NAME;
  const RESULTS_LIMIT = mainUtils.RESULTS_LIMIT;

  const adminAPI = getAdminAPIMethods(mainUtils);
  const api = getAPIMethods(mainUtils);

  var permissions = []; // eslint-disable-line no-var
  var rowIdPermissionMap = {}; // eslint-disable-line no-var
  var permissionsOffset = 0; // eslint-disable-line no-var
  var roles = []; // eslint-disable-line no-var
  var rolesOffset = 0; // eslint-disable-line no-var
  var rowIdRoleMap = {}; // eslint-disable-line no-var
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
      const $rolePermissionClone = $('#role-permission-view-mode').clone()
        .attr('id', 'role-permission-' + rowId); // eslint-disable-line prefer-template

      $rolePermissionClone.find('#role-permission-name-view-mode')
        .attr('id', 'role-permission-name-' + rowId) // eslint-disable-line prefer-template
        .text(permissions.find(p => p.id === permissionId).name);

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

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    api.getAPIKey({
      v: '2.0',
    }, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      if (result.status_code === '1000') {
        APIKeyRef.APIKey = result.api_key;

        const params = {
          v: '2.0',
          api_key: APIKeyRef.APIKey,
          offset: 0,
          limit: RESULTS_LIMIT,
        };

        adminAPI.adminListRoles(params, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
          roles = result.roles;

          renderRoles($('#-table'));
        });
      } else {
        window.location.replace('/login');
      }
    });
  });
}

start();
