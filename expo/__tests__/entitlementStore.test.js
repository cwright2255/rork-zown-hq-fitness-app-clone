// The person's plan on the phone (store/entitlementStore.js): follows entitlements/{uid} live, keeps a copy so it shows offline, and
// never shows one person's plan to another. The cloud is faked. The store keeps a module-level listener, so each test loads a fresh copy.
jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((db, ...path) => ({ path: path.join('/') })),
  onSnapshot: jest.fn(),
}));

let firestore;
let storage;
let useStore;
let listeners;
let warn;

const load = (persisted) => {
  jest.resetModules();
  firestore = require('firebase/firestore');
  storage = require('@react-native-async-storage/async-storage').default;
  if (persisted) storage.getItem.mockResolvedValue(JSON.stringify({ state: persisted, version: 0 }));
  listeners = [];
  firestore.onSnapshot.mockImplementation((ref, next, error) => {
    const listener = { ref, next, error, off: jest.fn() };
    listeners.push(listener);
    return listener.off;
  });
  useStore = require('../store/entitlementStore').useEntitlementStore;
};
const store = () => useStore.getState();
const flush = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };
const snapshot = (data) => ({ exists: () => data !== null, data: () => data });
const PRO = { tier: 'pro', status: 'active', expiresAt: null, source: 'manual' };

beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  load();
});
afterEach(() => { jest.restoreAllMocks(); });

describe('following the plan', () => {
  it('listens to the person\'s own entitlements document, and knows nothing yet', () => {
    store().startListening('u1');
    expect(listeners).toHaveLength(1);
    expect(listeners[0].ref).toEqual({ path: 'entitlements/u1' });
    expect(store()).toMatchObject({ uid: 'u1', plan: null, isLoaded: false });
  });

  it('shows the plan in the document, as plain data', () => {
    store().startListening('u1');
    listeners[0].next(snapshot({ tier: 'legend', status: 'active', expiresAt: { toMillis: () => Date.parse('2026-12-01T00:00:00.000Z') }, source: 'revenuecat' }));
    expect(store().plan).toEqual({ tier: 'legend', status: 'active', expiresAt: '2026-12-01T00:00:00.000Z', source: 'revenuecat' });
    expect(store().isLoaded).toBe(true);
  });

  it('has no plan, and has finished loading, when there is no document (Free)', () => {
    store().startListening('u1');
    listeners[0].next(snapshot(null));
    expect(store()).toMatchObject({ plan: null, isLoaded: true, error: null });
  });

  it('follows a change to the plan, as when it is bought or edited', () => {
    store().startListening('u1');
    listeners[0].next(snapshot(PRO));
    expect(store().plan.tier).toBe('pro');
    listeners[0].next(snapshot({ ...PRO, tier: 'legend' }));
    expect(store().plan.tier).toBe('legend');
    listeners[0].next(snapshot(null));
    expect(store().plan).toBeNull();
  });

  it('does nothing without a person, and does not listen twice for the same one', () => {
    store().startListening(undefined);
    store().startListening('');
    expect(listeners).toHaveLength(0);
    store().startListening('u1');
    store().startListening('u1');
    expect(listeners).toHaveLength(1);
  });

  it('moves to another person: stops the first listener, starts a second, and drops the first person\'s plan', () => {
    store().startListening('u1');
    listeners[0].next(snapshot(PRO));
    store().startListening('u2');
    expect(listeners[0].off).toHaveBeenCalledTimes(1);
    expect(listeners).toHaveLength(2);
    expect(listeners[1].ref).toEqual({ path: 'entitlements/u2' });
    expect(store()).toMatchObject({ uid: 'u2', ownerUid: 'u2', plan: null, isLoaded: false });
  });

  it('ignores an answer about the first person that arrives after the second has signed in', () => {
    store().startListening('u1');
    store().startListening('u2');
    listeners[0].next(snapshot({ ...PRO, tier: 'legend' }));
    expect(store().plan).toBeNull();
    expect(store().isLoaded).toBe(false);
  });

  it('keeps the plan it has, and stops waiting, when the cloud cannot be read', () => {
    store().startListening('u1');
    listeners[0].next(snapshot(PRO));
    listeners[0].error(new Error('offline'));
    expect(store()).toMatchObject({ plan: expect.objectContaining({ tier: 'pro' }), isLoaded: true, error: 'offline' });
    expect(warn).toHaveBeenCalled();
  });

  it('gives a reason when the cloud cannot be read and says nothing about why', () => {
    store().startListening('u1');
    listeners[0].error({});
    expect(store().error).toBe('Could not load your plan.');
  });

  it('ignores a read error about a person who is no longer signed in', () => {
    store().startListening('u1');
    store().startListening('u2');
    listeners[0].error(new Error('late'));
    expect(store().isLoaded).toBe(false);
    expect(store().error).toBeNull();
  });

  it('does not break when listening cannot start, and stops waiting', () => {
    firestore.onSnapshot.mockImplementation(() => { throw new Error('no firestore'); });
    expect(() => store().startListening('u1')).not.toThrow();
    expect(store().isLoaded).toBe(true);
  });
});

