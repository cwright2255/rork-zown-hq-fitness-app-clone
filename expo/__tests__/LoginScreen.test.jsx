import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
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
  authService: { login: (...a) => global.__login(...a) },
}));

import LoginScreen from '../app/auth/login';

const { router } = require('expo-router');

const typeInto = (utils, placeholder, text) => fireEvent.changeText(utils.getByPlaceholderText(placeholder), text);
const submit = async (utils) => { await act(async () => { fireEvent.press(utils.getByText('Enter')); }); };

beforeEach(() => {
  router.push.mockClear();
  router.replace.mockClear();
  global.__setUser = jest.fn();
  global.__completeOnboarding = jest.fn();
  global.__login = jest.fn(async () => ({ user: { uid: 'u1' } }));
});

describe('Login screen', () => {
  it('offers email and password sign-in, a way to reset the password and a way to sign up', () => {
    const utils = render(<LoginScreen />);
    expect(utils.getByPlaceholderText('Email')).toBeTruthy();
    expect(utils.getByPlaceholderText('Password')).toBeTruthy();
    expect(utils.getByText('Enter')).toBeTruthy();
    fireEvent.press(utils.getByText('Forgot Password?'));
    expect(router.push).toHaveBeenCalledWith('/auth/forgot-password');
    fireEvent.press(utils.getByText('Sign Up'));
    expect(router.push).toHaveBeenCalledWith('/auth/register');
  });

  it('has no sign-in buttons for services that are not built yet', () => {
    const utils = render(<LoginScreen />);
    expect(utils.queryByText('Google')).toBeNull();
    expect(utils.queryByText('Meta')).toBeNull();
    expect(utils.queryByText(/coming soon/i)).toBeNull();
  });

  it('asks for the email first, then the password', async () => {
    const utils = render(<LoginScreen />);
    await submit(utils);
    expect(utils.getByText('Please enter your email')).toBeTruthy();
    typeInto(utils, 'Email', 'cj@example.com');
    await submit(utils);
    expect(utils.getByText('Please enter your password')).toBeTruthy();
    expect(global.__login).not.toHaveBeenCalled();
  });

  it('signs in with the email trimmed, then opens the home screen', async () => {
    const utils = render(<LoginScreen />);
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
    const utils = render(<LoginScreen />);
    typeInto(utils, 'Email', 'cj@example.com');
    typeInto(utils, 'Password', 'secret1');
    await submit(utils);
    expect(utils.getByText(shown)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('says so when sign-in gives no user', async () => {
    global.__login = jest.fn(async () => ({}));
    const utils = render(<LoginScreen />);
    typeInto(utils, 'Email', 'cj@example.com');
    typeInto(utils, 'Password', 'secret1');
    await submit(utils);
    expect(utils.getByText('Login failed. Please try again.')).toBeTruthy();
  });
});
