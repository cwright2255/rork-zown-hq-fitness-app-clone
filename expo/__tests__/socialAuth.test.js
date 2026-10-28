// Signing in with Apple, Google or Meta (services/socialAuth.js): what is asked of each provider, what Firebase is
// given, and what the person is told when it does not work.
const mockFirebase = { isFirebaseConfigured: true, auth: { fake: 'auth' } };
jest.mock('../src/config/firebase', () => mockFirebase);

const mockAppleCredential = jest.fn();
jest.mock('firebase/auth', () => ({
  signInWithCredential: jest.fn(),
  getAdditionalUserInfo: jest.fn(),
  updateProfile: jest.fn(async () => undefined),
  OAuthProvider: jest.fn(function OAuthProvider(id) {
    this.providerId = id;
    this.credential = (...a) => { mockAppleCredential(...a); return { kind: 'apple-credential' }; };
  }),
  GoogleAuthProvider: { credential: jest.fn(() => ({ kind: 'google-credential' })) },
  FacebookAuthProvider: { credential: jest.fn(() => ({ kind: 'facebook-credential' })) },
}), { virtual: true });

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(async () => true),
  signInAsync: jest.fn(),
  refreshAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}), { virtual: true });

let mockUuid = 0;
jest.mock('expo-crypto', () => ({
  // a real UUID: 32 hex digits in five groups
  randomUUID: jest.fn(() => `${String(++mockUuid).padStart(8, '0')}-aaaa-4bbb-8ccc-dddddddddddd`),
  digestStringAsync: jest.fn(async (alg, text) => `${alg}(${text})`),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}), { virtual: true });

const mockRequests = [];
let mockPromptResult;
jest.mock('expo-auth-session', () => ({
  AuthRequest: jest.fn(function AuthRequest(config) {
    this.config = config;
    this.codeVerifier = 'verifier-1';
    this.promptAsync = jest.fn(async () => mockPromptResult);
    mockRequests.push(this);
  }),
  exchangeCodeAsync: jest.fn(),
  ResponseType: { Code: 'code', Token: 'token' },
  Prompt: { SelectAccount: 'select_account' },
}), { virtual: true });

const firebaseAuth = require('firebase/auth');
const Apple = require('expo-apple-authentication');
const Crypto = require('expo-crypto');
const AuthSession = require('expo-auth-session');
const {
  signInWithProvider,
  requestAppleAuthorizationCode,
  isProviderConfigured,
  SocialAuthError,
  GOOGLE_REDIRECT_URI,
  GOOGLE_DISCOVERY,
  META_DISCOVERY,
  PROVIDERS,
} = require('../services/socialAuth');

const fbUser = (extra = {}) => ({ uid: 'fb-uid', email: 'cj@example.com', displayName: null, ...extra });
const signedIn = (user, isNewUser) => {
  firebaseAuth.signInWithCredential.mockResolvedValue({ user });
  firebaseAuth.getAdditionalUserInfo.mockReturnValue({ isNewUser });
};
const failure = async (provider) => {
  try { await signInWithProvider(provider); } catch (e) { return e; }
  throw new Error('expected the sign-in to fail');
};

