const {} = require('normalize');
const http = require('http');

const options = {
  hostname: 'http://10.20.1.137',
  port: '3001',
  path: '/api/forecast',
  headers: {
    'content-type': 'application/json',
  },
};

async function fetchWeatherCondition (iataCode) {
  const body = JSON.stringify({
    iataCode,
    key: 'XMPpHD8WkD7L2L5g',
  });
  return new Promise((resolve, reject) => {

  });
}
