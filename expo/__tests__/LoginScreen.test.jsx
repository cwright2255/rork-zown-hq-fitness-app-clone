import React from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { Polygon } from 'react-native-svg';
import { act, fireEvent, render } from '@testing-library/react-native';
import { loginLayout } from '../lib/loginLayout';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons', FontAwesome6: 'FontAwesome6' }), { virtual: true });
jest.mock('expo-apple-authentication', () => {
  const mockReact = require('react');
  return {
    isAvailableAsync: () => global.__appleAvailable(),
    AppleAuthenticationButton: (props) => mockReact.createElement('AppleAuthenticationButton', props),
    AppleAuthenticationButtonType: { SIGN_IN: 0 },
    AppleAuthenticationButtonStyle: { WHITE_OUTLINE: 2 },
  };
}, { virtual: true });
jest.mock('expo-router', () => {
  const mockReact = require('react');
  return {
    router: { push: jest.fn(), replace: jest.fn() },
    Stack: { Screen: () => mockReact.createElement(mockReact.Fragment) },
  };
}, { virtual: true });
jest.mock('@/store/userStore', () => {
  const hook = () => ({ setUser: (...a) => global.__setUser(...a) });
  hook.getState = () => ({ completeOnboarding: (...a) => global.__completeOnboarding(...a) });
  return { useUserStore: hook };
});
jest.mock('@/services/authService', () => ({
  authService: {
    login: (...a) => global.__login(...a),
    loginWithProvider: (...a) => global.__loginWithProvider(...a),
  },
}));

import LoginScreen from '../app/auth/login';

const { router } = require('expo-router');

const typeInto = (utils, placeholder, text) => fireEvent.changeText(utils.getByPlaceholderText(placeholder), text);
const submit = async (utils) => { await act(async () => { fireEvent.press(utils.getByText('Enter')); }); };
const renderScreen = async () => {
  const utils = render(<LoginScreen />);
  await act(async () => {}); // lets the check for Sign in with Apple finish
  return utils;
};
const tap = async (utils, testID) => { await act(async () => { fireEvent.press(utils.getByTestId(testID)); }); };

beforeEach(() => {
  router.push.mockClear();
  router.replace.mockClear();
  global.__setUser = jest.fn();
  global.__completeOnboarding = jest.fn();
  global.__login = jest.fn(async () => ({ user: { uid: 'u1' } }));
  global.__loginWithProvider = jest.fn(async () => ({ user: { uid: 'p1' }, isNewUser: false }));
  global.__appleAvailable = jest.fn(async () => true);
});