const ENV_NAMES = ['EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', 'EXPO_PUBLIC_FACEBOOK_APP_ID'];
const ENV = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
beforeEach(() => {
  jest.clearAllMocks();
  mockRequests.length = 0;
  mockUuid = 0;
  mockFirebase.isFirebaseConfigured = true;
  mockFirebase.auth = { fake: 'auth' };
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'google-client.apps.googleusercontent.com';
  process.env.EXPO_PUBLIC_FACEBOOK_APP_ID = '123456789';
  Apple.isAvailableAsync.mockResolvedValue(true);
  signedIn(fbUser(), false);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => {
  for (const name of ENV_NAMES) {
    if (ENV[name] === undefined) delete process.env[name];
    else process.env[name] = ENV[name];
  }
  jest.restoreAllMocks();
});

describe('which providers are set up', () => {
  it('offers Apple, Google and Meta', () => {
    expect(PROVIDERS).toEqual(['apple', 'google', 'meta']);
  });

  it('needs nothing from the app build for Apple, a client id for Google and an app id for Meta', () => {
    expect(isProviderConfigured('apple')).toBe(true);
    expect(isProviderConfigured('google')).toBe(true);
    expect(isProviderConfigured('meta')).toBe(true);
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = '  ';
    delete process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
    expect(isProviderConfigured('apple')).toBe(true);
    expect(isProviderConfigured('google')).toBe(false);
    expect(isProviderConfigured('meta')).toBe(false);
    expect(isProviderConfigured('twitter')).toBe(false);
  });
});

describe('Sign in with Apple', () => {
  beforeEach(() => {
    Apple.signInAsync.mockResolvedValue({ identityToken: 'apple-id-token', fullName: null });
  });

  it('gives Apple the hash of a one-time nonce and Firebase the nonce itself', async () => {
    await signInWithProvider('apple');
    const asked = Apple.signInAsync.mock.calls[0][0];
    const given = mockAppleCredential.mock.calls[0][0];
    expect(given.idToken).toBe('apple-id-token');
    expect(given.rawNonce).toMatch(/^[0-9a-f]{64}$/); // two UUIDs, dashes taken out
    expect(asked.nonce).toBe(`SHA-256(${given.rawNonce})`);
    expect(Crypto.digestStringAsync).toHaveBeenCalledWith('SHA-256', given.rawNonce);
    expect(firebaseAuth.OAuthProvider).toHaveBeenCalledWith('apple.com');
    expect(asked.requestedScopes).toEqual([0, 1]);
  });

  it('uses a new nonce for every sign-in', async () => {
    await signInWithProvider('apple');
    await signInWithProvider('apple');
    expect(mockAppleCredential.mock.calls[0][0].rawNonce).not.toBe(mockAppleCredential.mock.calls[1][0].rawNonce);
  });

  it('signs Firebase in with the credential and says whether the account is new', async () => {
    signedIn(fbUser(), true);
    const result = await signInWithProvider('apple');
    expect(firebaseAuth.signInWithCredential).toHaveBeenCalledWith(mockFirebase.auth, { kind: 'apple-credential' });
    expect(result.isNewUser).toBe(true);
    expect(result.fbUser.uid).toBe('fb-uid');
    signedIn(fbUser(), false);
    expect((await signInWithProvider('apple')).isNewUser).toBe(false);
  });

  it('takes the name Apple gives the first time and saves it to the account', async () => {
    Apple.signInAsync.mockResolvedValue({ identityToken: 't', fullName: { givenName: 'Cj', familyName: 'Wright' } });
    const user = fbUser();
    signedIn(user, true);
    const result = await signInWithProvider('apple');
    expect(result.name).toBe('Cj Wright');
    expect(firebaseAuth.updateProfile).toHaveBeenCalledWith(user, { displayName: 'Cj Wright' });
  });

  it('keeps the name an account already has', async () => {
    Apple.signInAsync.mockResolvedValue({ identityToken: 't', fullName: { givenName: 'Cj', familyName: 'Wright' } });
    signedIn(fbUser({ displayName: 'Carlton' }), false);
    await signInWithProvider('apple');
    expect(firebaseAuth.updateProfile).not.toHaveBeenCalled();
  });

  it('does not stop the sign-in when saving the name fails', async () => {
    Apple.signInAsync.mockResolvedValue({ identityToken: 't', fullName: { givenName: 'Cj', familyName: null } });
    firebaseAuth.updateProfile.mockRejectedValueOnce(new Error('offline'));
    const result = await signInWithProvider('apple');
    expect(result.name).toBe('Cj');
  });

  it('is cancelled, not failed, when the person closes the sheet', async () => {
    Apple.signInAsync.mockRejectedValue(Object.assign(new Error('closed'), { code: 'ERR_REQUEST_CANCELED' }));
    const error = await failure('apple');
    expect(error).toBeInstanceOf(SocialAuthError);
    expect(error.code).toBe('cancelled');
    expect(firebaseAuth.signInWithCredential).not.toHaveBeenCalled();
  });

  it('says so when the phone cannot do it', async () => {
    Apple.isAvailableAsync.mockResolvedValue(false);
    const error = await failure('apple');
    expect(error.code).toBe('unavailable');
    expect(error.message).toBe('Sign in with Apple is not available on this phone.');
    expect(Apple.signInAsync).not.toHaveBeenCalled();
  });

  it('says so when Apple sends no token', async () => {
    Apple.signInAsync.mockResolvedValue({ identityToken: null });
    const error = await failure('apple');
    expect(error.code).toBe('failed');
    expect(error.message).toMatch(/Apple did not send back a sign-in token/);
  });

  it('says it failed, in plain words, for any other Apple error', async () => {
    Apple.signInAsync.mockRejectedValue(Object.assign(new Error('ERR_UNKNOWN: secret detail'), { code: 'ERR_UNKNOWN' }));
    const error = await failure('apple');
    expect(error.code).toBe('failed');
    expect(error.message).toBe('Apple sign-in failed. Please try again.');
  });
});

describe('Sign in with Google', () => {
  beforeEach(() => {
    mockPromptResult = { type: 'success', params: { code: 'auth-code' } };
    AuthSession.exchangeCodeAsync.mockResolvedValue({ idToken: 'google-id-token', accessToken: 'google-access-token' });
  });

  it('says it is not set up, and opens nothing, until the client id is set', async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    const error = await failure('google');
    expect(error.code).toBe('not-configured');
    expect(error.message).toBe("Google sign-in isn't set up yet.");
    expect(AuthSession.AuthRequest).not.toHaveBeenCalled();
  });

  it('asks Google for a code with PKCE, using the iOS client and the bundle id redirect', async () => {
    await signInWithProvider('google');
    const request = mockRequests[0];
    expect(request.config).toMatchObject({
      clientId: 'google-client.apps.googleusercontent.com',
      redirectUri: 'com.zownhq.app:/oauthredirect',
      responseType: 'code',
      usePKCE: true,
      prompt: 'select_account',
    });
    expect(request.config.scopes).toEqual(['openid', 'profile', 'email']);
    expect(request.promptAsync).toHaveBeenCalledWith(GOOGLE_DISCOVERY);
    expect(GOOGLE_REDIRECT_URI).toBe('com.zownhq.app:/oauthredirect');
  });

  it('trades the code, with the PKCE verifier, for an ID token and gives Firebase both tokens', async () => {
    await signInWithProvider('google');
    expect(AuthSession.exchangeCodeAsync).toHaveBeenCalledWith({
      clientId: 'google-client.apps.googleusercontent.com',
      code: 'auth-code',
      redirectUri: 'com.zownhq.app:/oauthredirect',
      extraParams: { code_verifier: 'verifier-1' },
    }, GOOGLE_DISCOVERY);
    expect(firebaseAuth.GoogleAuthProvider.credential).toHaveBeenCalledWith('google-id-token', 'google-access-token');
    expect(firebaseAuth.signInWithCredential).toHaveBeenCalledWith(mockFirebase.auth, { kind: 'google-credential' });
  });

  it.each([['cancel'], ['dismiss']])('is cancelled when the page ends as "%s"', async (type) => {
    mockPromptResult = { type };
    const error = await failure('google');
    expect(error.code).toBe('cancelled');
    expect(AuthSession.exchangeCodeAsync).not.toHaveBeenCalled();
  });

  it('says what Google reported when the page ends in an error', async () => {
    mockPromptResult = { type: 'error', error: { message: 'redirect_uri_mismatch' } };
    const error = await failure('google');
    expect(error.code).toBe('failed');
    expect(error.message).toBe('Google sign-in did not finish. Please try again. (redirect_uri_mismatch)');
  });

  it('says another sign-in is open when the system is already showing one', async () => {
    mockPromptResult = { type: 'locked' };
    expect((await failure('google')).message).toMatch(/Another sign-in is already open/);
  });

  it('fails plainly when Google sends no code or no ID token', async () => {
    mockPromptResult = { type: 'success', params: {} };
    expect((await failure('google')).message).toMatch(/did not send back a sign-in code/);
    mockPromptResult = { type: 'success', params: { code: 'c' } };
    AuthSession.exchangeCodeAsync.mockResolvedValue({ accessToken: 'only-access' });
    expect((await failure('google')).message).toMatch(/did not send back a sign-in token/);
  });

  it('fails plainly when the code cannot be traded', async () => {
    AuthSession.exchangeCodeAsync.mockRejectedValue(new Error('invalid_grant'));
    const error = await failure('google');
    expect(error.code).toBe('failed');
    expect(error.message).toBe('Google sign-in failed. Please try again.');
  });
});

