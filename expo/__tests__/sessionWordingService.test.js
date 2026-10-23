// Asking for the words around Today's Session and keeping them (services/sessionWordingService.js): what is sent, that only checked wording
// comes back, that the same session is not asked for twice, and that nothing throws.
jest.mock('@/services/aiService', () => ({ generateSessionWording: jest.fn() }));

import {
  wordSession, peekWording, clearWordingCache, WORDING_KEPT, WORDING_MISS_MS,
} from '../services/sessionWordingService';
import { wordingMessages, WORDING_SYSTEM } from '../lib/sessionWording';
import { generateSessionWording } from '@/services/aiService';

const exercise = (id, name, extra = {}) => ({
  id, name, sets: 3, role: 'compound', timed: false, bodyweight: false, repRange: { min: 8, max: 10 }, reps: '8-10', holdSeconds: null,
  restSeconds: 120, workSeconds: 45, weight: null, unit: null, target: null, detail: null,
  reason: "Chest: fully rested, 6 sets short of this week's 14-set aim.", facts: { muscle: 'chest', recovered: 100, done: 8, short: 6, aim: 14 }, ...extra,
});
const session = (over = {}) => ({
  status: 'ok', message: null, name: 'Chest', goal: 'muscle', level: 'intermediate', minutes: 30, totalSets: 6, leftOutFor: [], tired: [],
  exercises: [exercise('barbell-bench-press', 'Barbell Bench Press'), exercise('plank', 'Plank', { timed: true, reps: null, repRange: null, holdSeconds: 40 })],
  ...over,
});
const goodReply = () => ({
  name: 'Chest Day',
  picks: [{ id: 'barbell-bench-press', why: 'Your chest is fully rested and 6 sets short of its 14-set aim.' }, { id: 'plank', why: 'A plank adds core work in 3 sets.' }],
});
const WORDING = { name: 'Chest Day', note: null, why: { 'barbell-bench-press': goodReply().picks[0].why, plank: goodReply().picks[1].why } };
const options = { unit: 'kg', equipment: 'gym' };

beforeEach(() => {
  clearWordingCache();
  generateSessionWording.mockReset();
  generateSessionWording.mockResolvedValue(goodReply());
});

describe('the limits', () => {
  it('are 20 sessions kept and two minutes for a miss', () => {
    expect(WORDING_KEPT).toBe(20);
    expect(WORDING_MISS_MS).toBe(120000);
  });
});

