// Sending, listening for, accepting, declining and cancelling calendar invites (store/calendarInviteStore.js), with the cloud faked.
// jest.global-setup.js pins the time zone to America/New_York.
jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((db, ...path) => ({ path: path.join('/') })),
  doc: jest.fn((db, ...path) => ({ path: path.join('/') })),
  query: jest.fn((ref, ...constraints) => ({ ref, constraints })),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  onSnapshot: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  getDoc: jest.fn(async () => ({ exists: () => false })),
  setDoc: jest.fn(async () => undefined),
}));

import { addDoc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { useCalendarInviteStore } from '../store/calendarInviteStore';
import { useScheduleStore } from '../store/scheduleStore';
import { MAX_PENDING_SENT } from '../lib/calendarInvites';
import { MAX_EVENTS } from '../lib/calendarEvents';

// Tue 20 Oct 2026, 10:00 AM in New Jersey
const NOW = new Date(2026, 9, 20, 10, 0);
const at = (d, h, m = 0) => new Date(2026, 9, d, h, m).toISOString();
const alice = { uid: 'alice', name: 'Alice' };
const bob = { uid: 'bob', name: 'Bob' };

const myEvent = (over = {}) => ({
  id: 'evt-1', title: 'Leg day', kind: 'workout', start: at(22, 7), notes: '', workoutId: null, repeat: null, remindMinutes: 0,
  doneDates: [], skipDates: [], source: 'user', inviteId: null, host: null, updatedAt: at(19, 9), ...over,
});
// An invite document as the cloud holds it (no id: that is the document's name).
const stored = (over = {}) => ({
  participantIds: ['alice', 'bob'], fromUid: 'alice', toUid: 'bob', fromName: 'Alice', toName: 'Bob', status: 'pending', eventId: 'evt-1',
  title: 'Leg day', kind: 'workout', start: at(22, 7), notes: '', repeat: null, createdAt: at(20, 9), ...over,
});

let listener;
const unsubscribe = jest.fn();
const emit = (docs) => listener.next({ docs: docs.map(([id, data]) => ({ id, data: () => data })) });
const store = () => useCalendarInviteStore.getState();
const invites = () => store().invites.map((i) => i.id);
const calendar = () => useScheduleStore.getState().events;
const updates = () => updateDoc.mock.calls.map(([ref, data]) => [ref.path, data.status]);

let warn;
beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.clearAllMocks();
  listener = null;
  onSnapshot.mockImplementation((q, next, error) => { listener = { q, next, error }; return unsubscribe; });
  addDoc.mockResolvedValue({ id: 'new-1' });
  updateDoc.mockResolvedValue(undefined);
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  useCalendarInviteStore.getState().unsubscribe();
  unsubscribe.mockClear();
  useScheduleStore.setState({ events: [], ownerUid: null, syncUid: null });
});
afterEach(() => { jest.useRealTimers(); warn.mockRestore(); });

