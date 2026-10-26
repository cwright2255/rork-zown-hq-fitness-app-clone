// Today's Session on the phone (app/workout/session.jsx): the engine's session shows at once; a moment later the AI's wording replaces the name
// and the reasons, but only the parts that pass the checks, only on the session it was made for, and never the exercises, sets, reps or weights.
// The AI call is stood in for (services/aiService.js generateSessionWording); the checks, the keeping and the screen are the real ones.
//
// The four controls on each card (More, Less, Swap, Exclude) are tested here with the real feedback store (store/trainingFeedbackStore.js, on stand-in
// storage); only the picking of the alternatives is stood in for (services/sessionService.js getSwapOptions and swapInExercise), because lib/sessionPicker.js
// and the service have their own tests.
import React from 'react';
import { Text, Pressable, Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ useRouter: () => global.__router }), { virtual: true });
jest.mock('@/components/ScreenHeader', () => ({ __esModule: true, default: ({ title }) => { const { Text: T } = require('react-native'); return <T>{title}</T>; } }));
jest.mock('@/components/PrimaryButton', () => ({
  __esModule: true,
  default: ({ title, onPress }) => { const { Pressable: P, Text: T } = require('react-native'); return <P testID="start" onPress={onPress}><T>{title}</T></P>; },
}));
jest.mock('@/store/userStore', () => {
  const useUserStore = (select) => select({ user: global.__user });
  useUserStore.getState = () => ({ user: global.__user });
  return { useUserStore };
});
jest.mock('@/store/workoutStore', () => ({ useWorkoutStore: { getState: () => ({ addWorkout: (...a) => global.__addWorkout(...a) }) } }));
jest.mock('@/store/settingsStore', () => ({ useSettingsStore: (select) => select({ weightUnits: global.__weightUnits }) }));
jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((...args) => ({ path: args.slice(1).join('/') })),
  getDoc: jest.fn(async () => ({ exists: () => false })),
  setDoc: jest.fn(async () => undefined),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('@/services/sessionService', () => ({
  refreshSessionSources: jest.fn(async () => undefined),
  buildTodaySession: jest.fn(),
  getSwapOptions: jest.fn(() => []),
  swapInExercise: jest.fn(async (session, id, pick) => require('../lib/sessionPicker').replaceExercise(session, id, pick)),
}));
jest.mock('@/services/aiService', () => ({ generateSessionWording: jest.fn() }));

import TodaySessionScreen from '../app/workout/session';
import { buildTodaySession, getSwapOptions, swapInExercise } from '@/services/sessionService';
import { getDoc } from 'firebase/firestore';
import { useTrainingFeedbackStore } from '../store/trainingFeedbackStore';
import { emptyFeedback, feedbackKey } from '../lib/trainingFeedback';
import { emptyMeasures } from '../lib/trainingMeasures';
import { generateSessionWording } from '@/services/aiService';
import { clearWordingCache } from '../services/sessionWordingService';
import { WORDING_RULES, WORDING_CAPTION } from '../lib/sessionWording';

const exercise = (id, name, extra = {}) => ({
  id, name, sets: 3, role: 'compound', timed: false, bodyweight: false, repRange: { min: 8, max: 10 }, reps: '8-10', holdSeconds: null,
  restSeconds: 120, workSeconds: 45, weight: null, unit: null, target: null, detail: null, primary: ['chest'], secondary: [], muscleGroups: ['chest'],
  reason: "Chest: fully rested, 6 sets short of this week's 14-set aim.", facts: { muscle: 'chest', recovered: 100, done: 8, short: 6, aim: 14 }, ...extra,
});
const sessionFor = (minutes) => ({
  status: 'ok', message: null, name: 'Chest and Core', goal: 'muscle', level: 'intermediate', minutes, exactMinutes: minutes, totalSets: 6,
  leftOutFor: [], tired: [], source: 'engine',
  exercises: [
    exercise('barbell-bench-press', 'Barbell Bench Press', { sets: minutes >= 45 ? 4 : 3, weight: 60, unit: 'kg', target: '60 kg x 8-10', detail: 'Last time: 57.5 kg x 10' }),
    exercise('plank', 'Plank', { timed: true, reps: null, repRange: null, holdSeconds: 40, reason: 'Core: fully rested, no sets logged this week (aim 14).', facts: { muscle: 'core', recovered: 100, done: 0, short: 14, aim: 14 } }),
  ],
});
const reply = (over = {}) => ({
  name: 'Chest Day',
  picks: [
    { id: 'barbell-bench-press', why: 'Your chest is fully rested and 6 sets short of its 14-set aim.' },
    { id: 'plank', why: 'Core work with no sets logged this week.' },
  ],
  ...over,
});
const ENGINE_BENCH = "Chest: fully rested, 6 sets short of this week's 14-set aim.";

