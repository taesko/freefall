function start () {
  const mainUtils = main();
  const assertApp = mainUtils.assertApp;
  const assertUser = mainUtils.assertUser;
  const PROTOCOL_NAME = mainUtils.PROTOCOL_NAME;
  const RESULTS_LIMIT = 20;

  const adminAPI = getAdminAPIMethods(mainUtils);

  var users = []; // eslint-disable-line no-var
  var offset = 0; // eslint-disable-line no-var
  var rowIdUserMap = {}; // eslint-disable-line no-var
  var APIKeyRef = mainUtils.APIKeyRef; // eslint-disable-line no-var

  function clearUsersTable ($usersTable) {
    mainUtils.trace('clearUsersTable');

    assertApp($usersTable instanceof jQuery, {
      msg: 'Expected $usersTable to be instance of jQuery, but was ' + typeof $usersTable, // eslint-disable-line prefer-template
    });

    $usersTable.find('tbody tr')
      .not('#user-view-mode')
      .remove();
  }

  function renderUsers ($usersTable) {
    mainUtils.trace('renderUsers');

    if (users.length > 0) {
      showUsersResults();
    } else {
      hideUsersResults();
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

    clearUsersTable($usersTable);
    rowIdUserMap = {};

    const currentPage = offset / RESULTS_LIMIT + 1;
    $('#current-page-label-top').text(currentPage);
    $('#current-page-label-bottom').text(currentPage);

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
      rowId = String(mainUtils.getUniqueId());
    } else {
      rowId = mainUtils.getElementUniqueId($row[0], 'user-');
    }

    rowIdUserMap[rowId] = user;

    const modes = {
      'view': renderUserRowViewMode,
      // edit mode not needed
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
      .text(user.email);

    $userViewModeClone.find('#user-view-mode-credits')
      .attr('id', 'user-view-mode-credits-' + rowId) // eslint-disable-line prefer-template
      .text(user.credits);

    $userViewModeClone.find('#user-view-mode-open-btn')
      .attr('id', 'user-view-mode-open-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onOpenUserClick(user.id));

    if ($row == null) {
      $userViewModeClone.appendTo(
        $('#users-table tbody')
      );
    } else {
      $row.replaceWith($userViewModeClone);
    }
  }

  function showUsersResults () {
    $('#users-results').removeAttr('hidden');
    $('#no-users-msg').attr('hidden', true);
  }

  function hideUsersResults () {
    $('#no-users-msg').removeAttr('hidden');
    $('#users-results').attr('hidden', true);
  }

  const onOpenUserClick = function (userId) {
    return function (event) {
      window.location = '/users/' + userId; // eslint-disable-line prefer-template
    };
  }

  const onPreviousPageClick = function (event) {
    mainUtils.trace('onPreviousPageClick');

    const button = event.target;

    assertApp(typeof offset === 'number', {
      msg: 'Expected offset to be a number but was =' + offset, // eslint-disable-line prefer-template
    });

    if (offset === 0) {
      mainUtils.displayUserMessage('You are already on first page', 'info');
      return;
    } else {
      offset = offset - RESULTS_LIMIT;
    }

    assertApp(offset >= 0, {
      msg: 'Expected offset to be >= 0 but was =' + offset, // eslint-disable-line prefer-template
    });

    assertUser(Number.isSafeInteger(offset), {
      userMessage: 'Invalid results page!',
      msg: 'Expected offset to be a safe integer, but was =' + offset, // eslint-disable-line prefer-template
    });

    const params = {
      v: '2.0',
      api_key: APIKeyRef.APIKey,
      offset: offset,
      limit: RESULTS_LIMIT,
    };

    button.disabled = true;

    adminAPI.adminListUsers(params, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      button.disabled = false;
      // TODO error handling

      users = result.users;

      renderUsers($('#users-table'));
    });
  };

  const onNextPageClick = function (event) { // eslint-disable-line prefer-arrow-callback
    mainUtils.trace('onNextPageClick');

    const button = event.target;

    assertApp(typeof offset === 'number', {
      msg: 'Expected offset to be a number but was =' + offset, // eslint-disable-line prefer-template
    });

    const newOffset = offset + RESULTS_LIMIT;

    assertApp(newOffset >= 0, {
      msg: 'Expected newOffset to be >= 0 but was =' + newOffset, // eslint-disable-line prefer-template
    });

    assertUser(Number.isSafeInteger(newOffset), {
      userMessage: 'Invalid results page!',
      msg: 'Expected newOffset to be a safe integer, but was =' + newOffset, // eslint-disable-line prefer-template
    });

    const params = {
      v: '2.0',
      api_key: APIKeyRef.APIKey,
      offset: newOffset,
      limit: RESULTS_LIMIT,
    };

    button.disabled = true;

    adminAPI.adminListUsers(params, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      button.disabled = false;
      // TODO error handling
      if (result.users.length === 0) {
        mainUtils.displayUserMessage('You are already on last page!', 'info');
        return;
      }

      offset = newOffset;
      users = result.users;

      renderUsers($('#users-table'));
    });
  };

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    $('#prev-page-btn-top').click(onPreviousPageClick);
    $('#next-page-btn-top').click(onNextPageClick);
    $('#prev-page-btn-bottom').click(onPreviousPageClick);
    $('#next-page-btn-bottom').click(onNextPageClick);

    adminAPI.adminGetAPIKey({
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

        adminAPI.adminListUsers(params, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
          users = result.users;

          renderUsers($('#users-table'));
        });
      } else {
        mainUtils.displayUserMessage('Could not get API key for your account. Please try to log out and log back in your account!', 'error');
      }
    });
  });
}

start();
