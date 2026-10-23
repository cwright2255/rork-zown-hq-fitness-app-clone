// Which exercises a reported injury leaves out (lib/injuryRules.js). The list is conservative by design, so the table below spells out the
// exercises that must be left out and the ones that must not, each worked out by hand from the muscles, pattern and equipment in
// data/exerciseLibrary.js, and the other tests hold the rules to what the profile offers and what the library has.
import { INJURY_RULES, INJURY_IDS, blockedBy } from '../lib/injuryRules';
import { LIBRARY, LADDERS, EQUIPMENT, PATTERNS, getExercise } from '../lib/exerciseLibrary';
import { MUSCLES } from '../lib/muscleVocabulary';
import { INJURY_LABELS } from '../lib/userProfileData';

const ex = (id) => {
  const found = getExercise(id);
  if (!found) throw new Error(`no such exercise: ${id}`);
  return found;
};

describe('what the rules are made of', () => {
  it('are these, and no others: a change to the list is a change to what the app will not ask a person with that injury to do, so it fails here until it is made on purpose', () => {
    expect(INJURY_RULES).toEqual({
      knee: { primary: ['quadriceps'], involved: [], patterns: ['squat', 'lunge', 'conditioning'], equipment: [], ladders: [], ids: ['nordic-hamstring-curl', 'glute-ham-raise'] },
      hip: { primary: ['glutes', 'adductors', 'abductors'], involved: [], patterns: ['squat', 'hinge', 'lunge'], equipment: [], ladders: [], ids: [] },
      lower_back: { primary: [], involved: ['lower_back'], patterns: ['hinge', 'carry'], equipment: [], ladders: [], ids: ['sit-up', 'v-up', 'russian-twist'] },
      shoulder: {
        primary: [], involved: ['shoulders'], patterns: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull'], equipment: ['pullup_bar'], ladders: [],
        ids: ['dumbbell-pullover', 'straight-arm-pulldown'],
      },
      elbow: { primary: [], involved: ['biceps', 'triceps'], patterns: ['vertical_push'], equipment: [], ladders: [], ids: [] },
      wrist: { primary: [], involved: ['forearms'], patterns: [], equipment: ['ab_wheel', 'dip_station'], ladders: ['push', 'pike', 'dip'], ids: [] },
      ankle: { primary: [], involved: ['calves'], patterns: ['lunge', 'conditioning'], equipment: [], ladders: [], ids: [] },
      neck: { primary: [], involved: ['neck', 'traps'], patterns: ['vertical_push'], equipment: [], ladders: [], ids: [] },
    });
  });

  it('know exactly the eight injuries the profile offers', () => {
    expect([...INJURY_IDS].sort()).toEqual(Object.keys(INJURY_LABELS).sort());
    expect(INJURY_IDS).toHaveLength(8);
  });

  it('name only muscles, patterns, equipment, ladders and exercises that exist', () => {
    const ids = new Set(LIBRARY.map((e) => e.id));
    INJURY_IDS.forEach((injury) => {
      const rule = INJURY_RULES[injury];
      expect(Object.keys(rule).sort()).toEqual(['equipment', 'ids', 'involved', 'ladders', 'patterns', 'primary']);
      rule.primary.forEach((m) => expect(MUSCLES).toContain(m));
      rule.involved.forEach((m) => expect(MUSCLES).toContain(m));
      rule.patterns.forEach((p) => expect(PATTERNS).toContain(p));
      rule.equipment.forEach((q) => expect(EQUIPMENT).toContain(q));
      rule.ladders.forEach((l) => expect(LADDERS).toContain(l));
      rule.ids.forEach((id) => expect(ids.has(id)).toBe(true));
    });
  });

  it('are frozen, so no caller can loosen them', () => {
    expect(Object.isFrozen(INJURY_RULES)).toBe(true);
    INJURY_IDS.forEach((id) => expect(Object.isFrozen(INJURY_RULES[id])).toBe(true));
  });

  it('every injury leaves out a real share of the library without leaving the person with nothing', () => {
    INJURY_IDS.forEach((injury) => {
      const out = LIBRARY.filter((e) => blockedBy(e, [injury]).length > 0).length;
      expect(out).toBeGreaterThanOrEqual(20);
      expect(LIBRARY.length - out).toBeGreaterThanOrEqual(80);
    });
  });
});

