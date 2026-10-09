jest.mock('../src/config/firebase', () => ({ db: {} }));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((...args) => ({ path: args.slice(1).join('/') })),
  getDoc: jest.fn(),
  setDoc: jest.fn(async () => undefined),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}), { virtual: true });
jest.mock('@/services/hikingService', () => ({ searchNearbyTrails: jest.fn() }));

import { getDoc, setDoc } from 'firebase/firestore';
import { useHikingStore } from '../store/hikingStore';

const START = new Date(2026, 9, 8, 7, 5, 0).toISOString();
const route = Array.from({ length: 30 }, (_, i) => ({ latitude: 40 + i * 0.001, longitude: -74 }));

const tracked = (extra = {}) => ({
  trailId: 'trailapi-7', trailName: 'Old Rag', distanceKm: 6.6, elevationGainM: 412, elevationLossM: 400,
  durationSeconds: 9000, difficultyScore: 74.5, difficultyTier: 'Moderate', calories: 880, xpEarned: 300,
  startTime: START, coords: route,
  ...extra,
});

const saved = (n, extra = {}) => ({
  id: `hike-${n}`,
  uid: 'u1',
  completedAt: new Date(Date.UTC(2026, 0, 1) + n * 86400000).toISOString(),
  distanceKm: 5, durationSeconds: 5000, elevationGainM: 100, track: [],
  ...extra,
});

const serverDoc = (hikes) => ({ exists: () => true, data: () => ({ hikes }) });

let warn;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  useHikingStore.setState({ completedHikes: [] });
  setDoc.mockClear();
  getDoc.mockReset();
});
afterEach(() => warn.mockRestore());

describe('saving a hike', () => {
  it('keeps the hike with the route that was walked', () => {
    const record = useHikingStore.getState().addCompletedHike(tracked(), 'u1');
    expect(useHikingStore.getState().completedHikes).toEqual([record]);
    expect(record).toMatchObject({ trailName: 'Old Rag', distanceKm: 6.6, elevationGainM: 412, elevationLossM: 400, uid: 'u1' });
    expect(record.track).toHaveLength(60);
    expect(record.coords).toBeUndefined();
  });

  it('puts a new hike on the end of the list, as the list has always been kept', () => {
    useHikingStore.setState({ completedHikes: [saved(1), saved(2)] });
    const record = useHikingStore.getState().addCompletedHike(tracked(), 'u1');
    expect(useHikingStore.getState().completedHikes.map((h) => h.id)).toEqual(['hike-1', 'hike-2', record.id]);
  });

  it('writes the hikes, route included, to Firestore', () => {
    useHikingStore.getState().addCompletedHike(tracked(), 'u1');
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][0].path).toBe('users/u1/data/hikes');
    const body = setDoc.mock.calls[0][1];
    expect(body.hikes).toHaveLength(1);
    expect(body.hikes[0].track).toHaveLength(60);
    expect(Object.values(body.hikes[0]).every((v) => v !== undefined)).toBe(true);
  });

  it('keeps the hike on the phone when nobody is signed in, and writes nothing', () => {
    useHikingStore.getState().addCompletedHike(tracked(), undefined);
    expect(useHikingStore.getState().completedHikes).toHaveLength(1);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('keeps the hike even when Firestore refuses the write', async () => {
    setDoc.mockRejectedValueOnce(new Error('offline'));
    useHikingStore.getState().addCompletedHike(tracked(), 'u1');
    await Promise.resolve();
    expect(useHikingStore.getState().completedHikes).toHaveLength(1);
  });
});

