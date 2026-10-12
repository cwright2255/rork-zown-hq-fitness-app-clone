// The store keeps module-level sync state, so each test loads a fresh copy of it.
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

const TODAY = '2026-10-09';
const chili = { id: 'r1', title: 'Chili', servings: 4, calories: 400, protein: 30, carbs: 40, fat: 12 };
const oats = { id: 'f1', name: 'Oats', servingSize: '40g', calories: 150, protein: 5, carbs: 27, fat: 3 };
const water = { id: 'f2', name: 'Water', servingSize: '1 glass', calories: 0, protein: 0, carbs: 0, fat: 0 };

let useStore;
let firestore;
let storage;
let warn;
const load = () => {
  jest.resetModules();
  firestore = require('firebase/firestore');
  storage = require('@react-native-async-storage/async-storage').default;
  useStore = require('../store/mealPlanStore').useMealPlanStore;
};
const store = () => useStore.getState();
const flush = async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); };
const ids = () => store().entries.map((e) => e.id);

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-09T12:00:00Z'), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  load();
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); global.__boom = false; });

describe('adding', () => {
  it('adds a recipe and a food, in order, and hands the entry back', () => {
    const a = store().addRecipe(chili, { date: TODAY, slot: 'dinner' });
    const b = store().addFood(oats, { date: TODAY, slot: 'breakfast', servings: 2 });
    expect(a.ok).toBe(true);
    expect(a.entry).toMatchObject({ kind: 'recipe', refId: 'r1', name: 'Chili', servings: 1, date: TODAY, slot: 'dinner' });
    expect(b.entry).toMatchObject({ kind: 'food', refId: 'f1', servings: 2, slot: 'breakfast' });
    expect(store().entries).toEqual([a.entry, b.entry]);
  });

  it('gives every entry its own id', () => {
    store().addRecipe(chili, { date: TODAY, slot: 'dinner' });
    store().addRecipe(chili, { date: TODAY, slot: 'dinner' });
    expect(new Set(ids()).size).toBe(2);
  });

  it.each([
    ['a day that is not real', { date: '2026-02-30', slot: 'dinner' }],
    ['a meal that is not real', { date: TODAY, slot: 'brunch' }],
    ['no place at all', undefined],
  ])('says so for %s and changes nothing', (_label, options) => {
    expect(store().addRecipe(chili, options)).toEqual({ ok: false, error: 'Pick a real day and meal.' });
    expect(store().addFood(oats, options)).toEqual({ ok: false, error: 'Pick a real day and meal.' });
    expect(store().entries).toEqual([]);
  });

  it('says so for a recipe or food that is not valid', () => {
    expect(store().addRecipe(null, { date: TODAY, slot: 'dinner' }).ok).toBe(false);
    expect(store().addFood({ name: 'No id' }, { date: TODAY, slot: 'dinner' }).ok).toBe(false);
    expect(store().entries).toEqual([]);
  });

  it('stops at 10 items in a meal slot, and only for that slot and day', () => {
    for (let i = 0; i < 10; i += 1) expect(store().addRecipe(chili, { date: TODAY, slot: 'dinner' }).ok).toBe(true);
    expect(store().addRecipe(chili, { date: TODAY, slot: 'dinner' })).toEqual({ ok: false, error: 'Dinner already has 10 items on that day.' });
    expect(store().addFood(oats, { date: TODAY, slot: 'dinner' }).ok).toBe(false);
    expect(store().entries.length).toBe(10);
    expect(store().addRecipe(chili, { date: TODAY, slot: 'lunch' }).ok).toBe(true);
    expect(store().addRecipe(chili, { date: '2026-10-10', slot: 'dinner' }).ok).toBe(true);
  });

  it('takes the 300th item, which fills the plan', () => {
    const filler = Array.from({ length: 299 }, (_, i) => ({
      id: `x${i}`, date: '2026-11-01', slot: 'snack', kind: 'recipe', refId: 'r1', name: 'Chili', servings: 1,
      per: { calories: 1, protein: 0, carbs: 0, fat: 0 }, hasNutrition: true, updatedAt: '',
    }));
    useStore.setState({ entries: filler });
    expect(store().addRecipe(chili, { date: TODAY, slot: 'lunch' }).ok).toBe(true);
    expect(store().entries.length).toBe(300);
    expect(store().addRecipe(chili, { date: TODAY, slot: 'dinner' }).ok).toBe(false);
  });

  it('stops when the whole plan has 300 items', () => {
    const filler = Array.from({ length: 300 }, (_, i) => ({
      id: `x${i}`, date: '2026-11-01', slot: 'snack', kind: 'recipe', refId: 'r1', name: 'Chili', servings: 1,
      per: { calories: 1, protein: 0, carbs: 0, fat: 0 }, hasNutrition: true, updatedAt: '',
    }));
    useStore.setState({ entries: filler });
    expect(store().addRecipe(chili, { date: TODAY, slot: 'lunch' })).toEqual({ ok: false, error: 'Your meal plan is full. Remove some items to add more.' });
    expect(store().entries.length).toBe(300);
  });
});

