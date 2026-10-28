// The Recommended Workouts row on the Home screen. It used to be four invented workouts (HIIT Blast, Morning Yoga, Strength Core, Cardio Mix)
// that opened pages that do not exist. Now every card is a real session from the Today's Session engine, worked out from the person's own
// workouts, runs, hikes and profile, and tapping one opens that session with its time and equipment. The stores and the engine are the real ones.
// jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  collection: jest.fn((db, ...path) => ({ path: path.join('/') })),
  doc: jest.fn((db, ...path) => ({ path: path.join('/') })),
  query: jest.fn((...parts) => ({ query: parts })),
  orderBy: jest.fn((field, dir) => ({ orderBy: field, dir })),
  limit: jest.fn((n) => ({ limit: n })),
  where: jest.fn((field, op, value) => ({ where: field, op, value })),
  documentId: jest.fn(() => '__name__'),
  getDocs: jest.fn(async () => ({ docs: [] })),
  getDoc: jest.fn(async () => ({ exists: () => false })),
  setDoc: jest.fn(async () => undefined),
}));
// No wearable is connected: Home asks both for today's recovery and gets nothing.
jest.mock('../services/rookService', () => ({ rookService: { getTodayRecovery: jest.fn(async () => null) } }));
jest.mock('../services/appleHealthService', () => ({ appleHealthService: { getTodayRecovery: jest.fn(async () => null), isAvailable: jest.fn(async () => false) } }));
jest.mock('expo-location', () => ({}), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Circle: 'Circle' }), { virtual: true });
jest.mock('react-native-chart-kit', () => ({ LineChart: 'LineChart', BarChart: 'BarChart' }), { virtual: true });
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => 'Icon' }), { virtual: true });
jest.mock('expo-router', () => {
  const push = jest.fn();
  const router = { push };
  return { Stack: { Screen: () => null }, useRouter: () => router, router };
}, { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/src/components/LoadingSkeleton', () => () => null);
jest.mock('@/components/StrengthScoreWidget', () => () => null);
jest.mock('@/components/FastingWidget', () => () => null);
jest.mock('@/components/MusicWidget', () => () => null);
jest.mock('@/components/WidgetEditorModal', () => () => null);
jest.mock('@/components/TodayBriefCard', () => () => null);

import { router } from 'expo-router';
import Hq from '../app/hq';
import * as sessionService from '../services/sessionService';
import { useUserStore } from '../store/userStore';
import { useWorkoutStore } from '../store/workoutStore';
import { useRunningStore } from '../store/runningStore';
import { useHikingStore } from '../store/hikingStore';
import { useHomeWidgetsStore } from '../store/homeWidgetsStore';
import { useTrainingFeedbackStore } from '../store/trainingFeedbackStore';
import { getDefaultWidgetLayout } from '../lib/homeWidgets';
import { buildHomeCards } from '../lib/homeRecommendations';
import { emptyFeedback, excludeExercise, feedbackKey } from '../lib/trainingFeedback';
import { pickSession } from '../lib/sessionPicker';
import { MUSCLES } from '../lib/muscleVocabulary';

const EVENING = new Date('2026-10-15T01:30:00Z');
const lift = (name, n) => ({ name, sets: n, done: true, performed: Array.from({ length: n }, () => ({ weight: 100, reps: 8, rpe: 'hard' })) });
const user = (over = {}) => ({ uid: 'u1', name: 'Cj', fitnessLevel: 'intermediate', preferences: { preferredDuration: '30min' }, ...over });

beforeAll(() => new Promise((resolve) => setTimeout(resolve, 20)));
beforeEach(() => {
  useWorkoutStore.setState({ completedWorkouts: [] });
  useRunningStore.setState({ runs: [] });
  useHikingStore.setState({ completedHikes: [] });
  useTrainingFeedbackStore.setState({ feedback: emptyFeedback() });
  useHomeWidgetsStore.setState({ layout: getDefaultWidgetLayout() });
  router.push.mockClear();
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

const openHome = async (person = user()) => {
  useUserStore.setState({ user: person });
  jest.useFakeTimers({ now: EVENING, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  const utils = render(<Hq />);
  await act(async () => {});
  return utils;
};

// What the row should show for the stores as they are now, worked out by the engine itself.
const expectedCards = (person = user(), feedback = emptyFeedback()) => buildHomeCards({
  inputs: sessionService.readSessionInputs({ user: person, now: EVENING, feedback }),
  preferredMinutes: 30,
}).cards;

describe('Recommended Workouts on Home', () => {
  it('shows real sessions from the engine, with their time, exercises and equipment', async () => {
    const utils = await openHome();
    const cards = expectedCards();
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(utils.getByText('Recommended Workouts')).toBeTruthy();
    cards.forEach((c) => {
      expect(utils.getAllByText(c.title).length).toBeGreaterThan(0);
      expect(utils.getAllByText(c.focus).length).toBeGreaterThan(0);
      expect(utils.getAllByText(c.detail).length).toBeGreaterThan(0);
      expect(utils.getAllByText(c.equipmentLabel).length).toBeGreaterThan(0);
      expect(utils.getAllByText(c.preview).length).toBeGreaterThan(0);
    });
    expect(utils.getByText('TODAY')).toBeTruthy();
  });

  it('no longer shows the four invented workouts', async () => {
    const utils = await openHome();
    ['HIIT Blast', 'Morning Yoga', 'Strength Core', 'Cardio Mix'].forEach((name) => expect(utils.queryByText(name)).toBeNull());
  });

  it('opens that session on the session screen, with the time and equipment of the card that was tapped', async () => {
    const utils = await openHome();
    const [first, ...others] = expectedCards();
    fireEvent.press(utils.getByLabelText(`${first.title}, ${first.focus}, ${first.detail}, ${first.equipmentLabel}`));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/workout/session', params: { minutes: '30', equipment: 'gym' } });
    const other = others.find((c) => c.equipment === 'dumbbells');
    if (other) {
      fireEvent.press(utils.getByLabelText(`${other.title}, ${other.focus}, ${other.detail}, ${other.equipmentLabel}`));
      expect(router.push).toHaveBeenLastCalledWith({ pathname: '/workout/session', params: { minutes: '30', equipment: 'dumbbells' } });
    }
  });

  it('uses the length of session on the profile', async () => {
    const utils = await openHome(user({ preferences: { preferredDuration: '45min' } }));
    const [first] = buildHomeCards({
      inputs: sessionService.readSessionInputs({ user: user(), now: EVENING }), preferredMinutes: 45,
    }).cards;
    fireEvent.press(utils.getByLabelText(`${first.title}, ${first.focus}, ${first.detail}, ${first.equipmentLabel}`));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/workout/session', params: { minutes: '45', equipment: 'gym' } });
  });

  it('changes while the screen is open when a workout is finished', async () => {
    const utils = await openHome();
    const before = expectedCards()[0];
    expect(utils.getAllByText(before.preview).length).toBeGreaterThan(0);
    await act(async () => {
      useWorkoutStore.setState({
        completedWorkouts: [{ id: 'w1', completedAt: new Date(EVENING.getTime() - 3600000).toISOString(), exercises: [lift('Back Squat', 6), lift('Romanian Deadlift', 5), lift('Leg Press', 5)] }],
      });
    });
    const after = expectedCards()[0];
    expect(after.preview).not.toBe(before.preview);
    expect(utils.getAllByText(after.preview).length).toBeGreaterThan(0);
    expect(utils.queryAllByText(before.preview)).toHaveLength(0);
  });

  it('changes when the person tells the engine to never pick an exercise', async () => {
    const utils = await openHome();
    const before = expectedCards()[0];
    const firstName = before.preview.split(', ')[0];
    const target = sessionService.readSessionInputs({ user: user(), now: EVENING });
    const pick = pickSession({ ...target, minutes: 30, equipment: 'gym' }).exercises.find((x) => x.name === firstName);
    const feedback = excludeExercise(emptyFeedback(), feedbackKey(pick), { name: pick.name, ladder: false });
    await act(async () => { useTrainingFeedbackStore.setState({ feedback }); });
    const after = expectedCards(user(), feedback)[0];
    expect(after.preview).not.toContain(firstName);
    expect(utils.getAllByText(after.preview).length).toBeGreaterThan(0);
  });

  it('says why there is no workout, in the engine\'s words, when every muscle is still recovering, and opens Today\'s Session', async () => {
    const real = sessionService.readSessionInputs;
    const tired = Object.fromEntries(MUSCLES.map((m) => [m, 0]));
    jest.spyOn(sessionService, 'readSessionInputs').mockImplementation((o) => ({ ...real(o), recovery: tired }));
    const tiredInputs = { ...real({ user: user(), now: EVENING }), recovery: tired };
    const utils = await openHome();
    const message = pickSession({ ...tiredInputs, minutes: 30, equipment: 'gym' }).message;
    expect(message).toMatch(/still recovering/);
    expect(utils.getByText(message)).toBeTruthy();
    expect(utils.queryByText('TODAY')).toBeNull();
    fireEvent.press(utils.getByLabelText("Open Today's Session"));
    expect(router.push).toHaveBeenLastCalledWith('/workout/session');
  });

  it('still shows the row, with a way into Today\'s Session, if the engine cannot be read', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(sessionService, 'readSessionInputs').mockImplementation(() => { throw new Error('store failed'); });
    const utils = await openHome();
    expect(utils.getByText('Recommended Workouts')).toBeTruthy();
    expect(utils.getByText("A session couldn't be worked out right now. Tap to open Today's Session.")).toBeTruthy();
    fireEvent.press(utils.getByLabelText("Open Today's Session"));
    expect(router.push).toHaveBeenLastCalledWith('/workout/session');
  });
});

describe('Invite your friends on Home', () => {
  it('opens the invite screen, where the person has a code to share', async () => {
    const utils = await openHome();
    fireEvent.press(utils.getByLabelText('Invite your friends'));
    expect(router.push).toHaveBeenLastCalledWith('/invite');
  });

  it('promises what the app really gives (Pro days), not the free exercise nothing ever delivered', async () => {
    const utils = await openHome();
    expect(utils.getByText('Share your code. When a friend joins, you both get free Pro days.')).toBeTruthy();
    expect(utils.queryByText(/free exercise/i)).toBeNull();
  });

  it('no longer sends the person to Community', async () => {
    const utils = await openHome();
    fireEvent.press(utils.getByLabelText('Invite your friends'));
    expect(router.push).not.toHaveBeenCalledWith('/community');
  });
});
