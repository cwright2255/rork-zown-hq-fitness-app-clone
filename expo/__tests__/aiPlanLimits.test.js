// What each plan allows, on the server (functions/src/index.js with functions/src/aiQuota.js): the daily AI messages through postLLM,
// the Pro workout plans and the Legend body-scan insight. index.js is loaded with the Firebase packages and OpenAI replaced by small
// fakes, so nothing leaves the test.

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
const FREE = null;
const PRO = { tier: 'pro', status: 'active', expiresAt: null };
const LEGEND = { tier: 'legend', status: 'active', expiresAt: null };

let fns;
const call = (name, data, auth = AUTH) => fns[name]({ auth, data });
const isGateCall = (args) => String(args.messages?.[0]?.content).startsWith('You are the topic check');
const reply = (content) => ({ choices: [{ message: { content } }] });
const mainCalls = () => global.__create.mock.calls.map((c) => c[0]).filter((a) => !isGateCall(a));
const used = (bucket = 'coach') => (global.__docs.get('aiUsage/u1_' + global.__today) || {})[bucket] || 0;

const ask = (kind) => call('postLLM', { messages: [{ role: 'user', content: 'How much protein should I eat?' }], ...(kind ? { kind } : {}) });
const failure = async (promise) => { try { await promise; } catch (e) { return e; } throw new Error('expected a failure'); };

// Firestore with documents in a map, doc().get(), transactions one at a time, collection().add for saved recommendations, and enough
// of batch() for the challenge generator.
const fakeDb = (plan) => {
  const docs = new Map();
  if (plan) docs.set('entitlements/u1', plan);
  global.__docs = docs;
  let queue = Promise.resolve();
  const ref = (path) => ({ path, get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }) });
  const query = { where: () => query, limit: () => query, get: async () => ({ empty: true, docs: [], size: 0 }) };
  global.__saved = [];
  global.__db = {
    doc: ref,
    collection: () => ({ ...query, add: async (data) => { global.__saved.push(data); return { id: 'rec1' }; }, doc: () => ({ id: 'doc1' }) }),
    batch: () => ({ set: () => {}, commit: async () => {} }),
    runTransaction: (fn) => {
      const run = queue.then(() => fn({
        get: async (r) => r.get(),
        set: (r, data, opts) => docs.set(r.path, opts && opts.merge ? { ...docs.get(r.path), ...data } : data),
      }));
      queue = run.catch(() => {});
      return run;
    },
  };
};

const fakeModels = ({ allowed = true, answer = 'Here you go.' } = {}) => {
  global.__create = jest.fn(async (args) => (isGateCall(args) ? reply(JSON.stringify({ allowed })) : reply(answer)));
};

beforeEach(() => {
  jest.resetModules();
  global.__today = require('../lib/entitlements').aiDayKey(new Date());
  fns = require('../functions/src/index.js');
  fakeModels();
  fakeDb(FREE);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); delete global.__create; delete global.__db; delete global.__docs; delete global.__saved; delete global.__today; });

