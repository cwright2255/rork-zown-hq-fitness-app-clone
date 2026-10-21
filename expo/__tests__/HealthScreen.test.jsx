// The Health screen: only real readings (a dash or a prompt to connect a device when there are none), the Trends charts drawn from the
// daily record, the Body Composition card marked with the plan it needs, and the AI comment on the training load asked for once the
// numbers settle, only for someone signed in.
import React from 'react';
import { Text } from 'react-native';
import { act, render, fireEvent, within } from '@testing-library/react-native';

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
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path' }), { virtual: true });
jest.mock('@/services/rookService', () => ({ rookService: { getTodayRecovery: jest.fn(async () => null) } }));

const mockHealth = {
  loadAllHealth: jest.fn(), loadAppleHealthActivity: jest.fn(), loadRookRecovery: jest.fn(), syncReadings: jest.fn(),
  steps: 4200, sleep: { hours: 0, quality: null }, hydration: { glasses: 3, target: 8 }, rookRecovery: null, readingsHistory: {},
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
const mockWeight = { logs: [], loadLogs: jest.fn() };
jest.mock('@/store/weightLogStore', () => ({ useWeightLogStore: () => mockWeight }));
const mockSettings = { weightUnits: 'imperial' };
jest.mock('@/store/settingsStore', () => ({ useSettingsStore: (select) => select(mockSettings) }));

// The training numbers are decided here, so a test can say what they are and when they change.
let mockLoad;
jest.mock('@/lib/trainingLoad', () => ({ aggregateDailyLoad: () => ({}), calculateTrainingLoad: () => mockLoad }));

let mockPlan;
jest.mock('@/hooks/useEntitlement', () => ({ useEntitlement: () => mockPlan }));

const mockGetInsight = jest.fn();
jest.mock('@/services/insightService', () => ({ getTrainingLoadInsight: (...args) => mockGetInsight(...args) }));

import HealthScreen from '../app/health';
import { INSIGHT_SETTLE_MS } from '../lib/insightCache';
import { shiftDateKey } from '../lib/localDate';

const STEADY = { zone: 'sweet_spot', zoneLabel: 'In your typical training range', ratio: 1.1, acuteLoad: 2100, chronicWeeklyAvg: 1900 };
const HARDER = { zone: 'elevated', zoneLabel: 'Higher than usual', ratio: 1.4, acuteLoad: 2800, chronicWeeklyAvg: 2000 };
const TOO_EARLY = { zone: 'insufficient_data', zoneLabel: 'Not enough history yet', ratio: 0, acuteLoad: 0, chronicWeeklyAvg: 0 };
const APPLE = { restingHeartRate: 58, hrv: 42, sleepEfficiency: null, sleepHours: null, source: 'Apple Health' };
const PLANS = { pathname: '/paywall', params: { feature: 'bodyScan' } };
const DASH = String.fromCharCode(8212);
const pickStyle = (node, key) => [...[].concat(...[].concat(node.props.style).map((st) => (Array.isArray(st) ? st : [st]))).filter(Boolean)].reverse().find((st) => st[key] !== undefined)?.[key];

// Legend has the body scan and, as far as these tests go, nothing else: a screen that asks about a different feature is told no.
const LEGEND = { ready: true, can: (feature) => feature === 'bodyScan' };
const FREE = { ready: true, can: () => false };
const UNKNOWN_YET = { ready: false, can: () => false };

beforeEach(() => {
  jest.useFakeTimers();
  mockLoad = STEADY;
  mockPlan = LEGEND;
  mockHealth.rookRecovery = null;
  mockHealth.readingsHistory = {};
  mockHealth.syncReadings.mockClear();
  mockWeight.logs = [];
  mockWeight.loadLogs.mockClear();
  mockSettings.weightUnits = 'imperial';
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

  it('keeps the daily record of sleep, HRV and resting heart rate up to date, and loads the weight log, for the signed-in person', async () => {
    await open();
    expect(mockHealth.syncReadings).toHaveBeenCalledTimes(1);
    expect(mockHealth.syncReadings).toHaveBeenCalledWith('u1');
    expect(mockWeight.loadLogs).toHaveBeenCalledTimes(1);
    expect(mockWeight.loadLogs).toHaveBeenCalledWith('u1');
  });

  it('loads nothing without a signed-in person', async () => {
    mockUser.user = null;
    await open();
    expect(mockHealth.loadAppleHealthActivity).not.toHaveBeenCalled();
    expect(mockHealth.loadAllHealth).not.toHaveBeenCalled();
    expect(mockHealth.syncReadings).not.toHaveBeenCalled();
    expect(mockWeight.loadLogs).not.toHaveBeenCalled();
  });
});

describe('the Trends section', () => {
  // Tuesday 20 October 2026, 3 PM in the person's own time.
  beforeEach(() => { jest.setSystemTime(new Date(2026, 9, 20, 15, 0)); });
  const RECORD = {
    '2026-10-20': { restingHeartRate: 60, hrv: 46, sleepHours: 6.8 },
    '2026-10-19': { restingHeartRate: 58, hrv: 44, sleepHours: 7.2 },
  };

  it('comes after Health Metrics and before Wearable Sync, with the four readings', async () => {
    const { getByText, getByTestId, UNSAFE_getAllByType } = await open();
    const texts = UNSAFE_getAllByType(Text).map((node) => node.props.children).filter((c) => typeof c === 'string'); // top to bottom
    const at = (title) => texts.indexOf(title);
    expect(at('Health Metrics')).toBeGreaterThan(-1);
    expect(at('Health Metrics')).toBeLessThan(at('Trends'));
    expect(at('Trends')).toBeLessThan(at('Wearable Sync'));
    for (const id of ['sleep', 'hrv', 'restingHeartRate', 'weight']) expect(getByTestId(`trend-${id}`)).toBeTruthy();
    expect(getByText('7 days')).toBeTruthy();
    expect(getByText('28 days')).toBeTruthy();
  });

  it('draws the daily record the phone has kept', async () => {
    mockHealth.readingsHistory = RECORD;
    const { getByTestId } = await open();
    expect(getByTestId('trend-sleep-average').props.children).toBe('7.0 h');
    expect(getByTestId('trend-hrv-average').props.children).toBe('45 ms');
    expect(getByTestId('trend-restingHeartRate-average').props.children).toBe('59 bpm');
    expect(getByTestId('trend-restingHeartRate-coverage').props.children).toBe('2 of 7 days');
  });

  it('shows the weight log in pounds, or in kilograms when Settings says so', async () => {
    mockWeight.logs = [{ id: 'w1', weightKg: 80, createdAtLocal: new Date(2026, 9, 19, 8).toISOString() }];
    const pounds = await open();
    expect(pounds.getByTestId('trend-weight-average').props.children).toBe('176.4 lb');
    pounds.unmount();
    mockSettings.weightUnits = 'metric';
    const kilos = await open();
    expect(kilos.getByTestId('trend-weight-average').props.children).toBe('80.0 kg');
  });

  it('says which kind of HRV it is once the source is known', async () => {
    const before = await open();
    expect(within(before.getByTestId('trend-hrv')).getByText('HRV')).toBeTruthy();
    before.unmount();
    mockHealth.rookRecovery = APPLE;
    const apple = await open();
    expect(apple.getAllByText('HRV (SDNN)')).toHaveLength(2); // the Recovery tile and the chart
    apple.unmount();
    mockHealth.rookRecovery = { ...APPLE, source: 'WHOOP' };
    const whoop = await open();
    expect(whoop.getAllByText('HRV (RMSSD)')).toHaveLength(2);
  });

  it('says there is nothing, rather than drawing something, when nothing has been recorded', async () => {
    const { getByTestId } = await open();
    for (const id of ['sleep', 'hrv', 'restingHeartRate']) expect(getByTestId(`trend-${id}-empty`).props.children).toBe('No readings in the last 7 days');
    expect(getByTestId('trend-weight-empty').props.children).toBe('No weigh-ins in the last 7 days');
  });

  it('counts the days from today, in the person\'s own time', async () => {
    jest.setSystemTime(new Date(2026, 9, 20, 23, 59));
    mockHealth.readingsHistory = RECORD;
    const late = await open();
    expect(late.getByTestId('trend-sleep-readout').props.children).toBe('Latest, Oct 20: 6.8 h');
    late.unmount();
    jest.setSystemTime(new Date(2026, 9, 21, 0, 1));
    const next = await open();
    expect(next.getByTestId('trend-sleep-readout').props.children).toBe('Latest, Oct 20: 6.8 h');
    expect(next.getByTestId('trend-sleep-coverage').props.children).toBe('2 of 7 days');
  });
});

describe('the Readiness card', () => {
  beforeEach(() => { jest.setSystemTime(new Date(2026, 9, 20, 15, 0)); });
  // 28 days of HRV 50 and resting heart rate 60 before today: as usual.
  const usual = () => {
    const out = {};
    for (let i = 1; i <= 28; i += 1) out[shiftDateKey('2026-10-20', -i)] = { hrv: 50, restingHeartRate: 60 };
    return out;
  };

  it('shows the score, worked out from the daily record and the training load, when there is enough to go on', async () => {
    mockHealth.readingsHistory = { ...usual(), '2026-10-20': { hrv: 55, restingHeartRate: 57, sleepHours: 7 } };
    const { getByTestId } = await open();
    expect(getByTestId('readiness-score').props.children).toBe('94'); // HRV 100 x 35, resting HR 100 x 25, sleep 75 x 25, load 100 x 15
    expect(getByTestId('readiness-label').props.children).toBe('High');
    expect(getByTestId('readiness-detail-load').props.children).toBe('1.10 this week against your usual week');
    expect(getByTestId('readiness-detail-hrv').props.children).toBe('55 ms today, 50 ms usual (+10%)');
  });

  it('leaves the training load out until there is enough history to work it out', async () => {
    mockLoad = TOO_EARLY;
    mockHealth.readingsHistory = { ...usual(), '2026-10-20': { hrv: 55, restingHeartRate: 57, sleepHours: 7 } };
    const { getByTestId } = await open();
    expect(getByTestId('readiness-score').props.children).toBe('93');
    expect(getByTestId('readiness-detail-load').props.children).toBe('Needs about a week of workouts, runs or hikes');
  });

  it('follows the training load when it changes', async () => {
    mockHealth.readingsHistory = { ...usual(), '2026-10-20': { hrv: 50, restingHeartRate: 60, sleepHours: 8 } };
    const utils = await open();
    expect(utils.getByTestId('readiness-score').props.children).toBe('85'); // (35 x 75 + 25 x 75 + 25 x 100 + 15 x 100) / 100
    mockLoad = HARDER; // 1.4
    mockWorkouts.completedWorkouts = [{ id: 'w1' }];
    utils.rerender(<HealthScreen />);
    await act(async () => {});
    expect(utils.getByTestId('readiness-detail-load').props.children).toBe('1.40 this week against your usual week');
    expect(utils.getByTestId('readiness-score').props.children).toBe('81'); // load now 75: (35 x 75 + 25 x 75 + 25 x 100 + 15 x 75) / 100 = 81.25
  });

  it('uses the name of the HRV the connected source gives', async () => {
    mockHealth.rookRecovery = APPLE;
    mockHealth.readingsHistory = { ...usual(), '2026-10-20': { hrv: 50, sleepHours: 8 } };
    const { getByTestId } = await open();
    expect(within(getByTestId('readiness-row-hrv')).getByText('HRV (SDNN)')).toBeTruthy();
  });

  it('says what it is waiting for, with no number, before there is enough history', async () => {
    mockHealth.readingsHistory = { '2026-10-20': { sleepHours: 7 }, '2026-10-19': { hrv: 48 } };
    const { getByTestId, queryByTestId } = await open();
    expect(getByTestId('readiness-not-ready')).toBeTruthy();
    expect(queryByTestId('readiness-score')).toBeNull();
  });

  it('is not on the page at all with no readings', async () => {
    const { queryByTestId } = await open();
    expect(queryByTestId('readiness-card')).toBeNull();
  });

  it('sits between Recovery and Training Load', async () => {
    mockHealth.readingsHistory = { ...usual(), '2026-10-20': { hrv: 55, restingHeartRate: 57, sleepHours: 7 } };
    const { UNSAFE_getAllByType } = await open();
    const texts = UNSAFE_getAllByType(Text).map((node) => node.props.children).filter((c) => typeof c === 'string');
    const at = (title) => texts.indexOf(title);
    expect(at('Recovery')).toBeGreaterThan(-1);
    expect(at('Recovery')).toBeLessThan(at('Readiness'));
    expect(at('Readiness')).toBeLessThan(at('Training Load'));
  });

  it('counts today in the person\'s own time', async () => {
    jest.setSystemTime(new Date(2026, 9, 21, 0, 5));
    mockHealth.readingsHistory = { ...usual(), '2026-10-20': { hrv: 55, restingHeartRate: 57, sleepHours: 7 } };
    const { queryByTestId } = await open();
    expect(queryByTestId('readiness-score')).toBeNull(); // 21 October has no readings yet
  });
});

describe('the Sleep row under Health Metrics', () => {
  beforeEach(() => { jest.setSystemTime(new Date(2026, 9, 20, 15, 0)); });

  it('is a dash when no sleep has been read', async () => {
    const { getByTestId } = await open();
    expect(getByTestId('metric-sleep').props.children).toBe(DASH);
  });

  it('shows last night\'s sleep from the daily record when the wearable has none, which is the case for Apple Health', async () => {
    mockHealth.rookRecovery = APPLE;
    mockHealth.readingsHistory = { '2026-10-20': { sleepHours: 7.44 }, '2026-10-19': { sleepHours: 5 } };
    const { getByTestId } = await open();
    expect(getByTestId('metric-sleep').props.children).toBe('7.4h');
    expect(pickStyle(getByTestId('metric-bar-sleep'), 'width')).toBe('93%'); // 7.44 of 8 hours
  });

  it('shows the wearable\'s sleep when it has one', async () => {
    mockHealth.rookRecovery = { sleepHours: 8.26, source: 'WHOOP' };
    mockHealth.readingsHistory = { '2026-10-20': { sleepHours: 7.44 } };
    const { getByTestId } = await open();
    expect(getByTestId('metric-sleep').props.children).toBe('8.3h');
    expect(pickStyle(getByTestId('metric-bar-sleep'), 'width')).toBe('100%'); // a full night fills the bar and no more
  });

  it('does not show an earlier day\'s sleep as today\'s', async () => {
    mockHealth.readingsHistory = { '2026-10-19': { sleepHours: 6.5 } };
    const { getByTestId } = await open();
    expect(getByTestId('metric-sleep').props.children).toBe(DASH);
    expect(pickStyle(getByTestId('metric-bar-sleep'), 'width')).toBe('0%');
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
    expect(within(getByTestId('recovery-hrv')).getByText('HRV (SDNN)')).toBeTruthy();
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
