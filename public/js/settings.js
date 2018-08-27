/* eslint-disable prefer-arrow-callback */
$(document).ready(function () {
  const mainUtils = main();
  const assertUser = mainUtils.assertUser;
  const assertApp = mainUtils.assertApp;

  const api = getAPIMethods(mainUtils);
  const APIKeyRef = mainUtils.APIKeyRef;

  // clear values from browser auto complete
  $('#password').val('');
  $('#confirm-password').val('');

  $('#modify-credentials-form').submit(function (event) {
    event.preventDefault();
    return false;
  });
  $('#submit-new-pw-btn').click(function () {
    const password = $('#password').val().trim();
    const confirmPassword = $('#confirm-password').val().trim();

    assertUser(password === confirmPassword, {
      userMessage: 'Passwords are not the same',
      msg: 'User entered different passwords.',
    });
    assertUser(
      password.length >= 8,
      { userMessage: 'Password is too short', msg: 'User entered short password.' },
    );

    api.modifyCredentials(
      {
        v: '2.0',
        api_key: APIKeyRef.APIKey,
        password: password,
      },
      mainUtils.PROTOCOL_NAME,
      function (result) {
        if (result.status_code >= '1000' && result.status_code < '2000') {
          mainUtils.displayUserMessage('Successfully altered credentials', 'success');
        } else if (result.status_code >= '2000' && result.status_code < '3000') {
          mainUtils.displayUserMessage('Failed to alter credentials.');
        } else {
          assertApp(false, {msg: 'Unhandled status code.'});
        }
      },
    );
  });

  api.getAPIKey({ v: '2.0' }, mainUtils.PROTOCOL_NAME, function (result) {
    if (result.status_code >= '1000' && result.status_code < '2000') {
      APIKeyRef.APIKey = result.api_key;
    } else {
      window.location.replace('/login');
    }
  });
});