describe('stopping', () => {
  it('stops listening and forgets the plan and whose it was, so the next person cannot get it', () => {
    store().startListening('u1');
    listeners[0].next(snapshot(PRO));
    store().stopListening();
    expect(listeners[0].off).toHaveBeenCalledTimes(1);
    expect(store()).toMatchObject({ plan: null, ownerUid: null, uid: null, isLoaded: false });
  });

  it('is safe when nothing is being listened to', () => {
    expect(() => store().stopListening()).not.toThrow();
  });

  it('lets the same person start again afterwards', () => {
    store().startListening('u1');
    store().stopListening();
    store().startListening('u1');
    expect(listeners).toHaveLength(2);
  });
});

describe('the copy on the phone', () => {
  it('keeps the plan and whose it is', async () => {
    store().startListening('u1');
    listeners[0].next(snapshot(PRO));
    await flush();
    const saved = JSON.parse(storage.setItem.mock.calls[storage.setItem.mock.calls.length - 1][1]);
    expect(saved.state).toEqual({ plan: { tier: 'pro', status: 'active', expiresAt: null, source: 'manual' }, ownerUid: 'u1' });
  });

  it('keeps it under its own name, apart from every other store\'s', async () => {
    store().startListening('u1');
    listeners[0].next(snapshot(PRO));
    await flush();
    expect(storage.setItem.mock.calls.every(([key]) => key === 'zown-entitlement-storage')).toBe(true);
    expect(storage.setItem).toHaveBeenCalled();
  });

  it('keeps nothing else, such as who is being listened for', async () => {
    store().startListening('u1');
    await flush();
    const saved = JSON.parse(storage.setItem.mock.calls[storage.setItem.mock.calls.length - 1][1]);
    expect(Object.keys(saved.state).sort()).toEqual(['ownerUid', 'plan']);
  });

  it('shows the kept plan at once when the same person signs in again, before the cloud answers', async () => {
    load({ plan: PRO, ownerUid: 'u1' });
    await flush();
    expect(store().plan.tier).toBe('pro');
    store().startListening('u1');
    expect(store().plan.tier).toBe('pro');
    expect(store().isLoaded).toBe(false);
  });

  it('does not show a plan kept for somebody else to a different person', async () => {
    load({ plan: PRO, ownerUid: 'u1' });
    await flush();
    store().startListening('u2');
    expect(store().plan).toBeNull();
    expect(store().ownerUid).toBe('u2');
  });

  it('lets the cloud\'s answer replace the kept plan', async () => {
    load({ plan: PRO, ownerUid: 'u1' });
    await flush();
    store().startListening('u1');
    listeners[0].next(snapshot(null));
    expect(store().plan).toBeNull();
    expect(store().isLoaded).toBe(true);
  });

  it('does not let a kept plan that is read late overwrite what the cloud has already said', async () => {
    let release;
    storage.getItem.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    jest.resetModules();
    firestore = require('firebase/firestore');
    storage = require('@react-native-async-storage/async-storage').default;
    storage.getItem.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    listeners = [];
    firestore.onSnapshot.mockImplementation((ref, next) => { listeners.push({ next, off: jest.fn() }); return jest.fn(); });
    useStore = require('../store/entitlementStore').useEntitlementStore;
    store().startListening('u1');
    listeners[0].next(snapshot(null));
    release(JSON.stringify({ state: { plan: { ...PRO, tier: 'legend' }, ownerUid: 'u1' }, version: 0 }));
    await flush();
    expect(store().plan).toBeNull();
  });

  it('reads a damaged kept copy as no plan', async () => {
    load({ plan: 'pro', ownerUid: 7 });
    await flush();
    expect(store().plan).toBeNull();
    expect(store().ownerUid).toBeNull();
  });
});