describe('listening', () => {
  it('asks for the invites the person is one of the two people in', () => {
    store().subscribe('bob');
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith({ path: 'calendarInvites' }, { field: 'participantIds', op: 'array-contains', value: 'bob' });
    expect(where).toHaveBeenCalledWith('participantIds', 'array-contains', 'bob');
    expect(store().uid).toBe('bob');
  });

  it('does nothing without a person', () => {
    store().subscribe(null);
    store().subscribe('');
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it('keeps the invites that come, as the app uses them, and leaves out a document that is not an invite', () => {
    store().subscribe('bob');
    emit([['i1', stored()], ['bad', { title: 'no people' }], ['i2', stored({ status: 'accepted', respondedAt: at(20, 9, 30) })]]);
    expect(invites()).toEqual(['i1', 'i2']);
    expect(store().invites[1]).toMatchObject({ id: 'i2', status: 'accepted', fromName: 'Alice', respondedAt: at(20, 9, 30) });
  });

  it('follows the cloud as it changes', () => {
    store().subscribe('bob');
    emit([['i1', stored()]]);
    emit([['i1', stored({ status: 'declined', respondedAt: at(20, 9, 30) })], ['i3', stored()]]);
    expect(store().invites.map((i) => [i.id, i.status])).toEqual([['i1', 'declined'], ['i3', 'pending']]);
  });

  it('does not listen twice for the same person', () => {
    store().subscribe('bob');
    store().subscribe('bob');
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it('stops listening for one person and starts for the next, with none of the first\'s invites left', () => {
    store().subscribe('bob');
    emit([['i1', stored()]]);
    store().subscribe('carol');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(onSnapshot).toHaveBeenCalledTimes(2);
    expect(store().uid).toBe('carol');
    expect(invites()).toEqual([]);
  });

  it('ignores an answer from the cloud that arrives after the person has gone', () => {
    store().subscribe('bob');
    const old = listener;
    store().subscribe('carol');
    old.next({ docs: [{ id: 'i1', data: () => stored() }] });
    expect(invites()).toEqual([]);
  });

  it('forgets everything when the person signs out', () => {
    store().subscribe('bob');
    emit([['i1', stored()]]);
    store().unsubscribe();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(store()).toMatchObject({ invites: [], uid: null });
    store().unsubscribe();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('says so when the cloud refuses without saying why', () => {
    store().subscribe('bob');
    listener.error({});
    expect(store().error).toBe('Could not load invitations.');
    listener.error(undefined);
    expect(store().error).toBe('Could not load invitations.');
  });

  it('tries again to listen when the first attempt could not start', () => {
    onSnapshot.mockImplementationOnce(() => { throw new Error('not ready'); });
    store().subscribe('bob');
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(listener).toBeNull();
    store().subscribe('bob');
    expect(onSnapshot).toHaveBeenCalledTimes(2);
    emit([['i1', stored()]]);
    expect(invites()).toEqual(['i1']);
  });

  it('keeps what it has and records the reason when the cloud refuses', () => {
    store().subscribe('bob');
    emit([['i1', stored()]]);
    listener.error({ message: 'Missing or insufficient permissions.' });
    expect(invites()).toEqual(['i1']);
    expect(store().error).toBe('Missing or insufficient permissions.');
    emit([['i1', stored()]]);
    expect(store().error).toBeNull();
  });
});

describe('sending', () => {
  beforeEach(() => store().subscribe('alice'));

  it('saves the invite, as pending, and says its id', async () => {
    const result = await store().sendInvite({ event: myEvent(), from: alice, to: bob });
    expect(result).toEqual({ ok: true, id: 'new-1' });
    expect(addDoc).toHaveBeenCalledTimes(1);
    expect(addDoc.mock.calls[0][0]).toEqual({ path: 'calendarInvites' });
    expect(addDoc.mock.calls[0][1]).toEqual({
      participantIds: ['alice', 'bob'], fromUid: 'alice', toUid: 'bob', fromName: 'Alice', toName: 'Bob', status: 'pending', eventId: 'evt-1',
      title: 'Leg day', kind: 'workout', start: at(22, 7), notes: '', repeat: null, createdAt: NOW.toISOString(),
    });
  });

  it('writes nothing for an event that cannot be shared, and says why', async () => {
    const result = await store().sendInvite({ event: myEvent({ start: at(10, 7) }), from: alice, to: bob });
    expect(result).toEqual({ ok: false, error: 'That event is already over.' });
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('writes nothing for yourself or for nobody', async () => {
    expect((await store().sendInvite({ event: myEvent(), from: alice, to: alice })).ok).toBe(false);
    expect((await store().sendInvite({ event: myEvent(), from: alice, to: null })).ok).toBe(false);
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('will not invite someone who is already invited to the event, waiting or going', async () => {
    emit([['i1', stored()], ['i2', stored({ toUid: 'carol', toName: 'Carol', participantIds: ['alice', 'carol'], status: 'accepted' })]]);
    expect(await store().sendInvite({ event: myEvent(), from: alice, to: bob })).toEqual({ ok: false, error: 'Bob is already invited to this.' });
    expect((await store().sendInvite({ event: myEvent(), from: alice, to: { uid: 'carol', name: 'Carol' } })).error).toBe('Carol is already invited to this.');
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('will invite someone who declined, or whose invite was cancelled, again, and someone to a different event', async () => {
    emit([['i1', stored({ status: 'declined', respondedAt: at(20, 9, 30) })], ['i2', stored({ eventId: 'evt-9' })]]);
    expect((await store().sendInvite({ event: myEvent(), from: alice, to: bob })).ok).toBe(true);
    emit([['i1', stored({ status: 'cancelled', respondedAt: at(20, 9, 30) })]]);
    expect((await store().sendInvite({ event: myEvent(), from: alice, to: bob })).ok).toBe(true);
    emit([['i2', stored({ eventId: 'evt-9' })]]);
    expect((await store().sendInvite({ event: myEvent(), from: alice, to: bob })).ok).toBe(true);
    expect(addDoc).toHaveBeenCalledTimes(3);
  });

  it('stops at the limit of invites waiting for an answer', async () => {
    emit(Array.from({ length: MAX_PENDING_SENT }, (_, i) => [`p${i}`, stored({ eventId: `evt-${i + 10}`, toUid: `u${i}` })]));
    const result = await store().sendInvite({ event: myEvent(), from: alice, to: bob });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Wait for some replies/);
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('is fine one under the limit', async () => {
    emit(Array.from({ length: MAX_PENDING_SENT - 1 }, (_, i) => [`p${i}`, stored({ eventId: `evt-${i + 10}`, toUid: `u${i}` })]));
    expect((await store().sendInvite({ event: myEvent(), from: alice, to: bob })).ok).toBe(true);
  });

  it('says the person has to be someone they follow when the cloud refuses', async () => {
    addDoc.mockRejectedValue({ code: 'permission-denied', message: 'Missing or insufficient permissions.' });
    const result = await store().sendInvite({ event: myEvent(), from: alice, to: bob });
    expect(result).toEqual({ ok: false, error: 'You can only invite people you follow, and Bob is not on your list.' });
  });

  it('knows a refusal by its message when it has no code', async () => {
    addDoc.mockRejectedValue(new Error('Missing or insufficient permissions.'));
    expect((await store().sendInvite({ event: myEvent(), from: alice, to: bob })).error)
      .toBe('You can only invite people you follow, and Bob is not on your list.');
  });

  it('says to check the connection for any other failure', async () => {
    addDoc.mockRejectedValue(new Error('network'));
    expect(await store().sendInvite({ event: myEvent(), from: alice, to: bob })).toEqual({
      ok: false, error: 'That did not go through. Check your connection and try again.',
    });
  });
});

describe('accepting', () => {
  beforeEach(() => {
    store().subscribe('bob');
    emit([['i1', stored()]]);
  });

  it('puts the event on the person\'s calendar as an invitation from the sender, then tells the sender', async () => {
    const result = await store().acceptInvite('i1');
    expect(result.ok).toBe(true);
    expect(result.event.id).toBe('invite-i1');
    expect(calendar()).toHaveLength(1);
    expect(calendar()[0]).toMatchObject({
      id: 'invite-i1', title: 'Leg day', kind: 'workout', start: at(22, 7), source: 'invite', inviteId: 'i1', host: { uid: 'alice', name: 'Alice' },
      remindMinutes: 0,
    });
    expect(updates()).toEqual([['calendarInvites/i1', 'accepted']]);
    expect(typeof updateDoc.mock.calls[0][1].respondedAt).toBe('string');
    expect(Object.keys(updateDoc.mock.calls[0][1]).sort()).toEqual(['respondedAt', 'status']);
  });

  it('puts the event on the calendar before telling the sender', async () => {
    let onCalendarWhenTold = null;
    updateDoc.mockImplementation(async () => { onCalendarWhenTold = calendar().length; });
    await store().acceptInvite('i1');
    expect(onCalendarWhenTold).toBe(1);
  });

  it('takes the event back off the calendar when the sender cannot be told, and says to try again', async () => {
    updateDoc.mockRejectedValue(new Error('network'));
    const result = await store().acceptInvite('i1');
    expect(result).toEqual({ ok: false, error: 'That did not go through. Check your connection and try again.' });
    expect(calendar()).toEqual([]);
  });

  it('says the invitation is gone when the cloud refuses (it was cancelled), and takes the event back off', async () => {
    updateDoc.mockRejectedValue({ code: 'permission-denied', message: 'Missing or insufficient permissions.' });
    const result = await store().acceptInvite('i1');
    expect(result).toEqual({ ok: false, error: 'That invitation is not open any more. It may have been cancelled.' });
    expect(calendar()).toEqual([]);
  });

  it('can be tried again after a failure, and then works', async () => {
    updateDoc.mockRejectedValueOnce(new Error('network'));
    expect((await store().acceptInvite('i1')).ok).toBe(false);
    expect((await store().acceptInvite('i1')).ok).toBe(true);
    expect(calendar()).toHaveLength(1);
  });

  it('does not put it on twice when it is accepted again (a second phone, a retry), and does not take the first off if telling fails', async () => {
    await store().acceptInvite('i1');
    updateDoc.mockRejectedValueOnce(new Error('network'));
    const again = await store().acceptInvite('i1');
    expect(again.ok).toBe(false);
    expect(calendar()).toHaveLength(1);
    expect((await store().acceptInvite('i1')).ok).toBe(true);
    expect(calendar()).toHaveLength(1);
  });

  it('refuses an invite it does not have, one sent by the person, and one already answered, writing nothing', async () => {
    emit([['i1', stored()], ['mine', stored({ fromUid: 'bob', toUid: 'alice' })], ['done', stored({ status: 'declined' })], ['yes', stored({ status: 'accepted' })]]);
    for (const id of ['nope', 'mine', 'done', 'yes']) {
      expect(await store().acceptInvite(id)).toEqual({ ok: false, error: 'That invitation is not open any more. It may have been cancelled.' });
    }
    expect(calendar()).toEqual([]);
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('refuses an invite to an event that is over, writing nothing', async () => {
    emit([['old', stored({ start: at(10, 7) })]]);
    expect(await store().acceptInvite('old')).toEqual({ ok: false, error: 'That event is already over.' });
    expect(calendar()).toEqual([]);
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('says the calendar is full when it is, and tells no one', async () => {
    useScheduleStore.setState({
      events: Array.from({ length: MAX_EVENTS }, (_, i) => myEvent({ id: `e${i}`, title: `Event ${i}`, start: at(25, 8) })),
    });
    const result = await store().acceptInvite('i1');
    expect(result).toEqual({ ok: false, error: 'Your calendar is full. Remove some events to add more.' });
    expect(calendar()).toHaveLength(MAX_EVENTS);
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('refuses an invite that cannot become an event, writing nothing', async () => {
    useCalendarInviteStore.setState({ invites: [{ ...store().invites[0], title: '' }] });
    expect(await store().acceptInvite('i1')).toEqual({ ok: false, error: 'That invitation is not open any more. It may have been cancelled.' });
    expect(calendar()).toEqual([]);
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('keeps what was already on the calendar', async () => {
    useScheduleStore.setState({ events: [myEvent({ id: 'mine', title: 'My own run', kind: 'run', start: at(21, 6) })] });
    await store().acceptInvite('i1');
    expect(calendar().map((e) => e.id).sort()).toEqual(['invite-i1', 'mine']);
  });

  it('brings a repeat over as it was sent', async () => {
    emit([['rep', stored({ repeat: { every: 'week', days: [2, 4], until: '2026-12-01' } })]]);
    await store().acceptInvite('rep');
    expect(calendar()[0].repeat).toEqual({ every: 'week', days: [2, 4], until: '2026-12-01' });
  });
});

describe('declining', () => {
  beforeEach(() => {
    store().subscribe('bob');
    emit([['i1', stored()], ['mine', stored({ fromUid: 'bob', toUid: 'alice' })], ['yes', stored({ status: 'accepted' })]]);
  });

  it('tells the sender, and puts nothing on the calendar', async () => {
    expect(await store().declineInvite('i1')).toEqual({ ok: true });
    expect(updates()).toEqual([['calendarInvites/i1', 'declined']]);
    expect(typeof updateDoc.mock.calls[0][1].respondedAt).toBe('string');
    expect(calendar()).toEqual([]);
  });

  it('refuses an invite it does not have, one sent by the person, and one already answered, writing nothing', async () => {
    for (const id of ['nope', 'mine', 'yes']) {
      expect(await store().declineInvite(id)).toEqual({ ok: false, error: 'That invitation is not open any more. It may have been cancelled.' });
    }
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('says why when it fails', async () => {
    updateDoc.mockRejectedValueOnce(new Error('network'));
    expect((await store().declineInvite('i1')).error).toBe('That did not go through. Check your connection and try again.');
    updateDoc.mockRejectedValueOnce({ code: 'permission-denied', message: 'denied' });
    expect((await store().declineInvite('i1')).error).toBe('That invitation is not open any more. It may have been cancelled.');
  });
});

describe('cancelling', () => {
  beforeEach(() => {
    store().subscribe('alice');
    emit([['i1', stored()], ['theirs', stored({ fromUid: 'bob', toUid: 'alice' })], ['yes', stored({ status: 'accepted' })]]);
  });

  it('tells the invited person it is off', async () => {
    expect(await store().cancelInvite('i1')).toEqual({ ok: true });
    expect(updates()).toEqual([['calendarInvites/i1', 'cancelled']]);
    expect(typeof updateDoc.mock.calls[0][1].respondedAt).toBe('string');
  });

  it('refuses an invite sent to the person, one already answered, and one it does not have, writing nothing', async () => {
    for (const id of ['theirs', 'yes', 'nope']) {
      expect(await store().cancelInvite(id)).toEqual({ ok: false, error: 'That invitation is not open any more. It may have been cancelled.' });
    }
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('says why when it fails', async () => {
    updateDoc.mockRejectedValueOnce(new Error('network'));
    expect((await store().cancelInvite('i1')).error).toBe('That did not go through. Check your connection and try again.');
  });

  it('says the invitation is not open any more when the cloud refuses (the person answered first)', async () => {
    updateDoc.mockRejectedValueOnce({ code: 'permission-denied', message: 'denied' });
    expect(await store().cancelInvite('i1')).toEqual({ ok: false, error: 'That invitation is not open any more. It may have been cancelled.' });
  });
});