describe('changing', () => {
  let a;
  let b;
  beforeEach(() => {
    a = store().addRecipe(chili, { date: TODAY, slot: 'dinner' }).entry;
    b = store().addFood(oats, { date: TODAY, slot: 'breakfast' }).entry;
    jest.setSystemTime(new Date('2026-10-09T13:00:00Z'));
  });
  const get = (id) => store().entries.find((e) => e.id === id);

  it('changes servings in halves between 1/2 and 20, for that item only', () => {
    store().setServings(a.id, 2.5);
    expect(get(a.id).servings).toBe(2.5);
    expect(get(b.id).servings).toBe(1);
    store().setServings(a.id, 99);
    expect(get(a.id).servings).toBe(20);
    store().setServings(a.id, 0);
    expect(get(a.id).servings).toBe(0.5);
    store().setServings(a.id, 'x');
    expect(get(a.id).servings).toBe(1);
  });

  it('notes when it was changed', () => {
    store().setServings(a.id, 2);
    expect(get(a.id).updatedAt).toBe('2026-10-09T13:00:00.000Z');
    expect(get(b.id).updatedAt).toBe(b.updatedAt);
  });

  it('ignores an item that is not on the plan', () => {
    const before = store().entries;
    store().setServings('nope', 3);
    store().markLogged('nope');
    expect(store().entries).toEqual(before);
  });

  it('removes only that item', () => {
    store().removeEntry(a.id);
    expect(ids()).toEqual([b.id]);
    store().removeEntry('nope');
    expect(ids()).toEqual([b.id]);
  });

  it('records that an item was logged, and when', () => {
    store().markLogged(a.id);
    expect(get(a.id).loggedAt).toBe('2026-10-09T13:00:00.000Z');
    expect(get(b.id).loggedAt).toBeUndefined();
  });
});

describe('moving', () => {
  let a;
  beforeEach(() => {
    a = store().addRecipe(chili, { date: TODAY, slot: 'dinner' }).entry;
    jest.setSystemTime(new Date('2026-10-09T13:00:00Z'));
  });

  it('moves an item to another day and meal, keeping everything else', () => {
    const out = store().moveEntry(a.id, { date: '2026-10-12', slot: 'lunch' });
    expect(out.ok).toBe(true);
    expect(out.entry).toEqual({ ...a, date: '2026-10-12', slot: 'lunch', updatedAt: '2026-10-09T13:00:00.000Z' });
    expect(store().entries).toEqual([out.entry]);
  });

  it('can move within a slot that has room for it, even a full one', () => {
    for (let i = 0; i < 9; i += 1) store().addRecipe(chili, { date: TODAY, slot: 'dinner' });
    expect(store().entries.filter((e) => e.slot === 'dinner').length).toBe(10);
    expect(store().moveEntry(a.id, { date: TODAY, slot: 'dinner' }).ok).toBe(true);
  });

  it('refuses a full slot', () => {
    for (let i = 0; i < 10; i += 1) store().addRecipe(chili, { date: '2026-10-12', slot: 'lunch' });
    expect(store().moveEntry(a.id, { date: '2026-10-12', slot: 'lunch' })).toEqual({ ok: false, error: 'Lunch already has 10 items on that day.' });
    expect(store().entries.find((e) => e.id === a.id)).toEqual(a);
  });

  it('refuses a place that is not real, an item that is not there, and one already logged', () => {
    expect(store().moveEntry(a.id, { date: 'nope', slot: 'lunch' })).toEqual({ ok: false, error: 'Pick a real day and meal.' });
    expect(store().moveEntry(a.id, { date: TODAY, slot: 'brunch' }).ok).toBe(false);
    expect(store().moveEntry(a.id)).toEqual({ ok: false, error: 'Pick a real day and meal.' });
    expect(store().moveEntry('nope', { date: TODAY, slot: 'lunch' })).toEqual({ ok: false, error: 'This item is no longer in your plan.' });
    store().markLogged(a.id);
    expect(store().moveEntry(a.id, { date: '2026-10-12', slot: 'lunch' })).toEqual({ ok: false, error: 'This one is already logged.' });
    expect(store().entries[0].date).toBe(TODAY);
  });
});

