// Who is signed in when the app opens, and what happens when Firebase ends a session (services/authGate.js).
import {
  FIRST_ANSWER_TIMEOUT_MS, waitForFirstAnswer, resolveLaunchSession, handleSignedOut,
} from '../services/authGate';

// A stand-in for Firebase's onAuthStateChanged. Nothing is called until the test says Firebase has answered (answer / fail).
const makeListener = () => {
  const state = { callback: null, onError: null, unsubscribed: 0 };
  const onAuthStateChanged = jest.fn((auth, callback, onError) => {
    state.callback = callback;
    state.onError = onError;
    return () => { state.unsubscribed += 1; };
  });
  return {
    onAuthStateChanged,
    state,
    answer: (user) => state.callback(user),
    fail: (e) => state.onError(e),
  };
};

const makeAuthService = ({ token = 'tok', authenticated = true } = {}) => ({
  getStoredToken: jest.fn(async () => token),
  isAuthenticated: jest.fn(async () => authenticated),
});

const flush = async () => { for (let i = 0; i < 10; i += 1) await Promise.resolve(); };

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('waiting for Firebase\'s first answer', () => {
  it('does not answer until Firebase does: the empty current user before the saved session is restored is not an answer', async () => {
    const fb = makeListener();
    const auth = { currentUser: null }; // what Firebase reads before it has restored the saved session
    let result = null;
    waitForFirstAnswer({ auth, onAuthStateChanged: fb.onAuthStateChanged }).then((r) => { result = r; });
    await flush();
    expect(result).toBeNull();
    jest.advanceTimersByTime(FIRST_ANSWER_TIMEOUT_MS - 1);
    await flush();
    expect(result).toBeNull();

    const user = { uid: 'u1' };
    auth.currentUser = user;
    fb.answer(user); // the saved session was found
    await flush();
    expect(result).toEqual({ state: 'signed-in', user });
  });

  it('says signed-out when Firebase reports nobody', async () => {
    const fb = makeListener();
    const promise = waitForFirstAnswer({ auth: {}, onAuthStateChanged: fb.onAuthStateChanged });
    fb.answer(null);
    expect(await promise).toEqual({ state: 'signed-out' });
  });

  it('leaves no timer running once Firebase has answered', async () => {
    const fb = makeListener();
    const promise = waitForFirstAnswer({ auth: {}, onAuthStateChanged: fb.onAuthStateChanged });
    expect(jest.getTimerCount()).toBe(1);
    fb.answer({ uid: 'u1' });
    await promise;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('stops listening once it has an answer, and only takes the first', async () => {
    const fb = makeListener();
    const promise = waitForFirstAnswer({ auth: {}, onAuthStateChanged: fb.onAuthStateChanged });
    fb.answer(null);
    fb.answer({ uid: 'later' });
    expect(await promise).toEqual({ state: 'signed-out' });
    expect(fb.state.unsubscribed).toBe(1);
  });

  it('says unknown if Firebase has not answered in time, and stops listening', async () => {
    const fb = makeListener();
    const promise = waitForFirstAnswer({ auth: {}, onAuthStateChanged: fb.onAuthStateChanged });
    jest.advanceTimersByTime(FIRST_ANSWER_TIMEOUT_MS);
    expect(await promise).toEqual({ state: 'unknown' });
    expect(fb.state.unsubscribed).toBe(1);
  });

  it('uses the time it is given', async () => {
    const fb = makeListener();
    const promise = waitForFirstAnswer({ auth: {}, onAuthStateChanged: fb.onAuthStateChanged, timeoutMs: 50 });
    jest.advanceTimersByTime(50);
    expect(await promise).toEqual({ state: 'unknown' });
  });

  it('ignores an answer that comes after the time ran out', async () => {
    const fb = makeListener();
    const promise = waitForFirstAnswer({ auth: {}, onAuthStateChanged: fb.onAuthStateChanged });
    jest.advanceTimersByTime(FIRST_ANSWER_TIMEOUT_MS);
    fb.answer(null);
    expect(await promise).toEqual({ state: 'unknown' });
  });

  it('says unknown if the listener reports an error, or cannot be set up', async () => {
    const fb = makeListener();
    const failing = waitForFirstAnswer({ auth: {}, onAuthStateChanged: fb.onAuthStateChanged });
    fb.fail(new Error('no'));
    expect(await failing).toEqual({ state: 'unknown' });

    const broken = await waitForFirstAnswer({ auth: {}, onAuthStateChanged: () => { throw new Error('no auth'); } });
    expect(broken).toEqual({ state: 'unknown' });
  });

  it('copes with Firebase answering before it has handed back the way to stop listening', async () => {
    const stopped = jest.fn();
    const onAuthStateChanged = (auth, callback) => {
      callback({ uid: 'u1' }); // an answer straight away
      return stopped;
    };
    const result = await waitForFirstAnswer({ auth: {}, onAuthStateChanged });
    expect(result.state).toBe('signed-in');
    expect(stopped).toHaveBeenCalledTimes(1);
  });
});

describe('the launch gate follows Firebase', () => {
  const run = (overrides = {}) => {
    const fb = overrides.fb || makeListener();
    const authService = overrides.authService || makeAuthService();
    const endSession = overrides.endSession || jest.fn(async () => undefined);
    const promise = resolveLaunchSession({
      auth: overrides.auth === undefined ? {} : overrides.auth,
      isFirebaseConfigured: overrides.isFirebaseConfigured === undefined ? true : overrides.isFirebaseConfigured,
      onAuthStateChanged: fb.onAuthStateChanged,
      authService,
      endSession,
    });
    return { fb, authService, endSession, promise };
  };

  it('clears the saved token and opens the login screen when Firebase reports signed out', async () => {
    const { fb, endSession, promise } = run();
    fb.answer(null);
    expect(await promise).toEqual({ authed: false, uid: null, answer: 'signed-out' });
    expect(endSession).toHaveBeenCalledTimes(1);
  });

  it('has nothing to clear when Firebase reports signed out and there is no saved token', async () => {
    const { fb, endSession, promise } = run({ authService: makeAuthService({ token: null, authenticated: false }) });
    fb.answer(null);
    expect(await promise).toEqual({ authed: false, uid: null, answer: 'signed-out' });
    expect(endSession).not.toHaveBeenCalled();
  });

  it('still opens the login screen if clearing the ended session fails', async () => {
    const { fb, promise } = run({ endSession: jest.fn(async () => { throw new Error('storage broke'); }) });
    fb.answer(null);
    expect((await promise).authed).toBe(false);
  });

  it('waits for Firebase: nothing is decided, and nothing cleared, while the saved session is still being restored', async () => {
    const { promise, endSession, authService } = run();
    let settled = false;
    promise.then(() => { settled = true; });
    jest.advanceTimersByTime(FIRST_ANSWER_TIMEOUT_MS - 1);
    await flush();
    expect(settled).toBe(false);
    expect(endSession).not.toHaveBeenCalled();
    expect(authService.isAuthenticated).not.toHaveBeenCalled();
  });

  it('opens Home for someone Firebase says is signed in, with their id', async () => {
    const { fb, promise, endSession } = run();
    fb.answer({ uid: 'u1' });
    expect(await promise).toEqual({ authed: true, uid: 'u1', answer: 'signed-in' });
    expect(endSession).not.toHaveBeenCalled();
  });

  it('still honours the keep-me-signed-in window for someone Firebase says is signed in', async () => {
    const { fb, promise, endSession } = run({ authService: makeAuthService({ authenticated: false }) });
    fb.answer({ uid: 'u1' });
    expect(await promise).toEqual({ authed: false, uid: null, answer: 'signed-in' });
    expect(endSession).not.toHaveBeenCalled();
  });

  it('never logs anyone out on a slow start: with no answer in time, the saved token decides, as before', async () => {
    const { promise, endSession, authService } = run();
    jest.advanceTimersByTime(FIRST_ANSWER_TIMEOUT_MS);
    expect(await promise).toEqual({ authed: true, uid: null, answer: 'unknown' });
    expect(endSession).not.toHaveBeenCalled();
    expect(authService.isAuthenticated).toHaveBeenCalledTimes(1);

    const none = run({ authService: makeAuthService({ token: null, authenticated: false }) });
    jest.advanceTimersByTime(FIRST_ANSWER_TIMEOUT_MS);
    expect(await none.promise).toEqual({ authed: false, uid: null, answer: 'unknown' });
    expect(none.endSession).not.toHaveBeenCalled();
  });

  it('lets the saved token decide when this build has no Firebase keys, without waiting for Firebase', async () => {
    const fb = makeListener();
    const result = await run({ fb, isFirebaseConfigured: false }).promise;
    expect(result).toEqual({ authed: true, uid: null, answer: 'unconfigured' });
    expect(fb.onAuthStateChanged).not.toHaveBeenCalled();

    const noAuth = await run({ fb, auth: null }).promise;
    expect(noAuth.answer).toBe('unconfigured');
  });
});

describe('Firebase ends a session while the app is open', () => {
  it('clears the phone, then opens the login screen, when the app still holds a saved sign-in', async () => {
    const order = [];
    const authService = makeAuthService();
    const done = await handleSignedOut({
      authService,
      endSession: async () => { order.push('end'); },
      openLogin: () => { order.push('login'); },
    });
    expect(done).toBe(true);
    expect(order).toEqual(['end', 'login']);
  });

  it('does nothing for a person who logged out themselves: the saved sign-in is already gone', async () => {
    const endSession = jest.fn();
    const openLogin = jest.fn();
    const done = await handleSignedOut({ authService: makeAuthService({ token: null }), endSession, openLogin });
    expect(done).toBe(false);
    expect(endSession).not.toHaveBeenCalled();
    expect(openLogin).not.toHaveBeenCalled();
  });

  it('opens the login screen even if clearing fails', async () => {
    const openLogin = jest.fn();
    const done = await handleSignedOut({
      authService: makeAuthService(),
      endSession: async () => { throw new Error('storage broke'); },
      openLogin,
    });
    expect(done).toBe(true);
    expect(openLogin).toHaveBeenCalledTimes(1);
  });
});
