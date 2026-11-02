// The Terms step at the end of sign-up (app/auth/register.jsx): people accept the Terms and Privacy Policy before an account is made, and
// the no-tolerance line is there to read, with both documents opening from it.
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => (name === '__esModule' ? false : name) }), { virtual: true });
jest.mock('expo-router', () => {
  const mockReact = require('react');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
    Stack: { Screen: () => mockReact.createElement(mockReact.Fragment) },
  };
}, { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ setUser: (...a) => global.__setUser(...a) }) }));
jest.mock('@/services/authService', () => ({ authService: { register: (...a) => global.__register(...a) } }));

import { router } from 'expo-router';
import RegisterScreen from '../app/auth/register';
import { NO_TOLERANCE_LINE } from '../lib/moderation';

const settle = () => act(async () => {});
const tap = async (utils, text) => { await act(async () => { fireEvent.press(utils.getByText(text)); }); };

/** Gets through the first two steps to the last one. */
async function toLastStep() {
  const utils = render(<RegisterScreen />);
  fireEvent.changeText(utils.getByPlaceholderText('Full Name'), 'Cj Wright');
  fireEvent.changeText(utils.getByPlaceholderText('Email'), 'cj@example.com');
  fireEvent.changeText(utils.getByPlaceholderText('Password'), 'longenough1');
  fireEvent.changeText(utils.getByPlaceholderText('Confirm Password'), 'longenough1');
  await tap(utils, 'Continue');
  await tap(utils, 'Build Muscle');
  await tap(utils, 'Continue');
  return utils;
}
const checked = (utils) => utils.getByTestId('termsCheckbox').props.accessibilityState.checked;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  global.__setUser = jest.fn();
  global.__register = jest.fn(async () => ({ user: { uid: 'u1', name: 'Cj Wright' } }));
});
afterEach(() => { Alert.alert.mockRestore(); console.error.mockRestore(); });

describe('the first two steps', () => {
  it('do not ask about the Terms yet', async () => {
    const utils = render(<RegisterScreen />);
    expect(utils.queryByTestId('termsCheckbox')).toBeNull();
    fireEvent.changeText(utils.getByPlaceholderText('Full Name'), 'Cj Wright');
    fireEvent.changeText(utils.getByPlaceholderText('Email'), 'cj@example.com');
    fireEvent.changeText(utils.getByPlaceholderText('Password'), 'longenough1');
    fireEvent.changeText(utils.getByPlaceholderText('Confirm Password'), 'longenough1');
    await tap(utils, 'Continue');
    expect(utils.getByText("What's your goal?")).toBeTruthy();
    expect(utils.queryByTestId('termsCheckbox')).toBeNull();
    expect(utils.queryByText(NO_TOLERANCE_LINE)).toBeNull();
  });
});

describe('the last step', () => {
  it('has an unchecked box to agree to the Terms of Service and Privacy Policy', async () => {
    const utils = await toLastStep();
    expect(utils.getByText('Your activity level')).toBeTruthy();
    expect(utils.getByRole('checkbox')).toBeTruthy();
    expect(utils.getByLabelText('I agree to the Terms of Service and Privacy Policy')).toBeTruthy();
    expect(utils.getByText('Terms of Service')).toBeTruthy();
    expect(utils.getByText('Privacy Policy')).toBeTruthy();
    expect(checked(utils)).toBe(false);
  });

  it('says there is no tolerance for objectionable content or abusive users, with the same words as the Terms', async () => {
    const utils = await toLastStep();
    expect(utils.getByText(NO_TOLERANCE_LINE)).toBeTruthy();
    expect(NO_TOLERANCE_LINE).toMatch(/no tolerance for objectionable content or abusive users/);
  });

  it('opens the Terms of Service from the line, without ticking the box', async () => {
    const utils = await toLastStep();
    await tap(utils, 'Terms of Service');
    expect(router.push).toHaveBeenCalledWith('/profile/terms');
    expect(checked(utils)).toBe(false);
  });

  it('opens the Privacy Policy from the line, without ticking the box', async () => {
    const utils = await toLastStep();
    await tap(utils, 'Privacy Policy');
    expect(router.push).toHaveBeenCalledWith('/profile/privacy-policy');
    expect(checked(utils)).toBe(false);
  });

  it('ticks and unticks the box', async () => {
    const utils = await toLastStep();
    await act(async () => { fireEvent.press(utils.getByTestId('termsCheckbox')); });
    expect(checked(utils)).toBe(true);
    await act(async () => { fireEvent.press(utils.getByTestId('termsCheckbox')); });
    expect(checked(utils)).toBe(false);
  });
});

describe('Create Account', () => {
  it('asks for a level first, as it always did', async () => {
    const utils = await toLastStep();
    await tap(utils, 'Create Account');
    expect(Alert.alert).toHaveBeenCalledWith('Select activity level', 'Choose your current level');
    expect(global.__register).not.toHaveBeenCalled();
  });

  it('does not make an account until the Terms are agreed to, and says why', async () => {
    const utils = await toLastStep();
    await tap(utils, 'Beginner');
    await tap(utils, 'Create Account');
    expect(Alert.alert).toHaveBeenCalledWith('Agree to continue', 'Please agree to the Terms of Service and Privacy Policy to create your account.');
    expect(global.__register).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('does not make an account after agreeing and then taking it back', async () => {
    const utils = await toLastStep();
    await tap(utils, 'Beginner');
    await act(async () => { fireEvent.press(utils.getByTestId('termsCheckbox')); });
    await act(async () => { fireEvent.press(utils.getByTestId('termsCheckbox')); });
    await tap(utils, 'Create Account');
    expect(global.__register).not.toHaveBeenCalled();
  });

  it('makes the account once they have agreed, and goes on to set up', async () => {
    const utils = await toLastStep();
    await tap(utils, 'Beginner');
    await act(async () => { fireEvent.press(utils.getByTestId('termsCheckbox')); });
    await tap(utils, 'Create Account');
    await settle();
    expect(global.__register).toHaveBeenCalledWith('Cj Wright', 'cj@example.com', 'longenough1');
    expect(global.__setUser).toHaveBeenCalledWith(expect.objectContaining({ uid: 'u1', goal: 'muscle', activityLevel: 'beginner' }));
    expect(router.replace).toHaveBeenCalledWith('/onboarding');
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('tells them when the account could not be made, and stays', async () => {
    global.__register.mockRejectedValue(new Error('That email is already in use'));
    const utils = await toLastStep();
    await tap(utils, 'Beginner');
    await act(async () => { fireEvent.press(utils.getByTestId('termsCheckbox')); });
    await tap(utils, 'Create Account');
    await settle();
    expect(Alert.alert).toHaveBeenCalledWith('Registration Failed', 'That email is already in use');
    expect(router.replace).not.toHaveBeenCalled();
  });
});
