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
      assertApp(typeof data.headers[i].isActive === 'boolean', {
        msg: 'Expected data header isActive to be boolean, but isActive=' + data.headers[i].isActive, // eslint-disable-line prefer-template
      });

      if (data.headers[i].isActive) {
        for (k = 0; k < data.rows.length; k++) {
          assertApp(data.rows[k].hasOwnProperty(data.headers[i].name), {
            msg: 'Data does not have required header "' + data.headers[i].name + '"', // eslint-disable-line prefer-template
          });
        }
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
        if (data.headers[k].isActive) {
          exportDataRow.push(data.rows[i][data.headers[k].name]);
        } else {
          exportDataRow.push('All');
        }
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

        const dataHeaders = [
          {
            name: 'transferred_at',
            namePretty: 'Transferred at',
          },
          {
            name: 'reason',
            namePretty: 'Transfer reason',
          },
          {
            name: 'account_owner_id',
            namePretty: 'User id',
          },
          {
            name: 'account_owner_email',
            namePretty: 'User email',
          },
          {
            name: 'subscr_airport_from_name',
            namePretty: 'Subscription airport from',
          },
          {
            name: 'subscr_airport_to_name',
            namePretty: 'Subscription airport to',
          },
          {
            name: 'fetch_time',
            namePretty: 'Fetch time',
          },
          {
            name: 'employee_transferrer_id',
            namePretty: 'Employee transferrer id',
          },
          {
            name: 'employee_transferrer_email',
            namePretty: 'Employee transferrer email',
          },
          {
            name: 'user_subscr_airport_from_name',
            namePretty: 'User subscription airport from',
          },
          {
            name: 'user_subscr_airport_to_name',
            namePretty: 'User subscription airport to',
          },
          {
            name: 'user_subscr_date_from',
            namePretty: 'User subscription date from',
          },
          {
            name: 'user_subscr_date_to',
            namePretty: 'User subscription date to',
          },
          {
            name: 'deposit_amount',
            namePretty: 'Deposits',
          },
          {
            name: 'withdrawal_amount',
            namePretty: 'Withdrawals',
          },
          {
            name: 'account_transfer_id',
            namePretty: 'Account transfer id',
          },
          {
            name: 'grouped_amount',
            namePretty: 'Grouped amount',
          },
        ];

        const currentDate = (new Date()).toISOString().replace(':', '-').replace('.', '-');

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet(
          generateExportData(
            {
              headers: filtersHeaders,
              filters: filtersGlobal,
            },
            {
              headers: dataHeaders.map(function (header) { // eslint-disable-line prefer-arrow-callback
                assertApp(typeof header.name === 'string', {
                  msg: 'Expected header to have a property "name" of type string, but name=' + header.name, // eslint-disable-line prefer-template
                });
                assertApp(typeof header.namePretty === 'string', {
                  msg: 'Expected header to have a property "namePretty" of type string, but namePretty=' + header.namePretty, // eslint-disable-line prefer-template
                });
                return {
                  name: header.name,
                  namePretty: header.namePretty,
                  isActive: result.active_columns.indexOf(header.name) >= 0,
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
