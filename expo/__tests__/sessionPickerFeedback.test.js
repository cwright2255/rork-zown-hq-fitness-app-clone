// What the person's feedback does to the session picker (lib/sessionPicker.js): the weights More, Less, swaps and skips give an exercise, the
// exercises and bodyweight progressions excluded, and swapping one exercise of a session for another (swapOptions, replaceExercise, dropExercise).
// The rules the feedback has are tested in trainingFeedback.test.js; what is checked here is that however the feedback comes out, the session is
// still one the picker would stand behind: nothing a muscle that is not rested can take, nothing over the weekly limit, nothing an injury rules out,
// nothing the equipment cannot do, nothing that takes more time than there is. The numbers in the examples were worked out by hand from the rules at
// the top of lib/sessionPicker.js, the way sessionPicker.test.js does.
import {
  SESSION_RULES, EQUIPMENT_PRESETS, pickSession, swapOptions, replaceExercise, dropExercise, weeklyVolume, currentRungs, sessionToWorkout,
} from '../lib/sessionPicker';
import { LIBRARY, LADDERS, getExercise } from '../lib/exerciseLibrary';
import { MUSCLES } from '../lib/muscleVocabulary';
import { FEEDBACK_RULES, feedbackKey } from '../lib/trainingFeedback';
import { calculateMuscleRecovery } from '../lib/muscleRecovery';
import { blockedBy, INJURY_IDS } from '../lib/injuryRules';

const tiredExcept = (...ready) => Object.fromEntries(MUSCLES.filter((m) => !ready.includes(m)).map((m) => [m, 20]));
const ids = (s) => s.exercises.map((x) => x.id);
const base = { level: 'intermediate', goal: 'muscle', minutes: 45 };
const chest = { ...base, recovery: tiredExcept('chest') };
const bodyweight = { ...base, equipment: 'bodyweight', recovery: tiredExcept('chest', 'core') };
const minutesOf = (x) => (x.sets * (x.workSeconds + x.restSeconds) + SESSION_RULES.transitionSeconds) / 60;
const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); }
  return o;
};

describe('with no feedback', () => {
  it('the session is exactly what it was: empty or neutral weights, and nothing excluded, change nothing', () => {
    [base, chest, bodyweight, { ...base, equipment: 'dumbbells', goal: 'strength' }].forEach((options) => {
      const plain = pickSession(options);
      expect(pickSession({ ...options, weights: {} })).toEqual(plain);
      expect(pickSession({ ...options, weights: { 'barbell-bench-press': 1, deadlift: 1 } })).toEqual(plain);
      expect(pickSession({ ...options, excluded: [] })).toEqual(plain);
      expect(pickSession({ ...options, weights: {}, excluded: [] })).toEqual(plain);
    });
  });

  it('a session picked by the engine is not marked as edited', () => {
    expect(pickSession(base).edited).toBeUndefined();
  });
});

