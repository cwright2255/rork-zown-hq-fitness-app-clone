// The calendar's store (store/scheduleStore.js). It keeps module-level sync state, so each test loads a fresh copy of it.
// jest.global-setup.js pins the time zone to America/New_York.
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

const { MAX_EVENTS } = require('../lib/calendarEvents');

const form = (o = {}) => ({ title: 'Leg day', kind: 'workout', date: '2026-10-20', time: '07:00', notes: '', remindMinutes: 30, ...o });
const stored = (o = {}) => ({
  id: 'c1', title: 'Cloud run', kind: 'run', start: new Date(2026, 9, 21, 6, 0).toISOString(), notes: '', workoutId: null, repeat: null,
  remindMinutes: 0, doneDates: [], skipDates: [], source: 'user', inviteId: null, host: null, updatedAt: '2026-10-08T10:00:00.000Z', ...o,
});

let useStore;
let firestore;
let storage;
let warn;
const load = () => {
  jest.resetModules();
  firestore = require('firebase/firestore');
  storage = require('@react-native-async-storage/async-storage').default;
  useStore = require('../store/scheduleStore').useScheduleStore;
};
const store = () => useStore.getState();
const flush = async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); };
const titles = () => store().events.map((e) => e.title);

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-19T12:00:00Z'), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  load();
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe('adding an event from the form', () => {
  it('adds it and hands it back', () => {
    const r = store().addEvent(form());
    expect(r.ok).toBe(true);
    expect(r.event).toMatchObject({ title: 'Leg day', kind: 'workout', remindMinutes: 30, source: 'user' });
    expect(store().events).toEqual([r.event]);
  });

  it('says what is wrong with a form that is not right, and adds nothing', () => {
    const r = store().addEvent(form({ title: '' }));
    expect(r).toEqual({ ok: false, error: 'Give it a title.' });
    expect(store().events).toEqual([]);
  });

  it('stops when the calendar is full', () => {
    useStore.setState({ events: Array.from({ length: MAX_EVENTS }, (_, i) => stored({ id: `e${i}`, start: new Date(2026, 9, 25, 7, 0).toISOString() })) });
    const r = store().addEvent(form());
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/full/);
    expect(store().events).toHaveLength(MAX_EVENTS);
  });
});

describe('events from the AI coach', () => {
  const record = (o = {}) => ({
    id: 'k1', title: 'Easy run', kind: 'run', start: new Date(2026, 9, 21, 6, 30).toISOString(), notes: '', workoutId: null,
    notificationId: null, source: 'coach', remindMinutes: 0, repeat: null, ...o,
  });

  it('adds them as events of the current shape, with the time they were added', () => {
    const kept = store().addEvents([record(), record({ id: 'k2', title: 'Lunch', kind: 'nutrition', remindMinutes: null })]);
    expect(kept.map((e) => e.id)).toEqual(['k1', 'k2']);
    expect(store().events[0]).toMatchObject({ source: 'coach', remindMinutes: 0, repeat: null, doneDates: [], skipDates: [], updatedAt: '2026-10-19T12:00:00.000Z' });
    expect(store().events[1].remindMinutes).toBeNull();
  });

  it('leaves out what is not an event, and one that is already on the calendar', () => {
    store().addEvents([record()]);
    const kept = store().addEvents([record(), null, { id: 'bad' }, record({ id: 'k3' })]);
    expect(kept.map((e) => e.id)).toEqual(['k3']);
    expect(store().events).toHaveLength(2);
  });

  it('adds nothing for nothing', () => {
    expect(store().addEvents(undefined)).toEqual([]);
    expect(store().addEvents([])).toEqual([]);
  });

  it('drops events from long ago, and says they were not kept', () => {
    const kept = store().addEvents([record({ id: 'old', start: new Date(2026, 5, 1, 6, 0).toISOString() }), record()]);
    expect(kept.map((e) => e.id)).toEqual(['k1']);
    expect(titles()).toEqual(['Easy run']);
  });
});

