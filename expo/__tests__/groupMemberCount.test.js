import { changeMemberCount } from '../functions/src/groupMemberCount';

// A small in-memory stand-in for the Firestore pieces changeMemberCount uses: db.doc(path) and db.runTransaction, whose
// transaction has get(ref), update(ref, data) and set(ref, data). Writes are applied when the transaction function returns,
// and a transaction that reads after writing (which Firestore refuses) throws, so the real order is enforced here too.
function makeDb(seed = {}) {
  const docs = new Map(Object.entries(seed));
  let transactions = 0;
  const db = {
    docs,
    transactions: () => transactions,
    doc: (path) => ({ path }),
    runTransaction: async (fn) => {
      transactions += 1;
      const writes = [];
      let wrote = false;
      const tx = {
        get: async (ref) => {
          if (wrote) throw new Error('reads must come before writes in a transaction');
          return { exists: docs.has(ref.path), data: () => docs.get(ref.path) };
        },
        update: (ref, data) => {
          wrote = true;
          if (!docs.has(ref.path)) throw new Error('NOT_FOUND: ' + ref.path);
          writes.push(() => docs.set(ref.path, { ...docs.get(ref.path), ...data }));
        },
        set: (ref, data) => {
          wrote = true;
          writes.push(() => docs.set(ref.path, data));
        },
      };
      const result = await fn(tx);
      writes.forEach((w) => w());
      return result;
    },
  };
  return db;
}

const count = (db, groupId = 'g1') => db.docs.get(`communityGroups/${groupId}`).memberCount;

describe('changeMemberCount', () => {
  it('adds one when someone joins and takes one off when someone leaves', async () => {
    const db = makeDb({ 'communityGroups/g1': { name: 'Morning Runners', memberCount: 3 } });
    expect(await changeMemberCount({ db, groupId: 'g1', delta: 1, eventId: 'e1' })).toBe('changed');
    expect(count(db)).toBe(4);
    expect(await changeMemberCount({ db, groupId: 'g1', delta: -1, eventId: 'e2' })).toBe('changed');
    expect(count(db)).toBe(3);
  });

  it('changes only the count, not the rest of the group', async () => {
    const db = makeDb({ 'communityGroups/g1': { name: 'Morning Runners', memberCount: 3, description: 'Early miles' } });
    await changeMemberCount({ db, groupId: 'g1', delta: 1, eventId: 'e1' });
    expect(db.docs.get('communityGroups/g1')).toEqual({ name: 'Morning Runners', memberCount: 4, description: 'Early miles' });
  });

  it('applies a repeated delivery of the same event only once', async () => {
    const db = makeDb({ 'communityGroups/g1': { memberCount: 3 } });
    expect(await changeMemberCount({ db, groupId: 'g1', delta: 1, eventId: 'same' })).toBe('changed');
    expect(await changeMemberCount({ db, groupId: 'g1', delta: 1, eventId: 'same' })).toBe('duplicate');
    expect(count(db)).toBe(4);
  });

  it('counts two different events separately, even for the same group', async () => {
    const db = makeDb({ 'communityGroups/g1': { memberCount: 0 } });
    await changeMemberCount({ db, groupId: 'g1', delta: 1, eventId: 'a' });
    await changeMemberCount({ db, groupId: 'g1', delta: 1, eventId: 'b' });
    expect(count(db)).toBe(2);
  });

  it('never goes below zero', async () => {
    const db = makeDb({ 'communityGroups/g1': { memberCount: 0 } });
    await changeMemberCount({ db, groupId: 'g1', delta: -1, eventId: 'e1' });
    expect(count(db)).toBe(0);
  });

  it('starts from zero when the group has no count yet, or one that is not a number', async () => {
    const db = makeDb({ 'communityGroups/g1': { name: 'No count' }, 'communityGroups/g2': { memberCount: 'lots' } });
    await changeMemberCount({ db, groupId: 'g1', delta: 1, eventId: 'e1' });
    await changeMemberCount({ db, groupId: 'g2', delta: 1, eventId: 'e2' });
    expect(count(db, 'g1')).toBe(1);
    expect(count(db, 'g2')).toBe(1);
  });

  it('leaves a group that has no document alone, rather than creating one', async () => {
    const db = makeDb({});
    expect(await changeMemberCount({ db, groupId: 'built-in-group', delta: 1, eventId: 'e1' })).toBe('no-group');
    expect([...db.docs.keys()]).toEqual([]);
  });

  it('records each applied event, with the time it was given', async () => {
    const db = makeDb({ 'communityGroups/g1': { memberCount: 1 } });
    await changeMemberCount({ db, groupId: 'g1', delta: 1, eventId: 'e1', stamp: 'NOW' });
    expect(db.docs.get('communityGroups/g1/memberCountEvents/e1')).toEqual({ delta: 1, at: 'NOW' });
  });

  it('does nothing for a missing group id or event id, or a change that is not one up or one down', async () => {
    const db = makeDb({ 'communityGroups/g1': { memberCount: 3 } });
    expect(await changeMemberCount({ db, groupId: '', delta: 1, eventId: 'e1' })).toBe('ignored');
    expect(await changeMemberCount({ db, groupId: 'g1', delta: 1, eventId: '' })).toBe('ignored');
    expect(await changeMemberCount({ db, groupId: 'g1', delta: 5, eventId: 'e1' })).toBe('ignored');
    expect(await changeMemberCount({ db, groupId: 'g1', delta: 0, eventId: 'e1' })).toBe('ignored');
    expect(count(db)).toBe(3);
    expect(db.transactions()).toBe(0);
  });
});
