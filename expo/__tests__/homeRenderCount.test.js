// How often the Home screen (app/hq.jsx) draws itself again. It reads from nine stores; before this build it subscribed to each one whole
// (`const { completedWorkouts } = useWorkoutStore();`), so any change in a store, however small (a spinner flag flipping while data loads,
// a music position ticking), drew all of Home again, its widgets included. It now asks each store for just the pieces it shows, so a change
// in something it does not show draws nothing, and a change in something it does show still updates the screen.
//
// The widgets, the icons and the charts are stand-ins here: what is counted is the screen itself, with the real stores around it.
import React, { Profiler } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {}, auth: {}, storage: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('expo-location', () => ({}), { virtual: true });

jest.mock('expo-router', () => {
  const { View } = require('react-native');
  const Stack = ({ children }) => children ?? null;
  Stack.Screen = () => <View />;
  return { Stack, useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) };
}, { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: ({ children }) => <View>{children}</View> };
}, { virtual: true });
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: () => <Text>icon</Text> };
}, { virtual: true });
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: ({ children }) => <View>{children}</View>, Circle: () => <View /> };
}, { virtual: true });
jest.mock('react-native-chart-kit', () => ({ LineChart: () => null, BarChart: () => null }), { virtual: true });
jest.mock('lucide-react-native', () => new Proxy({}, { get: (_t, name) => (name === '__esModule' ? false : () => null) }), { virtual: true });

// Every widget on Home draws its own data from its own stores; here each is a plain stand-in.
// (A function declaration, not a const: the jest.mock factories below run when the screen is imported, before a const would be set.)
function mockStandIn(name) { return () => { const { Text } = require('react-native'); return <Text>{name}</Text>; }; }
jest.mock('@/src/components/LoadingSkeleton', () => ({ __esModule: true, default: () => null }));
// The two cards that are given the screen's worked-out numbers keep the last ones they were given, for a test to look at.
const mockHanded = { calories: null, steps: null };
jest.mock('@/components/SwipeableCaloriesContent', () => ({ __esModule: true, default: (props) => { mockHanded.calories = props; return null; } }));
jest.mock('@/components/SwipeableStepsContent', () => ({ __esModule: true, default: (props) => { mockHanded.steps = props; return null; } }));
jest.mock('@/components/PromptModal', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/WidgetEditorModal', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/TodayBriefCard', () => ({ __esModule: true, default: mockStandIn('brief') }));
jest.mock('@/components/StrengthScoreWidget', () => ({ __esModule: true, default: mockStandIn('strength') }));
jest.mock('@/components/FastingWidget', () => ({ __esModule: true, default: mockStandIn('fasting') }));
jest.mock('@/components/MusicWidget', () => ({ __esModule: true, default: mockStandIn('music') }));
jest.mock('@/components/StreakWidget', () => ({ __esModule: true, default: mockStandIn('streak') }));
jest.mock('@/components/NextUpWidget', () => ({ __esModule: true, default: mockStandIn('nextup') }));
jest.mock('@/components/BattlePassWidget', () => ({ __esModule: true, default: mockStandIn('battlepass') }));
jest.mock('@/components/TrainingLoadWidget', () => ({ __esModule: true, default: mockStandIn('load') }));
jest.mock('@/components/MusclesWidget', () => ({ __esModule: true, default: mockStandIn('muscles') }));
jest.mock('@/components/WorkoutHistoryWidget', () => ({ __esModule: true, default: mockStandIn('history') }));
jest.mock('@/components/RunningLogWidget', () => ({ __esModule: true, default: mockStandIn('runlog') }));
jest.mock('@/components/RankChallengeWidget', () => ({ __esModule: true, default: mockStandIn('rank') }));
jest.mock('@/components/MacrosWidget', () => ({ __esModule: true, default: mockStandIn('macros') }));
jest.mock('@/components/WeightWidget', () => ({ __esModule: true, default: mockStandIn('weight') }));