describe('Login screen', () => {
  it('offers email and password sign-in, a way to reset the password and a way to sign up', async () => {
    const utils = await renderScreen();
    expect(utils.getByPlaceholderText('Email')).toBeTruthy();
    expect(utils.getByPlaceholderText('Password')).toBeTruthy();
    expect(utils.getByText('Enter')).toBeTruthy();
    fireEvent.press(utils.getByText('Forgot Password?'));
    expect(router.push).toHaveBeenCalledWith('/auth/forgot-password');
    fireEvent.press(utils.getByText('Sign Up'));
    expect(router.push).toHaveBeenCalledWith('/auth/register');
  });

  it('asks for the email first, then the password', async () => {
    const utils = await renderScreen();
    await submit(utils);
    expect(utils.getByText('Please enter your email')).toBeTruthy();
    typeInto(utils, 'Email', 'cj@example.com');
    await submit(utils);
    expect(utils.getByText('Please enter your password')).toBeTruthy();
    expect(global.__login).not.toHaveBeenCalled();
  });

  it('signs in with the email trimmed, then opens the home screen', async () => {
    const utils = await renderScreen();
    typeInto(utils, 'Email', '  cj@example.com ');
    typeInto(utils, 'Password', 'secret1');
    await submit(utils);
    expect(global.__login).toHaveBeenCalledWith('cj@example.com', 'secret1');
    expect(global.__setUser).toHaveBeenCalledWith({ uid: 'u1' });
    expect(global.__completeOnboarding).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/hq');
  });

  it.each([
    ['auth/invalid-credential', 'Invalid email or password'],
    ['auth/wrong-password', 'Invalid email or password'],
    ['auth/user-not-found', 'Invalid email or password'],
    ['auth/too-many-requests', 'Too many attempts. Try again later.'],
    ['auth/network-request-failed', 'Network error. Check your connection.'],
    ['something odd happened', 'something odd happened'],
  ])('says what went wrong when sign-in fails with %s', async (code, shown) => {
    global.__login = jest.fn(async () => { throw new Error(code); });
    const utils = await renderScreen();
    typeInto(utils, 'Email', 'cj@example.com');
    typeInto(utils, 'Password', 'secret1');
    await submit(utils);
    expect(utils.getByText(shown)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('says so when sign-in gives no user', async () => {
    global.__login = jest.fn(async () => ({}));
    const utils = await renderScreen();
    typeInto(utils, 'Email', 'cj@example.com');
    typeInto(utils, 'Password', 'secret1');
    await submit(utils);
    expect(utils.getByText('Login failed. Please try again.')).toBeTruthy();
  });
});

describe('Login screen look', () => {
  it('is white above the line and black below it, at the angle in lib/loginLayout.js', async () => {
    const utils = await renderScreen();
    const polygon = utils.UNSAFE_getByType(Polygon);
    expect(polygon.props.points).toBe(loginLayout(Dimensions.get('window').width).whitePoints);
    expect(polygon.props.fill).toBe('#FFFFFF');
    expect(utils.getByTestId('login-header')).toBeTruthy();
  });

  it('shows the wordmark and the white tagline', async () => {
    const utils = await renderScreen();
    expect(utils.getByTestId('login-logo')).toBeTruthy();
    for (const line of ['OWN THE', 'DAY']) {
      const style = StyleSheet.flatten(utils.getByText(line).props.style);
      expect(style.color).toBe('#FFFFFF');
      expect(style.textAlign).toBe('right');
    }
  });
});

describe('Login screen: Apple, Google and Meta', () => {
  it('offers Google, Meta and Sign in with Apple, and nothing that says it is coming', async () => {
    const utils = await renderScreen();
    expect(utils.getByTestId('login-apple')).toBeTruthy();
    expect(utils.getByText('Google')).toBeTruthy();
    expect(utils.getByText('Meta')).toBeTruthy();
    expect(utils.getByLabelText('Sign in with Google')).toBeTruthy();
    expect(utils.getByLabelText('Sign in with Meta')).toBeTruthy();
    expect(utils.queryByText(/coming soon/i)).toBeNull();
  });

  it('leaves out Sign in with Apple on a phone that cannot do it, and keeps the rest', async () => {
    global.__appleAvailable = jest.fn(async () => false);
    const utils = await renderScreen();
    expect(utils.queryByTestId('login-apple')).toBeNull();
    expect(utils.getByTestId('login-google')).toBeTruthy();
    expect(utils.getByTestId('login-meta')).toBeTruthy();
  });

  it('leaves out Sign in with Apple when the check fails', async () => {
    global.__appleAvailable = jest.fn(async () => { throw new Error('no'); });
    const utils = await renderScreen();
    expect(utils.queryByTestId('login-apple')).toBeNull();
  });

  it.each([
    ['login-apple', 'apple'],
    ['login-google', 'google'],
    ['login-meta', 'meta'],
  ])('%s signs in with the %s provider and opens the home screen for an account that existed', async (testID, provider) => {
    const utils = await renderScreen();
    await tap(utils, testID);
    expect(global.__loginWithProvider).toHaveBeenCalledWith(provider);
    expect(global.__setUser).toHaveBeenCalledWith({ uid: 'p1' });
    expect(global.__completeOnboarding).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/hq');
  });

  it.each([['login-apple'], ['login-google'], ['login-meta']])('%s sends a new account to onboarding', async (testID) => {
    global.__loginWithProvider = jest.fn(async () => ({ user: { uid: 'new1' }, isNewUser: true }));
    const utils = await renderScreen();
    await tap(utils, testID);
    expect(global.__setUser).toHaveBeenCalledWith({ uid: 'new1' });
    expect(router.replace).toHaveBeenCalledWith('/onboarding');
    expect(router.replace).not.toHaveBeenCalledWith('/hq');
    expect(global.__completeOnboarding).not.toHaveBeenCalled();
  });

  it('says nothing, and goes nowhere, when the person closes the sign-in', async () => {
    global.__loginWithProvider = jest.fn(async () => { throw Object.assign(new Error('Sign-in was cancelled.'), { code: 'cancelled' }); });
    const utils = await renderScreen();
    await tap(utils, 'login-google');
    expect(utils.queryByText('Sign-in was cancelled.')).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
    expect(global.__setUser).not.toHaveBeenCalled();
    // and the button works again
    await tap(utils, 'login-google');
    expect(global.__loginWithProvider).toHaveBeenCalledTimes(2);
  });

  it('shows what went wrong', async () => {
    global.__loginWithProvider = jest.fn(async () => { throw Object.assign(new Error("Google sign-in isn't set up yet."), { code: 'not-configured' }); });
    const utils = await renderScreen();
    await tap(utils, 'login-google');
    expect(utils.getByText("Google sign-in isn't set up yet.")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('shows a plain message when the error has none', async () => {
    global.__loginWithProvider = jest.fn(async () => { throw new Error(''); });
    const utils = await renderScreen();
    await tap(utils, 'login-meta');
    expect(utils.getByText('Sign-in failed. Please try again.')).toBeTruthy();
  });

  it('says so when sign-in gives no user', async () => {
    global.__loginWithProvider = jest.fn(async () => ({}));
    const utils = await renderScreen();
    await tap(utils, 'login-apple');
    expect(utils.getByText('Sign-in failed. Please try again.')).toBeTruthy();
    expect(global.__setUser).not.toHaveBeenCalled();
  });

  it('clears an old message when another sign-in starts', async () => {
    global.__loginWithProvider = jest.fn()
      .mockRejectedValueOnce(new Error('first problem'))
      .mockResolvedValueOnce({ user: { uid: 'p1' }, isNewUser: false });
    const utils = await renderScreen();
    await tap(utils, 'login-google');
    expect(utils.getByText('first problem')).toBeTruthy();
    await tap(utils, 'login-meta');
    expect(utils.queryByText('first problem')).toBeNull();
  });

  it('starts one sign-in when a button is tapped twice in the same moment', async () => {
    let finish;
    global.__loginWithProvider = jest.fn(() => new Promise((resolve) => { finish = resolve; }));
    const utils = await renderScreen();
    await act(async () => {
      fireEvent.press(utils.getByTestId('login-google'));
      fireEvent.press(utils.getByTestId('login-google'));
      fireEvent.press(utils.getByTestId('login-meta'));
    });
    expect(global.__loginWithProvider).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ user: { uid: 'p1' }, isNewUser: false }); });
  });

  it('starts only one sign-in at a time, and keeps email sign-in out of the way while it is open', async () => {
    let finish;
    global.__loginWithProvider = jest.fn(() => new Promise((resolve) => { finish = resolve; }));
    const utils = await renderScreen();
    typeInto(utils, 'Email', 'cj@example.com');
    typeInto(utils, 'Password', 'secret1');

    await tap(utils, 'login-google');
    await tap(utils, 'login-meta');
    await tap(utils, 'login-apple');
    await submit(utils);
    expect(global.__loginWithProvider).toHaveBeenCalledTimes(1);
    expect(global.__loginWithProvider).toHaveBeenCalledWith('google');
    expect(global.__login).not.toHaveBeenCalled();

    await act(async () => { finish({ user: { uid: 'p1' }, isNewUser: false }); });
    expect(router.replace).toHaveBeenCalledWith('/hq');
    // free again afterwards
    global.__loginWithProvider = jest.fn(async () => ({ user: { uid: 'p2' }, isNewUser: false }));
    await tap(utils, 'login-meta');
    expect(global.__loginWithProvider).toHaveBeenCalledWith('meta');
  });
});