// [injury, exercise, left out?, why, read from the library]
const CASES = [
  // Shoulder: any muscle list with the shoulders, any press or pull, a pull-up bar, and two arm-overhead moves the tags miss.
  ['shoulder', 'barbell-bench-press', true, 'shoulders are a helper muscle'],
  ['shoulder', 'push-up', true, 'horizontal push'],
  ['shoulder', 'lat-pulldown', true, 'vertical pull'],
  ['shoulder', 'pull-up', true, 'vertical pull on a bar'],
  ['shoulder', 'seated-cable-row', true, 'horizontal pull'],
  ['shoulder', 't-bar-row', true, 'horizontal pull, though the tags leave the shoulders out'],
  ['shoulder', 'dumbbell-lateral-raise', true, 'shoulders are the main muscle'],
  ['shoulder', 'plank', true, 'shoulders are a helper muscle'],
  ['shoulder', 'dumbbell-pullover', true, 'named: arms overhead'],
  ['shoulder', 'straight-arm-pulldown', true, 'named: arms overhead'],
  ['shoulder', 'hanging-knee-raise', true, 'hangs from a pull-up bar'],
  ['shoulder', 'barbell-back-squat', false, 'legs'],
  ['shoulder', 'deadlift', false, 'no shoulder work in the tags or the pattern'],
  ['shoulder', 'dumbbell-curl', false, 'biceps'],
  ['shoulder', 'triceps-pushdown', false, 'triceps alone'],
  ['shoulder', 'leg-press', false, 'legs'],
  // Knee: quadriceps as the main muscle, squats, lunges and jumps, and two knee-bending hamstring moves the tags miss.
  ['knee', 'barbell-back-squat', true, 'squat'],
  ['knee', 'goblet-squat', true, 'squat'],
  ['knee', 'walking-lunge', true, 'lunge'],
  ['knee', 'leg-extension', true, 'quadriceps are the main muscle'],
  ['knee', 'trap-bar-deadlift', true, 'quadriceps are a main muscle'],
  ['knee', 'jump-squat', true, 'conditioning'],
  ['knee', 'nordic-hamstring-curl', true, 'named: bends the knee under load'],
  ['knee', 'glute-ham-raise', true, 'named: bends the knee under load'],
  ['knee', 'romanian-deadlift', false, 'hinge: hamstrings and glutes'],
  ['knee', 'deadlift', false, 'quadriceps only help'],
  ['knee', 'lying-leg-curl', false, 'hamstrings'],
  ['knee', 'barbell-hip-thrust', false, 'quadriceps only help'],
  ['knee', 'standing-calf-raise', false, 'calves'],
  ['knee', 'barbell-bench-press', false, 'upper body'],
  ['knee', 'plank', false, 'core'],
  // Hip: glutes, adductors and abductors as the main muscles, squats, hinges and lunges.
  ['hip', 'barbell-back-squat', true, 'squat'],
  ['hip', 'deadlift', true, 'hinge'],
  ['hip', 'walking-lunge', true, 'lunge'],
  ['hip', 'glute-bridge', true, 'hinge, glutes'],
  ['hip', 'hip-abduction-machine', true, 'abductors are the main muscle'],
  ['hip', 'hip-adduction-machine', true, 'adductors are the main muscle'],
  ['hip', 'cable-glute-kickback', true, 'glutes are the main muscle'],
  ['hip', 'leg-extension', false, 'quadriceps alone'],
  ['hip', 'lying-leg-curl', false, 'hamstrings alone'],
  ['hip', 'standing-calf-raise', false, 'calves'],
  ['hip', 'barbell-bench-press', false, 'upper body'],
  // Lower back: the lower back in any role, hinges, carries, and sit-ups, v-ups and twists.
  ['lower_back', 'deadlift', true, 'hinge, lower back is a main muscle'],
  ['lower_back', 'romanian-deadlift', true, 'hinge'],
  ['lower_back', 'barbell-back-squat', true, 'lower back is a helper muscle'],
  ['lower_back', 'barbell-row', true, 'lower back is a helper muscle'],
  ['lower_back', 'back-extension', true, 'lower back is the main muscle'],
  ['lower_back', 'farmers-walk', true, 'carry'],
  ['lower_back', 'sit-up', true, 'named'],
  ['lower_back', 'russian-twist', true, 'named'],
  ['lower_back', 'goblet-squat', false, 'no lower back in the tags'],
  ['lower_back', 'leg-press', false, 'back supported'],
  ['lower_back', 'barbell-bench-press', false, 'upper body'],
  ['lower_back', 'dumbbell-curl', false, 'biceps'],
  ['lower_back', 'lat-pulldown', false, 'seated, no lower back in the tags'],
  // Elbow: biceps and triceps in any role (almost every upper-body lift), and overhead presses.
  ['elbow', 'barbell-bench-press', true, 'triceps help'],
  ['elbow', 'dumbbell-curl', true, 'biceps are the main muscle'],
  ['elbow', 'triceps-pushdown', true, 'triceps are the main muscle'],
  ['elbow', 'pull-up', true, 'biceps help'],
  ['elbow', 'lat-pulldown', true, 'biceps help'],
  ['elbow', 'barbell-overhead-press', true, 'triceps help'],
  ['elbow', 'dumbbell-lateral-raise', false, 'shoulders and traps'],
  ['elbow', 'face-pull', false, 'shoulders, upper back and traps'],
  ['elbow', 'leg-press', false, 'legs'],
  ['elbow', 'deadlift', false, 'no biceps or triceps in the tags'],
  ['elbow', 'plank', false, 'core'],
  // Wrist: the forearms in any role, the ab wheel and dip bars, and the push-up, pike and dip ladders.
  ['wrist', 'wrist-curl', true, 'forearms are the main muscle'],
  ['wrist', 'dumbbell-curl', true, 'forearms help'],
  ['wrist', 'deadlift', true, 'forearms help (grip)'],
  ['wrist', 'lat-pulldown', true, 'forearms help (grip)'],
  ['wrist', 'ab-wheel-rollout', true, 'ab wheel'],
  ['wrist', 'chest-dip', true, 'dip bars'],
  ['wrist', 'push-up', true, 'push ladder'],
  ['wrist', 'wall-push-up', true, 'push ladder'],
  ['wrist', 'pike-push-up', true, 'pike ladder'],
  ['wrist', 'bench-dip', true, 'dip ladder'],
  ['wrist', 'barbell-back-squat', false, 'no forearms in the tags'],
  ['wrist', 'leg-press', false, 'legs'],
  ['wrist', 'lying-leg-curl', false, 'legs'],
  // Ankle: calves in any role, lunges and jumps.
  ['ankle', 'standing-calf-raise', true, 'calves are the main muscle'],
  ['ankle', 'leg-press', true, 'calves help'],
  ['ankle', 'bodyweight-squat', true, 'calves help'],
  ['ankle', 'walking-lunge', true, 'lunge'],
  ['ankle', 'jump-squat', true, 'conditioning'],
  ['ankle', 'barbell-back-squat', false, 'no calves in the tags'],
  ['ankle', 'goblet-squat', false, 'no calves in the tags'],
  ['ankle', 'deadlift', false, 'no calves in the tags'],
  ['ankle', 'barbell-bench-press', false, 'upper body'],
  ['ankle', 'dumbbell-curl', false, 'biceps'],
  // Neck: the neck and traps in any role, and overhead presses.
  ['neck', 'barbell-shrug', true, 'traps are the main muscle'],
  ['neck', 'farmers-walk', true, 'traps are a main muscle'],
  ['neck', 'dumbbell-lateral-raise', true, 'traps help'],
  ['neck', 'deadlift', true, 'traps help'],
  ['neck', 'barbell-overhead-press', true, 'vertical push'],
  ['neck', 'barbell-back-squat', false, 'no traps in the tags'],
  ['neck', 'barbell-bench-press', false, 'no traps in the tags'],
  ['neck', 'leg-press', false, 'legs'],
  ['neck', 'dumbbell-curl', false, 'biceps'],
];

