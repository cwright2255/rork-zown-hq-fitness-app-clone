// services/socialAuth.js
//
// Signing in with Apple, Google or Meta, through Firebase Authentication.
//
//   Apple   the phone's own Sign in with Apple sheet (expo-apple-authentication). Apple's token is tied to a
//           one-time nonce: Apple is given its SHA-256, Firebase is given the nonce itself, and Firebase checks
//           that the two match.
//   Google  the system's sign-in page (ASWebAuthenticationSession, through expo-auth-session), with PKCE and
//           the iOS OAuth client from the Firebase project. The code it sends back is exchanged for an ID token.
//   Meta    the same, with the Meta (Facebook Login) app, which sends back an access token.
//
// Each ends the same way: the provider's token is turned into a Firebase credential and Firebase signs the
// person in (creating the account the first time). Nothing here keeps a provider token; only Firebase's session.
//
// The two ids Google and Meta need are public identifiers, set as EAS variables (docs/SOCIAL_SIGN_IN.md):
//   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID   the iOS OAuth client id of the Firebase project
//   EXPO_PUBLIC_FACEBOOK_APP_ID        the Meta app id
// Until one is set, tapping that button says it is not set up yet and nothing else happens.

export const PROVIDERS = ['apple', 'google', 'meta'];
export const PROVIDER_NAMES = { apple: 'Apple', google: 'Google', meta: 'Meta' };

// Google's iOS clients take the app's bundle id as the redirect scheme (the same one expo-auth-session's own
// Google provider uses). The system's sign-in sheet catches it, so it needs no entry in the app's URL types.
export const GOOGLE_REDIRECT_URI = 'com.zownhq.app:/oauthredirect';
export const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};
export const META_DISCOVERY = {
  authorizationEndpoint: 'https://www.facebook.com/dialog/oauth',
  tokenEndpoint: 'https://graph.facebook.com/oauth/access_token',
};

/**
 * What went wrong, with a message that can be shown to the person as it is.
 * `code`: 'cancelled' (they closed the sheet: nothing to show), 'not-configured', 'unavailable',
 * 'account-exists', 'network' or 'failed'.
 */
export class SocialAuthError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'SocialAuthError';
    this.code = code;
  }
}

const cancelled = () => new SocialAuthError('cancelled', 'Sign-in was cancelled.');

export function socialAuthConfig() {
  return {
    googleIosClientId: (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '').trim(),
    facebookAppId: (process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || '').trim(),
  };
}

/** Whether the provider has what it needs to start (Apple needs nothing here). */
export function isProviderConfigured(provider) {
  const { googleIosClientId, facebookAppId } = socialAuthConfig();
  if (provider === 'apple') return true;
  if (provider === 'google') return googleIosClientId !== '';
  if (provider === 'meta') return facebookAppId !== '';
  return false;
}

// What a sign-in sheet or page said, as an error to show. The person closing it is not an error.
function sessionFailure(result, name) {
  if (result.type === 'cancel' || result.type === 'dismiss') return cancelled();
  if (result.type === 'locked') return new SocialAuthError('failed', 'Another sign-in is already open. Finish or close it and try again.');
  const detail = result.error && result.error.message ? ` (${result.error.message})` : '';
  return new SocialAuthError('failed', `${name} sign-in did not finish. Please try again.${detail}`);
}

async function appleCredential() {
  const AppleAuthentication = require('expo-apple-authentication');
  const Crypto = require('expo-crypto');
  const { OAuthProvider } = require('firebase/auth');

  let available = false;
  try { available = await AppleAuthentication.isAvailableAsync(); } catch (e) { available = false; }
  if (!available) throw new SocialAuthError('unavailable', 'Sign in with Apple is not available on this phone.');

  const rawNonce = `${Crypto.randomUUID()}${Crypto.randomUUID()}`.replace(/-/g, '');
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  let apple;
  try {
    apple = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    if (e && (e.code === 'ERR_REQUEST_CANCELED' || e.code === 'ERR_CANCELED')) throw cancelled();
    throw e;
  }
  if (!apple || !apple.identityToken) {
    throw new SocialAuthError('failed', 'Apple did not send back a sign-in token. Please try again.');
  }
  // Apple gives the name only the first time an account signs in with it, so it is taken now.
  const name = [apple.fullName && apple.fullName.givenName, apple.fullName && apple.fullName.familyName].filter(Boolean).join(' ');
  const credential = new OAuthProvider('apple.com').credential({ idToken: apple.identityToken, rawNonce });
  return { credential, name };
}

