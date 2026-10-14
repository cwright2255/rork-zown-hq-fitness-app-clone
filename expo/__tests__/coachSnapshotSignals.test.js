// What the AI Coach is told about the person's day: recovery, water, steps, fasting, the last week of eating, and
// calories burned against the burn goal, read from the stores at the moment a message is sent.
// jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('../services/rookService', () => ({ rookService: {} }));
jest.mock('../services/appleHealthService', () => ({ appleHealthService: {} }));
jest.mock('expo-location', () => ({}), { virtual: true }); // the hiking store imports it; no GPS is used here
jest.mock('../services/fastingService', () => ({ getActiveFast: jest.fn(), getFastHistory: jest.fn() }));

import { buildSnapshotFromStores, loadHabitSources } from '../services/coachSnapshotService';
import { getActiveFast, getFastHistory } from '../services/fastingService';
import { useHealthStore } from '../store/healthStore';
import { useNutritionStore } from '../store/nutritionStore';
import { useWorkoutStore } from '../store/workoutStore';
import { useRunningStore } from '../store/runningStore';
import { useHikingStore } from '../store/hikingStore';

const EVENING = new Date('2026-10-15T01:30:00Z');
const H = 3600000;
const user = { uid: 'u1', name: 'Cj', weightKg: 80, dailyCalorieGoal: 500 };
const at = (date) => { jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }).setSystemTime(date); };
const snapshot = (u = user) => {
  const msg = buildSnapshotFromStores(u, new Date());
  return msg ? msg.content : '';
};

const food = (calories, protein = 30) => ({ calories, protein, carbs: 40, fat: 10 });
const REAL_TARGET = { dailyGoals: { calories: 2400, protein: 160, carbs: 250, fat: 70, water: 2000 }, dailyGoalsUpdatedAt: '2026-10-14T12:00:00.000Z' };

// The user store finishes loading on a timer once the file is imported; let that happen before the clock is moved.
beforeAll(() => new Promise((resolve) => setTimeout(resolve, 20)));
beforeEach(() => {
  at(EVENING);
  getActiveFast.mockReset();
  getFastHistory.mockReset();
  useHealthStore.setState({
    rookRecovery: null,
    hydration: { glasses: 0, target: 8, date: '2026-10-14' },
    steps: 0,
    stepsDate: null,
  });
  useNutritionStore.setState({
    meals: [],
    dailyGoals: { calories: 2000, protein: 150, carbs: 200, fat: 65, water: 2000 },
    dailyGoalsUpdatedAt: null,
  });
  useWorkoutStore.setState({ completedWorkouts: [] });
  useRunningStore.setState({ runs: [] });
  useHikingStore.setState({ completedHikes: [] });
});
afterEach(() => { jest.useRealTimers(); });

describe('recovery, water and steps', () => {
  it('tells the Coach the latest recovery reading', () => {
    useHealthStore.setState({ rookRecovery: { restingHeartRate: 54, hrv: 61, sleepHours: 7.5, sleepEfficiency: 91, source: 'Oura' } });
    const text = snapshot();
    expect(text).toContain('Latest recovery reading from Oura: resting heart rate 54 bpm, HRV 61 ms (RMSSD)');
    expect(text).toContain('sleep 7.5 h (efficiency 91%)');
  });

  it('says nothing about recovery when none has been loaded', () => {
    expect(snapshot()).not.toContain('recovery reading');
  });

  it('counts the water logged on the person\'s own day, 9:30 PM included', () => {
    useHealthStore.setState({ hydration: { glasses: 5, target: 8, date: '2026-10-14' } });
    expect(snapshot()).toContain('Water logged today: 5 of 8 glasses.');
    useHealthStore.setState({ hydration: { glasses: 7, target: 8, date: '2026-10-13' } });
    expect(snapshot()).not.toContain('Water logged today');
  });

  it('gives steps only when the count is from today', () => {
    useHealthStore.setState({ steps: 6420, stepsDate: '2026-10-14' });
    expect(snapshot()).toContain('Steps so far today: 6,420.');
    useHealthStore.setState({ steps: 9000, stepsDate: '2026-10-13' });
    expect(snapshot()).not.toContain('Steps so far today');
    useHealthStore.setState({ steps: 9000, stepsDate: null });
    expect(snapshot()).not.toContain('Steps so far today');
  });
});

