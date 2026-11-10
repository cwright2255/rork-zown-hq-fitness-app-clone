// The version line on Profile and in Settings (About, App Version) comes from app.json through the build, not from text typed into the
// screens: a launch-screen change that moves the app version (see launchScreenColour.test.js) would otherwise leave both saying v1.0.0.
const fs = require('fs');
const path = require('path');

const expoDir = path.join(__dirname, '..');
const appJson = JSON.parse(fs.readFileSync(path.join(expoDir, 'app.json'), 'utf8')).expo;

describe('appVersionLabel', () => {
  afterEach(() => { jest.resetModules(); jest.dontMock('expo-constants'); });

  const labelWith = (constants) => {
    jest.resetModules();
    jest.doMock('expo-constants', () => ({ __esModule: true, default: constants }));
    return require('../lib/appVersionLabel').appVersionLabel();
  };

  it('says the version the build has', () => {
    expect(labelWith({ expoConfig: { version: '1.0.1' } })).toBe('ZOWN HQ v1.0.1');
    expect(labelWith({ expoConfig: { version: '2.3.4' } })).toBe('ZOWN HQ v2.3.4');
  });

  it('says only the name, not a made-up number, when the build has no version to read', () => {
    expect(labelWith({ expoConfig: {} })).toBe('ZOWN HQ');
    expect(labelWith({ expoConfig: null })).toBe('ZOWN HQ');
    expect(labelWith({})).toBe('ZOWN HQ');
  });

  it('reads the number app.json has, under the real expo-constants setup of the tests', () => {
    jest.resetModules();
    const { appVersionLabel } = require('../lib/appVersionLabel');
    const label = appVersionLabel();
    // Either the config of the test setup is the app's, or it has no version: never a different number.
    expect([`ZOWN HQ v${appJson.version}`, 'ZOWN HQ']).toContain(label);
  });
});

describe('where the version is shown', () => {
  const read = (...parts) => fs.readFileSync(path.join(expoDir, ...parts), 'utf8');

  it('Profile and Settings use the label, and no screen types a version number into its text', () => {
    for (const file of [['app', 'profile.jsx'], ['app', 'profile', 'settings.jsx']]) {
      const source = read(...file);
      expect(source).toContain("from '@/lib/appVersionLabel'");
      expect(source).toContain('appVersionLabel()');
      expect(source).not.toMatch(/ZOWN HQ v\d/);
    }
  });
});
