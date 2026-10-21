// The Today brief on the Home screen (components/TodayBriefCard.jsx): the note for a person on Pro, a skeleton while it is written, nothing
// when it could not be, and for anyone else what it is, which plan it is part of and a button to the plans.
import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('@/store/userStore', () => ({ useUserStore: (select) => select({ user: global.__user }) }));
jest.mock('@/services/briefService', () => ({ getTodayBrief: jest.fn() }));

import { router } from 'expo-router';
import TodayBriefCard, { BRIEF_FOOTNOTE, BRIEF_LOCKED_TEXT } from '../components/TodayBriefCard';
import { getTodayBrief } from '@/services/briefService';
import { useEntitlementStore } from '../store/entitlementStore';
import { WAIT_FOR_PLAN_MS } from '../hooks/useEntitlement';

const BRIEF = { headline: 'A good day to train', points: ['Sleep was 8 hours.', 'Keep the lifting moderate.', 'Walk after dinner.'] };
const plan = (over = {}) => ({ tier: 'pro', status: 'active', expiresAt: null, source: 'manual', ...over });
const setStore = (state) => act(() => { useEntitlementStore.setState({ plan: null, isLoaded: false, ...state }); });
const textOf = (utils) => utils.UNSAFE_getAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const show = async (props = {}) => {
  const utils = render(<TodayBriefCard {...props} />);
  await settle();
  return utils;
};

