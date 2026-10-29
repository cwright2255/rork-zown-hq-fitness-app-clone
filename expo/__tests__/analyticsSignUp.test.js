// The sign_up analytics event, sent by services/authService.js. It is the count of accounts created, so it is sent once for each
// account the sign-up really creates and for nothing else: not for signing in to an account that already exists, not when the
// sign-up fails and not when the app has no Firebase to create an account in (the offline preview).
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('../src/config/firebase', () => ({
  get isFirebaseConfigured() { return global.__configured; },
  auth: { fake: true },
}));
jest.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: (...a) => global.__createUser(...a),
  signInWithEmailAndPassword: (...a) => global.__signInUser(...a),
  updateProfile: (...a) => global.__updateProfile(...a),
}), { virtual: true });
const mockSocialSignIn = jest.fn();
jest.mock('../services/socialAuth', () => ({
  ...jest.requireActual('../services/socialAuth'),
  signInWithProvider: (...a) => mockSocialSignIn(...a),
}));
const mockLogSignUp = jest.fn();
jest.mock('../src/services/analytics', () => ({ logSignUp: (...a) => mockLogSignUp(...a) }));

const { authService } = require('../services/authService');

const firebaseUser = (extra = {}) => ({
  uid: 'fb-uid',
  email: 'cj@example.com',
  displayName: null,
  photoURL: null,
  getIdToken: jest.fn(async () => 'id-token'),
  ...extra,
});

beforeEach(() => {
  mockLogSignUp.mockClear();
  mockSocialSignIn.mockReset();
  global.__configured = true;
  global.__createUser = jest.fn(async () => ({ user: firebaseUser() }));
  global.__signInUser = jest.fn(async () => ({ user: firebaseUser() }));
  global.__updateProfile = jest.fn(async () => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); });

describe('signing up with an email and password', () => {
  it('sends one sign_up event, "email", when the account is created', async () => {
    await authService.register('Cj', 'cj@example.com', 'secret123');
    expect(global.__createUser).toHaveBeenCalledTimes(1);
    expect(mockLogSignUp).toHaveBeenCalledTimes(1);
    expect(mockLogSignUp).toHaveBeenCalledWith('email');
  });

  it('sends it even when saving the name afterwards fails, because the account exists', async () => {
    global.__updateProfile = jest.fn(async () => { throw new Error('network'); });
    await authService.register('Cj', 'cj@example.com', 'secret123');
    expect(mockLogSignUp).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when the sign-up fails', async () => {
    global.__createUser = jest.fn(async () => { throw Object.assign(new Error('taken'), { code: 'auth/email-already-in-use' }); });
    await expect(authService.register('Cj', 'cj@example.com', 'secret123')).rejects.toThrow('An account with that email already exists');
    expect(mockLogSignUp).not.toHaveBeenCalled();
  });

  it('sends nothing when there is no Firebase and nothing is created (the offline preview)', async () => {
    global.__configured = false;
    await authService.register('Cj', 'cj@example.com', 'secret123');
    expect(global.__createUser).not.toHaveBeenCalled();
    expect(mockLogSignUp).not.toHaveBeenCalled();
  });

  it('sends nothing for signing in to an account that already exists', async () => {
    await authService.login('cj@example.com', 'secret123');
    expect(global.__signInUser).toHaveBeenCalledTimes(1);
    expect(mockLogSignUp).not.toHaveBeenCalled();
  });

  it('carries only the word for how they signed up: no name, no email', async () => {
    await authService.register('Cj Wright', 'cj@example.com', 'secret123');
    expect(mockLogSignUp.mock.calls[0]).toEqual(['email']);
  });
});

describe('signing up with Apple, Google or Meta', () => {
  it('sends one sign_up event, naming the provider, when the sign-in created the account', async () => {
    mockSocialSignIn.mockResolvedValue({ fbUser: firebaseUser(), isNewUser: true, name: '' });
    await authService.loginWithProvider('google');
    expect(mockLogSignUp).toHaveBeenCalledTimes(1);
    expect(mockLogSignUp).toHaveBeenCalledWith('google');
  });

  it('sends nothing when the account was already there: that is a sign-in, not a sign-up', async () => {
    mockSocialSignIn.mockResolvedValue({ fbUser: firebaseUser(), isNewUser: false, name: '' });
    await authService.loginWithProvider('apple');
    expect(mockLogSignUp).not.toHaveBeenCalled();
  });

  it('sends nothing when the sheet is closed or the sign-in fails', async () => {
    mockSocialSignIn.mockRejectedValue(new Error('cancelled'));
    await expect(authService.loginWithProvider('meta')).rejects.toThrow();
    expect(mockLogSignUp).not.toHaveBeenCalled();
  });
});
