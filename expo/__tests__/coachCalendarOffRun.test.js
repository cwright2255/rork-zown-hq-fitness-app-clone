// What happens when the person says yes to a coach proposal while Settings > AI Coach > "Let the coach add to my calendar" is off
// (services/coachActionService.js). The card is already built without calendar items when the switch is off (coachCalendarOff.test.js);
// this is the second lock: a proposal that was on screen before the switch was turned off still cannot write to the calendar.
// jest.global-setup.js pins the time zone to America/New_York.
jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn(), setDoc: jest.fn(async () => undefined) }), { virtual: true });
jest.mock('../services/calendarReminders', () => ({
  askForReminderPermission: jest.fn(async () => true),
  reconcileReminders: jest.fn(async () => ({ scheduled: 0, blocked: false })),
}));
jest.mock('../store/workoutStore', () => ({ useWorkoutStore: { getState: () => ({ addWorkout: global.__addWorkout }) } }));
jest.mock('../store/nutritionStore', () => ({
  useNutritionStore: { getState: () => ({ updateDailyGoals: global.__updateDailyGoals }), setState: (...a) => global.__nutritionSetState(...a) },
}));
jest.mock('../store/goalsStore', () => ({ useGoalsStore: { getState: () => ({ addGoal: global.__addGoal }) } }));

import { askForReminderPermission, reconcileReminders } from '../services/calendarReminders';
import { executeCoachActions } from '../services/coachActionService';
import { useScheduleStore } from '../store/scheduleStore';
import { useSettingsStore } from '../store/settingsStore';

const iso = (d, h, m = 0) => new Date(2026, 9, d, h, m).toISOString();
const user = { uid: 'u1' };
const LEFT_ALONE = 'I left your calendar alone because "Let the coach add to my calendar" is off in Settings.';

const workout = { type: 'workout_plan', workouts: [{ name: 'Legs', exercises: [] }] };
const goal = { type: 'goal', goals: [{ title: 'Squat 300', target: 300, unit: 'lb' }] };
const schedule = (events) => ({ type: 'schedule', events });
const run = { title: 'Easy run', kind: 'run', start: iso(21, 6, 30), notes: '', workoutName: '' };
const lift = { title: 'Leg day', kind: 'workout', start: iso(22, 7, 0), notes: 'Heavy', workoutName: 'Legs' };
const meal = (d, h, title) => ({ title, kind: 'nutrition', start: iso(d, h), notes: '', workoutName: '' });
const TARGETS = { calories: 2400, protein: 180, carbs: 250, fat: 70 };
const nutrition = (meals, dailyGoals = TARGETS) => ({ type: 'nutrition_plan', dailyGoals, meals });

let warn;
beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 9, 19, 8, 0), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.clearAllMocks();
  global.__addWorkout = jest.fn(async (w) => ({ id: w.id }));
  global.__addGoal = jest.fn(async () => undefined);
  global.__updateDailyGoals = jest.fn();
  global.__nutritionSetState = jest.fn();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  useScheduleStore.setState({ events: [] });
  useSettingsStore.setState({ coachCanAddToCalendar: false });
});
afterEach(() => { jest.useRealTimers(); warn.mockRestore(); });

const onCalendar = () => useScheduleStore.getState().events;
const calendarUntouched = () => {
  expect(onCalendar()).toEqual([]);
  expect(askForReminderPermission).not.toHaveBeenCalled();
  expect(reconcileReminders).not.toHaveBeenCalled();
};

