jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((db, ...path) => ({ path: path.join('/') })),
  getDoc: jest.fn(),
  setDoc: jest.fn(async () => undefined),
}));

import { getDoc, setDoc } from 'firebase/firestore';
import { useBadgeStore } from '../store/badgeStore';

const store = () => useBadgeStore.getState();
const byId = (id) => store().badges.find((b) => b.id === id);

let warn;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  [getDoc, setDoc].forEach((fn) => fn.mockClear());
  getDoc.mockResolvedValue({ exists: () => false });
  useBadgeStore.setState({ badges: [] });
});
afterEach(() => warn.mockRestore());

describe('the badge list', () => {
  it('starts with every badge, including Race Day for finishing a virtual race', () => {
    store().initializeDefaultBadges();
    expect(store().badges).toHaveLength(14);
    expect(byId('badge-14')).toMatchObject({
      name: 'Race Day', description: 'Finish a virtual race', category: 'running', isUnlocked: false, unlockedAt: null,
    });
    expect(byId('badge-1').name).toBe('First Workout');
  });

  it('adds the badges a saved list is missing, and keeps what is saved', () => {
    store().initializeDefaultBadges();
    const without = store().badges.filter((b) => b.id !== 'badge-14').map((b) => (b.id === 'badge-1'
      ? { ...b, isUnlocked: true, unlockedAt: '2026-09-01T00:00:00Z' } : b));
    useBadgeStore.setState({ badges: without });
    store().initializeDefaultBadges();
    expect(store().badges).toHaveLength(14);
    expect(byId('badge-14')).toBeDefined();
    expect(byId('badge-1')).toMatchObject({ isUnlocked: true, unlockedAt: '2026-09-01T00:00:00Z' });
    expect(store().badges.slice(0, 13).map((b) => b.id)).toEqual(without.map((b) => b.id));
  });

  it('changes nothing when the list is complete', () => {
    store().initializeDefaultBadges();
    const before = store().badges;
    store().initializeDefaultBadges();
    expect(store().badges).toBe(before);
  });

  it('copes with a saved list that has no badges in it at all', () => {
    useBadgeStore.setState({ badges: undefined });
    store().initializeDefaultBadges();
    expect(store().badges).toHaveLength(14);
  });

  it('is filled in, with the new badge, when the badges are loaded for a person', async () => {
    useBadgeStore.setState({ badges: [{ id: 'badge-1', name: 'First Workout', isUnlocked: false }] });
    await store().loadBadges('u1');
    expect(store().badges).toHaveLength(14);
    expect(byId('badge-14')).toBeDefined();
    expect(byId('badge-1').name).toBe('First Workout');
  });

  it('applies the badges unlocked on the server, Race Day included', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ unlocked: { 'badge-14': '2026-10-14T10:00:00Z' } }) });
    await store().loadBadges('u1');
    expect(byId('badge-14')).toMatchObject({ isUnlocked: true, unlockedAt: '2026-10-14T10:00:00Z' });
    expect(byId('badge-1').isUnlocked).toBe(false);
  });

  it('adds the new badges to a list read back from the phone, shortly after the app opens', async () => {
    jest.useFakeTimers();
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      store().initializeDefaultBadges();
      const saved = store().badges.filter((b) => b.id !== 'badge-14');
      useBadgeStore.setState({ badges: [] });
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({ state: { badges: saved }, version: 0 }));
      await useBadgeStore.persist.rehydrate();
      expect(store().badges).toHaveLength(13);
      jest.advanceTimersByTime(60);
      expect(store().badges).toHaveLength(14);
      expect(byId('badge-14').name).toBe('Race Day');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does nothing without a person', async () => {
    await store().loadBadges('');
    expect(store().badges).toEqual([]);
    expect(getDoc).not.toHaveBeenCalled();
  });
});

describe('unlockBadge', () => {
  it('unlocks Race Day once and saves it for the person', () => {
    store().initializeDefaultBadges();
    store().unlockBadge('badge-14', 'u1');
    expect(byId('badge-14').isUnlocked).toBe(true);
    expect(Number.isNaN(Date.parse(byId('badge-14').unlockedAt))).toBe(false);
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][0]).toEqual({ path: 'users/u1/data/badges' });
    expect(setDoc.mock.calls[0][1]).toEqual({ unlocked: { 'badge-14': byId('badge-14').unlockedAt } });
    expect(setDoc.mock.calls[0][2]).toEqual({ merge: true });
    store().unlockBadge('badge-14', 'u1');
    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a badge that does not exist', () => {
    store().initializeDefaultBadges();
    store().unlockBadge('badge-99', 'u1');
    expect(setDoc).not.toHaveBeenCalled();
  });
});
