// The plans screen (app/paywall.jsx): the three plans with what each includes, which one the person has, and the buttons to move up.
// Until purchases are connected the buttons say "Coming soon" and do nothing.
import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn() },
  useLocalSearchParams: () => global.__params,
}), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('../services/purchases', () => ({
  get PURCHASES_ENABLED() { return global.__purchasesOn; },
  purchasePlan: (...args) => global.__purchasePlan(...args),
}));
jest.mock('../src/services/analytics', () => ({
  ...jest.requireActual('../src/services/analytics'),
  logPaywallViewed: (...args) => global.__logPaywallViewed(...args),
}));
jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));

import { router } from 'expo-router';
import PaywallScreen from '../app/paywall';
import { useEntitlementStore } from '../store/entitlementStore';

const plan = (tier) => ({ tier, status: 'active', expiresAt: null, source: 'manual' });
const as = (tier) => act(() => { useEntitlementStore.setState({ plan: tier === 'free' ? null : plan(tier), isLoaded: true }); });
const textIn = (utils, testID) => utils.getByTestId(testID).findAll((n) => n.type === 'Text').map((n) => [].concat(n.props.children).join(''));
// The Pressable itself, so its onPress can be called the way the phone would, without the disabled switch standing in the way.
const pressableOf = (utils, testID) => {
  let node = utils.getByTestId(testID);
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  return node;
};
const settle = () => act(async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); });

beforeEach(() => {
  jest.clearAllMocks();
  global.__params = {};
  global.__purchasesOn = false;
  global.__purchasePlan = jest.fn(async () => ({ ok: true }));
  global.__logPaywallViewed = jest.fn();
  router.canGoBack.mockReturnValue(true);
  as('free');
});
afterEach(() => { delete global.__params; delete global.__purchasesOn; delete global.__purchasePlan; delete global.__logPaywallViewed; });

describe('the three plans', () => {
  it('shows Free, Pro and Legend, each with what it includes', () => {
    const utils = render(<PaywallScreen />);
    expect(textIn(utils, 'plan-free')).toEqual(expect.arrayContaining(['Free', 'Log workouts, runs, hikes and meals', '5 Coach messages a day']));
    expect(textIn(utils, 'plan-pro')).toEqual(expect.arrayContaining(['Pro', 'Everything in Free', '100 Coach messages a day', 'AI workout plans', 'Analytics']));
    expect(textIn(utils, 'plan-legend')).toEqual(expect.arrayContaining(['Legend', 'Everything in Pro', '300 Coach messages a day', 'Body scan and 3D body']));
  });

  it('lists a feature under its own plan only', () => {
    const utils = render(<PaywallScreen />);
    expect(textIn(utils, 'plan-pro')).not.toContain('Body scan and 3D body');
    expect(textIn(utils, 'plan-free')).not.toContain('Analytics');
  });

  it.each([['free', 'Free'], ['pro', 'Pro'], ['legend', 'Legend']])('marks the plan a %s person has as theirs, and no other', (tier) => {
    as(tier);
    const utils = render(<PaywallScreen />);
    for (const other of ['free', 'pro', 'legend']) {
      expect(!!utils.queryByTestId(`plan-${other}-current`)).toBe(other === tier);
    }
  });

  it('treats a plan that has ended as Free', () => {
    act(() => { useEntitlementStore.setState({ plan: { ...plan('pro'), status: 'expired' }, isLoaded: true }); });
    const utils = render(<PaywallScreen />);
    expect(utils.queryByTestId('plan-free-current')).toBeTruthy();
    expect(utils.queryByTestId('plan-pro-current')).toBeNull();
  });
});

