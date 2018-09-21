function start () {
  const mainUtils = main();
  const ApplicationError = mainUtils.ApplicationError;
  const assertApp = mainUtils.assertApp;
  const assertUser = mainUtils.assertUser;
  const assertPeer = mainUtils.assertPeer;
  const PROTOCOL_NAME = mainUtils.PROTOCOL_NAME;
  const RESULTS_LIMIT = 20;

  const adminAPI = getAdminAPIMethods(mainUtils);

  var roles = []; // eslint-disable-line no-var
  var employees = []; // eslint-disable-line no-var
  var offset = 0; // eslint-disable-line no-var
  var rowIdEmployeeMap = {}; // eslint-disable-line no-var
  var APIKeyRef = mainUtils.APIKeyRef; // eslint-disable-line no-var

  function clearEmployeesTable ($employeesTable) {
    mainUtils.trace('clearEmployeesTable');

    assertApp($employeesTable instanceof jQuery, {
      msg: 'Expected $employeesTable to be instance of jQuery, but was ' + typeof $employeesTable, // eslint-disable-line prefer-template
    });

    $employeesTable.find('tbody tr')
      .not('#employee')
      .remove();
  }

  function renderEmployeeRow (mode, employee, $row) {
    mainUtils.trace('renderEmployeeRow');

    assertApp(_.isObject(employee), {
      msg: 'Expected employee to be an object, but was ' + typeof employee, // eslint-disable-line prefer-template
    });

    assertApp(
      $row == null ||
      $row instanceof jQuery, {
        msg: 'Unexpected type of $row, $row=' + $row, // eslint-disable-line prefer-template
      }
    );

    var rowId; // eslint-disable-line no-var

    if ($row == null) {
      rowId = String(mainUtils.getUniqueId());
    } else {
      rowId = mainUtils.getElementUniqueId($row[0], 'employee-');
    }

    rowIdEmployeeMap[rowId] = employee;

    const modes = {
      'view': renderEmployeeRowViewMode,
      // no need for edit mode
    };

    assertApp(typeof modes[mode] === 'function', {
      msg: 'Expected mode to be allowed mode, but was ' + mode, // eslint-disable-line prefer-template
    });

    modes[mode](employee, rowId, $row);
  }

  function renderEmployeeRowViewMode (employee, rowId, $row) {
    mainUtils.trace('renderEmployeeRowViewMode');

    const $employeeViewModeClone = $('#employee').clone()
      .removeAttr('hidden')
      .attr('id', 'employee-' + rowId); // eslint-disable-line prefer-template

    $employeeViewModeClone.find('#employee-id')
      .attr('id', 'employee-id-' + rowId) // eslint-disable-line prefer-template
      .text(employee.id);

    $employeeViewModeClone.find('#employee-email')
      .attr('id', 'employee-email-' + rowId) // eslint-disable-line prefer-template
      .text(employee.email);

    var i; // eslint-disable-line no-var
    var employeeRoleName; // eslint-disable-line no-var

    for (i = 0; i < roles.length; i++) {
      if (roles[i].id === employee.role_id) {
        employeeRoleName = roles[i].name;
        break;
      }
    }

    assertUser(typeof employeeRoleName === 'string', {
      msg: 'Attempt to render an employee with an unknown role.',
      userMessage: 'Could not resolve role of employee. Please try refreshing the page to fix this issue!',
    });

    $employeeViewModeClone.find('#employee-role')
      .attr('id', 'employee-role-' + rowId) // eslint-disable-line prefer-template
      .text(employeeRoleName);

    $employeeViewModeClone.find('#employee-role-updated-at')
      .attr('id', 'employee-role-updated-at-' + rowId) // eslint-disable-line prefer-template
      .text(employee.role_updated_at);

    $employeeViewModeClone.find('#employee-open-btn')
      .attr('id', 'employee-open-btn-' + rowId) // eslint-disable-line prefer-template
      .click(onOpenEmployeeClick(employee.id));

    if ($row == null) {
      $employeeViewModeClone.appendTo(
        $('#employees-table tbody')
      );
    } else {
      $row.replaceWith($employeeViewModeClone);
    }
  }

  function renderEmployees ($employeesTable) {
    mainUtils.trace('renderEmployees');

    if (employees.length > 0) {
      showEmployeesTable();
    } else {
      hideEmployeesTable();
    }

    assertApp($employeesTable instanceof jQuery, {
      msg: 'Expected $employeesTable to be instance of jQuery, but was ' + typeof $employeesTable, // eslint-disable-line prefer-template
    });
    assertApp($employeesTable.length === 1, {
      msg: 'Expected only one element in jQuery object, but got ' + $employeesTable.length, // eslint-disable-line prefer-template
    });
    assertApp($employeesTable[0] instanceof window.HTMLTableElement, {
      msg: 'Expected element in jQuery object to be HTMLTableElement, but got ' + typeof $employeesTable[0], // eslint-disable-line prefer-template
    });
    assertApp(employees instanceof Array, {
      msg: 'Expected employees to be instance of array, but was ' + typeof employees, // eslint-disable-line prefer-template
    });

    clearEmployeesTable($employeesTable);
    rowIdEmployeeMap = {};

    const currentPage = offset / RESULTS_LIMIT + 1;
    $('#current-page-label-top').text(currentPage);
    $('#current-page-label-bottom').text(currentPage);

    _.each(employees, function (employee) { // eslint-disable-line prefer-arrow-callback
      renderEmployeeRow('view', employee);
    });
  }

  function showEmployeesTable () {
    $('#employees-table').removeAttr('hidden');
    $('#no-employees-msg').attr('hidden', true);
  }

  function hideEmployeesTable () {
    $('#no-employees-msg').removeAttr('hidden');
    $('#employees-table').attr('hidden', true);
  }

  const onOpenEmployeeClick = function (employeeId) {
    return function (event) {
      window.location = '/employees/' + employeeId; // eslint-disable-line prefer-template
    };
  };

  const onAddNewEmployee = function (event) {
    mainUtils.trace('onAddNewEmployee');
    event.preventDefault();

    const form = event.target;
    const formData = $(form).serializeArray();

    var i; // eslint-disable-line no-var
    var newEmployeeEmail, newEmployeePassword, newEmployeeRoleName; // eslint-disable-line no-var

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

      if (formData[i].name === 'employee-email') {
        newEmployeeEmail = formData[i].value.trim();
      } else if (formData[i].name === 'employee-password') {
        newEmployeePassword = formData[i].value;
      } else if (formData[i].name === 'employee-role-name') {
        newEmployeeRoleName = formData[i].value.trim();
      } else {
        throw new ApplicationError({
          msg: 'Unknown formData name: ' + formData[i].name, // eslint-disable-line prefer-template
        });
      }
    }

    assertApp(typeof newEmployeeEmail === 'string', {
      msg: 'Expected newEmployeeEmail to be string, but newEmployeeEmail =' + newEmployeeEmail, // eslint-disable-line prefer-template
    });
    assertApp(typeof newEmployeePassword === 'string', {
      msg: 'Expected newEmployeePassword to be string, but newEmployeePassword =' + newEmployeePassword, // eslint-disable-line prefer-template
    });
    assertApp(typeof newEmployeeRoleName === 'string', {
      msg: 'Expected newEmployeeRoleName to be string, but newEmployeeRoleName =' + newEmployeeRoleName, // eslint-disable-line prefer-template
    });

    assertUser(newEmployeeEmail.length > 2, {
      userMessage: 'Please enter a valid email!',
      msg: 'Expected user to enter a valid employee email address, but newEmployeeEmail =' + newEmployeeEmail, // eslint-disable-line prefer-template
    });
    assertUser(newEmployeePassword.length > 0, {
      userMessage: 'Please enter a password!',
      msg: 'Expected user to enter a password, but password =' + newEmployeePassword, // eslint-disable-line prefer-template
    });
    assertUser(newEmployeeRoleName.length > 0, {
      userMessage: 'Please enter a role name!',
      msg: 'Expected user to enter a role name, but newEmployeeRoleName =' + newEmployeeRoleName, // eslint-disable-line prefer-template
    });

    var newEmployeeRole; // eslint-disable-line no-var

    for (i = 0; i < roles.length; i++) {
      if (roles[i].name === newEmployeeRoleName) {
        newEmployeeRole = roles[i];
        break;
      }
    }

    assertUser(_.isObject(newEmployeeRole), {
      userMessage: 'Can not assign role! Role does not exist!',
      msg: 'User entered a name of role that could not be resolved to an existing role, newEmployeeRole =' + newEmployeeRole, // eslint-disable-line prefer-template
    });

    assertApp(typeof newEmployeeRole.id === 'number', {
      msg: 'Expected newEmployeeRole.id to be a number, but newEmployeeRole.id=' + newEmployeeRole.id, // eslint-disable-line prefer-template
    });

    const params = {
      v: '2.0',
      api_key: APIKeyRef.APIKey,
      email: newEmployeeEmail,
      password: newEmployeePassword,
      role_id: newEmployeeRole.id,
    };

    $(form).off('submit').submit(function (event) { // eslint-disable-line prefer-arrow-callback
      event.preventDefault();
      return false;
    });
    mainUtils.showLoader();

    adminAPI.adminAddEmployee(params, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      $(form).off('submit').submit(onAddNewEmployee);
      mainUtils.hideLoader();

      const messages = {
        '1000': 'Successfully added new employee!',
        '2100': 'Your API key does not support this operation!',
        '2101': 'The form you sent was not in expected format. Please correct any wrong inputs and try again!',
        '2201': 'Employee with this email already exists!',
        '2202': 'You have assigned a role that was not recognized! Please, try again!',
      };

      assertPeer(typeof messages[result.status_code] === 'string', {
        msg: 'Unexpected status code in adminAddEmployee. Status code: ' + result.status_code, // eslint-disable-line prefer-template
      });

      const msg = 'Admin add employee failed with status code: ' + result.status_code; // eslint-disable-line prefer-template
      const userMessage = messages[result.status_code] || msg;

      assertUser(result.status_code === '1000', {
        msg: msg,
        userMessage: userMessage,
      });

      assertPeer(_.isObject(result.employee), {
        msg: 'Expected employee to be an object when status code = 1000, but employee=' + result.employee, // eslint-disable-line prefer-template
      });

      renderEmployeeRow('view', result.employee);
      mainUtils.displayUserMessage('Successfully added new employee!', 'success');
      form.reset();
    });

    return false;
  };

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

    assertUser(Number.isInteger(offset), {
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
    mainUtils.showLoader();

    adminAPI.adminListEmployees(params, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      button.disabled = false;
      mainUtils.hideLoader();
      // TODO error handling

      employees = result.employees;

      renderEmployees($('#employees-table'));
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

    assertUser(Number.isInteger(newOffset), {
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
    mainUtils.showLoader();

    adminAPI.adminListEmployees(params, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      button.disabled = false;
      mainUtils.hideLoader();
      // TODO error handling
      if (result.employees.length === 0) {
        mainUtils.displayUserMessage('You are already on last page!', 'info');
        return;
      }

      offset = newOffset;
      employees = result.employees;

      renderEmployees($('#employees-table'));
    });
  };

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    $('#new-employee-form').submit(onAddNewEmployee);
    $('#prev-page-btn-top').click(onPreviousPageClick);
    $('#next-page-btn-top').click(onNextPageClick);
    $('#prev-page-btn-bottom').click(onPreviousPageClick);
    $('#next-page-btn-bottom').click(onNextPageClick);

    adminAPI.adminGetAPIKey({
      v: '2.0',
    }, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      assertUser(result.status_code === '1000', {
        userMessage: 'Could not get API key for your account. Please try to log out and log back in your account!',
        msg: 'adminGetAPIKey failed with status code: ' + result.status_code, // eslint-disable-line prefer-template
      });
      assertPeer(typeof result.api_key === 'string', {
        msg: 'Expected api key to be a string when status code is 1000, but api key =' + result.api_key, // eslint-disable-line prefer-template
      });

      APIKeyRef.APIKey = result.api_key;

      var callbacksWithEmptyRolesResult = 0; // eslint-disable-line no-var
      const parallelRoleRequests = 5;

      const adminListRolesCallback = function (callbackId) {
        mainUtils.trace('adminListRolesCallback ' + callbackId); // eslint-disable-line prefer-template
        return function (result) {
          mainUtils.trace('result of callback ' + callbackId); // eslint-disable-line prefer-template
          const messages = {
            '1000': 'adminListRolesSuccess',
            '2100': 'Could not get API key for your account. Please try to log out and log back in your account!',
            '2101': 'There was a problem with getting roles for employees. Please refresh the page!',
          };

          assertPeer(typeof messages[result.status_code] === 'string', {
            msg: 'Unexpected status code in adminListRoles. Status code: ' + result.status_code, // eslint-disable-line prefer-template
          });

          const msg = 'Admin list roles failed with status code: ' + result.status_code; // eslint-disable-line prefer-template
          const userMessage = messages[result.status_code] || msg;

          assertUser(result.status_code === '1000', {
            msg: msg,
            userMessage: userMessage,
          });

          assertPeer(Array.isArray(result.roles), {
            msg: 'Expected roles to be an array when status code = 1000, but roles=' + result.roles, // eslint-disable-line prefer-template
          });

          if (result.roles.length > 0) {
            mainUtils.trace('callback result with result.roles.length =' + result.roles.length); // eslint-disable-line prefer-template
            roles = roles.concat(result.roles);

            adminAPI.adminListRoles(
              {
                v: '2.0',
                limit: RESULTS_LIMIT,
                offset: (callbackId + parallelRoleRequests) * RESULTS_LIMIT,
                api_key: APIKeyRef.APIKey,
              },
              PROTOCOL_NAME,
              adminListRolesCallback(callbackId + parallelRoleRequests)
            );
          } else {
            mainUtils.trace('callbacksWithEmptyRolesResult: ' + callbacksWithEmptyRolesResult + 1); // eslint-disable-line prefer-template
            callbacksWithEmptyRolesResult++;

            if (callbacksWithEmptyRolesResult === parallelRoleRequests) {
              adminAPI.adminListEmployees(
                {
                  v: '2.0',
                  limit: RESULTS_LIMIT,
                  offset: 0,
                  api_key: APIKeyRef.APIKey,
                },
                PROTOCOL_NAME,
                function (result) { // eslint-disable-line prefer-arrow-callback
                  mainUtils.hideLoader();

                  const messages = {
                    '1000': 'adminListEmployees success!',
                    '2100': 'Could not get API key for your account. Please try to log out and log back in your account!',
                    '2101': 'There was a problem with getting employees. Please refresh the page!',
                  };

                  assertPeer(typeof messages[result.status_code] === 'string', {
                    msg: 'Unexpected status code in adminListEmployees. Status code: ' + result.status_code, // eslint-disable-line prefer-template
                  });

                  const msg = 'Admin list employees failed with status code: ' + result.status_code; // eslint-disable-line prefer-template
                  const userMessage = messages[result.status_code] || msg;

                  assertUser(result.status_code === '1000', {
                    msg: msg,
                    userMessage: userMessage,
                  });

                  employees = result.employees;
                  renderEmployees($('#employees-table'));
                }
              );

              $('.role-select').autocomplete(roles.map(function (role) { // eslint-disable-line prefer-arrow-callback
                return role.name;
              }));
            }
          }
        };
      };

      var i; // eslint-disable-line no-var

      for (i = 0; i < parallelRoleRequests; i++) {
        const params = {
          v: '2.0',
          limit: RESULTS_LIMIT,
          offset: i * RESULTS_LIMIT,
          api_key: APIKeyRef.APIKey,
        };
        adminAPI.adminListRoles(
          params,
          PROTOCOL_NAME,
          adminListRolesCallback(i)
        );
      }
    });
  });
}

start();
