module.exports = {
  preset: 'jest-expo',
  globalSetup: '<rootDir>/jest.global-setup.js',
  setupFilesAfterEach: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|firebase|@firebase))',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/functions/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testEnvironment: 'node',
};
