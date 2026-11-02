// generateChallenges as a whole, on the server (functions/src/index.js): which period each challenge belongs to, the document id it is
// stored under, and what happens when two people open Challenges at the same moment. index.js is loaded with the Firebase packages and
// OpenAI replaced by small fakes, and the clock is set to the instants that matter.

jest.mock('firebase-admin/app', () => ({ initializeApp: jest.fn() }), { virtual: true });
jest.mock('firebase-admin/firestore', () => ({ getFirestore: () => global.__db, FieldValue: { serverTimestamp: () => 'ts' } }), { virtual: true });
jest.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({}) }), { virtual: true });
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({}) }), { virtual: true });
jest.mock('firebase-admin/storage', () => ({ getStorage: () => ({ bucket: () => ({}) }) }), { virtual: true });
jest.mock('firebase-functions/v2/https', () => {
  class HttpsError extends Error {
    constructor(code, message, details) { super(message); this.code = code; this.details = details; }
  }
  return { onCall: (opts, handler) => Object.assign(handler, { __opts: opts }), onRequest: (opts, handler) => handler, HttpsError };
}, { virtual: true });
jest.mock('firebase-functions/v2/firestore', () => ({ onDocumentCreated: (opts, handler) => handler, onDocumentDeleted: (opts, handler) => handler }), { virtual: true });
jest.mock('firebase-functions/params', () => ({ defineSecret: (name) => ({ name, value: () => 'secret-' + name }) }), { virtual: true });
jest.mock('openai', () => ({
  __esModule: true,
  default: class OpenAI {
    constructor() { this.chat = { completions: { create: (...args) => global.__create(...args) } }; }
  },
}), { virtual: true });
jest.mock('../functions/src/accountErasure.js', () => ({ eraseUserAccount: jest.fn() }));

const AUTH = { uid: 'u1' };
const CADENCES = ['daily', 'weekly', 'monthly', 'seasonal'];

let fns;
const generate = () => fns.generateChallenges({ auth: AUTH, data: {} });
const clockAt = (iso) => jest.useFakeTimers({ now: new Date(iso), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });

// Firestore with the challenges in a map: queries on cadence and periodKey, doc(id).create() that fails with ALREADY_EXISTS when the
// document is there. Every other collection is empty. Writes are counted so a repeat can be seen.
const fakeDb = (existing = {}) => {
  const docs = new Map(Object.entries(existing).map(([id, data]) => [id, data]));
  global.__challenges = docs;
  global.__createAttempts = [];
  const queryOn = (name, filters = []) => ({
    where: (field, op, value) => queryOn(name, [...filters, [field, value]]),
    limit: () => queryOn(name, filters),
    get: async () => {
      const rows = name === 'challenges'
        ? [...docs.entries()].filter(([, d]) => filters.every(([f, v]) => d[f] === v)).map(([id, d]) => ({ id, data: () => d }))
        : [];
      return { empty: rows.length === 0, docs: rows, size: rows.length };
    },
  });
  global.__db = {
    collection: (name) => ({
      ...queryOn(name),
      doc: (id) => ({
        id,
        create: async (data) => {
          global.__createAttempts.push(id);
          await Promise.resolve();
          if (docs.has(id)) {
            const e = new Error('6 ALREADY_EXISTS: Document already exists');
            e.code = 6;
            throw e;
          }
          docs.set(id, data);
        },
      }),
    }),
  };
};

const challengeFor = (cadence) => ({ cadence, title: `A ${cadence} challenge`, description: 'd', category: 'Cardio', difficulty: 'beginner', goalType: 'workout_count', goalTarget: 3, basedOn: 'b' });
const fakeModel = (cadences = CADENCES) => {
  global.__create = jest.fn(async () => ({ choices: [{ message: { content: JSON.stringify({ challenges: cadences.map(challengeFor) }) } }] }));
};

beforeEach(() => {
  jest.resetModules();
  fns = require('../functions/src/index.js');
  fakeDb();
  fakeModel();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete global.__create; delete global.__db; delete global.__challenges; delete global.__createAttempts;
});

