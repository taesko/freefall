const fs = require('fs');

if (process.argv.length < 3) {
  console.log(`Usage: node ${process.argv[1]} FILENAME`); // eslint-disable-line no-console
  process.exit(1);
}

const fileName = process.argv[2];

fs.readFile(fileName, 'utf-8', (err, data) => {
  if (err) {
    throw err;
  }

  const parsed = parseData(data);
  const removedHeader = removeHeader(parsed);
  const ttimeSum = getColumnSum(removedHeader, 4);
  console.log(ttimeSum); // eslint-disable-line no-console
  console.log(ttimeSum / removedHeader.length);
});

function parseData (data) {
  const rows = data.split('\n');
  const parsed = rows.map((row) => row.split('\t'));
  const parsedSanitized = parsed.filter((e) => e.length === 6);

  return parsedSanitized;
}

function removeHeader (data) {
  return data.filter((e, index) => index !== 0);
}

function getColumnSum (data, col) {
  return data.reduce((sum, e) => {
    return sum + Number(e[col]);
  }, 0);
}
