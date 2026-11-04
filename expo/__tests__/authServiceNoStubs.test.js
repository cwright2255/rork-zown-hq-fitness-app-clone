// The sign-in stubs that Build 13 deleted from services/authService.js: a "verify MFA" that accepted the code 123456, and offline
// sessions that signed anyone in, with any email and password, when Firebase was not set up. Without Firebase, sign-in and
// registration now refuse and store nothing.
import AsyncStorage from '@react-native-async-storage/async-storage';

const fs = require('fs');
const path = require('path');

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));

const mockFirebase = { isFirebaseConfigured: false, auth: null };
jest.mock('../src/config/firebase', () => ({
  get isFirebaseConfigured() { return mockFirebase.isFirebaseConfigured; },
  get auth() { return mockFirebase.auth; },
}));

const mockSignIn = jest.fn();
const mockCreate = jest.fn();
jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: (...a) => mockSignIn(...a),
  createUserWithEmailAndPassword: (...a) => mockCreate(...a),
  updateProfile: jest.fn(async () => undefined),
}));

const { authService } = require('../services/authService');

beforeEach(() => {
  jest.clearAllMocks();
  mockFirebase.isFirebaseConfigured = false;
  mockFirebase.auth = null;
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => { jest.restoreAllMocks(); });

describe('without Firebase set up', () => {
  it('refuses to sign in, whatever the email and password, and stores no session', async () => {
    await expect(authService.login('anyone@example.com', 'anything')).rejects.toThrow('Sign-in is not available right now. Please try again later.');
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('refuses to create an account, and stores no session', async () => {
    await expect(authService.register('Anyone', 'anyone@example.com', 'anything')).rejects.toThrow('Creating an account is not available right now. Please try again later.');
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('refuses when Firebase is configured but its sign-in did not start', async () => {
    mockFirebase.isFirebaseConfigured = true;
    await expect(authService.login('a@b.co', 'secret1')).rejects.toThrow('Sign-in is not available right now');
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});

describe('with Firebase set up', () => {
  const fbUser = { uid: 'u1', email: 'cj@example.com', displayName: 'Cj', photoURL: null, getIdToken: jest.fn(async () => 'real-id-token') };
  beforeEach(() => { mockFirebase.isFirebaseConfigured = true; mockFirebase.auth = { currentUser: null }; });

  it('still signs in a real account and keeps its token', async () => {
    mockSignIn.mockResolvedValue({ user: fbUser });
    const result = await authService.login('cj@example.com', 'secret1');
    expect(mockSignIn).toHaveBeenCalledWith(mockFirebase.auth, 'cj@example.com', 'secret1');
    expect(result.token).toBe('real-id-token');
    expect(result.user).toMatchObject({ uid: 'u1', email: 'cj@example.com' });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('auth_token', 'real-id-token');
  });

  it('turns a wrong password into the message the screen shows, with nothing stored', async () => {
    mockSignIn.mockRejectedValue({ code: 'auth/wrong-password' });
    await expect(authService.login('cj@example.com', 'nope')).rejects.toThrow();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('still creates a real account', async () => {
    mockCreate.mockResolvedValue({ user: fbUser });
    const result = await authService.register('Cj', 'cj@example.com', 'secret1');
    expect(result.token).toBe('real-id-token');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('auth_token', 'real-id-token');
  });
});

describe('the deleted stubs', () => {
  it('are gone: no verifyMFA, and nothing in the file that mints a made-up session', () => {
    expect(authService.verifyMFA).toBeUndefined();
    const source = fs.readFileSync(path.join(__dirname, '..', 'services', 'authService.js'), 'utf8');
    for (const stub of ['verifyMFA', '123456', 'offline-session', 'mfa-session-token', 'offline login', 'offline registration']) expect(source).not.toContain(stub);
  });
});