describe('loading the hikes', () => {
  it('shows the hikes from the server, oldest first', async () => {
    getDoc.mockResolvedValueOnce(serverDoc([saved(2, { uid: undefined }), saved(1, { uid: undefined })]));
    await useHikingStore.getState().loadCompletedHikes('u1');
    expect(useHikingStore.getState().completedHikes.map((h) => h.id)).toEqual(['hike-1', 'hike-2']);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('keeps a hike finished with no signal, and sends it up again', async () => {
    useHikingStore.setState({ completedHikes: [saved(3)] });
    getDoc.mockResolvedValueOnce(serverDoc([saved(1), saved(2)]));
    await useHikingStore.getState().loadCompletedHikes('u1');
    expect(useHikingStore.getState().completedHikes.map((h) => h.id)).toEqual(['hike-1', 'hike-2', 'hike-3']);
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][1].hikes.map((h) => h.id)).toEqual(['hike-1', 'hike-2', 'hike-3']);
  });

  it('keeps a hike finished with no signal even when the user has nothing on the server yet', async () => {
    useHikingStore.setState({ completedHikes: [saved(1)] });
    getDoc.mockResolvedValueOnce({ exists: () => false, data: () => undefined });
    await useHikingStore.getState().loadCompletedHikes('u1');
    expect(useHikingStore.getState().completedHikes.map((h) => h.id)).toEqual(['hike-1']);
    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  it('does not show another person\'s hikes that are still on this phone', async () => {
    useHikingStore.setState({ completedHikes: [saved(1, { uid: 'someone-else' })] });
    getDoc.mockResolvedValueOnce(serverDoc([saved(2)]));
    await useHikingStore.getState().loadCompletedHikes('u1');
    expect(useHikingStore.getState().completedHikes.map((h) => h.id)).toEqual(['hike-2']);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('leaves the hikes alone when the server cannot be reached', async () => {
    useHikingStore.setState({ completedHikes: [saved(1)] });
    getDoc.mockRejectedValueOnce(new Error('offline'));
    await useHikingStore.getState().loadCompletedHikes('u1');
    expect(useHikingStore.getState().completedHikes).toHaveLength(1);
  });

  it('does nothing without a user', async () => {
    await useHikingStore.getState().loadCompletedHikes(undefined);
    expect(getDoc).not.toHaveBeenCalled();
  });
});

describe('sharing a hike', () => {
  beforeEach(() => useHikingStore.setState({ completedHikes: [saved(1), saved(2)] }));

  it('remembers which post a hike became, and writes it', () => {
    expect(useHikingStore.getState().markHikeShared('u1', 'hike-2', 'post-9')).toBe(true);
    expect(useHikingStore.getState().completedHikes[1].sharedPostId).toBe('post-9');
    expect(useHikingStore.getState().completedHikes[0].sharedPostId).toBeUndefined();
    expect(setDoc.mock.calls[0][1].hikes[1].sharedPostId).toBe('post-9');
  });

  it('says so when the hike is not there, and changes nothing', () => {
    expect(useHikingStore.getState().markHikeShared('u1', 'hike-99', 'post-9')).toBe(false);
    expect(useHikingStore.getState().markHikeShared('u1', undefined, 'post-9')).toBe(false);
    expect(useHikingStore.getState().markHikeShared('u1', 'hike-1', '')).toBe(false);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('frees the hike to be shared again when its post is deleted', () => {
    useHikingStore.getState().markHikeShared('u1', 'hike-2', 'post-9');
    setDoc.mockClear();
    expect(useHikingStore.getState().forgetSharedPost('u1', 'post-9')).toBe(true);
    expect('sharedPostId' in useHikingStore.getState().completedHikes[1]).toBe(false);
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(useHikingStore.getState().forgetSharedPost('u1', 'post-9')).toBe(false);
    expect(useHikingStore.getState().forgetSharedPost('u1', '')).toBe(false);
  });
});

describe('looking a hike up', () => {
  it('finds a hike by its id, as text or as given', () => {
    useHikingStore.setState({ completedHikes: [saved(1), saved(2)] });
    expect(useHikingStore.getState().getHikeById('hike-2').id).toBe('hike-2');
    expect(useHikingStore.getState().getHikeById('nope')).toBeNull();
  });
});

describe('the saved trails', () => {
  const idsDoc = (ids) => ({ exists: () => true, data: () => ({ trailIds: ids }) });
  const noDoc = { exists: () => false, data: () => undefined };
  const state = () => useHikingStore.getState();

  beforeEach(() => {
    useHikingStore.setState({ savedTrailIds: [], savedTrailsUid: null, trails: [] });
  });

  it('stay on the phone with whose list it is, and the last search does not', () => {
    useHikingStore.setState({ savedTrailIds: ['trailapi-1'], savedTrailsUid: 'u1', trails: [{ id: 'trailapi-9' }] });
    const kept = useHikingStore.persist.getOptions().partialize(state());
    expect(kept.savedTrailIds).toEqual(['trailapi-1']);
    expect(kept.savedTrailsUid).toBe('u1');
    expect(kept).not.toHaveProperty('trails');
    expect(kept).toHaveProperty('completedHikes');
  });

  describe('saving and un-saving', () => {
    it('saves a trail, notes whose list it is, and sends the list up', () => {
      state().toggleSaveTrail('trailapi-1', 'u1');
      expect(state().savedTrailIds).toEqual(['trailapi-1']);
      expect(state().savedTrailsUid).toBe('u1');
      expect(setDoc).toHaveBeenCalledWith({ path: 'users/u1/data/savedTrails' }, { trailIds: ['trailapi-1'] }, { merge: true });
    });

    it('un-saves it again', () => {
      state().toggleSaveTrail('trailapi-1', 'u1');
      state().toggleSaveTrail('trailapi-2', 'u1');
      state().toggleSaveTrail('trailapi-1', 'u1');
      expect(state().savedTrailIds).toEqual(['trailapi-2']);
      expect(setDoc.mock.calls[2][1]).toEqual({ trailIds: ['trailapi-2'] });
    });

    it('keeps the list when nobody is signed in, and does not send it anywhere', () => {
      useHikingStore.setState({ savedTrailsUid: 'u1' });
      setDoc.mockClear();
      state().toggleSaveTrail('trailapi-1', undefined);
      expect(state().savedTrailIds).toEqual(['trailapi-1']);
      expect(state().savedTrailsUid).toBe('u1');
      expect(setDoc).not.toHaveBeenCalled();
    });
  });

  describe('loading them', () => {
    it('takes the list from the server', async () => {
      getDoc.mockResolvedValue(idsDoc(['trailapi-3', 'trailapi-4']));
      await state().loadSavedTrails('u1');
      expect(getDoc).toHaveBeenCalledWith({ path: 'users/u1/data/savedTrails' });
      expect(state().savedTrailIds).toEqual(['trailapi-3', 'trailapi-4']);
      expect(state().savedTrailsUid).toBe('u1');
    });

    it('treats a list with no ids as empty', async () => {
      useHikingStore.setState({ savedTrailIds: ['trailapi-1'], savedTrailsUid: 'u1' });
      getDoc.mockResolvedValue({ exists: () => true, data: () => ({}) });
      await state().loadSavedTrails('u1');
      expect(state().savedTrailIds).toEqual([]);
    });

    it('keeps the list on the phone when there is no signal', async () => {
      useHikingStore.setState({ savedTrailIds: ['trailapi-1'], savedTrailsUid: 'u1' });
      getDoc.mockRejectedValue(new Error('client is offline'));
      await state().loadSavedTrails('u1');
      expect(state().savedTrailIds).toEqual(['trailapi-1']);
      expect(state().savedTrailsUid).toBe('u1');
    });

    it('keeps the list on the phone when the person has no list on the server yet', async () => {
      useHikingStore.setState({ savedTrailIds: ['trailapi-1'], savedTrailsUid: 'u1' });
      getDoc.mockResolvedValue(noDoc);
      await state().loadSavedTrails('u1');
      expect(state().savedTrailIds).toEqual(['trailapi-1']);
    });

    it('does not show one person\'s list to another who signs in on the same phone, even with no signal', async () => {
      useHikingStore.setState({ savedTrailIds: ['trailapi-1'], savedTrailsUid: 'u1' });
      getDoc.mockRejectedValue(new Error('client is offline'));
      await state().loadSavedTrails('u2');
      expect(state().savedTrailIds).toEqual([]);
      expect(state().savedTrailsUid).toBe('u2');
    });

    it('does not show it to the other person while the server is still answering either', async () => {
      useHikingStore.setState({ savedTrailIds: ['trailapi-1'], savedTrailsUid: 'u1' });
      let answer;
      getDoc.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
      const loading = state().loadSavedTrails('u2');
      expect(state().savedTrailIds).toEqual([]);
      answer(idsDoc(['trailapi-7']));
      await loading;
      expect(state().savedTrailIds).toEqual(['trailapi-7']);
    });

    it('takes a list of unknown owner as the signed-in person\'s own', async () => {
      useHikingStore.setState({ savedTrailIds: ['trailapi-1'], savedTrailsUid: null });
      getDoc.mockRejectedValue(new Error('client is offline'));
      await state().loadSavedTrails('u1');
      expect(state().savedTrailIds).toEqual(['trailapi-1']);
      expect(state().savedTrailsUid).toBe('u1');
    });

    it('does nothing without a signed-in person', async () => {
      useHikingStore.setState({ savedTrailIds: ['trailapi-1'], savedTrailsUid: 'u1' });
      await state().loadSavedTrails(undefined);
      expect(getDoc).not.toHaveBeenCalled();
      expect(state().savedTrailIds).toEqual(['trailapi-1']);
    });
  });
});