describe('eating', () => {
  it('counts what was eaten on the person\'s own day, and not meals planned for tomorrow', () => {
    useNutritionStore.setState({
      ...REAL_TARGET,
      meals: [
        { id: 'dinner', date: '2026-10-14', foods: [food(700)] },
        { id: 'lunch', date: '2026-10-14', foods: [food(500)] },
        { id: 'breakfast', date: '2026-10-15', foods: [food(400)] }, // planned for tomorrow (the UTC date at 9:30 PM)
      ],
    });
    expect(snapshot()).toContain('Eaten so far today: 1200 kcal');
  });

  it('gives the targets once a real one exists, and never the 2000 placeholder', () => {
    expect(snapshot()).not.toContain('Daily nutrition targets');
    useNutritionStore.setState(REAL_TARGET);
    expect(snapshot()).toContain('Daily nutrition targets: 2400 kcal, 160g protein, 250g carbs, 70g fat.');
  });

  it('summarises the week before today against a real eating target', () => {
    useNutritionStore.setState({
      ...REAL_TARGET,
      meals: [
        { id: 'dinner', date: '2026-10-13', foods: [food(2000)] },
        { id: 'dinner', date: '2026-10-12', foods: [food(2200)] },
      ],
    });
    const text = snapshot();
    expect(text).toContain('Food diary, the 7 days before today: food logged on 2 of 7 days');
    expect(text).toContain('averaged 2,100 kcal');
    expect(text).toContain('Their eating target is 2,400 kcal, so that is 300 kcal under it on average.');
  });

  it('makes no comparison against the placeholder target', () => {
    useNutritionStore.setState({ meals: [{ id: 'dinner', date: '2026-10-13', foods: [food(2000)] }] });
    const text = snapshot();
    expect(text).toContain('Food diary, the 7 days before today');
    expect(text).not.toContain('Their eating target is');
    expect(text).not.toContain('kcal under it');
  });
});

describe('calories burned and the burn goal', () => {
  it('works out calories burned the way the home Calories card does, with the steps estimate', () => {
    useHealthStore.setState({ steps: 5000, stepsDate: '2026-10-14' });
    useWorkoutStore.setState({ completedWorkouts: [{ completedAt: '2026-10-15T01:10:00Z', caloriesBurned: 300, duration: 2400 }] }); // 9:10 PM on the 14th
    // 5000 steps at 80 kg is about 229 kcal
    expect(snapshot()).toContain('Calories burned today: 529 kcal');
    expect(snapshot()).toContain('their burn goal is 500 kcal a day. The burn goal is separate from the eating target.');
  });

  it('leaves out an old workout and a step count from another day', () => {
    useHealthStore.setState({ steps: 5000, stepsDate: '2026-10-13' });
    useWorkoutStore.setState({ completedWorkouts: [{ completedAt: '2026-10-14T01:10:00Z', caloriesBurned: 300, duration: 2400 }] }); // 9:10 PM on the 13th
    expect(snapshot()).toContain('Calories burned today: 0 kcal');
  });

  it('gives only the burned calories when no burn goal is set', () => {
    useWorkoutStore.setState({ completedWorkouts: [{ completedAt: '2026-10-15T01:10:00Z', caloriesBurned: 300, duration: 2400 }] });
    const text = snapshot({ uid: 'u1', name: 'Cj', weightKg: 80 });
    expect(text).toContain('Calories burned today: 300 kcal');
    expect(text).not.toContain('burn goal');
  });

  it('counts runs too', () => {
    useRunningStore.setState({ runs: [{ startTime: '2026-10-15T00:30:00Z', calories: 250, duration: 1500 }] });
    expect(snapshot()).toContain('Calories burned today: 250 kcal');
  });

  it('counts hikes too, so a hiking day is not told to the Coach as a day of nothing', () => {
    useHikingStore.setState({ completedHikes: [{ id: 'hike-1', startTime: '2026-10-14T20:00:00Z', completedAt: '2026-10-14T23:00:00Z', calories: 700, durationSeconds: 10800 }] });
    useRunningStore.setState({ runs: [{ startTime: '2026-10-15T00:30:00Z', calories: 250, duration: 1500 }] });
    expect(snapshot()).toContain('Calories burned today: 950 kcal (workouts, runs, hikes and an estimate from steps)');
  });

  it('leaves out a hike from another day', () => {
    useHikingStore.setState({ completedHikes: [{ id: 'hike-1', startTime: '2026-10-12T20:00:00Z', completedAt: '2026-10-12T23:00:00Z', calories: 700, durationSeconds: 10800 }] });
    expect(snapshot()).toContain('Calories burned today: 0 kcal');
  });
});

