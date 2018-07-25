function start () {
  const mainUtils = main();
  const trace = mainUtils.trace;
  const assertApp = mainUtils.assertApp;
  const assertUser = mainUtils.assertUser;
  const getUniqueId = mainUtils.getUniqueId;
  const getAPIKey = mainUtils.getAPIKey;
  const getElementUniqueId = mainUtils.getElementUniqueId;
  const sendRequest = mainUtils.sendRequest;
  const getValidatorMsg = mainUtils.getValidatorMsg;
  const SERVER_URL = mainUtils.SERVER_URL;
  const assertPeer = mainUtils.assertPeer;
  const PeerError = mainUtils.PeerError;
  const displayUserMessage = mainUtils.displayUserMessage;
  const validateErrorRes = validators.getValidateErrorRes();
  const validateAdminListUsersReq = adminValidators.getValidateAdminListUsersReq();
  const validateAdminListUsersRes = adminValidators.getValidateAdminListUsersRes();
  const validateAdminRemoveUserReq = adminValidators.getValidateAdminRemoveUserReq();
  const validateAdminRemoveUserRes = adminValidators.getValidateAdminRemoveUserRes();

  var users = []; // eslint-disable-line no-var
  var rowIdUserMap = {}; // eslint-disable-line no-var
  var APIKey; // eslint-disable-line no-var

  function adminListUsers (params, protocolName, callback) {
    trace('adminListUsers');

    assertApp(validateAdminListUsersReq(params), {
      msg: 'Params do not adhere to adminListUsersRequestSchema: ' + getValidatorMsg(validateAdminListUsersReq), // eslint-disable-line prefer-template
    });

    sendRequest({
      url: SERVER_URL,
      data: {
        method: 'admin_list_users',
        params: params,
      },
      protocolName: protocolName,
    }, function (result, error) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        assertPeer(validateErrorRes(error), {
          msg: 'Params do not adhere to errorResponseSchema: ' + getValidatorMsg(validateErrorRes), // eslint-disable-line prefer-template
        });

        trace('Error in adminListUsers:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateAdminListUsersRes(result), {
        msg: 'Params do not adhere to adminListUsersResponseSchema: ' + getValidatorMsg(validateAdminListUsersRes), // eslint-disable-line prefer-template
      });

      callback(result);
    });
  }

  function adminRemoveUser (params, protocolName, callback) {
    trace('adminRemoveUser');

    assertApp(validateAdminRemoveUserReq(params), {
      msg: 'Params do not adhere to adminRemoveUserRequestSchema: ' + getValidatorMsg(validateAdminRemoveUserReq), // eslint-disable-line prefer-template
    });

    sendRequest({
      url: SERVER_URL,
      data: {
        method: 'admin_remove_user',
        params: params,
      },
      protocolName: protocolName,
    }, function (result, error) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        assertPeer(validateErrorRes(error), {
          msg: 'Params do not adhere to errorResponseSchema: ' + getValidatorMsg(validateErrorRes), // eslint-disable-line prefer-template
        });

        trace('Error in adminRemoveUser:' + JSON.stringify(error)); // eslint-disable-line prefer-template
        throw new PeerError({
          msg: error.message,
        });
      }

      assertPeer(validateAdminRemoveUserRes(result), {
        msg: 'Params do not adhere to adminRemoveUserResponseSchema: ' + getValidatorMsg(validateAdminRemoveUserRes), // eslint-disable-line prefer-template
      });

      callback(result);
    });
  }

  function adminEditUser (params, protocolName, callback) {
    trace('adminEditUser');

    // TODO implement
  }

  function renderUsers ($usersTable) {
    trace('renderUsers');

    if (users.length > 0) {
      showUsersTable();
    } else {
      hideUsersTable();
    }

    assertApp($usersTable instanceof jQuery, {
      msg: 'Expected $usersTable to be instance of jQuery, but was ' + typeof $usersTable, // eslint-disable-line prefer-template
    });
    assertApp($usersTable.length === 1, {
      msg: 'Expected only one element in jQuery object, but got ' + $usersTable.length, // eslint-disable-line prefer-template
    });
    assertApp($usersTable[0] instanceof window.HTMLTableElement, {
      msg: 'Expected element in jQuery object to be HTMLTableElement, but got ' + typeof $usersTable[0], // eslint-disable-line prefer-template
    });
    assertApp(users instanceof Array, {
      msg: 'Expected users to be instance of array, but was ' + typeof users, // eslint-disable-line prefer-template
    });

    rowIdUserMap = {};

    _.each(users, function (user) { // eslint-disable-line prefer-arrow-callback
      renderUserRow('view', user);
    });
  }

  function renderUserRow (mode, user, $row) {
    trace('renderUserRow');

    assertApp(_.isObject(user), {
      msg: 'Expected user to be an object, but was ' + typeof user, // eslint-disable-line prefer-template
    });

    const userStringProps = ['id', 'email'];

    _.each(userStringProps, function (prop) { // eslint-disable-line prefer-arrow-callback
      assertApp(typeof user[prop] === 'string', {
        msg: 'Expected user ' + prop + ' to be a string, but was ' + typeof user[prop], // eslint-disable-line prefer-template
      });
    });

    assertApp(
      $row == null ||
      $row instanceof jQuery,
      'Unexpected type of $row ' + typeof $row, // eslint-disable-line prefer-template
    );

    var rowId = // eslint-disable-line no-var
      ($row == null) ? String(getUniqueId())
        : getElementUniqueId($row[0], 'user-');

    rowIdUserMap[rowId] = user;

    const modes = {
      'view': renderUserRowViewMode,
      'edit': renderUserRowEditMode,
    };

    assertApp(typeof modes[mode] === 'function', {
      msg: 'Expected mode to be allowed mode, but was ' + mode, // eslint-disable-line prefer-template
    });

    modes[mode](user, rowId, $row);
  }

  function renderUserRowViewMode (user, rowId, $row) {
    trace('renderUserRowViewMode');

    const $userViewModeClone = $('#user-view-mode').clone()
      .removeAttr('hidden')
      .attr('id', 'user-' + rowId); // eslint-disable-line prefer-template

    $userViewModeClone.find('#user-view-mode-id')
      .attr('id', 'user-view-mode-id-' + rowId) // eslint-disable-line prefer-template
      .text(user.id);

    $userViewModeClone.find('#user-view-mode-email')
      .attr('id', 'user-view-mode-email-' + rowId) // eslint-disable-line prefer-template
      .attr('href', '/users/' + user.id) // eslint-disable-line prefer-template
      .text(user.email);

    $userViewModeClone.find('#user-view-mode-edit-btn')
      .attr('id', 'user-view-mode-edit-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onEditUserClick);

    if ($row == null) {
      $userViewModeClone.appendTo(
        $('#users-table tbody')
      );
    } else {
      $row.replaceWith($userViewModeClone);
    }
  }

  function renderUserRowEditMode (user, rowId, $row) {
    trace('renderUserRowEditMode');

    const $userEditModeClone = $('#user-edit-mode').clone()
      .removeAttr('hidden')
      .attr('id', 'user-' + rowId); // eslint-disable-line prefer-template

    $userEditModeClone.find('#user-edit-mode-id')
      .attr('id', 'user-edit-mode-id-' + rowId) // eslint-disable-line prefer-template
      .text(user.id);

    $userEditModeClone.find('#user-edit-mode-email')
      .attr('id', 'user-edit-mode-email-' + rowId) // eslint-disable-line prefer-template
      .attr('value', user.email);

    $userEditModeClone.find('#user-edit-mode-password')
      .attr('id', 'user-edit-mode-password-' + rowId); // eslint-disable-line prefer-template

    $userEditModeClone.find('#user-edit-mode-save-btn')
      .attr('id', 'user-edit-mode-save-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onSaveUserClick);

    $userEditModeClone.find('#user-edit-mode-cancel-btn')
      .attr('id', 'user-edit-mode-cancel-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onCancelEditUserClick);

    $userEditModeClone.find('#user-edit-mode-remove-btn')
      .attr('id', 'user-edit-mode-remove-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onRemoveUserClick);

    $row.replaceWith($userEditModeClone);
  }

  function showUsersTable () {
    $('#users-table').removeAttr('hidden');
    $('#no-users-msg').attr('hidden', 'true');
  }

  function hideUsersTable () {
    $('#no-users-msg').removeAttr('hidden');
    $('#users-table').attr('hidden', 'true');
  }

  const onRemoveUserClick = function (event) {
    trace('clicked on remove user button');

    const removeButton = event.target;
    const rowId = getElementUniqueId(removeButton, 'user-edit-mode-remove-btn-');
    const oldUser = rowIdUserMap[rowId];

    removeButton.disabled = true;

    const removeUserParams = {
      v: '2.0',
      user_id: oldUser.id,
      api_key: APIKey,
    };

    adminRemoveUser(removeUserParams, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
      if (result.status_code === 2000) {
        displayUserMessage('Remove user failed with status code: ' + result.status_code, 'error'); // eslint-disable-line prefer-template
      } else if (result.status_code >= 1000 && result.status_code < 2000) {
        removeButton.disabled = false;

        users = users.filter(function (user) { // eslint-disable-line prefer-arrow-callback
          return user.id !== oldUser.id;
        });

        delete rowIdUserMap[rowId];

        $('#user-' + rowId).remove(); // eslint-disable-line prefer-template

        if (users.length > 0) {
          showUsersTable();
        } else {
          hideUsersTable();
        }
      }
    });
  };

  const onEditUserClick = function (event) {
    trace('clicked on edit user button');

    const rowId = getElementUniqueId(event.target, 'user-view-mode-edit-btn-');
    const user = rowIdUserMap[rowId];

    renderUserRow(
      'edit',
      user,
      $('#user-' + rowId) // eslint-disable-line prefer-template
    );
  };

  const onCancelEditUserClick = function (event) {
    trace('clicked on cancel edit user button');

    const rowId = getElementUniqueId(event.target, 'user-edit-mode-cancel-btn-');
    const user = rowIdUserMap[rowId];

    renderUserRow(
      'view',
      user,
      $('#user-' + rowId) // eslint-disable-line prefer-template
    );
  };

  const onSaveUserClick = function (event) {
    trace('clicked on save user button');
  };

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    getAPIKey({
      v: '2.0',
    }, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
      if (result.status_code < 1000 || result.status_code >= 2000) {
        window.location.replace('/login');
      } else {
        APIKey = result.api_key;

        const params = {
          v: '2.0',
          api_key: APIKey,
        };

        adminListUsers(params, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
          users = result.users;

          renderUsers($('#users-table'));
        });
      }
    });
  });
}

start();
