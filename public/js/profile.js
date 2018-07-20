'use strict';

function start () {
  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    const AIRPORT_HASH = airportDump();
    var key; // eslint-disable-line no-var
    var airportHashValues = []; // eslint-disable-line no-var

    for (key in AIRPORT_HASH) {
      if (Object.prototype.hasOwnProperty.call(AIRPORT_HASH, key)) {
        airportHashValues.push(AIRPORT_HASH[key]);
      }
    }

    const airportsByNames = airportHashValues
      .reduce(function (hash, airport) { // eslint-disable-line prefer-arrow-callback
        hash[airport.latinName] = airport;
        hash[airport.nationalName] = airport;
        hash[airport.cityName] = airport;
        return hash;
      },
      {}
      );

    $('#from-input').autocomplete(airportsByNames);
    $('#to-input').autocomplete(airportsByNames);

    const datepickerOptions = {
      dateFormat: 'yy-mm-dd',
    };

    $('#date-from').datepicker(datepickerOptions);
    $('#date-to').datepicker(datepickerOptions);
  });
}

start();
