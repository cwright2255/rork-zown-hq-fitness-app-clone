// services/coachMemoryService.js: the Coach's notes in the person's own account. Loading and refreshing never throw and never take a failed
// read for an empty memory; changes made from the memory screen do throw when they cannot be saved; a slow AI answer never undoes a change
// the person made while it was on its way.
jest.mock('firebase/firestore', () => ({
  doc: (...a) => global.__fs.doc(...a),
  getDoc: (...a) => global.__fs.getDoc(...a),
  setDoc: (...a) => global.__fs.setDoc(...a),
}), { virtual: true });
jest.mock('../src/config/firebase', () => ({ db: { fake: true } }));
jest.mock('../services/aiService', () => ({ generateCoachMemory: jest.fn() }));

import {
  loadCoachMemory, getCachedCoachMemory, removeCoachNote, forgetCoachMemory, setCoachMemoryPaused, refreshCoachMemory,
} from '../services/coachMemoryService';
import { generateCoachMemory } from '../services/aiService';
import { MEMORY_SYSTEM_PROMPT } from '../lib/coachMemory';

const PATH = 'users/u1/data/coachMemory';
const T = (n) => new Date(2026, 9, 20, 8, n);
const NOW = new Date(2026, 9, 20, 9, 0).getTime();
const EMPTY = { facts: [], paused: false, upTo: 0, updatedAt: 0 };

// A small stand-in for Firestore: documents in a map.
const makeFs = (seed = {}) => {
  const docs = new Map(Object.entries(seed));
  return {
    docs,
    doc: jest.fn((db, ...parts) => ({ path: parts.join('/'), db })),
    getDoc: jest.fn(async (ref) => ({ exists: () => docs.has(ref.path), data: () => docs.get(ref.path) })),
    setDoc: jest.fn(async (ref, data) => { docs.set(ref.path, data); }),
  };
};
const history = (...items) => items.map(([role, content, n]) => ({ role, content, createdAt: T(n) }));
const CHAT = history(['user', 'I can only train 3 days a week', 1], ['assistant', 'Got it.', 2], ['user', 'And I train at home', 3]);

beforeEach(() => {
  jest.clearAllMocks();
  global.__fs = makeFs();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); });