describe('Sign in with Meta', () => {
  beforeEach(() => {
    mockPromptResult = { type: 'success', params: { access_token: 'meta-token' } };
  });

  it('says it is not set up, and opens nothing, until the app id is set', async () => {
    delete process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
    const error = await failure('meta');
    expect(error.code).toBe('not-configured');
    expect(error.message).toBe("Meta sign-in isn't set up yet.");
    expect(AuthSession.AuthRequest).not.toHaveBeenCalled();
  });

  it('asks Meta for an access token with the app id and its fb redirect', async () => {
    await signInWithProvider('meta');
    const request = mockRequests[0];
    expect(request.config).toMatchObject({
      clientId: '123456789',
      redirectUri: 'fb123456789://authorize',
      responseType: 'token',
      usePKCE: false,
    });
    expect(request.config.scopes).toEqual(['public_profile', 'email']);
    expect(request.promptAsync).toHaveBeenCalledWith(META_DISCOVERY);
    expect(firebaseAuth.FacebookAuthProvider.credential).toHaveBeenCalledWith('meta-token');
    expect(firebaseAuth.signInWithCredential).toHaveBeenCalledWith(mockFirebase.auth, { kind: 'facebook-credential' });
  });

  it('also reads the token from the authentication the session builds', async () => {
    mockPromptResult = { type: 'success', params: {}, authentication: { accessToken: 'from-authentication' } };
    await signInWithProvider('meta');
    expect(firebaseAuth.FacebookAuthProvider.credential).toHaveBeenCalledWith('from-authentication');
  });

  it('is cancelled when the person closes the page, and fails plainly with no token', async () => {
    mockPromptResult = { type: 'cancel' };
    expect((await failure('meta')).code).toBe('cancelled');
    mockPromptResult = { type: 'success', params: {} };
    expect((await failure('meta')).message).toMatch(/Meta did not send back a sign-in token/);
  });
});