describe('copying', () => {
  let a;
  beforeEach(() => {
    a = store().addRecipe(chili, { date: TODAY, slot: 'dinner', servings: 2 }).entry;
    jest.setSystemTime(new Date('2026-10-09T13:00:00Z'));
  });

  it('adds a copy on the other day, with its own id, and leaves the original', () => {
    const out = store().copyEntry(a.id, { date: '2026-10-10', slot: 'dinner' });
    expect(out.ok).toBe(true);
    expect(out.entry.id).not.toBe(a.id);
    expect(out.entry).toEqual({ ...a, id: out.entry.id, date: '2026-10-10', updatedAt: '2026-10-09T13:00:00.000Z' });
    expect(store().entries).toEqual([a, out.entry]);
  });

  it('is not logged, even when the original is', () => {
    store().markLogged(a.id);
    const out = store().copyEntry(a.id, { date: '2026-10-10', slot: 'lunch' });
    expect(out.ok).toBe(true);
    expect('loggedAt' in out.entry).toBe(false);
    expect(store().entries.find((e) => e.id === a.id).loggedAt).toBeDefined();
  });

  it('refuses a full slot, a place that is not real, and an item that is not there', () => {
    for (let i = 0; i < 10; i += 1) store().addRecipe(chili, { date: '2026-10-10', slot: 'lunch' });
    expect(store().copyEntry(a.id, { date: '2026-10-10', slot: 'lunch' })).toEqual({ ok: false, error: 'Lunch already has 10 items on that day.' });
    expect(store().copyEntry(a.id, { date: 'nope', slot: 'lunch' })).toEqual({ ok: false, error: 'Pick a real day and meal.' });
    expect(store().copyEntry(a.id)).toEqual({ ok: false, error: 'Pick a real day and meal.' });
    expect(store().copyEntry('nope', { date: TODAY, slot: 'lunch' })).toEqual({ ok: false, error: 'This item is no longer in your plan.' });
    expect(store().entries.length).toBe(11);
  });
});

describe('saved on the phone', () => {
  const savedEntries = () => {
    const calls = storage.setItem.mock.calls.filter(([key]) => key === 'zown-meal-plan-storage');
    return JSON.parse(calls[calls.length - 1][1]).state;
  };

  it('keeps the plan under its own key, and only the plan', async () => {
    store().addRecipe(chili, { date: TODAY, slot: 'dinner' });
    await flush();
    const state = savedEntries();
    expect(Object.keys(state)).toEqual(['entries']);
    expect(state.entries[0]).toMatchObject({ name: 'Chili', date: TODAY });
  });

  it('leaves out days further back than 30 days', async () => {
    useStore.setState({
      entries: [
        { id: 'old', date: '2026-09-08', slot: 'dinner', kind: 'recipe', refId: 'r1', name: 'Old', servings: 1, per: {}, hasNutrition: true, updatedAt: '' },
        { id: 'new', date: '2026-09-09', slot: 'dinner', kind: 'recipe', refId: 'r1', name: 'New', servings: 1, per: {}, hasNutrition: true, updatedAt: '' },
      ],
    });
    await flush();
    expect(savedEntries().entries.map((e) => e.id)).toEqual(['new']);
  });

  it('reads it back, dropping anything that is not a real entry', async () => {
    const good = { id: 'g', date: TODAY, slot: 'lunch', kind: 'recipe', refId: 'r1', name: 'Chili', servings: 1.5, per: { calories: 400 }, hasNutrition: true, updatedAt: 'x' };
    jest.resetModules();
    storage = require('@react-native-async-storage/async-storage').default;
    storage.getItem.mockResolvedValue(JSON.stringify({ state: { entries: [good, { id: 'bad' }, null], syncUid: 'sneaky' }, version: 0 }));
    useStore = require('../store/mealPlanStore').useMealPlanStore;
    await useStore.persist.rehydrate();
    expect(store().entries.map((e) => e.id)).toEqual(['g']);
    expect(store().entries[0].servings).toBe(1.5);
    expect(store().syncUid).toBeNull();
  });

  it('starts empty when nothing was saved or what was saved is not a plan', async () => {
    await useStore.persist.rehydrate();
    expect(useStore.persist.hasHydrated()).toBe(true);
    expect(store().entries).toEqual([]);
    storage.getItem.mockResolvedValue(JSON.stringify({ state: {}, version: 0 }));
    await useStore.persist.rehydrate();
    expect(store().entries).toEqual([]);
  });
});

