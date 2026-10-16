// Challenges, virtual races and one-on-one duels: boards everyone signed in can read, where each person can only write
// their own line, and where what can be written is checked, not just who is writing it.
const { rulesEnv, ok, no } = require('./helpers');

const env = rulesEnv();

describe('/challenges/{challengeId}', () => {
  it('can be read by anyone signed in, not by a visitor', async () => {
    await env.seed({ 'challenges/c1': { title: '100 km in October' } });
    await ok(env.as('alice').doc('challenges/c1').get());
    await ok(env.as('alice').collection('challenges').get());
    await no(env.anon().doc('challenges/c1').get());
  });

  it('can be written from the app by no one, an admin included (they are set up on the server)', async () => {
    await env.seed({ 'challenges/c1': { title: 'x' }, 'admins/root': { since: '2026-10-01' } });
    for (const who of ['alice', 'root']) {
      await no(env.as(who).doc('challenges/c2').set({ title: 'new' }));
      await no(env.as(who).doc('challenges/c1').update({ title: 'changed' }));
      await no(env.as(who).doc('challenges/c1').delete());
    }
  });
});

describe('/challengeEntries/{entryId}', () => {
  const entry = (uid, extra = {}) => ({ uid, challengeId: 'c1', progress: 12, ...extra });

  it('can be read by anyone signed in, not by a visitor', async () => {
    await env.seed({ 'challengeEntries/c1_alice': entry('alice') });
    await ok(env.as('bob').doc('challengeEntries/c1_alice').get());
    await ok(env.as('bob').collection('challengeEntries').get());
    await no(env.anon().doc('challengeEntries/c1_alice').get());
  });

  it('can be created and updated by each person for themselves, under the id <challengeId>_<uid>', async () => {
    const mine = env.as('alice').doc('challengeEntries/c1_alice');
    await ok(mine.set(entry('alice')));
    await ok(mine.set(entry('alice', { progress: 30 })));
  });

  it('refuses an entry for someone else, or one whose id does not fit', async () => {
    await no(env.as('alice').doc('challengeEntries/c1_bob').set(entry('bob')));
    await no(env.as('alice').doc('challengeEntries/c1_alice').set(entry('bob')));
    await no(env.as('alice').doc('challengeEntries/c1_bob').set(entry('alice')));
    await no(env.as('alice').doc('challengeEntries/other_alice').set(entry('alice')));
    await no(env.as('alice').doc('challengeEntries/alice').set(entry('alice')));
    await no(env.anon().doc('challengeEntries/c1_alice').set(entry('alice')));
  });

  it('cannot be changed by someone else', async () => {
    await env.seed({ 'challengeEntries/c1_alice': entry('alice') });
    await no(env.as('bob').doc('challengeEntries/c1_alice').set(entry('alice', { progress: 999 })));
    await no(env.as('bob').doc('challengeEntries/c1_alice').update({ progress: 999 }));
  });

  it('can be deleted by its own person only', async () => {
    await env.seed({ 'challengeEntries/c1_alice': entry('alice') });
    await no(env.as('bob').doc('challengeEntries/c1_alice').delete());
    await no(env.anon().doc('challengeEntries/c1_alice').delete());
    await ok(env.as('alice').doc('challengeEntries/c1_alice').delete());
  });
});