describe('generateChallenges: one document per cadence and period', () => {
  it('stores each challenge under its cadence and period, with the period cut at Eastern midnight', async () => {
    clockAt('2026-11-03T01:00:00Z'); // 8 PM on Monday 2 November in New York
    const out = await generate();

    expect([...global.__challenges.keys()].sort()).toEqual([
      'daily_day-2026-11-02',
      'monthly_month-2026-11',
      'seasonal_season-fall-2026',
      'weekly_week-2026-11-02',
    ]);
    const daily = global.__challenges.get('daily_day-2026-11-02');
    expect(daily).toMatchObject({ cadence: 'daily', periodKey: 'day-2026-11-02', createdBy: 'u1', source: 'ai_generated' });
    expect(daily.startDate.toISOString()).toBe('2026-11-02T05:00:00.000Z');
    expect(daily.endDate.toISOString()).toBe('2026-11-03T04:59:59.999Z');
    expect(out.generated.map((c) => c.id).sort()).toEqual([...global.__challenges.keys()].sort());
  });

  it('still calls the daily challenge today\'s at 8 PM Eastern, and starts a new one at Eastern midnight', async () => {
    clockAt('2026-11-03T04:59:59Z'); // 11:59:59 PM on 2 November in New York
    await generate();
    expect(global.__challenges.has('daily_day-2026-11-02')).toBe(true);
    expect(global.__challenges.has('daily_day-2026-11-03')).toBe(false);

    jest.setSystemTime(new Date('2026-11-03T05:00:00Z')); // midnight
    const out = await generate();
    expect(global.__challenges.has('daily_day-2026-11-03')).toBe(true);
    expect(out.generated.map((c) => c.id)).toEqual(['daily_day-2026-11-03']); // the week, month and season are still the same ones
  });

  it('writes nothing for a second visit in the same period', async () => {
    clockAt('2026-11-03T01:00:00Z');
    await generate();
    global.__createAttempts.length = 0;
    global.__create.mockClear();
    const out = await generate();
    expect(out).toEqual({ generated: [], communityStats: null });
    expect(global.__createAttempts).toEqual([]);
    expect(global.__create).not.toHaveBeenCalled();
  });

  it('makes one set when two people open Challenges at the same moment on a new day', async () => {
    clockAt('2026-11-03T15:00:00Z');
    const [a, b] = await Promise.all([generate(), generate()]);

    // Both got past the "is there one yet" check and both tried to write all four; the second of each pair was refused.
    expect(global.__createAttempts).toHaveLength(8);
    expect(global.__challenges.size).toBe(4);
    const returned = [...a.generated, ...b.generated].map((c) => c.id).sort();
    expect(returned).toEqual([...global.__challenges.keys()].sort()); // each challenge is handed back by exactly one of them
  });

  it('leaves a set from the old random ids alone and does not add another for the same period', async () => {
    clockAt('2026-11-03T01:00:00Z');
    fakeDb({ aRandomOldId1: { cadence: 'daily', periodKey: 'day-2026-11-02' } });
    fakeModel(['weekly', 'monthly', 'seasonal']);
    const out = await generate();
    expect(global.__challenges.has('daily_day-2026-11-02')).toBe(false);
    expect(out.generated.map((c) => c.cadence).sort()).toEqual(['monthly', 'seasonal', 'weekly']);
    expect(global.__create.mock.calls[0][0].messages.at(-1).content).toContain('for each of these cadences: weekly, monthly, seasonal.');
  });

  it('keeps the other challenges when one of them already exists', async () => {
    clockAt('2026-11-03T01:00:00Z');
    // The weekly one appears between the check and the write (someone else was a moment ahead).
    const real = global.__db.collection;
    global.__db.collection = (name) => {
      const c = real(name);
      if (name !== 'challenges') return c;
      return { ...c, doc: (id) => (id === 'weekly_week-2026-11-02' ? { id, create: async () => { const e = new Error('ALREADY_EXISTS'); e.code = 6; throw e; } } : c.doc(id)) };
    };
    const out = await generate();
    expect([...global.__challenges.keys()].sort()).toEqual(['daily_day-2026-11-02', 'monthly_month-2026-11', 'seasonal_season-fall-2026']);
    expect(out.generated.map((c) => c.cadence).sort()).toEqual(['daily', 'monthly', 'seasonal']);
  });

  it('tells the AI how many days are left in the season, counted to Eastern midnight', async () => {
    clockAt('2026-11-03T01:00:00Z');
    await generate();
    const prompt = global.__create.mock.calls[0][0].messages.at(-1).content;
    expect(prompt).toMatch(/current fall season/);
    expect(prompt).toMatch(/\(28 days left\)/); // from 8 PM on 2 November to Eastern midnight at the end of 30 November, 28 days and 4 hours, rounded
  });

  it('returns the start and end of each period as ISO strings', async () => {
    clockAt('2026-07-15T16:00:00Z'); // summer, daylight time
    const out = await generate();
    const monthly = out.generated.find((c) => c.cadence === 'monthly');
    expect(monthly.id).toBe('monthly_month-2026-07');
    expect(monthly.startDate).toBe('2026-07-01T04:00:00.000Z');
    expect(monthly.endDate).toBe('2026-08-01T03:59:59.999Z');
  });
});