describe('startSync', () => {
  const cloudEntry = (over = {}) => ({
    id: 'c1', date: TODAY, slot: 'lunch', kind: 'recipe', refId: 'r9', name: 'Cloud Soup', servings: 1,
    per: { calories: 300, protein: 0, carbs: 0, fat: 0 }, hasNutrition: true, updatedAt: '2026-10-08T10:00:00.000Z', ...over,
  });

  it('merges the plan in the cloud into this phone\'s', async () => {
    store().addRecipe(chili, { date: TODAY, slot: 'dinner' });
    firestore.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ entries: [cloudEntry()] }) });
    await store().startSync('u1');
    expect(firestore.doc).toHaveBeenCalledWith({}, 'users', 'u1', 'data', 'mealPlan');
    expect(firestore.getDoc).toHaveBeenCalledWith({ path: 'users/u1/data/mealPlan' });
    expect(store().entries.map((e) => e.name)).toEqual(['Chili', 'Cloud Soup']);
    expect(store().syncUid).toBe('u1');
  });

  it('keeps this phone\'s plan when there is none in the cloud yet', async () => {
    store().addRecipe(chili, { date: TODAY, slot: 'dinner' });
    firestore.getDoc.mockResolvedValue({ exists: () => false });
    await store().startSync('u1');
    expect(store().entries.map((e) => e.name)).toEqual(['Chili']);
    expect(store().syncUid).toBe('u1');
    expect(warn).not.toHaveBeenCalled();
  });

  it('starts anyway when the cloud can not be reached, and keeps the phone\'s plan', async () => {
    store().addRecipe(chili, { date: TODAY, slot: 'dinner' });
    firestore.getDoc.mockRejectedValue(new Error('offline'));
    await store().startSync('u1');
    expect(store().entries.length).toBe(1);
    expect(store().syncUid).toBe('u1');
    expect(warn).toHaveBeenCalledWith('[mealPlanStore] load error:', 'offline');
  });

  it('keeps the plan when the same person starts sync again', async () => {
    firestore.getDoc.mockResolvedValue({ exists: () => false });
    await store().startSync('u1');
    store().addRecipe(chili, { date: TODAY, slot: 'dinner' });
    await store().startSync('u1');
    expect(store().entries.map((e) => e.name)).toEqual(['Chili']);
    expect(store().syncUid).toBe('u1');
  });

  it('starts another person who signs in on this phone from their own plan, and never writes the first person\'s into it', async () => {
    firestore.getDoc.mockResolvedValue({ exists: () => false });
    await store().startSync('u1');
    store().addRecipe(chili, { date: TODAY, slot: 'dinner' });
    await flush();
    expect(firestore.setDoc).toHaveBeenCalledTimes(1);
    firestore.setDoc.mockClear();

    firestore.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ entries: [cloudEntry()] }) });
    await store().startSync('u2');
    await flush();
    expect(store().syncUid).toBe('u2');
    expect(store().entries.map((e) => e.name)).toEqual(['Cloud Soup']);
    // u2's own plan was loaded, so there is nothing new to write, and nothing went to u1's plan.
    expect(firestore.setDoc.mock.calls.filter(([ref]) => ref.path === 'users/u1/data/mealPlan')).toHaveLength(0);
    expect(firestore.setDoc.mock.calls.filter(([ref]) => ref.path === 'users/u2/data/mealPlan').every(([, d]) => d.entries.every((e) => e.name === 'Cloud Soup'))).toBe(true);

    store().addFood(oats, { date: TODAY, slot: 'breakfast' });
    await flush();
    const last = firestore.setDoc.mock.calls[firestore.setDoc.mock.calls.length - 1];
    expect(last[0].path).toBe('users/u2/data/mealPlan');
    expect(last[1].entries.map((e) => e.name)).toEqual(['Cloud Soup', 'Oats']);
  });

  it('does not create a plan in the cloud for the next person when they have none and nothing planned', async () => {
    firestore.getDoc.mockResolvedValue({ exists: () => false });
    await store().startSync('u1');
    store().addRecipe(chili, { date: TODAY, slot: 'dinner' });
    await flush();
    firestore.setDoc.mockClear();
    await store().startSync('u2');
    await flush();
    expect(store().entries).toEqual([]);
    expect(store().syncUid).toBe('u2');
    expect(firestore.setDoc).not.toHaveBeenCalled();
  });

  it('keeps what the next person adds while their plan is still loading out of the first person\'s plan', async () => {
    firestore.getDoc.mockResolvedValue({ exists: () => false });
    await store().startSync('u1');
    store().addRecipe(chili, { date: TODAY, slot: 'dinner' });
    await flush();
    firestore.setDoc.mockClear();
    let release;
    firestore.getDoc.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const starting = store().startSync('u2');
    store().addFood(oats, { date: TODAY, slot: 'breakfast' });
    await flush();
    expect(firestore.setDoc).not.toHaveBeenCalled();
    release({ exists: () => false });
    await starting;
    await flush();
    expect(firestore.setDoc.mock.calls.map(([ref]) => ref.path)).toEqual(['users/u2/data/mealPlan']);
    expect(firestore.setDoc.mock.calls[0][1].entries.map((e) => e.name)).toEqual(['Oats']);
  });

  it('does not let a write that was waiting for the first person put the new person\'s plan in the first one\'s', async () => {
    firestore.getDoc.mockResolvedValue({ exists: () => false });
    await store().startSync('u1');
    store().addRecipe(chili, { date: TODAY, slot: 'dinner' });
    await flush();
    firestore.setDoc.mockClear();
    // The next write for u1 is slow, and another change queues up behind it.
    let finish;
    firestore.setDoc.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    store().addFood(oats, { date: TODAY, slot: 'breakfast' });
    await flush();
    store().addFood(water, { date: TODAY, slot: 'snack' });
    // u2 signs in while that is still going on.
    firestore.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ entries: [cloudEntry()] }) });
    await store().startSync('u2');
    await flush();
    finish();
    await flush();
    expect(firestore.setDoc.mock.calls.filter(([ref]) => ref.path === 'users/u1/data/mealPlan')).toHaveLength(1);
    expect(store().entries.map((e) => e.name)).toEqual(['Cloud Soup']);
  });

  it('does nothing without a user', async () => {
    await store().startSync(undefined);
    await store().startSync('');
    expect(firestore.getDoc).not.toHaveBeenCalled();
    expect(store().syncUid).toBeNull();
  });
});

