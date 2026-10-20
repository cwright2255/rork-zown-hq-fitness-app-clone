// Calendar invites as plain rules (lib/calendarInvites.js). jest.global-setup.js pins the time zone to America/New_York.
import {
  INVITE_STATUSES, MAX_PENDING_SENT, activeInviteFor, buildInvite, canInviteTo, describeInviteWhen, eventFromInvite, incomingInvites,
  inviteStatusLabel, invitesForEvent, isOver, normalizeInvite, pendingSentCount, waitingText,
} from '../lib/calendarInvites';
import { MAX_NOTES, MAX_TITLE, sanitizeEvent } from '../lib/calendarEvents';

// Tue 20 Oct 2026, 10:00 AM in New Jersey
const NOW = new Date(2026, 9, 20, 10, 0);
const at = (d, h, m = 0) => new Date(2026, 9, d, h, m).toISOString();
const alice = { uid: 'alice', name: 'Alice' };
const bob = { uid: 'bob', name: 'Bob' };

const event = (over = {}) => ({
  id: 'evt-1', title: 'Leg day', kind: 'workout', start: at(22, 7), notes: 'Heavy squats', workoutId: 'w-private', repeat: null,
  remindMinutes: 10, doneDates: [], skipDates: [], source: 'user', inviteId: null, host: null, updatedAt: at(19, 9), ...over,
});
const invite = (over = {}) => ({
  id: 'i1', fromUid: 'alice', toUid: 'bob', fromName: 'Alice', toName: 'Bob', status: 'pending', eventId: 'evt-1', title: 'Leg day',
  kind: 'workout', start: at(22, 7), notes: 'Heavy squats', repeat: null, createdAt: at(20, 9), respondedAt: null, ...over,
});

describe('isOver', () => {
  it('is false for a single event that has not started, and for one that started less than an hour ago', () => {
    expect(isOver({ start: at(22, 7), repeat: null }, NOW)).toBe(false);
    expect(isOver({ start: at(20, 9, 30), repeat: null }, NOW)).toBe(false);
    expect(isOver({ start: at(20, 9, 1), repeat: null }, NOW)).toBe(false);
  });

  it('is false at exactly an hour after the start, and true a moment later', () => {
    expect(isOver({ start: at(20, 9, 0), repeat: null }, NOW)).toBe(false);
    expect(isOver({ start: at(20, 9, 0), repeat: null }, new Date(NOW.getTime() + 1))).toBe(true);
  });

  it('is true for a single event that started more than an hour ago', () => {
    expect(isOver({ start: at(20, 8, 59), repeat: null }, NOW)).toBe(true);
    expect(isOver({ start: at(15, 7), repeat: null }, NOW)).toBe(true);
  });

  it('is false for a repeat with no end, even when its first day is long gone', () => {
    expect(isOver({ start: at(1, 7), repeat: { every: 'week', days: [2], until: null } }, NOW)).toBe(false);
  });

  it('is true for a repeat once its last day has passed, and not on that day', () => {
    expect(isOver({ start: at(1, 7), repeat: { every: 'day', until: '2026-10-19' } }, NOW)).toBe(true);
    expect(isOver({ start: at(1, 7), repeat: { every: 'day', until: '2026-10-20' } }, NOW)).toBe(false);
    expect(isOver({ start: at(1, 7), repeat: { every: 'day', until: '2026-10-25' } }, NOW)).toBe(false);
  });

  it('counts something with no usable start as over', () => {
    expect(isOver(null, NOW)).toBe(true);
    expect(isOver({}, NOW)).toBe(true);
    expect(isOver({ start: 'soon' }, NOW)).toBe(true);
  });
});

describe('canInviteTo', () => {
  it('allows one of the person\'s own events that has not happened yet', () => {
    expect(canInviteTo(event(), NOW)).toEqual({ ok: true });
    expect(canInviteTo(event({ source: 'coach' }), NOW)).toEqual({ ok: true });
  });

  it('refuses an event that is over', () => {
    expect(canInviteTo(event({ start: at(10, 7) }), NOW)).toEqual({ ok: false, error: 'That event is already over.' });
  });

  it('allows a repeat that is still going, whatever its first day', () => {
    expect(canInviteTo(event({ start: at(1, 7), repeat: { every: 'week', days: [4], until: null } }), NOW).ok).toBe(true);
  });

  it('refuses somebody else\'s invitation', () => {
    const result = canInviteTo(event({ source: 'invite', inviteId: 'i9', host: { uid: 'carol', name: 'Carol' } }), NOW);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/somebody else/);
  });

  it('refuses something that is not an event', () => {
    for (const bad of [null, undefined, 'x', 5, {}, { title: 'No id', start: at(22, 7) }]) {
      expect(canInviteTo(bad, NOW)).toEqual({ ok: false, error: 'Save the event first, then invite someone.' });
    }
  });
});

