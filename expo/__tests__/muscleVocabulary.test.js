import { MUSCLES, MUSCLE_GROUPS, isMuscle, resolveMuscle, resolveMuscles } from '../lib/muscleVocabulary';
import { canonicalizeMuscle, RUNNING_MUSCLES, HIKING_MUSCLES } from '../lib/muscleFatigue';
import { MUSCLE_ANCHORS } from '../lib/muscleAnchors';
import { muscleLabel } from '../lib/homeWidgetData';

describe('the muscle list', () => {
  it('has the 17 muscles, each once, written the way they are stored', () => {
    expect(MUSCLES).toHaveLength(17);
    expect(new Set(MUSCLES).size).toBe(17);
    MUSCLES.forEach((m) => expect(m).toMatch(/^[a-z]+(_[a-z]+)?$/));
  });

  it('is what isMuscle accepts, exactly as stored', () => {
    MUSCLES.forEach((m) => expect(isMuscle(m)).toBe(true));
    ['Chest', 'upper back', 'back', 'quads', '', null, undefined, 3, ['chest']].forEach((v) => expect(isMuscle(v)).toBe(false));
  });

  it('shows every muscle as a clean label on a card', () => {
    MUSCLES.forEach((m) => {
      const label = muscleLabel(m);
      expect(label).toMatch(/^[A-Z][a-z]+( [a-z]+)?$/);
    });
    expect(muscleLabel('upper_back')).toBe('Upper back');
  });
});

describe('group words', () => {
  it('are made only of muscles on the list, none repeated', () => {
    Object.values(MUSCLE_GROUPS).forEach((list) => {
      expect(list.length).toBeGreaterThan(1);
      expect(new Set(list).size).toBe(list.length);
      list.forEach((m) => expect(isMuscle(m)).toBe(true));
    });
  });

  it('read as the muscles the plan names', () => {
    expect(resolveMuscle('back')).toEqual(['lats', 'upper_back', 'traps']);
    expect(resolveMuscle('legs')).toEqual(['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors']);
    expect(resolveMuscle('arms')).toEqual(['biceps', 'triceps', 'forearms']);
  });

  it('leave the lower back out of "back", which people mean as the upper body muscles', () => {
    expect(resolveMuscle('back')).not.toContain('lower_back');
  });
});

describe('resolveMuscle', () => {
  it('reads each muscle key as itself', () => {
    MUSCLES.forEach((m) => expect(resolveMuscle(m)).toEqual([m]));
  });

  it.each([
    ['Quads', 'quadriceps'], ['quad', 'quadriceps'], ['Quadriceps', 'quadriceps'],
    ['Pecs', 'chest'], ['pectorals', 'chest'], ['Chest', 'chest'],
    ['Delts', 'shoulders'], ['rear delts', 'shoulders'], ['Deltoid', 'shoulders'], ['shoulder', 'shoulders'],
    ['bicep', 'biceps'], ['Tricep', 'triceps'],
    ['forearm', 'forearms'],
    ['lat', 'lats'], ['Latissimus Dorsi', 'lats'],
    ['middle back', 'upper_back'], ['mid-back', 'upper_back'], ['rhomboids', 'upper_back'],
    ['trapezius', 'traps'],
    ['lower back', 'lower_back'], ['Lower-Back', 'lower_back'], ['lumbar', 'lower_back'], ['erector spinae', 'lower_back'],
    ['abs', 'core'], ['Abdominals', 'core'], ['obliques', 'core'], ['abdomen', 'core'],
    ['hamstring', 'hamstrings'], ['hams', 'hamstrings'],
    ['glute', 'glutes'], ['Gluteus Maximus', 'glutes'],
    ['calf', 'calves'], ['soleus', 'calves'],
    ['inner thigh', 'adductors'], ['groin', 'adductors'],
    ['outer thigh', 'abductors'], ['outer hip', 'abductors'], ['hip abductors', 'abductors'], ['Gluteus Medius', 'abductors'], ['glute med', 'abductors'],
  ])('reads "%s" as %s', (word, muscle) => {
    expect(resolveMuscle(word)).toEqual([muscle]);
  });

  it('does not mind case, extra spaces, hyphens, underscores or punctuation', () => {
    ['upper_back', 'UPPER_BACK', 'Upper Back', 'upper-back', '  upper   back ', 'upper back.', '(upper back)'].forEach((w) => {
      expect(resolveMuscle(w)).toEqual(['upper_back']);
    });
  });

  it('reads a word that is not a muscle, or too vague to be one, as nothing', () => {
    ['full body', 'thighs', 'hips', 'upper body', 'cardio', 'bench press', 'grip', 'quadricepss', '', '   ', '---'].forEach((w) => {
      expect(resolveMuscle(w)).toEqual([]);
    });
  });

  it('reads anything that is not text as nothing, without throwing', () => {
    [null, undefined, 4, NaN, {}, [], ['chest'], true, () => 'chest'].forEach((v) => expect(resolveMuscle(v)).toEqual([]));
  });

  it('gives a new array each time, so changing one answer does not change the next', () => {
    const first = resolveMuscle('back');
    first.push('neck');
    first.length = 0;
    expect(resolveMuscle('back')).toEqual(['lats', 'upper_back', 'traps']);
    expect(MUSCLE_GROUPS.back).toEqual(['lats', 'upper_back', 'traps']);
  });

  it('only ever answers with muscles on the list', () => {
    ['quads', 'back', 'legs', 'arms', 'abs', 'delts', 'lumbar', 'groin', 'soleus', 'neck'].forEach((w) => {
      resolveMuscle(w).forEach((m) => expect(isMuscle(m)).toBe(true));
    });
  });
});

describe('resolveMuscles', () => {
  it('gives every muscle the words mean, each once, in the order they first come', () => {
    expect(resolveMuscles(['Quads', 'glutes', 'quadriceps', 'abs'])).toEqual(['quadriceps', 'glutes', 'core']);
    expect(resolveMuscles(['arms', 'biceps', 'chest'])).toEqual(['biceps', 'triceps', 'forearms', 'chest']);
  });

  it('skips words that are not muscles and anything that is not a text', () => {
    expect(resolveMuscles(['chest', 'cardio', null, 7, 'triceps'])).toEqual(['chest', 'triceps']);
  });

  it('is [] for an empty list and for anything that is not a list', () => {
    expect(resolveMuscles([])).toEqual([]);
    [null, undefined, 'chest', {}, 3].forEach((v) => expect(resolveMuscles(v)).toEqual([]));
  });
});

// The vocabulary is added beside the muscle names the app already uses; until a later step moves them over, these hold the two together.
describe('the muscle names the app already uses', () => {
  it('reads every word canonicalizeMuscle knows as the muscle it gives', () => {
    ['quads', 'quad', 'hamstring', 'glute', 'calf', 'abs', 'abdominals', 'abdomen', 'abdominal'].forEach((w) => {
      expect(resolveMuscle(w)).toEqual([canonicalizeMuscle(w)]);
    });
  });

  it('has every muscle the running and hiking figures use', () => {
    [...Object.keys(RUNNING_MUSCLES), ...Object.keys(HIKING_MUSCLES)].forEach((m) => expect(isMuscle(m)).toBe(true));
  });

  it('reads every body-scan region as one or more muscles', () => {
    Object.keys(MUSCLE_ANCHORS).forEach((region) => {
      const muscles = resolveMuscle(region);
      expect(muscles.length).toBeGreaterThan(0);
    });
    expect(resolveMuscle('back')).toHaveLength(3);
  });
});