beforeEach(() => {
  jest.clearAllMocks();
  global.__user = { uid: 'u1', name: 'Sam' };
  getTodayBrief.mockResolvedValue(BRIEF);
  setStore({ plan: plan(), isLoaded: true });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe('a person on Pro', () => {
  it('sees the headline and the points, in the order they were written, and what the note is', async () => {
    const utils = await show();
    expect(utils.getByTestId('today-brief-headline').props.children).toBe('A good day to train');
    expect(BRIEF.points.map((_, i) => utils.getByTestId(`today-brief-point-${i}`).props.children)).toEqual(BRIEF.points);
    expect(utils.queryByTestId('today-brief-point-3')).toBeNull();
    expect(utils.getByTestId('today-brief-note').props.children).toBe(BRIEF_FOOTNOTE);
    expect(BRIEF_FOOTNOTE).toMatch(/not medical advice/);
    expect(textOf(utils)).toContain('Today brief');
  });

  it('has the brief read out as a heading followed by the points', async () => {
    const utils = await show();
    expect(utils.getByTestId('today-brief-headline').props.accessibilityRole).toBe('header');
  });

  it('is asked for once, for this person, from the service', async () => {
    await show();
    expect(getTodayBrief).toHaveBeenCalledTimes(1);
    expect(getTodayBrief).toHaveBeenCalledWith({ user: global.__user });
  });

  it('can be given another source of briefs', async () => {
    const getBrief = jest.fn(async () => ({ headline: 'Rest up', points: ['Easy day.'] }));
    const utils = await show({ getBrief });
    expect(utils.getByTestId('today-brief-headline').props.children).toBe('Rest up');
    expect(getBrief).toHaveBeenCalledTimes(1);
    expect(getTodayBrief).not.toHaveBeenCalled();
  });

  it('is not a lock: no plans button, no plan label', async () => {
    const utils = await show();
    expect(utils.queryByTestId('today-brief-locked')).toBeNull();
    expect(utils.queryByTestId('today-brief-see-plans')).toBeNull();
    expect(utils.queryByTestId('today-brief-plan')).toBeNull();
  });

  it('sees a skeleton while the brief is being written, then the brief', async () => {
    let finish;
    getTodayBrief.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const utils = await show();
    expect(utils.getByTestId('today-brief-loading')).toBeTruthy();
    expect(utils.getByLabelText('Writing your Today brief')).toBeTruthy();
    expect(textOf(utils)).toContain('Writing your brief');
    expect(utils.queryByTestId('today-brief')).toBeNull();
    await act(async () => { finish(BRIEF); });
    expect(utils.queryByTestId('today-brief-loading')).toBeNull();
    expect(utils.getByTestId('today-brief')).toBeTruthy();
  });

  it('sees nothing when the brief could not be written', async () => {
    getTodayBrief.mockResolvedValue(null);
    const utils = await show();
    expect(utils.toJSON()).toBeNull();
  });

  it('sees nothing, and no error, when asking for it fails', async () => {
    getTodayBrief.mockRejectedValue(new Error('offline'));
    const utils = await show();
    expect(utils.toJSON()).toBeNull();
  });

  it('is the same for a Legend person', async () => {
    setStore({ plan: plan({ tier: 'legend' }), isLoaded: true });
    const utils = await show();
    expect(utils.getByTestId('today-brief')).toBeTruthy();
    expect(utils.queryByTestId('today-brief-locked')).toBeNull();
  });

  it('does not ask again when the screen renders again, or when their profile changes', async () => {
    const utils = await show();
    utils.rerender(<TodayBriefCard />);
    global.__user = { ...global.__user, name: 'Samuel' };
    utils.rerender(<TodayBriefCard />);
    await settle();
    expect(getTodayBrief).toHaveBeenCalledTimes(1);
    expect(utils.getByTestId('today-brief')).toBeTruthy();
  });

  it('asks again for a different person, and not before', async () => {
    const utils = await show();
    global.__user = { uid: 'u2', name: 'Alex' };
    utils.rerender(<TodayBriefCard />);
    await settle();
    expect(getTodayBrief).toHaveBeenCalledTimes(2);
    expect(getTodayBrief).toHaveBeenLastCalledWith({ user: { uid: 'u2', name: 'Alex' } });
  });

  it('does not set anything on a screen that has gone, when the brief arrives late', async () => {
    let finish;
    getTodayBrief.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const utils = await show();
    utils.unmount();
    await act(async () => { finish(BRIEF); });
    expect(error).not.toHaveBeenCalled();
  });

  it('shows nothing of an old brief to the next person, while theirs is written', async () => {
    const utils = await show();
    let finish;
    getTodayBrief.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    global.__user = { uid: 'u2', name: 'Alex' };
    utils.rerender(<TodayBriefCard />);
    await settle();
    expect(utils.queryByTestId('today-brief')).toBeNull();
    expect(utils.getByTestId('today-brief-loading')).toBeTruthy();
    await act(async () => { finish({ headline: 'Alex day', points: ['Go.'] }); });
    expect(utils.getByTestId('today-brief-headline').props.children).toBe('Alex day');
  });

  it('is written for the person as they are when the plan is known, not as they were when the screen opened', async () => {
    setStore({});
    const utils = await show();
    global.__user = { uid: 'u1', name: 'Samuel' };
    utils.rerender(<TodayBriefCard />);
    setStore({ plan: plan(), isLoaded: true });
    await settle();
    expect(getTodayBrief).toHaveBeenCalledTimes(1);
    expect(getTodayBrief).toHaveBeenCalledWith({ user: { uid: 'u1', name: 'Samuel' } });
  });

  it('does not show the brief of the person before, if it only arrives after the next person\'s is being written', async () => {
    const finish = {};
    getTodayBrief.mockImplementation(({ user }) => new Promise((resolve) => { finish[user.uid] = resolve; }));
    const utils = await show();
    global.__user = { uid: 'u2', name: 'Alex' };
    utils.rerender(<TodayBriefCard />);
    await settle();
    await act(async () => { finish.u1({ headline: 'Sam day', points: ['Old.'] }); });
    expect(utils.queryByTestId('today-brief')).toBeNull();
    expect(utils.getByTestId('today-brief-loading')).toBeTruthy();
    await act(async () => { finish.u2({ headline: 'Alex day', points: ['New.'] }); });
    expect(utils.getByTestId('today-brief-headline').props.children).toBe('Alex day');
  });

  it('stops showing the skeleton, and shows no brief, when the person signs out while it is being written', async () => {
    let finish;
    getTodayBrief.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const utils = await show();
    expect(utils.getByTestId('today-brief-loading')).toBeTruthy();
    global.__user = null;
    utils.rerender(<TodayBriefCard />);
    await settle();
    expect(utils.toJSON()).toBeNull();
    await act(async () => { finish(BRIEF); });
    expect(utils.toJSON()).toBeNull();
  });

  it('has a long brief shown whole', async () => {
    const long = 'x'.repeat(240);
    getTodayBrief.mockResolvedValue({ headline: 'y'.repeat(120), points: [long] });
    const utils = await show();
    expect(utils.getByTestId('today-brief-point-0').props.children).toBe(long);
  });
});

describe('a person on the Free plan', () => {
  beforeEach(() => setStore({ isLoaded: true }));

  it('sees what it is and which plan it is part of, never a brief', async () => {
    const utils = await show();
    expect(utils.getByTestId('today-brief-locked')).toBeTruthy();
    expect(utils.getByTestId('today-brief-plan').props.children).toBe('Pro');
    const lines = textOf(utils);
    expect(lines).toContain(`Daily Today brief is part of Pro. ${BRIEF_LOCKED_TEXT}`);
    expect(utils.queryByTestId('today-brief')).toBeNull();
    expect(utils.queryByTestId('today-brief-loading')).toBeNull();
  });

  it('costs no AI request', async () => {
    await show();
    expect(getTodayBrief).not.toHaveBeenCalled();
  });

  it('can open the plans, with the feature it wanted, from the lock', async () => {
    const utils = await show();
    const button = utils.getByTestId('today-brief-see-plans');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('See plans for the Daily Today brief');
    fireEvent.press(button);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/paywall', params: { feature: 'todayBrief' } });
    expect(textOf(utils)).toContain('See plans');
  });

  it('is locked out once a plan has ended', async () => {
    setStore({ plan: plan({ status: 'expired' }), isLoaded: true });
    const utils = await show();
    expect(utils.getByTestId('today-brief-locked')).toBeTruthy();
    expect(getTodayBrief).not.toHaveBeenCalled();
  });

  it('gets the brief as soon as the plan becomes Pro, and the lock back if it ends', async () => {
    const utils = await show();
    expect(utils.getByTestId('today-brief-locked')).toBeTruthy();
    setStore({ plan: plan(), isLoaded: true });
    await settle();
    expect(utils.queryByTestId('today-brief-locked')).toBeNull();
    expect(utils.getByTestId('today-brief')).toBeTruthy();
    setStore({ plan: plan({ status: 'expired' }), isLoaded: true });
    await settle();
    expect(utils.getByTestId('today-brief-locked')).toBeTruthy();
    expect(utils.queryByTestId('today-brief')).toBeNull();
  });
});

describe('while the phone is finding out the plan, and with nobody signed in', () => {
  it('shows nothing, not the lock, so a Pro person does not see it flash up, and asks for nothing', async () => {
    setStore({});
    const utils = await show();
    expect(utils.toJSON()).toBeNull();
    expect(getTodayBrief).not.toHaveBeenCalled();
  });

  it('asks for the brief when the plan turns out to be Pro', async () => {
    setStore({});
    const utils = await show();
    setStore({ plan: plan(), isLoaded: true });
    await settle();
    expect(utils.getByTestId('today-brief')).toBeTruthy();
    expect(getTodayBrief).toHaveBeenCalledTimes(1);
  });

  it('shows the lock when the plan is still not known after a few seconds', async () => {
    jest.useFakeTimers();
    setStore({});
    const utils = render(<TodayBriefCard />);
    expect(utils.toJSON()).toBeNull();
    await act(async () => { jest.advanceTimersByTime(WAIT_FOR_PLAN_MS); });
    expect(utils.getByTestId('today-brief-locked')).toBeTruthy();
    expect(getTodayBrief).not.toHaveBeenCalled();
  });

  it('shows nothing, to anyone, with nobody signed in', async () => {
    for (const user of [null, undefined, {}]) {
      global.__user = user;
      setStore({ isLoaded: true });
      const utils = await show();
      expect(utils.toJSON()).toBeNull();
      setStore({ plan: plan(), isLoaded: true });
      await settle();
      expect(utils.toJSON()).toBeNull();
      utils.unmount();
    }
    expect(getTodayBrief).not.toHaveBeenCalled();
  });
});
