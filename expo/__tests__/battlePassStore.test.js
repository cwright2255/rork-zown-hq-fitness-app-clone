// store/battlePassStore.js: which Battle Pass tiers are claimed. A tier is claimed by the server (the claimBattlePassTier function,
// functions/src/unlocks.js); this store asks it to, and shows what it says.
jest.mock('../src/config/firebase', () => ({ db: { name: 'db' }, functions: { name: 'fns' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((db, ...path) => ({ path: path.join('/') })),
  getDoc: jest.fn(),
  setDoc: jest.fn(async () => undefined),
}));
jest.mock('../services/callProxy', () => ({ callProxy: (...a) => global.__call(...a) }));

import { doc, getDoc, setDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBattlePassStore } from '../store/battlePassStore';

const store = () => useBattlePassStore.getState();

let warn;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  [doc, getDoc, setDoc].forEach((fn) => fn.mockClear());
  getDoc.mockResolvedValue({ exists: () => false });
  global.__call = jest.fn(async () => ({ status: 'claimed', claimedTiers: [1, 2], level: 5 }));
  store().clearServerClaims();
});
afterEach(() => warn.mockRestore());

describe('claiming a tier', () => {
  it('asks the server to claim it, and shows the tiers it says are claimed', async () => {
    expect(await store().claimTier(2)).toBe('claimed');
    expect(global.__call).toHaveBeenCalledWith('claimBattlePassTier', { tier: 2 });
    expect(store().claimedTiers).toEqual([1, 2]);
  });

  it('does not show the tier as claimed until the server says so', async () => {
    let release;
    global.__call = jest.fn(() => new Promise((resolve) => { release = resolve; }));
    const pending = store().claimTier(3);
    expect(store().claimedTiers).toEqual([]);
    expect(store().claiming).toBe(3);
    release({ status: 'claimed', claimedTiers: [3], level: 3 });
    await pending;
    expect(store().claimedTiers).toEqual([3]);
    expect(store().claiming).toBeNull();
  });

  it('says a second tap on the same tier waits for the first, and asks the server once', async () => {
    let release;
    global.__call = jest.fn(() => new Promise((resolve) => { release = resolve; }));
    const first = store().claimTier(3);
    expect(await store().claimTier(3)).toBe('busy');
    expect(global.__call).toHaveBeenCalledTimes(1);
    release({ status: 'claimed', claimedTiers: [3], level: 3 });
    expect(await first).toBe('claimed');
  });

  it('can claim again once the first has finished', async () => {
    await store().claimTier(2);
    global.__call = jest.fn(async () => ({ status: 'claimed', claimedTiers: [1, 2, 3], level: 5 }));
    expect(await store().claimTier(3)).toBe('claimed');
    expect(store().claimedTiers).toEqual([1, 2, 3]);
  });

  it('says so when the tier was already claimed, and brings the list up to date', async () => {
    global.__call = jest.fn(async () => ({ status: 'already', claimedTiers: [1, 2, 4], level: 9 }));
    expect(await store().claimTier(2)).toBe('already');
    expect(store().claimedTiers).toEqual([1, 2, 4]);
  });

  it('says so, and claims nothing, when the level has not reached the tier', async () => {
    global.__call = jest.fn(async () => ({ status: 'locked', claimedTiers: [1], level: 2 }));
    expect(await store().claimTier(9)).toBe('locked');
    expect(store().claimedTiers).toEqual([1]);
  });

  it('says it failed, and changes nothing, when the server cannot be reached or turns the request away', async () => {
    store().applyServerClaims([1]);
    global.__call = jest.fn(async () => { throw new Error('unavailable'); });
    expect(await store().claimTier(2)).toBe('failed');
    expect(store().claimedTiers).toEqual([1]);
    expect(store().claiming).toBeNull();
    expect(warn).toHaveBeenCalledWith('[battlePassStore] claimTier error:', 'unavailable');
  });

  it('says it failed for an answer it does not understand, and can be tried again', async () => {
    store().applyServerClaims([1]);
    global.__call = jest.fn(async () => ({ status: 'whatever' }));
    expect(await store().claimTier(2)).toBe('failed');
    global.__call = jest.fn(async () => undefined);
    expect(await store().claimTier(2)).toBe('failed');
    expect(store().claimedTiers).toEqual([1]);
    expect(store().claiming).toBeNull();
  });

  it('lets a second tier be claimed while the first is still on its way, and keeps the first one\'s answer from clearing the second', async () => {
    const releases = {};
    global.__call = jest.fn((_name, { tier }) => new Promise((resolve) => { releases[tier] = resolve; }));
    const first = store().claimTier(3);
    const second = store().claimTier(4);
    expect(global.__call).toHaveBeenCalledTimes(2);
    expect(store().claiming).toBe(4);
    releases[3]({ status: 'claimed', claimedTiers: [3], level: 5 });
    expect(await first).toBe('claimed');
    expect(store().claiming).toBe(4);
    releases[4]({ status: 'claimed', claimedTiers: [3, 4], level: 5 });
    expect(await second).toBe('claimed');
    expect(store().claiming).toBeNull();
    expect(store().claimedTiers).toEqual([3, 4]);
  });

  it('does not write a claim itself: nothing on the phone can', async () => {
    await store().claimTier(2);
    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe('tiers claimed on the server', () => {
  it('shows the list in order, once each', () => {
    store().applyServerClaims([4, 1, 4, 2]);
    expect(store().claimedTiers).toEqual([1, 2, 4]);
  });

  it('puts what the server says in place of what the phone held', () => {
    store().applyServerClaims([1, 2, 3]);
    store().applyServerClaims([2]);
    expect(store().claimedTiers).toEqual([2]);
  });

  it('shows nothing claimed for a missing or wrong sort of answer, and drops entries that are not tiers', () => {
    store().applyServerClaims([1]);
    [undefined, null, 'x', {}, 7].forEach((value) => {
      store().applyServerClaims(value);
      expect(store().claimedTiers).toEqual([]);
    });
    store().applyServerClaims([1, '2', 2.5, null, 3]);
    expect(store().claimedTiers).toEqual([1, 3]);
  });

  it('puts the tiers in number order, not in the order of their digits', () => {
    store().applyServerClaims([10, 2, 1]);
    expect(store().claimedTiers).toEqual([1, 2, 10]);
  });

  it('is cleared when the person signs out, and no claim is left waiting', async () => {
    store().applyServerClaims([1, 2]);
    global.__call = jest.fn(() => new Promise(() => undefined));
    store().claimTier(5);
    expect(store().claiming).toBe(5);
    store().clearServerClaims();
    expect(store().claimedTiers).toEqual([]);
    expect(store().claiming).toBeNull();
  });

  it('keeps only the claimed tiers on the phone, under its own name', () => {
    AsyncStorage.setItem.mockClear();
    store().applyServerClaims([2, 1]);
    const saved = AsyncStorage.setItem.mock.calls.filter(([name]) => name === 'zown-battlepass-storage');
    expect(saved.length).toBeGreaterThan(0);
    expect(JSON.parse(saved[saved.length - 1][1]).state).toEqual({ claimedTiers: [1, 2] });
  });
});

describe('loadBattlePass', () => {
  it('reads the person\'s own battle pass document and shows it', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ claimedTiers: [1, 3] }) });
    await store().loadBattlePass('u1');
    expect(doc).toHaveBeenCalledWith({ name: 'db' }, 'users', 'u1', 'data', 'battlePass');
    expect(store().claimedTiers).toEqual([1, 3]);
    expect(store().isLoading).toBe(false);
  });

  it('leaves what is shown alone when there is no document, or it cannot be read, and is no longer loading either way', async () => {
    store().applyServerClaims([1]);
    await store().loadBattlePass('u1');
    expect(store().claimedTiers).toEqual([1]);
    getDoc.mockRejectedValue(new Error('offline'));
    await store().loadBattlePass('u1');
    expect(store().claimedTiers).toEqual([1]);
    expect(store().isLoading).toBe(false);
    expect(warn).toHaveBeenCalledWith('[battlePassStore] loadBattlePass error:', 'offline');
  });

  it('does nothing without a person', async () => {
    await store().loadBattlePass('');
    expect(getDoc).not.toHaveBeenCalled();
  });
});
