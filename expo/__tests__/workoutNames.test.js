// lib/workoutNames.js: the names of generated workouts and programs.
import {
  NAME_POOLS, PLAN_POOLS, FOCUS_KEYS, focusFromMuscles, focusFromText, titleForSession, titlesForPlan, planGoalKey, titleForPlan, goalsFromPrompt,
} from '@/lib/workoutNames';
import { LIBRARY, normalizeName } from '@/lib/exerciseLibrary';

const ALL_WORKOUT_NAMES = FOCUS_KEYS.flatMap((k) => NAME_POOLS[k]);
const ALL_PLAN_NAMES = Object.values(PLAN_POOLS).flat();

describe('the lists of names', () => {
  test('there is a list for every kind of workout the app can name', () => {
    expect([...FOCUS_KEYS].sort()).toEqual(
      ['arms', 'cardio', 'core', 'fullBody', 'glutes', 'legs', 'lower', 'pull', 'push', 'recovery', 'strength', 'upper'],
    );
  });

  test.each(FOCUS_KEYS)('%s has at least 12 names, so the four ways to train the same muscles never meet', (key) => {
    expect(NAME_POOLS[key].length).toBeGreaterThanOrEqual(12);
  });

  test.each(Object.keys(PLAN_POOLS))('%s plans have at least 8 names', (key) => {
    expect(PLAN_POOLS[key].length).toBeGreaterThanOrEqual(8);
  });

  test('no name is on two lists, and no plan name is also a workout name', () => {
    const all = [...ALL_WORKOUT_NAMES, ...ALL_PLAN_NAMES].map((n) => n.toLowerCase());
    expect(new Set(all).size).toBe(all.length);
  });

  test('every name is short, plain text with no digits', () => {
    [...ALL_WORKOUT_NAMES, ...ALL_PLAN_NAMES].forEach((name) => {
      expect(name).toBe(name.trim());
      expect(name.length).toBeGreaterThanOrEqual(5);
      expect(name.length).toBeLessThanOrEqual(30);
      expect(name.split(/\s+/).length).toBeLessThanOrEqual(5);
      expect(name).not.toMatch(/\d/);
      expect(name).toMatch(/^[A-Z]/);
      expect(name).not.toMatch(/[<>{}[\]\\|@#*_`]|https?:/);
    });
  });

  test('no name is the name of an exercise, or has a whole exercise of two or more words in it', () => {
    const exercises = new Set();
    LIBRARY.forEach((e) => {
      exercises.add(normalizeName(e.name));
      e.aliases.forEach((a) => exercises.add(normalizeName(a)));
    });
    const longOnes = [...exercises].filter((n) => n.includes(' '));
    [...ALL_WORKOUT_NAMES, ...ALL_PLAN_NAMES].forEach((name) => {
      const n = normalizeName(name);
      expect(exercises.has(n)).toBe(false);
      longOnes.forEach((x) => expect(` ${n} `.includes(` ${x} `)).toBe(false));
    });
  });

  test('no name can be mistaken for a plan, a result or a claim', () => {
    const banned = /\b(?:pro|legend|free|premium|plan|guarantee\w*|proven|clinical\w*|safe\w*|optimal|doctor|medical|rehab\w*|cure\w*)\b/i;
    [...ALL_WORKOUT_NAMES, ...ALL_PLAN_NAMES].forEach((name) => expect(name).not.toMatch(banned));
  });
});

describe('focusFromMuscles', () => {
  test.each([
    [['quadriceps'], 'legs'],
    [['quadriceps', 'hamstrings', 'calves'], 'legs'],
    [['glutes'], 'glutes'],
    [['quadriceps', 'glutes'], 'lower'],
    [['hamstrings', 'glutes'], 'lower'],
    [['chest'], 'push'],
    [['chest', 'shoulders', 'triceps'], 'push'],
    [['lats'], 'pull'],
    [['upper_back', 'biceps'], 'pull'],
    [['chest', 'lats'], 'upper'],
    [['core'], 'core'],
    [['biceps', 'triceps'], 'arms'],
    [['forearms'], 'arms'],
    [['chest', 'core'], 'push'],
    [['quadriceps', 'core'], 'legs'],
    [['quadriceps', 'chest'], 'fullBody'],
    [['glutes', 'lats'], 'fullBody'],
    [['chest', 'lats', 'quadriceps', 'glutes'], 'fullBody'],
    // more than three muscles is a full-body workout, even when they are all in one group (the same cut-off as the "Full Body" line under a session's name)
    [['quadriceps', 'hamstrings', 'calves', 'adductors'], 'fullBody'],
    [['chest', 'shoulders', 'triceps', 'core'], 'fullBody'],
    [[], 'fullBody'],
    [undefined, 'fullBody'],
    [['not_a_muscle'], 'fullBody'],
  ])('%j is %s', (muscles, key) => {
    expect(focusFromMuscles(muscles)).toBe(key);
  });
});

describe('focusFromText', () => {
  test.each([
    ['Trap Bar Deadlift Day', 'lower'],
    ['Deadlift Focus', 'lower'],
    ['Upper Body Push', 'push'],
    ['Trap Bar Deadlift', 'lower'],
    ['Shoulders & Traps', 'upper'],
    ['Upper Body', 'upper'],
    ['Lower Body', 'lower'],
    ['Legs & Glutes', 'lower'],
    ['Leg Press Day', 'legs'],
    ['Back Squat Focus', 'legs'],
    ['Hip Thrust Day', 'glutes'],
    ['Bench Press Day', 'push'],
    ['Chest and Triceps', 'push'],
    ['Back and Biceps', 'pull'],
    ['Pull Day', 'pull'],
    ['Push', 'push'],
    ['Arms', 'arms'],
    ['Arms and Abs', 'arms'],
    ['Arms & Core', 'arms'],
    ['Chest and Arms', 'push'],
    ['Back and Arms', 'pull'],
    ['Legs and Arms', 'legs'],
    ['Biceps Curl Day', 'pull'],
    ['Core & Abs', 'core'],
    ['Core and Upper Body', 'upper'],
    ['Full Body Strength', 'fullBody'],
    ['Total-Body Burn', 'fullBody'],
    ['Whole body', 'fullBody'],
    ['HIIT Cardio', 'cardio'],
    ['Conditioning Intervals', 'cardio'],
    ['Mobility and Cardio', 'cardio'],
    ['Cardio and Stretching', 'cardio'],
    ['Rest', 'recovery'],
    ['Rest Day', 'recovery'],
    ['Active Recovery & Mobility', 'recovery'],
    ['Yoga and Stretching', 'recovery'],
    ['Hip Mobility', 'recovery'],
    ['Deload Week Stretch', 'recovery'],
    ['Strength', 'strength'],
    ['Heavy Day', 'strength'],
    ['', 'fullBody'],
    [undefined, 'fullBody'],
    [42, 'fullBody'],
    ['Day 3', 'fullBody'],
  ])('%j is %s', (text, key) => {
    expect(focusFromText(text)).toBe(key);
  });

  test('when the words say nothing, the exercises under it do', () => {
    expect(focusFromText('Day 1', ['Bench Press', 'Overhead Press', 'Tricep Pushdown'])).toBe('push');
    expect(focusFromText('Day 2', ['Leg Extension', 'Leg Curl'])).toBe('legs');
    expect(focusFromText('Day 2b', ['Squat', 'Leg Curl'])).toBe('lower');
    expect(focusFromText('Day 3', ['Plank', 'Dead Bug'])).toBe('core');
    expect(focusFromText('Day 4', ['Not An Exercise', 'Neither Is This'])).toBe('fullBody');
    expect(focusFromText('Day 5', 'not a list')).toBe('fullBody');
  });

  test('the words win over the exercises', () => {
    expect(focusFromText('Core & Abs', ['Bench Press', 'Bench Press'])).toBe('core');
    expect(focusFromText('Rest', ['Squat'])).toBe('recovery');
  });

  test('an exercise in the text is read for its muscles, never used as the name', () => {
    expect(NAME_POOLS[focusFromText('Trap Bar Deadlift Day')]).not.toContain('Trap Bar Deadlift Day');
  });
});

describe('titleForSession', () => {
  const muscles = ['chest', 'shoulders'];

  test('the same muscles get the same name every time, whatever order they come in', () => {
    const a = titleForSession({ muscles, variant: 0 });
    expect(titleForSession({ muscles: [...muscles], variant: 0 })).toBe(a);
    expect(titleForSession({ muscles: [...muscles].reverse(), variant: 0 })).toBe(a);
    expect(titleForSession({ muscles: ['chest', 'shoulders', 'chest'], variant: 0 })).toBe(a);
  });

  test('the name comes from the list for what the muscles are', () => {
    expect(NAME_POOLS.push).toContain(titleForSession({ muscles }));
    expect(NAME_POOLS.legs).toContain(titleForSession({ muscles: ['quadriceps', 'hamstrings'] }));
    expect(NAME_POOLS.fullBody).toContain(titleForSession({ muscles: ['chest', 'lats', 'quadriceps', 'glutes'] }));
    expect(NAME_POOLS.fullBody).toContain(titleForSession({ muscles: [] }));
  });

  test.each(FOCUS_KEYS)('the 12 ways to train the same %s muscles each get a different name', (key) => {
    const sample = {
      legs: ['quadriceps'], glutes: ['glutes'], push: ['chest'], pull: ['lats'], upper: ['chest', 'lats'], lower: ['quadriceps', 'glutes'],
      core: ['core'], arms: ['biceps', 'triceps'], fullBody: ['chest', 'lats', 'quadriceps', 'glutes'],
    }[key];
    if (!sample) return; // cardio, strength and recovery are named from a written focus, not from muscles
    const names = Array.from({ length: 12 }, (_, variant) => titleForSession({ muscles: sample, variant }));
    expect(new Set(names).size).toBe(12);
  });

  test('a variant that is not a whole number counts as the first', () => {
    const first = titleForSession({ muscles, variant: 0 });
    expect(titleForSession({ muscles, variant: -3 })).toBe(first);
    expect(titleForSession({ muscles, variant: NaN })).toBe(first);
    expect(titleForSession({ muscles, variant: undefined })).toBe(first);
    expect(titleForSession({ muscles, variant: 1.9 })).toBe(titleForSession({ muscles, variant: 1 }));
  });

  test('anything else in place of the muscles gives a full-body name, never an error', () => {
    [undefined, null, 'chest', 5, {}, [null, 3, '']].forEach((muscles2) => {
      expect(NAME_POOLS.fullBody).toContain(titleForSession({ muscles: muscles2 }));
    });
    expect(NAME_POOLS.fullBody).toContain(titleForSession());
    expect(NAME_POOLS.fullBody).toContain(titleForSession(null));
  });
});

describe('titlesForPlan', () => {
  const week = [
    { day: 'Monday', focus: 'Upper Body Push', exercises: [{ name: 'Bench Press' }] },
    { day: 'Tuesday', focus: 'Lower Body', exercises: [{ name: 'Squat' }] },
    { day: 'Wednesday', focus: 'Rest', exercises: [] },
    { day: 'Thursday', focus: 'Pull Day', exercises: [{ name: 'Lat Pulldown' }] },
    { day: 'Friday', focus: 'Legs', exercises: [{ name: 'Leg Press' }] },
    { day: 'Saturday', focus: 'HIIT Cardio', exercises: [] },
    { day: 'Sunday', focus: 'Rest', exercises: [] },
  ];

  test('there is one name for each day, from the list that fits it', () => {
    const names = titlesForPlan(week, { seed: 'rec-1' });
    expect(names).toHaveLength(7);
    expect(NAME_POOLS.push).toContain(names[0]);
    expect(NAME_POOLS.lower).toContain(names[1]);
    expect(NAME_POOLS.recovery).toContain(names[2]);
    expect(NAME_POOLS.pull).toContain(names[3]);
    expect(NAME_POOLS.legs).toContain(names[4]);
    expect(NAME_POOLS.cardio).toContain(names[5]);
    expect(NAME_POOLS.recovery).toContain(names[6]);
  });

  test('two days of a plan never share a name, even when they train the same thing', () => {
    const names = titlesForPlan(week, { seed: 'rec-1' });
    expect(new Set(names).size).toBe(7);
    const sameSeven = Array.from({ length: 7 }, (_, i) => ({ day: `Day ${i + 1}`, focus: 'Legs' }));
    ['a', 'b', 'c', 'rec-9'].forEach((seed) => {
      expect(new Set(titlesForPlan(sameSeven, { seed })).size).toBe(7);
    });
  });

  test('the same plan reads the same every time, and a different plan can read differently', () => {
    expect(titlesForPlan(week, { seed: 'rec-1' })).toEqual(titlesForPlan(week, { seed: 'rec-1' }));
    const seeds = Array.from({ length: 12 }, (_, i) => titlesForPlan(week, { seed: `rec-${i}` }).join('|'));
    expect(new Set(seeds).size).toBeGreaterThan(6);
  });

  test('the first name does not depend on the days after it (Quick Workout names day one of the same plan)', () => {
    const first = titlesForPlan(week.slice(0, 1), { seed: 'rec-1' })[0];
    expect(titlesForPlan(week, { seed: 'rec-1' })[0]).toBe(first);
  });

  test('more days than there are names does not fail', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ day: `Day ${i + 1}`, focus: 'Rest' }));
    const names = titlesForPlan(many, { seed: 'x' });
    expect(names).toHaveLength(40);
    names.forEach((n) => expect(NAME_POOLS.recovery).toContain(n));
  });

  test('a day that is not an object, or has no focus, still gets a name', () => {
    const names = titlesForPlan([null, 'Legs', 7, {}, { focus: 5 }, { exercises: 'no' }], { seed: 's' });
    expect(names).toHaveLength(6);
    names.forEach((n) => expect(typeof n).toBe('string'));
  });

  test('no days, or something that is not a list of days, is no names', () => {
    expect(titlesForPlan([])).toEqual([]);
    expect(titlesForPlan(undefined)).toEqual([]);
    expect(titlesForPlan('week')).toEqual([]);
    expect(titlesForPlan(null, { seed: 1 })).toEqual([]);
  });

  test('a day named after a lift gets a made-up name, not the lift', () => {
    const [name] = titlesForPlan([{ day: 'Monday', focus: 'Trap Bar Deadlift Day', exercises: [{ name: 'Trap Bar Deadlift' }] }], { seed: 'r' });
    expect(name).not.toMatch(/trap bar|deadlift day/i);
    expect(NAME_POOLS.lower).toContain(name);
  });
});

