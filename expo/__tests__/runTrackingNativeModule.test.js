// Recording a run with the phone locked needs the native module expo-task-manager in the app. services/runTracking.js loads it inside a
// try/catch and, if it is missing, quietly falls back to watching the position only while the app is open, and __tests__/runTracking.test.js
// fakes the package, so nothing else fails when it is left out. This does.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const pkg = JSON.parse(read('package.json'));
const app = JSON.parse(read('app.json')).expo;

describe('background run tracking has what it needs', () => {
  it('lists expo-task-manager, at the version this Expo SDK expects', () => {
    const bundled = require('expo/bundledNativeModules.json');
    expect(pkg.dependencies['expo-task-manager']).toBeTruthy();
    expect(pkg.dependencies['expo-task-manager']).toBe(bundled['expo-task-manager']);
  });

  it('has expo-task-manager in bun.lock, which is what the builds install from', () => {
    expect(read('bun.lock')).toMatch(/"expo-task-manager": \["expo-task-manager@\d/);
  });

  it('is the package services/runTracking.js asks for', () => {
    expect(read('services/runTracking.js')).toContain("require('expo-task-manager')");
  });

  it('asks iOS for the location background mode the task runs under', () => {
    const plugin = app.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-location');
    expect(plugin[1].isIosBackgroundLocationEnabled).toBe(true);
  });
});

describe('the native settings in app.json', () => {
  it('keeps HealthKit, without background delivery, which nothing in the app uses', () => {
    const entitlements = app.ios.entitlements;
    expect(entitlements['com.apple.developer.healthkit']).toBe(true);
    // (not toHaveProperty: it would read the dots in the key as a path)
    expect(Object.keys(entitlements)).not.toContain('com.apple.developer.healthkit.background-delivery');
    const healthkit = app.plugins.find((p) => Array.isArray(p) && p[0] === '@kingstinct/react-native-healthkit');
    expect(healthkit[1].background).toBe(false);
  });

  it('carries no leftover channel diagnostic', () => {
    expect(app.extra).not.toHaveProperty('last_channel_diagnostic');
  });
});

describe('packages and scripts that cannot work', () => {
  it('does not install expo-device, which nothing imports', () => {
    expect(pkg.dependencies).not.toHaveProperty('expo-device');
  });

  it('has no typecheck script, because the app has no TypeScript to check', () => {
    expect(pkg.scripts).not.toHaveProperty('typecheck');
    expect(fs.existsSync(path.join(root, 'tsconfig.json'))).toBe(false);
  });
});
