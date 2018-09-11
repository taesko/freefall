function start () {
  const mainUtils = main();
  const PROTOCOL_NAME = mainUtils.PROTOCOL_NAME;
  const assertPeer = mainUtils.assertPeer;
  const assertUser = mainUtils.assertUser;

  const APIKeyRef = mainUtils.APIKeyRef;
  const adminAPI = getAdminAPIMethods(mainUtils);

  function generateExportData (filters, data) {
    const exportData = [];

    exportData.push([
      'Filter name',
      'Filter value',
    ]);

    var i; // eslint-disable-line no-var

    for (i = 0; i < filters.headers.length; i++) {
      exportData.push([
        filters.headers[i],
        filters.rows[filters.headers[i]],
      ]);
    }

    exportData.push([]);

    {
      const exportDataHeadersRow = [];

      for (i = 0; i < data.headers.length; i++) {
        exportDataHeadersRow.push(data.headers[i]);
      }

      exportData.push(exportDataHeadersRow);
    }

    for (i = 0; i < data.rows.length; i++) {
      const exportDataRow = [];

      var k; // eslint-disable-line no-var

      for (k = 0; k < data.headers.length; k++) {
        exportDataRow.push(data.rows[i][data.headers[k]]);
      }

      exportData.push(exportDataRow);
    }

    return exportData;
  }

  const onExportAsXLSXClick = function (event) {
    mainUtils.trace('onExportAsXLSXClick');

    const exportButton = event.target;
    exportButton.disabled = true;

    const listAccountTransfersParams = {
      v: '2.0',
      api_key: APIKeyRef.APIKey,
    };

    if (filtersGlobal.user_email.length > 0) {
      listAccountTransfersParams.user_email = filtersGlobal.user_email;
    }

    if (filtersGlobal.date_from.length > 0) {
      listAccountTransfersParams.date_from = filtersGlobal.date_from;
    }

    if (filtersGlobal.date_to.length > 0) {
      listAccountTransfersParams.date_to = filtersGlobal.date_to;
    }

    if (filtersGlobal.type.length > 0) {
      listAccountTransfersParams.type = filtersGlobal.type;
    } else {
      listAccountTransfersParams.type = 'all';
    }

    if (filtersGlobal.reason.length > 0) {
      listAccountTransfersParams.reason = filtersGlobal.reason;
    } else {
      listAccountTransfersParams.reason = 'all';
    }

    adminAPI.adminListAccountTransfers(
      listAccountTransfersParams,
      PROTOCOL_NAME,
      function (result) { // eslint-disable-line prefer-arrow-callback
        exportButton.disabled = false;

        const messages = {
          '1000': 'Successfully downloaded account transfers!',
          '2100': 'Your API key does not support this operation!',
        };

        assertPeer(typeof messages[result.status_code] === 'string', {
          msg: 'Unexpected status code in adminRemoveUser. Status code: ' + result.status_code, // eslint-disable-line prefer-template
        });

        const msg = 'List account transfers failed with status code: ' + result.status_code; // eslint-disable-line prefer-template
        const userMessage = messages[result.status_code] || msg;

        assertUser(result.status_code === '1000', {
          userMessage: userMessage,
          msg: msg,
        });

        const accountTransfers = result.account_transfers.map(function (at) { // eslint-disable-line prefer-arrow-callback
          at.user_email = at.user.email;
          at.user_id = at.user.id;
          delete at.user;
          return at;
        });

        accountTransfers.push({
          test: 'foo',
          test2: 'foo2',
        });

        const currentDate = (new Date()).toISOString().replace(':', '-').replace('.', '-');

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet(
          generateExportData(
            {
              headers: [
                "user_email",
                "date_from",
                "date_to",
                "type",
                "reason",
              ],
              rows: filtersGlobal,
            },
            {
              headers: [
                "account_transfer_id",
                "user_id",
                "user_email",
                "deposit_amount",
                "withdrawal_amount",
                "transferred_at",
                "employee_transferrer_id",
                "employee_transferrer_email",
                "user_subscr_airport_from_name",
                "user_subscr_airport_to_name",
                "user_subscr_date_from",
                "user_subscr_date_to",
                "subscr_airport_from_name",
                "subscr_airport_to_name",
                "fetch_time",
              ],
              rows: accountTransfers,
            }
          )
        );
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

        // getMonth() + 1. because months in JS start from 0
        XLSX.writeFile(workbook, `account_transfers_${currentDate}.xlsx`);
      }
    );
  };

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    adminAPI.adminGetAPIKey({
      v: '2.0',
    }, PROTOCOL_NAME, function (result) { // eslint-disable-line prefer-arrow-callback
      if (result.status_code === '1000') {
        APIKeyRef.APIKey = result.api_key;

        $('#export-xlsx-btn').click(onExportAsXLSXClick);
      } else {
        mainUtils.displayUserMessage('Could not get API key for your account. Please try to log out and log back in your account!', 'error');
      }
    });

    const datepickerOptions = {
      dateFormat: 'yy-mm-dd',
    };

    $('#date-from').datepicker(datepickerOptions);
    $('#date-to').datepicker(datepickerOptions);
  });
}

start();