describe('loadCoachMemory', () => {
  it('reads the document under the person\'s own data, and cleans what it finds', async () => {
    global.__fs = makeFs({ [PATH]: { facts: [' A ', 'a', 'B'], paused: true, upTo: 5, updatedAt: 6, secret: 'x' } });
    expect(await loadCoachMemory('u1')).toEqual({ facts: ['A', 'B'], paused: true, upTo: 5, updatedAt: 6 });
    expect(global.__fs.doc).toHaveBeenCalledWith({ fake: true }, 'users', 'u1', 'data', 'coachMemory');
  });

  it('is an empty memory when nothing is saved, or what is saved is damaged', async () => {
    expect(await loadCoachMemory('u1')).toEqual(EMPTY);
    global.__fs = makeFs({ [PATH]: 'garbage' });
    expect(await loadCoachMemory('u1')).toEqual(EMPTY);
  });

  it('reads nothing without a person', async () => {
    for (const uid of [undefined, null, '']) expect(await loadCoachMemory(uid)).toEqual(EMPTY);
    expect(global.__fs.getDoc).not.toHaveBeenCalled();
  });

  it('keeps what it read for the Coach to use on every message without another read', async () => {
    expect(getCachedCoachMemory('u9')).toEqual(EMPTY);
    global.__fs = makeFs({ 'users/u9/data/coachMemory': { facts: ['Likes running'] } });
    await loadCoachMemory('u9');
    global.__fs.getDoc.mockClear();
    expect(getCachedCoachMemory('u9').facts).toEqual(['Likes running']);
    expect(getCachedCoachMemory('u8')).toEqual(EMPTY);
    expect(global.__fs.getDoc).not.toHaveBeenCalled();
  });

  it('does not throw when it cannot read: it gives what the phone last saw, or an empty memory', async () => {
    global.__fs = makeFs({ 'users/u7/data/coachMemory': { facts: ['Kept'] } });
    await loadCoachMemory('u7');
    global.__fs.getDoc.mockRejectedValue(new Error('offline'));
    expect((await loadCoachMemory('u7')).facts).toEqual(['Kept']);
    expect(await loadCoachMemory('u6')).toEqual(EMPTY);
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('removeCoachNote', () => {
  it('takes out one note, saves only what belongs in a memory, and gives back what is saved', async () => {
    global.__fs = makeFs({ [PATH]: { facts: ['A', 'B', 'C'], paused: false, upTo: 5, updatedAt: 6, stray: 1 } });
    const before = Date.now();
    const out = await removeCoachNote('u1', 1);
    expect(out.facts).toEqual(['A', 'C']);
    expect(out.upTo).toBe(5);
    expect(out.updatedAt).toBeGreaterThanOrEqual(before);
    expect(Object.keys(global.__fs.docs.get(PATH)).sort()).toEqual(['facts', 'paused', 'upTo', 'updatedAt']);
    expect(global.__fs.docs.get(PATH)).toEqual(out);
    expect(getCachedCoachMemory('u1')).toEqual(out);
  });

  it('keeps a pause', async () => {
    global.__fs = makeFs({ [PATH]: { facts: ['A', 'B'], paused: true } });
    expect((await removeCoachNote('u1', 0)).paused).toBe(true);
  });

  it('throws when it cannot read or save, and does not change what the phone has kept', async () => {
    global.__fs = makeFs({ [PATH]: { facts: ['A', 'B'] } });
    await loadCoachMemory('u1');
    global.__fs.setDoc.mockRejectedValueOnce(new Error('denied'));
    await expect(removeCoachNote('u1', 0)).rejects.toThrow('denied');
    expect(getCachedCoachMemory('u1').facts).toEqual(['A', 'B']);
    global.__fs.getDoc.mockRejectedValueOnce(new Error('offline'));
    await expect(removeCoachNote('u1', 0)).rejects.toThrow('offline');
    expect(global.__fs.docs.get(PATH).facts).toEqual(['A', 'B']);
  });
});

describe('forgetCoachMemory', () => {
  it('leaves no notes and counts the chat up to now as looked at, so old chats are not read again', async () => {
    global.__fs = makeFs({ [PATH]: { facts: ['A', 'B'], upTo: 5, updatedAt: 6 } });
    const before = Date.now();
    const out = await forgetCoachMemory('u1');
    expect(out.facts).toEqual([]);
    expect(out.upTo).toBeGreaterThanOrEqual(before);
    expect(out.updatedAt).toBe(out.upTo);
    expect(global.__fs.docs.get(PATH)).toEqual(out);
    expect(getCachedCoachMemory('u1')).toEqual(out);
  });

  it('keeps a pause', async () => {
    global.__fs = makeFs({ [PATH]: { facts: ['A'], paused: true } });
    expect((await forgetCoachMemory('u1')).paused).toBe(true);
  });

  it('forgets even when nothing was saved yet, so the old chat is not learned from afterwards', async () => {
    const out = await forgetCoachMemory('u1');
    expect(out.upTo).toBeGreaterThan(0);
    expect(global.__fs.docs.has(PATH)).toBe(true);
  });

  it('throws when it cannot save, rather than let the screen show a list that is not true', async () => {
    global.__fs = makeFs({ [PATH]: { facts: ['A'] } });
    global.__fs.setDoc.mockRejectedValueOnce(new Error('denied'));
    await expect(forgetCoachMemory('u1')).rejects.toThrow('denied');
    expect(global.__fs.docs.get(PATH).facts).toEqual(['A']);
  });
});

describe('setCoachMemoryPaused', () => {
  it('pauses it, keeping the notes and the place in the chat', async () => {
    global.__fs = makeFs({ [PATH]: { facts: ['A'], upTo: 5, updatedAt: 6 } });
    const out = await setCoachMemoryPaused('u1', true);
    expect(out).toMatchObject({ facts: ['A'], paused: true, upTo: 5 });
    expect(out.updatedAt).toBeGreaterThan(6);
    expect(global.__fs.docs.get(PATH)).toEqual(out);
  });

  it('resumes it from now on: what was said while it was paused is not noted afterwards', async () => {
    global.__fs = makeFs({ [PATH]: { facts: ['A'], paused: true, upTo: 5, updatedAt: 6 } });
    const before = Date.now();
    const out = await setCoachMemoryPaused('u1', false);
    expect(out.paused).toBe(false);
    expect(out.facts).toEqual(['A']);
    expect(out.upTo).toBeGreaterThanOrEqual(before);
  });

  it('pauses only for exactly true', async () => {
    for (const value of [1, 'true', undefined, null]) expect((await setCoachMemoryPaused('u1', value)).paused).toBe(false);
  });

  it('throws when it cannot save', async () => {
    global.__fs.setDoc.mockRejectedValueOnce(new Error('denied'));
    await expect(setCoachMemoryPaused('u1', true)).rejects.toThrow('denied');
  });
});

describe('refreshCoachMemory', () => {
  const ask = (facts) => jest.fn(async () => facts);

  it('learns from the chat: asks with the notes and the new messages, and saves the answer with the time of the last message looked at', async () => {
    global.__fs = makeFs({ [PATH]: { facts: ['Likes running'], upTo: 0, updatedAt: 0 } });
    const answer = ask(['Likes running', 'Can train 3 days a week']);
    const out = await refreshCoachMemory({ uid: 'u1', history: CHAT, ask: answer, now: NOW });
    expect(answer).toHaveBeenCalledTimes(1);
    const sent = answer.mock.calls[0][0];
    expect(sent.current).toEqual(['Likes running']);
    expect(sent.messages[0]).toEqual({ role: 'system', content: MEMORY_SYSTEM_PROMPT });
    expect(sent.messages[1].content).toContain('Current notes (JSON): ["Likes running"]');
    expect(sent.messages[1].content).toContain('{"role":"user","content":"I can only train 3 days a week"},{"role":"assistant","content":"Got it."},{"role":"user","content":"And I train at home"}');
    expect(out).toEqual({ facts: ['Likes running', 'Can train 3 days a week'], paused: false, upTo: T(3).getTime(), updatedAt: NOW });
    expect(global.__fs.docs.get(PATH)).toEqual(out);
    expect(getCachedCoachMemory('u1')).toEqual(out);
  });

  it('looks only at messages after the last look', async () => {
    global.__fs = makeFs({ [PATH]: { facts: [], upTo: T(2).getTime(), updatedAt: 1 } });
    const answer = ask(['x']);
    await refreshCoachMemory({ uid: 'u1', history: CHAT, ask: answer, now: NOW });
    expect(answer).not.toHaveBeenCalled(); // only one message from the person is new
    const more = [...CHAT, ...history(['user', 'Also I have dumbbells', 4])];
    await refreshCoachMemory({ uid: 'u1', history: more, ask: answer, now: NOW });
    const content = answer.mock.calls[0][0].messages[1].content;
    expect(content).toContain('And I train at home');
    expect(content).toContain('Also I have dumbbells');
    expect(content).not.toContain('3 days a week');
  });

  it('does not ask until the person has said enough, and does not count the Coach\'s own words', async () => {
    const answer = ask(['x']);
    await refreshCoachMemory({ uid: 'u1', history: history(['user', 'Hi', 1], ['assistant', 'Hello', 2], ['assistant', 'More', 3]), ask: answer, now: NOW });
    await refreshCoachMemory({ uid: 'u1', history: [], ask: answer, now: NOW });
    expect(answer).not.toHaveBeenCalled();
    expect(global.__fs.docs.has(PATH)).toBe(false);
  });

  it('does nothing while paused: no AI request, nothing saved', async () => {
    global.__fs = makeFs({ [PATH]: { facts: ['A'], paused: true } });
    const answer = ask(['x']);
    const out = await refreshCoachMemory({ uid: 'u1', history: CHAT, ask: answer, now: NOW });
    expect(answer).not.toHaveBeenCalled();
    expect(out.facts).toEqual(['A']);
    expect(global.__fs.setDoc).not.toHaveBeenCalled();
  });

  it('does nothing without a person', async () => {
    const answer = ask(['x']);
    expect(await refreshCoachMemory({ uid: undefined, history: CHAT, ask: answer })).toEqual(EMPTY);
    expect(answer).not.toHaveBeenCalled();
    expect(global.__fs.getDoc).not.toHaveBeenCalled();
  });

  it('saves nothing when the AI gives nothing, so the same messages are looked at again next time', async () => {
    global.__fs = makeFs({ [PATH]: { facts: ['A'], upTo: 1, updatedAt: 2 } });
    const out = await refreshCoachMemory({ uid: 'u1', history: CHAT, ask: ask(null), now: NOW });
    expect(out).toMatchObject({ facts: ['A'], upTo: 1, updatedAt: 2 });
    expect(global.__fs.setDoc).not.toHaveBeenCalled();
  });

  it('saves nothing, and does not throw, when asking throws', async () => {
    global.__fs = makeFs({ [PATH]: { facts: ['A'], upTo: 1, updatedAt: 2 } });
    const out = await refreshCoachMemory({ uid: 'u1', history: CHAT, ask: jest.fn(async () => { throw new Error('x'); }), now: NOW });
    expect(out).toEqual({ facts: ['A'], paused: false, upTo: 1, updatedAt: 2 });
    expect(global.__fs.setDoc).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith('[coachMemory] could not update the notes:', 'x');
  });

  it('does not take a failed read for an empty memory: it asks nothing and saves nothing, so notes that are really there are not written over', async () => {
    global.__fs = makeFs({ [PATH]: { facts: ['A', 'B'], upTo: 0, updatedAt: 0 } });
    global.__fs.getDoc.mockRejectedValue(new Error('offline'));
    const answer = ask(['Only this']);
    const out = await refreshCoachMemory({ uid: 'u1', history: CHAT, ask: answer, now: NOW });
    expect(answer).not.toHaveBeenCalled();
    expect(global.__fs.setDoc).not.toHaveBeenCalled();
    expect(out).toBeTruthy();
  });

  it('does not write over a note removed while the AI was working', async () => {
    global.__fs = makeFs({ [PATH]: { facts: ['A', 'B'], upTo: 0, updatedAt: 1 } });
    const answer = jest.fn(async () => {
      global.__fs.docs.set(PATH, { facts: ['A'], upTo: 0, updatedAt: 99 });
      return ['A', 'B', 'New'];
    });
    const out = await refreshCoachMemory({ uid: 'u1', history: CHAT, ask: answer, now: NOW });
    expect(out.facts).toEqual(['A']);
    expect(global.__fs.docs.get(PATH).facts).toEqual(['A']);
    expect(global.__fs.setDoc).not.toHaveBeenCalled();
  });

  it('does not write over everything forgotten while the AI was working', async () => {
    global.__fs = makeFs({ [PATH]: { facts: ['A'], upTo: 0, updatedAt: 1 } });
    const answer = jest.fn(async () => {
      global.__fs.docs.set(PATH, { facts: [], upTo: NOW, updatedAt: 1 });
      return ['A', 'New'];
    });
    await refreshCoachMemory({ uid: 'u1', history: CHAT, ask: answer, now: NOW });
    expect(global.__fs.docs.get(PATH).facts).toEqual([]);
  });

  it('does not write over a pause made while the AI was working', async () => {
    global.__fs = makeFs({ [PATH]: { facts: ['A'], upTo: 0, updatedAt: 1 } });
    const answer = jest.fn(async () => {
      global.__fs.docs.set(PATH, { facts: ['A'], paused: true, upTo: 0, updatedAt: 1 });
      return ['A', 'New'];
    });
    const out = await refreshCoachMemory({ uid: 'u1', history: CHAT, ask: answer, now: NOW });
    expect(out.paused).toBe(true);
    expect(global.__fs.setDoc).not.toHaveBeenCalled();
  });

  it('does not write over a change made only to the place in the chat', async () => {
    global.__fs = makeFs({ [PATH]: { facts: ['A'], upTo: 0, updatedAt: 1 } });
    const answer = jest.fn(async () => {
      global.__fs.docs.set(PATH, { facts: ['A'], upTo: 7, updatedAt: 1 });
      return ['A', 'New'];
    });
    await refreshCoachMemory({ uid: 'u1', history: CHAT, ask: answer, now: NOW });
    expect(global.__fs.setDoc).not.toHaveBeenCalled();
  });

  it('gives the notes as they were, without throwing, when it cannot save', async () => {
    global.__fs = makeFs({ [PATH]: { facts: ['A'], upTo: 0, updatedAt: 1 } });
    global.__fs.setDoc.mockRejectedValue(new Error('denied'));
    const out = await refreshCoachMemory({ uid: 'u1', history: CHAT, ask: ask(['A', 'New']), now: NOW });
    expect(out.facts).toEqual(['A']);
    expect(console.warn).toHaveBeenCalled();
  });

  it('shares one refresh between callers that ask at the same moment, and is free to run again once it is done', async () => {
    let finish;
    const answer = jest.fn(() => new Promise((resolve) => { finish = resolve; }));
    const args = { uid: 'u1', history: CHAT, ask: answer, now: NOW };
    const first = refreshCoachMemory(args);
    const second = refreshCoachMemory(args);
    await new Promise((r) => setImmediate(r));
    finish(['Can train 3 days a week']);
    const [a, b] = await Promise.all([first, second]);
    expect(a).toEqual(b);
    expect(answer).toHaveBeenCalledTimes(1);
    answer.mockResolvedValue(['Other']);
    await refreshCoachMemory({ ...args, history: [...CHAT, ...history(['user', 'one', 5], ['user', 'two', 6])] });
    expect(answer).toHaveBeenCalledTimes(2);
  });

  it('keeps separate refreshes for separate people', async () => {
    global.__fs = makeFs();
    const answer = ask(['x']);
    await Promise.all([
      refreshCoachMemory({ uid: 'u1', history: CHAT, ask: answer, now: NOW }),
      refreshCoachMemory({ uid: 'u2', history: CHAT, ask: answer, now: NOW }),
    ]);
    expect(answer).toHaveBeenCalledTimes(2);
    expect(global.__fs.docs.has('users/u1/data/coachMemory')).toBe(true);
    expect(global.__fs.docs.has('users/u2/data/coachMemory')).toBe(true);
  });

  it('asks the real AI call by default, with the \'memory\' request', async () => {
    generateCoachMemory.mockResolvedValue(['Default']);
    const out = await refreshCoachMemory({ uid: 'u1', history: CHAT });
    expect(generateCoachMemory).toHaveBeenCalledTimes(1);
    expect(out.facts).toEqual(['Default']);
    expect(out.updatedAt).toBeGreaterThan(0);
  });
});