const texts = (utils) => utils.UNSAFE_getAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const has = (utils, text) => texts(utils).includes(text);
const flush = async () => { for (let i = 0; i < 12; i += 1) await act(async () => { await Promise.resolve(); }); };
const wait = async (ms) => { await act(async () => { jest.advanceTimersByTime(ms); }); await flush(); };
const show = async () => {
  const utils = render(<TodaySessionScreen />);
  await flush();
  return utils;
};
const delay = WORDING_RULES.delayMs;

beforeEach(() => {
  jest.useFakeTimers();
  clearWordingCache();
  jest.clearAllMocks();
  global.__router = { replace: jest.fn() };
  global.__user = { uid: 'u1', name: 'Sam', preferences: { preferredDuration: '30min' } };
  global.__weightUnits = 'metric';
  global.__addWorkout = jest.fn(async (w) => ({ ...w, id: 'w1' }));
  buildTodaySession.mockImplementation(async ({ minutes }) => sessionFor(minutes));
  getSwapOptions.mockReturnValue([]);
  generateSessionWording.mockResolvedValue(reply());
  useTrainingFeedbackStore.setState({ feedback: emptyFeedback(), measures: emptyMeasures(), updatedAt: '', syncUid: null });
});
afterEach(() => { jest.useRealTimers(); });

describe('the session before the words', () => {
  it('shows the engine\'s own name, reasons, sets and targets at once, with no caption, and has not asked the AI yet', async () => {
    const utils = await show();
    expect(has(utils, 'Chest and Core')).toBe(true);
    expect(has(utils, ENGINE_BENCH)).toBe(true);
    expect(has(utils, '3 x 8-10 reps')).toBe(true);
    expect(has(utils, 'Start at 60 kg x 8-10')).toBe(true);
    expect(has(utils, WORDING_CAPTION)).toBe(false);
    expect(generateSessionWording).not.toHaveBeenCalled();
  });
});

