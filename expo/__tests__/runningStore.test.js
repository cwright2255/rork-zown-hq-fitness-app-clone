jest.mock('../src/config/firebase', () => ({ db: {} }));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((...args) => ({ path: args.slice(1).join('/') })),
  getDoc: jest.fn(),
  setDoc: jest.fn(async () => undefined),
  collection: jest.fn(),
  getDocs: jest.fn(async () => ({ empty: true, docs: [] })),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

import { getDoc, setDoc } from 'firebase/firestore';
import { useRunningStore } from '../store/runningStore';

const saved = (n, extra = {}) => ({
  id: String(n),
  uid: 'u1',
  startTime: new Date(Date.UTC(2026, 0, 1) + n * 86400000).toISOString(),
  endTime: new Date(Date.UTC(2026, 0, 1) + n * 86400000 + 1800000).toISOString(),
  distance: 5, duration: 1500, pace: 300, calories: 300, track: [],
  ...extra,
});

const tracked = (extra = {}) => ({
  startTime: new Date(Date.now() - 1800000).toISOString(),
  distance: 5, duration: 1650, calories: 320,
  coords: [{ latitude: 40, longitude: -74 }, { latitude: 40.01, longitude: -74.01 }],
  ...extra,
});

describe('runningStore run saving', () => {
  beforeEach(() => {
    useRunningStore.setState({ runs: [], activeRun: null });
    setDoc.mockClear();
    getDoc.mockReset();
  });

  it('saves a finished run even though no run was ever started', () => {
    expect(useRunningStore.getState().activeRun).toBeNull();
    const run = useRunningStore.getState().endRun('u1', tracked());
    expect(run).not.toBeNull();
    expect(useRunningStore.getState().runs).toHaveLength(1);
    expect(run.distance).toBe(5);
    expect(run.duration).toBe(1650);
    expect(run.pace).toBe(330);
    expect(run.track).toHaveLength(4);
  });

  it('writes the run to Firestore', () => {
    useRunningStore.getState().endRun('u1', tracked());
    expect(setDoc).toHaveBeenCalledTimes(1);
    const body = setDoc.mock.calls[0][1];
    expect(body.runs).toHaveLength(1);
    expect(Object.values(body.runs[0]).every((v) => v !== undefined)).toBe(true);
  });

  it('keeps the newest run first', () => {
    useRunningStore.setState({ runs: [saved(2), saved(1)] });
    const run = useRunningStore.getState().endRun('u1', tracked());
    const ids = useRunningStore.getState().runs.map((r) => r.id);
    expect(ids[0]).toBe(run.id);
    expect(ids.slice(1)).toEqual(['2', '1']);
  });

  it('keeps the newest 100 runs, so the one just finished is not dropped', () => {
    const history = [];
    for (let i = 100; i >= 1; i -= 1) history.push(saved(i));
    useRunningStore.setState({ runs: history });
    const run = useRunningStore.getState().endRun('u1', tracked());
    const runs = useRunningStore.getState().runs;
    expect(runs).toHaveLength(100);
    expect(runs[0].id).toBe(run.id);
    expect(runs.some((r) => r.id === '1')).toBe(false);
    expect(setDoc.mock.calls[0][1].runs[0].id).toBe(run.id);
  });

  it('does not save or write a run shorter than 10 seconds', () => {
    const run = useRunningStore.getState().endRun('u1', tracked({ duration: 4, distance: 0 }));
    expect(run).toBeNull();
    expect(useRunningStore.getState().runs).toHaveLength(0);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('still returns null when called the old way with nothing tracked', () => {
    expect(useRunningStore.getState().endRun('u1')).toBeNull();
  });

  it('keeps the splits and climb the tracker measured, locally and in Firestore', () => {
    const run = useRunningStore.getState().endRun('u1', tracked({ splits: [300, 310], elevGain: 12, elevLoss: 9 }));
    expect(run.splits).toEqual([300, 310]);
    expect(run.elevGain).toBe(12);
    expect(run.elevLoss).toBe(9);
    const body = setDoc.mock.calls[0][1];
    expect(body.runs[0].splits).toEqual([300, 310]);
    expect(body.runs[0].elevGain).toBe(12);
  });

  it('keeps the local run when signed out, without writing', () => {
    const run = useRunningStore.getState().endRun(undefined, tracked());
    expect(run).not.toBeNull();
    expect('uid' in run).toBe(false);
    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe('runningStore stats', () => {
  beforeEach(() => useRunningStore.setState({ runs: [] }));

  it('reports pace in seconds per km', () => {
    useRunningStore.setState({ runs: [saved(2, { distance: 5, duration: 1500 }), saved(1, { distance: 5, duration: 1800 })] });
    expect(useRunningStore.getState().getStats().avgPace).toBe(330);
    expect(useRunningStore.getState().getPersonalRecords().fastestPace.pace).toBe(300);
  });
});

describe('runningStore loadRuns', () => {
  beforeEach(() => {
    useRunningStore.setState({ runs: [], activeRun: null });
    setDoc.mockClear();
    getDoc.mockReset();
  });

  const serverHas = (runs) => getDoc.mockResolvedValue({ exists: () => true, data: () => ({ runs }) });

  it('loads the saved history newest first', async () => {
    serverHas([saved(1), saved(3), saved(2)]);
    await useRunningStore.getState().loadRuns('u1');
    expect(useRunningStore.getState().runs.map((r) => r.id)).toEqual(['3', '2', '1']);
  });

  it('keeps a run that is on this phone but not on the server yet, and sends it up', async () => {
    const mine = saved(9);
    useRunningStore.setState({ runs: [mine, saved(2)] });
    serverHas([saved(2), saved(1)]);
    await useRunningStore.getState().loadRuns('u1');
    expect(useRunningStore.getState().runs.map((r) => r.id)).toEqual(['9', '2', '1']);
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][1].runs.map((r) => r.id)).toEqual(['9', '2', '1']);
  });

  it('does not copy another account\'s runs into this one', async () => {
    useRunningStore.setState({ runs: [saved(9, { uid: 'someone-else' })] });
    serverHas([saved(1)]);
    await useRunningStore.getState().loadRuns('u1');
    expect(useRunningStore.getState().runs.map((r) => r.id)).toEqual(['1']);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('does not write anything when nothing was unsynced', async () => {
    useRunningStore.setState({ runs: [saved(2)] });
    serverHas([saved(2)]);
    await useRunningStore.getState().loadRuns('u1');
    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe('runningStore importRuns', () => {
  beforeEach(() => {
    useRunningStore.setState({ runs: [], activeRun: null });
    setDoc.mockClear();
    getDoc.mockReset();
  });

  const fromHealth = (n, extra = {}) => saved(n, { id: `hk-${n}`, source: 'apple-health', ...extra });

  it('adds the imported runs among the saved ones, newest first', () => {
    useRunningStore.setState({ runs: [saved(5), saved(1)] });
    const out = useRunningStore.getState().importRuns('u1', [fromHealth(3), fromHealth(2)]);
    expect(useRunningStore.getState().runs.map((r) => r.id)).toEqual(['5', 'hk-3', 'hk-2', '1']);
    expect(out.added.map((r) => r.id)).toEqual(['hk-3', 'hk-2']);
    expect(out.dropped).toBe(0);
  });

  it('writes the history once, with the imported runs in it', () => {
    useRunningStore.getState().importRuns('u1', [fromHealth(3), fromHealth(2)]);
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][1].runs.map((r) => r.id)).toEqual(['hk-3', 'hk-2']);
    expect(setDoc.mock.calls[0][1].runs[0].source).toBe('apple-health');
  });

  it('keeps the imported run on the phone when signed out, without writing', () => {
    useRunningStore.getState().importRuns(undefined, [fromHealth(3)]);
    expect(useRunningStore.getState().runs).toHaveLength(1);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('does nothing, and writes nothing, when there is nothing to import', () => {
    useRunningStore.setState({ runs: [saved(1)] });
    expect(useRunningStore.getState().importRuns('u1', [])).toEqual({ added: [], dropped: 0 });
    expect(useRunningStore.getState().importRuns('u1', undefined)).toEqual({ added: [], dropped: 0 });
    expect(useRunningStore.getState().importRuns('u1', [null])).toEqual({ added: [], dropped: 0 });
    expect(useRunningStore.getState().runs).toHaveLength(1);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('leaves a run that is already saved as it is, and does not report it as added', () => {
    useRunningStore.setState({ runs: [fromHealth(3, { calories: 111 })] });
    const out = useRunningStore.getState().importRuns('u1', [fromHealth(3, { calories: 999 })]);
    expect(out).toEqual({ added: [], dropped: 0 });
    expect(useRunningStore.getState().runs).toHaveLength(1);
    expect(useRunningStore.getState().runs[0].calories).toBe(111);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('counts the same run only once when it comes in twice in one go', () => {
    const out = useRunningStore.getState().importRuns('u1', [fromHealth(3), fromHealth(3)]);
    expect(out.added).toHaveLength(1);
    expect(useRunningStore.getState().runs).toHaveLength(1);
  });

  it('keeps only the newest 100, and says how many did not fit', () => {
    const history = [];
    for (let i = 100; i >= 51; i -= 1) history.push(saved(i));
    useRunningStore.setState({ runs: history });
    const incoming = [fromHealth(200)];
    for (let i = 50; i >= 1; i -= 1) incoming.push(fromHealth(i));
    const out = useRunningStore.getState().importRuns('u1', incoming);
    const runs = useRunningStore.getState().runs;
    expect(runs).toHaveLength(100);
    expect(runs[0].id).toBe('hk-200');
    expect(runs.some((r) => r.id === 'hk-1')).toBe(false);
    expect(out.added).toHaveLength(50);
    expect(out.dropped).toBe(1);
  });

  it('writes nothing when every imported run was older than the newest 100', () => {
    const history = [];
    for (let i = 200; i >= 101; i -= 1) history.push(saved(i));
    useRunningStore.setState({ runs: history });
    const out = useRunningStore.getState().importRuns('u1', [fromHealth(1)]);
    expect(out).toEqual({ added: [], dropped: 1 });
    expect(useRunningStore.getState().runs).toHaveLength(100);
    expect(setDoc).not.toHaveBeenCalled();
  });
});