async function googleCredential() {
  const { googleIosClientId } = socialAuthConfig();
  if (!googleIosClientId) throw new SocialAuthError('not-configured', "Google sign-in isn't set up yet.");
  const AuthSession = require('expo-auth-session');
  const { GoogleAuthProvider } = require('firebase/auth');

  const request = new AuthSession.AuthRequest({
    clientId: googleIosClientId,
    redirectUri: GOOGLE_REDIRECT_URI,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    prompt: AuthSession.Prompt.SelectAccount,
  });
  const result = await request.promptAsync(GOOGLE_DISCOVERY);
  if (!result || result.type !== 'success') throw sessionFailure(result || { type: 'error' }, 'Google');
  const code = result.params && result.params.code;
  if (!code) throw new SocialAuthError('failed', 'Google did not send back a sign-in code. Please try again.');

  const tokens = await AuthSession.exchangeCodeAsync({
    clientId: googleIosClientId,
    code,
    redirectUri: GOOGLE_REDIRECT_URI,
    extraParams: { code_verifier: request.codeVerifier || '' },
  }, GOOGLE_DISCOVERY);
  if (!tokens || !tokens.idToken) throw new SocialAuthError('failed', 'Google did not send back a sign-in token. Please try again.');
  return { credential: GoogleAuthProvider.credential(tokens.idToken, tokens.accessToken || undefined), name: '' };
}

async function metaCredential() {
  const { facebookAppId } = socialAuthConfig();
  if (!facebookAppId) throw new SocialAuthError('not-configured', "Meta sign-in isn't set up yet.");
  const AuthSession = require('expo-auth-session');
  const { FacebookAuthProvider } = require('firebase/auth');

  const request = new AuthSession.AuthRequest({
    clientId: facebookAppId,
    redirectUri: `fb${facebookAppId}://authorize`,
    scopes: ['public_profile', 'email'],
    responseType: AuthSession.ResponseType.Token,
    usePKCE: false,
    extraParams: { display: 'popup' },
  });
  const result = await request.promptAsync(META_DISCOVERY);
  if (!result || result.type !== 'success') throw sessionFailure(result || { type: 'error' }, 'Meta');
  const accessToken = (result.params && result.params.access_token) || (result.authentication && result.authentication.accessToken);
  if (!accessToken) throw new SocialAuthError('failed', 'Meta did not send back a sign-in token. Please try again.');
  return { credential: FacebookAuthProvider.credential(accessToken), name: '' };
}

const CREDENTIAL_FOR = { apple: appleCredential, google: googleCredential, meta: metaCredential };

// What Firebase said when it would not sign the person in, as something to show.
function firebaseFailure(error) {
  const code = (error && error.code) || '';
  if (code === 'auth/account-exists-with-different-credential') {
    return new SocialAuthError('account-exists', 'An account with that email already exists. Sign in the way you first did: email and password, or the other service.');
  }
  if (code === 'auth/network-request-failed') {
    return new SocialAuthError('network', 'Network error. Check your connection and try again.');
  }
  if (code === 'auth/operation-not-allowed') {
    return new SocialAuthError('not-configured', "This sign-in method isn't turned on yet.");
  }
  if (code === 'auth/user-disabled') {
    return new SocialAuthError('failed', 'This account has been disabled.');
  }
  if (code === 'auth/invalid-credential' || code === 'auth/invalid-id-token' || code === 'auth/internal-error') {
    return new SocialAuthError('failed', 'The sign-in was refused. Please try again.');
  }
  return new SocialAuthError('failed', (error && error.message) || 'Sign-in failed. Please try again.');
}

