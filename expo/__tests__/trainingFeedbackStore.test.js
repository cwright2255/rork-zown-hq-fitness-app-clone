// What the person has told the training engine, and the counters its claims are backed with, kept on the phone and in the cloud
// (store/trainingFeedbackStore.js). The rules and the counting are tested in trainingFeedback.test.js and trainingMeasures.test.js; this is
// what the store does with them: the actions, the copy saved on the phone, and the copy in the cloud (one document, written when things go quiet,
// the later change winning when the two disagree).
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

const NOW = new Date('2026-10-26T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const BENCH = 'barbell-bench-press';
const PATH = 'users/u1/data/trainingFeedback';

let useStore;
let firestore;
let storage;
let warn;
const load = () => {
  jest.resetModules();
  firestore = require('firebase/firestore');
  storage = require('@react-native-async-storage/async-storage').default;
  useStore = require('../store/trainingFeedbackStore').useTrainingFeedbackStore;
  delay = require('../store/trainingFeedbackStore').FEEDBACK_PUSH_DELAY_MS;
};
let delay;
const store = () => useStore.getState();
const flush = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };
// Lets the quiet time pass, and what it sets going finish.
const quiet = async (ms = delay) => { await jest.advanceTimersByTimeAsync(ms); await flush(); };
const writes = () => firestore.setDoc.mock.calls;
const cloud = (over = {}) => ({
  exists: () => true,
  data: () => ({
    feedback: { v: 1, votes: { deadlift: { vote: 'less', at: '2026-10-20T00:00:00.000Z' } }, excluded: {}, swaps: {}, skips: {} },
    measures: { v: 1, since: '2026-10-01T00:00:00.000Z', sessionsStarted: 4, setsWithTarget: 20, setsHitTarget: 15 },
    updatedAt: '2026-10-25T00:00:00.000Z',
    ...over,
  }),
});

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  load();
  firestore.getDoc.mockResolvedValue({ exists: () => false });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe('to begin with', () => {
  it('there is no feedback, no counts, and no sync', () => {
    expect(store().feedback).toEqual({ v: 1, votes: {}, excluded: {}, swaps: {}, skips: {} });
    expect(store().measures).toMatchObject({ v: 1, since: '', sessionsStarted: 0, setsWithTarget: 0 });
    expect(store().updatedAt).toBe('');
    expect(store().syncUid).toBeNull();
  });
});

describe('More and Less', () => {
  it('are held, and the vote now held is handed back', () => {
    expect(store().vote(BENCH, 'more')).toBe('more');
    expect(store().feedback.votes[BENCH]).toEqual({ vote: 'more', at: '2026-10-26T12:00:00.000Z' });
    expect(store().vote(BENCH, 'less')).toBe('less');
    expect(store().feedback.votes[BENCH].vote).toBe('less');
  });

  it('are cleared by the same tap again', () => {
    store().vote(BENCH, 'more');
    expect(store().vote(BENCH, 'more')).toBeNull();
    expect(store().feedback.votes).toEqual({});
  });

  it('note when the phone\'s copy last changed', () => {
    expect(store().updatedAt).toBe('');
    store().vote(BENCH, 'more');
    expect(store().updatedAt).toBe('2026-10-26T12:00:00.000Z');
    jest.setSystemTime(new Date('2026-10-27T09:30:00.000Z'));
    store().vote(BENCH, 'less');
    expect(store().updatedAt).toBe('2026-10-27T09:30:00.000Z');
  });
});

describe('Exclude and Restore', () => {
  it('hold the exercise out until it is restored', () => {
    store().exclude(BENCH, { name: 'Barbell Bench Press', ladder: false });
    expect(store().feedback.excluded[BENCH]).toMatchObject({ name: 'Barbell Bench Press', ladder: false });
    store().restore(BENCH);
    expect(store().feedback.excluded).toEqual({});
    expect(store().updatedAt).toBe('2026-10-26T12:00:00.000Z');
  });
});

