// Disconnects ZOWN HQ from a person's Apple ID when they delete their account.
//
// Apple requires an app that offers Sign in with Apple to revoke the person's Apple token when the account is deleted
// (App Review guideline 5.1.1(v)). Until it is revoked, ZOWN HQ stays in the list of apps under Settings > Apple ID >
// Sign in with Apple, and Apple still treats the person as signed up.
//
// How it works. Apple only revokes a token it can identify, and the app never holds one: Firebase signs the person in
// from Apple's identity token and keeps no Apple token. So the app asks Apple for a fresh one-time authorization code
// right before the delete (the person confirms with Apple), and sends it here. This file then:
//   1. signs a short-lived client secret with the Sign in with Apple key (ES256, the team's .p8 key),
//   2. trades the code for a refresh token at https://appleid.apple.com/auth/token,
//   3. checks the token is for the Apple account linked to the Firebase account,
//   4. revokes it at https://appleid.apple.com/auth/revoke.
// For a code made by the iOS app itself, Apple's client_id is the app's bundle id (not a Services ID).
//
// Nothing is stored. The code, the tokens and the key are never logged. The key and its id are Firebase secrets
// (APPLE_PRIVATE_KEY, APPLE_KEY_ID), set once with `firebase functions:secrets:set` (docs/SOCIAL_SIGN_IN.md).

import { createPrivateKey, sign } from 'node:crypto';

export const APPLE_TEAM_ID = 'GLFKG8342N';
export const APPLE_CLIENT_ID = 'com.zownhq.app';
export const APPLE_ISSUER = 'https://appleid.apple.com';
export const APPLE_TOKEN_URL = `${APPLE_ISSUER}/auth/token`;
export const APPLE_REVOKE_URL = `${APPLE_ISSUER}/auth/revoke`;

// Apple accepts a client secret for up to 6 months. This one is used for two requests, a moment apart.
const SECRET_LIFETIME_SECONDS = 5 * 60;

/**
 * code: 'not-configured'  the key, its id or the ids are missing or wrong: nothing the person can fix
 *       'invalid-code'    Apple did not accept the one-time code (used, expired or not ours): ask for a new one
 *       'wrong-account'   the code is for a different Apple ID than the one linked to this account
 *       'unavailable'     Apple could not be reached, or answered with an error on its side: try again later
 *       'failed'          anything else
 */
export class AppleRevokeError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'AppleRevokeError';
    this.code = code;
  }
}

const base64url = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');

/**
 * The client secret Apple asks for: a JWT signed (ES256) with the Sign in with Apple key.
 * @param {{keyId: string, privateKey: string, teamId?: string, clientId?: string, now?: () => number}} p
 */
export function appleClientSecret({ keyId, privateKey, teamId = APPLE_TEAM_ID, clientId = APPLE_CLIENT_ID, now = Date.now }) {
  if (!keyId || !String(keyId).trim() || !privateKey || !String(privateKey).trim()) {
    throw new AppleRevokeError('not-configured', 'The Sign in with Apple key is not set.');
  }
  // A key pasted into a one-line field often arrives with "\n" written out instead of real line breaks.
  const pem = String(privateKey).trim().replace(/\\n/g, '\n');
  const issuedAt = Math.floor(now() / 1000);
  const signingInput = `${base64url({ alg: 'ES256', kid: String(keyId).trim() })}.${base64url({
    iss: teamId,
    iat: issuedAt,
    exp: issuedAt + SECRET_LIFETIME_SECONDS,
    aud: APPLE_ISSUER,
    sub: clientId,
  })}`;
  try {
    // ieee-p1363 is the raw r||s signature a JWT wants (Node's default is the DER form).
    const signature = sign('sha256', Buffer.from(signingInput), { key: createPrivateKey(pem), dsaEncoding: 'ieee-p1363' });
    return `${signingInput}.${signature.toString('base64url')}`;
  } catch (e) {
    throw new AppleRevokeError('not-configured', 'The Sign in with Apple key could not be read.');
  }
}

// Who an Apple ID token is for (its "sub"), read straight from the token Apple just sent over TLS.
export function appleIdTokenSubject(idToken) {
  try {
    const payload = JSON.parse(Buffer.from(String(idToken).split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch (e) {
    return null;
  }
}

async function postForm(fetchImpl, url, fields) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams(fields).toString(),
    });
  } catch (e) {
    throw new AppleRevokeError('unavailable', 'Apple could not be reached.');
  }
  if (response.status >= 500) throw new AppleRevokeError('unavailable', `Apple answered ${response.status}.`);
  let body = null;
  try { body = await response.json(); } catch (e) { body = null; }
  if (!response.ok) {
    const reason = body && typeof body.error === 'string' ? body.error : '';
    if (reason === 'invalid_grant') throw new AppleRevokeError('invalid-code', 'Apple did not accept the code.');
    if (reason === 'invalid_client' || reason === 'unauthorized_client') {
      throw new AppleRevokeError('not-configured', 'Apple did not accept the Sign in with Apple key or ids.');
    }
    throw new AppleRevokeError('failed', `Apple refused (${reason || response.status}).`);
  }
  return body;
}

/**
 * Revokes the Sign in with Apple grant behind a one-time authorization code.
 * @param {object} p
 * @param {string} p.authorizationCode   from the app (AppleAuthentication.refreshAsync / signInAsync)
 * @param {string} [p.expectedUserId]    the Apple user id linked to the Firebase account; the code must be for it
 * @param {string} p.keyId
 * @param {string} p.privateKey          the .p8 file's text
 * @param {Function} [p.fetchImpl]
 * @param {() => number} [p.now]
 * @returns {Promise<{revoked: true}>}   rejects with an AppleRevokeError
 */
export async function revokeAppleGrant({ authorizationCode, expectedUserId, keyId, privateKey, fetchImpl = fetch, now = Date.now }) {
  const code = typeof authorizationCode === 'string' ? authorizationCode.trim() : '';
  if (!code) throw new AppleRevokeError('invalid-code', 'There is no authorization code.');

  const clientSecret = appleClientSecret({ keyId, privateKey, now });

  const tokens = await postForm(fetchImpl, APPLE_TOKEN_URL, {
    client_id: APPLE_CLIENT_ID,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
  });
  const refreshToken = tokens && typeof tokens.refresh_token === 'string' ? tokens.refresh_token : '';
  if (!refreshToken) throw new AppleRevokeError('failed', 'Apple sent back no token to revoke.');

  if (expectedUserId && appleIdTokenSubject(tokens.id_token) !== expectedUserId) {
    throw new AppleRevokeError('wrong-account', 'The code is for a different Apple ID.');
  }

  await postForm(fetchImpl, APPLE_REVOKE_URL, {
    client_id: APPLE_CLIENT_ID,
    client_secret: clientSecret,
    token: refreshToken,
    token_type_hint: 'refresh_token',
  });
  return { revoked: true };
}