describe('/raceEntries/{entryId}', () => {
  const RACE = 'local-5k-week-2026-10-12';
  const WORLD = 'world-10k-month-2026-10';
  const local = (uid, over = {}) => ({
    raceId: RACE, uid, kind: 'local', distanceKm: 5, name: 'Alice', avatar: null, timeSec: 1500,
    finishedAt: '2026-10-14T10:00:00.000Z', areaId: 'dr5ru7', ...over,
  });
  const world = (uid, over = {}) => ({
    raceId: WORLD, uid, kind: 'world', distanceKm: 10, name: 'Alice', avatar: null, timeSec: 3000,
    finishedAt: '2026-10-14T10:00:00.000Z', areaId: null, ...over,
  });
  const idOf = (entry) => `${entry.raceId}_${entry.uid}`;
  const put = (uid, entry, id = idOf(entry)) => env.as(uid).doc(`raceEntries/${id}`).set(entry);

  it('can be read by anyone signed in, not by a visitor', async () => {
    await env.seed({ [`raceEntries/${idOf(local('alice'))}`]: local('alice') });
    await ok(env.as('bob').doc(`raceEntries/${idOf(local('alice'))}`).get());
    await ok(env.as('bob').collection('raceEntries').get());
    await no(env.anon().doc(`raceEntries/${idOf(local('alice'))}`).get());
  });

  describe('a result that is allowed', () => {
    it('for the local 5K', async () => {
      await ok(put('alice', local('alice')));
    });

    it('for the worldwide 10K', async () => {
      await ok(put('alice', world('alice')));
    });

    it('with a picture of up to 600 characters', async () => {
      await ok(put('alice', local('alice', { avatar: 'a'.repeat(600) })));
    });

    it('at the fastest and slowest times a person could run (2:20 and 30:00 a kilometre)', async () => {
      await ok(put('alice', local('alice', { timeSec: 700 })));
      await ok(put('bob', local('bob', { timeSec: 9000 })));
      await ok(put('alice', world('alice', { timeSec: 1400 })));
      await ok(put('bob', world('bob', { timeSec: 18000 })));
    });

    it('with a name of up to 40 characters and an area of up to 12', async () => {
      await ok(put('alice', local('alice', { name: 'n'.repeat(40), areaId: 'a'.repeat(12) })));
    });
  });

  describe('a result that is refused', () => {
    it.each([
      ['a time faster than 2:20 a kilometre (local)', local('alice', { timeSec: 699 })],
      ['a time slower than 30:00 a kilometre (local)', local('alice', { timeSec: 9001 })],
      ['a time faster than 2:20 a kilometre (world)', world('alice', { timeSec: 1399 })],
      ['a time slower than 30:00 a kilometre (world)', world('alice', { timeSec: 18001 })],
      ['a time with a fraction of a second', local('alice', { timeSec: 1500.5 })],
      ['a time that is text', local('alice', { timeSec: '1500' })],
      ['a 10 km entered for the local 5K', local('alice', { distanceKm: 10, timeSec: 3000 })],
      ['a 5 km entered for the worldwide 10K', world('alice', { distanceKm: 5, timeSec: 1500 })],
      ['a local result in a worldwide race', local('alice', { raceId: WORLD })],
      ['a worldwide result in a local race', world('alice', { raceId: RACE })],
      ['a race id in the wrong format', local('alice', { raceId: 'local-5k-week-2026-10' })],
      ['a local result with no map area', local('alice', { areaId: null })],
      ['a local result with an empty map area', local('alice', { areaId: '' })],
      ['a local result with a map area over 12 characters', local('alice', { areaId: 'a'.repeat(13) })],
      ['a worldwide result with a map area', world('alice', { areaId: 'dr5ru7' })],
      ['an empty name', local('alice', { name: '' })],
      ['a name over 40 characters', local('alice', { name: 'n'.repeat(41) })],
      ['a picture over 600 characters', local('alice', { avatar: 'a'.repeat(601) })],
      ['a finish time over 40 characters', local('alice', { finishedAt: 'x'.repeat(41) })],
      ['a finish time that is not text', local('alice', { finishedAt: 1760436000 })],
      ['a field the board does not have', local('alice', { winner: true })],
    ])('%s', async (description, entry) => {
      await no(put('alice', entry));
    });

    it.each(['raceId', 'uid', 'kind', 'distanceKm', 'name', 'avatar', 'timeSec', 'finishedAt', 'areaId'])('with the %s left out', async (field) => {
      const { [field]: left, ...rest } = local('alice');
      await no(put('alice', rest, `${RACE}_alice`));
    });

    it('for someone else, or under an id that is not <raceId>_<uid>', async () => {
      await no(put('alice', local('bob'))); // alice writing bob's result
      await no(put('alice', local('alice'), `${RACE}_bob`));
      await no(put('alice', local('alice'), 'alice'));
      await no(put('alice', local('alice'), `other-race_alice`));
    });

    it('from a visitor who is not signed in', async () => {
      await no(env.anon().doc(`raceEntries/${RACE}_alice`).set(local('alice')));
    });
  });

  describe('replacing a result that is already there', () => {
    beforeEach(() => env.seed({ [`raceEntries/${RACE}_alice`]: local('alice', { timeSec: 1500 }) }));

    it('is allowed for a faster time', async () => {
      await ok(put('alice', local('alice', { timeSec: 1400 })));
    });

    it('is refused for the same time or a slower one', async () => {
      await no(put('alice', local('alice', { timeSec: 1500 })));
      await no(put('alice', local('alice', { timeSec: 1600 })));
    });

    it('is refused for a faster time that is not allowed anyway', async () => {
      await no(put('alice', local('alice', { timeSec: 600 })));
      await no(put('alice', local('alice', { timeSec: 1400, name: '' })));
    });

    it('is refused for someone else', async () => {
      await no(put('bob', local('alice', { timeSec: 1400 }), `${RACE}_alice`));
      await no(env.as('bob').doc(`raceEntries/${RACE}_alice`).update({ timeSec: 1400 }));
    });
  });

  describe('removing a result', () => {
    beforeEach(() => env.seed({ [`raceEntries/${RACE}_alice`]: local('alice') }));

    it('is allowed for its own person', async () => {
      await ok(env.as('alice').doc(`raceEntries/${RACE}_alice`).delete());
    });

    it('is refused for someone else or a visitor', async () => {
      await no(env.as('bob').doc(`raceEntries/${RACE}_alice`).delete());
      await no(env.anon().doc(`raceEntries/${RACE}_alice`).delete());
    });
  });
});

