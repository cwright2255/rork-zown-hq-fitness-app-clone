// The calendar's events as plain functions (lib/calendarEvents.js). jest.global-setup.js pins the time zone to
// America/New_York, so the clocks changing on Sun 1 Nov 2026 can be checked here.
import {
  MAX_EVENTS, MAX_NOTES, MAX_TITLE, MAX_REMINDERS, KEEP_DAYS,
  sanitizeEvent, sanitizeEvents, normalizeRepeat, pruneEvents, mergeEvents, buildEvent, formFromEvent,
  occursOn, occurrenceStart, occurrencesBetween, occurrencesOn, upcomingOccurrences, reminderPlan,
  withDone, withoutOccurrence, occurrenceStatus, weekSummary, goalMarkers, dayMarks,
  kindLabel, describeRepeat, describeReminder, reminderContent, repeatEndKey, clockLabel, shiftTime, dateLabel, monthDay, endsWeeksOf, moveFormDate,
} from '../lib/calendarEvents';

// Mon 19 Oct 2026, 8:00 AM in New York.
const NOW = new Date(2026, 9, 19, 8, 0);
const local = (y, m, d, h = 7, mi = 0) => new Date(y, m - 1, d, h, mi).toISOString();

const ev = (o = {}) => ({
  id: 'e1', title: 'Leg day', kind: 'workout', start: local(2026, 10, 20, 7, 0), notes: '', workoutId: null, repeat: null,
  remindMinutes: null, doneDates: [], skipDates: [], source: 'user', inviteId: null, host: null, updatedAt: '2026-10-01T00:00:00.000Z', ...o,
});
const dates = (list) => list.map((o) => o.date);

describe('sanitizeEvent', () => {
  it('keeps a good event as it is', () => {
    const e = ev({ repeat: { every: 'week', days: [1, 3], until: '2026-12-01' }, remindMinutes: 30, workoutId: 'w1', notes: 'Squats' });
    expect(sanitizeEvent(e)).toEqual(e);
  });

  it('brings a record saved by an earlier version up to date', () => {
    const old = { id: 'old1', title: 'Run', kind: 'run', start: local(2026, 10, 20, 6, 30), notes: '', workoutId: null, notificationId: 'n1', source: 'coach' };
    expect(sanitizeEvent(old)).toMatchObject({ id: 'old1', repeat: null, remindMinutes: 0, doneDates: [], skipDates: [], source: 'coach', inviteId: null, host: null });
    // No notification id: the reminder was never set.
    expect(sanitizeEvent({ ...old, notificationId: null }).remindMinutes).toBeNull();
    // A reminder time chosen now wins over the old marker.
    expect(sanitizeEvent({ ...old, remindMinutes: 60 }).remindMinutes).toBe(60);
    // A reminder that is not one of the choices is no reminder.
    expect(sanitizeEvent({ ...old, notificationId: null, remindMinutes: 7 }).remindMinutes).toBeNull();
  });

  it('gives a record with no change time its first moment as one', () => {
    const e = sanitizeEvent({ id: 'a', title: 'x', start: local(2026, 10, 20, 7, 0) });
    expect(e.updatedAt).toBe(local(2026, 10, 20, 7, 0));
  });

  it.each([
    ['nothing', null],
    ['a string', 'event'],
    ['no id', { title: 'x', start: local(2026, 10, 20) }],
    ['a blank id', { id: '  ', title: 'x', start: local(2026, 10, 20) }],
    ['no title', { id: 'a', start: local(2026, 10, 20) }],
    ['a blank title', { id: 'a', title: '   ', start: local(2026, 10, 20) }],
    ['no start', { id: 'a', title: 'x' }],
    ['a start that is not a date', { id: 'a', title: 'x', start: 'tomorrow' }],
  ])('drops %s', (_, raw) => {
    expect(sanitizeEvent(raw)).toBeNull();
  });

  it('limits what is kept and falls back for what is not recognised', () => {
    const e = sanitizeEvent({
      id: 'a', title: 'T'.repeat(200), start: local(2026, 10, 20), notes: 'n'.repeat(900), kind: 'dance', source: 'hacker',
      host: { uid: 'u9', name: 'N'.repeat(200) }, workoutId: 42, inviteId: '',
    });
    expect(e.title).toHaveLength(MAX_TITLE);
    expect(e.notes).toHaveLength(MAX_NOTES);
    expect(e).toMatchObject({ kind: 'other', source: 'user', workoutId: null, inviteId: null });
    expect(e.host).toEqual({ uid: 'u9', name: 'N'.repeat(60) });
    expect(sanitizeEvent({ id: 'a', title: 'x', start: local(2026, 10, 20), host: { name: 'no uid' } }).host).toBeNull();
  });

  it('keeps only real, sorted, single days in the ticked-off and removed lists', () => {
    const e = sanitizeEvent({ id: 'a', title: 'x', start: local(2026, 10, 20), doneDates: ['2026-10-22', 'nope', '2026-02-30', '2026-10-21', '2026-10-22', 5], skipDates: 'x' });
    expect(e.doneDates).toEqual(['2026-10-21', '2026-10-22']);
    expect(e.skipDates).toEqual([]);
  });
});