describe('changing events', () => {
  it('replaces an event with the form\'s changes, keeping its id', () => {
    const { event } = store().addEvent(form());
    const r = store().updateEvent(event.id, form({ title: 'Legs', time: '18:00' }));
    expect(r.ok).toBe(true);
    expect(store().events).toHaveLength(1);
    expect(store().events[0]).toMatchObject({ id: event.id, title: 'Legs' });
    expect(new Date(store().events[0].start).getHours()).toBe(18);
  });

  it('keeps the first day of a repeat, whatever day the form says', () => {
    const { event } = store().addEvent(form({ repeat: { every: 'day', until: null } }));
    store().updateEvent(event.id, form({ date: '2026-11-30', repeat: { every: 'day', until: null }, title: 'Daily' }));
    expect(store().events[0].start).toBe(event.start);
    expect(store().events[0].title).toBe('Daily');
  });

  it('moves a single event to another day', () => {
    const { event } = store().addEvent(form());
    store().updateEvent(event.id, form({ date: '2026-10-22' }));
    expect(new Date(store().events[0].start).getDate()).toBe(22);
  });

  it('changes nothing when the form is not right, or the event is gone', () => {
    const { event } = store().addEvent(form());
    expect(store().updateEvent(event.id, form({ title: '' })).ok).toBe(false);
    expect(store().events[0].title).toBe('Leg day');
    expect(store().updateEvent('nope', form())).toEqual({ ok: false, error: 'This event is no longer on your calendar.' });
  });

  it('removes only that event', () => {
    const a = store().addEvent(form()).event;
    store().addEvent(form({ title: 'Other' }));
    store().removeEvent(a.id);
    expect(titles()).toEqual(['Other']);
  });
});

describe('one day of an event', () => {
  it('removes one day of a repeat and leaves the rest', () => {
    const { event } = store().addEvent(form({ repeat: { every: 'day', until: null } }));
    expect(store().skipOccurrence(event.id, '2026-10-22')).toEqual({ ok: true });
    expect(store().events[0].skipDates).toEqual(['2026-10-22']);
  });

  it('removes the whole event when it was not a repeat', () => {
    const { event } = store().addEvent(form());
    store().skipOccurrence(event.id, '2026-10-20');
    expect(store().events).toEqual([]);
  });

  it('ticks a day off and takes it back', () => {
    const { event } = store().addEvent(form({ repeat: { every: 'day', until: null } }));
    expect(store().setOccurrenceDone(event.id, '2026-10-21', true)).toEqual({ ok: true });
    expect(store().events[0].doneDates).toEqual(['2026-10-21']);
    store().setOccurrenceDone(event.id, '2026-10-21', false);
    expect(store().events[0].doneDates).toEqual([]);
  });

  it('will not tick off a day the event is not on, or an event that is gone', () => {
    const { event } = store().addEvent(form());
    expect(store().setOccurrenceDone(event.id, '2026-10-25', true).ok).toBe(false);
    expect(store().events[0].doneDates).toEqual([]);
    expect(store().setOccurrenceDone('nope', '2026-10-20', true).ok).toBe(false);
    expect(store().skipOccurrence('nope', '2026-10-20').ok).toBe(false);
  });
});