/**
 * A fresh one-time authorization code from Apple, for deleting an account that signs in with Apple. The delete function
 * trades it for a token and revokes it (functions/src/appleRevoke.js), which is what takes ZOWN HQ off the person's Apple ID.
 * Apple shows its own sheet, so this is the person confirming with Apple. `appleUserId` is the Apple id linked to the account
 * (providerData uid), so the sheet is for that Apple ID. If Apple will not refresh it (for example the person already removed
 * ZOWN HQ from their Apple ID settings), a normal Sign in with Apple sheet is shown instead; either way the code is only used
 * to revoke. Rejects with a SocialAuthError: 'cancelled' when the person closes the sheet.
 */
export async function requestAppleAuthorizationCode(appleUserId) {
  const AppleAuthentication = require('expo-apple-authentication');

  let available = false;
  try { available = await AppleAuthentication.isAvailableAsync(); } catch (e) { available = false; }
  if (!available) throw new SocialAuthError('unavailable', 'Sign in with Apple is not available on this phone.');

  const isCancel = (e) => !!e && (e.code === 'ERR_REQUEST_CANCELED' || e.code === 'ERR_CANCELED');
  let apple = null;
  try {
    apple = await AppleAuthentication.refreshAsync({ user: appleUserId });
  } catch (e) {
    if (isCancel(e)) throw cancelled();
    try {
      apple = await AppleAuthentication.signInAsync({});
    } catch (second) {
      if (isCancel(second)) throw cancelled();
      console.warn('[SocialAuth] Apple would not give a code:', second && second.code, second && second.message);
      throw new SocialAuthError('failed', 'Apple could not confirm it is you. Please try again.');
    }
  }
  if (!apple || !apple.authorizationCode) {
    throw new SocialAuthError('failed', 'Apple did not send back what is needed to delete the account. Please try again.');
  }
  return apple.authorizationCode;
}

/**
 * Signs in with `provider` ('apple', 'google' or 'meta'). Resolves to
 * { fbUser, isNewUser, name }: the Firebase user, whether this sign-in created the account, and the name the
 * provider gave (Apple only, and only the first time) so the caller can use it. Rejects with a SocialAuthError.
 */
export async function signInWithProvider(provider) {
  const makeCredential = CREDENTIAL_FOR[provider];
  if (!makeCredential) throw new SocialAuthError('failed', 'That sign-in method is not available.');

  const { isFirebaseConfigured, auth } = require('../src/config/firebase');
  if (!isFirebaseConfigured || !auth) throw new SocialAuthError('unavailable', "Sign-in isn't available right now.");
  const { signInWithCredential, getAdditionalUserInfo, updateProfile } = require('firebase/auth');

  let made;
  try {
    made = await makeCredential();
  } catch (e) {
    if (e instanceof SocialAuthError) throw e;
    console.warn(`[SocialAuth] ${provider} failed before Firebase:`, e && e.code, e && e.message);
    throw new SocialAuthError('failed', `${PROVIDER_NAMES[provider]} sign-in failed. Please try again.`);
  }

  let result;
  try {
    result = await signInWithCredential(auth, made.credential);
  } catch (e) {
    console.warn(`[SocialAuth] Firebase refused the ${provider} sign-in:`, e && e.code, e && e.message);
    throw firebaseFailure(e);
  }

  const fbUser = result.user;
  const info = getAdditionalUserInfo(result);
  if (made.name && fbUser && !fbUser.displayName) {
    try { await updateProfile(fbUser, { displayName: made.name }); } catch (e) { console.log('[SocialAuth] updateProfile failed (non-fatal):', e && e.message); }
  }
  return { fbUser, isNewUser: !!(info && info.isNewUser), name: made.name || '' };
}