describe('buildInvite', () => {
  it('makes the document the rules expect, with everything the invited person needs and nothing private', () => {
    const made = buildInvite({ event: event(), from: alice, to: bob, now: NOW });
    expect(made.ok).toBe(true);
    expect(made.data).toEqual({
      participantIds: ['alice', 'bob'],
      fromUid: 'alice',
      toUid: 'bob',
      fromName: 'Alice',
      toName: 'Bob',
      status: 'pending',
      eventId: 'evt-1',
      title: 'Leg day',
      kind: 'workout',
      start: at(22, 7),
      notes: 'Heavy squats',
      repeat: null,
      createdAt: NOW.toISOString(),
    });
    // The sender's saved workout, reminder and ticked days are theirs alone.
    expect(JSON.stringify(made.data)).not.toMatch(/w-private|remindMinutes|doneDates|workoutId/);
  });

  it('lists the two people in order, whoever is sending', () => {
    expect(buildInvite({ event: event(), from: bob, to: alice, now: NOW }).data.participantIds).toEqual(['alice', 'bob']);
    expect(buildInvite({ event: event(), from: alice, to: bob, now: NOW }).data.participantIds).toEqual(['alice', 'bob']);
  });

  it('carries a repeat along, as a copy', () => {
    const repeat = { every: 'week', days: [2, 4], until: '2026-12-01' };
    const made = buildInvite({ event: event({ repeat }), from: alice, to: bob, now: NOW });
    expect(made.data.repeat).toEqual(repeat);
    expect(made.data.repeat).not.toBe(repeat);
  });

  it('names a person with no name "Zown User", and trims a long one', () => {
    const made = buildInvite({ event: event(), from: { uid: 'alice' }, to: { uid: 'bob', name: '   ' }, now: NOW });
    expect([made.data.fromName, made.data.toName]).toEqual(['Zown User', 'Zown User']);
    expect(buildInvite({ event: event(), from: { uid: 'alice', name: 'A'.repeat(90) }, to: bob, now: NOW }).data.fromName).toHaveLength(60);
  });

  it('refuses when nobody is signed in, nobody is picked, or it is yourself', () => {
    expect(buildInvite({ event: event(), from: null, to: bob, now: NOW })).toEqual({ ok: false, error: 'Sign in to invite someone.' });
    expect(buildInvite({ event: event(), from: { uid: '' }, to: bob, now: NOW }).ok).toBe(false);
    expect(buildInvite({ event: event(), from: alice, to: null, now: NOW })).toEqual({ ok: false, error: 'Pick who to invite.' });
    expect(buildInvite({ event: event(), from: alice, to: { name: 'No uid' }, now: NOW }).ok).toBe(false);
    expect(buildInvite({ event: event(), from: alice, to: alice, now: NOW })).toEqual({ ok: false, error: 'You cannot invite yourself.' });
  });

  it('refuses an event that cannot be shared, with the reason', () => {
    expect(buildInvite({ event: event({ start: at(10, 7) }), from: alice, to: bob, now: NOW })).toEqual({ ok: false, error: 'That event is already over.' });
    expect(buildInvite({ event: null, from: alice, to: bob, now: NOW }).ok).toBe(false);
  });

  it('refuses an event whose id would be too long for the rules', () => {
    expect(buildInvite({ event: event({ id: 'e'.repeat(121) }), from: alice, to: bob, now: NOW }).ok).toBe(false);
    expect(buildInvite({ event: event({ id: 'e'.repeat(120) }), from: alice, to: bob, now: NOW }).ok).toBe(true);
  });
});

