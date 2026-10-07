import {
  sortEvents, eventsForDay, daysWithEvents, upcomingEvents, formatTime, formatShortDate, buildEventRecords,
} from '../lib/scheduleUtils';

const at = (y, m, d, h = 7, min = 0) => new Date(y, m, d, h, min).toISOString();
const events = [
  { id: 'c', title: 'Dinner', kind: 'nutrition', start: at(2026, 9, 9, 18, 30) },
  { id: 'a', title: 'Bench Day', kind: 'workout', start: at(2026, 9, 8, 7) },
  { id: 'b', title: 'Run', kind: 'run', start: at(2026, 9, 8, 18) },
  { id: 'x', title: 'Later', kind: 'other', start: at(2026, 10, 2) },
  { id: 'bad', title: 'Broken', kind: 'other', start: 'not a date' },
];

describe('scheduleUtils', () => {
  it('sorts by start time and skips events with a broken date', () => {
    expect(sortEvents(events).map((e) => e.id)).toEqual(['a', 'b', 'c', 'x']);
  });

  it('finds the events on one day, in time order', () => {
    expect(eventsForDay(events, 2026, 9, 8).map((e) => e.id)).toEqual(['a', 'b']);
    expect(eventsForDay(events, 2026, 9, 20)).toEqual([]);
  });

  it('lists which days of a month have events', () => {
    expect([...daysWithEvents(events, 2026, 9)].sort((x, y) => x - y)).toEqual([8, 9]);
    expect([...daysWithEvents(events, 2026, 10)]).toEqual([2]);
  });

  it('returns upcoming events, keeping one that started under an hour ago', () => {
    const now = new Date(2026, 9, 8, 7, 30);
    expect(upcomingEvents(events, now, 2).map((e) => e.id)).toEqual(['a', 'b']);
    const later = new Date(2026, 9, 8, 9, 0);
    expect(upcomingEvents(events, later, 10).map((e) => e.id)).toEqual(['b', 'c', 'x']);
  });

  it('formats times and dates', () => {
    expect(formatTime(at(2026, 9, 8, 0, 5))).toBe('12:05 AM');
    expect(formatTime(at(2026, 9, 8, 13, 0))).toBe('1:00 PM');
    expect(formatShortDate(at(2026, 9, 8))).toBe('Oct 8');
    expect(formatTime('nope')).toBe('');
  });

  it('builds calendar records, linking events to workouts from the same plan', () => {
    let n = 0;
    const records = buildEventRecords(
      [{ title: 'Bench Day', kind: 'workout', start: at(2026, 9, 8), notes: '', workoutName: 'Bench Day' },
       { title: 'Lunch', kind: 'nutrition', start: at(2026, 9, 8, 12), notes: 'bowl', workoutName: '' }],
      { 'bench day': 'coach-1-0' },
      () => `id${++n}`
    );
    expect(records[0]).toMatchObject({ id: 'id1', workoutId: 'coach-1-0', source: 'coach', notificationId: null });
    expect(records[1]).toMatchObject({ id: 'id2', workoutId: null, notes: 'bowl' });
  });
});
