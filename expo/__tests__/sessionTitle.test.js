// The made-up name a session the engine builds is given (lib/sessionPicker.js, names from lib/workoutNames.js).
import {
  SESSION_RULES, pickSession, swapOptions, replaceExercise, dropExercise, sessionToWorkout,
} from '../lib/sessionPicker';
import { NAME_POOLS, titleForSession } from '../lib/workoutNames';
import { MUSCLES } from '../lib/muscleVocabulary';
import { LIBRARY, normalizeName } from '../lib/exerciseLibrary';

const tiredExcept = (...ready) => Object.fromEntries(MUSCLES.filter((m) => !ready.includes(m)).map((m) => [m, 20]));
const base = { level: 'intermediate', goal: 'muscle', minutes: 45 };
const ALL_NAMES = Object.values(NAME_POOLS).flat();

describe('a session\'s title', () => {
  it('is a made-up name from the lists, kept apart from the muscles the session trains', () => {
    const s = pickSession({ ...base, equipment: 'gym' });
    expect(s.status).toBe('ok');
    expect(ALL_NAMES).toContain(s.title);
    expect(s.title).not.toBe(s.name);
    expect(typeof s.name).toBe('string');
    expect(s.name.length).toBeGreaterThan(0);
  });

  it('is never the name of an exercise, for any level, goal, time or equipment', () => {
    const exercises = new Set(LIBRARY.map((e) => normalizeName(e.name)));
    let checked = 0;
    ['beginner', 'intermediate', 'advanced'].forEach((level) => ['strength', 'muscle', 'general'].forEach((goal) => [15, 30, 45, 60].forEach((minutes) => {
      ['gym', 'dumbbells', 'bodyweight'].forEach((equipment) => {
        const s = pickSession({ level, goal, minutes, equipment });
        if (s.status !== 'ok') return;
        expect(exercises.has(normalizeName(s.title))).toBe(false);
        expect(ALL_NAMES).toContain(s.title);
        checked += 1;
      });
    })));
    expect(checked).toBeGreaterThan(50);
  });

  it('is the same every time for the same session', () => {
    const a = pickSession({ ...base, equipment: 'gym' });
    const b = pickSession({ ...base, equipment: 'gym' });
    expect(b.title).toBe(a.title);
    expect(b.titleVariant).toBe(a.titleVariant);
  });

  it('tells apart the times and the equipment the screens offer: 0 for a full gym at 15 minutes up to 11 for no equipment at 60', () => {
    const variant = (equipment, minutes) => pickSession({ ...base, equipment, minutes }).titleVariant;
    expect(variant('gym', 15)).toBe(0);
    expect(variant('gym', 30)).toBe(1);
    expect(variant('gym', 45)).toBe(2);
    expect(variant('gym', 60)).toBe(3);
    expect(variant('dumbbells', 15)).toBe(4);
    expect(variant('dumbbells', 30)).toBe(5);
    expect(variant('bodyweight', 15)).toBe(8);
    expect(variant('bodyweight', 60)).toBe(11);
    const all = [];
    ['gym', 'dumbbells', 'bodyweight'].forEach((e) => SESSION_RULES.minutesOptions.forEach((m) => all.push(variant(e, m))));
    expect(new Set(all).size).toBe(12);
    expect(Math.max(...all)).toBe(11);
  });

  it('puts a time that is not one of the four offered with the next one down, and a very long one with the last', () => {
    expect(pickSession({ ...base, equipment: 'gym', minutes: 20 }).titleVariant).toBe(1);
    expect(pickSession({ ...base, equipment: 'gym', minutes: 90 }).titleVariant).toBe(3);
    expect(pickSession({ ...base, equipment: 'gym', minutes: 10 }).titleVariant).toBe(0);
  });

  it('is different for the ways of training the same muscles', () => {
    // Only the chest, shoulders and triceps are rested, so every way of training them has the same lead muscles in a full gym.
    const recovery = tiredExcept('chest', 'shoulders', 'triceps');
    const titles = [15, 30, 45, 60].map((minutes) => ({ minutes, s: pickSession({ ...base, recovery, equipment: 'gym', minutes }) }))
      .filter(({ s }) => s.status === 'ok');
    expect(titles.length).toBe(4);
    const sameMuscles = titles.filter(({ s }) => s.name === titles[0].s.name);
    expect(new Set(sameMuscles.map(({ s }) => s.title)).size).toBe(sameMuscles.length);
  });

  it('is not on a session that could not be built', () => {
    const rest = pickSession({ ...base, recovery: tiredExcept() });
    expect(rest.status).toBe('rest');
    expect(rest.title).toBeUndefined();
    const limited = pickSession({ ...base, equipment: [], injuries: ['shoulder', 'knee', 'lower_back', 'neck', 'wrist', 'elbow', 'hip', 'ankle'], minutes: 15 });
    if (limited.status !== 'ok') expect(limited.title).toBeUndefined();
  });
});

