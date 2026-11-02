import { createChallengesOnce, isAlreadyExists } from '../functions/src/challengeCreate';

// A stand-in for db.collection('challenges').doc(id).create(data): create() fails with ALREADY_EXISTS when the document is there,
// as Firestore's does. The first call to reach a document wins, even when two arrive at the same moment.
function makeDb({ seed = {}, failOn = null } = {}) {
  const docs = new Map(Object.entries(seed));
  const calls = [];
  return {
    docs,
    calls,
    collection: (name) => ({
      doc: (id) => ({
        create: async (data) => {
          calls.push(`${name}/${id}`);
          await Promise.resolve();
          if (failOn === id) throw Object.assign(new Error('boom'), { code: 13 });
          if (docs.has(`${name}/${id}`)) throw Object.assign(new Error('6 ALREADY_EXISTS: Document already exists'), { code: 6 });
          docs.set(`${name}/${id}`, data);
        },
      }),
    }),
  };
}

const set = (cadence, title) => [
  { id: `daily_day-2026-11-02`, data: { cadence: 'daily', title: `${title} daily` } },
  { id: `weekly_week-2026-11-02`, data: { cadence: 'weekly', title: `${title} weekly` } },
];

describe('createChallengesOnce', () => {
  it('writes each challenge under the id it is given', async () => {
    const db = makeDb();
    const result = await createChallengesOnce({ db, challenges: set('x', 'A') });
    expect(result).toEqual({ created: ['daily_day-2026-11-02', 'weekly_week-2026-11-02'], existing: [] });
    expect(db.docs.get('challenges/daily_day-2026-11-02')).toEqual({ cadence: 'daily', title: 'A daily' });
  });

  it('makes one set when two people ask at the same moment', async () => {
    const db = makeDb();
    const [first, second] = await Promise.all([
      createChallengesOnce({ db, challenges: set('x', 'First') }),
      createChallengesOnce({ db, challenges: set('x', 'Second') }),
    ]);
    expect([...db.docs.keys()].sort()).toEqual(['challenges/daily_day-2026-11-02', 'challenges/weekly_week-2026-11-02']);
    // Each challenge was written by exactly one of the two.
    expect([...first.created, ...second.created].sort()).toEqual(['daily_day-2026-11-02', 'weekly_week-2026-11-02']);
    expect([...first.existing, ...second.existing].sort()).toEqual(['daily_day-2026-11-02', 'weekly_week-2026-11-02']);
  });

  it('leaves a challenge that is already there as it was, and writes the others', async () => {
    const db = makeDb({ seed: { 'challenges/daily_day-2026-11-02': { cadence: 'daily', title: 'Earlier' } } });
    const result = await createChallengesOnce({ db, challenges: set('x', 'Later') });
    expect(result).toEqual({ created: ['weekly_week-2026-11-02'], existing: ['daily_day-2026-11-02'] });
    expect(db.docs.get('challenges/daily_day-2026-11-02')).toEqual({ cadence: 'daily', title: 'Earlier' });
    expect(db.docs.get('challenges/weekly_week-2026-11-02').title).toBe('Later weekly');
  });

  it('tries every write, then throws the first real error', async () => {
    const db = makeDb({ failOn: 'daily_day-2026-11-02' });
    await expect(createChallengesOnce({ db, challenges: set('x', 'A') })).rejects.toThrow('boom');
    expect(db.calls).toHaveLength(2);
    expect(db.docs.has('challenges/weekly_week-2026-11-02')).toBe(true);
  });

  it('does nothing for an empty list', async () => {
    const db = makeDb();
    expect(await createChallengesOnce({ db, challenges: [] })).toEqual({ created: [], existing: [] });
  });

  it('knows an already-exists error by its code or its message', () => {
    expect(isAlreadyExists({ code: 6 })).toBe(true);
    expect(isAlreadyExists(new Error('6 ALREADY_EXISTS: Document already exists'))).toBe(true);
    expect(isAlreadyExists({ code: 13, message: 'internal' })).toBe(false);
    expect(isAlreadyExists(null)).toBe(false);
  });
});
