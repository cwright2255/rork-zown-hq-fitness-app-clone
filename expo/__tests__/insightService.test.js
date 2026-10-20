// services/insightService.js: the training-load comment is asked for once per day for each set of numbers, kept on the phone,
// shared between callers that ask at the same moment, and never throws.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) },
}));
jest.mock('@/services/aiService', () => ({ generateTrainingLoadInsight: jest.fn() }));

import { getTrainingLoadInsight, INSIGHT_STORAGE_KEY } from '../services/insightService';

const LOAD = { acuteLoad: 900, chronicWeeklyAvg: 600, ratio: 1.5, zone: 'elevated', zoneLabel: 'x' };
const NOON = new Date(2026, 9, 14, 12, 0, 0); // the 14th, on the phone's own clock
const KEY = 'trainingLoad|u1|2026-10-14|elevated|900|600';

// A phone's storage that remembers, so the second call of a test sees what the first one kept.
const makeStorage = (start = {}) => {
  const data = { ...start };
  return {
    data,
    getItem: jest.fn(async (k) => (k in data ? data[k] : null)),
    setItem: jest.fn(async (k, v) => { data[k] = v; }),
  };
};
const kept = (storage) => JSON.parse(storage.data[INSIGHT_STORAGE_KEY] || '{}');

describe('where the comments are kept', () => {
  it('is the same place every release, so comments kept by an earlier one are still found', () => {
    expect(INSIGHT_STORAGE_KEY).toBe('zown-insight-cache');
  });
});

describe('asking for the comment', () => {
  it('asks the AI the first time, with the load, and gives back the comment', async () => {
    const storage = makeStorage();
    const ask = jest.fn(async () => 'Heavier week than usual.');
    expect(await getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: NOON, ask, storage })).toBe('Heavier week than usual.');
    expect(ask).toHaveBeenCalledTimes(1);
    expect(ask).toHaveBeenCalledWith({ trainingLoad: LOAD });
  });

  it('keeps the comment on the phone, under its key', async () => {
    const storage = makeStorage();
    await getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: NOON, ask: async () => 'Heavier week than usual.', storage });
    expect(storage.setItem).toHaveBeenCalledWith(INSIGHT_STORAGE_KEY, expect.any(String));
    expect(kept(storage)[KEY]).toEqual({ text: 'Heavier week than usual.', at: NOON.getTime() });
  });

  it('does not ask again for the same numbers the same day: the second opening reads the kept comment', async () => {
    const storage = makeStorage();
    const ask = jest.fn(async () => 'Heavier week than usual.');
    await getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: NOON, ask, storage });
    const later = new Date(2026, 9, 14, 20, 30, 0);
    expect(await getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: later, ask, storage })).toBe('Heavier week than usual.');
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('asks again the next day', async () => {
    const storage = makeStorage();
    const ask = jest.fn(async () => 'A comment.');
    await getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: NOON, ask, storage });
    await getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: new Date(2026, 9, 15, 8, 0, 0), ask, storage });
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('counts the person\'s own day: 11:30 PM and 12:30 AM are different days', async () => {
    const storage = makeStorage();
    const ask = jest.fn(async () => 'A comment.');
    await getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: new Date(2026, 9, 14, 23, 30, 0), ask, storage });
    await getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: new Date(2026, 9, 15, 0, 30, 0), ask, storage });
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('asks again when the numbers have changed (a workout was logged)', async () => {
    const storage = makeStorage();
    const ask = jest.fn(async () => 'A comment.');
    await getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: NOON, ask, storage });
    await getTrainingLoadInsight({ uid: 'u1', trainingLoad: { ...LOAD, acuteLoad: 1100 }, now: NOON, ask, storage });
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('keeps each person\'s comment apart', async () => {
    const storage = makeStorage();
    const ask = jest.fn(async () => 'A comment.');
    await getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: NOON, ask, storage });
    await getTrainingLoadInsight({ uid: 'u2', trainingLoad: LOAD, now: NOON, ask, storage });
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('keeps earlier comments when it files a new one', async () => {
    const storage = makeStorage();
    await getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: NOON, ask: async () => 'First.', storage });
    await getTrainingLoadInsight({ uid: 'u1', trainingLoad: { ...LOAD, acuteLoad: 1100 }, now: NOON, ask: async () => 'Second.', storage });
    expect(Object.values(kept(storage)).map((e) => e.text).sort()).toEqual(['First.', 'Second.']);
  });
});

