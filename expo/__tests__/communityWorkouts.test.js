// The pre-made workouts in Community Workouts (data/communityWorkouts.js) and what a tap saves (lib/communityWorkouts.js).
// The data is written by hand, so what must stay true of it is checked here: every exercise is one the app knows (so its page opens and its
// muscles show on the preview), what a workout says it needs is what its exercises need, a level means what it says, there is a real spread
// of sizes, and nothing claims a creator or a crowd.
import { COMMUNITY_WORKOUTS, COMMUNITY_CATEGORIES } from '../data/communityWorkouts';
import {
  communityWorkoutId, communityWorkoutsFor, communityWorkoutMinutes, levelLabel, workoutFromCommunity,
} from '../lib/communityWorkouts';
import { estimateDurationMinutes, calculateXpReward } from '../lib/planDayWorkout';
import { LIBRARY, findExercise, normalizeName } from '../lib/exerciseLibrary';
import { strengthMuscleHeat } from '../lib/workoutMuscleHeat';

const byName = new Map(LIBRARY.map((e) => [normalizeName(e.name), e]));
const exerciseOf = (e) => byName.get(normalizeName(e.name));
const gearOf = (w) => [...new Set(w.exercises.flatMap((e) => exerciseOf(e).equipment).filter((g) => g !== 'bodyweight'))].sort();

// What each thing a workout can say it needs stands for in the library's own words. The gear its exercises use must be exactly this.
const GEAR = {
  'No equipment': [],
  Dumbbells: ['dumbbell'],
  'Dumbbells and a bench': ['bench', 'dumbbell'],
  'A pull-up bar': ['pullup_bar'],
  'A resistance band': ['bands'],
  'A bench or box': ['bench'],
  'A bench': ['bench'],
  'Barbell, rack and bench': ['barbell', 'bench', 'rack'],
  'Barbell, rack, bench and a pull-up bar': ['barbell', 'bench', 'pullup_bar', 'rack'],
  'Gym machines': ['machine'],
  'Gym machines and cables': ['cable', 'machine'],
  'A pull-up bar, an ab wheel and a bench': ['ab_wheel', 'bench', 'pullup_bar'],
};
const LEVELS = ['beginner', 'intermediate', 'advanced'];
const longestRun = (values) => values.reduce((best, v, i) => {
  const run = i > 0 && values[i - 1] === v ? best.run + 1 : 1;
  return { run, max: Math.max(best.max, run) };
}, { run: 0, max: 0 }).max;