describe('/duels/{duelId}', () => {
  const duel = (over = {}) => ({ participantIds: ['alice', 'bob'], status: 'pending', distanceKm: 5, ...over });

  it('can be read by the two people in it, not by anyone else', async () => {
    await env.seed({ 'duels/d1': duel() });
    await ok(env.as('alice').doc('duels/d1').get());
    await ok(env.as('bob').doc('duels/d1').get());
    await no(env.as('carol').doc('duels/d1').get());
    await no(env.anon().doc('duels/d1').get());
  });

  it('lists only the duels the person is in', async () => {
    await env.seed({ 'duels/d1': duel() });
    await ok(env.as('alice').collection('duels').where('participantIds', 'array-contains', 'alice').get());
    await no(env.as('carol').collection('duels').where('participantIds', 'array-contains', 'alice').get());
    await no(env.as('alice').collection('duels').get());
  });

  describe('creating one', () => {
    it('is allowed for one of the two people, as a pending challenge', async () => {
      await ok(env.as('alice').doc('duels/d1').set(duel()));
    });

    it('is refused for someone who is not one of the two people', async () => {
      await no(env.as('carol').doc('duels/d1').set(duel()));
      await no(env.anon().doc('duels/d1').set(duel()));
    });

    it('is refused unless there are exactly two people', async () => {
      await no(env.as('alice').doc('duels/d1').set(duel({ participantIds: ['alice'] })));
      await no(env.as('alice').doc('duels/d2').set(duel({ participantIds: ['alice', 'bob', 'carol'] })));
    });

    it('is refused if it starts as anything but pending', async () => {
      await no(env.as('alice').doc('duels/d1').set(duel({ status: 'active' })));
      await no(env.as('alice').doc('duels/d2').set(duel({ status: 'declined' })));
    });
  });

  describe('answering one', () => {
    beforeEach(() => env.seed({ 'duels/d1': duel() }));

    it('lets a person in it accept (active) or decline it', async () => {
      await ok(env.as('bob').doc('duels/d1').update({ status: 'active' }));
      await env.seed({ 'duels/d2': duel() });
      await ok(env.as('bob').doc('duels/d2').update({ status: 'declined' }));
    });

    it('refuses any other status', async () => {
      await no(env.as('bob').doc('duels/d1').update({ status: 'completed' }));
      await no(env.as('bob').doc('duels/d1').update({ status: 'pending' }));
      await no(env.as('bob').doc('duels/d1').update({ status: 'won' }));
    });

    it('refuses changing anything but the status', async () => {
      await no(env.as('bob').doc('duels/d1').update({ status: 'active', distanceKm: 1 }));
      await no(env.as('bob').doc('duels/d1').update({ winnerId: 'bob' }));
      await no(env.as('bob').doc('duels/d1').update({ participantIds: ['bob', 'carol'] }));
    });

    it('refuses someone who is not in it, and a visitor', async () => {
      await no(env.as('carol').doc('duels/d1').update({ status: 'active' }));
      await no(env.anon().doc('duels/d1').update({ status: 'active' }));
    });

    it('refuses once it has been answered', async () => {
      await env.seed({ 'duels/done': duel({ status: 'active' }), 'duels/no': duel({ status: 'declined' }) });
      await no(env.as('bob').doc('duels/done').update({ status: 'declined' }));
      await no(env.as('bob').doc('duels/no').update({ status: 'active' }));
    });
  });

  it('can never be deleted', async () => {
    await env.seed({ 'duels/d1': duel() });
    await no(env.as('alice').doc('duels/d1').delete());
    await no(env.as('bob').doc('duels/d1').delete());
  });
});