// The muscles a session mainly works, worked out from its exercises the way the picker does: the ones with at least half as many sets as the busiest.
const leadOf = (exercises) => {
  const sets = {};
  exercises.forEach((x) => x.primary.forEach((m) => { sets[m] = (sets[m] || 0) + x.sets; }));
  const top = Math.max(...Object.values(sets));
  return Object.keys(sets).filter((m) => sets[m] >= top * 0.5);
};

describe('a session after a swap or an exercise taken out', () => {
  const s = pickSession({ ...base, equipment: 'gym' });

  it('has the title for the muscles that are left, and for the time and equipment it was built for', () => {
    let current = s;
    expect(s.title).toBe(titleForSession({ muscles: leadOf(s.exercises), variant: s.titleVariant }));
    while (current.exercises.length > 1) {
      current = dropExercise(current, current.exercises[0].id);
      expect(current.title).toBe(titleForSession({ muscles: leadOf(current.exercises), variant: s.titleVariant }));
    }
  });

  it('keeps its title when the exercise put in is the one that was there (the muscles it works have not changed)', () => {
    const first = s.exercises[0];
    const same = replaceExercise(s, first.id, first);
    expect(same.edited).toBe(true);
    expect(same.name).toBe(s.name);
    expect(same.title).toBe(s.title);
    expect(same.titleVariant).toBe(s.titleVariant);
  });

  it('always has a title from the lists after a swap, and keeps the time and equipment it was built for', () => {
    s.exercises.forEach((x) => {
      const options = swapOptions({ ...base, equipment: 'gym' }, s, x.id);
      options.forEach((o) => {
        const swapped = replaceExercise(s, x.id, o);
        expect(ALL_NAMES).toContain(swapped.title);
        expect(swapped.title).not.toBe(swapped.name);
        expect(swapped.titleVariant).toBe(s.titleVariant);
      });
    });
  });

  it('has a title after every exercise is taken out in turn, and none is left to name when the last goes', () => {
    let current = s;
    while (current.exercises.length > 1) {
      current = dropExercise(current, current.exercises[current.exercises.length - 1].id);
      expect(current.edited).toBe(true);
      expect(ALL_NAMES).toContain(current.title);
      expect(current.titleVariant).toBe(s.titleVariant);
    }
    expect(dropExercise(current, current.exercises[0].id)).toBeNull();
  });

  it('leaves a session alone when the exercise is not in it', () => {
    expect(dropExercise(s, 'not-an-exercise')).toBe(s);
    expect(replaceExercise(s, 'not-an-exercise', s.exercises[0])).toBe(s);
  });
});

describe('a session saved as a workout', () => {
  it('is named by its title, and by its muscles when it has none', () => {
    const s = pickSession({ ...base, equipment: 'gym' });
    expect(sessionToWorkout(s).name).toBe(s.title);
    const { title, ...untitled } = s;
    expect(title).toBeTruthy();
    expect(sessionToWorkout(untitled).name).toBe(s.name);
  });
});
