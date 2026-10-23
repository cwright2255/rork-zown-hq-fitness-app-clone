import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';
import {
  LIBRARY, EQUIPMENT, PATTERNS, LEVELS, LADDERS, normalizeName, getExercise, findExercise, getLadder,
} from '../lib/exerciseLibrary';
import { MUSCLES, isMuscle } from '../lib/muscleVocabulary';
import { WORKOUT_PROGRAMS } from '../data/workoutPrograms';

const FIELDS = ['id', 'name', 'aliases', 'primary', 'secondary', 'equipment', 'pattern', 'difficulty', 'ladder', 'source', 'sourceId'];
const isText = (v) => typeof v === 'string' && v.trim() === v && v.length > 0;
const idOf = (name) => (findExercise(name) || {}).id || null;

describe('every entry in the library', () => {
  it('has all its fields and no others', () => {
    EXERCISE_LIBRARY.forEach((e) => {
      expect(Object.keys(e).sort()).toEqual([...FIELDS].sort());
    });
  });

  it('has the right kind of value in each field', () => {
    EXERCISE_LIBRARY.forEach((e) => {
      const where = e.id;
      expect([where, isText(e.id)]).toEqual([where, true]);
      expect([where, isText(e.name)]).toEqual([where, true]);
      expect([where, Array.isArray(e.aliases) && e.aliases.every(isText)]).toEqual([where, true]);
      expect([where, Array.isArray(e.primary) && e.primary.length > 0]).toEqual([where, true]);
      expect([where, Array.isArray(e.secondary)]).toEqual([where, true]);
      expect([where, Array.isArray(e.equipment) && e.equipment.length > 0]).toEqual([where, true]);
      expect([where, e.ladder === null || (isText(e.ladder.name) && Number.isInteger(e.ladder.rung) && e.ladder.rung >= 1)]).toEqual([where, true]);
      expect([where, e.source === 'free-exercise-db' || e.source === 'zown']).toEqual([where, true]);
      expect([where, e.source === 'zown' ? e.sourceId === null : isText(e.sourceId)]).toEqual([where, true]);
    });
  });

  it('has an id of lowercase words joined by hyphens, that no other entry has', () => {
    const ids = EXERCISE_LIBRARY.map((e) => e.id);
    ids.forEach((id) => expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has a name no other entry has', () => {
    const names = EXERCISE_LIBRARY.map((e) => normalizeName(e.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it('has aliases in lowercase, that no other name or alias in the library has', () => {
    const seen = new Map();
    EXERCISE_LIBRARY.forEach((e) => {
      [e.name, ...e.aliases].forEach((n, i) => {
        if (i > 0) expect(n).toBe(n.toLowerCase());
        const key = normalizeName(n);
        expect([n, key.length > 0]).toEqual([n, true]);
        // the same name written twice under one exercise is as much a mistake as under two
        expect([n, seen.get(key)]).toEqual([n, undefined]);
        seen.set(key, e.id);
      });
    });
  });

  it('uses only muscles on the list, with at least one doing the work and none in both lists', () => {
    EXERCISE_LIBRARY.forEach((e) => {
      [...e.primary, ...e.secondary].forEach((m) => expect([e.id, m, isMuscle(m)]).toEqual([e.id, m, true]));
      expect(new Set(e.primary).size).toBe(e.primary.length);
      expect(new Set(e.secondary).size).toBe(e.secondary.length);
      e.primary.forEach((m) => expect([e.id, m, e.secondary.includes(m)]).toEqual([e.id, m, false]));
    });
  });

  it('uses only equipment, a pattern and a level from the lists', () => {
    EXERCISE_LIBRARY.forEach((e) => {
      e.equipment.forEach((q) => expect([e.id, q, EQUIPMENT.includes(q)]).toEqual([e.id, q, true]));
      expect(new Set(e.equipment).size).toBe(e.equipment.length);
      expect([e.id, PATTERNS.includes(e.pattern)]).toEqual([e.id, true]);
      expect([e.id, LEVELS.includes(e.difficulty)]).toEqual([e.id, true]);
    });
  });

  it('puts the loading equipment with the exercise that needs it: no bench press without a bench, no pull-up without a bar', () => {
    EXERCISE_LIBRARY.forEach((e) => {
      if (/^(barbell|incline barbell|decline barbell) bench press$/i.test(e.name)) expect([e.id, e.equipment.includes('bench')]).toEqual([e.id, true]);
      if (/pull-up|chin-up/i.test(e.name) && !/assisted|machine|negative/i.test(e.name)) expect([e.id, e.equipment.includes('pullup_bar')]).toEqual([e.id, true]);
    });
  });
});

describe('the library as a whole', () => {
  it('has between 150 and 200 exercises', () => {
    expect(EXERCISE_LIBRARY.length).toBeGreaterThanOrEqual(150);
    expect(EXERCISE_LIBRARY.length).toBeLessThanOrEqual(200);
  });

  it('works every muscle on the list as a primary muscle, except the neck', () => {
    const worked = new Set(EXERCISE_LIBRARY.flatMap((e) => e.primary));
    MUSCLES.filter((m) => m !== 'neck').forEach((m) => expect([m, worked.has(m)]).toEqual([m, true]));
    expect(worked.has('neck')).toBe(false);
  });

  it('has a beginner exercise for every muscle that is trained, and one that needs no equipment for the big ones', () => {
    MUSCLES.filter((m) => m !== 'neck').forEach((m) => {
      expect([m, EXERCISE_LIBRARY.some((e) => e.primary.includes(m) && e.difficulty === 'beginner')]).toEqual([m, true]);
    });
    ['chest', 'lats', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'core', 'shoulders', 'triceps'].forEach((m) => {
      expect([m, LIBRARY.some((e) => e.primary.includes(m) && e.bodyweight)]).toEqual([m, true]);
    });
  });

  it('has every level, pattern and kind of equipment in use', () => {
    LEVELS.forEach((l) => expect(EXERCISE_LIBRARY.some((e) => e.difficulty === l)).toBe(true));
    PATTERNS.forEach((p) => expect([p, EXERCISE_LIBRARY.some((e) => e.pattern === p)]).toEqual([p, true]));
    EQUIPMENT.forEach((q) => expect([q, EXERCISE_LIBRARY.some((e) => e.equipment.includes(q))]).toEqual([q, true]));
  });
});

describe('LIBRARY, the entries as the app reads them', () => {
  it('is the same exercises in the same order, with every field of the data kept', () => {
    expect(LIBRARY.map((e) => e.id)).toEqual(EXERCISE_LIBRARY.map((e) => e.id));
    LIBRARY.forEach((e, i) => {
      const raw = EXERCISE_LIBRARY[i];
      FIELDS.forEach((f) => expect(e[f]).toEqual(raw[f]));
    });
  });

  it('marks an exercise bodyweight exactly when it can be done with no equipment', () => {
    LIBRARY.forEach((e) => expect([e.id, e.bodyweight]).toEqual([e.id, e.equipment.includes('bodyweight')]));
    expect(getExercise('push-up').bodyweight).toBe(true);
    expect(getExercise('barbell-back-squat').bodyweight).toBe(false);
    expect(LIBRARY.filter((e) => e.bodyweight).length).toBeGreaterThanOrEqual(40);
  });

  it('marks an exercise compound unless it is an isolation, core or conditioning move', () => {
    LIBRARY.forEach((e) => expect([e.id, e.compound]).toEqual([e.id, !['isolation', 'core', 'conditioning'].includes(e.pattern)]));
    expect(getExercise('barbell-back-squat').compound).toBe(true);
    expect(getExercise('plank').compound).toBe(false);
    expect(getExercise('barbell-curl').compound).toBe(false);
  });

  it('cannot be changed by a caller', () => {
    const e = getExercise('barbell-back-squat');
    expect(() => { 'use strict'; e.name = 'x'; }).toThrow();
    expect(() => { 'use strict'; e.primary.push('chest'); }).toThrow();
    expect(() => { 'use strict'; e.aliases[0] = 'x'; }).toThrow();
    expect(() => { 'use strict'; LIBRARY.push({}); }).toThrow();
    expect(getExercise('barbell-back-squat').primary).not.toContain('chest');
  });
});

describe('bodyweight ladders', () => {
  it('has the nine ladders', () => {
    expect(LADDERS).toEqual(['push', 'pike', 'dip', 'pull', 'squat', 'bridge', 'calf', 'plank', 'legraise']);
  });

  it('counts up from rung 1 with no gap and no repeat, easiest rung first', () => {
    LADDERS.forEach((name) => {
      const rungs = getLadder(name);
      expect(rungs.length).toBeGreaterThanOrEqual(2);
      expect([name, rungs.map((e) => e.ladder.rung)]).toEqual([name, rungs.map((_, i) => i + 1)]);
    });
  });

  it('is made only of exercises that need no equipment', () => {
    LIBRARY.filter((e) => e.ladder).forEach((e) => expect([e.id, e.bodyweight]).toEqual([e.id, true]));
  });

  it('puts the easier exercise on the lower rung: a push-up ladder starts at the wall and ends one-arm', () => {
    const push = getLadder('push');
    expect(push).toHaveLength(7);
    expect(push[0].difficulty).toBe('beginner');
    expect(push[push.length - 1].difficulty).toBe('advanced');
    const order = { beginner: 0, intermediate: 1, advanced: 2 };
    LADDERS.forEach((name) => {
      const levels = getLadder(name).map((e) => order[e.difficulty]);
      expect([name, levels]).toEqual([name, [...levels].sort((a, b) => a - b)]);
    });
  });

  it('keeps to one or two patterns down each ladder, and each rung works a muscle the rung below it works', () => {
    LADDERS.forEach((name) => {
      const rungs = getLadder(name);
      expect([name, new Set(rungs.map((e) => e.pattern)).size <= 2]).toEqual([name, true]);
      rungs.slice(1).forEach((e, i) => {
        const below = [...rungs[i].primary, ...rungs[i].secondary];
        expect([name, e.id, [...e.primary, ...e.secondary].some((m) => below.includes(m))]).toEqual([name, e.id, true]);
      });
    });
  });

  it('is [] for a name that is not a ladder, or not a name', () => {
    ['', 'Push', 'nope', null, undefined, 3].forEach((n) => expect(getLadder(n)).toEqual([]));
  });
});

describe('getExercise', () => {
  it('finds an exercise by its id', () => {
    expect(getExercise('push-up').name).toBe('Push-Up');
    LIBRARY.forEach((e) => expect(getExercise(e.id)).toBe(e));
  });

  it('is null for an id that is not there, or not an id', () => {
    ['', 'Push-Up', 'nope', 'constructor', '__proto__', null, undefined, 4, {}].forEach((v) => expect(getExercise(v)).toBeNull());
  });
});

describe('normalizeName', () => {
  it.each([
    ['Push-Ups', 'push up'], ['push up', 'push up'], ['PUSH  UP', 'push up'], ['Push_Up.', 'push up'],
    ['Bicep Curl', 'bicep curl'], ['Biceps Curls', 'bicep curl'], ['Triceps', 'tricep'], ['tricep', 'tricep'],
    ["Farmer's Walk", 'farmer walk'], ['Farmer’s Walks', 'farmer walk'],
    ['Bench Press', 'bench press'], ['abs', 'ab'], ['Push-Ups', 'push up'], ['Sit-Ups', 'sit up'], ['Press', 'press'], ['Cross-Body', 'cross body'],
  ])('writes "%s" as "%s"', (input, output) => {
    expect(normalizeName(input)).toBe(output);
  });

  it('is empty for anything that is not a name', () => {
    ['', '   ', '---', null, undefined, 5, {}, ['push up']].forEach((v) => expect(normalizeName(v)).toBe(''));
  });
});

describe('findExercise', () => {
  it('finds an exercise by its name, whatever the case, spaces, hyphens or plural', () => {
    ['Push-Up', 'push up', 'PUSH-UPS', 'push ups', 'Push  Up.'].forEach((n) => expect(idOf(n)).toBe('push-up'));
    expect(idOf('Barbell Back Squat')).toBe('barbell-back-squat');
    expect(idOf('barbell back squats')).toBe('barbell-back-squat');
  });

  it('finds an exercise by an alias', () => {
    LIBRARY.forEach((e) => e.aliases.forEach((a) => expect([a, idOf(a)]).toEqual([a, e.id])));
    expect(idOf('Bench Press')).toBe('barbell-bench-press');
    expect(idOf('squat')).toBe('barbell-back-squat');
  });

  it('finds every exercise by its own name', () => {
    LIBRARY.forEach((e) => expect([e.name, idOf(e.name)]).toEqual([e.name, e.id]));
  });

  it('reads tricep and triceps, bicep and biceps as the same word', () => {
    expect(idOf('Tricep Pushdown')).toBe(idOf('Triceps Pushdown'));
    expect(idOf('Tricep Pushdown')).not.toBeNull();
    expect(idOf('Bicep Curl')).toBe(idOf('Biceps Curl'));
    expect(idOf('Bicep Curl')).not.toBeNull();
  });

  describe('dropping an equipment word', () => {
    it('is allowed when the exercise really is done with that equipment', () => {
      expect(idOf('Bodyweight Pull-Up')).toBe('pull-up');
      expect(idOf('Bodyweight Push-Up')).toBe('push-up');
      expect(idOf('Cable Face Pull')).toBe('face-pull');
      expect(idOf('Barbell Deadlift')).toBe('deadlift');
      expect(idOf('Machine Leg Press')).toBe('leg-press');
      expect(idOf('Barbell Bent-Over Row')).toBe('barbell-row');
    });

    it('is not allowed when the exercise is not done with that equipment', () => {
      expect(findExercise('Machine Squat')).toBeNull();
      expect(findExercise('Machine Back Squat')).toBeNull();
      expect(findExercise('Barbell Push-Up')).toBeNull();
      expect(findExercise('Kettlebell Pull-Up')).toBeNull();
      expect(findExercise('Cable Plank')).toBeNull();
      expect(findExercise('Machine Pull-Up')).toBeNull();
    });

    it('needs every equipment word in the name to fit, not just one', () => {
      expect(findExercise('Bodyweight Barbell Pull-Up')).toBeNull();
      expect(findExercise('Barbell Cable Deadlift')).toBeNull();
    });

    it('never drops a word that changes the exercise', () => {
      ['Weighted Pull-Up', 'Assisted Pull-Up', 'Resistance Band Push-Up', 'Single Arm Push-Up', 'Incline Squat', 'Wide Push-Up Hold'].forEach((n) => {
        const found = findExercise(n);
        if (found) expect([n, normalizeName(found.name) === normalizeName(n) || found.aliases.some((a) => normalizeName(a) === normalizeName(n))]).toEqual([n, true]);
      });
      expect(findExercise('Weighted Plank')).toBeNull();
    });

    it('is not tried on a name that is only an equipment word', () => {
      ['Barbell', 'Bodyweight', 'Dumbbell Barbell', 'Machine'].forEach((n) => expect(findExercise(n)).toBeNull());
    });
  });

  describe('being right rather than finding something', () => {
    it('does not match a name that is only part of another', () => {
      expect(findExercise('Curl')).toBeNull();
      expect(findExercise('Press')).toBeNull();
      expect(findExercise('Row')).toBeNull();
      expect(findExercise('Raise')).toBeNull();
      expect(findExercise('Bench')).toBeNull();
    });

    it('does not mix up exercises that share a word', () => {
      expect(idOf('Leg Curl')).not.toBe(idOf('Leg Press'));
      expect(idOf('Leg Extension')).not.toBe(idOf('Leg Curl'));
      expect(idOf('Hammer Curl')).not.toBe(idOf('Barbell Curl'));
      expect(idOf('Front Squat')).not.toBe(idOf('Barbell Back Squat'));
      expect(idOf('Romanian Deadlift')).not.toBe(idOf('Deadlift'));
      expect(idOf('Incline Bench Press')).not.toBe(idOf('Bench Press'));
      expect(idOf('Seated Calf Raise')).not.toBe(idOf('Calf Raise'));
      expect(idOf('Side Plank')).not.toBe(idOf('Plank'));
    });

    it('does not find a name that is not in the library, or add a missing word to find one', () => {
      ['Underwater Basket Weaving', 'Zottman Curl Variation Xyz', 'Plank Deluxe', 'Squat Jump Spin', 'Bench', 'Machine Squat'].forEach((n) => {
        expect([n, findExercise(n)]).toEqual([n, null]);
      });
    });

    it('is null for anything that is not a name, without throwing', () => {
      ['', '  ', '-', null, undefined, 3, {}, [], ['push up'], true, () => 'push up'].forEach((v) => expect(findExercise(v)).toBeNull());
    });

    it('does not read a word that is a property of every object as an equipment word', () => {
      ['constructor', 'toString Push-Up', '__proto__ squat', 'hasOwnProperty'].forEach((n) => expect(findExercise(n)).toBeNull());
    });
  });
});

describe('the exercises in the app\'s own programs', () => {
  const names = [...new Set(WORKOUT_PROGRAMS.flatMap((p) => p.weeks.flatMap((w) => w.days.flatMap((d) => d.exercises.map((e) => e.name)))))];

  it('are all there are to check: the 32 names', () => {
    expect(names).toHaveLength(32);
  });

  it('are all found', () => {
    names.forEach((n) => expect([n, findExercise(n) !== null]).toEqual([n, true]));
  });

  it('are found as the exercise that was meant, not another that shares a word', () => {
    const expected = {
      Squat: 'barbell-back-squat', 'Bench Press': 'barbell-bench-press', 'Bent-Over Row': 'barbell-row', Plank: 'plank',
      Deadlift: 'deadlift', 'Overhead Press': 'barbell-overhead-press', 'Lat Pulldown': 'lat-pulldown', 'Side Plank': 'side-plank',
      'Goblet Squat': 'goblet-squat', 'Incline Dumbbell Press': 'incline-dumbbell-press', 'Seated Cable Row': 'seated-cable-row',
      'Dead Bug': 'dead-bug', 'Bicep Curl': 'dumbbell-curl', 'Tricep Pushdown': 'triceps-pushdown', 'Romanian Deadlift': 'romanian-deadlift',
      'Leg Press': 'leg-press', 'Leg Curl': 'lying-leg-curl', 'Calf Raise': 'standing-calf-raise', 'Incline Bench Press': 'incline-barbell-bench-press',
      'Arnold Press': 'arnold-press', 'Pull-Up': 'pull-up', 'Hammer Curl': 'hammer-curl', 'Overhead Tricep Extension': 'overhead-dumbbell-triceps-extension',
      'Front Squat': 'front-squat', 'Walking Lunge': 'walking-lunge', 'Leg Extension': 'leg-extension', 'Seated Calf Raise': 'seated-calf-raise',
      'Lateral Raise': 'dumbbell-lateral-raise', 'Tricep Dip': 'parallel-bar-dip', 'Face Pull': 'face-pull', 'Barbell Curl': 'barbell-curl',
      'Hanging Leg Raise': 'hanging-leg-raise',
    };
    expect(Object.keys(expected).sort()).toEqual([...names].sort());
    names.forEach((n) => expect([n, idOf(n)]).toEqual([n, expected[n]]));
  });

  it('work the muscles the program is for', () => {
    expect(findExercise('Bench Press').primary).toEqual(['chest']);
    expect(findExercise('Squat').primary).toContain('quadriceps');
    expect(findExercise('Deadlift').primary).toEqual(expect.arrayContaining(['glutes', 'hamstrings']));
    expect(findExercise('Pull-Up').primary).toContain('lats');
    expect(findExercise('Plank').primary).toEqual(['core']);
  });
});
