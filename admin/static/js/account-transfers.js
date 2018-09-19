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
      assertApp(typeof filterData.headers[i].name === 'string', {
        msg: 'Expected filterData header to have property name, but name=' + filterData.headers[i].name, // eslint-disable-line prefer-template
      });
      assertApp(typeof filterData.headers[i].namePretty === 'string', {
        msg: 'Expected filterData header to have property namePretty, but namePretty=' + filterData.headers[i].namePretty, // eslint-disable-line prefer-template
      });
      assertApp(filterData.filters.hasOwnProperty(filterData.headers[i].name), {
        msg: 'Filters does not have required header "' + filterData.headers[i].name + '"', // eslint-disable-line prefer-template
      });
    }

    for (i = 0; i < data.headers.length; i++) {
      assertApp(typeof data.headers[i].name === 'string', {
        msg: 'Expected data header name to be string, but name=' + data.headers[i].name, // eslint-disable-line prefer-template
      });
      assertApp(typeof data.headers[i].namePretty === 'string', {
        msg: 'Expected data header namePretty to be string, but namePretty=' + data.headers[i].namePretty, // eslint-disable-line prefer-template
      });
      for (k = 0; k < data.rows.length; k++) {
        assertApp(data.rows[k].hasOwnProperty(data.headers[i].name), {
          msg: 'Data does not have required header "' + data.headers[i].name + '"', // eslint-disable-line prefer-template
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
        filterData.headers[i].namePretty,
        filterData.filters[filterData.headers[i].name],
      ]);
    }

    exportData.push([]);

    {
      const exportDataHeadersRow = [];

      for (i = 0; i < data.headers.length; i++) {
        exportDataHeadersRow.push(data.headers[i].namePretty);
      }

      exportData.push(exportDataHeadersRow);
    }

    for (i = 0; i < data.rows.length; i++) {
      const exportDataRow = [];

      for (k = 0; k < data.headers.length; k++) {
        exportDataRow.push(data.rows[i][data.headers[k].name]);
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
    };

    adminAPI.adminListAccountTransfers(
      listAccountTransfersParams,
      PROTOCOL_NAME,
      function (result) { // eslint-disable-line prefer-arrow-callback
        exportButton.disabled = false;

        const messages = {
          '1000': 'Successfully downloaded account transfers!',
          '2100': 'Your API key does not support this operation!',
          '2101': 'You have sent an invalid request. Please refresh the page and try again!',
          '2201': 'Your request took too long. Please select more filters and try again!',
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

        const filtersHeaders = [
          {
            name: 'transferred_at_from',
            namePretty: 'Transferred at from',
          },
          {
            name: 'transferred_at_to',
            namePretty: 'Transferred at to',
          },
          {
            name: 'type',
            namePretty: 'Transfer type',
          },
          {
            name: 'reason',
            namePretty: 'Transfer reason',
          },
          {
            name: 'subscr_airport_from',
            namePretty: 'Subscription airport from',
          },
          {
            name: 'subscr_airport_to',
            namePretty: 'Subscription airport to',
          },
          {
            name: 'fetch_time_from',
            namePretty: 'Fetch time from',
          },
          {
            name: 'fetch_time_to',
            namePretty: 'Fetch time to',
          },
          {
            name: 'employee_email',
            namePretty: 'Employee email',
          },
          {
            name: 'user_subscr_airport_from',
            namePretty: 'User subscription departure airport',
          },
          {
            name: 'user_subscr_airport_to',
            namePretty: 'User subscription arrival airport',
          },
          {
            name: 'user_subscr_depart_time_from',
            namePretty: 'User subscription departure time from',
          },
          {
            name: 'user_subscr_depart_time_to',
            namePretty: 'User subscription departure time to',
          },
          {
            name: 'user_subscr_arrival_time_from',
            namePretty: 'User subscription arrival time from',
          },
          {
            name: 'user_subscr_arrival_time_to',
            namePretty: 'User subscription arrival time to',
          },
        ];

        const dataHeadersPrettyNames = {
          'transferred_at': 'Transferred at',
          'type': 'Transfer type',
          'reason': 'Transfer reason',
          'account_owner_id': 'User id',
          'account_owner_email': 'User email',
          'subscr_airport_from_name': 'Subscription airport from',
          'subscr_airport_to_name': 'Subscription airport to',
          'fetch_time': 'Fetch time',
          'employee_transferrer_id': 'Employee transferrer id',
          'employee_transferrer_email': 'Employee transferrer email',
          'user_subscr_airport_from_name': 'User subscription airport from',
          'user_subscr_airport_to_name': 'User subscription airport to',
          'user_subscr_date_from': 'User subscription date from',
          'user_subscr_date_to': 'User subscription date to',
          'deposit_amount': 'Deposits',
          'withdrawal_amount': 'Withdrawals',
          'account_transfer_id': 'Account transfer id',
          'grouped_amount': 'Grouped amount',
        };

        const currentDate = (new Date()).toISOString().replace(':', '-').replace('.', '-');

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet(
          generateExportData(
            {
              headers: filtersHeaders,
              filters: filtersGlobal,
            },
            {
              headers: result.active_columns.map(function (column) { // eslint-disable-line prefer-arrow-callback
                assertApp(typeof dataHeadersPrettyNames[column] === 'string', {
                  msg: 'Expected dattaHeaderPrettyName to be string but was =' + dataHeadersPrettyNames[column], // eslint-disable-line prefer-template
                });
                return {
                  name: column,
                  namePretty: dataHeadersPrettyNames[column],
                };
              }),
              rows: result.account_transfers,
            }
          )
        );
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

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
