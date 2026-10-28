// The launch splash plays once each time the app is opened (lib/launchSplash.js).
const { hasLaunchSplashPlayed, markLaunchSplashPlayed, resetLaunchSplashForTests } = require('../lib/launchSplash');

beforeEach(() => resetLaunchSplashForTests());

describe('launch splash, once per opening of the app', () => {
  it('has not played when the app has just been opened', () => {
    expect(hasLaunchSplashPlayed()).toBe(false);
  });

  it('has played once it is marked, and stays played', () => {
    markLaunchSplashPlayed();
    expect(hasLaunchSplashPlayed()).toBe(true);
    markLaunchSplashPlayed();
    expect(hasLaunchSplashPlayed()).toBe(true);
  });

  it('asking does not use it up (only marking does)', () => {
    expect(hasLaunchSplashPlayed()).toBe(false);
    expect(hasLaunchSplashPlayed()).toBe(false);
  });

  it('can be reset, as opening the app again would', () => {
    markLaunchSplashPlayed();
    resetLaunchSplashForTests();
    expect(hasLaunchSplashPlayed()).toBe(false);
  });
});
