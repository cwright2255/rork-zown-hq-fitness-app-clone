// The header that carries the person's Firebase sign-in token to our own servers (lib/signInHeader.js). Firebase is replaced by a small
// stand-in, so no network is used.

const mockFirebase = { auth: { currentUser: null } };
const mockLoads = { count: 0 };
jest.mock('../src/config/firebase', () => {
  mockLoads.count += 1;
  return mockFirebase;
});

import { signInHeader } from '../lib/signInHeader';

const signedInWith = (getIdToken) => {
  mockFirebase.auth = { currentUser: { getIdToken } };
};

beforeEach(() => {
  mockFirebase.auth = { currentUser: null };
});

describe('signInHeader', () => {
  it('is a Bearer header holding the sign-in token of the person signed in', async () => {
    signedInWith(jest.fn(async () => 'token-abc'));
    await expect(signInHeader()).resolves.toEqual({ Authorization: 'Bearer token-abc' });
  });

  it('takes the token the SDK holds, which the SDK renews itself when it is about to run out (no forced refresh)', async () => {
    const getIdToken = jest.fn(async () => 'token-abc');
    signedInWith(getIdToken);
    await signInHeader();
    expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(getIdToken).toHaveBeenCalledWith();
  });

  it('is empty with nobody signed in, so the server\'s 401 says so', async () => {
    await expect(signInHeader()).resolves.toEqual({});
  });

  it('is empty when Firebase has no sign-in at all', async () => {
    mockFirebase.auth = null;
    await expect(signInHeader()).resolves.toEqual({});
  });

  it.each([[''], [null], [undefined]])('is empty when the token is %j', async (token) => {
    signedInWith(jest.fn(async () => token));
    await expect(signInHeader()).resolves.toEqual({});
  });

  it('throws when the token cannot be read, rather than letting a request go out without it', async () => {
    signedInWith(jest.fn(async () => { throw new Error('auth/network-request-failed'); }));
    await expect(signInHeader()).rejects.toThrow('auth/network-request-failed');
  });

  it('starts nothing until it is called: Firebase is loaded on the first call, not on import', async () => {
    jest.resetModules();
    mockLoads.count = 0;
    const fresh = require('../lib/signInHeader');
    expect(mockLoads.count).toBe(0);
    await fresh.signInHeader();
    expect(mockLoads.count).toBe(1);
  });
});
