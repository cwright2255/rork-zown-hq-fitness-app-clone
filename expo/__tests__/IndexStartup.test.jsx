// app/index.jsx decides where the app opens, and it follows Firebase's own sign-in state (services/authGate.js), not a saved token.
//   - Signed in and set up: straight to Home, with no splash.
//   - Signed in but not marked as set up on this phone: the saved profile says whether onboarding was finished. A finished profile goes
//     Home; one that was quit part way goes back to onboarding.
//   - Not signed in: the login screen (through /start), which plays the launch splash over itself (components/ZownGlitchSplash.jsx).
//     When Firebase says nobody is signed in, whatever the phone saved from an earlier sign-in is cleared first.
//   - Firebase takes a moment to restore a saved session. Until it has answered, nothing is decided, so a slow start never logs anyone out.
// The real gate (services/authGate.js) runs here; only Firebase, the saved token and the profile read are stand-ins.
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { FIRST_ANSWER_TIMEOUT_MS } from '../services/authGate';

jest.mock('expo-router', () => {
  const mockReact = require('react');
  const mockRouter = { replace: jest.fn() }; // expo-router gives the same router object every time
  return {
    Redirect: (props) => mockReact.createElement('Redirect', props),
    useLocalSearchParams: () => ({}),
    useRouter: () => mockRouter,
  };
}, { virtual: true });
jest.mock('@/store/userStore', () => {
  const completeOnboarding = (...a) => global.__completeOnboarding(...a); // one function, as in the real store
  return { useUserStore: () => ({ isOnboarded: global.__onboarded, completeOnboarding }) };
});
jest.mock('@/services/authService', () => ({
  authService: {
    isAuthenticated: (...a) => global.__isAuthenticated(...a),
    getStoredToken: (...a) => global.__getStoredToken(...a),
  },
}));
jest.mock('@/services/spotifyService', () => ({ spotifyService: { handleAuthorizationCodeCallback: jest.fn() } }));
jest.mock('@/services/profileStatus', () => ({ fetchProfileComplete: (...a) => global.__fetchProfileComplete(...a) }));
jest.mock('@/lib/logOut', () => ({ logOut: (...a) => global.__logOut(...a) }));
jest.mock('../src/config/firebase', () => ({ __esModule: true, auth: { currentUser: null }, isFirebaseConfigured: true }));
jest.mock('firebase/auth', () => ({ onAuthStateChanged: (...a) => global.__onAuthStateChanged(...a) }));
jest.mock('@/components/LoadingScreen', () => {
  const mockReact = require('react');
  return { __esModule: true, default: () => mockReact.createElement('LoadingScreen') };
});

import Index from '../app/index';

const settle = async () => { await act(async () => {}); };
const redirectTo = (utils) => {
  const found = utils.UNSAFE_queryAllByType('Redirect');
  return found.length ? found[0].props.href : null;
};
const isBlack = (utils) => {
  const blank = utils.getByTestId('launch-blank');
  const style = StyleSheet.flatten(blank.props.style);
  return style.backgroundColor === '#000000' && style.flex === 1;
};

// Firebase's listener: it calls back only when the test says Firebase has answered.
const firebaseAnswers = async (user) => {
  await act(async () => { global.__firebase.callback(user); });
};