describe('postLLM: the daily AI messages', () => {
  it('answers a free person\'s first five Coach messages and counts each', async () => {
    for (let i = 1; i <= 5; i += 1) {
      expect(await ask()).toEqual({ completion: 'Here you go.' });
      expect(used()).toBe(i);
    }
  });

  it('turns the sixth away with a limit error that says what the limit was, and never reaches the AI', async () => {
    for (let i = 0; i < 5; i += 1) await ask();
    const before = global.__create.mock.calls.length;
    const error = await failure(ask());
    expect(error.code).toBe('resource-exhausted');
    expect(error.message).toBe('Today\'s coach AI messages are used up');
    expect(error.details).toEqual({ reason: 'ai_limit', bucket: 'coach', limit: 5, tier: 'free' });
    expect(global.__create.mock.calls.length).toBe(before);
    expect(used()).toBe(5);
  });

  it('counts the other helpers on their own, when the request says it is one', async () => {
    for (let i = 0; i < 5; i += 1) await ask();
    await expect(ask()).rejects.toMatchObject({ code: 'resource-exhausted' });
    expect(await ask('assist')).toEqual({ completion: 'Here you go.' });
    expect(used('assist')).toBe(1);
    expect(used('coach')).toBe(5);
  });

  it('reports the helper bucket when that is the one that ran out', async () => {
    for (let i = 0; i < 5; i += 1) await ask('assist');
    const error = await failure(ask('assist'));
    expect(error.details).toMatchObject({ bucket: 'assist', limit: 5, tier: 'free' });
  });

  it('counts the Health screen\'s own comment apart from the messages a person sends', async () => {
    for (let i = 0; i < 9; i += 1) await ask('insight');
    const error = await failure(ask('insight'));
    expect(error.details).toEqual({ reason: 'ai_limit', bucket: 'insight', limit: 9, tier: 'free' });
    expect(await ask('coach')).toEqual({ completion: 'Here you go.' });
    expect(used('insight')).toBe(9);
    expect(used('coach')).toBe(1);
  });

  it('counts a request that does not say what it is as a Coach message', async () => {
    await ask('whatever');
    await ask(undefined);
    expect(used('coach')).toBe(2);
    expect(used('assist')).toBe(0);
  });

  it('gives Pro more: the sixth goes through and the limit it reports is Pro\'s', async () => {
    fakeDb(PRO);
    for (let i = 0; i < 6; i += 1) await ask();
    expect(used()).toBe(6);
    global.__docs.set('aiUsage/u1_' + global.__today, { uid: 'u1', day: global.__today, coach: 100 });
    const error = await failure(ask());
    expect(error.details).toEqual({ reason: 'ai_limit', bucket: 'coach', limit: 100, tier: 'pro' });
  });

  it('gives Legend the most', async () => {
    fakeDb(LEGEND);
    global.__docs.set('aiUsage/u1_' + global.__today, { uid: 'u1', day: global.__today, coach: 299 });
    expect(await ask()).toEqual({ completion: 'Here you go.' });
    const error = await failure(ask());
    expect(error.details).toMatchObject({ limit: 300, tier: 'legend' });
  });

  it('goes back to the free limit when a plan has ended', async () => {
    fakeDb({ ...PRO, expiresAt: '2020-01-01T00:00:00.000Z' });
    global.__docs.set('aiUsage/u1_' + global.__today, { uid: 'u1', day: global.__today, coach: 5 });
    const error = await failure(ask());
    expect(error.details).toMatchObject({ limit: 5, tier: 'free' });
  });

  it('counts a request the model turns down as off-topic, since the check still cost something', async () => {
    fakeModels({ allowed: false });
    const out = await ask();
    expect(out.refused).toBe(true);
    expect(used()).toBe(1);
  });

  it('gives the message back when the AI fails before the person gets an answer', async () => {
    global.__create = jest.fn(async () => { throw new Error('OpenAI is down'); });
    await expect(ask()).rejects.toThrow('OpenAI is down');
    expect(used()).toBe(0);
    fakeModels();
    for (let i = 1; i <= 5; i += 1) expect(await ask()).toEqual({ completion: 'Here you go.' });
    await expect(ask()).rejects.toMatchObject({ code: 'resource-exhausted' });
  });

  it('gives back only the message of the failed request, in the bucket it came from', async () => {
    await ask('assist');
    await ask('coach');
    global.__create = jest.fn(async () => { throw new Error('boom'); });
    await expect(ask('assist')).rejects.toThrow('boom');
    expect(used('assist')).toBe(1);
    expect(used('coach')).toBe(1);
  });

  it('still reports the AI failure when giving the message back fails too', async () => {
    global.__create = jest.fn(async () => { throw new Error('OpenAI is down'); });
    const original = global.__db.runTransaction;
    let calls = 0;
    global.__db.runTransaction = (fn) => { calls += 1; return calls === 1 ? original(fn) : Promise.reject(new Error('could not write')); };
    await expect(ask()).rejects.toThrow('OpenAI is down');
  });

  it('does not use up a message on a request that is not valid', async () => {
    await expect(call('postLLM', { messages: [] })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(call('postLLM', {})).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(used()).toBe(0);
  });

  it('needs a signed-in person, and does not touch the counts without one', async () => {
    await expect(call('postLLM', { messages: [{ role: 'user', content: 'hi' }] }, null)).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(global.__docs.size).toBe(0);
  });

  it('counts each person on their own', async () => {
    for (let i = 0; i < 5; i += 1) await ask();
    await expect(ask()).rejects.toMatchObject({ code: 'resource-exhausted' });
    expect(await call('postLLM', { messages: [{ role: 'user', content: 'hi' }] }, { uid: 'u2' })).toEqual({ completion: 'Here you go.' });
  });
});

describe('generateWorkoutPlan: a Pro feature', () => {
  const request = { fitnessLevel: 'beginner', goals: ['build muscle'], history: [], profile: {} };

  it('turns a free person away, says it needs Pro, and neither reaches the AI nor saves anything', async () => {
    const error = await failure(call('generateWorkoutPlan', request));
    expect(error.code).toBe('permission-denied');
    expect(error.message).toBe('AI workout plans needs Pro');
    expect(error.details).toEqual({ reason: 'plan_required', feature: 'aiWorkoutPlan', needs: 'pro', tier: 'free' });
    expect(global.__create).not.toHaveBeenCalled();
    expect(global.__saved).toEqual([]);
  });

  it('works for Pro and for Legend', async () => {
    fakeModels({ answer: '{"days":[]}' });
    for (const plan of [PRO, LEGEND]) {
      fakeDb(plan);
      const out = await call('generateWorkoutPlan', request);
      expect(out.plan).toEqual({ days: [] });
    }
  });

  it('turns away a person whose Pro plan has ended', async () => {
    fakeDb({ ...PRO, status: 'expired' });
    await expect(call('generateWorkoutPlan', request)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('needs a signed-in person first', async () => {
    await expect(call('generateWorkoutPlan', request, null)).rejects.toMatchObject({ code: 'unauthenticated' });
  });
});

describe('generateBodyCompositionInsight: a Legend feature', () => {
  const request = { goal: 'lose fat', age: 40, scans: [{ date: '2026-01-01', measurements: {} }] };

  it('turns a free person away and says it needs Legend', async () => {
    const error = await failure(call('generateBodyCompositionInsight', request));
    expect(error.code).toBe('permission-denied');
    expect(error.message).toBe('Body scan and 3D body needs Legend');
    expect(error.details).toEqual({ reason: 'plan_required', feature: 'bodyScan', needs: 'legend', tier: 'free' });
    expect(global.__create).not.toHaveBeenCalled();
  });

  it('turns a Pro person away too', async () => {
    fakeDb(PRO);
    const error = await failure(call('generateBodyCompositionInsight', request));
    expect(error.details).toMatchObject({ needs: 'legend', tier: 'pro' });
    expect(global.__create).not.toHaveBeenCalled();
  });

  it('works for Legend', async () => {
    fakeDb(LEGEND);
    fakeModels({ answer: '{"summary":"Going well.","trend":"improving","suggestion":"Keep going."}' });
    const out = await call('generateBodyCompositionInsight', request);
    expect(out).toEqual({ summary: 'Going well.', trend: 'improving', suggestion: 'Keep going.' });
  });
});

describe('the AI functions that stay open to every plan', () => {
  it('still answer a free person: nutrition tips and challenges', async () => {
    fakeModels({ answer: '{}' });
    await call('getNutritionRecommendations', { recentWorkouts: [], goals: ['lose weight'], profile: {} });
    await call('generateChallenges', {});
    expect(mainCalls()).toHaveLength(2);
    expect(global.__docs.size).toBe(0);
  });
});
