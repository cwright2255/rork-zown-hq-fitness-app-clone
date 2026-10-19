// What has to be true of the app's settings for analytics events to reach Firebase from a phone, beyond the code.
//
// The native module only works when: it is installed at the same version as the other @react-native-firebase packages, its
// iOS pod is linked statically with the rest (the app builds iOS pods as static frameworks), and the Firebase config the iPhone
// build is given has analytics switched on. A build made without any one of those sends nothing, and says nothing about it.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const pkg = JSON.parse(read('package.json'));
const app = JSON.parse(read('app.json')).expo;
const rnfb = Object.keys(pkg.dependencies).filter((name) => name.startsWith('@react-native-firebase/'));

describe('the native Firebase packages', () => {
  it('include analytics', () => {
    expect(rnfb).toEqual(expect.arrayContaining(['@react-native-firebase/app', '@react-native-firebase/crashlytics', '@react-native-firebase/analytics']));
  });

  it('are all asked for at the same version, which React Native Firebase needs', () => {
    expect(new Set(rnfb.map((name) => pkg.dependencies[name])).size).toBe(1);
  });

  it('are all locked at the same version in bun.lock, which is what the builds and CI install', () => {
    const lock = read('bun.lock');
    const locked = rnfb.map((name) => {
      const match = lock.match(new RegExp(`\\n    "${name}": \\["${name}@([0-9.]+)"`));
      return match ? match[1] : null;
    });
    expect(locked.every(Boolean)).toBe(true);
    expect(new Set(locked).size).toBe(1);
  });

  it('are in the workspace list of bun.lock too, as package.json has them, so a frozen install is accepted', () => {
    const lock = read('bun.lock');
    for (const name of rnfb) {
      expect(lock).toContain(`        "${name}": "${pkg.dependencies[name]}",`);
    }
  });
});

describe('the iOS build', () => {
  const properties = app.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-build-properties')[1];

  it('links every native Firebase package\'s pod statically, because the pods are built as static frameworks', () => {
    expect(properties.ios.useFrameworks).toBe('static');
    const pods = rnfb.map((name) => 'RNFB' + name.split('/')[1].split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(''));
    expect(pods).toEqual(expect.arrayContaining(['RNFBApp', 'RNFBCrashlytics', 'RNFBAnalytics']));
    expect(properties.ios.forceStaticLinking).toEqual(expect.arrayContaining(pods));
  });

  it('does not collect the advertising ID: the app does not advertise, and it never asks for tracking permission', () => {
    const plugin = app.plugins.find((p) => Array.isArray(p) && p[0] === '@react-native-firebase/analytics');
    expect(plugin).toBeDefined();
    expect(plugin[1]).toEqual({ ios: { withoutAdIdSupport: true } });
    expect(JSON.stringify(app.ios.infoPlist)).not.toContain('NSUserTrackingUsageDescription');
  });

  it('keeps the Firebase app plugin that sets up the pods the analytics one builds on', () => {
    expect(app.plugins.some((p) => (Array.isArray(p) ? p[0] : p) === '@react-native-firebase/app')).toBe(true);
  });
});

describe('the Firebase config', () => {
  const plist = read('GoogleService-Info.plist');

  it('for the iPhone has analytics on (if this fails: enable Google Analytics for the project in the Firebase console, then download GoogleService-Info.plist again)', () => {
    expect(plist).toMatch(/<key>IS_ANALYTICS_ENABLED<\/key>\s*<true\/>/);
  });

  it('for the iPhone is the config of this app', () => {
    expect(plist).toContain(`<string>${app.ios.bundleIdentifier}</string>`);
    expect(plist).toMatch(/<key>PROJECT_ID<\/key>\s*<string>zown-3c512<\/string>/);
  });

  it('for Android is for this app\'s package', () => {
    const config = JSON.parse(read('google-services.json'));
    const packages = config.client.map((c) => c.client_info.android_client_info.package_name);
    expect(packages).toContain(app.android.package);
    expect(config.project_info.project_id).toBe('zown-3c512');
  });
});
