const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');

class CustomError extends Error {}
class PeerError extends CustomError {}
class AppError extends CustomError {}
class UserError extends CustomError {}

function assertApp (condition) {
  if (typeof condition !== 'boolean') {
    throw new AppError();
  }

  if (!condition) {
     throw new AppError();
  }
}

function assertPeer (condition, msg) {
  if (typeof condition !== 'boolean') {
    throw new AppError();
  }

  if (!condition) {
    throw new PeerError(msg);
  }
}

function assertUser (condition, msg) {
  if (typeof condition !== 'boolean') {
    throw new AppError();
  }

  if (!condition) {
    throw new UserError(msg);
  }
}

function start () {
  assertUser(process.argv.length === 3, 'Expected argument scan root dir path.');

  scanRootDirPath = process.argv[2];

  assertUser(fs.existsSync(scanRootDirPath), `Provided argument "${scanRootDirPath}" is not a directory.`);
  assertUser(fs.lstatSync(scanRootDirPath).isDirectory(), `Provided argument "${scanRootDirPath}" not a directory`);

  const dirsLicenses = {};
  const dirs = [];
  const licenseTexts = [];

  const watcher = chokidar.watch(scanRootDirPath);

  watcher.on('add', (filePath) => {
    assertApp(typeof filePath === 'string');

    const basename = path.basename(filePath);
    const basenameUpCase = basename.toUpperCase();

    if (
      basenameUpCase === 'LICENSE' ||
      basenameUpCase === 'LICENSE.TXT' ||
      basenameUpCase === 'LICENSE.MD' ||
      basenameUpCase === 'LICENCE' ||
      basenameUpCase === 'LICENSE.BSD' ||
      basenameUpCase === 'LICENSE-MIT' ||
      basenameUpCase === 'LICENSE-MIT.TXT'
    ) {
      dirsLicenses[filePath.replace(basename, '')] = filePath;
    }
  }).on('addDir', (filePath) => {
    assertApp(typeof filePath === 'string');

    dirs.push(`${filePath}/`);
  }).on('ready', () => {
    watcher.close();

    const licenseDirs = Object.keys(dirsLicenses);

    for (const dir of dirs) {
      if (!licenseDirs.includes(dir)) {
        console.log(`License not found in ${dir}"`);
      } else {
        const data = fs.readFileSync(dirsLicenses[dir], {
          encoding: 'utf-8',
        });

        licenseTexts.push({
          text: data,
          module: path.basename(dir),
        })
      }
    }

    fs.writeFileSync('./licenses.txt', licenseTexts.map((licenseText) => {
      return `==========\n${licenseText.module}\n==========\n${licenseText.text}\n==========`;
    }).join('\n'));

    console.log('Done');
  });
}

try {
  start();
} catch (error) {
  if (error instanceof PeerError) {
    console.log('There was an error with foreign service:');
    console.log(error);
  } else if (error instanceof UserError) {
    console.log(error);
  } else if (error instanceof AppError) {
    console.log('An application error has occurred:');
    console.log(error);
  } else {
    console.log('An application error has occurred:');
    console.log(error);
    new AppError();
  }
}