describe('swaps and skips', () => {
  it('a swap away is noted against the exercise', () => {
    store().noteSwap(BENCH);
    expect(store().feedback.swaps[BENCH]).toEqual([NOW.getTime()]);
    expect(store().feedback.skips).toEqual({});
  });

  it('the end of an engine workout notes each skipped exercise, and counts the workout and the number skipped', () => {
    store().recordEnd({ cutShort: true, skipped: ['deadlift', 'ladder:push'] });
    expect(store().feedback.skips).toEqual({ deadlift: [NOW.getTime()], 'ladder:push': [NOW.getTime()] });
    expect(store().measures).toMatchObject({ sessionsCutShort: 1, sessionsFinished: 0, exercisesSkipped: 2 });
  });

  it('a workout finished with nothing skipped counts as finished and notes nothing against any exercise', () => {
    store().recordEnd({ cutShort: false, skipped: [] });
    expect(store().feedback.skips).toEqual({});
    expect(store().measures).toMatchObject({ sessionsFinished: 1, sessionsCutShort: 0, exercisesSkipped: 0 });
  });

  it('a workout that was not the engine\'s (no outcome) counts and notes nothing, and does not mark the copy as changed', () => {
    store().recordEnd(null);
    store().recordEnd(undefined);
    expect(store().measures.sessionsFinished).toBe(0);
    expect(store().updatedAt).toBe('');
  });

  it('a skip with nothing to name counts the workout and nothing else', () => {
    store().recordEnd({ cutShort: false });
    expect(store().measures).toMatchObject({ sessionsFinished: 1, exercisesSkipped: 0 });
  });
});

describe('the counts', () => {
  it('Start Workout counts a session, its exercises, and what was swapped and excluded first', () => {
    store().recordStart({ exercises: 5, swapped: 2, excluded: 1 });
    expect(store().measures).toMatchObject({ sessionsStarted: 1, exercisesOffered: 5, exercisesSwapped: 2, exercisesExcluded: 1, since: '2026-10-26T12:00:00.000Z' });
  });

  it('a logged set that had a target counts, and one that hit it counts as a hit', () => {
    store().recordSet(true);
    store().recordSet(false);
    store().recordSet(true);
    expect(store().measures).toMatchObject({ setsWithTarget: 3, setsHitTarget: 2 });
  });
});

describe('saved on the phone', () => {
  const saved = () => {
    const calls = storage.setItem.mock.calls.filter(([key]) => key === 'zown-training-feedback-storage');
    return JSON.parse(calls[calls.length - 1][1]).state;
  };

  it('keeps the feedback, the counts and the time of the last change, under its own key, and nothing about who is signed in', async () => {
    store().vote(BENCH, 'more');
    store().recordSet(true);
    await flush();
    const state = saved();
    expect(Object.keys(state).sort()).toEqual(['feedback', 'measures', 'updatedAt']);
    expect(state.feedback.votes[BENCH].vote).toBe('more');
    expect(state.measures.setsHitTarget).toBe(1);
    expect(state.updatedAt).toBe('2026-10-26T12:00:00.000Z');
  });

  it('leaves out swaps and skips older than 28 days', async () => {
    useStore.setState({ feedback: { v: 1, votes: {}, excluded: {}, swaps: { a: [NOW.getTime() - 40 * DAY, NOW.getTime() - DAY] }, skips: { b: [NOW.getTime() - 29 * DAY] } } });
    await flush();
    expect(saved().feedback.swaps).toEqual({ a: [NOW.getTime() - DAY] });
    expect(saved().feedback.skips).toEqual({});
  });

  it('reads it back, dropping what is wrong and never taking who was signed in from it', async () => {
    jest.resetModules();
    storage = require('@react-native-async-storage/async-storage').default;
    storage.getItem.mockResolvedValue(JSON.stringify({
      state: {
        feedback: { votes: { [BENCH]: { vote: 'more', at: 'x' }, bad: { vote: 'most' } }, excluded: { deadlift: { name: 'Deadlift', ladder: false, at: '' } }, swaps: { a: ['x', 5] } },
        measures: { sessionsStarted: 3, setsWithTarget: -9, setsHitTarget: 'many', since: '2026-10-01T00:00:00.000Z' },
        updatedAt: '2026-10-24T00:00:00.000Z',
        syncUid: 'sneaky',
      },
      version: 0,
    }));
    useStore = require('../store/trainingFeedbackStore').useTrainingFeedbackStore;
    await useStore.persist.rehydrate();
    expect(Object.keys(store().feedback.votes)).toEqual([BENCH]);
    expect(Object.keys(store().feedback.excluded)).toEqual(['deadlift']);
    expect(store().feedback.swaps).toEqual({ a: [5] });
    expect(store().measures).toMatchObject({ sessionsStarted: 3, setsWithTarget: 0, setsHitTarget: 0, since: '2026-10-01T00:00:00.000Z' });
    expect(store().updatedAt).toBe('2026-10-24T00:00:00.000Z');
    expect(store().syncUid).toBeNull();
  });

  it('starts empty when nothing was saved or what was saved is not feedback', async () => {
    await useStore.persist.rehydrate();
    expect(store().feedback.votes).toEqual({});
    expect(store().updatedAt).toBe('');
    storage.getItem.mockResolvedValue(JSON.stringify({ state: { feedback: 'x', measures: 5, updatedAt: 7 }, version: 0 }));
    await useStore.persist.rehydrate();
    expect(store().feedback).toEqual({ v: 1, votes: {}, excluded: {}, swaps: {}, skips: {} });
    expect(store().measures.sessionsStarted).toBe(0);
    expect(store().updatedAt).toBe('');
  });
});

