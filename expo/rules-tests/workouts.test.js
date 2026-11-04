// A saved workout (workouts/{workoutId}). Like the other documents that carry a userId, it belongs to the person whose id is in it
// (owned-docs.test.js has the others). On top of that the phone writes its numbers, so calories, duration and distance are held to
// generous limits, and a workout that was finished can no longer be edited. The documents below are the shape app/workout/active.jsx
// writes: a finished workout (completed true) and one saved part way through (Save and Exit, completed false).
const { rulesEnv, ok, no } = require('./helpers');

const env = rulesEnv();

const finished = (over = {}) => ({
  userId: 'alice',
  workoutId: 'w1',
  name: 'Push Day',
  category: 'strength',
  difficulty: 'intermediate',
  exercises: [{ id: 'e1', name: 'Bench Press' }],
  duration: 2700,
  exercisesCompleted: 5,
  totalExercises: 5,
  caloriesBurned: 320,
  xpEarned: 100,
  completedAt: '2026-11-04T12:00:00.000Z',
  startedAt: '2026-11-04T11:15:00.000Z',
  completed: true,
  ...over,
});

const partWay = (over = {}) => finished({ exercisesCompleted: 2, partial: true, completed: false, ...over });

const mine = (id = 'w1') => env.as('alice').doc(`workouts/${id}`);

describe('/workouts/{workoutId}', () => {
  describe('who can use one', () => {
    it('lets a person save a finished workout and one saved part way, in their own name', async () => {
      await ok(mine('w1').set(finished()));
      await ok(mine('w2').set(partWay()));
    });

    it('lets the person it belongs to read it and delete it', async () => {
      await env.seed({ 'workouts/w1': finished() });
      await ok(mine('w1').get());
      await ok(mine('w1').delete());
    });

    it('refuses to save one in someone else\'s name, or one that says no one owns it', async () => {
      await no(env.as('alice').doc('workouts/w1').set(finished({ userId: 'bob' })));
      const { userId, ...noOwner } = finished();
      expect(userId).toBe('alice');
      await no(env.as('alice').doc('workouts/w1').set(noOwner));
    });

    it('turns away another signed-in person from reading, changing or deleting it', async () => {
      await env.seed({ 'workouts/w1': partWay() });
      const notBobs = env.as('bob').doc('workouts/w1');
      await no(notBobs.get());
      await no(notBobs.update({ duration: 60 }));
      // Taking it over: the new owner is the person asking, so only the old owner on the document itself stops this.
      await no(notBobs.update({ userId: 'bob' }));
      await no(notBobs.set(partWay({ userId: 'bob' })));
      await no(notBobs.delete());
    });

    it('lists only what the person asks for under their own id', async () => {
      await env.seed({ 'workouts/w1': finished() });
      await ok(env.as('alice').collection('workouts').where('userId', '==', 'alice').get());
      await no(env.as('bob').collection('workouts').where('userId', '==', 'alice').get());
      await no(env.as('alice').collection('workouts').get());
    });

    it('turns away a visitor who is not signed in', async () => {
      await env.seed({ 'workouts/w1': finished() });
      const doc = env.anon().doc('workouts/w1');
      await no(doc.get());
      await no(doc.set(finished()));
      await no(doc.update({ duration: 60 }));
      await no(doc.delete());
    });
  });

  describe('the limits on its numbers', () => {
    // [field, a value just inside the limit, a value just outside it]
    const limits = [
      ['caloriesBurned', 15000, 15001],
      ['duration', 86400, 86401],
      ['distance', 1000, 1000.5],
      ['distanceKm', 1000, 1000.5],
    ];

    it.each(limits)('accepts %s up to its limit and refuses more', async (field, inside, outside) => {
      await ok(mine('w1').set(finished({ [field]: inside })));
      await no(mine('w2').set(finished({ [field]: outside })));
      await no(mine('w3').set(partWay({ [field]: outside })));
    });

    it.each(limits)('accepts %s of zero and a real value, and refuses a negative one', async (field) => {
      await ok(mine('w1').set(finished({ [field]: 0 })));
      await ok(mine('w2').set(finished({ [field]: 12.5 })));
      await no(mine('w3').set(finished({ [field]: -1 })));
    });

    it.each(limits)('refuses %s when it is text, not a number', async (field) => {
      await no(mine('w1').set(finished({ [field]: '300' })));
    });

    it('lets a workout leave any of them out', async () => {
      const { caloriesBurned, duration, ...without } = finished();
      expect([caloriesBurned, duration]).toEqual([320, 2700]);
      await ok(mine('w1').set(without));
      await ok(mine('w2').set({ userId: 'alice', name: 'Walk', completed: true }));
    });

    it('accepts a workout that is at every limit at once, and refuses it when one of them is over', async () => {
      const atTheLimits = { caloriesBurned: 15000, duration: 86400, distance: 1000, distanceKm: 1000 };
      await ok(mine('w1').set(finished(atTheLimits)));
      await no(mine('w2').set(finished({ ...atTheLimits, distanceKm: 1001 })));
      await no(mine('w3').set(finished({ ...atTheLimits, caloriesBurned: 15001 })));
    });

    it('accepts the longest workout the app itself can write: 24 hours, at its fallback of 0.15 calories a second', async () => {
      await ok(mine('w1').set(finished({ duration: 86400, caloriesBurned: Math.round(86400 * 0.15) })));
    });
  });

  describe('editing one after it is saved', () => {
    it('refuses every change to a finished workout, even by the person it belongs to', async () => {
      await env.seed({ 'workouts/w1': finished() });
      const doc = mine('w1');
      await no(doc.update({ caloriesBurned: 100 }));
      await no(doc.update({ duration: 60 }));
      await no(doc.update({ name: 'Renamed' }));
      await no(doc.update({ note: 'a new field' }));
      await no(doc.set(finished({ caloriesBurned: 100 })));
    });

    it('refuses to reopen a finished workout by setting completed to false', async () => {
      await env.seed({ 'workouts/w1': finished() });
      await no(mine('w1').update({ completed: false }));
      await no(mine('w1').set(partWay()));
    });

    it('treats a workout with no completed field, as on the oldest ones, as finished', async () => {
      const { completed, ...old } = finished();
      expect(completed).toBe(true);
      await env.seed({ 'workouts/w1': old });
      await no(mine('w1').update({ caloriesBurned: 100 }));
      await no(mine('w1').update({ completed: false }));
    });

    it('lets one saved part way be changed, inside the limits', async () => {
      await env.seed({ 'workouts/w1': partWay() });
      await ok(mine('w1').update({ exercisesCompleted: 3, duration: 3000, caloriesBurned: 400 }));
      await ok(mine('w1').update({ name: 'Push Day (part)' }));
    });

    it('still holds a part-way workout to the limits when it is changed', async () => {
      await env.seed({ 'workouts/w1': partWay() });
      await no(mine('w1').update({ duration: 86401 }));
      await no(mine('w1').update({ caloriesBurned: 15001 }));
      await no(mine('w1').update({ distanceKm: 1001 }));
      await no(mine('w1').update({ caloriesBurned: -5 }));
    });

    it('does not let a part-way workout become a finished one, or lose its completed field', async () => {
      await env.seed({ 'workouts/w1': partWay() });
      await no(mine('w1').update({ completed: true }));
      const { completed, ...withoutIt } = partWay();
      expect(completed).toBe(false);
      await no(mine('w1').set(withoutIt));
    });

    it('does not let a part-way workout be handed to someone else', async () => {
      await env.seed({ 'workouts/w1': partWay() });
      await no(mine('w1').update({ userId: 'bob' }));
    });
  });
});
