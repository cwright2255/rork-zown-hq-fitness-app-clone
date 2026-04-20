import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import type { SpotifyPlaylist } from '../types/firestore';

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
  'user-read-private',
];

const DISCOVERY = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

const TOKEN_KEY = 'spotify_tokens_v1';

const IS_EXPO_GO = Constants.appOwnership === 'expo';

function getRedirectUri(): string {
  if (IS_EXPO_GO) {
    return AuthSession.makeRedirectUri({ useProxy: true } as never);
  }
  return AuthSession.makeRedirectUri({ scheme: 'zownhq', path: 'spotify-callback' });
}

export interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

async function saveTokens(tokens: StoredTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens));
}

async function loadTokens(): Promise<StoredTokens | null> {
  try {
    const raw = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function refreshAccessToken(refreshToken: string): Promise<StoredTokens> {
  const fn = httpsCallable<
    { refreshToken: string },
    { accessToken: string; expiresIn: number; refreshToken?: string }
  >(functions, 'refreshSpotifyToken');
  const res = await fn({ refreshToken });
  const tokens: StoredTokens = {
    accessToken: res.data.accessToken,
    refreshToken: res.data.refreshToken ?? refreshToken,
    expiresAt: Date.now() + res.data.expiresIn * 1000,
  };
  await saveTokens(tokens);
  return tokens;
}

async function getValidAccessToken(): Promise<string | null> {
  const tokens = await loadTokens();
  if (!tokens) return null;
  if (tokens.expiresAt > Date.now() + 30_000) return tokens.accessToken;
  if (!tokens.refreshToken) return null;
  const fresh = await refreshAccessToken(tokens.refreshToken);
  return fresh.accessToken;
}

export async function authenticate(): Promise<StoredTokens | null> {
  const redirectUri = getRedirectUri();
  const request = new AuthSession.AuthRequest({
    clientId: CLIENT_ID,
    scopes: SCOPES,
    usePKCE: true,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
  });
  await request.makeAuthUrlAsync(DISCOVERY);
  const result = await request.promptAsync(DISCOVERY, IS_EXPO_GO ? ({ useProxy: true } as never) : undefined);

  if (result.type !== 'success' || !result.params.code) {
    return null;
  }

  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId: CLIENT_ID,
      code: result.params.code,
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier ?? '' },
    },
    DISCOVERY,
  );

  const tokens: StoredTokens = {
    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken,
    expiresAt: Date.now() + (tokenResult.expiresIn ?? 3600) * 1000,
  };
  await saveTokens(tokens);
  return tokens;
}

async function spotifyFetch<T>(token: string, path: string): Promise<T> {
  const validToken = token || (await getValidAccessToken());
  if (!validToken) throw new Error('No Spotify access token');
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${validToken}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Spotify API ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  duration_ms: number;
  uri: string;
}

export async function searchTracks(
  accessToken: string,
  query: string,
): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch<{ tracks: { items: SpotifyTrack[] } }>(
    accessToken,
    `/search?type=track&limit=20&q=${encodeURIComponent(query)}`,
  );
  return data.tracks.items;
}

export async function getUserPlaylists(
  accessToken: string,
): Promise<SpotifyPlaylist[]> {
  const data = await spotifyFetch<{
    items: Array<{
      id: string;
      name: string;
      description?: string;
      tracks: { total: number };
      images: { url: string }[];
    }>;
  }>(accessToken, '/me/playlists?limit=50');

  return data.items.map((p) => ({
    id: p.id,
    spotifyId: p.id,
    name: p.name,
    description: p.description,
    trackCount: p.tracks.total,
    imageUrl: p.images[0]?.url,
    savedAt: new Date(),
  }));
}

export async function getPlaylistTracks(
  accessToken: string,
  playlistId: string,
): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch<{
    items: Array<{ track: SpotifyTrack }>;
  }>(accessToken, `/playlists/${playlistId}/tracks?limit=100`);
  return data.items.map((i) => i.track).filter(Boolean);
}

export async function getAccessToken(): Promise<string | null> {
  return getValidAccessToken();
}