describe('startSync', () => {
  it('reads the one document for this person, and starts sync', async () => {
    await store().startSync('u1');
    expect(firestore.doc).toHaveBeenCalledWith({}, 'users', 'u1', 'data', 'trainingFeedback');
    expect(firestore.getDoc).toHaveBeenCalledWith({ path: PATH });
    expect(store().syncUid).toBe('u1');
  });

  it('takes the cloud copy when it is newer than this phone\'s, all of it, checked', async () => {
    store().vote(BENCH, 'more');
    jest.setSystemTime(new Date('2026-10-26T13:00:00.000Z'));
    firestore.getDoc.mockResolvedValue(cloud({ updatedAt: '2026-10-27T00:00:00.000Z' }));
    await store().startSync('u1');
    expect(Object.keys(store().feedback.votes)).toEqual(['deadlift']);
    expect(store().measures).toMatchObject({ sessionsStarted: 4, setsWithTarget: 20, setsHitTarget: 15 });
    expect(store().updatedAt).toBe('2026-10-27T00:00:00.000Z');
  });

  it('keeps this phone\'s copy when it is newer than the cloud\'s, and writes it to the cloud', async () => {
    store().vote(BENCH, 'more');
    firestore.getDoc.mockResolvedValue(cloud({ updatedAt: '2026-10-25T00:00:00.000Z' }));
    await store().startSync('u1');
    expect(Object.keys(store().feedback.votes)).toEqual([BENCH]);
    expect(store().measures.sessionsStarted).toBe(0);
    await quiet();
    expect(writes()).toHaveLength(1);
    expect(writes()[0][0].path).toBe(PATH);
    expect(Object.keys(writes()[0][1].feedback.votes)).toEqual([BENCH]);
  });

  it('takes a cloud copy on a phone that has nothing of its own', async () => {
    firestore.getDoc.mockResolvedValue(cloud());
    await store().startSync('u1');
    expect(store().measures.sessionsStarted).toBe(4);
  });

  it('checks what the cloud holds: a damaged copy cannot put anything wrong in', async () => {
    firestore.getDoc.mockResolvedValue(cloud({
      feedback: { votes: { a: { vote: 'most' }, [BENCH]: { vote: 'more' } }, swaps: { b: 'x' } },
      measures: { sessionsStarted: -1, setsWithTarget: 'x', setsHitTarget: 3 },
    }));
    await store().startSync('u1');
    expect(Object.keys(store().feedback.votes)).toEqual([BENCH]);
    expect(store().feedback.swaps).toEqual({});
    expect(store().measures).toMatchObject({ sessionsStarted: 0, setsWithTarget: 0, setsHitTarget: 3 });
  });

  it('ignores a cloud copy that has no time on it, or one that is not a document at all', async () => {
    store().vote(BENCH, 'more');
    firestore.getDoc.mockResolvedValue(cloud({ updatedAt: undefined }));
    await store().startSync('u1');
    expect(Object.keys(store().feedback.votes)).toEqual([BENCH]);
    firestore.getDoc.mockResolvedValue({ exists: () => true, data: () => null });
    await store().startSync('u1');
    expect(Object.keys(store().feedback.votes)).toEqual([BENCH]);
  });

  it('does not write back what it has just taken from the cloud', async () => {
    firestore.getDoc.mockResolvedValue(cloud());
    await store().startSync('u1');
    await quiet();
    expect(writes()).toHaveLength(0);
  });

  it('starts anyway when the cloud can not be reached, and keeps the phone\'s copy', async () => {
    store().vote(BENCH, 'more');
    firestore.getDoc.mockRejectedValue(new Error('offline'));
    await store().startSync('u1');
    expect(Object.keys(store().feedback.votes)).toEqual([BENCH]);
    expect(store().syncUid).toBe('u1');
    expect(warn).toHaveBeenCalledWith('[trainingFeedbackStore] load error:', 'offline');
  });

  it('keeps the copy when the same person starts sync again', async () => {
    await store().startSync('u1');
    store().vote(BENCH, 'more');
    await store().startSync('u1');
    expect(Object.keys(store().feedback.votes)).toEqual([BENCH]);
  });

  it('starts another person who signs in on this phone from their own copy, never the last person\'s', async () => {
    await store().startSync('u1');
    store().vote(BENCH, 'more');
    store().recordSet(true);
    firestore.getDoc.mockResolvedValue(cloud());
    await store().startSync('u2');
    expect(store().syncUid).toBe('u2');
    expect(Object.keys(store().feedback.votes)).toEqual(['deadlift']);
    expect(store().measures.setsWithTarget).toBe(20);
  });

  it('starts the next person from nothing when they have nothing in the cloud, and writes nothing for them', async () => {
    await store().startSync('u1');
    store().vote(BENCH, 'more');
    await quiet();
    firestore.setDoc.mockClear();
    await store().startSync('u2');
    await quiet();
    expect(store().feedback.votes).toEqual({});
    expect(store().updatedAt).toBe('');
    expect(writes()).toHaveLength(0);
  });

  it('does not let a write that was waiting for the first person put the next person\'s copy in the first one\'s', async () => {
    await store().startSync('u1');
    store().vote(BENCH, 'more');
    firestore.getDoc.mockResolvedValue(cloud());
    await store().startSync('u2');
    await quiet();
    expect(writes().filter(([ref]) => ref.path === PATH)).toHaveLength(0);
    expect(writes().filter(([ref]) => ref.path === 'users/u2/data/trainingFeedback')).toHaveLength(0);
  });

  it('does not write the next person\'s copy to the first person\'s document when a write for the first person is still queued', async () => {
    await store().startSync('u1');
    store().vote(BENCH, 'more');
    let release;
    firestore.setDoc.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    await quiet(); // the first write is on its way and has not finished
    store().vote('deadlift', 'less');
    await quiet(); // so the second one waits behind it
    await store().startSync('u2');
    store().vote('barbell-row', 'more'); // the next person's own change
    release();
    await quiet();
    const toFirst = writes().filter(([ref]) => ref.path === PATH);
    expect(toFirst).toHaveLength(1); // only the write that was already on its way
    expect(JSON.stringify(toFirst)).not.toContain('barbell-row');
    expect(writes().filter(([ref]) => ref.path === 'users/u2/data/trainingFeedback')).toHaveLength(1);
  });

  it('does nothing without a user', async () => {
    await store().startSync(undefined);
    await store().startSync('');
    expect(firestore.getDoc).not.toHaveBeenCalled();
    expect(store().syncUid).toBeNull();
  });
});