describe('fasting', () => {
  it('tells the Coach about the fast that is running and the ones finished this week', async () => {
    const now = new Date();
    getActiveFast.mockResolvedValue({ startedAt: new Date(now.getTime() - 9.5 * H), targetHours: 16, plan: '16' });
    getFastHistory.mockResolvedValue([{ id: 'a', startedAt: new Date(now.getTime() - 40 * H), endedAt: new Date(now.getTime() - 24 * H), targetHours: 16, plan: '16' }]);
    await loadHabitSources('u1');
    expect(getFastHistory).toHaveBeenCalledWith('u1', 60);
    const text = snapshot();
    expect(text).toContain('Fasting right now: 9h 30m into a 16h fast.');
    expect(text).toContain('Fasts finished in the last 7 days: 1 (average 16h, 1 reached their goal).');
  });

  it('does not show one person\'s fasting to another', async () => {
    getActiveFast.mockResolvedValue({ startedAt: new Date(Date.now() - 5 * H), targetHours: 16 });
    getFastHistory.mockResolvedValue([]);
    await loadHabitSources('u1');
    expect(snapshot({ ...user, uid: 'someone-else' })).not.toContain('Fasting right now');
  });

  it('leaves fasting out when it could not be read, without failing', async () => {
    getActiveFast.mockRejectedValue(new Error('offline'));
    getFastHistory.mockRejectedValue(new Error('offline'));
    await expect(loadHabitSources('u1')).resolves.toBeUndefined();
    expect(snapshot()).not.toContain('Fasting right now');
  });

  it('stops waiting after a few seconds when the read hangs, and never rejects', async () => {
    getActiveFast.mockReturnValue(new Promise(() => {}));
    getFastHistory.mockReturnValue(new Promise(() => {}));
    const done = jest.fn();
    loadHabitSources('u1').then(done);
    const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
    await flush();
    expect(done).not.toHaveBeenCalled();
    jest.advanceTimersByTime(4999);
    await flush();
    expect(done).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await flush();
    expect(done).toHaveBeenCalled();
  });

  it('does nothing without a signed-in person', async () => {
    await expect(loadHabitSources(undefined)).resolves.toBeUndefined();
    expect(getActiveFast).not.toHaveBeenCalled();
  });
});

describe('nothing known', () => {
  it('adds no lines of its own', () => {
    const text = snapshot({ uid: 'nobody' });
    for (const heading of ['Latest recovery reading', 'Water logged', 'Steps so far', 'Fasting right now', 'Fasts finished', 'Food diary, the 7 days', 'Calories burned today']) {
      expect(text).not.toContain(heading);
    }
  });
});
