// Connecting Spotify is an analytics event (spotify_connected), sent once from the Spotify store each time a connection really
// works: by an authorization code, or by the sign-in window (a code to swap, or the token itself). Never when it fails, is
// cancelled, or Spotify gives no profile (which the store treats as not connected).
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('@/services/spotifyService', () => ({
  spotifyService: {
    authenticate: jest.fn(),
    getCurrentUser: jest.fn(),
    clearToken: jest.fn(async () => undefined),
    getAuthorizationUrl: jest.fn(async () => 'https://accounts.spotify.test/authorize'),
    redirectUri: 'zownhq://spotify-callback',
    handleAuthorizationCodeCallback: jest.fn(),
    handleImplicitGrantCallback: jest.fn(),
  },
}));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }), { virtual: true });
jest.mock('@/src/services/analytics', () => ({ logSpotifyConnected: jest.fn() }));

import { useSpotifyStore } from '../store/spotifyStore';
import { spotifyService } from '@/services/spotifyService';
import { logSpotifyConnected } from '@/src/services/analytics';

const WebBrowser = require('expo-web-browser');

const profile = { id: 'sp1', display_name: 'Cj' };
let silence;

beforeEach(() => {
  jest.clearAllMocks();
  silence = [jest.spyOn(console, 'log'), jest.spyOn(console, 'error')].map((s) => s.mockImplementation(() => {}));
  // What a connection sets going afterwards is not what is being looked at here.
  useSpotifyStore.setState({
    isConnected: false,
    user: null,
    isLoading: false,
    loadUserData: jest.fn(),
    loadWorkoutPlaylists: jest.fn(),
    loadRunningPlaylists: jest.fn(),
    startQueueWatcher: jest.fn(),
  });
});
afterEach(() => silence.forEach((s) => s.mockRestore()));

describe('connecting with an authorization code', () => {
  it('logs it once when it works', async () => {
    spotifyService.authenticate.mockResolvedValue(true);
    spotifyService.getCurrentUser.mockResolvedValue(profile);
    await expect(useSpotifyStore.getState().connectSpotify('code-1')).resolves.toBe(true);
    expect(useSpotifyStore.getState().isConnected).toBe(true);
    expect(logSpotifyConnected).toHaveBeenCalledTimes(1);
  });

  it('logs nothing when Spotify refuses the code', async () => {
    spotifyService.authenticate.mockResolvedValue(false);
    await expect(useSpotifyStore.getState().connectSpotify('bad')).resolves.toBe(false);
    expect(logSpotifyConnected).not.toHaveBeenCalled();
  });

  it('logs nothing when Spotify gives no profile, because the store treats that as not connected', async () => {
    spotifyService.authenticate.mockResolvedValue(true);
    spotifyService.getCurrentUser.mockResolvedValue(null);
    await expect(useSpotifyStore.getState().connectSpotify('code-1')).resolves.toBe(false);
    expect(useSpotifyStore.getState().isConnected).toBe(false);
    expect(logSpotifyConnected).not.toHaveBeenCalled();
  });

  it('logs nothing when something throws', async () => {
    spotifyService.authenticate.mockRejectedValue(new Error('network'));
    await expect(useSpotifyStore.getState().connectSpotify('code-1')).resolves.toBe(false);
    expect(logSpotifyConnected).not.toHaveBeenCalled();
  });
});

describe('connecting through the sign-in window or a returned link', () => {
  it('logs it once when a returned link\'s token works', async () => {
    spotifyService.handleImplicitGrantCallback.mockResolvedValue(true);
    spotifyService.getCurrentUser.mockResolvedValue(profile);
    await expect(useSpotifyStore.getState().connectSpotifyImplicit('#access_token=abc')).resolves.toBe(true);
    expect(logSpotifyConnected).toHaveBeenCalledTimes(1);
  });

  it('logs nothing when that token does not work', async () => {
    spotifyService.handleImplicitGrantCallback.mockResolvedValue(false);
    await expect(useSpotifyStore.getState().connectSpotifyImplicit('#access_token=bad')).resolves.toBe(false);
    expect(logSpotifyConnected).not.toHaveBeenCalled();
  });

  it('logs nothing when the token works but there is no profile', async () => {
    spotifyService.handleImplicitGrantCallback.mockResolvedValue(true);
    spotifyService.getCurrentUser.mockResolvedValue(null);
    await expect(useSpotifyStore.getState().connectSpotifyImplicit('#access_token=abc')).resolves.toBe(false);
    expect(logSpotifyConnected).not.toHaveBeenCalled();
  });

  it('logs it once when the sign-in window returns a code that is swapped for a token', async () => {
    WebBrowser.openAuthSessionAsync.mockResolvedValue({ type: 'success', url: 'zownhq://spotify-callback?code=abc' });
    spotifyService.handleAuthorizationCodeCallback.mockResolvedValue(true);
    spotifyService.getCurrentUser.mockResolvedValue(profile);
    await expect(useSpotifyStore.getState().connectSpotifyImplicit()).resolves.toBe(true);
    expect(logSpotifyConnected).toHaveBeenCalledTimes(1);
  });

  it('logs nothing when that code cannot be swapped', async () => {
    WebBrowser.openAuthSessionAsync.mockResolvedValue({ type: 'success', url: 'zownhq://spotify-callback?code=abc' });
    spotifyService.handleAuthorizationCodeCallback.mockResolvedValue(false);
    await expect(useSpotifyStore.getState().connectSpotifyImplicit()).resolves.toBe(false);
    expect(logSpotifyConnected).not.toHaveBeenCalled();
  });

  it('logs nothing when the code works but there is no profile', async () => {
    WebBrowser.openAuthSessionAsync.mockResolvedValue({ type: 'success', url: 'zownhq://spotify-callback?code=abc' });
    spotifyService.handleAuthorizationCodeCallback.mockResolvedValue(true);
    spotifyService.getCurrentUser.mockResolvedValue(null);
    await expect(useSpotifyStore.getState().connectSpotifyImplicit()).resolves.toBe(false);
    expect(logSpotifyConnected).not.toHaveBeenCalled();
  });

  it('logs it once when the sign-in window returns the token itself', async () => {
    WebBrowser.openAuthSessionAsync.mockResolvedValue({ type: 'success', url: 'zownhq://spotify-callback#access_token=abc&token_type=Bearer' });
    spotifyService.handleImplicitGrantCallback.mockResolvedValue(true);
    spotifyService.getCurrentUser.mockResolvedValue(profile);
    await expect(useSpotifyStore.getState().connectSpotifyImplicit()).resolves.toBe(true);
    expect(logSpotifyConnected).toHaveBeenCalledTimes(1);
  });

  it('logs nothing when the person closes the sign-in window', async () => {
    WebBrowser.openAuthSessionAsync.mockResolvedValue({ type: 'cancel' });
    await expect(useSpotifyStore.getState().connectSpotifyImplicit()).resolves.toBe(false);
    expect(logSpotifyConnected).not.toHaveBeenCalled();
  });

  it('logs nothing when something throws', async () => {
    WebBrowser.openAuthSessionAsync.mockRejectedValue(new Error('no browser'));
    await expect(useSpotifyStore.getState().connectSpotifyImplicit()).resolves.toBe(false);
    expect(logSpotifyConnected).not.toHaveBeenCalled();
  });
});