describe('weights (More, Less, swaps and skips)', () => {
  it('Less on the exercise that was picked first puts the next best in its place; More on it keeps it', () => {
    expect(ids(pickSession(chest))).toEqual(['dumbbell-bench-press', 'dumbbell-pullover']);
    expect(ids(pickSession({ ...chest, weights: { 'dumbbell-bench-press': 0.7 } }))).toEqual(['barbell-bench-press', 'dumbbell-pullover']);
    expect(ids(pickSession({ ...chest, weights: { 'dumbbell-bench-press': 1.3 } }))).toEqual(['dumbbell-bench-press', 'dumbbell-pullover']);
  });

  it('are read by the exercise\'s key: a bodyweight progression\'s weight counts for whichever rung is on offer', () => {
    // No weight on the ladder: the push-up (the rung for this person) is picked. A strong Less on the ladder takes it out of the running for the
    // plank and the bird dog, which have the core to themselves.
    expect(ids(pickSession(bodyweight))).toEqual(['push-up', 'plank', 'bird-dog']);
    const tight = { ...bodyweight, minutes: 10 };
    const without = pickSession(tight);
    const less = pickSession({ ...tight, weights: { 'ladder:push': 0.35 } });
    expect(ids(less)).not.toEqual(ids(without));
    // the weight by the rung's own id is not the ladder's key, and does nothing
    expect(pickSession({ ...tight, weights: { 'push-up': 0.35 } })).toEqual(without);
  });

  it('More never takes an exercise out of a session, and Less never puts one in (every exercise in the library, four kinds of lifter)', () => {
    const lifters = {
      gym: base, chest, bodyweight: { ...base, equipment: 'bodyweight', minutes: 30 }, dumbbells: { ...base, equipment: 'dumbbells' },
    };
    Object.entries(lifters).forEach(([label, options]) => {
      const picked = new Set(pickSession(options).exercises.map((x) => feedbackKey(x)));
      LIBRARY.forEach((e) => {
        const key = feedbackKey(e);
        const more = new Set(pickSession({ ...options, weights: { [key]: FEEDBACK_RULES.more } }).exercises.map((x) => feedbackKey(x)));
        const less = new Set(pickSession({ ...options, weights: { [key]: FEEDBACK_RULES.less } }).exercises.map((x) => feedbackKey(x)));
        if (picked.has(key)) expect({ label, id: e.id, kept: more.has(key) }).toEqual({ label, id: e.id, kept: true });
        else expect({ label, id: e.id, added: less.has(key) }).toEqual({ label, id: e.id, added: false });
      });
    });
  });

  it('are kept inside what the feedback rules can produce: a wrong number cannot swamp everything else', () => {
    const top = FEEDBACK_RULES.more;
    const bottom = FEEDBACK_RULES.less * FEEDBACK_RULES.floor;
    ['dumbbell-bench-press', 'dumbbell-pullover', 'barbell-bench-press'].forEach((id) => {
      expect(pickSession({ ...chest, weights: { [id]: 1000 } })).toEqual(pickSession({ ...chest, weights: { [id]: top } }));
      expect(pickSession({ ...chest, weights: { [id]: 1e-9 } })).toEqual(pickSession({ ...chest, weights: { [id]: bottom } }));
    });
  });

  it('count as the nearest weight the rules can produce when they compete with another exercise: past More is no more than More, and past Less is no less than Less', () => {
    const top = FEEDBACK_RULES.more;
    const bottom = FEEDBACK_RULES.less * FEEDBACK_RULES.floor;
    const legs = { ...base, recovery: tiredExcept('quadriceps', 'hamstrings', 'glutes') };
    const fresh = { ...base };
    // [options, the exercise given a weight beyond the rules, the exercise it competes with]: each pair is one where the beyond-the-rules weight would
    // change the session if it were taken as it is
    const rivals = [
      [chest, 'dumbbell-pullover', 'dumbbell-bench-press'],
      [chest, 'dumbbell-pullover', 'barbell-bench-press'],
      [bodyweight, 'bird-dog', 'push-up'],
      [fresh, 'barbell-row', 'deadlift'],
      [fresh, 'barbell-back-squat', 'deadlift'],
      [legs, 'trap-bar-deadlift', 'barbell-back-squat'],
    ];
    rivals.forEach(([opts, x, y]) => {
      expect(pickSession({ ...opts, weights: { [x]: 1000, [y]: top } })).toEqual(pickSession({ ...opts, weights: { [x]: top, [y]: top } }));
    });
    const lows = [[legs, 'lying-leg-curl', 'seated-leg-curl']];
    lows.forEach(([opts, x, y]) => {
      expect(pickSession({ ...opts, weights: { [x]: 1e-9, [y]: bottom } })).toEqual(pickSession({ ...opts, weights: { [x]: bottom, [y]: bottom } }));
    });
  });

  it('are ignored when they are not a positive number', () => {
    const plain = pickSession(chest);
    ['x', null, undefined, NaN, Infinity, -Infinity, 0, -2, {}, [], true].forEach((w) => {
      expect(pickSession({ ...chest, weights: { 'dumbbell-bench-press': w } })).toEqual(plain);
    });
    [undefined, null, 'x', 5, []].forEach((weights) => expect(pickSession({ ...chest, weights })).toEqual(plain));
  });

  it('change only which exercises are picked: the sets, the reps, the rest and the reasons are the picker\'s, as ever', () => {
    const weighted = pickSession({ ...chest, weights: { 'dumbbell-bench-press': 0.7 } });
    const barbell = weighted.exercises[0];
    const plainBarbell = pickSession({ ...chest, excluded: ['dumbbell-bench-press'] }).exercises[0];
    expect(barbell).toEqual(plainBarbell);
  });

  it('never let a muscle that is not rested be worked, however much More there is', () => {
    const everythingMore = Object.fromEntries(LIBRARY.map((e) => [feedbackKey(e), FEEDBACK_RULES.more]));
    const session = pickSession({ ...base, recovery: { ...tiredExcept('chest'), chest: 100, lats: 60, quadriceps: 69 }, weights: everythingMore });
    session.exercises.forEach((x) => x.primary.forEach((m) => expect(m).toBe('chest')));
  });

  it('never lift a weekly limit, however much More there is', () => {
    // Chest is 8 sets in this week and 10 the week before: it may reach 11, so a 3-set press fits exactly and nothing more does.
    const options = { ...chest, volume: { thisWeek: { chest: 8 }, lastWeek: { chest: 10 }, sessions: {} }, weights: { 'cable-crossover': 1.3, 'pec-deck-fly': 1.3, 'dumbbell-pullover': 1.3 } };
    const session = pickSession(options);
    const sets = session.exercises.reduce((sum, x) => sum + (x.primary.includes('chest') ? x.sets : 0), 0);
    expect(8 + sets).toBeLessThanOrEqual(11);
  });

  it('never bring back an exercise an injury rules out', () => {
    const shoulder = { ...base, injuries: ['shoulder'], recovery: tiredExcept('chest', 'shoulders') };
    const everythingMore = Object.fromEntries(LIBRARY.map((e) => [feedbackKey(e), FEEDBACK_RULES.more]));
    const session = pickSession({ ...shoulder, weights: everythingMore });
    session.exercises.forEach((x) => expect(blockedBy(getExercise(x.id), ['shoulder'])).toEqual([]));
    expect(session.leftOutFor).toEqual(['shoulder']);
  });

  it('are not changed by the picker, and give the same session each time', () => {
    const options = deepFreeze({ ...chest, weights: { 'dumbbell-bench-press': 0.7 }, excluded: ['dumbbell-pullover'] });
    expect(pickSession(options)).toEqual(pickSession(options));
  });
});