describe('with the switch off', () => {
  it('puts nothing on the calendar for a schedule, sets no reminders, and says it left the calendar alone', async () => {
    const result = await executeCoachActions([schedule([run, lift])], user);
    calendarUntouched();
    expect(result.message).toBe(`I didn't add anything. ${LEFT_ALONE} You can turn it on there and ask me again.`);
    expect(result.links).toEqual([]);
    expect(result.failures).toEqual([]);
  });

  it('still saves a workout from the same plan, and says the calendar was left alone', async () => {
    const result = await executeCoachActions([workout, schedule([lift])], user);
    expect(global.__addWorkout).toHaveBeenCalledTimes(1);
    calendarUntouched();
    expect(result.message).toBe(`Done - I saved 1 workout to My Workouts. ${LEFT_ALONE}`);
    expect(result.links).toEqual([{ label: 'Open My Workouts', route: '/workouts' }]);
  });

  it('still adds goals', async () => {
    const result = await executeCoachActions([goal, schedule([run])], user);
    expect(global.__addGoal).toHaveBeenCalledTimes(1);
    calendarUntouched();
    expect(result.message).toBe(`Done - I added 1 goal to your Progress tab. ${LEFT_ALONE}`);
  });

  it('still sets the daily nutrition targets, and leaves the meals off the calendar', async () => {
    const result = await executeCoachActions([nutrition([meal(21, 8, 'Oats'), meal(21, 12, 'Salad')])], user);
    expect(global.__updateDailyGoals).toHaveBeenCalledWith(TARGETS);
    expect(global.__nutritionSetState).toHaveBeenCalledTimes(1);
    calendarUntouched();
    expect(result.message).toBe(`Done - I updated your daily nutrition targets. ${LEFT_ALONE}`);
    expect(result.links).toEqual([{ label: 'Open Nutrition', route: '/nutrition' }]);
  });

  it('does not say the calendar was left alone for a nutrition plan that had no meals in it', async () => {
    const result = await executeCoachActions([nutrition([])], user);
    expect(result.message).toBe('Done - I updated your daily nutrition targets.');
    expect(result.message).not.toContain('Settings');
  });

  it('gives the usual "could not save" message when there was nothing to do, not the calendar one', async () => {
    const empty = await executeCoachActions([nutrition([], {})], user);
    expect(empty.message).toBe("Sorry, I couldn't save that. Nothing was changed - please try again.");
    const none = await executeCoachActions([], user);
    expect(none.message).toBe("Sorry, I couldn't save that. Nothing was changed - please try again.");
  });

  it('leaves the meals alone and says so when the plan was only meals', async () => {
    const result = await executeCoachActions([nutrition([meal(21, 8, 'Oats')], {})], user);
    expect(global.__updateDailyGoals).not.toHaveBeenCalled();
    calendarUntouched();
    expect(result.message).toBe(`I didn't add anything. ${LEFT_ALONE} You can turn it on there and ask me again.`);
  });

  it('says the calendar was left alone once, even when several parts were for it', async () => {
    const result = await executeCoachActions([workout, schedule([lift]), nutrition([meal(21, 8, 'Oats')])], user);
    expect(result.message.split(LEFT_ALONE)).toHaveLength(2);
    expect(result.message).toBe(`Done - I saved 1 workout to My Workouts and updated your daily nutrition targets. ${LEFT_ALONE}`);
    calendarUntouched();
  });

  it('does not say the calendar was left alone when nothing was for the calendar', async () => {
    const result = await executeCoachActions([workout, goal], user);
    expect(result.message).toBe('Done - I saved 1 workout to My Workouts and added 1 goal to your Progress tab.');
    expect(result.message).not.toContain('Settings');
  });

  it('does not hide a real failure behind the calendar message', async () => {
    global.__addWorkout = jest.fn(async () => { throw new Error('offline'); });
    const result = await executeCoachActions([workout, schedule([lift])], user);
    expect(result.failures).toEqual(['workout_plan']);
    expect(result.message).toBe("Sorry, I couldn't save that. Nothing was changed - please try again.");
    calendarUntouched();
  });

  it('keeps the usual note about a part that went wrong, next to the calendar one', async () => {
    global.__addGoal = jest.fn(async () => { throw new Error('offline'); });
    const result = await executeCoachActions([workout, goal, schedule([lift])], user);
    expect(result.failures).toEqual(['goal']);
    expect(result.message).toBe(`Done - I saved 1 workout to My Workouts. ${LEFT_ALONE} Something went wrong with one part, so that part was not saved.`);
  });
});

describe('with the switch on', () => {
  beforeEach(() => { useSettingsStore.setState({ coachCanAddToCalendar: true }); });

  it('adds the events to the calendar and sets the reminders, and never mentions the setting', async () => {
    const result = await executeCoachActions([schedule([run, lift])], user);
    expect(result.message).toBe('Done - I added 2 events to your calendar.');
    expect(onCalendar()).toHaveLength(2);
    expect(reconcileReminders).toHaveBeenCalledTimes(1);
  });

  it('adds the meals as well as the targets', async () => {
    const result = await executeCoachActions([nutrition([meal(21, 8, 'Oats')])], user);
    expect(result.message).toBe('Done - I updated your daily nutrition targets and added 1 meal to your calendar.');
    expect(onCalendar()).toHaveLength(1);
  });
});

describe('a switch that has never been set', () => {
  it('counts as on when the value is missing', async () => {
    useSettingsStore.setState({ coachCanAddToCalendar: undefined });
    const result = await executeCoachActions([schedule([run])], user);
    expect(result.message).toBe('Done - I added 1 event to your calendar.');
    expect(onCalendar()).toHaveLength(1);
  });

  it('is on in a fresh store', () => {
    expect(useSettingsStore.getInitialState().coachCanAddToCalendar).toBe(true);
  });
});

describe('the switch is read at the moment of saving', () => {
  it('lets a proposal made with the switch on be stopped by turning it off before tapping Yes', async () => {
    useSettingsStore.setState({ coachCanAddToCalendar: true });
    const proposal = [schedule([run])];
    useSettingsStore.setState({ coachCanAddToCalendar: false });
    const result = await executeCoachActions(proposal, user);
    expect(onCalendar()).toEqual([]);
    expect(result.message).toContain(LEFT_ALONE);
  });

  it('and lets a later proposal through once it is turned back on', async () => {
    await executeCoachActions([schedule([run])], user);
    expect(onCalendar()).toEqual([]);
    useSettingsStore.setState({ coachCanAddToCalendar: true });
    await executeCoachActions([schedule([run])], user);
    expect(onCalendar()).toHaveLength(1);
  });
});
