// Today's Session on the phone (app/workout/session.jsx): the engine's session shows at once; a moment later the AI's wording replaces the name
// and the reasons, but only the parts that pass the checks, only on the session it was made for, and never the exercises, sets, reps or weights.
// The AI call is stood in for (services/aiService.js generateSessionWording); the checks, the keeping and the screen are the real ones.
import React from 'react';
import { Text, Pressable } from 'react-native';
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
jest.mock('@/services/sessionService', () => ({
  refreshSessionSources: jest.fn(async () => undefined),
  buildTodaySession: jest.fn(),
}));
jest.mock('@/services/aiService', () => ({ generateSessionWording: jest.fn() }));

import TodaySessionScreen from '../app/workout/session';
import { buildTodaySession } from '@/services/sessionService';
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
  generateSessionWording.mockResolvedValue(reply());
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