describe('excluded exercises and progressions', () => {
  it('an excluded bodyweight progression is out whole: the easier rungs are not offered in its place', () => {
    expect(ids(pickSession(bodyweight))).toContain('push-up');
    const out = pickSession({ ...bodyweight, excluded: ['ladder:push'] });
    expect(ids(out)).toEqual(['plank', 'bird-dog']);
    LIBRARY.filter((e) => e.ladder && e.ladder.name === 'push').forEach((e) => expect(ids(out)).not.toContain(e.id));
  });

  it('only the rung that was excluded by its own id leaves the others (the picker falls back to the easier one: why the screen excludes the ladder)', () => {
    expect(ids(pickSession({ ...bodyweight, excluded: ['push-up'] }))).toEqual(['knee-push-up', 'plank', 'bird-dog']);
  });

  it('every ladder in the library can be excluded whole', () => {
    LADDERS.forEach((name) => {
      const out = pickSession({ ...base, level: 'advanced', equipment: 'bodyweight', excluded: [`ladder:${name}`] });
      out.exercises.forEach((x) => expect(getExercise(x.id).ladder && getExercise(x.id).ladder.name).not.toBe(name));
    });
  });

  it('a ladder key that is not a ladder, and an id that does not exist, exclude nothing', () => {
    const plain = pickSession(base);
    expect(pickSession({ ...base, excluded: ['ladder:nonsense', 'ladder:', 'ladder', 'no-such-exercise'] })).toEqual(plain);
  });

  it('the "nothing fits" message says the exercises excluded are part of why', () => {
    // (With nothing excluded the library always has something to offer, so this is the only way to see the message.)
    const everything = LIBRARY.filter((e) => e.pattern !== 'conditioning').map((e) => e.id);
    const out = pickSession({ ...base, excluded: everything });
    expect(out.status).toBe('limited');
    expect(out.message).toBe('Nothing in the exercise library fits your equipment, your level, the injuries you reported and the exercises you excluded.');
    expect(pickSession({ ...base, excluded: LIBRARY.filter((e) => e.pattern !== 'conditioning').map((e) => feedbackKey(e)) }).status).toBe('limited');
  });

  it('never says "nothing fits" when nothing is excluded, for any equipment, any level and any combination of the eight injuries', () => {
    let tried = 0;
    Object.keys(EQUIPMENT_PRESETS).forEach((equipment) => {
      ['beginner', 'intermediate', 'advanced'].forEach((level) => {
        for (let mask = 0; mask < (1 << INJURY_IDS.length); mask += 1) {
          const injuries = INJURY_IDS.filter((_, i) => mask & (1 << i));
          expect(pickSession({ level, goal: 'muscle', minutes: 45, equipment, injuries }).status).not.toBe('limited');
          tried += 1;
        }
      });
    });
    expect(tried).toBe(Object.keys(EQUIPMENT_PRESETS).length * 3 * 2 ** INJURY_IDS.length);
  });
});