describe('the words', () => {
  it('swap in after the delay: the name and the reasons are the AI\'s, with the caption, and everything else is the engine\'s', async () => {
    const utils = await show();
    await wait(delay + 10);
    expect(generateSessionWording).toHaveBeenCalledTimes(1);
    expect(has(utils, 'Chest Day')).toBe(true);
    expect(has(utils, 'Chest and Core')).toBe(false);
    expect(has(utils, 'Your chest is fully rested and 6 sets short of its 14-set aim.')).toBe(true);
    expect(has(utils, ENGINE_BENCH)).toBe(false);
    expect(has(utils, WORDING_CAPTION)).toBe(true);
    // the engine's
    expect(has(utils, '3 x 8-10 reps')).toBe(true);
    expect(has(utils, '3 x 40s hold')).toBe(true);
    expect(has(utils, 'Start at 60 kg x 8-10')).toBe(true);
    expect(has(utils, 'Barbell Bench Press')).toBe(true);
    expect(has(utils, '2 exercises · 6 sets · about 30 min')).toBe(true);
  });

  it('are asked for with the unit in Settings, the session\'s figures and nothing about the person', async () => {
    await show();
    await wait(delay + 10);
    const { messages } = generateSessionWording.mock.calls[0][0];
    const brief = JSON.parse(messages[1].content);
    expect(brief.weightUnit).toBe('kg');
    expect(brief.equipment).toBe('a full gym');
    expect(brief.exercises.map((x) => x.id)).toEqual(['barbell-bench-press', 'plank']);
    expect(messages.map((m) => m.content).join('')).not.toMatch(/Sam|u1|email/);
  });

  it('are asked for in pounds for a person who uses pounds', async () => {
    global.__weightUnits = 'imperial';
    await show();
    await wait(delay + 10);
    expect(JSON.parse(generateSessionWording.mock.calls[0][0].messages[1].content).weightUnit).toBe('lb');
  });

  it('are not shown for the parts that failed their checks: that reason stays the engine\'s, the rest swap in', async () => {
    generateSessionWording.mockResolvedValue(reply({
      picks: [
        { id: 'barbell-bench-press', why: 'This is guaranteed to build your chest in 9 sets.' },
        { id: 'plank', why: 'Core work with no sets logged this week.' },
      ],
    }));
    const utils = await show();
    await wait(delay + 10);
    expect(has(utils, ENGINE_BENCH)).toBe(true);
    expect(has(utils, 'Core work with no sets logged this week.')).toBe(true);
    expect(has(utils, 'Chest Day')).toBe(true);
    expect(has(utils, WORDING_CAPTION)).toBe(true);
  });

  it('are not shown at all, and the caption is not, when nothing passes or the answer changes the session', async () => {
    for (const bad of [
      reply({ name: 'Day 4', picks: [{ id: 'plank', why: 'short' }] }),
      reply({ picks: [{ id: 'deadlift', why: 'Your back is rested for this one.' }] }),
      reply({ picks: [{ id: 'plank', sets: 5, why: 'Core work with no sets logged this week.' }] }),
      null, {}, { picks: 'x' },
    ]) {
      clearWordingCache();
      generateSessionWording.mockResolvedValue(bad);
      const utils = await show();
      await wait(delay + 10);
      expect({ bad, caption: has(utils, WORDING_CAPTION) }).toEqual({ bad, caption: false });
      expect(has(utils, 'Chest and Core')).toBe(true);
      expect(has(utils, ENGINE_BENCH)).toBe(true);
      utils.unmount();
    }
  });

  it('leave the engine\'s session as it is when the AI call fails', async () => {
    generateSessionWording.mockRejectedValue(new Error('offline'));
    const utils = await show();
    await wait(delay + 10);
    expect(has(utils, 'Chest and Core')).toBe(true);
    expect(has(utils, WORDING_CAPTION)).toBe(false);
  });

  it('show a note about a left-out injury area only when there is one to mention', async () => {
    buildTodaySession.mockImplementation(async ({ minutes }) => ({ ...sessionFor(minutes), leftOutFor: ['shoulder'] }));
    generateSessionWording.mockResolvedValue(reply({ note: 'Overhead pressing was left out because of your shoulder.' }));
    const utils = await show();
    await wait(delay + 10);
    expect(has(utils, 'Overhead pressing was left out because of your shoulder.')).toBe(true);
    expect(texts(utils).some((t) => t.startsWith('Left out because of the injuries you reported:'))).toBe(true);
  });

  it('do not show a note when there is nothing to mention', async () => {
    generateSessionWording.mockResolvedValue(reply({ note: 'Have a great workout today everyone.' }));
    const utils = await show();
    await wait(delay + 10);
    expect(has(utils, 'Have a great workout today everyone.')).toBe(false);
  });
});

describe('asking', () => {
  it('waits for the session to settle: tapping through the times asks once, for the last', async () => {
    const utils = await show();
    await wait(300);
    fireEvent.press(utils.getByText('45 min'));
    await flush();
    await wait(300);
    fireEvent.press(utils.getByText('60 min'));
    await flush();
    await wait(300);
    expect(generateSessionWording).not.toHaveBeenCalled();
    await wait(delay);
    expect(generateSessionWording).toHaveBeenCalledTimes(1);
    expect(JSON.parse(generateSessionWording.mock.calls[0][0].messages[1].content).minutes).toBe(60);
  });

  it('puts the words only on the session they were made for', async () => {
    let release;
    generateSessionWording.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve(reply({ name: 'First Wording' })); }));
    const utils = await show();
    await wait(delay + 10); // asked for the 30 minute session; the answer is not back yet
    fireEvent.press(utils.getByText('45 min'));
    await flush();
    await act(async () => { release(); });
    await flush();
    expect(has(utils, 'First Wording')).toBe(false);
    expect(has(utils, 'Chest and Core')).toBe(true);
    expect(has(utils, '4 x 8-10 reps')).toBe(true);
  });

  it('uses an answer already kept for a session shown before at once, without asking again', async () => {
    const utils = await show();
    await wait(delay + 10);
    expect(has(utils, 'Chest Day')).toBe(true);
    fireEvent.press(utils.getByText('45 min'));
    await flush();
    await wait(delay + 10);
    expect(generateSessionWording).toHaveBeenCalledTimes(2);
    generateSessionWording.mockClear();
    fireEvent.press(utils.getByText('30 min'));
    await flush();
    expect(has(utils, 'Chest Day')).toBe(true);
    await wait(delay + 10);
    expect(generateSessionWording).not.toHaveBeenCalled();
  });

  it('does not ask for a rest day or a session that cannot be built', async () => {
    buildTodaySession.mockImplementation(async () => ({ status: 'rest', message: 'Rest today.', name: 'Session', exercises: [], leftOutFor: [] }));
    let utils = await show();
    await wait(delay + 10);
    expect(has(utils, 'Rest today.')).toBe(true);
    utils.unmount();
    buildTodaySession.mockImplementation(async () => null);
    utils = await show();
    await wait(delay + 10);
    expect(generateSessionWording).not.toHaveBeenCalled();
  });

  it('does not ask while the session is loading', async () => {
    buildTodaySession.mockImplementation(() => new Promise(() => {}));
    render(<TodaySessionScreen />);
    await flush();
    await wait(delay * 3);
    expect(generateSessionWording).not.toHaveBeenCalled();
  });

  it('does not ask again when the screen is left before the delay is up', async () => {
    const utils = await show();
    await wait(delay - 200);
    utils.unmount();
    await wait(delay);
    expect(generateSessionWording).not.toHaveBeenCalled();
  });
});

