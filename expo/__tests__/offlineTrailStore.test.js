jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useOfflineTrailStore } from '../store/offlineTrailStore';
import { MAX_OFFLINE_TRAILS } from '../lib/offlineTrails';

const trail = (n = 77, extra = {}) => ({
  id: `trailapi-${n}`, source: 'trailapi', name: `Trail ${n}`, address: 'Syria, VA', latitude: 38.55, longitude: -78.3, ...extra,
});
const route = (n = 4) => ({
  coordinates: Array.from({ length: n }, (_, i) => ({ latitude: 38 + i * 0.001, longitude: -78 })),
  distanceKm: 1, elevationGainM: 10, elevationProfile: null,
});
const state = () => useOfflineTrailStore.getState();

beforeEach(() => {
  useOfflineTrailStore.setState({ trails: {} });
  AsyncStorage.setItem.mockClear();
});

describe('keepTrail', () => {
  it('keeps a trail with its paths and lines', () => {
    state().keepTrail({ trail: trail(), maps: [{ id: 11, name: 'Main loop' }], routes: { 11: route() }, pinned: true });
    const record = state().trails['trailapi-77'];
    expect(record).toMatchObject({ id: 'trailapi-77', pinned: true, maps: [{ id: 11, name: 'Main loop' }] });
    expect(record.trail.name).toBe('Trail 77');
    expect(record.routes['11'].coordinates).toHaveLength(4);
    expect(typeof record.savedAt).toBe('number');
  });

  it('adds to what is kept for the same trail', () => {
    state().keepTrail({ trail: trail(), maps: [{ id: 11, name: 'A' }], routes: { 11: route(4) } });
    state().keepTrail({ trail: trail(), routes: { 12: route(6) } });
    expect(Object.keys(state().trails['trailapi-77'].routes).sort()).toEqual(['11', '12']);
  });

  it('keeps each trail apart', () => {
    state().keepTrail({ trail: trail(1) });
    state().keepTrail({ trail: trail(2) });
    expect(Object.keys(state().trails).sort()).toEqual(['trailapi-1', 'trailapi-2']);
  });

  it('writes nothing again when nothing new was found', () => {
    state().keepTrail({ trail: trail(), routes: { 11: route() }, pinned: true });
    const before = state().trails;
    AsyncStorage.setItem.mockClear();
    const seen = jest.fn();
    const stop = useOfflineTrailStore.subscribe(seen);
    state().keepTrail({ trail: trail(), routes: { 11: route() }, pinned: true });
    stop();
    expect(seen).not.toHaveBeenCalled();
    expect(state().trails).toBe(before);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('keeps nothing without a trail to keep', () => {
    state().keepTrail({});
    state().keepTrail(null);
    state().keepTrail({ trail: { name: 'no id' } });
    expect(state().trails).toEqual({});
  });

  it('drops the oldest trail that was only started when there are too many', () => {
    for (let n = 0; n < MAX_OFFLINE_TRAILS; n += 1) {
      useOfflineTrailStore.setState((s) => ({
        trails: { ...s.trails, [`trailapi-${n}`]: { id: `trailapi-${n}`, savedAt: n + 1, pinned: n === 0, trail: { id: `trailapi-${n}` }, maps: [], routes: {} } },
      }));
    }
    state().keepTrail({ trail: trail(500) });
    const ids = Object.keys(state().trails);
    expect(ids).toHaveLength(MAX_OFFLINE_TRAILS);
    expect(ids).toContain('trailapi-500');
    expect(ids).toContain('trailapi-0'); // saved by the person, so it stays though it is the oldest
    expect(ids).not.toContain('trailapi-1');
  });

  it('is written to the phone', () => {
    state().keepTrail({ trail: trail() });
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    const [key, value] = AsyncStorage.setItem.mock.calls[0];
    expect(key).toBe('offline-trails');
    expect(JSON.parse(value).state.trails['trailapi-77'].trail.name).toBe('Trail 77');
  });
});

describe('removeTrail', () => {
  it('forgets a trail and leaves the others', () => {
    state().keepTrail({ trail: trail(1) });
    state().keepTrail({ trail: trail(2) });
    state().removeTrail('trailapi-1');
    expect(Object.keys(state().trails)).toEqual(['trailapi-2']);
  });

  it('does nothing for a trail that is not kept', () => {
    state().keepTrail({ trail: trail(1) });
    const before = state().trails;
    AsyncStorage.setItem.mockClear();
    state().removeTrail('trailapi-9');
    state().removeTrail(undefined);
    expect(state().trails).toBe(before);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});

describe('what is written to the phone', () => {
  it('is only the trails, not the functions', () => {
    state().keepTrail({ trail: trail() });
    const saved = useOfflineTrailStore.persist.getOptions().partialize(state());
    expect(Object.keys(saved)).toEqual(['trails']);
  });
});
