// The Home screen's Hydration card: add a glass or two, and take one back off for a glass added by mistake.
import React from 'react';
import { RefreshControl, StyleSheet } from 'react-native';
import { act, render, fireEvent } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('../services/rookService', () => ({ rookService: {} }));
jest.mock('../services/appleHealthService', () => ({ appleHealthService: {} }));
jest.mock('expo-location', () => ({}), { virtual: true }); // the hiking store imports it; no GPS is used here
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Circle: 'Circle' }), { virtual: true });
jest.mock('react-native-chart-kit', () => ({ LineChart: 'LineChart', BarChart: 'BarChart' }), { virtual: true });
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => 'Icon' }), { virtual: true });
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: jest.fn() }),
  router: { push: jest.fn() },
}), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/src/components/LoadingSkeleton', () => () => null);
jest.mock('@/components/StrengthScoreWidget', () => () => null);
jest.mock('@/components/FastingWidget', () => () => null);
jest.mock('@/components/MusicWidget', () => () => null);
jest.mock('@/components/StreakWidget', () => () => null);
jest.mock('@/components/NextUpWidget', () => () => null);
jest.mock('@/components/BattlePassWidget', () => () => null);
jest.mock('@/components/TrainingLoadWidget', () => () => null);
jest.mock('@/components/MusclesWidget', () => () => null);
jest.mock('@/components/WorkoutHistoryWidget', () => () => null);
jest.mock('@/components/RunningLogWidget', () => () => null);
jest.mock('@/components/RankChallengeWidget', () => () => null);
jest.mock('@/components/MacrosWidget', () => () => null);
jest.mock('@/components/WeightWidget', () => () => null);
jest.mock('@/components/WidgetEditorModal', () => () => null);
jest.mock('@/components/TodayBriefCard', () => () => null); // the daily Today brief has its own tests (TodayBriefCard.test.jsx)

import Hq from '../app/hq';
import { useUserStore } from '../store/userStore';
import { useHealthStore } from '../store/healthStore';
import { useExpStore } from '../store/expStore';
import { useHikingStore } from '../store/hikingStore';

const NOON = new Date('2026-10-14T16:00:00Z');

// The user store finishes loading on a timer once it is imported; let that happen before the clock is moved.
beforeAll(() => new Promise((resolve) => setTimeout(resolve, 20)));
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

const realLoadCompletedHikes = useHikingStore.getState().loadCompletedHikes;
const realPersist = useHealthStore.getState()._persist;
afterEach(() => {
  useHikingStore.setState({ completedHikes: [], loadCompletedHikes: realLoadCompletedHikes });
  useHealthStore.setState({ _persist: realPersist });
});

const openHydration = async (glasses) => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  useUserStore.setState({ user: { uid: 'u1', name: 'Cj' } });
  useHealthStore.setState({ hydration: { glasses, target: 8, date: '2026-10-14' } });
  jest.useFakeTimers({ now: NOON, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  const utils = render(<Hq />);
  await act(async () => {});
  fireEvent.press(utils.getByText('Hydration'));
  await act(async () => {});
  return utils;
};
const glasses = () => useHealthStore.getState().hydration.glasses;

describe('home screen: Hydration card', () => {
  it('adds a glass with +250ml and two with +500ml', async () => {
    const utils = await openHydration(3);
    fireEvent.press(utils.getByText('+250ml'));
    expect(glasses()).toBe(4);
    fireEvent.press(utils.getByText('+500ml'));
    expect(glasses()).toBe(6);
  });

  it('saves a glass added with +250ml for the signed-in person, so it is in their account and not only on this phone', async () => {
    const persist = jest.fn();
    const utils = await openHydration(3);
    act(() => { useHealthStore.setState({ _persist: persist }); });
    fireEvent.press(utils.getByText('+250ml'));
    expect(persist.mock.calls).toEqual([['u1']]);
  });

  it('saves both glasses added with +500ml for the signed-in person', async () => {
    const persist = jest.fn();
    const utils = await openHydration(3);
    act(() => { useHealthStore.setState({ _persist: persist }); });
    fireEvent.press(utils.getByText('+500ml'));
    expect(persist.mock.calls).toEqual([['u1'], ['u1']]);
  });

  it('files the water reward for the signed-in person, as the Nutrition tab does, and not on this phone alone', async () => {
    const utils = await openHydration(3);
    const award = jest.spyOn(useExpStore.getState(), 'awardHydrationXp').mockImplementation(() => {});
    fireEvent.press(utils.getByText('+250ml'));
    expect(award).toHaveBeenCalledWith(4, 8, 'u1');
  });

  it('takes a glass back off with -250ml, for one added by mistake', async () => {
    const utils = await openHydration(3);
    expect(utils.getByText('-250ml')).toBeTruthy();
    fireEvent.press(utils.getByTestId('hydration-remove'));
    expect(glasses()).toBe(2);
    fireEvent.press(utils.getByTestId('hydration-remove'));
    expect(glasses()).toBe(1);
  });

  it('shows the new count on the card after a glass is taken off', async () => {
    const utils = await openHydration(3);
    expect(utils.getByText('3 / 8')).toBeTruthy();
    fireEvent.press(utils.getByTestId('hydration-remove'));
    expect(utils.getByText('2 / 8')).toBeTruthy();
  });

  it('switches -250ml off at 0, so the count never goes below it', async () => {
    const utils = await openHydration(0);
    expect(utils.getByTestId('hydration-remove').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(utils.getByTestId('hydration-remove'));
    expect(glasses()).toBe(0);
  });

  it('keeps -250ml on at 1 glass, and goes to 0 from there', async () => {
    const utils = await openHydration(1);
    expect(utils.getByTestId('hydration-remove').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(utils.getByTestId('hydration-remove'));
    expect(glasses()).toBe(0);
  });

  it('saves the new count for the signed-in person', async () => {
    const persist = jest.fn();
    const utils = await openHydration(3);
    act(() => { useHealthStore.setState({ _persist: persist }); });
    fireEvent.press(utils.getByTestId('hydration-remove'));
    expect(persist).toHaveBeenCalledWith('u1');
  });

  it('greys -250ml out at 0 and not otherwise', async () => {
    const opacityOf = (utils) => StyleSheet.flatten(utils.UNSAFE_getAllByProps({ testID: 'hydration-remove' })[0].props.style).opacity;
    expect(opacityOf(await openHydration(0))).toBe(0.35);
    expect(opacityOf(await openHydration(3))).toBeUndefined();
  });

  it('labels the button for screen readers', async () => {
    const utils = await openHydration(3);
    expect(utils.getByLabelText('Remove a glass of water')).toBeTruthy();
  });
});