describe('swapOptions', () => {
  const session = pickSession(chest);
  const first = session.exercises[0];

  it('offers the next three that fit, best first, for the muscle the exercise mainly works', () => {
    expect(swapOptions(chest, session, first.id).map((x) => x.id)).toEqual(['barbell-bench-press', 'dumbbell-floor-press', 'machine-chest-press']);
    expect(swapOptions(chest, session, 'dumbbell-pullover').map((x) => x.id)).toEqual(['cable-crossover', 'low-cable-fly', 'pec-deck-fly']);
  });

  it('offers exercises that share a main muscle with the one being replaced, are not in the session, and are not the one being replaced', () => {
    [chest, base, { ...base, equipment: 'dumbbells' }].forEach((options) => {
      const s = pickSession(options);
      s.exercises.forEach((x) => {
        swapOptions(options, s, x.id, { limit: 20 }).forEach((o) => {
          expect(o.primary.some((m) => x.primary.includes(m))).toBe(true);
          expect(ids(s)).not.toContain(o.id);
          expect(o.id).not.toBe(x.id);
        });
      });
    });
  });

  it('gives each one as the picker gives an exercise: sets, reps, rest, a reason worked out for its place, and no weight yet', () => {
    const [alt] = swapOptions(chest, session, first.id);
    expect(Object.keys(alt).sort()).toEqual(Object.keys(first).sort());
    expect(alt).toMatchObject({ id: 'barbell-bench-press', sets: 3, role: 'compound', timed: false, weight: null, unit: null, target: null, detail: null });
    expect(alt.reason).toBe("Chest: fully rested, 11 sets short of this week's 14-set aim.");
    expect(alt.reps).toBe(`${alt.repRange.min}-${alt.repRange.max}`);
    expect(alt.muscleGroups).toEqual([...getExercise(alt.id).primary, ...getExercise(alt.id).secondary]);
  });

  it('counts what is left of the session against the muscles: what it offers fits the session as it now stands', () => {
    // Chest has 5 sets this week and 10 the week before, so it may reach 11: the press and the pullover (3 sets each) use up 6 of it.
    const options = { ...chest, volume: { thisWeek: { chest: 5 }, lastWeek: { chest: 10 }, sessions: {} } };
    const s = pickSession(options);
    expect(ids(s)).toEqual(['dumbbell-bench-press', 'dumbbell-pullover']);
    s.exercises.forEach((x) => {
      swapOptions(options, s, x.id).forEach((o) => {
        const swapped = replaceExercise(s, x.id, o);
        const sets = swapped.exercises.reduce((sum, e) => sum + e.sets, 0);
        expect(5 + sets).toBeLessThanOrEqual(11);
      });
    });
  });

  it('puts the one the person gave More first, and the one they gave Less last, and leaves out an excluded one', () => {
    const [a, b, c] = swapOptions(chest, session, first.id).map((x) => x.id);
    expect([a, b, c]).toEqual(['barbell-bench-press', 'dumbbell-floor-press', 'machine-chest-press']);
    expect(swapOptions({ ...chest, weights: { 'machine-chest-press': 1.3 } }, session, first.id)[0].id).toBe('machine-chest-press');
    expect(swapOptions({ ...chest, weights: { 'barbell-bench-press': 0.7 } }, session, first.id)[0].id).not.toBe('barbell-bench-press');
    expect(swapOptions({ ...chest, excluded: ['barbell-bench-press'] }, session, first.id).map((x) => x.id)).toEqual([
      'dumbbell-floor-press', 'machine-chest-press', 'incline-dumbbell-press',
    ]);
  });

  it('never offers what is not allowed: the equipment, the injuries and the excluded', () => {
    const dumbbells = { ...base, equipment: 'dumbbells', recovery: tiredExcept('chest') };
    const s = pickSession(dumbbells);
    swapOptions(dumbbells, s, s.exercises[0].id, { limit: 20 }).forEach((o) => {
      getExercise(o.id).equipment.forEach((q) => expect(q === 'bodyweight' || EQUIPMENT_PRESETS.dumbbells.includes(q)).toBe(true));
    });
    const shoulder = { ...base, injuries: ['shoulder'], recovery: tiredExcept('chest', 'shoulders') };
    const s2 = pickSession(shoulder);
    s2.exercises.forEach((x) => swapOptions(shoulder, s2, x.id, { limit: 20 }).forEach((o) => expect(blockedBy(getExercise(o.id), ['shoulder'])).toEqual([])));
  });

  it('never offers a muscle that is not rested', () => {
    const s = pickSession(chest);
    swapOptions(chest, s, s.exercises[0].id, { limit: 50 }).forEach((o) => o.primary.forEach((m) => expect(m).toBe('chest')));
  });

  it('offers no other rung of a bodyweight progression, and says nothing fits when nothing does', () => {
    const s = pickSession(bodyweight);
    expect(swapOptions(bodyweight, s, 'push-up')).toEqual([]);
    expect(swapOptions(bodyweight, s, 'plank').map((x) => x.id)).toEqual(['side-plank', 'lying-leg-raise', 'sit-up']);
  });

  it('does not offer an excluded bodyweight progression\'s rungs', () => {
    const s = pickSession(bodyweight);
    const out = swapOptions({ ...bodyweight, excluded: ['ladder:plank'] }, s, 'bird-dog', { limit: 20 });
    out.forEach((o) => expect(getExercise(o.id).ladder && getExercise(o.id).ladder.name).not.toBe('plank'));
  });

  it('gives the number asked for, three by default, and a whole number of them', () => {
    expect(swapOptions(chest, session, first.id, { limit: 1 }).map((x) => x.id)).toEqual(['barbell-bench-press']);
    expect(swapOptions(chest, session, first.id, { limit: 2.9 }).map((x) => x.id)).toEqual(['barbell-bench-press', 'dumbbell-floor-press']);
    expect(swapOptions(chest, session, first.id, { limit: 0 })).toEqual([]);
    expect(swapOptions(chest, session, first.id, { limit: -1 })).toEqual([]);
    expect(swapOptions(chest, session, first.id, { limit: 10 })).toHaveLength(10);
    expect(swapOptions(chest, session, first.id, { limit: NaN })).toHaveLength(3);
    expect(swapOptions(chest, session, first.id, { limit: 'x' })).toHaveLength(3);
    expect(swapOptions(chest, session, first.id)).toHaveLength(3);
  });

  it('gives nothing for an exercise that is not in the session, or a session that is not a session', () => {
    expect(swapOptions(chest, session, 'deadlift')).toEqual([]);
    expect(swapOptions(chest, session, undefined)).toEqual([]);
    [undefined, null, 'x', 5, {}, { status: 'rest', exercises: [] }, { status: 'ok' }, { status: 'ok', exercises: 'x' }].forEach((s) => {
      expect(swapOptions(chest, s, first.id)).toEqual([]);
    });
  });

  it('gives nothing when the options themselves leave nothing to pick from', () => {
    const chestIds = LIBRARY.filter((e) => e.primary.includes('chest')).map((e) => e.id);
    expect(swapOptions({ ...chest, excluded: chestIds.filter((id) => id !== first.id) }, session, first.id)).toEqual([]);
    expect(swapOptions({ ...base, recovery: tiredExcept() }, session, first.id)).toEqual([]);
    expect(swapOptions({ ...base, excluded: LIBRARY.map((e) => e.id) }, session, first.id)).toEqual([]);
  });

  it('is the same each time, and changes nothing it is given', () => {
    const frozen = deepFreeze(pickSession(chest));
    const options = deepFreeze({ ...chest });
    expect(swapOptions(options, frozen, frozen.exercises[0].id)).toEqual(swapOptions(options, frozen, frozen.exercises[0].id));
  });

  it('does not throw on odd options', () => {
    [undefined, null, 'x', 5, [], {}].forEach((options) => expect(() => swapOptions(options, session, first.id)).not.toThrow());
  });
});

