// The Health screen: only real readings (a dash or a prompt to connect a device when there are none), the Body Composition card
// marked with the plan it needs, and the AI comment on the training load asked for once the numbers settle, only for someone signed in.
import React from 'react';
import { act, render, fireEvent } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
const mockPush = jest.fn();
// Looked up when a button is pressed, not when the mock is made: the imports below run before this file's own lines do.
jest.mock('expo-router', () => ({ router: { push: (...args) => mockPush(...args), canGoBack: () => false } }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/components/MuscleHeatmapCard', () => () => null);
jest.mock('@/services/rookService', () => ({ rookService: { getTodayRecovery: jest.fn(async () => null) } }));

const mockHealth = {
  loadAllHealth: jest.fn(), loadAppleHealthActivity: jest.fn(), loadRookRecovery: jest.fn(),
  steps: 4200, sleep: { hours: 0, quality: null }, hydration: { glasses: 3, target: 8 }, rookRecovery: null,
};
jest.mock('@/store/healthStore', () => ({ useHealthStore: () => mockHealth }));
const mockUser = { user: { uid: 'u1', name: 'Cj' } };
jest.mock('@/store/userStore', () => ({ useUserStore: () => mockUser }));
const mockBody = { scans: [], loadScans: jest.fn() };
jest.mock('@/store/bodyCompositionStore', () => ({ useBodyCompositionStore: () => mockBody }));
const mockWorkouts = { completedWorkouts: [], loadWorkouts: jest.fn(), getExerciseHistory: jest.fn(async () => []) };
jest.mock('@/store/workoutStore', () => ({ useWorkoutStore: () => mockWorkouts }));
const mockRuns = { runs: [], loadRuns: jest.fn() };
jest.mock('@/store/runningStore', () => ({ useRunningStore: () => mockRuns }));
const mockHikes = { completedHikes: [], loadCompletedHikes: jest.fn() };
jest.mock('@/store/hikingStore', () => ({ useHikingStore: () => mockHikes }));

// The training numbers are decided here, so a test can say what they are and when they change.
let mockLoad;
jest.mock('@/lib/trainingLoad', () => ({ aggregateDailyLoad: () => ({}), calculateTrainingLoad: () => mockLoad }));

let mockPlan;
jest.mock('@/hooks/useEntitlement', () => ({ useEntitlement: () => mockPlan }));

const mockGetInsight = jest.fn();
jest.mock('@/services/insightService', () => ({ getTrainingLoadInsight: (...args) => mockGetInsight(...args) }));

import HealthScreen from '../app/health';
import { INSIGHT_SETTLE_MS } from '../lib/insightCache';

const STEADY = { zone: 'sweet_spot', zoneLabel: 'In your typical training range', ratio: 1.1, acuteLoad: 2100, chronicWeeklyAvg: 1900 };
const HARDER = { zone: 'elevated', zoneLabel: 'Higher than usual', ratio: 1.4, acuteLoad: 2800, chronicWeeklyAvg: 2000 };
const TOO_EARLY = { zone: 'insufficient_data', zoneLabel: 'Not enough history yet', ratio: 0, acuteLoad: 0, chronicWeeklyAvg: 0 };
const APPLE = { restingHeartRate: 58, hrv: 42, sleepEfficiency: null, sleepHours: null, source: 'Apple Health' };
const PLANS = { pathname: '/paywall', params: { feature: 'bodyScan' } };
const DASH = String.fromCharCode(8212);

// Legend has the body scan and, as far as these tests go, nothing else: a screen that asks about a different feature is told no.
const LEGEND = { ready: true, can: (feature) => feature === 'bodyScan' };
const FREE = { ready: true, can: () => false };
const UNKNOWN_YET = { ready: false, can: () => false };

beforeEach(() => {
  jest.useFakeTimers();
  mockLoad = STEADY;
  mockPlan = LEGEND;
  mockHealth.rookRecovery = null;
  mockUser.user = { uid: 'u1', name: 'Cj' };
  mockBody.scans = [];
  mockWorkouts.completedWorkouts = [];
  mockRuns.runs = [];
  mockHikes.completedHikes = [];
  mockPush.mockClear();
  mockHealth.loadAppleHealthActivity.mockClear();
  mockHealth.loadAllHealth.mockClear();
  mockGetInsight.mockReset();
  mockGetInsight.mockResolvedValue('A steady week.');
});
afterEach(() => { jest.useRealTimers(); });

const open = async () => {
  const utils = render(<HealthScreen />);
  await act(async () => {});
  return utils;
};
const settle = async (ms = INSIGHT_SETTLE_MS) => { await act(async () => { jest.advanceTimersByTime(ms); }); };
// The button sits inside the card, which is a button too; its press must not reach the card as well.
const pressWithoutBubbling = (node) => {
  const stopPropagation = jest.fn();
  fireEvent.press(node, { stopPropagation });
  expect(stopPropagation).toHaveBeenCalledTimes(1);
};

describe('what the screen loads when it opens', () => {
  it('syncs the steps from Apple Health for the signed-in person, so they are saved to their account and earn their XP', async () => {
    await open();
    expect(mockHealth.loadAppleHealthActivity).toHaveBeenCalledTimes(1);
    expect(mockHealth.loadAppleHealthActivity).toHaveBeenCalledWith('u1');
  });

  it('loads nothing without a signed-in person', async () => {
    mockUser.user = null;
    await open();
    expect(mockHealth.loadAppleHealthActivity).not.toHaveBeenCalled();
    expect(mockHealth.loadAllHealth).not.toHaveBeenCalled();
  });
});

describe('the readings', () => {
  it('has none of the numbers and words it used to show without measuring anything', async () => {
    const { queryByText } = await open();
    for (const text of ['Your Health Score', '82', 'Good', 'Updated today at 9:15 AM', 'Heart Rate', 'Blood Oxygen', 'Stress Level',
      '72 bpm', '98 %', 'Low', 'AI Coach', 'Get Your First Insight', 'Get More Insights']) {
      expect(queryByText(text)).toBeNull();
    }
    expect(queryByText(/consider adding a 10-minute stretch/)).toBeNull();
  });

  it('shows the resting heart rate and the HRV the phone read, and where they are from', async () => {
    mockHealth.rookRecovery = APPLE;
    const { getByText, getByTestId } = await open();
    expect(getByText('Recovery')).toBeTruthy();
    expect(getByText('58 bpm')).toBeTruthy();
    expect(getByText('Resting HR')).toBeTruthy();
    expect(getByText('42 ms')).toBeTruthy();
    expect(getByText('HRV (SDNN)')).toBeTruthy();
    expect(getByTestId('recovery-caption').props.children).toBe('Latest readings from Apple Health');
  });

  it('shows a dash for a reading it does not have, and asks to connect a device when it has none', async () => {
    const { getByTestId, getAllByText, queryByText } = await open();
    expect(getAllByText(DASH).length).toBeGreaterThanOrEqual(2);
    expect(getByTestId('recovery-restingHeartRate')).toBeTruthy();
    expect(getByTestId('recovery-hrv')).toBeTruthy();
    expect(getByTestId('recovery-caption').props.children).toBe('No readings yet. Connect a device under Wearable Sync below.');
    expect(queryByText(/bpm/)).toBeNull();
  });

  it('still lists the steps, sleep and water that were logged', async () => {
    const { getByText } = await open();
    expect(getByText('4200')).toBeTruthy();
    expect(getByText('3/8')).toBeTruthy();
  });
});

describe('the Body Composition card', () => {
  it('is the camera for someone whose plan includes the body scan, with no plan marked', async () => {
    const { getByText, queryByTestId, getByTestId } = await open();
    expect(getByText('Scan now')).toBeTruthy();
    expect(getByText('AI-powered body analysis using your camera')).toBeTruthy();
    expect(queryByTestId('body-composition-plan')).toBeNull();
    pressWithoutBubbling(getByTestId('body-composition-primary'));
    expect(mockPush).toHaveBeenCalledWith('/body-scan/capture');
    fireEvent.press(getByTestId('body-composition-card'));
    expect(mockPush).toHaveBeenLastCalledWith('/body-scan/capture');
  });

  it('says Legend, and goes to the plans, for someone on Free or Pro', async () => {
    mockPlan = FREE;
    const { getByText, getByTestId, queryByText } = await open();
    expect(getByTestId('body-composition-plan')).toBeTruthy();
    expect(getByText('Legend')).toBeTruthy();
    expect(getByText('Body scan is part of Legend')).toBeTruthy();
    expect(queryByText('Scan now')).toBeNull();
    pressWithoutBubbling(getByTestId('body-composition-primary'));
    expect(mockPush).toHaveBeenCalledWith(PLANS);
    expect(mockPush).not.toHaveBeenCalledWith('/body-scan/capture');
    fireEvent.press(getByTestId('body-composition-card'));
    expect(mockPush).toHaveBeenLastCalledWith(PLANS);
  });

  it('does not mark anything while it is still finding out the plan, so nobody who has it sees a lock flash up', async () => {
    mockPlan = UNKNOWN_YET;
    const { queryByTestId, getByText } = await open();
    expect(queryByTestId('body-composition-plan')).toBeNull();
    expect(getByText('Scan now')).toBeTruthy();
  });

  it('still opens the scan that was taken for someone whose plan does not include another', async () => {
    mockPlan = FREE;
    mockBody.scans = [{ id: 'old', bodyFatPercent: 22 }, { id: 'new', bodyFatPercent: 18.5 }];
    const { getByText, getByTestId } = await open();
    expect(getByText('Last scan: 18.5% body fat')).toBeTruthy();
    expect(getByText('View progress')).toBeTruthy();
    expect(getByText('See plans')).toBeTruthy();
    fireEvent.press(getByTestId('body-composition-card'));
    expect(mockPush).toHaveBeenLastCalledWith('/body-scan/new');
    pressWithoutBubbling(getByTestId('body-composition-primary'));
    expect(mockPush).toHaveBeenLastCalledWith(PLANS);
  });

  it('opens the camera from New scan, and the scan that was taken from the card, for someone whose plan includes it', async () => {
    mockBody.scans = [{ id: 'new', bodyFatPercent: 18.5 }];
    const { getByText, getByTestId, queryByTestId } = await open();
    expect(getByText('New scan')).toBeTruthy();
    expect(queryByTestId('body-composition-plan')).toBeNull();
    pressWithoutBubbling(getByTestId('body-composition-primary'));
    expect(mockPush).toHaveBeenLastCalledWith('/body-scan/capture');
    fireEvent.press(getByTestId('body-composition-card'));
    expect(mockPush).toHaveBeenLastCalledWith('/body-scan/new');
  });
});

describe('the AI comment on the training load', () => {
  it('is asked for once the numbers have settled, and shown', async () => {
    const { queryByText, getByText } = await open();
    expect(mockGetInsight).not.toHaveBeenCalled();
    await settle(INSIGHT_SETTLE_MS - 1);
    expect(mockGetInsight).not.toHaveBeenCalled();
    expect(queryByText('A steady week.')).toBeNull();
    await settle(1);
    expect(mockGetInsight).toHaveBeenCalledTimes(1);
    expect(mockGetInsight).toHaveBeenCalledWith({ uid: 'u1', trainingLoad: STEADY });
    expect(getByText('A steady week.')).toBeTruthy();
  });

  it('is not asked again when the screen draws again with the same numbers', async () => {
    const utils = await open();
    await settle();
    utils.rerender(<HealthScreen />);
    await settle(INSIGHT_SETTLE_MS * 3);
    expect(mockGetInsight).toHaveBeenCalledTimes(1);
  });

  it('is asked for only the final numbers when they change before it is time', async () => {
    const utils = await open();
    await settle(INSIGHT_SETTLE_MS - 100);
    mockLoad = HARDER;
    mockWorkouts.completedWorkouts = [{ id: 'w1' }];
    utils.rerender(<HealthScreen />);
    await settle(INSIGHT_SETTLE_MS - 1);
    expect(mockGetInsight).not.toHaveBeenCalled();
    await settle(1);
    expect(mockGetInsight).toHaveBeenCalledTimes(1);
    expect(mockGetInsight).toHaveBeenCalledWith({ uid: 'u1', trainingLoad: HARDER });
  });

  it('takes the new numbers\' comment, not the old one, when the old answer arrives late', async () => {
    let answerOld;
    mockGetInsight.mockImplementationOnce(() => new Promise((resolve) => { answerOld = resolve; }));
    const utils = await open();
    await settle();
    expect(mockGetInsight).toHaveBeenCalledTimes(1);

    mockLoad = HARDER;
    mockRuns.runs = [{ id: 'r1' }];
    mockGetInsight.mockResolvedValueOnce('A harder week.');
    utils.rerender(<HealthScreen />);
    await settle();
    expect(utils.getByText('A harder week.')).toBeTruthy();

    await act(async () => { answerOld('A steady week.'); });
    expect(utils.queryByText('A steady week.')).toBeNull();
    expect(utils.getByText('A harder week.')).toBeTruthy();
  });

  it('takes the old comment off while the new numbers\' one is on its way', async () => {
    const utils = await open();
    await settle();
    expect(utils.getByText('A steady week.')).toBeTruthy();
    mockLoad = HARDER;
    mockHikes.completedHikes = [{ id: 'h1' }];
    mockGetInsight.mockResolvedValueOnce('A harder week.');
    utils.rerender(<HealthScreen />);
    await act(async () => {});
    expect(utils.queryByText('A steady week.')).toBeNull();
    await settle();
    expect(utils.getByText('A harder week.')).toBeTruthy();
  });

  it('is never asked for when the person leaves before it is time', async () => {
    const utils = await open();
    await settle(INSIGHT_SETTLE_MS - 1);
    utils.unmount();
    await settle(INSIGHT_SETTLE_MS * 2);
    expect(mockGetInsight).not.toHaveBeenCalled();
  });

  it('shows the card with no comment when there is none to give', async () => {
    mockGetInsight.mockResolvedValue(null);
    const { getByText, queryByText } = await open();
    await settle();
    expect(mockGetInsight).toHaveBeenCalledTimes(1);
    expect(getByText('Training Load')).toBeTruthy();
    expect(getByText('1.10')).toBeTruthy();
    expect(queryByText('A steady week.')).toBeNull();
  });

  it('is not asked for before there is enough history to read', async () => {
    mockLoad = TOO_EARLY;
    const { getByText } = await open();
    await settle(INSIGHT_SETTLE_MS * 3);
    expect(mockGetInsight).not.toHaveBeenCalled();
    expect(getByText(/needs about a week of history/)).toBeTruthy();
  });

  it('is not asked for without a signed-in person', async () => {
    mockUser.user = null;
    await open();
    await settle(INSIGHT_SETTLE_MS * 3);
    expect(mockGetInsight).not.toHaveBeenCalled();
  });

  it('is asked for once the person has signed in, if they had not when the screen opened', async () => {
    mockUser.user = null;
    const utils = await open();
    await settle(INSIGHT_SETTLE_MS * 2);
    expect(mockGetInsight).not.toHaveBeenCalled();
    mockUser.user = { uid: 'u2', name: 'Sam' };
    utils.rerender(<HealthScreen />);
    await settle();
    expect(mockGetInsight).toHaveBeenCalledTimes(1);
    expect(mockGetInsight).toHaveBeenCalledWith({ uid: 'u2', trainingLoad: STEADY });
  });

  it('is not asked for by a person with no id', async () => {
    mockUser.user = { name: 'Guest' };
    await open();
    await settle(INSIGHT_SETTLE_MS * 3);
    expect(mockGetInsight).not.toHaveBeenCalled();
  });
});