// What the Today's Session engine would suggest is not what is measured here. Its note carries a number from the Coach feedback store,
// so a test can tell whether the Recommended Workouts section was drawn again with fresh data.
jest.mock('@/services/sessionService', () => ({ readSessionInputs: ({ feedback }) => ({ n: feedback?.n ?? 0 }) }));
jest.mock('@/lib/homeRecommendations', () => ({ buildHomeCards: ({ inputs }) => ({ cards: [], notice: `Session note ${inputs.n}` }) }));

import HQScreen from '../app/hq';
import { useUserStore } from '../store/userStore';
import { useExpStore } from '../store/expStore';
import { useWorkoutStore } from '../store/workoutStore';
import { useHealthStore } from '../store/healthStore';
import { useRunningStore } from '../store/runningStore';
import { useHomeWidgetsStore } from '../store/homeWidgetsStore';
import { useNutritionStore } from '../store/nutritionStore';
import { useHikingStore } from '../store/hikingStore';
import { useTrainingFeedbackStore } from '../store/trainingFeedbackStore';
import { localDateKey } from '../lib/localDate';

let commits;
const onRender = () => { commits += 1; };

/** Draws Home and lets whatever it starts on its own settle, then starts counting. */
async function drawHome() {
  commits = 0;
  render(
    <Profiler id="home" onRender={onRender}>
      <HQScreen />
    </Profiler>
  );
  await act(async () => {});
  commits = 0;
}

/** How many times Home is drawn again by this change. */
async function drawsFrom(change) {
  const before = commits;
  await act(async () => { change(); });
  return commits - before;
}

// Every test starts from the stores as they were when the file loaded, so one test's changes are not there for the next.
const STORES = [useUserStore, useExpStore, useWorkoutStore, useHealthStore, useRunningStore, useHomeWidgetsStore, useNutritionStore, useHikingStore, useTrainingFeedbackStore];
const INITIAL = STORES.map((store) => store.getState());

beforeEach(() => {
  STORES.forEach((store, i) => store.setState(INITIAL[i], true));
  // Nobody is signed in, so Home starts no loading of its own; every load would otherwise reach for the network.
  useUserStore.setState({ user: null });
});

describe('Home does not draw again for a change it does not show', () => {
  // Each of these is the kind of change that happens all the time: a flag that flips while a store loads, a field the screen never reads.
  it.each([
    ['the user store (loading)', () => useUserStore.setState({ isLoading: true })],
    ['the XP store (a field Home does not show)', () => useExpStore.setState({ mealXpDate: '2026-11-04' })],
    ['the workout store (loading)', () => useWorkoutStore.setState({ isLoading: true })],
    ['the workout store (a run in progress)', () => useWorkoutStore.setState({ currentRun: { id: 'r1' } })],
    ['the health store (loading)', () => useHealthStore.setState({ isLoading: true })],
    ['the running store (loading)', () => useRunningStore.setState({ isLoading: true })],
    ['the Home widgets store (loading)', () => useHomeWidgetsStore.setState({ isLoading: true })],
  ])('after a change in %s', async (_name, change) => {
    await drawHome();
    expect(await drawsFrom(change)).toBe(0);
  });

  it('stays still through a whole pull-to-refresh worth of loading flags', async () => {
    await drawHome();
    // Pulling to refresh loads four of these stores, and each one flips its loading flag on and then off again, one at a time.
    let draws = 0;
    for (const flag of [true, false]) {
      for (const store of [useUserStore, useWorkoutStore, useHealthStore, useRunningStore]) {
        draws += await drawsFrom(() => store.setState({ isLoading: flag }));
      }
    }
    expect(draws).toBe(0);
  });
});