describe('sanitizeEvents', () => {
  it('leaves out what is not usable and keeps the first of an id', () => {
    const list = sanitizeEvents([ev(), ev({ title: 'Second with the same id' }), null, { id: 'z' }, ev({ id: 'e2' })]);
    expect(list.map((e) => [e.id, e.title])).toEqual([['e1', 'Leg day'], ['e2', 'Leg day']]);
  });

  it('gives an empty calendar for anything that is not a list', () => {
    expect(sanitizeEvents(undefined)).toEqual([]);
    expect(sanitizeEvents({})).toEqual([]);
  });
});

describe('normalizeRepeat', () => {
  it('is no repeat for anything that is not one', () => {
    expect(normalizeRepeat(null)).toBeNull();
    expect(normalizeRepeat('daily')).toBeNull();
    expect(normalizeRepeat({ every: 'month' })).toBeNull();
  });

  it('keeps a daily repeat and its end', () => {
    expect(normalizeRepeat({ every: 'day', days: [1], until: '2026-12-01' }, '2026-10-20')).toEqual({ every: 'day', until: '2026-12-01' });
    expect(normalizeRepeat({ every: 'day', until: 'later' }, '2026-10-20')).toEqual({ every: 'day', until: null });
  });

  it('keeps the chosen days of a weekly repeat, once each and in order', () => {
    expect(normalizeRepeat({ every: 'week', days: [5, 1, 1, 9, -1, 'x'], until: null }, '2026-10-20')).toEqual({ every: 'week', days: [1, 5], until: null });
  });

  it('puts a weekly repeat with no days on the weekday of the first day', () => {
    expect(normalizeRepeat({ every: 'week' }, '2026-10-20')).toEqual({ every: 'week', days: [2], until: null });
  });

  it('does not end a repeat before it starts', () => {
    expect(normalizeRepeat({ every: 'day', until: '2026-10-01' }, '2026-10-20').until).toBe('2026-10-20');
  });
});

