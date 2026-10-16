// functions/src/spotifyAppToken.js
//
// Spotify's "client credentials" token: the app's own pass for the public catalogue (search, featured playlists,
// recommendations), not tied to any listener. Spotify wants the app's client id AND client secret to hand one out, so the
// phone cannot ask for it itself without carrying the secret. The callable getSpotifyAppToken (index.js) asks here
// instead, and the phone only ever receives the short-lived token.
//
// A token lasts an hour. One is kept in memory and handed out again until a minute before it runs out, so a busy minute
// does not turn into a busy minute at Spotify. It is the same pass for everyone, so sharing it between callers loses nothing.

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const EARLY_MS = 60 * 1000; // stop reusing a token this long before it expires

let kept = null; // { accessToken, expiresAtMs }

/** Forget the token that is kept. For tests. */
export function forgetSpotifyAppToken() {
  kept = null;
}

/**
 * { accessToken, expiresIn } for the app. `expiresIn` is the seconds left on the token.
 * Throws an Error (with `.status` when Spotify answered) whose message never contains the secret or Spotify's reply.
 */
export async function getSpotifyAppToken({ clientId, clientSecret, fetchFn = (...args) => fetch(...args), now = Date.now }) {
  const at = now();
  if (kept && kept.expiresAtMs - EARLY_MS > at) {
    return { accessToken: kept.accessToken, expiresIn: Math.floor((kept.expiresAtMs - at) / 1000) };
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetchFn(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
  });
  if (!res.ok) {
    const error = new Error(`Spotify refused the app token request (${res.status})`);
    error.status = res.status;
    throw error;
  }
  const data = await res.json().catch(() => null);
  const seconds = Number(data?.expires_in);
  if (typeof data?.access_token !== 'string' || data.access_token === '' || !Number.isFinite(seconds) || seconds <= 0) {
    throw new Error('Spotify sent no usable app token');
  }
  kept = { accessToken: data.access_token, expiresAtMs: at + seconds * 1000 };
  return { accessToken: data.access_token, expiresIn: Math.floor(seconds) };
}
