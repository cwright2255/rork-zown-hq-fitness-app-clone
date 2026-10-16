// The app's Spotify token for the public catalogue (client credentials) now comes from the cloud function getSpotifyAppToken
// (functions/src/index.js). The app used to read EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET, which put the secret into the app
// whenever it was set when the app was built. Nothing here reads it any more.
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined), multiRemove: jest.fn(async () => undefined) },
}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn(), openAuthSessionAsync: jest.fn() }), { virtual: true });
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'zownhq://spotify-callback' }), { virtual: true });
jest.mock('../services/callProxy', () => ({ callProxy: jest.fn() }));

const SECRET = 'LEAKED-SECRET-VALUE-0123456789-abcdef';
let spotifyService;
let callProxy;

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-15T01:30:00Z'), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET = SECRET; // set, as if it had been put in the build environment
  global.fetch = jest.fn(async () => { throw new Error('the app must not call Spotify or a proxy by itself'); });
  jest.isolateModules(() => {
    callProxy = require('../services/callProxy').callProxy;
    ({ spotifyService } = require('../services/spotifyService'));
  });
  callProxy.mockReset();
  AsyncStorage.setItem.mockClear();
  spotifyService.token = null;
  spotifyService.tokenExpiresAt = null;
  spotifyService.isClientCredentialsFlow = false;
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET;
  delete global.fetch;
});

describe('the app token (client credentials)', () => {
  it('is asked of the cloud function, with no secret sent, and kept as the app token', async () => {
    callProxy.mockResolvedValue({ accessToken: 'tok-1', expiresIn: 3600 });
    expect(await spotifyService.initializeClientCredentials()).toBe(true);
    expect(callProxy).toHaveBeenCalledTimes(1);
    expect(callProxy).toHaveBeenCalledWith('getSpotifyAppToken', {});
    expect(spotifyService.token).toBe('tok-1');
    expect(spotifyService.isClientCredentialsFlow).toBe(true);
    expect(spotifyService.tokenExpiresAt).toBe(Date.now() + 3600 * 1000);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('spotify_access_token', 'tok-1');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('spotify_is_client_credentials', 'true');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('works with no secret anywhere in the app, and does not look at the one in the environment', async () => {
    delete process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET;
    callProxy.mockResolvedValue({ accessToken: 'tok-1', expiresIn: 60 });
    expect(await spotifyService.initializeClientCredentials()).toBe(true);
    expect(typeof spotifyService.getClientSecret).toBe('undefined');
  });

  it.each([
    ['signed out', Object.assign(new Error('Must be signed in'), { code: 'functions/unauthenticated' })],
    ['offline', new Error('network request failed')],
    ['not deployed', Object.assign(new Error('not found'), { code: 'functions/not-found' })],
  ])('says no, and keeps nothing, when the function fails (%s)', async (_label, error) => {
    callProxy.mockRejectedValue(error);
    await expect(spotifyService.initializeClientCredentials()).resolves.toBe(false);
    expect(spotifyService.token).toBeNull();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it.each([[null], [{}], [{ accessToken: '', expiresIn: 3600 }], [{ accessToken: 'a' }], [{ accessToken: 'a', expiresIn: 0 }], [{ accessToken: 7, expiresIn: 3600 }]])(
    'says no for an answer with no usable token: %j', async (answer) => {
      callProxy.mockResolvedValue(answer);
      await expect(spotifyService.initializeClientCredentials()).resolves.toBe(false);
      expect(spotifyService.token).toBeNull();
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

  it('asks again through ensureToken only once the token has run out', async () => {
    callProxy.mockResolvedValue({ accessToken: 'tok-1', expiresIn: 3600 });
    await spotifyService.initializeClientCredentials();
    callProxy.mockClear();
    expect(await spotifyService.ensureToken()).toBe(true);
    expect(callProxy).not.toHaveBeenCalled();
    jest.setSystemTime(Date.now() + 3601 * 1000);
    callProxy.mockResolvedValue({ accessToken: 'tok-2', expiresIn: 3600 });
    expect(await spotifyService.ensureToken()).toBe(true);
    expect(callProxy).toHaveBeenCalledTimes(1);
    expect(spotifyService.token).toBe('tok-2');
  });

  it('never shows the secret in the setup text, the status, or the logs', () => {
    const shown = JSON.stringify([spotifyService.getSetupInstructions(), spotifyService.getServiceStatus(), console.log.mock.calls]);
    expect(shown).not.toContain(SECRET);
    expect(spotifyService.getSetupInstructions()).toContain('firebase functions:secrets:set SPOTIFY_CLIENT_SECRET');
    expect(spotifyService.getSetupInstructions()).not.toContain('EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET');
    expect(spotifyService.getServiceStatus()).not.toHaveProperty('hasClientSecret');
  });
});