describe('Start Workout', () => {
  it('saves the session with the AI\'s name when it is on, and the same exercises as without it', async () => {
    const utils = await show();
    await wait(delay + 10);
    await act(async () => { fireEvent.press(utils.getByTestId('start')); });
    await flush();
    expect(global.__addWorkout).toHaveBeenCalledTimes(1);
    const workout = global.__addWorkout.mock.calls[0][0];
    expect(workout.name).toBe('Chest Day');
    expect(workout.source).toBe('engine_session');
    expect(workout.exercises.map((x) => [x.name, x.sets])).toEqual([['Barbell Bench Press', 3], ['Plank', 3]]);
    expect(global.__router.replace).toHaveBeenCalledWith('/workout/w1');
  });

  it('saves the engine\'s name before the words are in', async () => {
    const utils = await show();
    await act(async () => { fireEvent.press(utils.getByTestId('start')); });
    await flush();
    expect(global.__addWorkout.mock.calls[0][0].name).toBe('Chest and Core');
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
// More, Less, Swap and Exclude

const BENCH = 'barbell-bench-press';
const PLANK = 'plank';
const dbPress = () => exercise('dumbbell-bench-press', 'Dumbbell Bench Press', { reason: 'Chest: the same muscle, with dumbbells.' });
const inclinePress = () => exercise('incline-dumbbell-press', 'Incline Dumbbell Press', { reason: 'Chest: upper chest, rested.' });
const fb = () => useTrainingFeedbackStore.getState().feedback;
const measures = () => useTrainingFeedbackStore.getState().measures;
const press = async (utils, label) => { await act(async () => { fireEvent.press(utils.getByLabelText(label)); }); await flush(); };
// What pressing the destructive button of the confirmation that was just put up does.
const confirmExclude = async () => {
  const buttons = Alert.alert.mock.calls[Alert.alert.mock.calls.length - 1][2];
  await act(async () => { buttons.find((b) => b.style === 'destructive').onPress(); });
  await flush();
};

describe('the four controls', () => {
  beforeEach(() => { jest.spyOn(Alert, 'alert').mockImplementation(() => {}); });
  afterEach(() => { jest.restoreAllMocks(); });

  it('are on every card, and are said in one line what they do', async () => {
    const utils = await show();
    ['Bench Press', 'Plank'].forEach((n) => {
      ['More', 'Less', 'Swap', 'Exclude'].forEach((c) => expect(utils.getByLabelText(`${c} ${n === 'Bench Press' ? 'Barbell Bench Press' : n}`)).toBeTruthy());
    });
    expect(texts(utils).some((t) => t.startsWith('More and Less change how often an exercise is picked'))).toBe(true);
  });

  describe('More and Less', () => {
    it('count at once, show which one is on, and never reshuffle the session on the screen', async () => {
      const utils = await show();
      buildTodaySession.mockClear();
      await press(utils, 'More Barbell Bench Press');
      expect(fb().votes[BENCH].vote).toBe('more');
      expect(utils.getByLabelText('More Barbell Bench Press').props.accessibilityState).toEqual({ selected: true });
      expect(utils.getByLabelText('Less Barbell Bench Press').props.accessibilityState).toEqual({ selected: false });
      expect(buildTodaySession).not.toHaveBeenCalled();
      expect(has(utils, 'Chest and Core')).toBe(true);
    });

    it('change to the other one when it is tapped, and clear when the same one is tapped again', async () => {
      const utils = await show();
      await press(utils, 'More Barbell Bench Press');
      await press(utils, 'Less Barbell Bench Press');
      expect(fb().votes[BENCH].vote).toBe('less');
      expect(utils.getByLabelText('More Barbell Bench Press').props.accessibilityState).toEqual({ selected: false });
      await press(utils, 'Less Barbell Bench Press');
      expect(fb().votes[BENCH]).toBeUndefined();
      expect(utils.getByLabelText('Less Barbell Bench Press').props.accessibilityState).toEqual({ selected: false });
    });

    it('are kept for a bodyweight progression under the whole progression', async () => {
      const utils = await show();
      await press(utils, 'More Plank');
      expect(fb().votes[feedbackKey(PLANK)].vote).toBe('more');
      expect(feedbackKey(PLANK)).toBe('ladder:plank');
    });
  });

  describe('Swap', () => {
    it('opens up to three other exercises with their reasons, asked for with the time and equipment on the screen', async () => {
      getSwapOptions.mockReturnValue([dbPress(), inclinePress()]);
      const utils = await show();
      await press(utils, 'Swap Barbell Bench Press');
      expect(getSwapOptions).toHaveBeenCalledTimes(1);
      expect(getSwapOptions.mock.calls[0][0]).toMatchObject({ minutes: 30, equipment: 'gym', exerciseId: BENCH, session: expect.objectContaining({ status: 'ok' }) });
      expect(has(utils, 'Swap for')).toBe(true);
      expect(has(utils, 'Dumbbell Bench Press')).toBe(true);
      expect(has(utils, 'Chest: the same muscle, with dumbbells.')).toBe(true);
      expect(has(utils, 'Incline Dumbbell Press')).toBe(true);
      expect(utils.getByLabelText('Swap Barbell Bench Press').props.accessibilityState).toMatchObject({ expanded: true });
    });

    it('closes again when Swap is tapped a second time, and changes nothing', async () => {
      getSwapOptions.mockReturnValue([dbPress()]);
      const utils = await show();
      await press(utils, 'Swap Barbell Bench Press');
      await press(utils, 'Swap Barbell Bench Press');
      expect(has(utils, 'Swap for')).toBe(false);
      expect(swapInExercise).not.toHaveBeenCalled();
      expect(fb().swaps).toEqual({});
    });

    it('says so when nothing else fits, and offers nothing to tap', async () => {
      const utils = await show();
      await press(utils, 'Swap Barbell Bench Press');
      expect(texts(utils).some((t) => t.startsWith('No other exercise fits right now'))).toBe(true);
      expect(has(utils, 'Swap for')).toBe(false);
    });

    it('puts the one tapped in the place of this one, leaves the rest as it was, and notes the swap away', async () => {
      getSwapOptions.mockReturnValue([dbPress(), inclinePress()]);
      const utils = await show();
      await press(utils, 'Swap Barbell Bench Press');
      await press(utils, 'Swap Barbell Bench Press for Incline Dumbbell Press');
      expect(swapInExercise).toHaveBeenCalledTimes(1);
      expect(swapInExercise.mock.calls[0][1]).toBe(BENCH);
      expect(swapInExercise.mock.calls[0][2].id).toBe('incline-dumbbell-press');
      expect(swapInExercise.mock.calls[0][3]).toMatchObject({ uid: 'u1' });
      expect(has(utils, 'Incline Dumbbell Press')).toBe(true);
      expect(has(utils, 'Barbell Bench Press')).toBe(false);
      expect(has(utils, 'Plank')).toBe(true);
      expect(has(utils, 'Swap for')).toBe(false);
      expect(fb().swaps[BENCH]).toHaveLength(1);
      expect(fb().excluded).toEqual({});
    });

    it('takes the AI\'s words off a session that has been swapped in, and does not ask for them for it', async () => {
      getSwapOptions.mockReturnValue([dbPress()]);
      const utils = await show();
      await press(utils, 'Swap Barbell Bench Press');
      await press(utils, 'Swap Barbell Bench Press for Dumbbell Bench Press');
      await wait(delay + 10);
      expect(generateSessionWording).not.toHaveBeenCalled();
      expect(has(utils, WORDING_CAPTION)).toBe(false);
      expect(has(utils, 'Chest: the same muscle, with dumbbells.')).toBe(true);
    });

    it('drops a swap that finishes after the time or the equipment was changed', async () => {
      getSwapOptions.mockReturnValue([dbPress()]);
      let release;
      swapInExercise.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
      const utils = await show();
      await press(utils, 'Swap Barbell Bench Press');
      await press(utils, 'Swap Barbell Bench Press for Dumbbell Bench Press');
      fireEvent.press(utils.getByText('45 min'));
      await flush();
      await act(async () => { release(sessionFor(30)); });
      await flush();
      expect(fb().swaps).toEqual({});
      expect(has(utils, '4 x 8-10 reps')).toBe(true);
    });
  });

  describe('Exclude', () => {
    it('asks first, and does nothing when it is cancelled', async () => {
      const utils = await show();
      await press(utils, 'Exclude Barbell Bench Press');
      expect(Alert.alert).toHaveBeenCalledTimes(1);
      const [title, message, buttons] = Alert.alert.mock.calls[0];
      expect(title).toBe('Exclude Barbell Bench Press?');
      expect(message).toMatch(/will not pick Barbell Bench Press again until you restore it/);
      expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Exclude']);
      expect(fb().excluded).toEqual({});
    });

    it('says a bodyweight progression goes with its easier and harder versions', async () => {
      const utils = await show();
      await press(utils, 'Exclude Plank');
      expect(Alert.alert.mock.calls[0][1]).toMatch(/Plank or its easier and harder versions/);
    });

    it('excludes it and fills its place with the first alternative that fits', async () => {
      getSwapOptions.mockReturnValue([dbPress()]);
      const utils = await show();
      await press(utils, 'Exclude Barbell Bench Press');
      await confirmExclude();
      expect(fb().excluded[BENCH]).toMatchObject({ name: 'Barbell Bench Press', ladder: false });
      expect(getSwapOptions.mock.calls[0][0]).toMatchObject({ exerciseId: BENCH, limit: 1 });
      expect(swapInExercise.mock.calls[0][2].id).toBe('dumbbell-bench-press');
      expect(has(utils, 'Dumbbell Bench Press')).toBe(true);
      // an exclusion is not a swap away: it does not also count against the exercise's score
      expect(fb().swaps).toEqual({});
    });

    it('drops the slot when nothing fits in its place', async () => {
      const utils = await show();
      await press(utils, 'Exclude Plank');
      await confirmExclude();
      expect(fb().excluded[feedbackKey(PLANK)]).toMatchObject({ name: 'Plank', ladder: true });
      expect(has(utils, 'Plank')).toBe(false);
      expect(texts(utils).some((t) => t.startsWith('1 exercises · '))).toBe(true);
    });

    it('builds the session again when excluding leaves nothing in it', async () => {
      buildTodaySession.mockImplementation(async ({ minutes }) => ({ ...sessionFor(minutes), exercises: [sessionFor(minutes).exercises[0]] }));
      const utils = await show();
      buildTodaySession.mockClear();
      buildTodaySession.mockImplementation(async () => ({ status: 'limited', message: 'Nothing fits, and the exercises you excluded.', name: 'Session', exercises: [], leftOutFor: [] }));
      await press(utils, 'Exclude Barbell Bench Press');
      await confirmExclude();
      expect(buildTodaySession).toHaveBeenCalledTimes(1);
      expect(has(utils, 'Nothing fits, and the exercises you excluded.')).toBe(true);
    });

    it('lists what is excluded at the bottom, folded away, with a Restore for each', async () => {
      getSwapOptions.mockReturnValue([dbPress()]);
      const utils = await show();
      await press(utils, 'Exclude Barbell Bench Press');
      await confirmExclude();
      expect(has(utils, 'Show excluded exercises (1)')).toBe(true);
      expect(utils.queryByLabelText('Restore Barbell Bench Press')).toBeNull();
      fireEvent.press(utils.getByLabelText('Excluded exercises, 1'));
      await flush();
      expect(has(utils, 'Barbell Bench Press')).toBe(true);
      await press(utils, 'Restore Barbell Bench Press');
      expect(fb().excluded).toEqual({});
      expect(has(utils, 'Show excluded exercises (1)')).toBe(false);
    });

    it('names a progression as such in the list', async () => {
      const utils = await show();
      await press(utils, 'Exclude Plank');
      await confirmExclude();
      fireEvent.press(utils.getByLabelText('Excluded exercises, 1'));
      await flush();
      expect(has(utils, 'Plank and its easier and harder versions')).toBe(true);
    });

    it('shows the list even when no session can be built, so something excluded can always be restored', async () => {
      useTrainingFeedbackStore.setState({ feedback: { ...emptyFeedback(), excluded: { [BENCH]: { name: 'Barbell Bench Press', ladder: false, at: '2026-10-01T00:00:00.000Z' } } } });
      buildTodaySession.mockImplementation(async () => ({ status: 'limited', message: 'Nothing fits.', name: 'Session', exercises: [], leftOutFor: [] }));
      const utils = await show();
      expect(has(utils, 'Nothing fits.')).toBe(true);
      expect(has(utils, 'Show excluded exercises (1)')).toBe(true);
    });
  });
});

describe('what is counted when the workout is started', () => {
  beforeEach(() => { jest.spyOn(Alert, 'alert').mockImplementation(() => {}); });
  afterEach(() => { jest.restoreAllMocks(); });

  const start = async (utils) => { await act(async () => { fireEvent.press(utils.getByTestId('start')); }); await flush(); };

  it('counts a plain start: one session and the exercises in it', async () => {
    const utils = await show();
    await start(utils);
    expect(measures()).toMatchObject({ sessionsStarted: 1, exercisesOffered: 2, exercisesSwapped: 0, exercisesExcluded: 0 });
    expect(measures().since).not.toBe('');
  });

  it('counts the swaps and the exclusions made first, against the exercises in the session as it was started', async () => {
    getSwapOptions.mockReturnValue([dbPress()]);
    const utils = await show();
    await press(utils, 'Swap Barbell Bench Press');
    await press(utils, 'Swap Barbell Bench Press for Dumbbell Bench Press');
    getSwapOptions.mockReturnValue([]);
    await press(utils, 'Exclude Plank');
    await confirmExclude();
    await start(utils);
    expect(measures()).toMatchObject({ sessionsStarted: 1, exercisesOffered: 1, exercisesSwapped: 1, exercisesExcluded: 1 });
  });

  it('starts counting again for a session built again', async () => {
    getSwapOptions.mockReturnValue([dbPress()]);
    const utils = await show();
    await press(utils, 'Swap Barbell Bench Press');
    await press(utils, 'Swap Barbell Bench Press for Dumbbell Bench Press');
    fireEvent.press(utils.getByText('45 min'));
    await flush();
    await start(utils);
    expect(measures()).toMatchObject({ sessionsStarted: 1, exercisesSwapped: 0, exercisesExcluded: 0 });
  });

  it('counts nothing when the workout could not be saved', async () => {
    global.__addWorkout = jest.fn(async () => { throw new Error('offline'); });
    const utils = await show();
    await start(utils);
    expect(measures().sessionsStarted).toBe(0);
    expect(has(utils, "Couldn't save the session. Please try again.")).toBe(true);
  });

  it('saves the session as it now stands, swaps included', async () => {
    getSwapOptions.mockReturnValue([dbPress()]);
    const utils = await show();
    await press(utils, 'Swap Barbell Bench Press');
    await press(utils, 'Swap Barbell Bench Press for Dumbbell Bench Press');
    await start(utils);
    const workout = global.__addWorkout.mock.calls[0][0];
    expect(workout.source).toBe('engine_session');
    expect(workout.exercises.map((x) => x.name)).toEqual(['Dumbbell Bench Press', 'Plank']);
  });
});

describe('the cloud copy', () => {
  it('is brought in once the person is known', async () => {
    await show();
    expect(getDoc).toHaveBeenCalledWith({ path: 'users/u1/data/trainingFeedback' });
    expect(useTrainingFeedbackStore.getState().syncUid).toBe('u1');
  });
});
