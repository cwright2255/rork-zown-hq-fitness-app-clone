// A screen behind a plan (components/PaywallGate.jsx): the screen for a plan that includes it, the lock for one that does not, and a
// spinner while the phone is still finding out which plan the person has.
import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn() } }), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));

import { router } from 'expo-router';
import PaywallGate from '../components/PaywallGate';
import { useEntitlementStore } from '../store/entitlementStore';

const plan = (over = {}) => ({ tier: 'pro', status: 'active', expiresAt: null, source: 'manual', ...over });
const setStore = (state) => act(() => { useEntitlementStore.setState({ plan: null, isLoaded: false, ...state }); });
const show = (feature) => render(<PaywallGate feature={feature}><Text>THE SCREEN</Text></PaywallGate>);
const textOf = (utils) => utils.UNSAFE_getAllByType(Text).map((n) => [].concat(n.props.children).join(''));

beforeEach(() => {
  jest.clearAllMocks();
  router.canGoBack.mockReturnValue(true);
});

describe('a person whose plan includes the feature', () => {
  it('sees the screen, with no lock', () => {
    setStore({ plan: plan(), isLoaded: true });
    const utils = show('analytics');
    expect(utils.getByText('THE SCREEN')).toBeTruthy();
    expect(utils.queryByTestId('gate-locked')).toBeNull();
  });

  it('is a Legend person for a Legend feature', () => {
    setStore({ plan: plan({ tier: 'legend' }), isLoaded: true });
    expect(show('bodyScan').getByText('THE SCREEN')).toBeTruthy();
  });

  it('is a Legend person for a Pro feature too', () => {
    setStore({ plan: plan({ tier: 'legend' }), isLoaded: true });
    expect(show('analytics').getByText('THE SCREEN')).toBeTruthy();
  });

  it('sees a screen that is not locked at all, whatever the plan', () => {
    setStore({ isLoaded: true });
    expect(show('notLocked').getByText('THE SCREEN')).toBeTruthy();
  });
});

describe('a person whose plan does not', () => {
  it('sees the lock instead of the screen: what is locked, and which plan it is part of', () => {
    setStore({ isLoaded: true });
    const utils = show('analytics');
    expect(utils.queryByText('THE SCREEN')).toBeNull();
    expect(utils.getByTestId('gate-locked')).toBeTruthy();
    const lines = textOf(utils);
    expect(lines).toContain('Analytics is part of Pro');
    expect(lines).toContain('Upgrade to Pro to unlock it.');
  });

  it('is told Legend, not Pro, for the body scan, even with Pro', () => {
    setStore({ plan: plan(), isLoaded: true });
    const lines = textOf(show('bodyScan'));
    expect(lines).toContain('Body scan and 3D body is part of Legend');
    expect(lines).toContain('Upgrade to Legend to unlock it.');
  });

  it('is locked out when the plan has ended', () => {
    setStore({ plan: plan({ status: 'expired' }), isLoaded: true });
    expect(show('analytics').getByTestId('gate-locked')).toBeTruthy();
  });

  it('can open the plans, with the feature it wanted, from the lock', () => {
    setStore({ isLoaded: true });
    fireEvent.press(show('analytics').getByTestId('gate-see-plans'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/paywall', params: { feature: 'analytics' } });
  });

  it('can go back from the lock, from the arrow or from "Not now"', () => {
    setStore({ isLoaded: true });
    const utils = show('analytics');
    fireEvent.press(utils.getByTestId('gate-back'));
    fireEvent.press(utils.getByTestId('gate-not-now'));
    expect(router.back).toHaveBeenCalledTimes(2);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('labels the back arrow for screen readers', () => {
    setStore({ isLoaded: true });
    expect(show('analytics').getByLabelText('Go back')).toBeTruthy();
  });

  it('goes home when there is nothing to go back to', () => {
    router.canGoBack.mockReturnValue(false);
    setStore({ isLoaded: true });
    fireEvent.press(show('analytics').getByTestId('gate-not-now'));
    expect(router.replace).toHaveBeenCalledWith('/hq');
    expect(router.back).not.toHaveBeenCalled();
  });
});

describe('while the phone is finding out the plan', () => {
  it('shows a spinner, never the lock, so a Pro person does not see it flash up', () => {
    setStore({});
    const utils = show('analytics');
    expect(utils.getByTestId('gate-loading')).toBeTruthy();
    expect(utils.queryByTestId('gate-locked')).toBeNull();
    expect(utils.queryByText('THE SCREEN')).toBeNull();
  });

  it('swaps the spinner for the screen when the plan turns out to include it', () => {
    setStore({});
    const utils = show('analytics');
    setStore({ plan: plan(), isLoaded: true });
    expect(utils.getByText('THE SCREEN')).toBeTruthy();
    expect(utils.queryByTestId('gate-loading')).toBeNull();
  });
});
