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

import { doc, getDoc, setDoc } from 'firebase/firestore';
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
  it('starts with every badge, including Race Day and Trailblazer', () => {
    store().initializeDefaultBadges();
    expect(store().badges).toHaveLength(15);
    expect(byId('badge-14')).toMatchObject({
      name: 'Race Day', description: 'Finish a virtual race', category: 'running', isUnlocked: false, unlockedAt: null,
    });
    expect(byId('badge-15')).toMatchObject({
      name: 'Trailblazer', description: 'Finish a virtual journey', category: 'running', rarity: 'rare', isUnlocked: false, unlockedAt: null,
    });
    expect(byId('badge-1').name).toBe('First Workout');
  });

  it('adds the badges a saved list is missing, and keeps what is saved', () => {
    store().initializeDefaultBadges();
    const without = store().badges.filter((b) => b.id !== 'badge-14' && b.id !== 'badge-15').map((b) => (b.id === 'badge-1'
      ? { ...b, isUnlocked: true, unlockedAt: '2026-09-01T00:00:00Z' } : b));
    useBadgeStore.setState({ badges: without });
    store().initializeDefaultBadges();
    expect(store().badges).toHaveLength(15);
    expect(byId('badge-14')).toBeDefined();
    expect(byId('badge-15')).toBeDefined();
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
    expect(store().badges).toHaveLength(15);
  });

  it('is filled in, with the new badge, when the badges are loaded for a person', async () => {
    useBadgeStore.setState({ badges: [{ id: 'badge-1', name: 'First Workout', isUnlocked: false }] });
    await store().loadBadges('u1');
    expect(store().badges).toHaveLength(15);
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
      const saved = store().badges.filter((b) => b.id !== 'badge-14' && b.id !== 'badge-15');
      useBadgeStore.setState({ badges: [] });
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({ state: { badges: saved }, version: 0 }));
      await useBadgeStore.persist.rehydrate();
      expect(store().badges).toHaveLength(13);
      jest.advanceTimersByTime(60);
      expect(store().badges).toHaveLength(15);
      expect(byId('badge-14').name).toBe('Race Day');
      expect(byId('badge-15').name).toBe('Trailblazer');
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

describe('badges unlocked on the server', () => {
  const UNLOCKED = { 'badge-1': '2026-09-01T00:00:00Z', 'badge-14': '2026-10-14T10:00:00Z' };

  it('has no way to unlock a badge on the phone: the server decides, and the store only shows', () => {
    expect(store().unlockBadge).toBeUndefined();
  });

  it('shows what the server says is unlocked, with the time, and the rest as locked', () => {
    store().applyServerUnlocks(UNLOCKED);
    expect(byId('badge-1')).toMatchObject({ isUnlocked: true, unlockedAt: '2026-09-01T00:00:00Z' });
    expect(byId('badge-14')).toMatchObject({ isUnlocked: true, unlockedAt: '2026-10-14T10:00:00Z' });
    expect(byId('badge-11')).toMatchObject({ isUnlocked: false, unlockedAt: null });
    expect(store().getUnlockedBadges().map((b) => b.id)).toEqual(['badge-1', 'badge-14']);
  });

  it('sets the badge list up first when it is empty', () => {
    store().applyServerUnlocks(UNLOCKED);
    expect(store().badges).toHaveLength(15);
  });

  it('puts what the server says in place of what the phone held, so a badge it does not list is locked again', () => {
    store().applyServerUnlocks(UNLOCKED);
    store().applyServerUnlocks({ 'badge-14': '2026-10-14T10:00:00Z' });
    expect(byId('badge-1')).toMatchObject({ isUnlocked: false, unlockedAt: null });
    expect(byId('badge-14').isUnlocked).toBe(true);
  });

  it('unlocks none for a missing, empty or wrong sort of answer', () => {
    store().applyServerUnlocks(UNLOCKED);
    [undefined, null, {}, [], 'x', 7].forEach((value) => {
      store().applyServerUnlocks(value);
      expect(store().getUnlockedBadges()).toEqual([]);
    });
  });

  it('ignores an entry with no time, and one for a badge that does not exist', () => {
    store().applyServerUnlocks({ 'badge-1': '', 'badge-99': '2026-10-01T00:00:00Z' });
    expect(byId('badge-1').isUnlocked).toBe(false);
    expect(byId('badge-99')).toBeUndefined();
    expect(store().badges).toHaveLength(15);
  });

  it('is cleared when the person signs out, and the list stays whole', () => {
    store().applyServerUnlocks(UNLOCKED);
    store().clearServerUnlocks();
    expect(store().getUnlockedBadges()).toEqual([]);
    expect(store().badges).toHaveLength(15);
  });

  it('reads the person\'s own badges document when loaded, and shows it', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ unlocked: UNLOCKED }) });
    await store().loadBadges('u1');
    expect(doc).toHaveBeenCalledWith({ name: 'db' }, 'users', 'u1', 'data', 'badges');
    expect(byId('badge-14').isUnlocked).toBe(true);
  });

  it('puts what the server says in place of what the phone held when loaded', async () => {
    store().applyServerUnlocks(UNLOCKED);
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ unlocked: { 'badge-11': '2026-10-20T00:00:00Z' } }) });
    await store().loadBadges('u1');
    expect(store().getUnlockedBadges().map((b) => b.id)).toEqual(['badge-11']);
  });

  it('leaves what is shown alone when the document is missing or cannot be read, and says so for the second', async () => {
    store().applyServerUnlocks(UNLOCKED);
    getDoc.mockResolvedValue({ exists: () => false });
    await store().loadBadges('u1');
    expect(store().getUnlockedBadges()).toHaveLength(2);
    expect(warn).not.toHaveBeenCalled(); // a missing document is not an error
    getDoc.mockRejectedValue(new Error('offline'));
    await store().loadBadges('u1');
    expect(store().getUnlockedBadges()).toHaveLength(2);
    expect(warn).toHaveBeenCalledWith('[badgeStore] loadBadges error:', 'offline');
  });

  it('never writes a badge: nothing on the phone can', () => {
    store().applyServerUnlocks(UNLOCKED);
    store().clearServerUnlocks();
    expect(setDoc).not.toHaveBeenCalled();
  });
});