describe('replaceExercise', () => {
  const session = pickSession(chest);
  const options = swapOptions(chest, session, 'dumbbell-bench-press');

  it('puts the replacement in the place of the exercise, leaves the others as they are, and says the session was edited', () => {
    const out = replaceExercise(session, 'dumbbell-bench-press', options[0]);
    expect(ids(out)).toEqual(['barbell-bench-press', 'dumbbell-pullover']);
    expect(out.exercises[1]).toBe(session.exercises[1]);
    expect(out.edited).toBe(true);
    expect(out.status).toBe('ok');
    expect(out.goal).toBe(session.goal);
    expect(out.leftOutFor).toEqual(session.leftOutFor);
    expect(session.edited).toBeUndefined();
  });

  it('works the totals out again from what is in the session', () => {
    const out = replaceExercise(session, 'dumbbell-pullover', { ...swapOptions(chest, session, 'dumbbell-pullover')[0], sets: 2 });
    expect(out.totalSets).toBe(3 + 2);
    expect(out.minutes).toBe(Math.round(out.exercises.reduce((sum, x) => sum + minutesOf(x), 0)));
  });

  it('puts the compound lifts first again, as the picker does', () => {
    const accessory = session.exercises[1];
    const compound = { ...swapOptions(chest, session, 'dumbbell-bench-press')[0] };
    // swapping the accessory for a compound lift moves it up
    const out = replaceExercise(session, accessory.id, compound);
    expect(out.exercises.map((x) => x.role)).toEqual(['compound', 'compound']);
  });

  it('moves an accessory that took the place of a compound lift behind the compound lifts, and keeps each group in the order it was in', () => {
    const long = { ...base, minutes: 60 };
    const full = pickSession(long);
    const compounds = full.exercises.filter((x) => x.role === 'compound');
    expect(compounds.length).toBeGreaterThan(2);
    const second = full.exercises[1];
    expect(second.role).toBe('compound');
    const accessory = swapOptions(long, full, second.id, { limit: 30 }).find((x) => x.role !== 'compound');
    expect(accessory).toBeDefined();
    const out = replaceExercise(full, second.id, accessory);
    // the accessory went in at the second place, and comes out after every compound lift
    expect(out.exercises.map((x) => x.role === 'compound')).toEqual(out.exercises.map((x, i) => i < compounds.length - 1));
    expect(ids(out).slice(0, compounds.length - 1)).toEqual(compounds.filter((x) => x.id !== second.id).map((x) => x.id));
    expect(ids(out).slice(compounds.length - 1)).toEqual([accessory.id, ...full.exercises.filter((x) => x.role !== 'compound').map((x) => x.id)]);
    // and the same when an exercise is dropped from the front
    const dropped = dropExercise(full, full.exercises[0].id);
    expect(dropped.exercises.map((x) => x.role === 'compound')).toEqual(dropped.exercises.map((x, i) => i < compounds.length - 1));
  });

  it('names the session again from what is in it', () => {
    const noChest = pickSession({ ...base, recovery: tiredExcept('quadriceps', 'hamstrings', 'glutes') });
    const alt = swapOptions({ ...base, recovery: tiredExcept('quadriceps', 'hamstrings', 'glutes') }, noChest, noChest.exercises[0].id)[0];
    expect(replaceExercise(noChest, noChest.exercises[0].id, alt).name).toEqual(expect.any(String));
    expect(replaceExercise(session, 'dumbbell-bench-press', options[0]).name).toBe('Chest');
  });

  it('is the same session when the exercise is not in it, or what it is given is not usable', () => {
    expect(replaceExercise(session, 'deadlift', options[0])).toBe(session);
    expect(replaceExercise(session, 'dumbbell-bench-press', undefined)).toBe(session);
    expect(replaceExercise(session, 'dumbbell-bench-press', 'x')).toBe(session);
    expect(replaceExercise({ status: 'rest', exercises: [] }, 'x', options[0]).status).toBe('rest');
    [undefined, null, 'x', 5].forEach((s) => expect(replaceExercise(s, 'x', options[0])).toBe(s));
    const bad = { status: 'ok', exercises: 'x' };
    expect(replaceExercise(bad, 'x', options[0])).toBe(bad);
  });

  it('changes nothing it is given', () => {
    const frozen = deepFreeze(pickSession(chest));
    const alt = deepFreeze(swapOptions(chest, frozen, 'dumbbell-bench-press')[0]);
    expect(() => replaceExercise(frozen, 'dumbbell-bench-press', alt)).not.toThrow();
  });

  it('can still be saved as a workout, with the replacement in it and the engine as its source', () => {
    const workout = sessionToWorkout(replaceExercise(session, 'dumbbell-bench-press', options[0]));
    expect(workout.source).toBe('engine_session');
    expect(workout.exercises.map((x) => x.name)).toEqual(['Barbell Bench Press', 'Dumbbell Pullover']);
  });

  it('can be done again on the session that came out: swap, then swap again', () => {
    const once = replaceExercise(session, 'dumbbell-bench-press', options[0]);
    const again = swapOptions(chest, once, 'barbell-bench-press');
    // the one swapped out is not in the session now, so it may be offered; the one being replaced never is
    expect(again.map((x) => x.id)).toContain('dumbbell-bench-press');
    expect(again.map((x) => x.id)).not.toContain('barbell-bench-press');
    const twice = replaceExercise(once, 'barbell-bench-press', again[0]);
    expect(twice.exercises).toHaveLength(2);
    expect(twice.edited).toBe(true);
  });
});

