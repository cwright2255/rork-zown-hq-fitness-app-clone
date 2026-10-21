// lib/workoutOrder.js: which workout finished last, and the list newest first, by the time each finished, never by where it sits in the list.
// jest.global-setup.js pins the zone to America/New_York.
import { newestFirst, newestOf, workoutMs } from '../lib/workoutOrder';

const at = (iso, extra = {}) => ({ id: iso, completedAt: iso, ...extra });
const A = at('2026-10-10T12:00:00.000Z');
const B = at('2026-10-14T12:00:00.000Z');
const C = at('2026-10-20T12:00:00.000Z');

describe('workoutMs', () => {
  it('reads completedAt first, then the server date, then timestamp', () => {
    const iso = '2026-10-20T12:00:00.000Z';
    const ms = new Date(iso).getTime();
    expect(workoutMs({ completedAt: iso })).toBe(ms);
    expect(workoutMs({ date: { toDate: () => new Date(iso) } })).toBe(ms);
    expect(workoutMs({ timestamp: iso })).toBe(ms);
    expect(workoutMs({ completedAt: iso, date: { toDate: () => new Date('2020-01-01T00:00:00Z') } })).toBe(ms);
    expect(workoutMs({ date: { toDate: () => new Date(iso) }, timestamp: '2020-01-01T00:00:00Z' })).toBe(ms);
  });

  it('reads a server date that went through the phone as plain seconds and nanoseconds', () => {
    expect(workoutMs({ date: { seconds: 1760961600, nanoseconds: 500000000 } })).toBe(1760961600500);
    expect(workoutMs({ date: { seconds: 1760961600 } })).toBe(1760961600000);
  });

  it('is NaN for a record with no usable time', () => {
    expect(workoutMs({})).toBeNaN();
    expect(workoutMs({ completedAt: 'not a date' })).toBeNaN();
    expect(workoutMs({ completedAt: true })).toBeNaN();
    expect(workoutMs({ completedAt: '' })).toBeNaN();
    expect(workoutMs(null)).toBeNaN();
    expect(workoutMs(undefined)).toBeNaN();
    expect(workoutMs('2026-10-20')).toBeNaN();
  });
});

describe('newestFirst', () => {
  it('puts the newest first whichever way the list came', () => {
    expect(newestFirst([A, B, C])).toEqual([C, B, A]);
    expect(newestFirst([C, B, A])).toEqual([C, B, A]);
    expect(newestFirst([B, C, A])).toEqual([C, B, A]);
  });

  it('does not change the list it is given, and returns a new one', () => {
    const list = [A, B, C];
    const out = newestFirst(list);
    expect(list).toEqual([A, B, C]);
    expect(out).not.toBe(list);
  });

  it('keeps records with the same time in the order they came', () => {
    const x = at('2026-10-14T12:00:00.000Z', { id: 'x' });
    const y = at('2026-10-14T12:00:00.000Z', { id: 'y' });
    expect(newestFirst([x, y]).map((w) => w.id)).toEqual(['x', 'y']);
    expect(newestFirst([y, x]).map((w) => w.id)).toEqual(['y', 'x']);
  });

  it('puts a record with no time after every record that has one, and keeps those in their order', () => {
    const n1 = { id: 'n1' };
    const n2 = { id: 'n2' };
    expect(newestFirst([n1, A, n2, C]).map((w) => w.id)).toEqual([C.id, A.id, 'n1', 'n2']);
  });

  it('drops what is not a record, and copes with a list that is missing', () => {
    expect(newestFirst([A, null, undefined, 'x', 3, C])).toEqual([C, A]);
    expect(newestFirst(undefined)).toEqual([]);
    expect(newestFirst(null)).toEqual([]);
    expect(newestFirst('nope')).toEqual([]);
  });

  it('places a record that carries only the server date by that date', () => {
    const serverOnly = { id: 's', date: { toDate: () => new Date('2026-10-16T12:00:00Z') } };
    expect(newestFirst([A, serverOnly, C, B]).map((w) => w.id)).toEqual([C.id, 's', B.id, A.id]);
  });
});

describe('newestOf', () => {
  it('is the one that finished last whatever its place in the list', () => {
    expect(newestOf([A, B, C])).toBe(C);
    expect(newestOf([C, B, A])).toBe(C);
    expect(newestOf([A, C, B])).toBe(C);
  });

  it('is null for an empty or missing list', () => {
    expect(newestOf([])).toBeNull();
    expect(newestOf(undefined)).toBeNull();
    expect(newestOf(null)).toBeNull();
    expect(newestOf([null, undefined])).toBeNull();
  });

  it('takes the later one in the list when two finished at the same moment', () => {
    const x = at('2026-10-14T12:00:00.000Z', { id: 'x' });
    const y = at('2026-10-14T12:00:00.000Z', { id: 'y' });
    expect(newestOf([x, y])).toBe(y);
  });

  it('takes a record with a time over one without, wherever each sits', () => {
    const none = { id: 'none' };
    expect(newestOf([A, none])).toBe(A);
    expect(newestOf([none, A])).toBe(A);
  });

  it('takes the last one in the list when none has a time, as the app always read it', () => {
    const p = { id: 'p' };
    const q = { id: 'q' };
    expect(newestOf([p, q])).toBe(q);
    expect(newestOf([p])).toBe(p);
  });
});