describe('the upgrade buttons', () => {
  it('are on the plans above the person\'s own, and nowhere else', () => {
    const has = (utils) => ['free', 'pro', 'legend'].filter((t) => utils.queryByTestId(`plan-${t}-buy`));
    as('free');
    expect(has(render(<PaywallScreen />))).toEqual(['pro', 'legend']);
    as('pro');
    expect(has(render(<PaywallScreen />))).toEqual(['legend']);
    as('legend');
    expect(has(render(<PaywallScreen />))).toEqual([]);
  });

  it('say "Coming soon", are switched off, and buy nothing while subscriptions are not open', () => {
    const utils = render(<PaywallScreen />);
    const button = utils.getByTestId('plan-pro-buy');
    expect(textIn(utils, 'plan-pro-buy')).toEqual(['Coming soon']);
    expect(button.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(button);
    expect(global.__purchasePlan).not.toHaveBeenCalled();
  });

  it('explains that subscriptions are not open yet', () => {
    expect(render(<PaywallScreen />).getByTestId('paywall-note')).toBeTruthy();
  });

  describe('once subscriptions are open', () => {
    beforeEach(() => { global.__purchasesOn = true; });

    it('say which plan they buy, drop the note, and buy that plan when pressed', async () => {
      const utils = render(<PaywallScreen />);
      expect(textIn(utils, 'plan-pro-buy')).toEqual(['Upgrade to Pro']);
      expect(textIn(utils, 'plan-legend-buy')).toEqual(['Upgrade to Legend']);
      expect(utils.queryByTestId('paywall-note')).toBeNull();
      fireEvent.press(utils.getByTestId('plan-legend-buy'));
      await settle();
      expect(global.__purchasePlan).toHaveBeenCalledTimes(1);
      expect(global.__purchasePlan).toHaveBeenCalledWith('legend');
      expect(utils.queryByTestId('paywall-error')).toBeNull();
    });

    it('show why a purchase did not go through', async () => {
      global.__purchasePlan.mockResolvedValue({ ok: false, error: 'Payment was declined.' });
      const utils = render(<PaywallScreen />);
      fireEvent.press(utils.getByTestId('plan-pro-buy'));
      await settle();
      expect(textIn(utils, 'paywall-error')).toEqual(['Payment was declined.']);
    });

    it('say so plainly when the purchase fails without a reason, or breaks', async () => {
      global.__purchasePlan.mockResolvedValue({ ok: false });
      const utils = render(<PaywallScreen />);
      fireEvent.press(utils.getByTestId('plan-pro-buy'));
      await settle();
      expect(textIn(utils, 'paywall-error')).toEqual(['That did not go through.']);
      global.__purchasePlan.mockRejectedValue(new Error('boom'));
      fireEvent.press(utils.getByTestId('plan-pro-buy'));
      await settle();
      expect(textIn(utils, 'paywall-error')).toEqual(['That did not go through.']);
    });

    it('buy only once while a purchase is under way, and show it is working', async () => {
      let finish;
      global.__purchasePlan.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
      const utils = render(<PaywallScreen />);
      fireEvent.press(utils.getByTestId('plan-pro-buy'));
      fireEvent.press(utils.getByTestId('plan-pro-buy'));
      fireEvent.press(utils.getByTestId('plan-legend-buy'));
      await settle();
      expect(global.__purchasePlan).toHaveBeenCalledTimes(1);
      expect(textIn(utils, 'plan-pro-buy')).toEqual(['One moment...']);
      expect(utils.getByTestId('plan-legend-buy').props.accessibilityState.disabled).toBe(true);
      expect(textIn(utils, 'plan-legend-buy')).toEqual(['Upgrade to Legend']);
      await act(async () => { finish({ ok: true }); });
      expect(textIn(utils, 'plan-pro-buy')).toEqual(['Upgrade to Pro']);
    });

    it('buy only once even when a second press gets past the switched-off button', async () => {
      global.__purchasePlan.mockImplementation(() => new Promise(() => {}));
      const utils = render(<PaywallScreen />);
      act(() => { pressableOf(utils, 'plan-pro-buy').props.onPress(); });
      act(() => { pressableOf(utils, 'plan-legend-buy').props.onPress(); });
      await settle();
      expect(global.__purchasePlan).toHaveBeenCalledTimes(1);
      expect(global.__purchasePlan).toHaveBeenCalledWith('pro');
    });

    it('read the error out as an alert', async () => {
      global.__purchasePlan.mockResolvedValue({ ok: false, error: 'Payment was declined.' });
      const utils = render(<PaywallScreen />);
      fireEvent.press(utils.getByTestId('plan-pro-buy'));
      await settle();
      expect(utils.getByTestId('paywall-error').props.accessibilityRole).toBe('alert');
    });

    it('clear the old error when the person tries again', async () => {
      global.__purchasePlan.mockResolvedValueOnce({ ok: false, error: 'Payment was declined.' });
      const utils = render(<PaywallScreen />);
      fireEvent.press(utils.getByTestId('plan-pro-buy'));
      await settle();
      expect(utils.queryByTestId('paywall-error')).toBeTruthy();
      fireEvent.press(utils.getByTestId('plan-pro-buy'));
      await settle();
      expect(utils.queryByTestId('paywall-error')).toBeNull();
    });
  });
});

describe('the feature the person was turned away from', () => {
  it('is named, with the plan it is part of, at the top', () => {
    global.__params = { feature: 'analytics' };
    expect(textIn(render(<PaywallScreen />), 'paywall-wanted')).toEqual(['Analytics is part of Pro.']);
    global.__params = { feature: 'bodyScan' };
    expect(textIn(render(<PaywallScreen />), 'paywall-wanted')).toEqual(['Body scan and 3D body is part of Legend.']);
  });

  it('is left out when the person already has it, or it is not a feature, or none was named', () => {
    as('pro');
    global.__params = { feature: 'analytics' };
    expect(render(<PaywallScreen />).queryByTestId('paywall-wanted')).toBeNull();
    as('free');
    global.__params = { feature: 'nonsense' };
    expect(render(<PaywallScreen />).queryByTestId('paywall-wanted')).toBeNull();
    global.__params = {};
    expect(render(<PaywallScreen />).queryByTestId('paywall-wanted')).toBeNull();
    global.__params = { feature: ['analytics'] };
    expect(render(<PaywallScreen />).queryByTestId('paywall-wanted')).toBeNull();
  });
});

describe('the header', () => {
  it('is titled Plans, with a labelled back arrow', () => {
    const utils = render(<PaywallScreen />);
    expect(utils.getByText('Plans')).toBeTruthy();
    expect(utils.getByLabelText('Go back')).toBeTruthy();
  });
});

describe('going back', () => {
  it('goes back when there is somewhere to go', () => {
    fireEvent.press(render(<PaywallScreen />).getByTestId('paywall-back'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('opens Settings when there is not', () => {
    router.canGoBack.mockReturnValue(false);
    fireEvent.press(render(<PaywallScreen />).getByTestId('paywall-back'));
    expect(router.replace).toHaveBeenCalledWith('/profile/settings');
  });
});

describe('the paywall_viewed analytics event', () => {
  it('is sent once when the plans open on their own, with no feature', () => {
    render(<PaywallScreen />);
    expect(global.__logPaywallViewed).toHaveBeenCalledTimes(1);
    expect(global.__logPaywallViewed).toHaveBeenCalledWith(undefined);
  });

  it('is sent once when a feature sent the person here, naming that feature', () => {
    global.__params = { feature: 'analytics' };
    render(<PaywallScreen />);
    expect(global.__logPaywallViewed).toHaveBeenCalledTimes(1);
    expect(global.__logPaywallViewed).toHaveBeenCalledWith('analytics');
  });

  it('does not send what is not a feature of the app', () => {
    global.__params = { feature: 'nonsense typed by somebody' };
    render(<PaywallScreen />);
    expect(global.__logPaywallViewed).toHaveBeenCalledTimes(1);
    expect(global.__logPaywallViewed).toHaveBeenCalledWith(undefined);
  });

  it('is not sent again when the screen redraws (the plan changes, a button is tapped)', async () => {
    global.__params = { feature: 'bodyScan' };
    const utils = render(<PaywallScreen />);
    as('pro');
    utils.rerender(<PaywallScreen />);
    as('legend');
    await settle();
    expect(global.__logPaywallViewed).toHaveBeenCalledTimes(1);
  });
});
