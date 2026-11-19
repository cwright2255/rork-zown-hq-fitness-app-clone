// Pause, play, next, previous and switching device are commands: Spotify's answer to them is the status. A 2xx means the
// command was done. A pause that Spotify accepted but answered with a body that is not JSON used to be shown as
// "Playback Failed - Spotify returned an unexpected response". Reading data, and creating a playlist (its id is needed),
// still fail on a body that cannot be read.
//
// Spotify also answers a command it will not carry out in the player's current state with 403 "Player command failed:
// Restriction violated". That is not the allowed users list problem the app used to say every 403 was. A pause refused
// that way is treated as done (the store reads the real state back right after); any other command says what happened.
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined), multiRemove: jest.fn(async () => undefined) },
}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn(), openAuthSessionAsync: jest.fn() }), { virtual: true });
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'zownhq://spotify-callback' }), { virtual: true });
jest.mock('../services/callProxy', () => ({ callProxy: jest.fn() }));

let spotifyService;

const answer = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  text: async () => body,
  json: async () => JSON.parse(body),
});

beforeEach(() => {
  // The service starts a 300 ms timer when it is created (its app-token start-up); it is not what is looked at here.
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.isolateModules(() => {
    ({ spotifyService } = require('../services/spotifyService'));
  });
  AsyncStorage.setItem.mockClear();
  spotifyService.token = 'user-token';
  spotifyService.tokenExpiresAt = null;
  spotifyService.isClientCredentialsFlow = false;
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete global.fetch;
});

describe('a player command that Spotify accepted', () => {
  it.each([
    ['PUT', 'me/player/pause'],
    ['PUT', 'me/player/play?device_id=abc'],
    ['PUT', 'me/player'],
    ['POST', 'me/player/next'],
    ['POST', 'me/player/previous'],
  ])('%s %s is done when Spotify answers 200 with text that is not JSON', async (method, endpoint) => {
    global.fetch = jest.fn(async () => answer(200, 'OK'));
    await expect(spotifyService.fetchWebApi(endpoint, method)).resolves.toBeNull();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('is done when Spotify answers 204 with nothing, as before', async () => {
    global.fetch = jest.fn(async () => answer(204, ''));
    await expect(spotifyService.fetchWebApi('me/player/pause', 'PUT')).resolves.toBeNull();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('pause() resolves instead of reporting a failed pause', async () => {
    global.fetch = jest.fn(async () => answer(200, '<html>ok</html>'));
    await expect(spotifyService.pause()).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toMatch(/\/me\/player\/pause$/);
    expect(global.fetch.mock.calls[0][1].method).toBe('PUT');
  });

  it('still fails when Spotify refuses it', async () => {
    global.fetch = jest.fn(async () => answer(404, JSON.stringify({ error: { status: 404, message: 'No active device', reason: 'NO_ACTIVE_DEVICE' } })));
    await expect(spotifyService.fetchWebApi('me/player/pause', 'PUT')).rejects.toMatchObject({ status: 404, reason: 'NO_ACTIVE_DEVICE' });
  });
});

describe('everything else is unchanged', () => {
  it('reading data from a body that is not JSON still fails', async () => {
    global.fetch = jest.fn(async () => answer(200, 'OK'));
    await expect(spotifyService.fetchWebApi('me/player')).rejects.toThrow('Spotify returned an unexpected response');
    await expect(spotifyService.fetchWebApi('me')).rejects.toThrow('Spotify returned an unexpected response');
  });

  it('creating a playlist from a body that is not JSON still fails (its id is needed)', async () => {
    global.fetch = jest.fn(async () => answer(201, 'Created'));
    await expect(spotifyService.fetchWebApi('me/playlists', 'POST', { name: 'x' })).rejects.toThrow('Spotify returned an unexpected response');
  });

  it('a JSON body is parsed for a command too', async () => {
    global.fetch = jest.fn(async () => answer(200, '{"ok":true}'));
    await expect(spotifyService.fetchWebApi('me/player/next', 'POST')).resolves.toEqual({ ok: true });
  });
});

describe('Spotify refusing a command with "Restriction violated"', () => {
  const restriction = () => answer(403, JSON.stringify({ error: { status: 403, message: 'Player command failed: Restriction violated', reason: 'UNKNOWN' } }));

  it('is not reported as the allowed users list problem', async () => {
    global.fetch = jest.fn(async () => restriction());
    const error = await spotifyService.fetchWebApi('me/player/pause', 'PUT').catch((e) => e);
    expect(error).toMatchObject({ status: 403, reason: 'UNKNOWN', restricted: true });
    expect(error.message).not.toMatch(/allowed users|Development Mode/);
  });

  it('pause() treats it as done and does not throw', async () => {
    global.fetch = jest.fn(async () => restriction());
    await expect(spotifyService.pause()).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('play still fails, with a message that says what happened', async () => {
    global.fetch = jest.fn(async () => restriction());
    await expect(spotifyService.fetchWebApi('me/player/play', 'PUT')).rejects.toThrow("Spotify can't do that right now");
  });

  it('pause() still fails when there is no active device', async () => {
    global.fetch = jest.fn(async () => answer(404, JSON.stringify({ error: { status: 404, message: 'Player command failed: No active device found', reason: 'NO_ACTIVE_DEVICE' } })));
    await expect(spotifyService.pause()).rejects.toMatchObject({ status: 404, reason: 'NO_ACTIVE_DEVICE' });
  });

  it('the other 403s keep their own messages', async () => {
    global.fetch = jest.fn(async () => answer(403, JSON.stringify({ error: { status: 403, message: 'Player command failed: Premium required', reason: 'PREMIUM_REQUIRED' } })));
    await expect(spotifyService.pause()).rejects.toThrow('Spotify Premium is required');
    global.fetch = jest.fn(async () => answer(403, JSON.stringify({ error: { status: 403, message: 'User not registered in the Developer Dashboard' } })));
    await expect(spotifyService.pause()).rejects.toThrow(/allowed users list.*\[Spotify says: User not registered in the Developer Dashboard\]/);
  });
});
