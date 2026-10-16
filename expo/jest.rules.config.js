// jest settings for the Firestore rules tests only (npm run test:rules). They talk to the Firestore emulator from plain
// node, so none of the app's own set-up (jest-expo, the stand-ins for Firebase and the phone) is loaded, and they run one
// file at a time because they share one emulator. The normal `npm test` leaves this folder alone (see jest.config.js).
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  roots: ['<rootDir>/rules-tests'],
  testMatch: ['<rootDir>/rules-tests/**/*.test.js'],
  transform: {},
  maxWorkers: 1,
  // The first request to a freshly started emulator can take a few seconds.
  testTimeout: 30000,
};