beforeEach(() => {
  jest.useFakeTimers(); // the gate's wait for Firebase is a timer; nothing is left running when a test ends
  global.__onboarded = true;
  global.__completeOnboarding = jest.fn();
  global.__isAuthenticated = jest.fn(async () => true);
  global.__getStoredToken = jest.fn(async () => 'saved-token');
  global.__fetchProfileComplete = jest.fn(async () => true);
  global.__logOut = jest.fn(async () => undefined);
  global.__firebase = { callback: null, unsubscribed: 0 };
  global.__onAuthStateChanged = jest.fn((auth, callback) => {
    global.__firebase.callback = callback;
    return () => { global.__firebase.unsubscribed += 1; };
  });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('opening the app: waiting for Firebase', () => {
  it('shows a plain black screen, the colour of the phone\'s own launch screen, until Firebase has answered', async () => {
    const utils = render(<Index />);
    await settle();
    expect(isBlack(utils)).toBe(true);
    expect(redirectTo(utils)).toBeNull();
    expect(utils.queryByTestId('launch-splash')).toBeNull();
  });

  it('decides nothing, and clears nothing, before Firebase has restored the saved session', async () => {
    const utils = render(<Index />);
    await settle();
    expect(global.__onAuthStateChanged).toHaveBeenCalledTimes(1);
    expect(global.__logOut).not.toHaveBeenCalled();
    expect(global.__isAuthenticated).not.toHaveBeenCalled();
    expect(redirectTo(utils)).toBeNull();
  });

  it('does not log anyone out on a slow start: with no answer from Firebase it goes by the saved token, as before', async () => {
    const utils = render(<Index />);
    await settle();
    await act(async () => { jest.advanceTimersByTime(FIRST_ANSWER_TIMEOUT_MS); });
    await settle();
    expect(redirectTo(utils)).toBe('/hq');
    expect(global.__logOut).not.toHaveBeenCalled();
  });

  it('goes to the login screen on a slow start when the phone has no saved sign-in', async () => {
    global.__isAuthenticated = jest.fn(async () => false);
    const utils = render(<Index />);
    await settle();
    await act(async () => { jest.advanceTimersByTime(FIRST_ANSWER_TIMEOUT_MS); });
    await settle();
    expect(redirectTo(utils)).toBe('/start');
    expect(global.__logOut).not.toHaveBeenCalled();
  });
});

describe('opening the app: Firebase says someone is signed in', () => {
  it('sends someone who is signed in and set up straight to Home, as soon as Firebase answers and with no splash first', async () => {
    const utils = render(<Index />);
    await settle();
    expect(redirectTo(utils)).toBeNull(); // still waiting
    await firebaseAnswers({ uid: 'u1' });
    expect(redirectTo(utils)).toBe('/hq');
    expect(utils.queryByTestId('launch-splash')).toBeNull();
    expect(utils.queryByTestId('launch-blank')).toBeNull();
    expect(global.__fetchProfileComplete).not.toHaveBeenCalled(); // already set up on this phone: nothing to look up
  });

  it('asks the saved sign-in whether the "keep me signed in" window is still open, once', async () => {
    render(<Index />);
    await settle();
    await firebaseAnswers({ uid: 'u1' });
    expect(global.__isAuthenticated).toHaveBeenCalledTimes(1);
  });

  it('sends someone to the login screen when the "keep me signed in" window has run out, without clearing anything', async () => {
    global.__isAuthenticated = jest.fn(async () => false);
    const utils = render(<Index />);
    await settle();
    await firebaseAnswers({ uid: 'u1' });
    expect(redirectTo(utils)).toBe('/start');
    expect(global.__logOut).not.toHaveBeenCalled();
  });

  it('stops listening to Firebase once it has its answer', async () => {
    render(<Index />);
    await settle();
    await firebaseAnswers({ uid: 'u1' });
    expect(global.__firebase.unsubscribed).toBe(1);
  });
});

describe('opening the app: Firebase says nobody is signed in', () => {
  it('clears the saved token and sends them to the login screen (/start)', async () => {
    const utils = render(<Index />);
    await settle();
    await firebaseAnswers(null);
    expect(global.__logOut).toHaveBeenCalledTimes(1);
    expect(redirectTo(utils)).toBe('/start');
  });

  it('does so even if the phone remembers an earlier onboarding', async () => {
    global.__onboarded = true;
    const utils = render(<Index />);
    await settle();
    await firebaseAnswers(null);
    expect(redirectTo(utils)).toBe('/start');
    expect(global.__logOut).toHaveBeenCalledTimes(1);
  });

  it('has nothing to clear when the phone holds no saved sign-in', async () => {
    global.__getStoredToken = jest.fn(async () => null);
    global.__isAuthenticated = jest.fn(async () => false);
    const utils = render(<Index />);
    await settle();
    await firebaseAnswers(null);
    expect(global.__logOut).not.toHaveBeenCalled();
    expect(redirectTo(utils)).toBe('/start');
  });

  it('still opens the login screen if clearing the phone fails', async () => {
    global.__logOut = jest.fn(async () => { throw new Error('storage broke'); });
    const utils = render(<Index />);
    await settle();
    await firebaseAnswers(null);
    expect(redirectTo(utils)).toBe('/start');
  });
});

describe('opening the app: signed in, but not marked as set up on this phone', () => {
  beforeEach(() => { global.__onboarded = false; });

  it('sends someone whose saved profile was never finished back to onboarding, and does not mark them set up', async () => {
    global.__fetchProfileComplete = jest.fn(async () => false);
    const utils = render(<Index />);
    await settle();
    await firebaseAnswers({ uid: 'u1' });
    expect(global.__fetchProfileComplete).toHaveBeenCalledWith('u1');
    expect(redirectTo(utils)).toBe('/onboarding');
    expect(global.__completeOnboarding).not.toHaveBeenCalled();
  });

  it('sends someone whose saved profile is finished Home, and marks them set up on this phone', async () => {
    global.__fetchProfileComplete = jest.fn(async () => true);
    const utils = render(<Index />);
    await settle();
    await firebaseAnswers({ uid: 'u1' });
    expect(redirectTo(utils)).toBe('/hq');
    expect(global.__completeOnboarding).toHaveBeenCalledTimes(1);
  });

  it('keeps the black screen while the saved profile is being read', async () => {
    global.__fetchProfileComplete = jest.fn(() => new Promise(() => {}));
    const utils = render(<Index />);
    await settle();
    await firebaseAnswers({ uid: 'u1' });
    expect(isBlack(utils)).toBe(true);
    expect(redirectTo(utils)).toBeNull();
  });

  it('keeps sending someone to /start, as before, when the saved profile cannot be read', async () => {
    global.__fetchProfileComplete = jest.fn(async () => null);
    const utils = render(<Index />);
    await settle();
    await firebaseAnswers({ uid: 'u1' });
    expect(redirectTo(utils)).toBe('/start');
    expect(global.__completeOnboarding).not.toHaveBeenCalled();
  });

  it('does not look anything up for someone the gate let in without a Firebase answer (a slow start): there is no id to look up', async () => {
    const utils = render(<Index />);
    await settle();
    await act(async () => { jest.advanceTimersByTime(FIRST_ANSWER_TIMEOUT_MS); });
    await settle();
    expect(global.__fetchProfileComplete).not.toHaveBeenCalled();
    expect(redirectTo(utils)).toBe('/start'); // as before: signed in by the saved token but not marked as set up
    expect(global.__completeOnboarding).not.toHaveBeenCalled();
  });

  it('reads the saved profile once', async () => {
    global.__fetchProfileComplete = jest.fn(async () => false);
    render(<Index />);
    await settle();
    await firebaseAnswers({ uid: 'u1' });
    await settle();
    expect(global.__fetchProfileComplete).toHaveBeenCalledTimes(1);
  });

  it('does not read a profile for someone who is not signed in', async () => {
    const utils = render(<Index />);
    await settle();
    await firebaseAnswers(null);
    expect(global.__fetchProfileComplete).not.toHaveBeenCalled();
    expect(redirectTo(utils)).toBe('/start');
  });
});

describe('opening the app: something goes wrong', () => {
  it('treats a sign-in check that fails as not signed in', async () => {
    global.__isAuthenticated = jest.fn(async () => { throw new Error('storage broke'); });
    const utils = render(<Index />);
    await settle();
    await firebaseAnswers({ uid: 'u1' });
    expect(redirectTo(utils)).toBe('/start');
  });

  it('treats a Firebase that cannot be listened to as no answer, and goes by the saved token', async () => {
    global.__onAuthStateChanged = jest.fn(() => { throw new Error('no auth'); });
    const utils = render(<Index />);
    await settle();
    expect(redirectTo(utils)).toBe('/hq');
    expect(global.__logOut).not.toHaveBeenCalled();
  });
});
