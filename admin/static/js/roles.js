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
