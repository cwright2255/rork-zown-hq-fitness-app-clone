// What VoiceOver says for the icon buttons on the sign-up screen (app/auth/register.jsx), on the rendered screen: the Back arrow, and the
// two eyes that show or hide a password, whose label has to follow what they will do next. That every icon-only button has a label at
// all is checked from the source in iconButtonLabels.test.js; what VoiceOver really says is checked on the phone.
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

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
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ setUser: jest.fn() }) }));
jest.mock('@/services/authService', () => ({ authService: { register: jest.fn() } }));

import RegisterScreen from '../app/auth/register';

const button = (utils, name) => utils.getByRole('button', { name });

describe('the sign-up screen', () => {
  it('has a Back arrow found as a button', () => {
    const utils = render(<RegisterScreen />);
    expect(button(utils, 'Back')).toBeTruthy();
  });

  it('has an eye on the password that says Show password, and Hide password once it is showing', () => {
    const utils = render(<RegisterScreen />);
    expect(utils.getByPlaceholderText('Password').props.secureTextEntry).toBe(true);
    fireEvent.press(button(utils, 'Show password'));
    expect(utils.getByPlaceholderText('Password').props.secureTextEntry).toBe(false);
    expect(utils.queryByRole('button', { name: 'Show password' })).toBeNull();
    fireEvent.press(button(utils, 'Hide password'));
    expect(utils.getByPlaceholderText('Password').props.secureTextEntry).toBe(true);
  });

  it('has its own eye on the confirmation that works on its own', () => {
    const utils = render(<RegisterScreen />);
    fireEvent.press(button(utils, 'Show confirm password'));
    expect(utils.getByPlaceholderText('Confirm Password').props.secureTextEntry).toBe(false);
    expect(utils.getByPlaceholderText('Password').props.secureTextEntry).toBe(true);
    expect(button(utils, 'Hide confirm password')).toBeTruthy();
    expect(button(utils, 'Show password')).toBeTruthy();
  });
});