describe('dropExercise', () => {
  const session = pickSession(chest);

  it('takes the exercise out, works the totals out again, and says the session was edited', () => {
    const out = dropExercise(session, 'dumbbell-bench-press');
    expect(ids(out)).toEqual(['dumbbell-pullover']);
    expect(out.edited).toBe(true);
    expect(out.totalSets).toBe(3);
    expect(out.minutes).toBe(Math.round(minutesOf(out.exercises[0])));
  });

  it('is null when it would leave nothing', () => {
    expect(dropExercise(dropExercise(session, 'dumbbell-bench-press'), 'dumbbell-pullover')).toBeNull();
  });

  it('is the same session when the exercise is not in it, or it is not a session', () => {
    expect(dropExercise(session, 'deadlift')).toBe(session);
    [undefined, null, 'x', 5].forEach((s) => expect(dropExercise(s, 'x')).toBe(s));
    const rest = { status: 'rest', exercises: [] };
    expect(dropExercise(rest, 'x')).toBe(rest);
  });

  it('changes nothing it is given', () => {
    expect(() => dropExercise(deepFreeze(pickSession(chest)), 'dumbbell-bench-press')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Six weeks of made-up lifters whose feedback is as awkward as can be: strong More and Less on a good part of the library, swaps and skips, and
// whole progressions and many exercises excluded. Every day, whatever the picker gives must still be a session it would stand behind, and so must
// every session that comes of swapping any one of its exercises for any one it offers.

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 7, 3, 18, 0, 0); // a Monday evening
const capFor = (lastWeek) => Math.min(20, Math.max(10, Math.ceil((lastWeek || 0) * 1.1 - 1e-9)));
// A small seeded generator, so the same feedback comes out every run.
function mulberry32(seed) {
  let a = seed;
  return () => {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const FACTORS = [FEEDBACK_RULES.more, FEEDBACK_RULES.less, 0.81, 0.729, 0.5, 0.35, 0.65, 1.053, 0.567];
function awkwardFeedback(seed) {
  const rand = mulberry32(seed);
  const keys = [...new Set(LIBRARY.map((e) => feedbackKey(e)))];
  const weights = {};
  keys.forEach((k) => { if (rand() < 0.4) weights[k] = FACTORS[Math.floor(rand() * FACTORS.length)]; });
  const excluded = [];
  keys.forEach((k) => { if (!k.startsWith('ladder:') && rand() < 0.08) excluded.push(k); });
  LADDERS.forEach((name) => { if (rand() < 0.15) excluded.push(`ladder:${name}`); });
  return { weights, excluded };
}

const LIFTERS = {
  'a beginner with a gym, 30 minutes': { level: 'beginner', goal: 'general', minutes: 30 },
  'an intermediate lifter, 45 minutes, building muscle': { level: 'intermediate', goal: 'muscle', minutes: 45 },
  'an advanced lifter, 60 minutes, strength': { level: 'advanced', goal: 'strength', minutes: 60 },
  'a lifter with dumbbells and a bench': { level: 'intermediate', goal: 'muscle', minutes: 45, equipment: 'dumbbells' },
  'a beginner with no equipment': { level: 'beginner', goal: 'general', minutes: 30, equipment: 'bodyweight' },
  'a lifter protecting a shoulder and a knee': { level: 'intermediate', goal: 'muscle', minutes: 45, injuries: ['shoulder', 'knee'] },
  'a lifter with 15 minutes': { level: 'intermediate', goal: 'muscle', minutes: 15 },
};

const patternLimit = (pattern) => (pattern in SESSION_RULES.perPatternMax ? SESSION_RULES.perPatternMax[pattern] : SESSION_RULES.perPatternMax.default);

// What must be true of any session, edited or not, on a day with this recovery and this volume.
function mustHold(session, { options, recovery, volume, history, now, label }) {
  const where = { label };
  expect(session.exercises.length).toBeLessThanOrEqual(SESSION_RULES.maxExercises);
  expect({ ...where, minutes: session.minutes <= options.minutes }).toEqual({ ...where, minutes: true });
  session.exercises.forEach((x) => {
    expect(x.sets).toBeGreaterThanOrEqual(1);
    x.primary.forEach((m) => {
      const recovered = Number.isFinite(recovery[m]) ? recovery[m] : 100;
      expect({ ...where, id: x.id, m, ready: recovered >= SESSION_RULES.readyRecovery }).toEqual({ ...where, id: x.id, m, ready: true });
    });
    getExercise(x.id).equipment.forEach((q) => {
      const have = new Set(options.equipment === undefined ? EQUIPMENT_PRESETS.gym : EQUIPMENT_PRESETS[options.equipment]);
      expect(q === 'bodyweight' || have.has(q)).toBe(true);
    });
    expect(blockedBy(getExercise(x.id), options.injuries || [])).toEqual([]);
  });
  expect(new Set(ids(session)).size).toBe(session.exercises.length);
  const byPattern = {};
  session.exercises.forEach((x) => {
    const lib = getExercise(x.id);
    const key = lib.pattern === 'isolation' || lib.pattern === 'core' ? lib.pattern : `compound:${lib.pattern}`;
    byPattern[key] = (byPattern[key] || 0) + 1;
    expect(byPattern[key]).toBeLessThanOrEqual(key.startsWith('compound:') ? patternLimit('default') : patternLimit(key));
  });
  // the weekly limit, with the session counted in
  const after = weeklyVolume({
    workouts: [...history, {
      completedAt: new Date(now).toISOString(),
      exercises: session.exercises.map((x) => ({ name: x.name, sets: x.sets, done: true, performed: Array.from({ length: x.sets }, () => ({ weight: 50, reps: 10, rpe: 'hard' })) })),
    }],
    now: new Date(now),
  });
  const touched = new Set(session.exercises.flatMap((x) => [...x.primary, ...x.secondary]));
  MUSCLES.forEach((m) => expect(after.thisWeek[m] || 0).toBeLessThanOrEqual(20 + 1e-9));
  touched.forEach((m) => expect({ ...where, m, within: (after.thisWeek[m] || 0) <= capFor(volume.lastWeek[m]) + 1e-9 }).toEqual({ ...where, m, within: true }));
}

describe.each(Object.keys(LIFTERS))('feedback that is as awkward as it can be: %s', (label) => {
  const options = LIFTERS[label];
  const { weeks, ...pickOptions } = { weeks: 6, ...options };

  it('never gives a session the picker would not stand behind, never an excluded exercise, and every swap it offers keeps it so', () => {
    const history = [];
    let sessionsSeen = 0;
    let swapsSeen = 0;
    for (let w = 0; w < weeks; w += 1) {
      [0, 2, 4].forEach((d) => {
        const now = START + (7 * w + d) * DAY;
        const recovery = calculateMuscleRecovery({ completedWorkouts: history, now: new Date(now) });
        const volume = weeklyVolume({ workouts: history, now: new Date(now) });
        const { weights, excluded } = awkwardFeedback(1000 * w + d + label.length);
        const input = { ...pickOptions, recovery, volume, ladderRungs: currentRungs(history), weights, excluded };
        const session = pickSession(input);
        expect(['ok', 'rest', 'full', 'limited']).toContain(session.status);
        if (session.status !== 'ok') return;
        sessionsSeen += 1;
        const gone = new Set(excluded);
        session.exercises.forEach((x) => {
          expect(gone.has(x.id)).toBe(false);
          expect(gone.has(feedbackKey(x))).toBe(false);
        });
        const env = { options, recovery, volume, history, now, label };
        mustHold(session, env);
        // Every swap on offer, for every exercise: the session that comes of it holds too, and the exclusions are kept.
        session.exercises.forEach((x) => {
          swapOptions(input, session, x.id).forEach((o) => {
            swapsSeen += 1;
            const swapped = replaceExercise(session, x.id, o);
            expect(swapped.edited).toBe(true);
            expect(gone.has(o.id)).toBe(false);
            expect(gone.has(feedbackKey(o))).toBe(false);
            mustHold(swapped, env);
          });
        });
        // Dropping any one of them leaves a session that holds as well.
        session.exercises.forEach((x) => {
          const rest = dropExercise(session, x.id);
          if (rest) mustHold(rest, env);
        });
        history.push({
          completedAt: new Date(now).toISOString(),
          exercises: session.exercises.map((x) => ({ name: x.name, sets: x.sets, done: true, performed: Array.from({ length: x.sets }, () => ({ weight: 50, reps: 10, rpe: 'hard' })) })),
        });
      });
    }
    expect(sessionsSeen).toBeGreaterThanOrEqual(15);
    // (the checks above had something to check: 18 training days a lifter, and dozens of swaps on offer)
    expect(swapsSeen).toBeGreaterThanOrEqual(50);
  });
});