describe('saved on the phone', () => {
  const saved = () => {
    const calls = storage.setItem.mock.calls.filter(([key]) => key === 'zown-schedule-storage');
    return JSON.parse(calls[calls.length - 1][1]).state;
  };
  const reload = async (persisted) => {
    jest.resetModules();
    storage = require('@react-native-async-storage/async-storage').default;
    storage.getItem.mockResolvedValue(JSON.stringify({ state: persisted, version: 0 }));
    useStore = require('../store/scheduleStore').useScheduleStore;
    await useStore.persist.rehydrate();
  };

  it('keeps the events and whose they are, under the same key as before, and nothing else', async () => {
    store().addEvent(form());
    await flush();
    expect(Object.keys(saved()).sort()).toEqual(['events', 'ownerUid']);
    expect(saved().events[0]).toMatchObject({ title: 'Leg day' });
  });

  it('leaves out events from long ago', async () => {
    useStore.setState({ events: [stored({ id: 'old', start: new Date(2026, 5, 1, 6, 0).toISOString() }), stored({ id: 'new' })] });
    await flush();
    expect(saved().events.map((e) => e.id)).toEqual(['new']);
  });

  it('brings events saved by an earlier version up to date, with a reminder only where one was set', async () => {
    const old = { id: 'o1', title: 'Old run', kind: 'run', start: new Date(2026, 9, 21, 6, 0).toISOString(), notes: '', workoutId: null, notificationId: 'n1', source: 'coach' };
    await reload({ events: [old, { ...old, id: 'o2', notificationId: null }, { id: 'bad' }, null], syncUid: 'sneaky' });
    expect(store().events.map((e) => [e.id, e.remindMinutes, e.repeat])).toEqual([['o1', 0, null], ['o2', null, null]]);
    expect(store().syncUid).toBeNull();
    expect(store().ownerUid).toBeNull();
  });

  it('starts empty when nothing was saved or what was saved is not a calendar', async () => {
    await useStore.persist.rehydrate();
    expect(store().events).toEqual([]);
    await reload({});
    expect(store().events).toEqual([]);
    await reload({ events: 'x', ownerUid: 7 });
    expect(store().events).toEqual([]);
    expect(store().ownerUid).toBeNull();
  });
});

describe('startSync', () => {
  it('merges the calendar in the cloud into this phone\'s', async () => {
    store().addEvent(form());
    firestore.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ events: [stored()] }) });
    await store().startSync('u1');
    expect(firestore.getDoc).toHaveBeenCalledWith({ path: 'users/u1/data/calendar' });
    expect(titles()).toEqual(['Leg day', 'Cloud run']);
    expect(store().syncUid).toBe('u1');
    expect(store().ownerUid).toBe('u1');
  });

  it('takes events saved before the calendar was backed up as the signed-in person\'s own', async () => {
    store().addEvent(form());
    firestore.getDoc.mockResolvedValue({ exists: () => false });
    await store().startSync('u1');
    expect(titles()).toEqual(['Leg day']);
    expect(warn).not.toHaveBeenCalled();
  });

  it('starts anyway when the cloud can not be reached, and keeps the phone\'s calendar', async () => {
    store().addEvent(form());
    firestore.getDoc.mockRejectedValue(new Error('offline'));
    await store().startSync('u1');
    expect(store().events).toHaveLength(1);
    expect(store().syncUid).toBe('u1');
    expect(warn).toHaveBeenCalledWith('[scheduleStore] load error:', 'offline');
  });

  it('keeps the calendar when the same person starts sync again', async () => {
    firestore.getDoc.mockResolvedValue({ exists: () => false });
    await store().startSync('u1');
    store().addEvent(form());
    await store().startSync('u1');
    expect(titles()).toEqual(['Leg day']);
  });

  it('starts another person who signs in on this phone from their own calendar, and never writes the first person\'s into it', async () => {
    firestore.getDoc.mockResolvedValue({ exists: () => false });
    await store().startSync('u1');
    store().addEvent(form());
    await flush();
    expect(firestore.setDoc).toHaveBeenCalledTimes(1);
    firestore.setDoc.mockClear();

    firestore.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ events: [stored()] }) });
    await store().startSync('u2');
    await flush();
    expect(titles()).toEqual(['Cloud run']);
    expect(store().syncUid).toBe('u2');
    expect(firestore.setDoc.mock.calls.filter(([ref]) => ref.path === 'users/u1/data/calendar')).toHaveLength(0);
    expect(firestore.setDoc.mock.calls.every(([, d]) => d.events.every((e) => e.title === 'Cloud run'))).toBe(true);
  });

  it('does the same after the app was closed in between: events kept for one person are not given to the next', async () => {
    firestore.getDoc.mockResolvedValue({ exists: () => false });
    await store().startSync('u1');
    store().addEvent(form());
    await flush();
    const savedState = JSON.parse(storage.setItem.mock.calls.filter(([k]) => k === 'zown-schedule-storage').pop()[1]).state;

    // The app opens again, and somebody else is signed in.
    jest.resetModules();
    firestore = require('firebase/firestore');
    storage = require('@react-native-async-storage/async-storage').default;
    storage.getItem.mockResolvedValue(JSON.stringify({ state: savedState, version: 0 }));
    useStore = require('../store/scheduleStore').useScheduleStore;
    await useStore.persist.rehydrate();
    expect(titles()).toEqual(['Leg day']);
    expect(store().ownerUid).toBe('u1');

    firestore.getDoc.mockResolvedValue({ exists: () => false });
    await store().startSync('u2');
    await flush();
    expect(store().events).toEqual([]);
    expect(firestore.setDoc).not.toHaveBeenCalled();
  });

  it('does nothing without a user', async () => {
    await store().startSync(undefined);
    await store().startSync('');
    expect(firestore.getDoc).not.toHaveBeenCalled();
    expect(store().syncUid).toBeNull();
  });
});