describe('Home still updates for a change it does show', () => {
  it('shows today\'s XP as soon as it changes', async () => {
    await drawHome();
    expect(screen.getByText('Total Daily XP')).toBeTruthy();
    const draws = await drawsFrom(() => useExpStore.setState({ dailyXp: 120, dailyXpDate: localDateKey() }));
    expect(draws).toBeGreaterThan(0);
    expect(screen.getByText('120')).toBeTruthy();
  });

  // One at a time: changed together, either one's redraw would hide the other going stale.
  it('shows the level in the open XP card as soon as it changes', async () => {
    await drawHome();
    fireEvent.press(screen.getByText('Total Daily XP'));
    const draws = await drawsFrom(() => useExpStore.setState({ expSystem: { ...useExpStore.getState().expSystem, level: 5 } }));
    expect(draws).toBeGreaterThan(0);
    expect(screen.getByText('Level 5')).toBeTruthy();
  });

  it('shows the XP to the next level in the open XP card as soon as it changes', async () => {
    await drawHome();
    fireEvent.press(screen.getByText('Total Daily XP'));
    const draws = await drawsFrom(() => useExpStore.setState({ expSystem: { ...useExpStore.getState().expSystem, expToNextLevel: 340 } }));
    expect(draws).toBeGreaterThan(0);
    expect(screen.getByText('340 XP remaining')).toBeTruthy();
  });

  it('shows today\'s XP as a whole number when the store holds a fraction', async () => {
    await drawHome();
    await drawsFrom(() => useExpStore.setState({ dailyXp: 120.6, dailyXpDate: localDateKey() }));
    expect(screen.getByText('121')).toBeTruthy();
    expect(screen.queryByText('120.6')).toBeNull();
  });

  it('shows the glasses of water as soon as they change, and logs a glass when the buttons are pressed', async () => {
    await drawHome();
    expect(await drawsFrom(() => useHealthStore.setState({ hydration: { glasses: 3, target: 8, date: localDateKey() } }))).toBeGreaterThan(0);
    expect(screen.getByText('3 / 8')).toBeTruthy();
    const addGlass = jest.fn();
    const removeGlass = jest.fn();
    await drawsFrom(() => useHealthStore.setState({ addGlass, removeGlass }));
    fireEvent.press(screen.getByText('Hydration'));
    fireEvent.press(screen.getByText('+250ml'));
    fireEvent.press(screen.getByText('+500ml'));
    fireEvent.press(screen.getByLabelText('Remove a glass of water'));
    expect(addGlass).toHaveBeenCalledTimes(3); // one glass, then two
    expect(removeGlass).toHaveBeenCalledTimes(1);
  });

  it('shows the resting heart rate and the hours slept from the wearable as soon as they arrive', async () => {
    await drawHome();
    const draws = await drawsFrom(() => useHealthStore.setState({ rookRecovery: { restingHeartRate: 55, hrv: 62, sleepHours: 7.5, source: 'Test watch' } }));
    expect(draws).toBeGreaterThan(0);
    expect(screen.getByText('55')).toBeTruthy();
    expect(screen.getByText('7.5')).toBeTruthy();
  });

  it('hands the steps card fresh numbers when the steps history changes', async () => {
    await drawHome();
    fireEvent.press(screen.getAllByText('Steps')[0]); // opens the card, which hands its numbers to the stand-in
    const before = mockHanded.steps.metrics; // taken once the card is open: before that there is nothing handed over to compare with
    await drawsFrom(() => useHealthStore.setState({ stepsHistory: { [localDateKey()]: 8000 } }));
    expect(mockHanded.steps.metrics).not.toBe(before);
  });

  it('hands the calories card fresh numbers when a workout is finished', async () => {
    await drawHome();
    fireEvent.press(screen.getByText('Calories'));
    const before = mockHanded.calories.metrics;
    await drawsFrom(() => useWorkoutStore.setState({ completedWorkouts: [{ id: 'w1', completedAt: new Date().toISOString(), caloriesBurned: 250 }] }));
    expect(mockHanded.calories.metrics).not.toBe(before);
    expect(mockHanded.calories.metrics.todayCalories).toBeGreaterThanOrEqual(250);
  });

  it('draws again when the XP history moves, so the open XP card\'s chart is fresh', async () => {
    await drawHome();
    expect(await drawsFrom(() => useExpStore.setState({ xpHistory: { [localDateKey()]: 90 } }))).toBeGreaterThan(0);
  });

  it('draws again when the sleep reading changes (the Recommended Workouts are worked out again from it)', async () => {
    await drawHome();
    expect(await drawsFrom(() => useHealthStore.setState({ sleep: { hours: 7, quality: 80, date: localDateKey() } }))).toBeGreaterThan(0);
  });

  it('shows the steps as soon as they change', async () => {
    await drawHome();
    const draws = await drawsFrom(() => useHealthStore.setState({ steps: 4321 }));
    expect(draws).toBeGreaterThan(0);
    expect(screen.getByText('4,321')).toBeTruthy();
  });

  it('shows the floors climbed as soon as they change', async () => {
    await drawHome();
    await drawsFrom(() => useHealthStore.setState({ flightsClimbed: 7 }));
    expect(screen.getByText('7')).toBeTruthy();
  });

  it('shows the name when the person is signed in', async () => {
    await drawHome();
    const draws = await drawsFrom(() => useUserStore.setState({ user: { name: 'Cj', email: 'cj@example.com' } }));
    expect(draws).toBeGreaterThan(0);
    expect(screen.getByText('Hello Cj!')).toBeTruthy();
  });

  it('draws again for a finished workout, a run, a hike, the nutrition diary, what the Coach was told, and the widget layout', async () => {
    await drawHome();
    for (const change of [
      () => useWorkoutStore.setState({ completedWorkouts: [{ id: 'w1', completedAt: '2026-11-04T12:00:00Z', caloriesBurned: 200 }] }),
      () => useRunningStore.setState({ runs: [{ id: 'r1', startTime: '2026-11-04T12:00:00Z', calories: 300 }] }),
      () => useHikingStore.setState({ completedHikes: [{ id: 'h1', startTime: '2026-11-04T12:00:00Z' }] }),
      () => useNutritionStore.setState({ meals: [] }),
      () => useTrainingFeedbackStore.setState({ feedback: { changed: true } }),
      () => useHomeWidgetsStore.setState({ layout: useHomeWidgetsStore.getState().layout.map((w) => (w.id === 'music' ? { ...w, enabled: false } : w)) }),
    ]) {
      expect(await drawsFrom(change)).toBeGreaterThan(0);
    }
  });

  it('draws the sections again with fresh data: the Recommended Workouts note follows the Coach feedback', async () => {
    await drawHome();
    expect(screen.getByText('Session note 0')).toBeTruthy();
    await drawsFrom(() => useTrainingFeedbackStore.setState({ feedback: { n: 2 } }));
    expect(screen.getByText('Session note 2')).toBeTruthy();
    expect(screen.queryByText('Session note 0')).toBeNull();
  });

  it('still draws the grid of cards and every section below it when Home opens', async () => {
    await drawHome();
    for (const card of ['Calories', 'Heart', 'Steps', 'Sleep', 'Total Daily XP', 'Hydration']) expect(screen.queryAllByText(card).length).toBeGreaterThan(0);
    for (const section of ['history', 'runlog', 'Session note 0', 'Invite your friends', 'rank', 'macros', 'weight']) expect(screen.getByText(section)).toBeTruthy();
  });

  it('takes a widget off the screen when it is switched off in the layout', async () => {
    await drawHome();
    expect(screen.queryByText('weight')).toBeTruthy();
    await drawsFrom(() => useHomeWidgetsStore.setState({ layout: useHomeWidgetsStore.getState().layout.map((w) => (w.id === 'weight' ? { ...w, enabled: false } : w)) }));
    expect(screen.queryByText('weight')).toBeNull();
  });
});