describe('plan names', () => {
  test.each([
    [['Build Muscle'], 'muscle'],
    [['Muscle Gain', 'Strength'], 'muscle'],
    [['Strength'], 'strength'],
    [['get_stronger'], 'strength'],
    [['Lose Weight'], 'lose'],
    [['lose_weight'], 'lose'],
    [['Fat loss'], 'lose'],
    [['Endurance'], 'endurance'],
    [['Run a 5K'], 'endurance'],
    [['Flexibility'], 'mobility'],
    [['General Fitness'], 'general'],
    [[], 'general'],
    [undefined, 'general'],
    [null, 'general'],
    ['Build Muscle', 'muscle'],
    [[5, null, {}], 'general'],
  ])('goals %j are %s', (goals, key) => {
    expect(planGoalKey(goals)).toBe(key);
  });

  test('the name is from the list for the goal, the same every time, and changes with the plan', () => {
    const a = titleForPlan({ seed: 'rec-1', goals: ['Build Muscle'] });
    expect(PLAN_POOLS.muscle).toContain(a);
    expect(titleForPlan({ seed: 'rec-1', goals: ['Build Muscle'] })).toBe(a);
    const many = new Set(Array.from({ length: 16 }, (_, i) => titleForPlan({ seed: `rec-${i}`, goals: ['Build Muscle'] })));
    expect(many.size).toBeGreaterThan(3);
    expect(PLAN_POOLS.general).toContain(titleForPlan());
  });

  test('the goals are read back from the request a plan was made from', () => {
    const prompt = 'Create a personalized 7-day workout plan for a beginner user with goals: Build Muscle, Strength. About the user: Age: 30. Recent workout history: [].';
    expect(goalsFromPrompt(prompt)).toEqual(['Build Muscle', 'Strength']);
    expect(goalsFromPrompt('Create a plan for a beginner user with goals: general fitness.')).toEqual(['general fitness']);
    expect(goalsFromPrompt('with goals: Lose Weight.')).toEqual(['Lose Weight']);
    expect(goalsFromPrompt('no goals in here')).toEqual([]);
    expect(goalsFromPrompt('with goals: .')).toEqual([]);
    expect(goalsFromPrompt(undefined)).toEqual([]);
    expect(goalsFromPrompt(12)).toEqual([]);
  });
});