describe('blockedBy, exercise by exercise', () => {
  it.each(CASES)('%s and %s: left out is %s (%s)', (injury, id, expected) => {
    expect(blockedBy(ex(id), [injury])).toEqual(expected ? [injury] : []);
  });

  it('has a case that is left out and one that is not for every injury', () => {
    INJURY_IDS.forEach((injury) => {
      const mine = CASES.filter((c) => c[0] === injury);
      expect(mine.some((c) => c[2] === true)).toBe(true);
      expect(mine.some((c) => c[2] === false)).toBe(true);
    });
  });
});

describe('blockedBy, one reason at a time (exercises made up to show each part of a rule alone)', () => {
  const none = { primary: [], secondary: [], equipment: [], pattern: 'isolation', id: 'made-up' };
  const only = (extra) => ({ ...none, ...extra });

  it.each(INJURY_IDS)('%s: leaves out exactly what its rule names, whichever way an exercise matches it', (injury) => {
    const rule = INJURY_RULES[injury];
    expect(blockedBy(none, [injury])).toEqual([]);
    rule.primary.forEach((m) => expect(blockedBy(only({ primary: [m] }), [injury])).toEqual([injury]));
    rule.primary.forEach((m) => expect(blockedBy(only({ secondary: [m] }), [injury])).toEqual(rule.involved.includes(m) ? [injury] : []));
    rule.involved.forEach((m) => {
      expect(blockedBy(only({ primary: [m] }), [injury])).toEqual([injury]);
      expect(blockedBy(only({ secondary: [m] }), [injury])).toEqual([injury]);
    });
    rule.patterns.forEach((p) => expect(blockedBy(only({ pattern: p }), [injury])).toEqual([injury]));
    PATTERNS.filter((p) => !rule.patterns.includes(p)).forEach((p) => expect(blockedBy(only({ pattern: p }), [injury])).toEqual([]));
    rule.equipment.forEach((q) => expect(blockedBy(only({ equipment: ['bodyweight', q] }), [injury])).toEqual([injury]));
    EQUIPMENT.filter((q) => !rule.equipment.includes(q)).forEach((q) => expect(blockedBy(only({ equipment: [q] }), [injury])).toEqual([]));
    rule.ladders.forEach((l) => expect(blockedBy(only({ ladder: { name: l, rung: 1 } }), [injury])).toEqual([injury]));
    LADDERS.filter((l) => !rule.ladders.includes(l)).forEach((l) => expect(blockedBy(only({ ladder: { name: l, rung: 1 } }), [injury])).toEqual([]));
    rule.ids.forEach((id) => expect(blockedBy(only({ id }), [injury])).toEqual([injury]));
    // muscles that are in none of the lists leave nothing out
    MUSCLES.filter((m) => !rule.primary.includes(m) && !rule.involved.includes(m)).forEach((m) => {
      expect(blockedBy(only({ primary: [m], secondary: [m] }), [injury])).toEqual([]);
    });
    MUSCLES.filter((m) => !rule.involved.includes(m)).forEach((m) => expect(blockedBy(only({ secondary: [m] }), [injury])).toEqual([]));
  });
});

