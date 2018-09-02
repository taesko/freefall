function start () {
  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    const datepickerOptions = {
      dateFormat: 'yy-mm-dd',
    };

    $('#date-from').datepicker(datepickerOptions);
    $('#date-to').datepicker(datepickerOptions);
  });
}

start();
