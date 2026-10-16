module.exports = {
  preset: 'jest-expo',
  globalSetup: '<rootDir>/jest.global-setup.js',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|firebase|@firebase))',
  ],
  // rules-tests/ needs the Firestore emulator and has its own settings: npm run test:rules (jest.rules.config.js).
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/functions/', '/rules-tests/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testEnvironment: 'node',
  // The first test in a screen's file pays for loading React Native; on a slower machine that can pass 5 seconds.
  testTimeout: 30000,
};
