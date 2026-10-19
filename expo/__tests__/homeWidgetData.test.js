// What the newer Home widgets say (lib/homeWidgetData.js). jest.global-setup.js pins the time zone to America/New_York.
import { nextUpSummary, streakCaption, streakSentence } from '../lib/homeWidgetData';

// Mon 19 Oct 2026, 8:00 AM in New York.
const NOW = new Date(2026, 9, 19, 8, 0);
const local = (y, m, d, h = 7, mi = 0) => new Date(y, m - 1, d, h, mi).toISOString();
const ev = (o = {}) => ({
  id: 'e1', title: 'Leg day', kind: 'workout', start: local(2026, 10, 19, 18, 30), notes: '', workoutId: null, repeat: null,
  remindMinutes: null, doneDates: [], skipDates: [], source: 'user', inviteId: null, host: null, updatedAt: '2026-10-01T00:00:00.000Z', ...o,
});

describe('streakCaption', () => {
  it.each([
    [0, 'Train today to start one'],
    [1, 'day in a row'],
    [2, 'days in a row'],
    [30, 'days in a row'],
  ])('for a streak of %s says "%s"', (n, caption) => {
    expect(streakCaption(n)).toBe(caption);
  });

  it.each([[undefined], [null], [NaN], ['x'], [-3]])('gives the nudge, not a count, for %s', (bad) => {
    expect(streakCaption(bad)).toBe('Train today to start one');
  });
});

describe('streakSentence', () => {
  it('says the streak in words for a screen reader', () => {
    expect(streakSentence(0)).toBe('no streak yet');
    expect(streakSentence(1)).toBe('1 day in a row');
    expect(streakSentence(12)).toBe('12 days in a row');
    expect(streakSentence(undefined)).toBe('no streak yet');
    expect(streakSentence(-2)).toBe('no streak yet');
  });
});

describe('nextUpSummary', () => {
  it('is null when nothing is on the calendar', () => {
    expect(nextUpSummary([], NOW)).toBeNull();
    expect(nextUpSummary(undefined, NOW)).toBeNull();
    expect(nextUpSummary('not a list', NOW)).toBeNull();
  });

  it('says Today with the time for an event later today', () => {
    expect(nextUpSummary([ev()], NOW)).toEqual({
      key: 'e1@2026-10-19', title: 'Leg day', kind: 'workout', date: '2026-10-19', when: 'Today \u00B7 6:30 PM',
    });
  });

  it('says Tomorrow for an event tomorrow', () => {
    const s = nextUpSummary([ev({ start: local(2026, 10, 20, 7, 0) })], NOW);
    expect(s.when).toBe('Tomorrow \u00B7 7:00 AM');
    expect(s.date).toBe('2026-10-20');
  });

  it('says the day for an event further off, as the Calendar does', () => {
    const s = nextUpSummary([ev({ start: local(2026, 10, 23, 12, 0) })], NOW);
    expect(s.when).toBe('Fri, Oct 23 \u00B7 12:00 PM');
  });

  it('picks the soonest of several, whatever order they are kept in', () => {
    const later = ev({ id: 'later', title: 'Long run', start: local(2026, 10, 22, 6, 0) });
    const soon = ev({ id: 'soon', title: 'Stretch', start: local(2026, 10, 19, 12, 0) });
    expect(nextUpSummary([later, soon], NOW).title).toBe('Stretch');
    expect(nextUpSummary([soon, later], NOW).title).toBe('Stretch');
  });

  it('skips one that is ticked off for that day', () => {
    const done = ev({ id: 'done', title: 'Done already', start: local(2026, 10, 19, 9, 0), doneDates: ['2026-10-19'] });
    const open = ev({ id: 'open', title: 'Still to do', start: local(2026, 10, 19, 17, 0) });
    expect(nextUpSummary([done, open], NOW).title).toBe('Still to do');
    expect(nextUpSummary([done], NOW)).toBeNull();
  });

  it('still shows one that started within the last hour', () => {
    const started = ev({ start: local(2026, 10, 19, 7, 30) });
    expect(nextUpSummary([started], NOW).when).toBe('Today \u00B7 7:30 AM');
  });

  it('leaves out one that started more than an hour ago', () => {
    const over = ev({ start: local(2026, 10, 19, 6, 30) });
    expect(nextUpSummary([over], NOW)).toBeNull();
  });

  it('finds the next day of a repeating event', () => {
    const daily = ev({ id: 'daily', title: 'Morning mobility', start: local(2026, 10, 12, 6, 0), repeat: { every: 'day', until: null } });
    const s = nextUpSummary([daily], NOW);
    // 6:00 AM today has gone by two hours ago, so the next one is tomorrow's.
    expect(s.date).toBe('2026-10-20');
    expect(s.when).toBe('Tomorrow \u00B7 6:00 AM');
    expect(s.key).toBe('daily@2026-10-20');
  });

  it('skips a day of a repeat that was removed', () => {
    const daily = ev({ id: 'daily', start: local(2026, 10, 12, 18, 0), repeat: { every: 'day', until: null }, skipDates: ['2026-10-19'] });
    expect(nextUpSummary([daily], NOW).date).toBe('2026-10-20');
  });

  it('moves on as the clock does', () => {
    const e = [ev({ id: 'a', title: 'First', start: local(2026, 10, 19, 9, 0) }), ev({ id: 'b', title: 'Second', start: local(2026, 10, 19, 15, 0) })];
    expect(nextUpSummary(e, new Date(2026, 9, 19, 8, 0)).title).toBe('First');
    expect(nextUpSummary(e, new Date(2026, 9, 19, 10, 30)).title).toBe('Second');
    expect(nextUpSummary(e, new Date(2026, 9, 19, 16, 30))).toBeNull();
  });

  it('goes by the person\'s own day in the evening, when it is already tomorrow in UTC', () => {
    // 9:30 PM on Mon 19 Oct in New Jersey is 01:30Z on the 20th.
    const evening = new Date('2026-10-20T01:30:00Z');
    const tonight = ev({ id: 't', title: 'Late stretch', start: local(2026, 10, 19, 22, 30) });
    const tomorrow = ev({ id: 'm', title: 'Morning run', start: local(2026, 10, 20, 6, 30) });
    expect(nextUpSummary([tomorrow, tonight], evening).when).toBe('Today \u00B7 10:30 PM');
    expect(nextUpSummary([tomorrow], evening).when).toBe('Tomorrow \u00B7 6:30 AM');
  });

  it('works for events the coach added or someone invited the person to', () => {
    const coach = ev({ id: 'c', title: 'Coach: tempo run', source: 'coach', start: local(2026, 10, 20, 6, 0) });
    expect(nextUpSummary([coach], NOW).title).toBe('Coach: tempo run');
  });

  it('ignores records that are not events', () => {
    expect(nextUpSummary([null, 3, { id: 'x' }, ev()], NOW).title).toBe('Leg day');
  });
});
