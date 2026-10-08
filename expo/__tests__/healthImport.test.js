// jest.mock is hoisted above the imports, so the Health service stays out of this test.
jest.mock('../services/appleHealthService', () => ({ appleHealthService: {} }));

import { importWorkouts } from '../services/healthImport';

const T0 = Date.UTC(2026, 9, 7, 11, 0, 0);

const imported = (id, startMin, extra = {}) => ({
  id, source: 'apple-health', uid: 'u1', distance: 5, duration: 1500, pace: 300, calories: 300, track: [],
  startTime: new Date(T0 + startMin * 60000).toISOString(),
  endTime: new Date(T0 + (startMin + 30) * 60000).toISOString(),
  ...extra,
});

const fakeHealth = (over = {}) => ({
  isAvailable: jest.fn(async () => true),
  requestWorkoutAccess: jest.fn(async () => true),
  readWorkouts: jest.fn(async () => ({ ok: true, runs: [], found: 0, skipped: 0, ignored: 0 })),
  ...over,
});

const setup = (health, existing = []) => {
  const calls = [];
  const store = {
    runs: existing,
    loadRuns: jest.fn(async () => { calls.push('load'); }),
    getRuns: jest.fn(() => { calls.push('get'); return store.runs; }),
    saveRuns: jest.fn((uid, runs) => { calls.push('save'); store.runs = [...runs, ...store.runs]; return { added: runs, dropped: 0 }; }),
  };
  const run = (extra = {}) => importWorkouts({
    uid: 'u1', rangeId: '30d', loadRuns: store.loadRuns, getRuns: store.getRuns, saveRuns: store.saveRuns, health, now: T0, ...extra,
  });
  return { store, calls, run };
};

describe('importWorkouts', () => {
  it('needs someone signed in', async () => {
    const health = fakeHealth();
    const { run } = setup(health);
    expect(await run({ uid: '' })).toEqual({ ok: false, reason: 'signed-out' });
    expect(health.isAvailable).not.toHaveBeenCalled();
  });

  it('says so when Health is not there', async () => {
    const { run } = setup(fakeHealth({ isAvailable: jest.fn(async () => false) }));
    expect(await run()).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('says so when access could not be requested, and reads nothing', async () => {
    const health = fakeHealth({ requestWorkoutAccess: jest.fn(async () => false) });
    const { run } = setup(health);
    expect(await run()).toEqual({ ok: false, reason: 'denied' });
    expect(health.readWorkouts).not.toHaveBeenCalled();
  });

  it('asks for access before reading anything', async () => {
    const order = [];
    const health = fakeHealth({
      requestWorkoutAccess: jest.fn(async () => { order.push('access'); return true; }),
      readWorkouts: jest.fn(async () => { order.push('read'); return { ok: true, runs: [], found: 0, skipped: 0, ignored: 0 }; }),
    });
    await setup(health).run();
    expect(order).toEqual(['access', 'read']);
  });

  it('refreshes the saved history before looking at it, so a stale copy is never saved over the real one', async () => {
    const { run, calls } = setup(fakeHealth({
      readWorkouts: jest.fn(async () => ({ ok: true, runs: [imported('hk-a', 0)], found: 1, skipped: 0, ignored: 0 })),
    }));
    await run();
    expect(calls.slice(0, 2)).toEqual(['load', 'get']);
    expect(calls).toContain('save');
  });

  it('reads from the start of the chosen range, up to 100 workouts, skipping ids it already has', async () => {
    const health = fakeHealth();
    await setup(health, [imported('hk-old', -5000)]).run({ rangeId: '30d' });
    const args = health.readWorkouts.mock.calls[0][0];
    expect(args.sinceMs).toBe(T0 - 30 * 86400000);
    expect(args.limit).toBe(100);
    expect(args.uid).toBe('u1');
    expect(args.skipIds.has('hk-old')).toBe(true);
  });

  it('saves the new runs and reports them', async () => {
    const health = fakeHealth({
      readWorkouts: jest.fn(async () => ({
        ok: true, runs: [imported('hk-a', 0), imported('hk-b', 600, { activity: 'walk' })], found: 2, skipped: 0, ignored: 0,
      })),
    });
    const { run, store } = setup(health);
    const out = await run();
    expect(out.ok).toBe(true);
    expect(out.headline).toBe('Imported 1 run and 1 walk');
    expect(out.added.map((r) => r.id)).toEqual(['hk-b', 'hk-a']);
    expect(store.saveRuns).toHaveBeenCalledTimes(1);
    expect(store.saveRuns.mock.calls[0][0]).toBe('u1');
  });

  it('leaves out an outing that matches one recorded in Zown, and counts the ones already there', async () => {
    const zown = {
      id: '1', startTime: new Date(T0 + 60000).toISOString(), endTime: new Date(T0 + 31 * 60000).toISOString(), distance: 5, duration: 1500,
    };
    const health = fakeHealth({
      readWorkouts: jest.fn(async () => ({ ok: true, runs: [imported('hk-a', 0)], found: 3, skipped: 2, ignored: 0 })),
    });
    const { run, store } = setup(health, [zown]);
    const out = await run();
    expect(store.saveRuns).not.toHaveBeenCalled();
    expect(out.added).toEqual([]);
    expect(out.headline).toBe('Nothing new to import');
    expect(out.lines).toEqual(['2 already in Zown', '1 overlapped an outing that was already saved, so it was skipped']);
  });

  it('does not save when there is nothing new', async () => {
    const { run, store } = setup(fakeHealth());
    const out = await run();
    expect(store.saveRuns).not.toHaveBeenCalled();
    expect(out.headline).toBe('No runs or walks found');
    expect(out.found).toBe(0);
  });

  it('tells the person when older runs did not fit in the history', async () => {
    const health = fakeHealth({
      readWorkouts: jest.fn(async () => ({ ok: true, runs: [imported('hk-a', 0), imported('hk-b', 100)], found: 2, skipped: 0, ignored: 0 })),
    });
    const { run, store } = setup(health);
    store.saveRuns.mockImplementation((uid, runs) => ({ added: runs.slice(0, 1), dropped: 1 }));
    const out = await run();
    expect(out.added).toHaveLength(1);
    expect(out.lines).toEqual(['1 older one did not fit in your history of 100 runs']);
  });

  it('passes progress on', async () => {
    const onProgress = jest.fn();
    const health = fakeHealth();
    await setup(health).run({ onProgress });
    expect(health.readWorkouts.mock.calls[0][0].onProgress).toBe(onProgress);
  });

  it('reports a failed read', async () => {
    const health = fakeHealth({ readWorkouts: jest.fn(async () => ({ ok: false, reason: 'error', message: 'boom' })) });
    expect(await setup(health).run()).toEqual({ ok: false, reason: 'error', message: 'boom' });
  });

  it('never throws', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const health = fakeHealth({ isAvailable: jest.fn(async () => { throw new Error('crash'); }) });
    expect(await setup(health).run()).toEqual({ ok: false, reason: 'error', message: 'crash' });
  });

  it('importing the same thing twice adds nothing the second time', async () => {
    const health = fakeHealth({
      readWorkouts: jest.fn(async () => ({ ok: true, runs: [imported('hk-a', 0)], found: 1, skipped: 0, ignored: 0 })),
    });
    const { run, store } = setup(health);
    expect((await run()).added).toHaveLength(1);
    const second = await run();
    expect(second.added).toEqual([]);
    expect(store.saveRuns).toHaveBeenCalledTimes(1);
    expect(second.lines).toEqual(['1 already in Zown']);
  });
});
