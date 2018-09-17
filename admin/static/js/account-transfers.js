function start () {
  const mainUtils = main();
  const PROTOCOL_NAME = mainUtils.PROTOCOL_NAME;
  const assertPeer = mainUtils.assertPeer;
  const assertApp = mainUtils.assertApp;
  const assertUser = mainUtils.assertUser;

  const APIKeyRef = mainUtils.APIKeyRef;
  const adminAPI = getAdminAPIMethods(mainUtils);

  function generateExportData (filterData, data) {
    assertApp(Array.isArray(filterData.headers), {
      msg: 'Expected filterData.headers to be array, but filterData.headers=' + filterData.headers, // eslint-disable-line prefer-template
    });
    assertApp(_.isObject(filterData.filters), {
      msg: 'Expected filterData.filters to be object, but filterData.filters=' + filterData.filters, // eslint-disable-line prefer-template
    });
    assertApp(Array.isArray(data.headers), {
      msg: 'Expected data.headers to be array, but data.headers=' + data.headers, // eslint-disable-line prefer-template
    });
    assertApp(Array.isArray(data.rows), {
      msg: 'Expected data.rows to be array, but data.rows=' + data.rows, // eslint-disable-line prefer-template
    });

    var i; // eslint-disable-line no-var
    var k; // eslint-disable-line no-var

    for (i = 0; i < filterData.headers.length; i++) {
      assertApp(filterData.filters.hasOwnProperty(filterData.headers[i]), {
        msg: 'Filters does not have required header "' + filterData.headers[i] + '"', // eslint-disable-line prefer-template
      });
    }

    for (i = 0; i < data.headers.length; i++) {
      for (k = 0; k < data.rows.length; k++) {
        assertApp(data.rows[k].hasOwnProperty(data.headers[i]), {
          msg: 'Data does not have required header "' + data.headers[i] + '"', // eslint-disable-line prefer-template
        });
      }
    }

    const exportData = [];

    exportData.push([
      'Filter name',
      'Filter value',
    ]);

    for (i = 0; i < filterData.headers.length; i++) {
      exportData.push([
        filterData.headers[i],
        filterData.filters[filterData.headers[i]],
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

      for (k = 0; k < data.headers.length; k++) {
        exportDataRow.push(data.rows[i][data.headers[k]]);
      }

      exportData.push(exportDataRow);
    }

    return exportData;
  }

  const onExportAsXLSXClick = function (event) {
    mainUtils.trace('onExportAsXLSXClick');
    console.log('b4');
    console.log(new Date());

    const exportButton = event.target;
    exportButton.disabled = true;

    /*const listAccountTransfersParams = {
      v: '2.0',
      api_key: APIKeyRef.APIKey,
      filters: Object.entries(filtersGlobal).reduce(
        (acc, [name, value]) => {
          if (value.length > 0) {
            return {
              ...acc,
              [name]: value,
            };
          } else {
            return acc;
          }
        },
        {}
      ),
      groupings: Object.entries(groupingsGlobal).reduce(
        (acc, [name, value]) => ({
          ...acc,
          [name]: value || 'none',
        }),
        {}
      ),
    };*/

    /*adminAPI.adminListAccountTransfers(
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

        const currentDate = (new Date()).toISOString().replace(':', '-').replace('.', '-');

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet(
          generateExportData(
            {
              headers: [
                'user',
                'transferred_at_from',
                'transferred_at_to',
                'type',
                'reason',
                'subscr_airport_from',
                'subscr_airport_to',
                'fetch_time_from',
                'fetch_time_to',
                'employee_email',
                'user_subscr_airport_from',
                'user_subscr_airport_to',
                'user_subscr_depart_time_from',
                'user_subscr_depart_time_to',
                'user_subscr_arrival_time_from',
                'user_subscr_arrival_time_to',
              ],
              filters: filtersGlobal,
            },
            {
              headers: result.active_columns,
              rows: result.account_transfers,
            }
          )
        );
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
        console.log('after');
        console.log(new Date());

        // getMonth() + 1. because months in JS start from 0
        XLSX.writeFile(workbook, 'account_transfers_' + currentDate + '.xlsx'); // eslint-disable-line prefer-template
      }
    );*/

    mainUtils.getAjaxResponseText(
      {
        url: '/transfers?return-type=json' + queryStringWithoutPage,
        method: 'GET',
        contentType: 'application/json',
        body: null,
      },
      function (response) { // eslint-disable-line prefer-arrow-callback
        exportButton.disabled = false;

        // TODO check response.status code

        var result; // eslint-disable-line no-var

        try {
          result = JSON.parse(response.responseText);
        } catch (error) {
          console.log(error); // TODO handle
        }

        const currentDate = (new Date()).toISOString().replace(':', '-').replace('.', '-');

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet(
          generateExportData(
            {
              headers: [
                'user',
                'transferred_at_from',
                'transferred_at_to',
                'type',
                'reason',
                'subscr_airport_from',
                'subscr_airport_to',
                'fetch_time_from',
                'fetch_time_to',
                'employee_email',
                'user_subscr_airport_from',
                'user_subscr_airport_to',
                'user_subscr_depart_time_from',
                'user_subscr_depart_time_to',
                'user_subscr_arrival_time_from',
                'user_subscr_arrival_time_to',
              ],
              filters: filtersGlobal,
            },
            {
              headers: result.active_columns,
              rows: result.account_transfers,
            }
          )
        );
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
        console.log('after');
        console.log(new Date());

        // getMonth() + 1. because months in JS start from 0
        XLSX.writeFile(workbook, 'account_transfers_' + currentDate + '.xlsx'); // eslint-disable-line prefer-template
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

    const datetimepickerOptions = {
      format: 'Y-m-d H:i:s',
    };

    $('#filter-transferred-at-from').datetimepicker(datetimepickerOptions);
    $('#filter-transferred-at-to').datetimepicker(datetimepickerOptions);
    $('#filter-fetch-time-from').datetimepicker(datetimepickerOptions);
    $('#filter-fetch-time-to').datetimepicker(datetimepickerOptions);
    $('#filter-user-subscr-depart-time-from').datetimepicker(datetimepickerOptions);
    $('#filter-user-subscr-depart-time-to').datetimepicker(datetimepickerOptions);
    $('#filter-user-subscr-arrival-time-from').datetimepicker(datetimepickerOptions);
    $('#filter-user-subscr-arrival-time-to').datetimepicker(datetimepickerOptions);
  });
}

start();
