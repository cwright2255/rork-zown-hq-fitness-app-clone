// Settings > AI Coach > "Let the coach add to my calendar", seen from the Coach screen: with it off, the coach is told it cannot use the
// calendar, anything calendar-shaped it sends anyway is left off the Yes / No card, and the chat says why. Workouts and goals still come
// through. The switch is read fresh on every message.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { Ionicons: ({ name }) => mockReact.createElement(mockRn.Text, null, name) };
}, { virtual: true });
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
}, { virtual: true });
jest.mock('@/src/services/analytics', () => ({ logAICoachUsed: jest.fn() }));
jest.mock('@/services/aiService', () => ({ chatAI: jest.fn() }));
jest.mock('@/services/coachActionService', () => ({ executeCoachActions: jest.fn() }));
jest.mock('@/services/coachService', () => ({
  buildCoachSystemPrompt: jest.fn(() => ({ role: 'system', content: 'SYSTEM PROMPT' })),
  buildUserDataContext: jest.fn(() => ({ role: 'system', content: 'DATA CONTEXT' })),
  getCoachHistory: jest.fn(async () => []),
  saveCoachMessage: jest.fn(async () => undefined),
  summarizeLiftPRs: jest.fn(() => []),
  summarizeCardioVolume: jest.fn(() => null),
}));
jest.mock('@/services/coachSnapshotService', () => ({
  loadSnapshotSources: jest.fn(async () => []),
  loadHabitSources: jest.fn(async () => undefined),
  buildSnapshotFromStores: jest.fn(() => ({ role: 'system', content: 'SNAPSHOT' })),
}));
jest.mock('@/services/coachMemoryService', () => ({
  refreshCoachMemory: jest.fn(async () => undefined),
  loadCoachMemory: jest.fn(async () => undefined),
  getCachedCoachMemory: jest.fn(() => ({ facts: [], paused: false, upTo: 0, updatedAt: 0 })),
}));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1', name: 'Cj' } }) }));
jest.mock('@/store/settingsStore', () => ({
  useSettingsStore: { getState: () => ({ coachCanAddToCalendar: global.__calendarSwitch }) },
}));
jest.mock('@/store/workoutStore', () => ({
  useWorkoutStore: () => ({ completedWorkouts: [], loadWorkouts: async () => {}, getExerciseHistory: async () => [] }),
}));
jest.mock('@/store/runningStore', () => ({ useRunningStore: () => ({ runs: [], loadRuns: async () => {} }) }));
jest.mock('@/store/hikingStore', () => ({ useHikingStore: () => ({ completedHikes: [], loadCompletedHikes: async () => {} }) }));

import CoachScreen from '../app/coach';
import { chatAI } from '@/services/aiService';
import { executeCoachActions } from '@/services/coachActionService';
import { buildCoachSystemPrompt } from '@/services/coachService';
import { CALENDAR_OFF_NOTE } from '../lib/coachActions';

const flush = () => act(async () => {});
const block = (actions) => `<zown_action>${JSON.stringify(actions)}</zown_action>`;
const WORKOUT = { type: 'workout_plan', workouts: [{ name: 'Leg day', description: 'Heavy', exercises: [{ name: 'Squat', sets: 4, reps: 5, restSeconds: 120 }] }] };
const SCHEDULE = { type: 'schedule', events: [{ title: 'Leg day', kind: 'workout', date: '2099-06-03', time: '07:00', notes: '', workout: 'Leg day' }] };
const GOAL = { type: 'goal', goals: [{ title: 'Squat 300', target: 300, unit: 'lb' }] };
const NUTRITION = {
  type: 'nutrition_plan',
  dailyGoals: { calories: 2400, protein: 180, carbs: 250, fat: 70 },
  meals: [{ date: '2099-06-03', time: '08:00', mealType: 'breakfast', name: 'Oats and berries', description: 'Oats with blueberries' }],
};
const MEALS_ONLY = { type: 'nutrition_plan', meals: NUTRITION.meals };

let utils;
let error;
beforeEach(async () => {
  global.__calendarSwitch = true;
  jest.clearAllMocks();
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
  utils = render(<CoachScreen />);
  await flush();
});
afterEach(() => error.mockRestore());

const say = async (text) => {
  fireEvent.changeText(utils.getByPlaceholderText('Ask your coach anything...'), text);
  fireEvent.press(utils.getByText('arrow-up'));
  await flush();
};

describe('the instructions the coach is given', () => {
  it('say the calendar is available when the switch is on', async () => {
    chatAI.mockResolvedValue('Okay.');
    await say('Hi');
    expect(buildCoachSystemPrompt).toHaveBeenCalledTimes(1);
    expect(buildCoachSystemPrompt).toHaveBeenCalledWith({ uid: 'u1', name: 'Cj' }, expect.any(Date), expect.objectContaining({ calendar: true }));
  });

  it('say it is not when the switch is off', async () => {
    global.__calendarSwitch = false;
    chatAI.mockResolvedValue('Okay.');
    await say('Hi');
    expect(buildCoachSystemPrompt).toHaveBeenCalledWith({ uid: 'u1', name: 'Cj' }, expect.any(Date), expect.objectContaining({ calendar: false }));
  });

  it('count a switch that has never been set as on', async () => {
    global.__calendarSwitch = undefined;
    chatAI.mockResolvedValue('Okay.');
    await say('Hi');
    expect(buildCoachSystemPrompt).toHaveBeenCalledWith({ uid: 'u1', name: 'Cj' }, expect.any(Date), expect.objectContaining({ calendar: true }));
  });

  it('follow the switch from one message to the next', async () => {
    chatAI.mockResolvedValue('Okay.');
    await say('First');
    global.__calendarSwitch = false;
    await say('Second');
    global.__calendarSwitch = true;
    await say('Third');
    expect(buildCoachSystemPrompt.mock.calls.map((c) => c[2].calendar)).toEqual([true, false, true]);
  });
});

