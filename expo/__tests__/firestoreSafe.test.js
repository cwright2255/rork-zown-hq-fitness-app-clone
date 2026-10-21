// lib/firestoreSafe.js: Firestore refuses a document with an undefined field, so those fields are taken out before a record is saved.
import { withoutUndefined } from '../lib/firestoreSafe';

describe('withoutUndefined', () => {
  it('removes undefined fields and keeps every other value, including null, 0, false and empty text', () => {
    expect(withoutUndefined({ a: 1, b: undefined, c: null, d: 0, e: false, f: '' })).toEqual({ a: 1, c: null, d: 0, e: false, f: '' });
    expect(Object.keys(withoutUndefined({ a: undefined, b: 2 }))).toEqual(['b']);
  });

  it('cleans nested objects and the objects inside lists', () => {
    const out = withoutUndefined({ exercises: [{ name: 'Squat', sets: 3, tag: undefined }], meta: { x: undefined, y: { z: undefined, w: 1 } } });
    expect(out).toEqual({ exercises: [{ name: 'Squat', sets: 3 }], meta: { y: { w: 1 } } });
    expect('tag' in out.exercises[0]).toBe(false);
    expect('x' in out.meta).toBe(false);
    expect('z' in out.meta.y).toBe(false);
  });

  it('writes an undefined list item as null so the items after it stay where they are', () => {
    expect(withoutUndefined({ list: [1, undefined, 3] })).toEqual({ list: [1, null, 3] });
    expect(withoutUndefined([undefined])).toEqual([null]);
  });

  it('does not change the value it is given', () => {
    const input = { a: undefined, b: { c: undefined }, d: [undefined] };
    withoutUndefined(input);
    expect(Object.keys(input)).toEqual(['a', 'b', 'd']);
    expect('c' in input.b).toBe(true);
    expect(input.d).toEqual([undefined]);
  });

  it('passes dates, class instances (a Firestore Timestamp, the server-time marker) and plain values through as they are', () => {
    class Marker { constructor() { this.hidden = undefined; } }
    const marker = new Marker();
    const when = new Date('2026-10-20T12:00:00Z');
    const out = withoutUndefined({ marker, when, n: 5, s: 'x', t: true });
    expect(out.marker).toBe(marker);
    expect('hidden' in out.marker).toBe(true);
    expect(out.when).toBe(when);
    expect(out).toMatchObject({ n: 5, s: 'x', t: true });
    expect(withoutUndefined(7)).toBe(7);
    expect(withoutUndefined('x')).toBe('x');
    expect(withoutUndefined(null)).toBeNull();
    expect(withoutUndefined(undefined)).toBeUndefined();
  });

  it('cleans an object made without a prototype', () => {
    const bare = Object.create(null);
    bare.a = undefined;
    bare.b = 1;
    expect(Object.keys(withoutUndefined(bare))).toEqual(['b']);
  });
});