describe('when Firebase will not sign the person in', () => {
  beforeEach(() => {
    Apple.signInAsync.mockResolvedValue({ identityToken: 't' });
  });

  it.each([
    ['auth/account-exists-with-different-credential', 'account-exists', /already exists\. Sign in the way you first did/],
    ['auth/network-request-failed', 'network', /Network error/],
    ['auth/operation-not-allowed', 'not-configured', /isn't turned on yet/],
    ['auth/user-disabled', 'failed', /has been disabled/],
    ['auth/invalid-credential', 'failed', /sign-in was refused/],
    ['auth/invalid-id-token', 'failed', /sign-in was refused/],
    ['auth/internal-error', 'failed', /sign-in was refused/],
  ])('maps %s to a message that can be shown', async (code, kind, message) => {
    firebaseAuth.signInWithCredential.mockRejectedValue(Object.assign(new Error('raw'), { code }));
    const error = await failure('apple');
    expect(error).toBeInstanceOf(SocialAuthError);
    expect(error.code).toBe(kind);
    expect(error.message).toMatch(message);
  });

  it('passes on Firebase\'s own words for anything else', async () => {
    firebaseAuth.signInWithCredential.mockRejectedValue(Object.assign(new Error('Something new'), { code: 'auth/new-thing' }));
    expect((await failure('apple')).message).toBe('Something new');
  });
});

describe('when sign-in cannot start', () => {
  it('says so when Firebase is not set up', async () => {
    mockFirebase.isFirebaseConfigured = false;
    const error = await failure('apple');
    expect(error.code).toBe('unavailable');
    expect(error.message).toBe("Sign-in isn't available right now.");
    mockFirebase.isFirebaseConfigured = true;
    mockFirebase.auth = null;
    expect((await failure('apple')).code).toBe('unavailable');
  });

  it('says so for a provider it does not know', async () => {
    const error = await failure('twitter');
    expect(error.code).toBe('failed');
    expect(error.message).toBe('That sign-in method is not available.');
  });
});

describe('a fresh Apple code, for deleting an account that signs in with Apple', () => {
  const codeFailure = async (appleUserId = '001234.apple.user') => {
    try { await requestAppleAuthorizationCode(appleUserId); } catch (e) { return e; }
    throw new Error('expected it to fail');
  };
  const canceled = () => Object.assign(new Error('closed'), { code: 'ERR_REQUEST_CANCELED' });

  it('asks Apple to refresh the Apple ID linked to the account, and gives back the code', async () => {
    Apple.refreshAsync.mockResolvedValue({ authorizationCode: 'one-time-code', user: '001234.apple.user' });
    await expect(requestAppleAuthorizationCode('001234.apple.user')).resolves.toBe('one-time-code');
    expect(Apple.refreshAsync).toHaveBeenCalledTimes(1);
    expect(Apple.refreshAsync).toHaveBeenCalledWith({ user: '001234.apple.user' });
    expect(Apple.signInAsync).not.toHaveBeenCalled();
  });

  it('does not sign anyone in to Firebase: it only fetches a code', async () => {
    Apple.refreshAsync.mockResolvedValue({ authorizationCode: 'one-time-code' });
    await requestAppleAuthorizationCode('001234.apple.user');
    expect(firebaseAuth.signInWithCredential).not.toHaveBeenCalled();
  });

  it('shows the normal Sign in with Apple sheet if Apple will not refresh (for example ZOWN HQ was removed in Apple ID settings)', async () => {
    Apple.refreshAsync.mockRejectedValue(Object.assign(new Error('not handled'), { code: 'ERR_REQUEST_NOT_HANDLED' }));
    Apple.signInAsync.mockResolvedValue({ authorizationCode: 'fallback-code' });
    await expect(requestAppleAuthorizationCode('001234.apple.user')).resolves.toBe('fallback-code');
    expect(Apple.signInAsync).toHaveBeenCalledTimes(1);
  });

  it('shows nothing more, and says it was cancelled, when the person closes the sheet', async () => {
    Apple.refreshAsync.mockRejectedValue(canceled());
    const error = await codeFailure();
    expect(error).toBeInstanceOf(SocialAuthError);
    expect(error.code).toBe('cancelled');
    expect(Apple.signInAsync).not.toHaveBeenCalled();
  });

  it('says it was cancelled when the person closes the second sheet', async () => {
    Apple.refreshAsync.mockRejectedValue(new Error('nope'));
    Apple.signInAsync.mockRejectedValue(canceled());
    expect((await codeFailure()).code).toBe('cancelled');
  });

  it('says Apple could not confirm when neither sheet works', async () => {
    Apple.refreshAsync.mockRejectedValue(new Error('nope'));
    Apple.signInAsync.mockRejectedValue(Object.assign(new Error('still no'), { code: 'ERR_REQUEST_FAILED' }));
    const error = await codeFailure();
    expect(error.code).toBe('failed');
    expect(error.message).toBe('Apple could not confirm it is you. Please try again.');
  });

  it.each([[null], [undefined], ['']])('says so when Apple sends back no code (%p)', async (authorizationCode) => {
    Apple.refreshAsync.mockResolvedValue({ authorizationCode });
    const error = await codeFailure();
    expect(error.code).toBe('failed');
    expect(error.message).toMatch(/did not send back what is needed/);
  });

  it('says so on a phone that cannot do Sign in with Apple, without opening anything', async () => {
    Apple.isAvailableAsync.mockResolvedValue(false);
    const error = await codeFailure();
    expect(error.code).toBe('unavailable');
    expect(Apple.refreshAsync).not.toHaveBeenCalled();
    expect(Apple.signInAsync).not.toHaveBeenCalled();
  });
});