describe('with the switch on', () => {
  it('offers the calendar events along with the workout', async () => {
    chatAI.mockResolvedValue(`Here is your week. Want me to save it?\n${block([WORKOUT, SCHEDULE])}`);
    await say('Plan my legs');
    expect(utils.getByText(/Save 1 workout to My Workouts/)).toBeTruthy();
    expect(utils.getByText(/Add 1 event to your calendar/)).toBeTruthy();
    expect(utils.queryByText(CALENDAR_OFF_NOTE)).toBeNull();
  });

  it('offers the meals of a nutrition plan', async () => {
    chatAI.mockResolvedValue(`Here is a plan. Want me to set it up?\n${block([NUTRITION])}`);
    await say('Plan my meals');
    expect(utils.getByText(/Replace your daily targets/)).toBeTruthy();
    expect(utils.getByText(/Add 1 meal to your calendar/)).toBeTruthy();
  });
});

describe('with the switch off', () => {
  beforeEach(() => { global.__calendarSwitch = false; });

  it('leaves the calendar events off the card, keeps the workout, and says why', async () => {
    chatAI.mockResolvedValue(`Here is your week. Want me to save it?\n${block([WORKOUT, SCHEDULE])}`);
    await say('Plan my legs');
    expect(utils.getByText(/Save 1 workout to My Workouts/)).toBeTruthy();
    expect(utils.queryByText(/Add \d+ events? to your calendar/)).toBeNull();
    expect(utils.getByText(/Here is your week\./)).toBeTruthy();
    expect(utils.getByText(new RegExp(CALENDAR_OFF_NOTE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeTruthy();
    expect(utils.getByText('Yes, do it')).toBeTruthy();
  });

  it('shows no card at all when the only thing the coach sent was for the calendar, and says why', async () => {
    chatAI.mockResolvedValue(`Booked for Monday at 7.\n${block([SCHEDULE])}`);
    await say('Put legs on Monday');
    expect(utils.queryByText('Yes, do it')).toBeNull();
    expect(utils.getByText(/Booked for Monday at 7\./)).toBeTruthy();
    expect(utils.getByText(/Let the coach add to my calendar/)).toBeTruthy();
  });

  it('says why even when the coach sent the calendar block with no words', async () => {
    chatAI.mockResolvedValue(block([SCHEDULE]));
    await say('Put legs on Monday');
    expect(utils.getByText(CALENDAR_OFF_NOTE)).toBeTruthy();
    expect(utils.queryByText(/couldn't put that together/)).toBeNull();
    expect(utils.queryByText('Yes, do it')).toBeNull();
  });

  it('keeps the daily targets of a nutrition plan, leaves the meals off, and says why', async () => {
    chatAI.mockResolvedValue(`Here is a plan. Want me to set it up?\n${block([NUTRITION])}`);
    await say('Plan my meals');
    expect(utils.getByText(/Replace your daily targets/)).toBeTruthy();
    expect(utils.queryByText(/Add \d+ meals? to your calendar/)).toBeNull();
    expect(utils.getByText(/Let the coach add to my calendar/)).toBeTruthy();
  });

  it('shows no card for a nutrition plan that was only meals', async () => {
    chatAI.mockResolvedValue(`Here are meals.\n${block([MEALS_ONLY])}`);
    await say('Plan my meals');
    expect(utils.queryByText('Yes, do it')).toBeNull();
    expect(utils.getByText(/Let the coach add to my calendar/)).toBeTruthy();
  });

  it('does not mention the calendar when the coach sent nothing for it', async () => {
    chatAI.mockResolvedValue(`Here is a goal. Want me to add it?\n${block([GOAL])}`);
    await say('Set a goal');
    expect(utils.getByText(/Add 1 goal to Progress/)).toBeTruthy();
    expect(utils.queryByText(/Let the coach add to my calendar/)).toBeNull();
  });

  it('does not mention the calendar for a plain answer', async () => {
    chatAI.mockResolvedValue('Eat more protein.');
    await say('What should I eat?');
    expect(utils.getByText('Eat more protein.')).toBeTruthy();
    expect(utils.queryByText(/Let the coach add to my calendar/)).toBeNull();
  });

  it('still reports a block with nothing valid in it the usual way', async () => {
    chatAI.mockResolvedValue('Sure.\n<zown_action>{"type":"goal","goals":[{"title":"","target":0}]}</zown_action>');
    await say('Set a goal');
    expect(utils.queryByText(/Let the coach add to my calendar/)).toBeNull();
  });

  it('runs only what is on the card when the person says yes', async () => {
    executeCoachActions.mockResolvedValue({ message: 'Done - I saved 1 workout to My Workouts.', links: [], failures: [] });
    chatAI.mockResolvedValue(`Here is your week. Want me to save it?\n${block([WORKOUT, SCHEDULE])}`);
    await say('Plan my legs');
    await act(async () => { fireEvent.press(utils.getByText('Yes, do it')); });
    expect(executeCoachActions).toHaveBeenCalledTimes(1);
    expect(executeCoachActions.mock.calls[0][0].map((a) => a.type)).toEqual(['workout_plan']);
  });
});