describe('when there is nothing to ask about', () => {
  it('does not ask without a person, or without a reading with a zone and numbers, or without enough history', async () => {
    const ask = jest.fn(async () => 'x');
    const storage = makeStorage();
    expect(await getTrainingLoadInsight({ uid: undefined, trainingLoad: LOAD, now: NOON, ask, storage })).toBeNull();
    expect(await getTrainingLoadInsight({ uid: 'u1', trainingLoad: null, now: NOON, ask, storage })).toBeNull();
    expect(await getTrainingLoadInsight({ uid: 'u1', trainingLoad: { zone: 'insufficient_data', acuteLoad: 0, chronicWeeklyAvg: 0 }, now: NOON, ask, storage })).toBeNull();
    expect(ask).not.toHaveBeenCalled();
    expect(storage.getItem).not.toHaveBeenCalled();
  });
});

describe('when the AI gives nothing', () => {
  it('gives back null and remembers it, so the next opening does not spend another request at once', async () => {
    const storage = makeStorage();
    const ask = jest.fn(async () => null);
    expect(await getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: NOON, ask, storage })).toBeNull();
    expect(kept(storage)[KEY]).toEqual({ text: null, at: NOON.getTime() });
    expect(await getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: new Date(NOON.getTime() + 60_000), ask, storage })).toBeNull();
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('tries again once the half hour is up', async () => {
    const storage = makeStorage();
    const ask = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('Now it works.');
    await getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: NOON, ask, storage });
    const later = new Date(NOON.getTime() + 31 * 60_000);
    expect(await getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: later, ask, storage })).toBe('Now it works.');
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('treats a blank comment as nothing', async () => {
    const storage = makeStorage();
    expect(await getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: NOON, ask: async () => '   ', storage })).toBeNull();
    expect(kept(storage)[KEY].text).toBeNull();
  });

  it('gives back null, and does not throw, when asking throws', async () => {
    const storage = makeStorage();
    const ask = jest.fn(async () => { throw new Error('boom'); });
    expect(await getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: NOON, ask, storage })).toBeNull();
    expect(kept(storage)[KEY].text).toBeNull();
  });
});

describe('when the phone\'s storage misbehaves', () => {
  it('still asks and answers when reading it fails', async () => {
    const storage = makeStorage();
    storage.getItem = jest.fn(async () => { throw new Error('disk'); });
    const ask = jest.fn(async () => 'A comment.');
    expect(await getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: NOON, ask, storage })).toBe('A comment.');
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('still answers when keeping the comment fails', async () => {
    const storage = makeStorage();
    storage.setItem = jest.fn(async () => { throw new Error('disk full'); });
    expect(await getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: NOON, ask: async () => 'A comment.', storage })).toBe('A comment.');
  });

  it('starts over when what was kept is not readable, or not a set of entries', async () => {
    for (const bad of ['{not json', '[]', '"text"', 'null', '7']) {
      const storage = makeStorage({ [INSIGHT_STORAGE_KEY]: bad });
      const ask = jest.fn(async () => 'A comment.');
      expect({ bad, out: await getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: NOON, ask, storage }) }).toEqual({ bad, out: 'A comment.' });
      expect(ask).toHaveBeenCalledTimes(1);
      expect(kept(storage)[KEY].text).toBe('A comment.');
    }
  });
});

describe('two askers at the same moment', () => {
  it('share one request: a store finishing its load does not start a second', async () => {
    const storage = makeStorage();
    let finish;
    const ask = jest.fn(() => new Promise((resolve) => { finish = resolve; }));
    const a = getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: NOON, ask, storage });
    const b = getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: NOON, ask, storage });
    await new Promise((resolve) => setTimeout(resolve, 5));
    finish('Shared.');
    expect(await a).toBe('Shared.');
    expect(await b).toBe('Shared.');
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('do not share when the numbers differ', async () => {
    const storage = makeStorage();
    const ask = jest.fn(async () => 'A comment.');
    await Promise.all([
      getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: NOON, ask, storage }),
      getTrainingLoadInsight({ uid: 'u1', trainingLoad: { ...LOAD, acuteLoad: 1 }, now: NOON, ask, storage }),
    ]);
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('can ask again after a request has finished and gave nothing, once the wait is over', async () => {
    const storage = makeStorage();
    const ask = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('Later.');
    await getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: NOON, ask, storage });
    const out = await getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, now: new Date(NOON.getTime() + 40 * 60_000), ask, storage });
    expect(out).toBe('Later.');
  });
});

describe('the clock', () => {
  it('is the real one when none is passed in', async () => {
    const storage = makeStorage();
    const ask = jest.fn(async () => 'A comment.');
    const before = Date.now();
    await getTrainingLoadInsight({ uid: 'u1', trainingLoad: LOAD, ask, storage });
    const entry = Object.values(kept(storage))[0];
    expect(entry.at).toBeGreaterThanOrEqual(before);
    expect(entry.at).toBeLessThanOrEqual(Date.now());
  });
});