describe('wordSession', () => {
  it('asks once, with the messages built from the session, and gives the checked wording', async () => {
    const ask = jest.fn(async () => goodReply());
    expect(await wordSession(session(), { ...options, ask })).toEqual(WORDING);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(ask).toHaveBeenCalledWith({ messages: wordingMessages(session(), options) });
    expect(ask.mock.calls[0][0].messages[0].content).toBe(WORDING_SYSTEM);
  });

  it('asks the real AI call when none is given', async () => {
    expect(await wordSession(session(), options)).toEqual(WORDING);
    expect(generateSessionWording).toHaveBeenCalledTimes(1);
  });

  it('gives only what passed the checks: a bad reason is not there', async () => {
    const reply = goodReply();
    reply.picks[1].why = 'A guaranteed, proven core exercise.';
    const out = await wordSession(session(), { ...options, ask: async () => reply });
    expect(out.why).toEqual({ 'barbell-bench-press': goodReply().picks[0].why });
  });

  it('gives nothing for an answer that fails as a whole, an exercise that is not in the session', async () => {
    const reply = goodReply();
    reply.picks.push({ id: 'deadlift', why: 'Your back is rested.' });
    expect(await wordSession(session(), { ...options, ask: async () => reply })).toBeNull();
  });

  it.each([[null], [undefined], ['text'], [{}], [[]], [{ picks: 'x' }]])('gives nothing for the reply %p', async (reply) => {
    expect(await wordSession(session(), { ...options, ask: async () => reply })).toBeNull();
  });

  it('gives nothing, and does not throw, when the AI call throws or the checks fail', async () => {
    expect(await wordSession(session(), { ...options, ask: async () => { throw new Error('offline'); } })).toBeNull();
    expect(await wordSession(session({ leftOutFor: ['knee'] }), { ...options, ask: () => { throw new Error('sync'); } })).toBeNull();
  });

  it('does not ask for a session that has nothing to word', async () => {
    const ask = jest.fn(async () => goodReply());
    const rest = { status: 'rest', message: 'Rest.', name: 'Session', exercises: [], leftOutFor: [] };
    for (const s of [rest, null, undefined, 'x', {}, session({ exercises: [] }), session({ status: 'full' }), session({ exercises: 'x' })]) {
      expect(await wordSession(s, { ...options, ask })).toBeNull();
    }
    expect(ask).not.toHaveBeenCalled();
  });

  it('keeps an answer for the same session, however the session object is made, and does not ask again', async () => {
    const ask = jest.fn(async () => goodReply());
    await wordSession(session(), { ...options, ask });
    expect(await wordSession(session(), { ...options, ask })).toEqual(WORDING);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('asks again when anything the words depend on changes', async () => {
    const ask = jest.fn(async () => goodReply());
    await wordSession(session(), { ...options, ask });
    await wordSession(session({ minutes: 45 }), { ...options, ask });
    await wordSession(session(), { unit: 'lb', equipment: 'gym', ask });
    await wordSession(session(), { unit: 'kg', equipment: 'dumbbells', ask });
    const changed = session();
    changed.exercises[0].sets = 4;
    await wordSession(changed, { ...options, ask });
    expect(ask).toHaveBeenCalledTimes(5);
  });

  it('shares one request between two askers at the same moment', async () => {
    let release;
    const ask = jest.fn(() => new Promise((resolve) => { release = () => resolve(goodReply()); }));
    const a = wordSession(session(), { ...options, ask });
    const b = wordSession(session(), { ...options, ask });
    await Promise.resolve();
    release();
    expect(await a).toEqual(WORDING);
    expect(await b).toEqual(WORDING);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('does not ask again for a try that gave nothing, until it has been two minutes', async () => {
    const ask = jest.fn(async () => null);
    const t0 = 1_000_000;
    expect(await wordSession(session(), { ...options, ask, now: t0 })).toBeNull();
    expect(await wordSession(session(), { ...options, ask, now: t0 + WORDING_MISS_MS - 1 })).toBeNull();
    expect(ask).toHaveBeenCalledTimes(1);
    expect(await wordSession(session(), { ...options, ask, now: t0 + WORDING_MISS_MS })).toBeNull();
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('does not let a miss stand in the way of an answer once the time is up', async () => {
    const t0 = 5_000;
    await wordSession(session(), { ...options, ask: async () => null, now: t0 });
    expect(await wordSession(session(), { ...options, ask: async () => goodReply(), now: t0 + WORDING_MISS_MS + 1 })).toEqual(WORDING);
    expect(await wordSession(session(), { ...options, ask: async () => null, now: t0 + 10 * WORDING_MISS_MS })).toEqual(WORDING);
  });

  it('keeps at most 20 sessions, the oldest going first', async () => {
    const ask = jest.fn(async () => goodReply());
    for (let i = 0; i < WORDING_KEPT + 1; i += 1) await wordSession(session({ minutes: 10 + i }), { ...options, ask });
    expect(ask).toHaveBeenCalledTimes(WORDING_KEPT + 1);
    expect(peekWording(session({ minutes: 10 }), options)).toBeUndefined(); // the first has gone
    expect(peekWording(session({ minutes: 11 }), options)).toEqual(WORDING);
    expect(peekWording(session({ minutes: 10 + WORDING_KEPT }), options)).toEqual(WORDING);
  });
});

describe('a session that is asked about again after a miss', () => {
  it('goes to the back of the line to be dropped, like any new answer', async () => {
    const ask = jest.fn(async () => goodReply());
    const t0 = 10_000;
    await wordSession(session({ minutes: 10 }), { ...options, ask: async () => null, now: t0 }); // the oldest, and a miss
    for (let i = 1; i < WORDING_KEPT; i += 1) await wordSession(session({ minutes: 10 + i }), { ...options, ask, now: t0 });
    await wordSession(session({ minutes: 10 }), { ...options, ask, now: t0 + WORDING_MISS_MS }); // asked again, and answered
    await wordSession(session({ minutes: 10 + WORDING_KEPT }), { ...options, ask, now: t0 + WORDING_MISS_MS }); // one more than fits
    expect(peekWording(session({ minutes: 10 }), { ...options, now: t0 + WORDING_MISS_MS })).toEqual(WORDING);
    expect(peekWording(session({ minutes: 11 }), { ...options, now: t0 + WORDING_MISS_MS })).toBeUndefined(); // this one went instead
  });
});

describe('a session that is broken', () => {
  it('gives nothing, and does not throw, when reading it throws', async () => {
    const broken = session();
    Object.defineProperty(broken.exercises[0], 'name', { get() { throw new Error('boom'); }, enumerable: true });
    const ask = jest.fn(async () => goodReply());
    await expect(wordSession(broken, { ...options, ask })).resolves.toBeNull();
    expect(peekWording(broken, options)).toBeUndefined();
    expect(ask).not.toHaveBeenCalled();
  });
});

describe('peekWording', () => {
  it('is undefined for a session that was never asked about, and never asks', () => {
    expect(peekWording(session(), options)).toBeUndefined();
    expect(generateSessionWording).not.toHaveBeenCalled();
  });

  it('is the wording once it is kept, and null for a recent try that gave nothing', async () => {
    await wordSession(session(), { ...options, ask: async () => goodReply(), now: 100 });
    expect(peekWording(session(), { ...options, now: 200 })).toEqual(WORDING);
    await wordSession(session({ minutes: 60 }), { ...options, ask: async () => null, now: 100 });
    expect(peekWording(session({ minutes: 60 }), { ...options, now: 200 })).toBeNull();
    expect(peekWording(session({ minutes: 60 }), { ...options, now: 100 + WORDING_MISS_MS })).toBeUndefined();
  });

  it('is null for a session that cannot be worded, and does not throw for something that is not a session', () => {
    [null, undefined, 'x', 7, {}, { status: 'rest', exercises: [] }].forEach((s) => expect(peekWording(s, options)).toBeNull());
  });
});