describe('the cloud copy', () => {
  // A food on the plan that can not be turned into text while global.__boom is on.
  const foodItem = () => {
    const entry = store().addFood(oats, { date: TODAY, slot: 'breakfast' }).entry;
    useStore.setState({ entries: [] });
    return { ...entry, food: { ...entry.food, toJSON() { if (global.__boom) throw new Error('boom'); return { ...entry.food }; } } };
  };
  const start = async () => {
    firestore.getDoc.mockResolvedValue({ exists: () => false });
    await store().startSync('u1');
    await flush();
    firestore.setDoc.mockClear();
  };
  const lastWrite = () => {
    const calls = firestore.setDoc.mock.calls;
    return calls[calls.length - 1];
  };

  it('is not written before sync starts', async () => {
    store().addRecipe(chili, { date: TODAY, slot: 'dinner' });
    await flush();
    expect(firestore.setDoc).not.toHaveBeenCalled();
  });

  it('is not created for a plan that has always been empty', async () => {
    firestore.getDoc.mockResolvedValue({ exists: () => false });
    await store().startSync('u1');
    await flush();
    expect(firestore.setDoc).not.toHaveBeenCalled();
  });

  it('is written when the plan changes', async () => {
    await start();
    const { entry } = store().addRecipe(chili, { date: TODAY, slot: 'dinner' });
    await flush();
    expect(firestore.setDoc).toHaveBeenCalledTimes(1);
    const [ref, data] = lastWrite();
    expect(ref).toEqual({ path: 'users/u1/data/mealPlan' });
    expect(data.entries).toEqual([entry]);
    expect(data.updatedAt).toBe('2026-10-09T12:00:00.000Z');
  });

  it('is written once for changes made together, with all of them', async () => {
    await start();
    store().addRecipe(chili, { date: TODAY, slot: 'dinner' });
    store().addFood(oats, { date: TODAY, slot: 'breakfast' });
    await flush();
    expect(firestore.setDoc).toHaveBeenCalledTimes(1);
    expect(lastWrite()[1].entries.map((e) => e.name)).toEqual(['Chili', 'Oats']);
  });

  it('is written again for each later change, and can end up empty', async () => {
    await start();
    const { entry } = store().addRecipe(chili, { date: TODAY, slot: 'dinner' });
    await flush();
    store().setServings(entry.id, 3);
    await flush();
    expect(lastWrite()[1].entries[0].servings).toBe(3);
    store().removeEntry(entry.id);
    await flush();
    expect(firestore.setDoc).toHaveBeenCalledTimes(3);
    expect(lastWrite()[1].entries).toEqual([]);
  });

  it('is not written again when nothing in it changed', async () => {
    await start();
    store().addRecipe(chili, { date: TODAY, slot: 'dinner' });
    await flush();
    useStore.setState({ syncUid: 'u1' });
    await flush();
    expect(firestore.setDoc).toHaveBeenCalledTimes(1);
  });

  it('leaves out days further back than 30 days, and anything undefined', async () => {
    await start();
    useStore.setState({
      entries: [
        { id: 'old', date: '2026-09-08', slot: 'dinner', kind: 'recipe', refId: 'r1', name: 'Old', servings: 1, per: {}, hasNutrition: true, updatedAt: '' },
        { id: 'new', date: TODAY, slot: 'dinner', kind: 'food', refId: 'f1', name: 'Oats', servings: 1, per: {}, hasNutrition: true, updatedAt: '', food: { id: 'f1', name: 'Oats', brand: undefined } },
      ],
    });
    await flush();
    const data = lastWrite()[1];
    expect(data.entries.map((e) => e.id)).toEqual(['new']);
    expect('brand' in data.entries[0].food).toBe(false);
  });

  it('is tried again at the next change even if the plan itself has not changed since the failed write', async () => {
    await start();
    firestore.setDoc.mockRejectedValueOnce(new Error('offline'));
    store().addRecipe(chili, { date: TODAY, slot: 'dinner' });
    await flush();
    expect(firestore.setDoc).toHaveBeenCalledTimes(1);
    useStore.setState({});
    await flush();
    expect(firestore.setDoc).toHaveBeenCalledTimes(2);
    expect(lastWrite()[1].entries.map((e) => e.name)).toEqual(['Chili']);
  });

  it('keeps syncing after something goes wrong in preparing a write', async () => {
    await start();
    const food = foodItem();
    useStore.setState({ entries: [food] });
    global.__boom = true;
    await flush();
    expect(warn).toHaveBeenCalledWith('[mealPlanStore] sync error:', 'boom');
    expect(firestore.setDoc).not.toHaveBeenCalled();
    global.__boom = false;
    store().addRecipe(chili, { date: TODAY, slot: 'dinner' });
    await flush();
    expect(firestore.setDoc).toHaveBeenCalledTimes(1);
    expect(lastWrite()[1].entries.map((e) => e.name)).toEqual(['Oats', 'Chili']);
  });

  it('is tried again at the next change after a failed write', async () => {
    await start();
    firestore.setDoc.mockRejectedValueOnce(new Error('offline'));
    store().addRecipe(chili, { date: TODAY, slot: 'dinner' });
    await flush();
    expect(warn).toHaveBeenCalledWith('[mealPlanStore] sync error:', 'offline');
    store().addFood(oats, { date: TODAY, slot: 'breakfast' });
    await flush();
    expect(firestore.setDoc).toHaveBeenCalledTimes(2);
    expect(lastWrite()[1].entries.map((e) => e.name)).toEqual(['Chili', 'Oats']);
  });
});