describe('normalizeInvite', () => {
  const stored = () => {
    const { id, ...rest } = invite({ participantIds: ['alice', 'bob'] });
    return { id, rest };
  };

  it('gives the app\'s invite, with its id', () => {
    const { id, rest } = stored();
    expect(normalizeInvite(id, rest)).toEqual({
      id: 'i1', fromUid: 'alice', toUid: 'bob', fromName: 'Alice', toName: 'Bob', status: 'pending', eventId: 'evt-1', title: 'Leg day',
      kind: 'workout', start: at(22, 7), notes: 'Heavy squats', repeat: null, createdAt: at(20, 9), respondedAt: null,
    });
  });

  it('keeps the time of an answer', () => {
    const { id, rest } = stored();
    expect(normalizeInvite(id, { ...rest, status: 'accepted', respondedAt: at(20, 11) })).toMatchObject({ status: 'accepted', respondedAt: at(20, 11) });
  });

  it('cleans a repeat the way the calendar does', () => {
    const { id, rest } = stored();
    expect(normalizeInvite(id, { ...rest, repeat: { every: 'week', days: [4, 4, 9], until: null } }).repeat).toEqual({ every: 'week', days: [4], until: null });
    expect(normalizeInvite(id, { ...rest, repeat: { every: 'fortnight' } }).repeat).toBeNull();
    expect(normalizeInvite(id, { ...rest, repeat: 'weekly' }).repeat).toBeNull();
  });

  it('falls back for a status or kind it does not know', () => {
    const { id, rest } = stored();
    expect(normalizeInvite(id, { ...rest, status: 'maybe', kind: 'party' })).toMatchObject({ status: 'pending', kind: 'other' });
  });

  it('gives nothing for a document that is not a usable invite', () => {
    const { id, rest } = stored();
    expect(normalizeInvite('', rest)).toBeNull();
    expect(normalizeInvite(undefined, rest)).toBeNull();
    expect(normalizeInvite(id, null)).toBeNull();
    expect(normalizeInvite(id, 'x')).toBeNull();
    expect(normalizeInvite(id, { ...rest, fromUid: '' })).toBeNull();
    expect(normalizeInvite(id, { ...rest, toUid: undefined })).toBeNull();
    expect(normalizeInvite(id, { ...rest, title: '   ' })).toBeNull();
    expect(normalizeInvite(id, { ...rest, start: 'soon' })).toBeNull();
    expect(normalizeInvite(id, { ...rest, start: undefined })).toBeNull();
  });

  it('tidies a title and notes, and gives empty ones for what is missing', () => {
    const { id, rest } = stored();
    const made = normalizeInvite(id, { ...rest, title: `  ${'T'.repeat(MAX_TITLE + 20)}  `, notes: 'N'.repeat(MAX_NOTES + 20) });
    expect(made.title).toBe('T'.repeat(MAX_TITLE));
    expect(made.notes).toBe('N'.repeat(MAX_NOTES));
    expect(normalizeInvite(id, { ...rest, title: '  Leg day  ' }).title).toBe('Leg day');
    const { notes, eventId, ...bare } = rest;
    expect(normalizeInvite(id, bare)).toMatchObject({ notes: '', eventId: '' });
    expect(normalizeInvite(id, { ...rest, notes: 42, eventId: 42 })).toMatchObject({ notes: '', eventId: '' });
  });

  it('falls back to the time of the event for a send time it cannot read, and to no answer for an answer time it cannot read', () => {
    const { id, rest } = stored();
    expect(normalizeInvite(id, { ...rest, createdAt: undefined }).createdAt).toBe(at(22, 7));
    expect(normalizeInvite(id, { ...rest, createdAt: 'yesterday' }).createdAt).toBe(at(22, 7));
    expect(normalizeInvite(id, { ...rest, respondedAt: 'later' }).respondedAt).toBeNull();
    expect(normalizeInvite(id, { ...rest, respondedAt: undefined }).respondedAt).toBeNull();
  });

  it('knows the four statuses the rules allow', () => {
    expect(INVITE_STATUSES).toEqual(['pending', 'accepted', 'declined', 'cancelled']);
  });
});

describe('eventFromInvite', () => {
  it('makes the invited person\'s own event: an invitation, with who asked, and a reminder at the time', () => {
    const e = eventFromInvite(invite(), NOW);
    expect(e).toEqual({
      id: 'invite-i1', title: 'Leg day', kind: 'workout', start: at(22, 7), notes: 'Heavy squats', workoutId: null, repeat: null,
      remindMinutes: 0, doneDates: [], skipDates: [], source: 'invite', inviteId: 'i1', host: { uid: 'alice', name: 'Alice' },
      updatedAt: NOW.toISOString(),
    });
  });

  it('is a record the calendar keeps as it is', () => {
    const e = eventFromInvite(invite(), NOW);
    expect(sanitizeEvent(e)).toEqual(e);
  });

  it('has an id of its own that comes from the invite, so accepting twice gives the same event', () => {
    expect(eventFromInvite(invite(), NOW).id).toBe(eventFromInvite(invite(), new Date(2026, 9, 21)).id);
    expect(eventFromInvite(invite({ id: 'i2' }), NOW).id).toBe('invite-i2');
  });

  it('gives a meal no reminder, and anything else one at its time', () => {
    expect(eventFromInvite(invite({ kind: 'nutrition' }), NOW).remindMinutes).toBeNull();
    for (const kind of ['workout', 'run', 'other']) expect(eventFromInvite(invite({ kind }), NOW).remindMinutes).toBe(0);
  });

  it('keeps a repeat', () => {
    const repeat = { every: 'week', days: [2], until: '2026-12-01' };
    expect(eventFromInvite(invite({ repeat }), NOW).repeat).toEqual(repeat);
  });

  it('gives nothing when the invite is not usable', () => {
    expect(eventFromInvite(null, NOW)).toBeNull();
    expect(eventFromInvite({}, NOW)).toBeNull();
    expect(eventFromInvite({ title: 'Leg day', kind: 'run', start: at(22, 7), fromUid: 'alice' }, NOW)).toBeNull();
    expect(eventFromInvite(invite({ id: '' }), NOW)).toBeNull();
    expect(eventFromInvite(invite({ title: '' }), NOW)).toBeNull();
    expect(eventFromInvite(invite({ start: 'soon' }), NOW)).toBeNull();
  });
});