describe('every workout is written properly', () => {
  it('has the fields a saved workout needs, and no field that claims a creator or a crowd', () => {
    COMMUNITY_WORKOUTS.forEach((w) => {
      expect(Object.keys(w).sort()).toEqual(['category', 'description', 'difficulty', 'equipment', 'exercises', 'name', 'slug']);
      expect(w.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(w.name.trim()).toBe(w.name);
      expect(w.description.length).toBeGreaterThan(30);
      expect(w.description.length).toBeLessThanOrEqual(180);
    });
  });

  it('has a different slug and a different name for each', () => {
    expect(new Set(COMMUNITY_WORKOUTS.map((w) => w.slug)).size).toBe(COMMUNITY_WORKOUTS.length);
    expect(new Set(COMMUNITY_WORKOUTS.map((w) => w.name.toLowerCase())).size).toBe(COMMUNITY_WORKOUTS.length);
  });

  it('has a short name with no digits that is not the name of an exercise', () => {
    COMMUNITY_WORKOUTS.forEach((w) => {
      expect(w.name.length).toBeLessThanOrEqual(22); // the card shows one line
      expect(w.name).not.toMatch(/\d/);
      expect(byName.has(normalizeName(w.name))).toBe(false);
    });
  });

  it('says nothing about who made it, how many did it or how it rated', () => {
    const claims = /popular|trending|top[- ]rated|rated|\bstars?\b|\blikes?\b|favou?rite|thousands|\bmembers\b|\busers\b|\bviewers?\b|\bcreated by\b|\bby the community\b|\d+\s*(people|athletes|lifters)/i;
    COMMUNITY_WORKOUTS.forEach((w) => {
      expect(`${w.name} ${w.description}`).not.toMatch(claims);
    });
  });

  it('is in a category the tab has a choice for, and each choice has several workouts', () => {
    COMMUNITY_WORKOUTS.forEach((w) => expect(COMMUNITY_CATEGORIES).toContain(w.category));
    COMMUNITY_CATEGORIES.forEach((c) => {
      expect(COMMUNITY_WORKOUTS.filter((w) => w.category === c).length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('every exercise is one the app knows', () => {
  it('is named exactly as the library names it, so its page and its muscles are found', () => {
    COMMUNITY_WORKOUTS.forEach((w) => {
      expect(w.exercises.length).toBeGreaterThanOrEqual(4);
      w.exercises.forEach((e) => {
        const found = exerciseOf(e);
        expect({ workout: w.slug, exercise: e.name, found: !!found }).toEqual({ workout: w.slug, exercise: e.name, found: true });
        expect(findExercise(e.name)?.id).toBe(found.id);
        expect(e.name).toBe(found.name); // the library's own spelling, not an alias
      });
    });
  });

  it('does not repeat an exercise inside one workout', () => {
    COMMUNITY_WORKOUTS.forEach((w) => {
      const names = w.exercises.map((e) => normalizeName(e.name));
      expect(new Set(names).size).toBe(names.length);
    });
  });

  it('has sets, reps and rest the workout screen can use', () => {
    COMMUNITY_WORKOUTS.forEach((w) => w.exercises.forEach((e) => {
      expect(Object.keys(e).sort()).toEqual(['name', 'reps', 'restSeconds', 'sets']);
      expect(Number.isInteger(e.sets) && e.sets >= 2 && e.sets <= 5).toBe(true);
      expect(e.reps).toMatch(/^\d{1,2}(-\d{1,2})?( sec)?$/); // 12, 8-10, or a hold: 30 sec
      expect(Number.isInteger(e.restSeconds) && e.restSeconds >= 15 && e.restSeconds <= 120).toBe(true);
    }));
  });

  it('shows muscles on the preview figure for every workout', () => {
    COMMUNITY_WORKOUTS.forEach((w) => {
      const heat = strengthMuscleHeat(w.exercises);
      expect(heat.targetMuscles.length).toBeGreaterThan(0);
    });
  });
});

describe('what a workout says it needs is what it needs', () => {
  it('only says things this test knows the meaning of', () => {
    COMMUNITY_WORKOUTS.forEach((w) => expect(Object.keys(GEAR)).toContain(w.equipment));
  });

  it('uses exactly the gear it names: no more, so the person is not caught out, and no less, so it is not a false claim', () => {
    COMMUNITY_WORKOUTS.forEach((w) => {
      expect({ workout: w.slug, gear: gearOf(w) }).toEqual({ workout: w.slug, gear: GEAR[w.equipment] });
    });
  });
});

describe('a level means what it says', () => {
  const levelOf = (e) => exerciseOf(e).difficulty;

  it('holds only beginner exercises in a beginner workout', () => {
    COMMUNITY_WORKOUTS.filter((w) => w.difficulty === 'beginner').forEach((w) => {
      w.exercises.forEach((e) => expect({ workout: w.slug, exercise: e.name, level: levelOf(e) }).toEqual({ workout: w.slug, exercise: e.name, level: 'beginner' }));
    });
  });

  it('holds no advanced exercise in an intermediate workout, and at least one intermediate one', () => {
    COMMUNITY_WORKOUTS.filter((w) => w.difficulty === 'intermediate').forEach((w) => {
      const levels = w.exercises.map(levelOf);
      expect(levels).not.toContain('advanced');
      expect(levels).toContain('intermediate');
    });
  });

  it('holds at least one advanced exercise in an advanced workout', () => {
    COMMUNITY_WORKOUTS.filter((w) => w.difficulty === 'advanced').forEach((w) => expect(w.exercises.map(levelOf)).toContain('advanced'));
  });

  it('is one of the three levels the app uses everywhere', () => {
    COMMUNITY_WORKOUTS.forEach((w) => expect(LEVELS).toContain(w.difficulty));
  });
});

describe('there is a real variety to choose from', () => {
  const minutes = COMMUNITY_WORKOUTS.map(communityWorkoutMinutes);

  it('has around thirty workouts, in every category and at every level', () => {
    expect(COMMUNITY_WORKOUTS.length).toBeGreaterThanOrEqual(28);
    expect(COMMUNITY_WORKOUTS.length).toBeLessThanOrEqual(36);
    LEVELS.forEach((level) => expect(COMMUNITY_WORKOUTS.filter((w) => w.difficulty === level).length).toBeGreaterThanOrEqual(3));
    expect(COMMUNITY_WORKOUTS.filter((w) => w.difficulty === 'beginner').length).toBeGreaterThanOrEqual(10);
  });

  it('runs from about ten minutes to about an hour, with several of each end and plenty in the middle', () => {
    expect(Math.min(...minutes)).toBeLessThanOrEqual(11);
    expect(Math.max(...minutes)).toBeGreaterThanOrEqual(55);
    expect(minutes.filter((m) => m <= 15).length).toBeGreaterThanOrEqual(3);
    expect(minutes.filter((m) => m >= 35).length).toBeGreaterThanOrEqual(3);
    expect(minutes.filter((m) => m > 15 && m < 35).length).toBeGreaterThanOrEqual(10);
  });

  it('has short workouts and long ones in the number of exercises, too', () => {
    const counts = COMMUNITY_WORKOUTS.map((w) => w.exercises.length);
    expect(Math.min(...counts)).toBeLessThanOrEqual(4);
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(7);
  });

  it('needs no equipment for several, and every kind of gear for the rest', () => {
    expect(COMMUNITY_WORKOUTS.filter((w) => w.equipment === 'No equipment').length).toBeGreaterThanOrEqual(6);
    const gear = new Set(COMMUNITY_WORKOUTS.flatMap(gearOf));
    ['dumbbell', 'barbell', 'machine', 'cable', 'bands', 'pullup_bar', 'bench'].forEach((g) => expect(gear.has(g)).toBe(true));
  });

  it('is in a mixed order, so "All" does not show one category or one level for a whole stretch', () => {
    expect(longestRun(COMMUNITY_WORKOUTS.map((w) => w.category))).toBe(1);
    expect(longestRun(COMMUNITY_WORKOUTS.map((w) => w.difficulty))).toBeLessThanOrEqual(3);
    expect(new Set(COMMUNITY_WORKOUTS.slice(0, 6).map((w) => w.category)).size).toBe(6);
  });
});

describe('communityWorkoutsFor', () => {
  it('gives every workout for All, or for anything that is not a category', () => {
    expect(communityWorkoutsFor('All')).toEqual(COMMUNITY_WORKOUTS);
    expect(communityWorkoutsFor(undefined)).toEqual(COMMUNITY_WORKOUTS);
    expect(communityWorkoutsFor('Yoga')).toEqual(COMMUNITY_WORKOUTS);
  });

  it('gives the workouts in a category, in the order they are written, and the categories add up to the whole', () => {
    COMMUNITY_CATEGORIES.forEach((c) => {
      const shown = communityWorkoutsFor(c);
      expect(shown.length).toBeGreaterThan(0);
      expect(shown.every((w) => w.category === c)).toBe(true);
      expect(shown).toEqual(COMMUNITY_WORKOUTS.filter((w) => w.category === c));
    });
    const total = COMMUNITY_CATEGORIES.reduce((n, c) => n + communityWorkoutsFor(c).length, 0);
    expect(total).toBe(COMMUNITY_WORKOUTS.length);
  });
});

describe('workoutFromCommunity: what a tap saves', () => {
  const sample = COMMUNITY_WORKOUTS.find((w) => w.slug === 'goblet-gang');

  it('saves the same fields a plan day does, under one fixed id', () => {
    const saved = workoutFromCommunity(sample);
    expect(saved).toMatchObject({
      id: communityWorkoutId('goblet-gang'), name: 'Goblet Gang', category: 'Lower Body', difficulty: 'beginner', source: 'community',
      description: sample.description,
    });
    expect(saved.id).toBe('community-goblet-gang');
    expect(Object.keys(saved).sort()).toEqual(['category', 'description', 'difficulty', 'duration', 'exercises', 'id', 'name', 'source', 'xpReward']);
  });

  it('works out its length and XP with the same formulas Quick Workout and the plan use', () => {
    COMMUNITY_WORKOUTS.forEach((w) => {
      const saved = workoutFromCommunity(w);
      expect(saved.duration).toBe(estimateDurationMinutes(w.exercises));
      expect(saved.duration).toBe(communityWorkoutMinutes(w));
      expect(saved.xpReward).toBe(calculateXpReward(w.difficulty, saved.duration));
    });
    // 4 x (30 + 60) + 3 x (30 + 60) + 3 x (30 + 45) + 3 x (30 + 45) + 3 x (30 + 45) + 3 x (30 + 30) = 1515 s = 25 min; beginner, so 50 XP for each 15 minutes
    expect(workoutFromCommunity(sample).duration).toBe(25);
    expect(workoutFromCommunity(sample).xpReward).toBe(100);
  });

  it('keeps the exercises as written, with nothing undefined (Firestore refuses a field that is)', () => {
    COMMUNITY_WORKOUTS.forEach((w) => {
      const saved = workoutFromCommunity(w);
      expect(saved.exercises).toEqual(w.exercises);
      expect(JSON.parse(JSON.stringify(saved))).toEqual(saved);
      expect(Object.values(saved).every((v) => v !== undefined)).toBe(true);
    });
  });

  it('gives a copy: saving does not hand out the data itself, so nothing can change it', () => {
    const saved = workoutFromCommunity(sample);
    expect(saved.exercises).not.toBe(sample.exercises);
    saved.exercises[0].sets = 99;
    expect(sample.exercises[0].sets).toBe(4);
  });

  it('gives each workout an id of its own', () => {
    const ids = COMMUNITY_WORKOUTS.map((w) => workoutFromCommunity(w).id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^community-[a-z0-9-]+$/)); // a Firestore document id: no slashes
  });
});

describe('levelLabel', () => {
  it('capitalises the level for a card', () => {
    expect(levelLabel('beginner')).toBe('Beginner');
    expect(levelLabel('advanced')).toBe('Advanced');
    expect(levelLabel(undefined)).toBe('');
  });
});