describe('buildEvent', () => {
  const form = (o = {}) => ({ title: 'Leg day', kind: 'workout', date: '2026-10-20', time: '07:00', notes: '', remindMinutes: 30, ...o });

  it('makes an event from the form, at the time on the person\'s own clock', () => {
    const r = buildEvent(form({ notes: ' Squats ', title: '  Leg day  ' }), { now: NOW, id: 'x1' });
    expect(r.ok).toBe(true);
    expect(r.event).toMatchObject({
      id: 'x1', title: 'Leg day', kind: 'workout', notes: 'Squats', repeat: null, remindMinutes: 30,
      doneDates: [], skipDates: [], source: 'user', inviteId: null, host: null, updatedAt: NOW.toISOString(),
    });
    expect(r.event.start).toBe(local(2026, 10, 20, 7, 0));
  });

  it('gives each new event its own id', () => {
    const a = buildEvent(form()).event;
    const b = buildEvent(form()).event;
    expect(a.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });

  it.each([
    ['no title', { title: '  ' }, 'Give it a title.'],
    ['a title that is too long', { title: 'x'.repeat(MAX_TITLE + 1) }, 'Keep the title under'],
    ['a day that is not real', { date: '2026-02-30' }, 'Pick a real day.'],
    ['no day', { date: '' }, 'Pick a real day.'],
    ['a time that is not one', { time: '25:00' }, 'Pick a time.'],
    ['minutes that are not', { time: '07:75' }, 'Pick a time.'],
    ['no time', { time: undefined }, 'Pick a time.'],
    ['notes that are too long', { notes: 'x'.repeat(MAX_NOTES + 1) }, 'Keep the notes under'],
    ['a reminder time that is not offered', { remindMinutes: 7 }, 'Pick one of the reminder times.'],
    ['a repeat that is not one', { repeat: { every: 'year' } }, 'Pick how often it repeats.'],
    ['a repeat that ends before it starts', { repeat: { every: 'day', until: '2026-10-01' } }, 'ends before the first day'],
  ])('refuses %s', (_, change, message) => {
    const r = buildEvent(form(change));
    expect(r.ok).toBe(false);
    expect(r.error).toContain(message);
  });

  it('refuses a form that is not there', () => {
    expect(buildEvent(null).ok).toBe(false);
  });

  it('takes no reminder as none, and every offered time as itself', () => {
    expect(buildEvent(form({ remindMinutes: null })).event.remindMinutes).toBeNull();
    expect(buildEvent(form({ remindMinutes: undefined })).event.remindMinutes).toBeNull();
    [0, 10, 30, 60, 1440].forEach((m) => expect(buildEvent(form({ remindMinutes: m })).event.remindMinutes).toBe(m));
  });

  it('keeps a workout link only on a workout', () => {
    expect(buildEvent(form({ workoutId: 'w1' })).event.workoutId).toBe('w1');
    expect(buildEvent(form({ kind: 'run', workoutId: 'w1' })).event.workoutId).toBeNull();
    expect(buildEvent(form({ kind: 'nope' })).event.kind).toBe('other');
  });

  it('makes a weekly repeat on the weekday of the first day when none are chosen', () => {
    expect(buildEvent(form({ repeat: { every: 'week', days: [] } })).event.repeat).toEqual({ every: 'week', days: [2], until: null });
  });

  describe('editing', () => {
    const previous = ev({ id: 'keep', doneDates: ['2026-10-20'], skipDates: ['2026-10-27'], source: 'coach', inviteId: 'inv1', host: { uid: 'h', name: 'Hana' }, repeat: { every: 'week', days: [2], until: null } });

    it('keeps the id, who it came from, and the days ticked off and removed', () => {
      const r = buildEvent(form({ title: 'Legs', repeat: { every: 'week', days: [2], until: null } }), { previous, now: NOW });
      expect(r.event).toMatchObject({ id: 'keep', title: 'Legs', source: 'coach', inviteId: 'inv1', host: { uid: 'h', name: 'Hana' }, doneDates: ['2026-10-20'], skipDates: ['2026-10-27'] });
    });

    it('starts the ticked-off and removed days again when the first day moves', () => {
      const r = buildEvent(form({ date: '2026-10-22' }), { previous, now: NOW });
      expect(r.event.doneDates).toEqual([]);
      expect(r.event.skipDates).toEqual([]);
    });

    it('keeps them when only the time changes', () => {
      const r = buildEvent(form({ time: '18:30' }), { previous, now: NOW });
      expect(r.event.doneDates).toEqual(['2026-10-20']);
    });
  });
});

describe('formFromEvent', () => {
  it('gives the form what the event holds, and builds back into the same event', () => {
    const e = ev({ notes: 'Heavy', workoutId: 'w1', remindMinutes: 60, repeat: { every: 'week', days: [2, 4], until: '2026-12-01' } });
    const f = formFromEvent(e);
    expect(f).toEqual({ title: 'Leg day', kind: 'workout', date: '2026-10-20', time: '07:00', notes: 'Heavy', workoutId: 'w1', repeat: { every: 'week', days: [2, 4], until: '2026-12-01' }, remindMinutes: 60 });
    const back = buildEvent(f, { previous: e, now: new Date(e.updatedAt) }).event;
    expect(back).toEqual(e);
  });

  it('pads the hour and minute, in the evening too', () => {
    expect(formFromEvent(ev({ start: local(2026, 10, 20, 5, 5) })).time).toBe('05:05');
    expect(formFromEvent(ev({ start: local(2026, 10, 20, 19, 45) })).time).toBe('19:45');
  });
});

describe('occursOn', () => {
  it('puts a single event on its day only', () => {
    const e = ev();
    expect(occursOn(e, '2026-10-20')).toBe(true);
    expect(occursOn(e, '2026-10-19')).toBe(false);
    expect(occursOn(e, '2026-10-21')).toBe(false);
  });

  it('puts a daily repeat on every day from the first, until the last', () => {
    const e = ev({ repeat: { every: 'day', until: '2026-10-23' } });
    expect(occursOn(e, '2026-10-19')).toBe(false);
    expect(['2026-10-20', '2026-10-21', '2026-10-23'].map((k) => occursOn(e, k))).toEqual([true, true, true]);
    expect(occursOn(e, '2026-10-24')).toBe(false);
  });

  it('puts a weekly repeat on its chosen weekdays', () => {
    const e = ev({ repeat: { every: 'week', days: [2, 4], until: null } }); // Tue, Thu
    expect(['2026-10-20', '2026-10-22', '2026-10-27'].map((k) => occursOn(e, k))).toEqual([true, true, true]);
    expect(['2026-10-21', '2026-10-23', '2026-10-24'].map((k) => occursOn(e, k))).toEqual([false, false, false]);
  });

  it('leaves out a day that was removed', () => {
    const e = ev({ repeat: { every: 'day', until: null }, skipDates: ['2026-10-22'] });
    expect(occursOn(e, '2026-10-22')).toBe(false);
    expect(occursOn(e, '2026-10-23')).toBe(true);
  });

  it('is false for a day that is not one', () => {
    expect(occursOn(ev(), 'x')).toBe(false);
    expect(occursOn(ev(), undefined)).toBe(false);
  });
});

describe('occurrencesBetween', () => {
  it('lists a single event once, with what the calendar needs about the day', () => {
    const [o] = occurrencesBetween([ev({ doneDates: ['2026-10-20'] })], '2026-10-19', '2026-10-25');
    expect(o).toMatchObject({ key: 'e1@2026-10-20', eventId: 'e1', date: '2026-10-20', start: local(2026, 10, 20, 7, 0), recurring: false, done: true, title: 'Leg day' });
  });

  it('lists a repeat on each of its days, in time order across events', () => {
    const list = occurrencesBetween([
      ev({ id: 'late', title: 'Stretch', start: local(2026, 10, 19, 21, 0), repeat: { every: 'day', until: null } }),
      ev({ id: 'early', start: local(2026, 10, 19, 7, 0), repeat: { every: 'week', days: [1, 3], until: null } }),
    ], '2026-10-19', '2026-10-22');
    expect(list.map((o) => o.key)).toEqual(['early@2026-10-19', 'late@2026-10-19', 'late@2026-10-20', 'early@2026-10-21', 'late@2026-10-21', 'late@2026-10-22']);
    expect(list.every((o) => o.recurring)).toBe(true);
  });

  it('orders events at the same moment by title', () => {
    const list = occurrencesBetween([ev({ id: 'b', title: 'B' }), ev({ id: 'a', title: 'A' })], '2026-10-20', '2026-10-20');
    expect(list.map((o) => o.title)).toEqual(['A', 'B']);
  });

  it('keeps to the days asked for', () => {
    const e = ev({ repeat: { every: 'day', until: null } });
    expect(dates(occurrencesBetween([e], '2026-10-22', '2026-10-24'))).toEqual(['2026-10-22', '2026-10-23', '2026-10-24']);
    expect(occurrencesBetween([e], '2026-10-01', '2026-10-19')).toEqual([]);
  });

  it('gives nothing for days that are not a range', () => {
    const e = ev();
    expect(occurrencesBetween([e], '2026-10-25', '2026-10-19')).toEqual([]);
    expect(occurrencesBetween([e], 'a', 'b')).toEqual([]);
    expect(occurrencesBetween(undefined, '2026-10-19', '2026-10-25')).toEqual([]);
  });

  it('does not run on without end for a repeat that never ends', () => {
    const e = ev({ repeat: { every: 'day', until: null } });
    expect(occurrencesBetween([e], '2026-10-20', '2030-10-20').length).toBeLessThanOrEqual(401);
  });

  it('keeps the same hour and minute when the clocks change', () => {
    const e = ev({ start: local(2026, 10, 30, 7, 0), repeat: { every: 'day', until: null } });
    const list = occurrencesBetween([e], '2026-10-30', '2026-11-03');
    expect(list).toHaveLength(5);
    list.forEach((o) => {
      expect(new Date(o.start).getHours()).toBe(7);
      expect(new Date(o.start).getMinutes()).toBe(0);
    });
    // 7:00 AM is 11:00 UTC before the clocks go back on 1 Nov and 12:00 UTC after.
    expect(list.map((o) => new Date(o.start).getUTCHours())).toEqual([11, 11, 12, 12, 12]);
  });

  it('uses the event\'s own start on its first day', () => {
    const e = ev({ repeat: { every: 'day', until: null } });
    expect(occurrenceStart(e, '2026-10-20')).toBe(e.start);
    expect(occurrenceStart(e, '2026-10-21')).toBe(local(2026, 10, 21, 7, 0));
  });

  it('has occurrencesOn for one day', () => {
    expect(dates(occurrencesOn([ev()], '2026-10-20'))).toEqual(['2026-10-20']);
    expect(occurrencesOn([ev()], '2026-10-21')).toEqual([]);
  });
});

describe('upcomingOccurrences', () => {
  const list = [
    ev({ id: 'a', title: 'A', start: local(2026, 10, 19, 7, 30) }), // 30 minutes ago
    ev({ id: 'b', title: 'B', start: local(2026, 10, 19, 5, 0) }), // 3 hours ago
    ev({ id: 'c', title: 'C', start: local(2026, 10, 19, 18, 0), repeat: { every: 'day', until: null } }),
    ev({ id: 'd', title: 'D', start: local(2026, 10, 25, 9, 0) }),
  ];

  it('lists what is next, with one that started in the last hour still counted and earlier ones left out', () => {
    const next = upcomingOccurrences(list, NOW, 10);
    expect(next.slice(0, 3).map((o) => o.key)).toEqual(['a@2026-10-19', 'c@2026-10-19', 'c@2026-10-20']);
    expect(next.some((o) => o.eventId === 'b')).toBe(false);
  });

  it('stops at the limit', () => {
    expect(upcomingOccurrences(list, NOW, 2)).toHaveLength(2);
  });

  it('leaves out what is already ticked off', () => {
    const done = [ev({ id: 'a', start: local(2026, 10, 19, 9, 0), doneDates: ['2026-10-19'] })];
    expect(upcomingOccurrences(done, NOW, 5)).toEqual([]);
  });

  it('looks only so far ahead', () => {
    const far = [ev({ id: 'far', start: local(2027, 3, 1, 9, 0) })];
    expect(upcomingOccurrences(far, NOW, 5)).toEqual([]);
  });
});

describe('reminderPlan', () => {
  it('sets each reminder at the time before the event it was asked for', () => {
    const plan = reminderPlan([
      ev({ id: 'a', start: local(2026, 10, 20, 7, 0), remindMinutes: 30 }),
      ev({ id: 'b', start: local(2026, 10, 20, 12, 0), remindMinutes: 0 }),
      ev({ id: 'c', start: local(2026, 10, 22, 9, 0), remindMinutes: 1440 }),
    ], NOW);
    expect(plan.map((p) => [p.eventId, p.fireAt.toISOString()])).toEqual([
      ['c', local(2026, 10, 21, 9, 0)],
      ['a', local(2026, 10, 20, 6, 30)],
      ['b', local(2026, 10, 20, 12, 0)],
    ].sort((x, y) => (x[1] < y[1] ? -1 : 1)));
    expect(plan[0]).toMatchObject({ key: expect.stringContaining('@'), title: expect.any(String), minutes: expect.any(Number) });
  });

  it('leaves out events with no reminder, ticked off days, and reminders already past', () => {
    const plan = reminderPlan([
      ev({ id: 'none', remindMinutes: null }),
      ev({ id: 'done', remindMinutes: 0, doneDates: ['2026-10-20'] }),
      ev({ id: 'past', start: local(2026, 10, 19, 8, 20), remindMinutes: 30 }), // reminder was due at 7:50, event is at 8:20
      ev({ id: 'later', start: local(2026, 10, 19, 20, 0), remindMinutes: 0 }),
    ], NOW);
    expect(plan.map((p) => p.eventId)).toEqual(['later']);
  });

  it('plans each day of a repeat, and not the days removed from it', () => {
    const plan = reminderPlan([ev({ start: local(2026, 10, 20, 7, 0), remindMinutes: 10, repeat: { every: 'day', until: '2026-10-23' }, skipDates: ['2026-10-21'] })], NOW);
    expect(plan.map((p) => p.key)).toEqual(['e1@2026-10-20', 'e1@2026-10-22', 'e1@2026-10-23']);
  });

  it('never plans more than the limit, soonest first', () => {
    const plan = reminderPlan([ev({ remindMinutes: 0, repeat: { every: 'day', until: null } })], NOW);
    expect(plan).toHaveLength(MAX_REMINDERS);
    expect(plan[0].key).toBe('e1@2026-10-20');
    expect(plan[MAX_REMINDERS - 1].key).toBe('e1@2026-11-18');
    expect(reminderPlan([ev({ remindMinutes: 0, repeat: { every: 'day', until: null } })], NOW, { limit: 3 })).toHaveLength(3);
  });

  it('does not plan beyond two months ahead', () => {
    expect(reminderPlan([ev({ start: local(2027, 2, 1, 9, 0), remindMinutes: 0 })], NOW)).toEqual([]);
  });
});

describe('ticking off and removing', () => {
  it('ticks a day off and takes the tick back, keeping the days in order', () => {
    const e = ev({ repeat: { every: 'day', until: null }, doneDates: ['2026-10-22'] });
    const a = withDone(e, '2026-10-20', true, NOW);
    expect(a.doneDates).toEqual(['2026-10-20', '2026-10-22']);
    expect(a.updatedAt).toBe(NOW.toISOString());
    expect(withDone(a, '2026-10-20', false, NOW).doneDates).toEqual(['2026-10-22']);
    expect(withDone(a, '2026-10-20', true, NOW).doneDates).toEqual(['2026-10-20', '2026-10-22']);
  });

  it('removes one day of a repeat and what was ticked off on it', () => {
    const e = ev({ repeat: { every: 'day', until: null }, doneDates: ['2026-10-21'] });
    const next = withoutOccurrence(e, '2026-10-21', NOW);
    expect(next.skipDates).toEqual(['2026-10-21']);
    expect(next.doneDates).toEqual([]);
    expect(occursOn(next, '2026-10-21')).toBe(false);
    expect(occursOn(next, '2026-10-22')).toBe(true);
  });

  it('gives nothing back when the only day of an event is removed', () => {
    expect(withoutOccurrence(ev(), '2026-10-20', NOW)).toBeNull();
  });

  it('changes nothing for a day the repeat is not on', () => {
    const e = ev({ repeat: { every: 'week', days: [2], until: null } });
    expect(withoutOccurrence(e, '2026-10-21', NOW)).toBe(e);
  });
});

describe('occurrenceStatus', () => {
  const run = { kind: 'run', date: '2026-10-20', done: false };

  it('counts a workout or run as done when it was logged that day, even if it was not ticked off', () => {
    expect(occurrenceStatus(run, new Set(['2026-10-20']), '2026-10-22')).toEqual({ tracked: true, done: true, missed: false });
    expect(occurrenceStatus({ ...run, kind: 'workout' }, ['2026-10-20'], '2026-10-22').done).toBe(true);
  });

  it('counts it as done when it was ticked off', () => {
    expect(occurrenceStatus({ ...run, done: true }, new Set(), '2026-10-22')).toEqual({ tracked: true, done: true, missed: false });
  });

  it('counts it as missed once the day has passed with nothing logged, and not before', () => {
    expect(occurrenceStatus(run, new Set(), '2026-10-22').missed).toBe(true);
    expect(occurrenceStatus(run, new Set(), '2026-10-20').missed).toBe(false);
    expect(occurrenceStatus(run, new Set(), '2026-10-19').missed).toBe(false);
  });

  it('only ticks off a meal or any other event, and never calls it missed', () => {
    expect(occurrenceStatus({ kind: 'nutrition', date: '2026-10-01', done: false }, new Set(['2026-10-01']), '2026-10-22')).toEqual({ tracked: false, done: false, missed: false });
    expect(occurrenceStatus({ kind: 'other', date: '2026-10-01', done: true }, new Set(), '2026-10-22')).toEqual({ tracked: false, done: true, missed: false });
  });

  it('copes with no active days', () => {
    expect(occurrenceStatus(run, undefined, '2026-10-19').done).toBe(false);
  });
});

describe('weekSummary', () => {
  // The week of Mon 19 to Sun 25 Oct, on Thu 22.
  const events = [
    ev({ id: 'w', title: 'Lift', start: local(2026, 10, 19, 7, 0), repeat: { every: 'day', until: '2026-10-25' }, doneDates: ['2026-10-21'] }),
    ev({ id: 'r', title: 'Run', kind: 'run', start: local(2026, 10, 21, 6, 0) }),
    ev({ id: 'm', title: 'Lunch', kind: 'nutrition', start: local(2026, 10, 22, 12, 0) }),
    ev({ id: 'o', title: 'Dentist', kind: 'other', start: local(2026, 10, 23, 9, 0) }),
    ev({ id: 'later', title: 'Next week', start: local(2026, 10, 28, 7, 0) }),
  ];

  it('counts the workouts and runs of the week as done, missed and still to come', () => {
    const s = weekSummary(events, '2026-10-22', new Set(['2026-10-19', '2026-10-20']), '2026-10-22');
    expect(s).toEqual({ planned: 8, done: 3, missed: 1, remaining: 4, percent: 38, meals: 1 });
  });

  it('is the same whichever day of the week is asked about', () => {
    const a = weekSummary(events, '2026-10-19', new Set(), '2026-10-22');
    const b = weekSummary(events, '2026-10-25', new Set(), '2026-10-22');
    expect(a).toEqual(b);
  });

  it('is empty for a week with nothing planned, or a day that is not one', () => {
    expect(weekSummary([], '2026-10-22', new Set(), '2026-10-22')).toEqual({ planned: 0, done: 0, missed: 0, remaining: 0, percent: 0, meals: 0 });
    expect(weekSummary(events, 'x', new Set(), '2026-10-22').planned).toBe(0);
  });
});

describe('goalMarkers', () => {
  const goals = [
    { id: 'g1', title: 'Run 50 km', deadline: '2026-11-15', current: 20, target: 50, unit: 'km' },
    { id: 'g2', title: 'Lose 5 lb', deadline: '2026-10-10T00:00:00.000Z', current: 6, target: 5, unit: 'lb' },
    { id: 'g3', title: 'No date' },
    { id: 'g4', title: 'Done', deadline: '2026-11-01', completed: true },
    { id: 'g5', title: 'Bad date', deadline: 'soon' },
    null,
  ];

  it('lists the goals with a deadline, soonest first, with how far along each is', () => {
    const m = goalMarkers(goals, '2026-10-19');
    expect(m.map((g) => g.id)).toEqual(['g2', 'g1']);
    expect(m[1]).toEqual({ id: 'g1', title: 'Run 50 km', date: '2026-11-15', current: 20, target: 50, unit: 'km', percent: 40, overdue: false });
  });

  it('caps the progress at 100 and marks a deadline that has passed', () => {
    const [g2] = goalMarkers(goals, '2026-10-19');
    expect(g2.percent).toBe(100);
    expect(g2.overdue).toBe(true);
  });

  it('does not call a goal overdue on its deadline day', () => {
    const [g] = goalMarkers([{ id: 'g', title: 'x', deadline: '2026-10-19', current: 0, target: 5 }], '2026-10-19');
    expect(g.overdue).toBe(false);
    expect(goalMarkers([{ id: 'g', title: 'x', deadline: '2026-10-19', current: 0, target: 5 }], '2026-10-20')[0].overdue).toBe(true);
  });

  it('copes with no goals and with numbers that are not numbers', () => {
    expect(goalMarkers(undefined)).toEqual([]);
    expect(goalMarkers([{ id: 'x', deadline: '2026-11-01', current: 'a', target: 'b' }], '2026-10-19')[0]).toMatchObject({ title: 'Goal', current: 0, target: 0, percent: 0 });
  });
});

describe('dayMarks', () => {
  it('says what is on each day of the month, from the calendar, the meal plan and the goals', () => {
    const marks = dayMarks({
      events: [
        ev({ id: 'a', start: local(2026, 10, 20, 7, 0) }),
        ev({ id: 'b', kind: 'nutrition', start: local(2026, 10, 22, 12, 0) }),
        ev({ id: 'c', kind: 'other', start: local(2026, 10, 27, 9, 0) }),
        ev({ id: 'd', kind: 'run', start: local(2026, 11, 2, 9, 0) }),
      ],
      mealDates: ['2026-10-23', '2026-10-22', '2026-11-01', '2026-09-30'],
      goals: [{ date: '2026-10-25' }, { date: '2026-10-20' }, { date: '2026-12-01' }],
    }, 2026, 9);
    const plain = Object.fromEntries([...marks.entries()].map(([d, m]) => [d, Object.keys(m).filter((k) => m[k])]));
    expect(plain).toEqual({ 20: ['workout', 'goal'], 22: ['meal'], 23: ['meal'], 25: ['goal'], 27: ['other'] });
  });

  it('shows each day of a repeat', () => {
    const marks = dayMarks({ events: [ev({ repeat: { every: 'week', days: [2], until: null } })], mealDates: [], goals: [] }, 2026, 9);
    expect([...marks.keys()]).toEqual([20, 27]);
  });

  it('copes with nothing at all', () => {
    expect(dayMarks({}, 2026, 9).size).toBe(0);
  });
});

describe('pruneEvents', () => {
  it('drops single events and ended repeats from long ago, and keeps what is recent, coming, or still repeating', () => {
    const old = new Date(NOW.getTime() - (KEEP_DAYS + 5) * 24 * 3600 * 1000);
    const recent = new Date(NOW.getTime() - 10 * 24 * 3600 * 1000);
    const list = pruneEvents([
      ev({ id: 'old', start: old.toISOString() }),
      ev({ id: 'recent', start: recent.toISOString() }),
      ev({ id: 'future' }),
      ev({ id: 'ended', start: old.toISOString(), repeat: { every: 'day', until: '2026-07-01' } }),
      ev({ id: 'running', start: old.toISOString(), repeat: { every: 'day', until: null } }),
    ], NOW.getTime());
    expect(list.map((e) => e.id).sort()).toEqual(['future', 'recent', 'running']);
  });

  it('drops ticked-off and removed days from long ago', () => {
    const e = ev({ repeat: { every: 'day', until: null }, doneDates: ['2026-01-01', '2026-10-20'], skipDates: ['2026-01-02', '2026-10-21'] });
    const [kept] = pruneEvents([e], NOW.getTime());
    expect(kept.doneDates).toEqual(['2026-10-20']);
    expect(kept.skipDates).toEqual(['2026-10-21']);
  });

  it('keeps at most the limit, and sheds the oldest single events first', () => {
    const many = Array.from({ length: MAX_EVENTS + 5 }, (_, i) => ev({ id: `e${i}`, start: new Date(2026, 9, 20, 7, i).toISOString() }));
    many.push(ev({ id: 'series', start: new Date(2026, 9, 1, 7, 0).toISOString(), repeat: { every: 'day', until: null } }));
    const kept = pruneEvents(many, NOW.getTime());
    expect(kept).toHaveLength(MAX_EVENTS);
    expect(kept.some((e) => e.id === 'series')).toBe(true);
    expect(kept.some((e) => e.id === 'e0')).toBe(false);
    expect(kept.some((e) => e.id === `e${MAX_EVENTS + 4}`)).toBe(true);
  });
});

describe('mergeEvents', () => {
  it('has every event of both copies', () => {
    const merged = mergeEvents([ev({ id: 'a' })], [ev({ id: 'b' })]);
    expect(merged.map((e) => e.id).sort()).toEqual(['a', 'b']);
  });

  it('takes the copy changed last for an event in both, and this phone\'s when they are equal', () => {
    const mine = ev({ title: 'Mine', updatedAt: '2026-10-10T00:00:00.000Z' });
    const newer = ev({ title: 'Newer', updatedAt: '2026-10-11T00:00:00.000Z' });
    const older = ev({ title: 'Older', updatedAt: '2026-10-09T00:00:00.000Z' });
    const same = ev({ title: 'Same time', updatedAt: '2026-10-10T00:00:00.000Z' });
    expect(mergeEvents([mine], [newer])[0].title).toBe('Newer');
    expect(mergeEvents([mine], [older])[0].title).toBe('Mine');
    expect(mergeEvents([mine], [same])[0].title).toBe('Mine');
  });

  it('copes with a cloud copy that is missing or not a list', () => {
    expect(mergeEvents([ev()], undefined)).toHaveLength(1);
    expect(mergeEvents([ev()], 'x')).toHaveLength(1);
    expect(mergeEvents(undefined, [ev()])).toHaveLength(1);
  });
});

describe('words', () => {
  it('names the kinds', () => {
    expect(kindLabel('nutrition')).toBe('Meal');
    expect(kindLabel('run')).toBe('Run');
    expect(kindLabel('x')).toBe('Event');
  });

  it('describes a repeat', () => {
    expect(describeRepeat(null)).toBe('');
    expect(describeRepeat({ every: 'day', until: null })).toBe('Every day');
    expect(describeRepeat({ every: 'week', days: [1, 3], until: null })).toBe('Every week on Mon, Wed');
    expect(describeRepeat({ every: 'day', until: '2026-12-01' })).toBe('Every day until Dec 1');
  });

  it('describes a reminder', () => {
    expect(describeReminder(null)).toBe('No reminder');
    expect(describeReminder(0)).toBe('At the time');
    expect(describeReminder(1440)).toBe('1 day before');
    expect(describeReminder(7)).toBe('');
  });

  it('words each reminder', () => {
    const start = local(2026, 10, 20, 7, 5);
    expect(reminderContent({ title: 'Leg day', kind: 'workout', minutes: 0, start })).toEqual({ title: 'Workout time', body: 'Leg day' });
    expect(reminderContent({ title: 'Easy 5k', kind: 'run', minutes: 0, start })).toEqual({ title: 'Run time', body: 'Easy 5k' });
    expect(reminderContent({ title: 'Lunch', kind: 'nutrition', minutes: 0, start })).toEqual({ title: 'Meal time', body: 'Lunch' });
    expect(reminderContent({ title: 'Dentist', kind: 'other', minutes: 0, start })).toEqual({ title: 'Reminder', body: 'Dentist' });
    expect(reminderContent({ title: 'Leg day', kind: 'workout', minutes: 30, start })).toEqual({ title: 'In 30 min', body: 'Leg day at 7:05 AM' });
    expect(reminderContent({ title: 'Leg day', kind: 'workout', minutes: 60, start }).title).toBe('In 1 hour');
    expect(reminderContent({ title: 'Leg day', kind: 'workout', minutes: 1440, start })).toEqual({ title: 'Tomorrow at 7:05 AM', body: 'Leg day' });
    expect(reminderContent({ title: 'Dinner', kind: 'nutrition', minutes: 10, start: local(2026, 10, 20, 18, 0) }).body).toBe('Dinner at 6:00 PM');
    expect(reminderContent({ title: 'Midnight', kind: 'other', minutes: 10, start: local(2026, 10, 20, 0, 0) }).body).toBe('Midnight at 12:00 AM');
    expect(reminderContent({ title: 'Noon', kind: 'other', minutes: 10, start: local(2026, 10, 20, 12, 0) }).body).toBe('Noon at 12:00 PM');
  });

  it('works out the last day of a repeat that runs a number of weeks', () => {
    expect(repeatEndKey('2026-10-20', 4)).toBe('2026-11-16');
    expect(repeatEndKey('2026-10-20', null)).toBeNull();
  });

  it('writes a time of day the way the phone shows it', () => {
    expect(clockLabel('07:05')).toBe('7:05 AM');
    expect(clockLabel('00:00')).toBe('12:00 AM');
    expect(clockLabel('12:30')).toBe('12:30 PM');
    expect(clockLabel('23:59')).toBe('11:59 PM');
    expect(clockLabel('24:00')).toBe('');
    expect(clockLabel('7')).toBe('');
    expect(clockLabel(undefined)).toBe('');
  });

  it('moves a time of day on or back, round midnight', () => {
    expect(shiftTime('07:00', 15)).toBe('07:15');
    expect(shiftTime('07:50', 15)).toBe('08:05');
    expect(shiftTime('07:00', -15)).toBe('06:45');
    expect(shiftTime('07:00', 60)).toBe('08:00');
    expect(shiftTime('23:30', 60)).toBe('00:30');
    expect(shiftTime('00:10', -15)).toBe('23:55');
    expect(shiftTime('07:00', 1440 * 3)).toBe('07:00');
    expect(shiftTime('nope', 15)).toBe('nope');
  });

  it('writes a day as the month and date, on that day and not the one before', () => {
    // A day is not a moment: read as UTC midnight, 2026-10-10 would be the evening of the 9th in New York.
    expect(monthDay('2026-10-10')).toBe('Oct 10');
    expect(monthDay('2026-12-01')).toBe('Dec 1');
    expect(monthDay('nope')).toBe('');
  });

  it('writes a day as the weekday, month and date', () => {
    expect(dateLabel('2026-10-21')).toBe('Wed, Oct 21');
    expect(dateLabel('2026-01-01')).toBe('Thu, Jan 1');
    expect(dateLabel('2026-02-30')).toBe('');
    expect(dateLabel(undefined)).toBe('');
  });

  describe('moving the form\'s day', () => {
    const base = { title: 'x', kind: 'workout', date: '2026-10-20', time: '07:00', notes: '', workoutId: null, remindMinutes: 0 };

    it('moves a single event\'s day', () => {
      expect(moveFormDate({ ...base, repeat: null }, '2026-10-25')).toEqual({ ...base, date: '2026-10-25', repeat: null });
    });

    it('keeps the form when the day is not real', () => {
      const f = { ...base, repeat: null };
      expect(moveFormDate(f, '2026-02-30')).toBe(f);
    });

    it('moves the end of a repeat that ends after a number of weeks, and the weekday of one on its first weekday only', () => {
      const f = { ...base, repeat: { every: 'week', days: [2], until: '2026-11-16' } }; // 4 weeks from Tue 20 Oct
      expect(endsWeeksOf(f.repeat, f.date)).toBe(4);
      const moved = moveFormDate(f, '2026-10-22'); // a Thursday
      expect(moved.repeat).toEqual({ every: 'week', days: [4], until: '2026-11-18' });
    });

    it('keeps weekdays the person chose, and an end they set another way (but not before the new day)', () => {
      const f = { ...base, repeat: { every: 'week', days: [1, 3], until: '2026-12-25' } };
      expect(moveFormDate(f, '2026-10-22').repeat).toEqual({ every: 'week', days: [1, 3], until: '2026-12-25' });
      expect(moveFormDate(f, '2027-01-05').repeat.until).toBe('2027-01-05');
    });

    it('moves a daily repeat without touching its weekdays', () => {
      const f = { ...base, repeat: { every: 'day', until: null } };
      expect(moveFormDate(f, '2026-10-30').repeat).toEqual({ every: 'day', until: null });
    });
  });

  it('says which end choice a repeat has', () => {
    expect(endsWeeksOf(null, '2026-10-20')).toBeUndefined();
    expect(endsWeeksOf({ every: 'day', until: null }, '2026-10-20')).toBeNull();
    expect(endsWeeksOf({ every: 'day', until: '2026-12-14' }, '2026-10-20')).toBe(8);
    expect(endsWeeksOf({ every: 'day', until: '2026-12-15' }, '2026-10-20')).toBeUndefined();
  });
});
