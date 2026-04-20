import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

const CLIENT_ID =
process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? 'cb884c0e045d4683bd3f0b38cb0e151e';

const SCOPES = [
'user-read-playback-state',
'user-modify-playback-state',
'user-read-currently-playing',
'playlist-read-private',
'playlist-read-collaborative',
'streaming',
'user-read-email',
'user-read-private'];


const DISCOVERY = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token'
};

const TOKEN_KEY = 'spotify_tokens_v1';

const IS_EXPO_GO = Constants.appOwnership === 'expo';

function getRedirectUri() {
  if (IS_EXPO_GO) {
    return AuthSession.makeRedirectUri({ useProxy: true });
  }
  return AuthSession.makeRedirectUri({ scheme: 'zownhq', path: 'spotify-callback' });
}

async function saveTokens(tokens) {
  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens));
}

async function loadTokens() {
  try {
    const raw = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function refreshAccessToken(refreshToken) {
  const fn = httpsCallable(


    functions, 'refreshSpotifyToken');
  const res = await fn({ refreshToken });
  const tokens = {
    accessToken: res.data.accessToken,
    refreshToken: res.data.refreshToken ?? refreshToken,
    expiresAt: Date.now() + res.data.expiresIn * 1000
  };
  await saveTokens(tokens);
  return tokens;
}

async function getValidAccessToken() {
  const tokens = await loadTokens();
  if (!tokens) return null;
  if (tokens.expiresAt > Date.now() + 30_000) return tokens.accessToken;
  if (!tokens.refreshToken) return null;
  const fresh = await refreshAccessToken(tokens.refreshToken);
  return fresh.accessToken;
}

export async function authenticate() {
  const redirectUri = getRedirectUri();
  const request = new AuthSession.AuthRequest({
    clientId,
    scopes,
    usePKCE: true,
    redirectUri,
    responseType: AuthSession.ResponseType.Code
  });
  await request.makeAuthUrlAsync(DISCOVERY);
  const result = await request.promptAsync(DISCOVERY, IS_EXPO_GO ? { useProxy: true } : undefined);

  if (result.type !== 'success' || !result.params.code) {
    return null;
  }

  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code: result.params.code,
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier ?? '' }
    },
    DISCOVERY
  );

  const tokens = {
    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken,
    expiresAt: Date.now() + (tokenResult.expiresIn ?? 3600) * 1000
  };
  await saveTokens(tokens);
  return tokens;
}

async function spotifyFetch(token, path) {
  const validToken = token || (await getValidAccessToken());
  if (!validToken) throw new Error('No Spotify access token');
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${validToken}` }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Spotify API ${res.status}: ${body}`);
  }
  return await res.json();
}










export async function searchTracks(
accessToken,
query)
{
  const data = await spotifyFetch(
    accessToken,
    `/search?type=track&limit=20&q=${encodeURIComponent(query)}`
  );
  return data.tracks.items;
}

export async function getUserPlaylists(
accessToken)
{
  const data = await spotifyFetch(







    accessToken, '/me/playlists?limit=50');

  return data.items.map((p) => ({
    id: p.id,
    spotifyId: p.id,
    name: p.name,
    description: p.description,
    trackCount: p.tracks.total,
    imageUrl: p.images[0]?.url,
    savedAt: new Date()
  }));
}

export async function getPlaylistTracks(
accessToken,
playlistId)
{
  const data = await spotifyFetch(

    accessToken, `/playlists/${playlistId}/tracks?limit=100`);
  return data.items.map((i) => i.track).filter(Boolean);
}

export async function getAccessToken() {
  return getValidAccessToken();
}