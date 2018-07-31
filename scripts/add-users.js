const log = require('../modules/log');
const users = require('../modules/users');
const accounting = require('../modules/accounting');

const TEST_CREDITS = 2000;
const demoUsers = [
  {email: 'antonio@freefall.org', password: 'onetosix'},
  {email: 'hristo@freefall.org', password: 'onetosix'},
];

async function main () {
  for (const credentials of demoUsers) {
    const { email } = credentials;
    const password = users.hashPassword(credentials.password);
    const user = await users.addUser({ email, password, role: 'customer' });
    await accounting.depositCredits(user.id, TEST_CREDITS);
  }
}

main()
  .then(result => log.info('Inserted users: ', demoUsers))
  .catch(reason => {
    log.critical('Script failed due to error - ', reason);
  });
