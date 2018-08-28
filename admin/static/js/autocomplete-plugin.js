(function ($) {
  $.fn.autocomplete = function (data) {
    return this.each(function () {
      var $dataList; // eslint-disable-line no-var

      if ($(this).siblings('datalist').length > 0) {
        $dataList = $(this).siblings('datalist');
      } else {
        $(this).attr('list', $(this).attr('name'));
        $(this).attr('autocomplete', 'off');
        $dataList = $('<datalist></datalist>')
          .attr('id', $(this).attr('name'))
          .insertAfter($(this));
      }

      $dataList.empty();

      var i; // eslint-disable-line no-var

      for (i = 0; i < data.length; i++) {
        $('<option></option>')
          .attr('value', data[i])
          .appendTo($dataList);
      }
    });
  };
})(jQuery);
