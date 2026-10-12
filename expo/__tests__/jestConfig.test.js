const fs = require('fs');
const path = require('path');

const config = require('../jest.config.js');

describe('jest.config.js', () => {
  it('runs the shared test setup file after the test framework is installed', () => {
    expect(config.setupFilesAfterEnv).toEqual(['<rootDir>/jest.setup.js']);
    expect(fs.existsSync(path.join(__dirname, '..', 'jest.setup.js'))).toBe(true);
  });

  it('has no misspelled option that Jest would silently ignore', () => {
    expect(config).not.toHaveProperty('setupFilesAfterEach');
  });

  it('uses the shared setup file: Expo Constants is the standalone app the setup file describes', () => {
    expect(require('expo-constants').appOwnership).toBe('standalone');
  });
});
