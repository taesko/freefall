'use strict';

function start () {
  const mainUtils = main();
  const assertApp = mainUtils.assertApp;
  const assertPeer = mainUtils.assertPeer;
  const assertUser = mainUtils.assertUser;
  const UserError = mainUtils.UserError;
  const PROTOCOL_NAME = mainUtils.PROTOCOL_NAME;
  const RESULTS_LIMIT = 20;
  const APIKeyRef = mainUtils.APIKeyRef;

  const adminAPI = getAdminAPIMethods(mainUtils);

  var roles = []; // eslint-disable-line no-var

  function renderEmployeeRow (mode, employee) {
    mainUtils.trace('renderEmployeeRow');

    assertApp(_.isObject(employee), {
      msg: 'Expected employee to be an object, but was ' + typeof employee, // eslint-disable-line prefer-template
    });

    const employeeStringProps = ['id', 'email'];

    _.each(employeeStringProps, function (prop) { // eslint-disable-line prefer-arrow-callback
      assertApp(typeof employee[prop] === 'string', {
        msg: 'Expected employee ' + prop + ' to be a string, but was ' + typeof employee[prop], // eslint-disable-line prefer-template
      });
    });

    const modes = {
      'view': renderEmployeeRowViewMode,
      'edit': renderEmployeeRowEditMode,
    };

    assertApp(typeof modes[mode] === 'function', {
      msg: 'Expected mode to be allowed mode, but was ' + mode, // eslint-disable-line prefer-template
    });

    modes[mode](employee);
  }

  function renderEmployeeRowViewMode (employee) {
    mainUtils.trace('renderEmployeeRowViewMode');

    $('#employee-edit-mode').attr('hidden', 'true');

    const $employeeViewMode = $('#employee-view-mode')
      .removeAttr('hidden');

    $employeeViewMode.find('#employee-view-mode-id')
      .text(employee.id);

    $employeeViewMode.find('#employee-view-mode-email')
      .attr('href', '/employees/' + employee.id) // eslint-disable-line prefer-template
      .text(employee.email);

    var i; // eslint-disable-line no-var
    var employeeRoleName;

    for (i = 0; i < roles.length; i++) {
      if (roles[i].id === employee.role_id) {
        employeeRoleName = roles[i].name;
        break;
      }
    }

    assertUser(typeof employeeRoleName === 'string', {
      msg: 'Attempt to render employee with an unknown role.',
      userMessage: 'Could not resolve role of employee. Please try refreshing the page to fix this issue!',
    });

    $employeeViewMode.find('#employee-view-mode-role')
      .text(employeeRoleName);

    $employeeViewMode.find('#employee-view-mode-role-updated-at')
      .text(employee.role_updated_at);
  }

  function renderEmployeeRowEditMode (employee) {
    mainUtils.trace('renderEmployeeRowEditMode');

    $('#employee-view-mode').attr('hidden', 'true');

    const $employeeEditMode = $('#employee-edit-mode')
      .removeAttr('hidden');

    $employeeEditMode.find('#employee-edit-mode-id')
      .text(employee.id);

    $employeeEditMode.find('#employee-edit-mode-email')
      .attr('value', employee.email);

    var i; // eslint-disable-line no-var
    var employeeRoleName;

    for (i = 0; i < roles.length; i++) {
      if (roles[i].id === employee.role_id) {
        employeeRoleName = roles[i].name;
        break;
      }
    }

    assertUser(typeof employeeRoleName === 'string', {
      msg: 'Attempt to render employee with an unknown role.',
      userMessage: 'Could not resolve role of employee. Please try refreshing the page to fix this issue!',
    });

    $employeeEditMode.find('#employee-edit-mode-role')
      .attr('value', employeeRoleName);

    $employeeEditMode.find('#employee-edit-mode-role-updated-at')
      .text(employee.role_updated_at);
  }

  const onSaveEmployeeClick = function (event) {
    mainUtils.trace('onSaveEmployeeClick');

    const saveButton = event.target;

    const newEmail = $('#employee-edit-mode-email').val().trim();
    const newPassword = $('#employee-edit-mode-password').val().trim();

    const params = {
      v: '2.0',
      api_key: APIKeyRef.APIKey,
      employee_id: employeeGlobal.id,
    };

    if (newEmail.length > 0) {
      params.email = newEmail;
    }

    if (newPassword.length > 0) {
      params.password = newPassword;
    }

    saveButton.disabled = true;

    adminAPI.adminEditEmployee(params, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      saveButton.disabled = false;

      const messages = {
        '1000': 'Successfully updated employee!',
        '2201': 'Edit employee failed: Email is already taken.',
      };

      assertPeer(typeof messages[result.status_code] === 'string', {
        msg: 'Unexpected status code in adminEditEmployee. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
      });

      const employeeMessage = messages[result.status_code] || 'Edit employee failed with status code: ' + result.status_code; // eslint-disable-line prefer-template
      assertUser(result.status_code === '1000', {
        employeeMessage: employeeMessage,
        msg: 'Edit employee failed. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
      });

      if (newEmail.length > 0) {
        employeeGlobal.email = newEmail;
      }

      renderEmployeeRow('view', employeeGlobal);
      mainUtils.displayUserMessage('Successfully updated employee!', 'success');
    });
  };

  const onCancelEditEmployeeClick = function (event) {
    mainUtils.trace('onCancelEditEmployeeClick');

    renderEmployeeRow('view', employeeGlobal);
  };

  const onRemoveEmployeeClick = function (event) {
    mainUtils.trace('onRemoveEmployeeClick');

    const removeButton = event.target;
    removeButton.disabled = true;

    const removeEmployeeParams = {
      v: '2.0',
      employee_id: employeeGlobal.id,
      api_key: APIKeyRef.APIKey,
    };

    adminAPI.adminRemoveEmployee(
      removeEmployeeParams,
      PROTOCOL_NAME,
      function (result) { // eslint-disable-line prefer-arrow-callback
        const messages = {
          '1000': 'Successfully removed employee
        };

        if (result.status_code === '1000') {
          window.location.replace('/employees');
        } else {
          mainUtils.displayUserMessage('Remove employee failed with status code: ' + result.status_code, 'error'); // eslint-disable-line prefer-template
        }
      }
    );
  };

  const onEditEmployeeClick = function (event) {
    mainUtils.trace('onEditEmployeeClick');

    renderEmployeeRow('edit', employeeGlobal);
  };

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
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

      var callbacksWithEmptyRolesResult = 0; // eslint-disable-line prefer-template
      const parallelRoleRequests = 5;

      const adminListRolesCallback = function (callbackId) {
        mainUtils.trace('adminListRolesCallback '+ callbackId); // eslint-disable-line prefer-template
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
            mainUtils.trace('callback result with result.roles.length =' + result.roles.length);
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
            mainUtils.trace('callbacksWithEmptyRolesResult: ' + callbacksWithEmptyRolesResult + 1);
            callbacksWithEmptyRolesResult++;

            if (callbacksWithEmptyRolesResult === parallelRoleRequests) {
              renderEmployeeRow('view', employeeGlobal);
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
        adminAPI.adminListRoles(params, PROTOCOL_NAME, adminListRolesCallback(i));
      }
    });

    $('#employee-view-mode-edit-btn').click(onEditEmployeeClick);
    $('#employee-edit-mode-save-btn').click(onSaveEmployeeClick);
    $('#employee-edit-mode-cancel-btn').click(onCancelEditEmployeeClick);
    $('#employee-edit-mode-remove-btn').click(onRemoveEmployeeClick);
  });
}

start();
