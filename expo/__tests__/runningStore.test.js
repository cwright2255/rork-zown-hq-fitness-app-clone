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
