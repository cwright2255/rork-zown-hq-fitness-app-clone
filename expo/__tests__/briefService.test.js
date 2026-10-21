// services/briefService.js: the Today brief is asked for once a day, kept on the phone, shared between callers that ask at the same
// moment, built from the app's stores after they are brought up to date, and never throws.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) },
}));
jest.mock('@/services/aiService', () => ({ generateTodayBrief: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), addDoc: jest.fn(), query: jest.fn(), where: jest.fn(), getDocs: jest.fn(), serverTimestamp: jest.fn(), orderBy: jest.fn(), limit: jest.fn(),
}), { virtual: true });
jest.mock('../src/config/firebase', () => ({ functions: { fake: true }, db: {} }));
jest.mock('@/services/coachSnapshotService', () => ({
  loadSnapshotSources: (...a) => global.__s.loadSnapshotSources(...a),
  loadHabitSources: (...a) => global.__s.loadHabitSources(...a),
  buildSnapshotFromStores: (...a) => global.__s.buildSnapshot(...a),
}));
jest.mock('@/store/workoutStore', () => ({ useWorkoutStore: { getState: () => global.__s.workout } }));
jest.mock('@/store/runningStore', () => ({ useRunningStore: { getState: () => global.__s.running } }));
jest.mock('@/store/hikingStore', () => ({ useHikingStore: { getState: () => global.__s.hiking } }));
jest.mock('@/store/healthStore', () => ({ useHealthStore: { getState: () => global.__s.health } }));
jest.mock('@/store/weightLogStore', () => ({ useWeightLogStore: { getState: () => global.__s.weight } }));
jest.mock('@/store/settingsStore', () => ({ useSettingsStore: { getState: () => global.__s.settings } }));

import {
  getTodayBrief, loadBriefSources, loadBriefMessages, BRIEF_LOAD_PATIENCE_MS,
} from '../services/briefService';
import { BRIEF_STORAGE_KEY, BRIEF_REQUEST } from '../lib/todayBrief';
import { INSIGHT_MISS_MS } from '../lib/insightCache';

// Tuesday 20 October 2026, 8 AM on the phone's own clock.
const NOW = new Date(2026, 9, 20, 8, 0, 0);
const USER = { uid: 'u1', name: 'Sam', fitnessLevel: 'intermediate' };
const BRIEF = { headline: 'A good day to train', points: ['Sleep was 8 hours.', 'Keep the lifting moderate.'] };
const KEY = 'brief|u1|2026-10-20';

const makeStorage = (start = {}) => {
  const data = { ...start };
  return {
    data,
    getItem: jest.fn(async (k) => (k in data ? data[k] : null)),
    setItem: jest.fn(async (k, v) => { data[k] = v; }),
  };
};
const kept = (storage) => JSON.parse(storage.data[BRIEF_STORAGE_KEY] || '{}');
const day = (n) => `2026-10-${String(n).padStart(2, '0')}`;

