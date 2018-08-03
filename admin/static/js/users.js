function start () {
  const mainUtils = main();
  const assertApp = mainUtils.assertApp;
  const getUniqueId = mainUtils.getUniqueId;

  const adminAPI = getAdminAPIMethods(mainUtils);
  const api = getAPIMethods(mainUtils);

  var users = []; // eslint-disable-line no-var
  var rowIdUserMap = {}; // eslint-disable-line no-var
  var APIKey; // eslint-disable-line no-var

  function renderUsers ($usersTable) {
    mainUtils.trace('renderUsers');

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
    mainUtils.trace('renderUserRow');

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
      $row instanceof jQuery, {
        msg: 'Unexpected type of $row ' + typeof $row, // eslint-disable-line prefer-template
      }
    );

    var rowId; // eslint-disable-line no-var

    if ($row == null) {
      rowId = String(getUniqueId());
    } else {
      rowId = mainUtils.getElementUniqueId($row[0], 'user-');
    }

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
    mainUtils.trace('renderUserRowViewMode');

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

    $userViewModeClone.find('#user-view-mode-credits')
      .attr('id', 'user-view-mode-credits-' + rowId) // eslint-disable-line prefer-template
      .text(user.credits);

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
    mainUtils.trace('renderUserRowEditMode');

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

    $userEditModeClone.find('#user-edit-mode-credits')
      .attr('id', 'user-edit-mode-credits-' + rowId) // eslint-disable-line prefer-template
      .text(user.credits);

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
    mainUtils.trace('clicked on remove user button');

    const removeButton = event.target;
    const rowId = mainUtils.getElementUniqueId(removeButton, 'user-edit-mode-remove-btn-');
    const oldUser = rowIdUserMap[rowId];

    removeButton.disabled = true;

    const removeUserParams = {
      v: '2.0',
      user_id: oldUser.id,
      api_key: APIKey,
    };

    adminAPI.adminRemoveUser(removeUserParams, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
      removeButton.disabled = false;

      if (result.status_code === '1000') {
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
        mainUtils.displayUserMessage('Successfully removed user!', 'success');
      } else {
        mainUtils.displayUserMessage('Remove user failed with status code: ' + result.status_code, 'error'); // eslint-disable-line prefer-template
      }
    });
  };

  const onEditUserClick = function (event) {
    mainUtils.trace('clicked on edit user button');

    const rowId = mainUtils.getElementUniqueId(event.target, 'user-view-mode-edit-btn-');
    const user = rowIdUserMap[rowId];

    renderUserRow(
      'edit',
      user,
      $('#user-' + rowId) // eslint-disable-line prefer-template
    );
  };

  const onCancelEditUserClick = function (event) {
    mainUtils.trace('clicked on cancel edit user button');

    const rowId = mainUtils.getElementUniqueId(event.target, 'user-edit-mode-cancel-btn-');
    const user = rowIdUserMap[rowId];

    renderUserRow(
      'view',
      user,
      $('#user-' + rowId) // eslint-disable-line prefer-template
    );
  };

  const onSaveUserClick = function (event) {
    mainUtils.trace('clicked on save user button');

    const saveButton = event.target;

    const rowId = mainUtils.getElementUniqueId(event.target, 'user-edit-mode-save-btn-');
    const user = rowIdUserMap[rowId];

    const newEmail = $('#user-edit-mode-email-' + rowId).val().trim(); // eslint-disable-line prefer-template
    const newPassword = $('#user-edit-mode-password-' + rowId).val().trim(); // eslint-disable-line prefer-template

    const params = {
      v: '2.0',
      api_key: APIKey,
      user_id: user.id,
    };

    if (newEmail.length > 0) {
      params.email = newEmail;
    }

    if (newPassword.length > 0) {
      params.password = newPassword;
    }

    saveButton.disabled = true;

    // function lock(func) {
    //   var flag = false;
    //   function wrapped(...args) {
    //     if (flag) {
    //       throw;
    //     }
    //     flag = true;
    //     try {
    //       result = func(...args)
    //     } finally {
    //       flag = false;
    //     }
    //     return result;
    //   }
    //   return wrapped;
    // }

    // adminEditUser(params, asdfasdf, lock(function(result) {
    //   console.log(result);
    // }))

    adminAPI.adminEditUser(params, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
      saveButton.disabled = false;

      if (result.status_code === '1000') {
        const newUser = {
          id: user.id,
          email: (newEmail.length > 0) ? newEmail : user.email,
        };

        renderUserRow(
          'view',
          newUser,
          $('#user-' + rowId) // eslint-disable-line prefer-template
        );
        mainUtils.displayUserMessage('Successfully updated user!', 'success');
      } else {
        mainUtils.displayUserMessage('Edit user failed with status code: ' + result.status_code, 'error'); // eslint-disable-line prefer-template
      }
    });
  };

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    api.getAPIKey({
      v: '2.0',
    }, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
      if (result.status_code === '1000') {
        APIKey = result.api_key;

        const params = {
          v: '2.0',
          api_key: APIKey,
        };

        adminAPI.adminListUsers(params, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
          users = result.users;

          renderUsers($('#users-table'));
        });
      } else {
        window.location.replace('/login');
      }
    });
  });
}

start();
