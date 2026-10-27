// authService.loginWithProvider: the Apple, Google or Meta sign-in as the screen uses it.
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));

const mockSignIn = jest.fn();
jest.mock('../services/socialAuth', () => ({
  ...jest.requireActual('../services/socialAuth'),
  signInWithProvider: (...a) => mockSignIn(...a),
}));

const { authService } = require('../services/authService');
const { SocialAuthError } = require('../services/socialAuth');

const firebaseUser = (extra = {}) => ({
  uid: 'fb-uid',
  email: 'cj@example.com',
  displayName: 'Carlton',
  photoURL: null,
  getIdToken: jest.fn(async () => 'id-token'),
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSignIn.mockResolvedValue({ fbUser: firebaseUser(), isNewUser: false, name: '' });
});

describe('authService.loginWithProvider', () => {
  it('asks for the provider and returns the user, a token and whether the account is new', async () => {
    mockSignIn.mockResolvedValue({ fbUser: firebaseUser(), isNewUser: true, name: '' });
    const result = await authService.loginWithProvider('google');
    expect(mockSignIn).toHaveBeenCalledWith('google');
    expect(result.isNewUser).toBe(true);
    expect(result.token).toBe('id-token');
    expect(result.user).toMatchObject({ uid: 'fb-uid', id: 'fb-uid', email: 'cj@example.com', name: 'Carlton' });
    expect(result.user.subscription.tier).toBe('free');
  });

  it('keeps the session token the way an email sign-in does', async () => {
    await authService.loginWithProvider('meta');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('auth_token', 'id-token');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('auth_token_issued_at', expect.any(String));
  });

  it('uses the name Apple gave when the account has none yet', async () => {
    mockSignIn.mockResolvedValue({ fbUser: firebaseUser({ displayName: null }), isNewUser: true, name: 'Cj Wright' });
    const result = await authService.loginWithProvider('apple');
    expect(result.user.name).toBe('Cj Wright');
  });

  it('falls back to the start of the email for a name when there is none at all', async () => {
    mockSignIn.mockResolvedValue({ fbUser: firebaseUser({ displayName: null }), isNewUser: true, name: '' });
    expect((await authService.loginWithProvider('apple')).user.name).toBe('cj');
  });

  it('still signs in when the ID token cannot be read', async () => {
    mockSignIn.mockResolvedValue({
      fbUser: firebaseUser({ getIdToken: jest.fn(async () => { throw new Error('offline'); }) }),
      isNewUser: false,
      name: '',
    });
    const result = await authService.loginWithProvider('google');
    expect(result.token).toBe('firebase-session');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('auth_token', 'firebase-session');
  });

  it('passes on a failed sign-in as it is, with nothing stored', async () => {
    mockSignIn.mockRejectedValue(new SocialAuthError('cancelled', 'Sign-in was cancelled.'));
    await expect(authService.loginWithProvider('google')).rejects.toMatchObject({ code: 'cancelled' });
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('says social sign-in is not available in Expo Go, and does not start one', async () => {
    jest.resetModules();
    jest.doMock('expo-constants', () => ({ executionEnvironment: 'storeClient' }));
    let service;
    jest.isolateModules(() => { ({ authService: service } = require('../services/authService')); });
    const error = await service.loginWithProvider('apple').catch((e) => e);
    expect(error.code).toBe('unavailable');
    expect(error.message).toBe('Apple sign-in is not available in Expo Go. Use the app from TestFlight, or email and password.');
    expect(mockSignIn).not.toHaveBeenCalled();
    jest.dontMock('expo-constants');
  });
});
