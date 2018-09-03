'use strict';

function start () {
  const mainUtils = main();
  const ApplicationError = mainUtils.ApplicationError;
  const assertApp = mainUtils.assertApp;
  const assertPeer = mainUtils.assertPeer;
  const assertUser = mainUtils.assertUser;
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

    $('#employee-edit-mode').attr('hidden', true);

    const $employeeViewMode = $('#employee-view-mode')
      .removeAttr('hidden');

    $employeeViewMode.find('#employee-view-mode-id')
      .text(employee.id);

    $employeeViewMode.find('#employee-view-mode-email')
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

    $('#employee-view-mode').attr('hidden', true);

    const $employeeEditMode = $('#employee-edit-mode')
      .removeAttr('hidden');

    $employeeEditMode.find('#employee-edit-mode-id')
      .text(employee.id);

    $employeeEditMode.find('#employee-edit-mode-email')
      .attr('value', employee.email);

    var i; // eslint-disable-line no-var
    var employeeRoleName; // eslint-disable-line no-var

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

  const onSaveEmployee = function (event) {
    mainUtils.trace('onSaveEmployee');
    event.preventDefault();

    const form = event.target;
    const formData = $(form).serializeArray();

    var i; // eslint-disable-line no-var
    var editedEmail, editedPassword, editedRoleName; // eslint-disable-line no-var

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
        editedEmail = formData[i].value.trim();
      } else if (formData[i].name === 'employee-password') {
        editedPassword = formData[i].value.trim();
      } else if (formData[i].name === 'employee-role') {
        editedRoleName = formData[i].value.trim();
      } else {
        throw new ApplicationError({
          msg: 'Unknown formData name: ' + formData[i].name, // eslint-disable-line prefer-template
        });
      }
    }

    assertApp(typeof editedEmail === 'string', {
      msg: 'Expected editedEmail to be string, but editedEmail =' + editedEmail, // eslint-disable-line prefer-template
    });
    assertApp(typeof editedPassword === 'string', {
      msg: 'Expected editedPassword to be string, but editedPassword =' + editedPassword, // eslint-disable-line prefer-template
    });
    assertApp(typeof editedRoleName === 'string', {
      msg: 'Expected editedRoleName to be string, but editedRoleName =' + editedRoleName, // eslint-disable-line prefer-template
    });

    const params = {
      v: '2.0',
      api_key: APIKeyRef.APIKey,
      employee_id: employeeGlobal.id,
    };

    if (editedEmail.length > 0) {
      assertUser(editedEmail.length > 2, {
        userMessage: 'Please enter a valid email!',
        msg: 'Expected user to enter a valid employee email address, but editedEmail =' + editedEmail, // eslint-disable-line prefer-template
      });
      params.email = editedEmail;
    }

    if (editedPassword.length > 0) {
      params.password = editedPassword;
    }

    if (editedRoleName.length > 0) {
      var editedRole; // eslint-disable-line no-var

      for (i = 0; i < roles.length; i++) {
        if (roles[i].name === editedRoleName) {
          editedRole = roles[i];
          break;
        }
      }

      assertUser(_.isObject(editedRole), {
        userMessage: 'Can not assign role! Role does not exist!',
        msg: 'User entered a name of role that could not be resolved to an existing role, editedRole =' + editedRole, // eslint-disable-line prefer-template
      });

      assertApp(typeof editedRole.id === 'number', {
        msg: 'Expected editedRole.id to be a number, but editedRole.id=' + editedRole.id, // eslint-disable-line prefer-template
      });

      params.role_id = editedRole.id;
    }

    $(form).off('submit').submit(function (event) { // eslint-disable-line prefer-arrow-callback
      event.preventDefault();
      return false;
    });

    adminAPI.adminEditEmployee(params, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      $(form).off('submit').submit(onSaveEmployee);

      const messages = {
        '1000': 'Successfully updated employee!',
        '2100': 'Your API key does not support this operation!',
        '2101': 'The form you sent was not in expected format. Please correct any wrong inputs and try again!',
        '2201': 'This employee does not exists! Please refresh the page and try again!',
        '2202': 'You have assigned a role that was not recognized! Please, refresh the page and try again!',
        '2203': 'Edit employee failed: Email is already taken.',
      };

      assertPeer(typeof messages[result.status_code] === 'string', {
        msg: 'Unexpected status code in adminEditEmployee. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
      });

      const userMessage = messages[result.status_code] || 'Edit employee failed with status code: ' + result.status_code; // eslint-disable-line prefer-template
      assertUser(result.status_code === '1000', {
        userMessage: userMessage,
        msg: 'Edit employee failed. Status code: "' + result.status_code + '"', // eslint-disable-line prefer-template
      });

      assertPeer(_.isObject(result.employee), {
        msg: 'Expected adminEditEmployee to return an employee object when status code = "1000", but result.employee=' + result.employee, // eslint-disable-line prefer-template
      });

      employeeGlobal = result.employee;

      renderEmployeeRow('view', employeeGlobal);
      mainUtils.displayUserMessage('Successfully updated employee!', 'success');
    });

    return false;
  };

  const onCancelEditEmployeeClick = function (event) {
    mainUtils.trace('onCancelEditEmployeeClick');

    renderEmployeeRow('view', employeeGlobal);
  };

  const onRemoveEmployeeClick = function (event) {
    mainUtils.trace('onRemoveEmployeeClick');

    $('#confirm-remove-employee-dialog').dialog({
      classes: {
        'ui-dialog-titlebar': 'info-dialog-titlebar',
      },
      buttons: [
        {
          text: 'Cancel',
          click: function () {
            $(this).dialog('close');
          },
        },
        {
          text: 'Remove',
          class: 'confirm-remove-btn',
          click: onConfirmRemoveEmployeeClick,
        },
      ],
      show: {
        effect: 'highlight',
        duration: 500,
      },
    });
  };

  const onConfirmRemoveEmployeeClick = function (event) {
    mainUtils.trace('onConfirmRemoveEmployeeClick');

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
          '1000': 'Successfully removed employee',
          '2100': 'Your API key does not support this operation!',
          '2101': 'The form you sent was not in expected format. Please correct any wrong inputs and try again!',
          '2201': 'Remove failed: no such employee found!',
        };

        assertPeer(typeof messages[result.status_code] === 'string', {
          msg: 'Unexpected status code in adminRemoveEmployee. Status code: ' + result.status_code, // eslint-disable-line prefer-template
        });

        const msg = 'Admin remove employee failed with status code: ' + result.status_code; // eslint-disable-line prefer-template
        const userMessage = messages[result.status_code] || msg;

        assertUser(result.status_code === '1000', {
          msg: msg,
          userMessage: userMessage,
        });

        window.location.replace('/employees');
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
              renderEmployeeRow('view', employeeGlobal);

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

    $('#edit-employee').submit(onSaveEmployee);
    $('#employee-view-mode-edit-btn').click(onEditEmployeeClick);
    $('#employee-view-mode-remove-btn').click(onRemoveEmployeeClick);
    $('#employee-edit-mode-cancel-btn').click(onCancelEditEmployeeClick);
  });
}

start();