describe('the cloud copy', () => {
  it('is not written before sync has started', async () => {
    store().vote(BENCH, 'more');
    await quiet(delay * 4);
    expect(writes()).toHaveLength(0);
  });

  it('is one document, with the feedback, the counts and the time of the last change', async () => {
    await store().startSync('u1');
    store().vote(BENCH, 'more');
    store().recordSet(true);
    await quiet();
    expect(writes()).toHaveLength(1);
    const [ref, body] = writes()[0];
    expect(ref.path).toBe(PATH);
    expect(Object.keys(body).sort()).toEqual(['feedback', 'measures', 'updatedAt']);
    expect(body.feedback.votes[BENCH].vote).toBe('more');
    expect(body.measures).toMatchObject({ setsWithTarget: 1, setsHitTarget: 1 });
    expect(body.updatedAt).toBe('2026-10-26T12:00:00.000Z');
  });

  it('is written once things have gone quiet, not for every set logged', async () => {
    await store().startSync('u1');
    for (let i = 0; i < 6; i += 1) {
      store().recordSet(true);
      await quiet(delay - 500);
    }
    expect(writes()).toHaveLength(0);
    await quiet(500);
    expect(writes()).toHaveLength(1);
    expect(writes()[0][1].measures.setsWithTarget).toBe(6);
  });

  it('waits 2.5 seconds', async () => {
    expect(delay).toBe(2500);
    await store().startSync('u1');
    store().vote(BENCH, 'less');
    await quiet(delay - 1);
    expect(writes()).toHaveLength(0);
    await quiet(1);
    expect(writes()).toHaveLength(1);
  });

  it('is not written again when nothing new has been said', async () => {
    await store().startSync('u1');
    store().vote(BENCH, 'more');
    await quiet();
    // Changes that leave the feedback and the counts as they were: restoring what was never excluded, an end with no outcome.
    store().restore('never-excluded');
    store().recordEnd(null);
    store().restore('never-excluded');
    await quiet();
    expect(writes()).toHaveLength(1);
  });

  it('is not created for someone who has said and done nothing', async () => {
    await store().startSync('u1');
    await quiet(delay * 3);
    expect(writes()).toHaveLength(0);
  });

  it('is written for someone whose vote was cleared after it was written, so the clearing is not lost', async () => {
    await store().startSync('u1');
    store().vote(BENCH, 'more');
    await quiet();
    store().vote(BENCH, 'more');
    await quiet();
    expect(writes()).toHaveLength(2);
    expect(writes()[1][1].feedback.votes).toEqual({});
  });

  it('leaves out swaps and skips older than 28 days', async () => {
    await store().startSync('u1');
    useStore.setState({ feedback: { v: 1, votes: {}, excluded: {}, swaps: { a: [NOW.getTime() - 40 * DAY, NOW.getTime() - DAY] }, skips: { b: [NOW.getTime() - 29 * DAY] } }, updatedAt: NOW.toISOString() });
    await quiet();
    expect(writes()[0][1].feedback.swaps).toEqual({ a: [NOW.getTime() - DAY] });
    expect(writes()[0][1].feedback.skips).toEqual({});
  });

  it('is sent without anything Firestore refuses: no undefined, whatever was in the state', async () => {
    await store().startSync('u1');
    store().vote(BENCH, 'more');
    await quiet();
    const hasUndefined = (o) => o !== null && typeof o === 'object' ? Object.values(o).some((v) => v === undefined || hasUndefined(v)) : false;
    expect(hasUndefined(writes()[0][1])).toBe(false);
  });

  it('is tried again at the next change after a write fails, and a failure does not break the app', async () => {
    await store().startSync('u1');
    firestore.setDoc.mockRejectedValueOnce(new Error('quota'));
    store().vote(BENCH, 'more');
    await quiet();
    expect(warn).toHaveBeenCalledWith('[trainingFeedbackStore] sync error:', 'quota');
    store().recordSet(false);
    await quiet();
    expect(writes()).toHaveLength(2);
    expect(writes()[1][1].measures.setsWithTarget).toBe(1);
    expect(writes()[1][1].feedback.votes[BENCH].vote).toBe('more');
  });

  it('is written one write at a time, in order', async () => {
    await store().startSync('u1');
    let finish;
    firestore.setDoc.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    store().vote(BENCH, 'more');
    await quiet();
    store().recordSet(true);
    await quiet();
    expect(writes()).toHaveLength(1);
    finish();
    await flush();
    expect(writes()).toHaveLength(2);
    expect(writes()[1][1].measures.setsWithTarget).toBe(1);
  });
});