describe('the cloud copy', () => {
  const start = async () => {
    firestore.getDoc.mockResolvedValue({ exists: () => false });
    await store().startSync('u1');
    await flush();
    firestore.setDoc.mockClear();
  };
  const lastWrite = () => firestore.setDoc.mock.calls[firestore.setDoc.mock.calls.length - 1];

  it('is not written before sync starts', async () => {
    store().addEvent(form());
    await flush();
    expect(firestore.setDoc).not.toHaveBeenCalled();
  });

  it('is not created for a calendar that has always been empty', async () => {
    await start();
    await flush();
    expect(firestore.setDoc).not.toHaveBeenCalled();
  });

  it('is written when the calendar changes, under the person\'s own data', async () => {
    await start();
    store().addEvent(form());
    await flush();
    expect(firestore.setDoc).toHaveBeenCalledTimes(1);
    const [ref, data] = lastWrite();
    expect(ref.path).toBe('users/u1/data/calendar');
    expect(data.events.map((e) => e.title)).toEqual(['Leg day']);
    expect(typeof data.updatedAt).toBe('string');
  });

  it('is written again for each later change, and can end up empty', async () => {
    await start();
    const { event } = store().addEvent(form());
    await flush();
    store().removeEvent(event.id);
    await flush();
    expect(firestore.setDoc).toHaveBeenCalledTimes(2);
    expect(lastWrite()[1].events).toEqual([]);
  });

  it('is not written again when nothing in it changed', async () => {
    await start();
    store().addEvent(form());
    await flush();
    useStore.setState({ syncUid: 'u1' });
    await flush();
    expect(firestore.setDoc).toHaveBeenCalledTimes(1);
  });

  it('leaves out events from long ago', async () => {
    await start();
    useStore.setState({ events: [stored({ id: 'old', start: new Date(2026, 5, 1, 6, 0).toISOString() }), stored({ id: 'new' })] });
    await flush();
    expect(lastWrite()[1].events.map((e) => e.id)).toEqual(['new']);
  });

  it('does not let a write that was waiting for the first person put the new person\'s calendar in the first one\'s', async () => {
    await start();
    store().addEvent(form());
    await flush();
    firestore.setDoc.mockClear();
    // The next write for u1 is slow, and another change queues up behind it.
    let finish;
    firestore.setDoc.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    store().addEvent(form({ title: 'Second' }));
    await flush();
    store().addEvent(form({ title: 'Third' }));
    // u2 signs in while that is still going on.
    firestore.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ events: [stored()] }) });
    await store().startSync('u2');
    await flush();
    finish();
    await flush();
    expect(firestore.setDoc.mock.calls.filter(([ref]) => ref.path === 'users/u1/data/calendar')).toHaveLength(1);
    expect(titles()).toEqual(['Cloud run']);
  });

  it('is tried again at the next change after a failed write', async () => {
    await start();
    firestore.setDoc.mockRejectedValueOnce(new Error('offline'));
    store().addEvent(form());
    await flush();
    expect(warn).toHaveBeenCalledWith('[scheduleStore] sync error:', 'offline');
    store().addEvent(form({ title: 'Second' }));
    await flush();
    expect(lastWrite()[1].events.map((e) => e.title)).toEqual(['Leg day', 'Second']);
  });
});