beforeEach(() => {
  global.__s = {
    loadSnapshotSources: jest.fn(async () => undefined),
    loadHabitSources: jest.fn(async () => undefined),
    buildSnapshot: jest.fn(() => ({ role: 'system', content: 'SNAPSHOT: calendar and food.' })),
    workout: { completedWorkouts: [], loadWorkouts: jest.fn(async () => undefined), getExerciseHistory: jest.fn(async () => []) },
    running: { runs: [], loadRuns: jest.fn(async () => undefined) },
    hiking: { completedHikes: [], loadCompletedHikes: jest.fn(async () => undefined) },
    health: {
      readingsHistory: {},
      rookRecovery: null,
      loadAllHealth: jest.fn(async () => undefined),
      loadRookRecovery: jest.fn(async () => undefined),
      syncReadings: jest.fn(async () => undefined),
    },
    weight: { logs: [] },
    settings: { weightUnits: 'imperial' },
  };
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe('where the brief is kept', () => {
  it('is the same place every release, so a brief kept by an earlier one is still found', () => {
    expect(BRIEF_STORAGE_KEY).toBe('zown-brief-cache');
  });
});

describe('asking for the brief', () => {
  it('asks the AI the first time, with the messages built for this person, and gives back the brief', async () => {
    const storage = makeStorage();
    const messages = [{ role: 'user', content: BRIEF_REQUEST }];
    const buildMessages = jest.fn(async () => messages);
    const ask = jest.fn(async () => BRIEF);
    expect(await getTodayBrief({ user: USER, now: NOW, ask, buildMessages, storage })).toEqual(BRIEF);
    expect(buildMessages).toHaveBeenCalledWith({ user: USER, now: NOW });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(ask).toHaveBeenCalledWith({ messages });
  });

  it('keeps it on the phone for the day, as the JSON the AI was asked for, before it says it is done', async () => {
    const storage = makeStorage();
    const set = storage.setItem;
    storage.setItem = jest.fn(async (k, v) => { await new Promise((r) => setImmediate(r)); return set(k, v); });
    await getTodayBrief({ user: USER, now: NOW, ask: async () => BRIEF, buildMessages: async () => [], storage });
    expect(Object.keys(kept(storage))).toEqual([KEY]);
    expect(JSON.parse(kept(storage)[KEY].text)).toEqual(BRIEF);
    expect(kept(storage)[KEY].at).toBe(NOW.getTime());
  });

  it('reads the kept brief later in the day, without reading the stores or asking again', async () => {
    const storage = makeStorage();
    const ask = jest.fn(async () => BRIEF);
    const buildMessages = jest.fn(async () => []);
    await getTodayBrief({ user: USER, now: NOW, ask, buildMessages, storage });
    const evening = new Date(2026, 9, 20, 21, 30);
    expect(await getTodayBrief({ user: USER, now: evening, ask, buildMessages, storage })).toEqual(BRIEF);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(buildMessages).toHaveBeenCalledTimes(1);
  });

  it('asks again the next day, and for another person', async () => {
    const storage = makeStorage();
    const ask = jest.fn(async () => BRIEF);
    const buildMessages = async () => [];
    await getTodayBrief({ user: USER, now: NOW, ask, buildMessages, storage });
    await getTodayBrief({ user: USER, now: new Date(2026, 9, 21, 8), ask, buildMessages, storage });
    await getTodayBrief({ user: { uid: 'u2' }, now: NOW, ask, buildMessages, storage });
    expect(ask).toHaveBeenCalledTimes(3);
    expect(Object.keys(kept(storage)).sort()).toEqual(['brief|u1|2026-10-20', 'brief|u1|2026-10-21', 'brief|u2|2026-10-20']);
  });

  it('asks for nothing, and reads nothing, without a person to ask for', async () => {
    const ask = jest.fn(async () => BRIEF);
    const buildMessages = jest.fn(async () => []);
    for (const user of [undefined, null, {}, { uid: '' }, { uid: 7 }]) {
      expect(await getTodayBrief({ user, now: NOW, ask, buildMessages, storage: makeStorage() })).toBeNull();
    }
    expect(ask).not.toHaveBeenCalled();
    expect(buildMessages).not.toHaveBeenCalled();
  });

  it('is nothing when the AI gives nothing, and is not asked again for half an hour', async () => {
    const storage = makeStorage();
    const ask = jest.fn(async () => null);
    const args = { user: USER, ask, buildMessages: async () => [], storage };
    expect(await getTodayBrief({ ...args, now: NOW })).toBeNull();
    expect(kept(storage)[KEY].text).toBeNull();
    expect(await getTodayBrief({ ...args, now: new Date(NOW.getTime() + INSIGHT_MISS_MS - 1) })).toBeNull();
    expect(ask).toHaveBeenCalledTimes(1);
    ask.mockResolvedValue(BRIEF);
    expect(await getTodayBrief({ ...args, now: new Date(NOW.getTime() + INSIGHT_MISS_MS) })).toEqual(BRIEF);
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('is nothing when asking throws', async () => {
    const storage = makeStorage();
    const ask = jest.fn(async () => { throw new Error('offline'); });
    expect(await getTodayBrief({ user: USER, now: NOW, ask, buildMessages: async () => [], storage })).toBeNull();
    expect(kept(storage)[KEY].text).toBeNull();
  });

  it('is nothing, and asks nothing, when the messages cannot be built', async () => {
    const ask = jest.fn(async () => BRIEF);
    const buildMessages = jest.fn(async () => { throw new Error('stores'); });
    expect(await getTodayBrief({ user: USER, now: NOW, ask, buildMessages, storage: makeStorage() })).toBeNull();
    expect(ask).not.toHaveBeenCalled();
  });

  it('shares one request between callers that ask at the same moment, and is free to ask again once it is done', async () => {
    const storage = makeStorage();
    let finish;
    const ask = jest.fn(() => new Promise((resolve) => { finish = resolve; }));
    const buildMessages = jest.fn(async () => []);
    const args = { user: USER, now: NOW, ask, buildMessages, storage };
    const first = getTodayBrief(args);
    const second = getTodayBrief(args);
    await new Promise((r) => setImmediate(r));
    finish(BRIEF);
    expect(await first).toEqual(BRIEF);
    expect(await second).toEqual(BRIEF);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(buildMessages).toHaveBeenCalledTimes(1);
    // Done and kept: the next call reads it.
    expect(await getTodayBrief(args)).toEqual(BRIEF);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('does not keep sharing a request that failed: after the half hour it asks afresh', async () => {
    const storage = makeStorage();
    const ask = jest.fn(async () => { throw new Error('x'); });
    const args = { user: USER, ask, buildMessages: async () => [], storage };
    await getTodayBrief({ ...args, now: NOW });
    ask.mockResolvedValue(BRIEF);
    expect(await getTodayBrief({ ...args, now: new Date(NOW.getTime() + INSIGHT_MISS_MS + 1) })).toEqual(BRIEF);
  });

  it('writes the brief again when what is kept is not one', async () => {
    const storage = makeStorage({ [BRIEF_STORAGE_KEY]: JSON.stringify({ [KEY]: { text: 'not a brief', at: NOW.getTime() } }) });
    const ask = jest.fn(async () => BRIEF);
    expect(await getTodayBrief({ user: USER, now: NOW, ask, buildMessages: async () => [], storage })).toEqual(BRIEF);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(JSON.parse(kept(storage)[KEY].text)).toEqual(BRIEF);
  });

  it('starts over when what is kept cannot be read, and still gives the brief when it cannot be kept', async () => {
    const storage = makeStorage({ [BRIEF_STORAGE_KEY]: '{oops' });
    storage.setItem = jest.fn(async () => { throw new Error('full'); });
    const ask = jest.fn(async () => BRIEF);
    expect(await getTodayBrief({ user: USER, now: NOW, ask, buildMessages: async () => [], storage })).toEqual(BRIEF);
    storage.getItem = jest.fn(async () => { throw new Error('locked'); });
    expect(await getTodayBrief({ user: USER, now: NOW, ask, buildMessages: async () => [], storage })).toEqual(BRIEF);
  });

  it('files a new brief with the ones already kept, not instead of them', async () => {
    const other = { text: JSON.stringify(BRIEF), at: NOW.getTime() - 86400000 };
    const storage = makeStorage({ [BRIEF_STORAGE_KEY]: JSON.stringify({ 'brief|u1|2026-10-19': other }) });
    await getTodayBrief({ user: USER, now: NOW, ask: async () => BRIEF, buildMessages: async () => [], storage });
    expect(Object.keys(kept(storage)).sort()).toEqual(['brief|u1|2026-10-19', KEY]);
  });
});

describe('bringing the stores up to date', () => {
  it('loads each store for this person, the saved readings before the phone\'s own', async () => {
    const order = [];
    global.__s.health.loadAllHealth = jest.fn(async () => { order.push('saved'); });
    global.__s.health.syncReadings = jest.fn(async () => { order.push('phone'); });
    await loadBriefSources('u1');
    expect(global.__s.workout.loadWorkouts).toHaveBeenCalledWith('u1');
    expect(global.__s.running.loadRuns).toHaveBeenCalledWith('u1');
    expect(global.__s.hiking.loadCompletedHikes).toHaveBeenCalledWith('u1');
    expect(global.__s.loadSnapshotSources).toHaveBeenCalledWith('u1');
    expect(global.__s.loadHabitSources).toHaveBeenCalledWith('u1');
    expect(global.__s.health.loadAllHealth).toHaveBeenCalledWith('u1');
    expect(global.__s.health.loadRookRecovery).toHaveBeenCalledTimes(1);
    expect(global.__s.health.syncReadings).toHaveBeenCalledWith('u1');
    expect(order).toEqual(['saved', 'phone']);
  });

  it('has the phone\'s own readings in the record before it goes on', async () => {
    global.__s.health.syncReadings = jest.fn(async () => {
      await new Promise((r) => setImmediate(r));
      global.__s.health.readingsHistory = { '2026-10-20': { sleepHours: 8 } };
    });
    await loadBriefSources('u1');
    expect(global.__s.health.readingsHistory).toEqual({ '2026-10-20': { sleepHours: 8 } });
  });

  it('reads the history of the three primary lifts, and gives the best of each', async () => {
    const asked = [];
    global.__s.workout.getExerciseHistory = jest.fn(async (name) => {
      asked.push(name);
      return name === 'Squat' ? [{ weight: 100, reps: 5, date: '2026-10-12T10:00:00.000Z' }] : [];
    });
    const prs = await loadBriefSources('u1');
    expect(asked.sort()).toEqual(['Bench Press', 'Deadlift', 'Squat']);
    expect(global.__s.workout.getExerciseHistory).toHaveBeenCalledWith('Squat', 'u1');
    expect(prs).toHaveLength(1);
    expect(prs[0]).toMatchObject({ name: 'Squat', bestWeight: 100, bestReps: 5 });
  });

  it('goes on with the rest when one load fails, however it fails', async () => {
    global.__s.workout.loadWorkouts = jest.fn(async () => { throw new Error('offline'); });
    global.__s.running.loadRuns = jest.fn(() => { throw new Error('sync'); });
    global.__s.loadSnapshotSources = jest.fn(() => Promise.reject(new Error('x')));
    global.__s.health.loadAllHealth = jest.fn(async () => { throw new Error('y'); });
    global.__s.health.syncReadings = jest.fn(async () => { throw new Error('z'); });
    global.__s.workout.getExerciseHistory = jest.fn(async () => { throw new Error('h'); });
    expect(await loadBriefSources('u1')).toEqual([]);
    expect(global.__s.hiking.loadCompletedHikes).toHaveBeenCalledTimes(1);
    expect(global.__s.health.loadRookRecovery).toHaveBeenCalledTimes(1);
    expect(global.__s.workout.getExerciseHistory).toHaveBeenCalledTimes(3);
  });

  it('treats a history that is not a list as no history', async () => {
    global.__s.workout.getExerciseHistory = jest.fn(async () => ({ not: 'a list' }));
    expect(await loadBriefSources('u1')).toEqual([]);
  });

  it('gives up waiting for a store that does not answer, and goes ahead with what it has', async () => {
    jest.useFakeTimers();
    global.__s.workout.loadWorkouts = jest.fn(() => new Promise(() => {}));
    let done = false;
    const pending = loadBriefSources('u1').then((prs) => { done = true; return prs; });
    await jest.advanceTimersByTimeAsync(BRIEF_LOAD_PATIENCE_MS - 1);
    expect(done).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual([]);
    expect(done).toBe(true);
    expect(global.__s.workout.getExerciseHistory).not.toHaveBeenCalled();
  });

  it('waits ten seconds by default, or as long as it is told', async () => {
    expect(BRIEF_LOAD_PATIENCE_MS).toBe(10000);
    jest.useFakeTimers();
    global.__s.running.loadRuns = jest.fn(() => new Promise(() => {}));
    const pending = loadBriefSources('u1', { patience: 50 });
    await jest.advanceTimersByTimeAsync(50);
    expect(await pending).toEqual([]);
  });

  it('does not leave its timer running when the stores are quicker', async () => {
    jest.useFakeTimers();
    await loadBriefSources('u1');
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('what the AI is told', () => {
  const text = (messages) => messages.map((m) => m.content).join('\n');

  // Twenty days of the same readings: 8 hours of sleep, HRV 50 and resting heart rate 60, so today is as usual.
  const history = () => {
    const out = {};
    for (let n = 1; n <= 20; n += 1) out[day(n)] = { hrv: 50, restingHeartRate: 60, sleepHours: 8 };
    return out;
  };

  beforeEach(() => { jest.useFakeTimers().setSystemTime(NOW); });

  it('is the instructions, then who they are and today\'s facts, the Coach\'s snapshot and data, and the request', async () => {
    global.__s.health.readingsHistory = history();
    const messages = await loadBriefMessages({ user: { ...USER, fitnessMetrics: { injuries: [] } }, now: NOW });
    expect(messages.map((m) => m.role)).toEqual(['system', 'system', 'system', 'system', 'user']);
    expect(messages[0].content).toMatch(/Today brief/);
    expect(messages[2].content).toBe('SNAPSHOT: calendar and food.');
    expect(messages[3].content).toMatch(/^Here is this user's real, current logged data\./);
    expect(messages[4]).toEqual({ role: 'user', content: BRIEF_REQUEST });
    const facts = messages[1].content;
    expect(facts).toContain('Today is Tuesday, October 20, 2026.');
    expect(facts).toContain("The person's name is Sam.");
    expect(facts).toContain('Fitness level: intermediate.');
  });

  it('includes today\'s readiness and the last week\'s trends, worked out from the daily record', async () => {
    global.__s.health.readingsHistory = history();
    const facts = (await loadBriefMessages({ user: USER, now: NOW }))[1].content;
    expect(facts).toContain('Readiness today, worked out in the app from their own readings: 82 out of 100 (High).');
    expect(facts).toContain('Last 7 days: sleep 8.0 h on average over 7 of 7 days');
    expect(facts).toContain('resting heart rate 60 bpm on average over 7 of 7 days');
  });

  it('names HRV by the measure the source gives', async () => {
    global.__s.health.readingsHistory = history();
    global.__s.health.rookRecovery = { source: 'Apple Health', hrv: 50 };
    const facts = (await loadBriefMessages({ user: USER, now: NOW }))[1].content;
    expect(facts).toContain('HRV (SDNN) 50 ms on average');
    expect(facts).toContain('HRV (SDNN): 50 ms today');
  });

  it('gives weight in the unit they use', async () => {
    global.__s.weight.logs = [{ weightKg: 80, createdAtLocal: new Date(2026, 9, 19, 7).toISOString() }];
    expect((await loadBriefMessages({ user: USER, now: NOW }))[1].content).toContain('weight 176.4 lb on average over 1 of 7 days');
    global.__s.settings = { weightUnits: 'metric' };
    expect((await loadBriefMessages({ user: USER, now: NOW }))[1].content).toContain('weight 80.0 kg on average over 1 of 7 days');
  });

  it('leaves out what it has no readings for, rather than inventing it', async () => {
    const facts = (await loadBriefMessages({ user: USER, now: NOW }))[1].content;
    expect(facts).not.toMatch(/Readiness/);
    expect(facts).not.toMatch(/Last 7 days/);
  });

  it('counts the workouts of the last 30 days, in any form a date is kept in', async () => {
    const at = (n) => new Date(2026, 9, 20 - n, 7);
    global.__s.workout.completedWorkouts = [
      { date: at(1).toISOString() },
      { date: { toDate: () => at(29) } },
      { date: new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000) }, // exactly 30 days ago still counts
      { date: at(30).toISOString() }, // an hour more than 30 days ago does not
      { date: at(31).toISOString() },
      { date: 'not a date' },
      { date: undefined },
    ];
    expect((await loadBriefMessages({ user: USER, now: NOW }))[3].content).toContain('Workouts logged in the last 30 days: 3.');
  });

  it('tells the AI about the training load, runs and hikes the Coach is told about', async () => {
    const at = (n) => new Date(2026, 9, 20 - n, 7);
    global.__s.running.runs = [{ endTime: at(2).toISOString(), calories: 400, distance: 5000 }];
    const data = (await loadBriefMessages({ user: USER, now: NOW }))[3].content;
    expect(data).toMatch(/Last 7 days: 1 run\(s\)/);
  });

  it('is still written from the rest when the Coach\'s snapshot cannot be read', async () => {
    global.__s.buildSnapshot = jest.fn(() => { throw new Error('store'); });
    const messages = await loadBriefMessages({ user: USER, now: NOW });
    expect(messages.map((m) => m.role)).toEqual(['system', 'system', 'system', 'user']);
    expect(text(messages)).not.toMatch(/SNAPSHOT/);
  });

  it('hands the person and the time to the snapshot, as the Coach does', async () => {
    await loadBriefMessages({ user: USER, now: NOW });
    expect(global.__s.buildSnapshot).toHaveBeenCalledWith(USER, NOW);
  });

  it('brings the stores up to date first, with the patience it is given', async () => {
    global.__s.workout.loadWorkouts = jest.fn(() => new Promise(() => {}));
    const pending = loadBriefMessages({ user: USER, now: NOW, patience: 20 });
    await jest.advanceTimersByTimeAsync(20);
    expect((await pending).length).toBeGreaterThan(2);
    expect(global.__s.workout.loadWorkouts).toHaveBeenCalledWith('u1');
  });
});
