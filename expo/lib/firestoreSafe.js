// lib/firestoreSafe.js
//
// The app talks to Firestore with getFirestore(app) and no options, and Firestore's default is to REFUSE a document that has a field
// whose value is undefined (it throws "Unsupported field value: undefined"). A record built from optional pieces, such as a workout
// whose category comes from a template a program-day session does not have, therefore never reaches the server, however well the rest of it
// is formed. withoutUndefined() takes those fields out first, so the rest of the record is saved as it is.
//
// Plain objects and lists are cleaned all the way down. Anything else (a date, a Firestore Timestamp, the serverTimestamp() marker, a
// number, a string) is passed through untouched. An undefined inside a list is written as null, because dropping it would move the
// items after it. The value given is not changed. Pure function.

const isPlainObject = (value) => {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/** A copy of `value` with every undefined property removed (and every undefined list item turned into null). */
export function withoutUndefined(value) {
  if (Array.isArray(value)) return value.map((item) => (item === undefined ? null : withoutUndefined(item)));
  if (!isPlainObject(value)) return value;
  const out = {};
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) continue;
    out[key] = withoutUndefined(value[key]);
  }
  return out;
}
