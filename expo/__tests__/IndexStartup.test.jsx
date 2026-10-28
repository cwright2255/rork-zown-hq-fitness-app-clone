// app/index.jsx decides where the app opens. Someone who is signed in goes straight to Home, with no splash. Everyone else goes
// to the login screen (through /start), which plays the launch splash over itself (components/ZownGlitchSplash.jsx).
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, render } from '@testing-library/react-native';

jest.mock('expo-router', () => {
  const mockReact = require('react');
  const mockRouter = { replace: jest.fn() }; // expo-router gives the same router object every time
  return {
    Redirect: (props) => mockReact.createElement('Redirect', props),
    useLocalSearchParams: () => ({}),
    useRouter: () => mockRouter,
  };
}, { virtual: true });
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ isOnboarded: global.__onboarded }) }));
jest.mock('@/services/authService', () => ({ authService: { isAuthenticated: (...a) => global.__isAuthenticated(...a) } }));
jest.mock('@/services/spotifyService', () => ({ spotifyService: { handleAuthorizationCodeCallback: jest.fn() } }));
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

beforeEach(() => {
  global.__onboarded = true;
  global.__isAuthenticated = jest.fn(async () => true);
});

describe('opening the app', () => {
  it('shows a plain black screen, the colour of the phone\'s own launch screen, while it checks who is signed in', async () => {
    global.__isAuthenticated = jest.fn(() => new Promise(() => {}));
    const utils = render(<Index />);
    await settle();
    const blank = utils.getByTestId('launch-blank');
    expect(StyleSheet.flatten(blank.props.style).backgroundColor).toBe('#000000');
    expect(StyleSheet.flatten(blank.props.style).flex).toBe(1);
    expect(redirectTo(utils)).toBeNull();
    expect(utils.queryByTestId('launch-splash')).toBeNull();
  });

  it('sends someone who is signed in and set up straight to Home, as soon as the check is done and with no splash first', async () => {
    const utils = render(<Index />);
    expect(redirectTo(utils)).toBeNull(); // still checking
    await settle(); // one turn of the event loop: no timer is waited for
    expect(redirectTo(utils)).toBe('/hq');
    expect(utils.queryByTestId('launch-splash')).toBeNull();
    expect(utils.queryByTestId('launch-blank')).toBeNull();
  });

  it('sends someone who is not signed in to the login screen (/start)', async () => {
    global.__isAuthenticated = jest.fn(async () => false);
    const utils = render(<Index />);
    await settle();
    expect(redirectTo(utils)).toBe('/start');
  });

  it('sends someone who is not signed in to the login screen even if the phone remembers an earlier onboarding', async () => {
    global.__isAuthenticated = jest.fn(async () => false);
    global.__onboarded = true;
    const utils = render(<Index />);
    await settle();
    expect(redirectTo(utils)).toBe('/start');
  });

  it('keeps sending someone who is signed in but not set up yet to /start, as before', async () => {
    global.__onboarded = false;
    const utils = render(<Index />);
    await settle();
    expect(redirectTo(utils)).toBe('/start');
  });

  it('treats a sign-in check that fails as not signed in', async () => {
    global.__isAuthenticated = jest.fn(async () => { throw new Error('storage broke'); });
    const utils = render(<Index />);
    await settle();
    expect(redirectTo(utils)).toBe('/start');
  });

  it('asks who is signed in once', async () => {
    const utils = render(<Index />);
    await settle();
    expect(redirectTo(utils)).toBe('/hq');
    expect(global.__isAuthenticated).toHaveBeenCalledTimes(1);
  });
});
