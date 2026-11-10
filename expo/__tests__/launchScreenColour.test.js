// The phone shows its own launch screen (part of the build, set in app.json, "splash") until the app has loaded; then app/index.jsx
// shows a blank screen for the moment the sign-in check takes; then the glitch splash (when signed out) or Home (when signed in)
// appears. If those are not all the same colour, a flash of the wrong one shows between them: this is what Cj saw when the
// launch screen was black with the Z mark on it and everything after it was white.
//
// The launch screen cannot be changed by an update, only by a new build, so a change to it also has to change the app version
// (the runtime version follows the app version: runtimeVersion { policy: "appVersion" }). Otherwise a phone running the old build
// would get the new blank screen by update and show black, then white, then Home.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const expoDir = path.join(__dirname, '..');
const appJson = JSON.parse(fs.readFileSync(path.join(expoDir, 'app.json'), 'utf8')).expo;
const indexSource = fs.readFileSync(path.join(expoDir, 'app', 'index.jsx'), 'utf8');
const glitchSource = fs.readFileSync(path.join(expoDir, 'components', 'ZownGlitchSplash.jsx'), 'utf8');
const Colors = require('../constants/colors').default || require('../constants/colors');

const launchBackground = (indexSource.match(/const LAUNCH_BACKGROUND = '(#[0-9A-Fa-f]{6})';/) || [])[1];

describe('the launch screen colour', () => {
  it('is white, set once for both phones (no separate iOS or Android launch screen overrides it)', () => {
    expect(appJson.splash.backgroundColor.toUpperCase()).toBe('#FFFFFF');
    expect(appJson.ios && appJson.ios.splash).toBeUndefined();
    expect(appJson.android && appJson.android.splash).toBeUndefined();
  });

  // Why there is an image at all: leaving it out makes this Expo version leave a layout rule for the missing picture in the
  // iPhone launch screen file (it only removes the picture), which risks a failed build. A picture that cannot be seen keeps
  // the file the shape the earlier builds compiled with.
  it('has a picture on it that cannot be seen: a PNG of which every pixel is fully transparent', () => {
    expect(appJson.splash.image).toBe('./assets/branding/zown-launch-blank.png');
    const png = fs.readFileSync(path.join(expoDir, appJson.splash.image));
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    // IHDR: 8 bits per channel, colour type 6 (red, green, blue, alpha), no interlacing.
    expect(png[24]).toBe(8);
    expect(png[25]).toBe(6);
    expect(png[28]).toBe(0);
    const idat = [];
    for (let offset = 8; offset < png.length;) {
      const length = png.readUInt32BE(offset);
      const type = png.subarray(offset + 4, offset + 8).toString('latin1');
      if (type === 'IDAT') idat.push(png.subarray(offset + 8, offset + 8 + length));
      offset += 12 + length;
    }
    const pixels = zlib.inflateSync(Buffer.concat(idat));
    // Every row is the "no filter" byte (0) then the pixels, so a picture of nothing is all zero bytes: alpha 0 everywhere.
    expect(pixels.length).toBeGreaterThan(0);
    expect(pixels.every((byte) => byte === 0)).toBe(true);
  });

  it('is the colour of the blank screen the app shows while it checks who is signed in', () => {
    expect(launchBackground).toBeDefined();
    expect(launchBackground.toUpperCase()).toBe(appJson.splash.backgroundColor.toUpperCase());
  });

  it('is the colour of what follows: the glitch splash and the screens behind it', () => {
    expect(glitchSource).toMatch(/overlay:\s*\{[^}]*backgroundColor:\s*'#FFFFFF'/);
    expect(Colors.background.toUpperCase()).toBe(appJson.splash.backgroundColor.toUpperCase());
    expect(appJson.userInterfaceStyle).toBe('light');
  });

  it('comes with a new app version, so that only a build with this launch screen receives the matching update', () => {
    expect(appJson.runtimeVersion).toEqual({ policy: 'appVersion' });
    // 1.0.0 is the version of the builds that have the black launch screen.
    expect(appJson.version).not.toBe('1.0.0');
    expect(appJson.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