describe('incomingInvites', () => {
  it('lists what is waiting for this person, soonest event first', () => {
    const list = [
      invite({ id: 'late', start: at(30, 7) }),
      invite({ id: 'soon', start: at(21, 7) }),
      invite({ id: 'mid', start: at(25, 7) }),
    ];
    expect(incomingInvites(list, 'bob', NOW).map((i) => i.id)).toEqual(['soon', 'mid', 'late']);
  });

  it('breaks a tie on the day by when it was sent', () => {
    const list = [invite({ id: 'b', createdAt: at(20, 9, 30) }), invite({ id: 'a', createdAt: at(20, 9, 1) })];
    expect(incomingInvites(list, 'bob', NOW).map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('leaves out what was sent by the person, sent to someone else, or already answered', () => {
    const list = [
      invite({ id: 'mine', fromUid: 'bob', toUid: 'alice' }),
      invite({ id: 'carol', toUid: 'carol' }),
      invite({ id: 'yes', status: 'accepted' }),
      invite({ id: 'no', status: 'declined' }),
      invite({ id: 'off', status: 'cancelled' }),
      invite({ id: 'open' }),
    ];
    expect(incomingInvites(list, 'bob', NOW).map((i) => i.id)).toEqual(['open']);
  });

  it('leaves out an invite to an event that is over', () => {
    const list = [invite({ id: 'over', start: at(10, 7) }), invite({ id: 'open' })];
    expect(incomingInvites(list, 'bob', NOW).map((i) => i.id)).toEqual(['open']);
  });

  it('is empty with nobody signed in or nothing to list', () => {
    expect(incomingInvites([invite()], null, NOW)).toEqual([]);
    expect(incomingInvites(undefined, 'bob', NOW)).toEqual([]);
    expect(incomingInvites([null, undefined], 'bob', NOW)).toEqual([]);
  });
});

describe('invitesForEvent and activeInviteFor', () => {
  const list = [
    invite({ id: 'a', toUid: 'bob', createdAt: at(20, 9, 1) }),
    invite({ id: 'b', toUid: 'carol', toName: 'Carol', status: 'accepted', createdAt: at(20, 9, 2) }),
    invite({ id: 'c', toUid: 'dave', toName: 'Dave', status: 'declined', createdAt: at(20, 9, 3) }),
    invite({ id: 'd', toUid: 'erin', toName: 'Erin', status: 'cancelled', createdAt: at(20, 9, 4) }),
    invite({ id: 'e', eventId: 'evt-2' }),
    invite({ id: 'f', fromUid: 'zed', toUid: 'bob' }),
  ];

  it('lists what the sender sent for one event, oldest first, without the ones they cancelled', () => {
    expect(invitesForEvent(list, 'alice', 'evt-1').map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('is empty for no sender, no event or no list', () => {
    expect(invitesForEvent(list, null, 'evt-1')).toEqual([]);
    expect(invitesForEvent(list, 'alice', '')).toEqual([]);
    expect(invitesForEvent(null, 'alice', 'evt-1')).toEqual([]);
  });

  it('finds the invite still standing for a person: one waiting, or accepted', () => {
    expect(activeInviteFor(list, 'alice', 'evt-1', 'bob', NOW).id).toBe('a');
    expect(activeInviteFor(list, 'alice', 'evt-1', 'carol', NOW).id).toBe('b');
  });

  it('finds nothing for a person who declined or whose invite was cancelled, so they can be asked again', () => {
    expect(activeInviteFor(list, 'alice', 'evt-1', 'dave', NOW)).toBeNull();
    expect(activeInviteFor(list, 'alice', 'evt-1', 'erin', NOW)).toBeNull();
    expect(activeInviteFor(list, 'alice', 'evt-1', 'nobody', NOW)).toBeNull();
  });

  it('finds nothing for a waiting invite whose event is over, but still finds an accepted one', () => {
    const old = [invite({ id: 'x', start: at(10, 7) }), invite({ id: 'y', toUid: 'carol', status: 'accepted', start: at(10, 7) })];
    expect(activeInviteFor(old, 'alice', 'evt-1', 'bob', NOW)).toBeNull();
    expect(activeInviteFor(old, 'alice', 'evt-1', 'carol', NOW).id).toBe('y');
  });

  it('gives the newest when two invites to the same person are both standing', () => {
    const two = [invite({ id: 'old', status: 'accepted', createdAt: at(19, 9) }), invite({ id: 'new', createdAt: at(20, 9) })];
    expect(activeInviteFor(two, 'alice', 'evt-1', 'bob', NOW).id).toBe('new');
  });

  it('gives the newest when a person was asked more than once', () => {
    const twice = [invite({ id: 'old', status: 'declined', createdAt: at(19, 9) }), invite({ id: 'new', createdAt: at(20, 9) })];
    expect(activeInviteFor(twice, 'alice', 'evt-1', 'bob', NOW).id).toBe('new');
  });
});

describe('pendingSentCount', () => {
  it('counts the invites the person sent that nobody has answered, leaving out old ones', () => {
    const list = [
      invite({ id: '1' }), invite({ id: '2' }), invite({ id: '3', status: 'accepted' }), invite({ id: '4', status: 'cancelled' }),
      invite({ id: '5', start: at(10, 7) }), invite({ id: '6', fromUid: 'bob', toUid: 'alice' }),
    ];
    expect(pendingSentCount(list, 'alice', NOW)).toBe(2);
    expect(pendingSentCount(list, 'bob', NOW)).toBe(1);
    expect(pendingSentCount(list, null, NOW)).toBe(0);
    expect(pendingSentCount(null, 'alice', NOW)).toBe(0);
  });

  it('has a limit that is a sensible number', () => {
    expect(MAX_PENDING_SENT).toBe(50);
  });
});

describe('inviteStatusLabel', () => {
  it('says what the sender sees', () => {
    expect(inviteStatusLabel(invite(), NOW)).toBe('Waiting');
    expect(inviteStatusLabel(invite({ status: 'accepted' }), NOW)).toBe('Going');
    expect(inviteStatusLabel(invite({ status: 'declined' }), NOW)).toBe('Declined');
    expect(inviteStatusLabel(invite({ status: 'cancelled' }), NOW)).toBe('Cancelled');
  });

  it('says Expired for a waiting invite to an event that is over, but not for an answered one', () => {
    expect(inviteStatusLabel(invite({ start: at(10, 7) }), NOW)).toBe('Expired');
    expect(inviteStatusLabel(invite({ start: at(10, 7), status: 'accepted' }), NOW)).toBe('Going');
  });

  it('is empty for nothing', () => {
    expect(inviteStatusLabel(null, NOW)).toBe('');
  });
});

describe('describeInviteWhen', () => {
  it('says the day and the time', () => {
    expect(describeInviteWhen(invite())).toBe('Thu, Oct 22 at 7:00 AM');
    expect(describeInviteWhen(invite({ start: at(22, 18, 5) }))).toBe('Thu, Oct 22 at 6:05 PM');
  });

  it('adds how often it repeats', () => {
    expect(describeInviteWhen(invite({ repeat: { every: 'week', days: [2, 4], until: null } }))).toBe('Thu, Oct 22 at 7:00 AM. Every week on Tue, Thu');
    expect(describeInviteWhen(invite({ repeat: { every: 'day', until: '2026-11-01' } }))).toBe('Thu, Oct 22 at 7:00 AM. Every day until Nov 1');
  });

  it('is empty without a start', () => {
    expect(describeInviteWhen(null)).toBe('');
    expect(describeInviteWhen({ start: 'soon' })).toBe('');
  });
});

describe('waitingText', () => {
  it('says how many invites are waiting', () => {
    expect(waitingText(1)).toBe('1 invite waiting');
    expect(waitingText(2)).toBe('2 invites waiting');
    expect(waitingText(12)).toBe('12 invites waiting');
  });

  it('says nothing for none', () => {
    expect(waitingText(0)).toBe('');
    expect(waitingText(undefined)).toBe('');
    expect(waitingText(-1)).toBe('');
  });
});