describe('blockedBy, with several injuries and bad input', () => {
  const bench = ex('barbell-bench-press');
  it('lists the injuries that rule an exercise out, each once, in the order reported', () => {
    expect(blockedBy(bench, ['shoulder', 'knee', 'elbow'])).toEqual(['shoulder', 'elbow']);
    expect(blockedBy(bench, ['elbow', 'shoulder'])).toEqual(['elbow', 'shoulder']);
    expect(blockedBy(bench, ['shoulder', 'shoulder', 'elbow', 'shoulder'])).toEqual(['shoulder', 'elbow']);
  });

  it('ignores an injury it does not know, and anything that is not text', () => {
    expect(blockedBy(bench, ['made_up', 'shoulder'])).toEqual(['shoulder']);
    expect(blockedBy(bench, [5, null, undefined, {}, ['shoulder'], 'shoulder'])).toEqual(['shoulder']);
    expect(blockedBy(bench, ['constructor', '__proto__', 'toString'])).toEqual([]);
  });

  it('leaves nothing out when there is no injury', () => {
    expect(blockedBy(bench, [])).toEqual([]);
    expect(blockedBy(bench, undefined)).toEqual([]);
    expect(blockedBy(bench, null)).toEqual([]);
    expect(blockedBy(bench, 'shoulder')).toEqual([]);
  });

  it('answers [] for something that is not an exercise, and for one with fields missing', () => {
    expect(blockedBy(null, ['shoulder'])).toEqual([]);
    expect(blockedBy('barbell-bench-press', ['shoulder'])).toEqual([]);
    expect(blockedBy({}, ['shoulder'])).toEqual([]);
    expect(blockedBy({ pattern: 'vertical_push' }, ['shoulder'])).toEqual(['shoulder']);
    expect(blockedBy({ primary: ['quadriceps'] }, ['knee'])).toEqual(['knee']);
    expect(blockedBy({ secondary: ['quadriceps'] }, ['knee'])).toEqual([]);
    expect(blockedBy({ secondary: ['shoulders'] }, ['shoulder'])).toEqual(['shoulder']);
    expect(blockedBy({ equipment: ['ab_wheel'] }, ['wrist'])).toEqual(['wrist']);
    expect(blockedBy({ ladder: { name: 'pike', rung: 1 } }, ['wrist'])).toEqual(['wrist']);
    expect(blockedBy({ id: 'sit-up' }, ['lower_back'])).toEqual(['lower_back']);
  });

  it('does not change the exercise or the list it is given', () => {
    const injuries = ['shoulder', 'elbow'];
    blockedBy(bench, injuries);
    expect(injuries).toEqual(['shoulder', 'elbow']);
    expect(Object.isFrozen(bench)).toBe(true);
  });
});
