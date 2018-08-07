(function ($) {
  const API_LINK = '/api/dalipeche';
  const ICON_WIDTH = 64;
  const ICON_HEIGHT = 64;

  $.fn.getForecastByCity = function (city, key) {
    if (typeof city !== 'string') {
      log('getForecastByCity expected string value for argument city');
      return;
    }

    // if (typeof key !== 'string') {
    //   log('getForecastByCity expected string value for argument key');
    //   return;
    // }

    displayImage(
      {
        city: city,
        key: key,
      },
      this[0]
    );
  };

  $.fn.getForecastByIATACode = function (iataCode, key) {
    if (typeof iataCode !== 'string') {
      log('getForecastByIATACode expected string value for argument iataCode');
      return;
    }

    // if (typeof key !== 'string') {
    //   log('getForecastByIATACode expected string value for argument key');
    //   return;
    // }

    displayImage(
      {
        iataCode: iataCode,
        key: key,
      },
      this[0]
    );
  };

  function displayImage (options, parent) {
    if (typeof options !== 'object' || options === null) {
      log('displayImage called with options parameter not an object');
      return;
    }

    if (!(parent instanceof window.HTMLElement)) {
      log('displayImage called with parent parameter not an HTMLElement');
      return;
    }

    while (parent.firstChild) {
      parent.removeChild(parent.firstChild);
    }

    const image = document.createElement('img');
    image.setAttribute('src', getWeatherImage());
    image.setAttribute('height', ICON_HEIGHT);
    image.setAttribute('width', ICON_WIDTH);
    image.setAttribute('alt', 'Weather icon');
    parent.appendChild(image);

    sendRequest(options, function (error, result) { // eslint-disable-line prefer-arrow-callback
      if (error) {
        log('Failed to fetch forecast data. Error: ', error);
        return;
      }

      if (
        typeof result !== 'object' ||
        result === null
      ) {
        log('Peer error');
        return;
      }

      if (!Array.isArray(result.conditions)) {
        log('No weather information.');
        return;
      }

      const weatherTypes = {};
      var i = 0; // eslint-disable-line no-var

      for (i = 0; i < result.conditions.length; i++) {
        const condition = result.conditions[i];

        if (typeof condition !== 'object' || condition === null) {
          log('condition not an object.');
          return;
        }

        if (typeof condition.weather !== 'string') {
          log('condition.weather not a string');
          return;
        }

        if (condition.weather in weatherTypes) {
          weatherTypes[condition.weather] += 1;
          continue;
        }

        weatherTypes[condition.weather] = 1;
      }

      const mainWeather = Object.keys(weatherTypes).reduce(function (a, b) { // eslint-disable-line prefer-arrow-callback
        return weatherTypes[a] > weatherTypes[b] ? a : b;
      });

      image.setAttribute('src', getWeatherImage(mainWeather));
    });
  }

  function getWeatherImage (weather) {
    if (weather === 'Clouds') return 'http://www.myiconfinder.com/uploads/iconsets/256-256-d559b1d54a6141514622627a70b7c4d9-cloud.png';
    if (weather === 'Rain') return 'https://cdn4.iconfinder.com/data/icons/sunnyday-simple/142/sun_rain-512.png';
    if (weather === 'Snow') return 'https://cdn4.iconfinder.com/data/icons/iconsimple-weather/512/snow-512.png';
    if (weather === 'Clear') return 'https://image.flaticon.com/icons/png/512/63/63366.png';
    return 'https://cdn3.iconfinder.com/data/icons/weather-pack-3/512/rainbow-512.png';
  }

  function log (...msgs) {
    console.log('Dalipeche plugin:', msgs.join(' ')); // eslint-disable-line no-console
  }

  function sendRequest (requestData, callback) {
    if (typeof requestData !== 'object' || requestData === null) {
      log('Expected requestData to be object');
    }

    var requestDataStringified; // eslint-disable-line no-var

    try {
      requestDataStringified = JSON.stringify(requestData);
    } catch (error) {
      return setTimeout(function () { // eslint-disable-line prefer-arrow-callback
        callback(error);
      }, 0);
    }

    var xhr = new window.XMLHttpRequest(); // eslint-disable-line no-var

    xhr.onreadystatechange = function () { // eslint-disable-line prefer-arrow-callback
      var result; // eslint-disable-line no-var

      if (xhr.readyState === window.XMLHttpRequest.DONE) {
        if (xhr.status === 200) {
          try {
            result = JSON.parse(xhr.responseText);
          } catch (error) {
            return setTimeout(function () { // eslint-disable-line prefer-arrow-callback
              callback(error);
            }, 0);
          }

          callback(null, result);
        } else if (xhr.status !== 204) {
          return setTimeout(function () { // eslint-disable-line prefer-arrow-callback
            callback(new Error('Service is not available at the moment due to network issues'));
          });
        }
      }
    };

    xhr.open('POST', API_LINK);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Access-Control-Allow-Origin', '*');
    xhr.send(requestDataStringified);
  }
})(jQuery);
