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
  assertUser(process.argv.length === 3, 'Expected argument node_modules dir path.');

  scanRootDirPath = process.argv[2];

  assertUser(fs.existsSync(scanRootDirPath), `Provided argument "${scanRootDirPath}" is not a directory.`);
  assertUser(fs.lstatSync(scanRootDirPath).isDirectory(), `Provided argument "${scanRootDirPath}" not a directory`);

  const nodeModulesDirsLicenses = {};
  const nodeModulesDirs = [];
  const nodeModulesLicenseTexts = [];

  const nodeModulesWatcher = chokidar.watch(scanRootDirPath, {
    persistent: false,
  });

  nodeModulesWatcher.on('add', (filePath) => {
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
      nodeModulesDirsLicenses[filePath.replace(basename, '')] = filePath;
    }
  }).on('addDir', (filePath) => {
    assertApp(typeof filePath === 'string');

    nodeModulesDirs.push(`${filePath}/`);
  }).on('ready', () => {
    nodeModulesWatcher.close();

    const nodeModulesLicenseDirs = Object.keys(nodeModulesDirsLicenses);

    for (const dir of nodeModulesDirs) {
      if (!nodeModulesLicenseDirs.includes(dir)) {
        console.log(`License not found in "${dir}"`);
      } else {
        const data = fs.readFileSync(nodeModulesDirsLicenses[dir], {
          encoding: 'utf-8',
        });

        nodeModulesLicenseTexts.push({
          text: data,
          module: path.basename(dir),
        });
      }
    }

    fs.writeFileSync('./node_modules_licenses.txt', nodeModulesLicenseTexts.map((licenseText) => {
      return `==========\n${licenseText.module}\n==========\n${licenseText.text}\n==========`;
    }).join('\n'));

    const linuxPackages = fs.readdirSync('/usr/share/doc');
    const linuxPackagesLicenseTexts = [];

    for (linuxPackage of linuxPackages) {
      const copyrightFileName = `/usr/share/doc/${linuxPackage}/copyright`;

      if (fs.existsSync(copyrightFileName)) {
        const data = fs.readFileSync(copyrightFileName, {
          encoding: 'utf-8',
        });

        linuxPackagesLicenseTexts.push({
          text: data,
          module: linuxPackage,
        });
      } else {
        console.log(`"copyright" not found in "/usr/share/doc/${linuxPackage}"`);
      }
    }

    fs.writeFileSync('./linux_packages_licenses.txt', linuxPackagesLicenseTexts.map((licenseText) => {
      return `==========\n${licenseText.module}\n==========\n${licenseText.text}\n==========`;
    }).join('\n'));
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
