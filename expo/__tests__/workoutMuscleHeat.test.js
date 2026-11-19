// The heat on a workout's preview screen is worked out from the workout itself (lib/workoutMuscleHeat.js): sets counted 1 for a muscle an
// exercise is mainly for and 0.5 for one that helps, added up and scaled so the most-worked muscle is 100, on the ten regions the body
// figure paints. Running uses the fixed running weights. These check the arithmetic, the grouping onto the figure's regions, and that
// every day of every program in the app gets a heat figure.
import { strengthMuscleHeat, runningMuscleHeat, weekExercises } from '../lib/workoutMuscleHeat';
import { MUSCLE_ANCHORS } from '../lib/muscleAnchors';
import { WORKOUT_PROGRAMS, getProgramWeek } from '../data/workoutPrograms';
import { getTargetMuscles, getTargetMuscleIntensities } from '../lib/muscleFatigue';

describe('strengthMuscleHeat from exercises in the library', () => {
  it('counts a main muscle 1 and a helping muscle 0.5 for every set, and scales the most-worked to 100', () => {
    // Barbell Bench Press: chest main; shoulders and triceps help.
    const heat = strengthMuscleHeat([{ name: 'Barbell Bench Press', sets: 3 }]);
    expect(heat.muscleIntensities).toEqual({ chest: 100, shoulders: 50, triceps: 50 });
    expect(heat.targetMuscles[0]).toBe('chest');
    expect(heat.targetMuscles.sort()).toEqual(['chest', 'shoulders', 'triceps']);
  });

  it('finds an exercise by the name a program gives it, not only the library name', () => {
    expect(strengthMuscleHeat([{ name: 'Bench Press', sets: 3 }]).muscleIntensities.chest).toBe(100);
  });

  it('reads the Push day on the preview screen: pushing muscles, no legs, hardest first', () => {
    const push = ['Bench Press', 'Overhead Press', 'Incline Dumbbell Press', 'Lateral Raise', 'Tricep Pushdown', 'Tricep Dip']
      .map((name) => ({ name, sets: 3, reps: '8-10' }));
    const heat = strengthMuscleHeat(push);
    ['chest', 'shoulders', 'triceps'].forEach((m) => expect(heat.targetMuscles).toContain(m));
    ['quadriceps', 'hamstrings', 'glutes', 'calves'].forEach((m) => expect(heat.targetMuscles).not.toContain(m));
    expect(Math.max(...Object.values(heat.muscleIntensities))).toBe(100);
    const order = heat.targetMuscles.map((m) => heat.muscleIntensities[m]);
    expect([...order].sort((a, b) => b - a)).toEqual(order);
  });

  it('adds sets up across exercises', () => {
    const heat = strengthMuscleHeat([{ name: 'Barbell Bench Press', sets: 4 }, { name: 'Barbell Bench Press', sets: 4 }]);
    expect(heat.muscleIntensities).toEqual({ chest: 100, shoulders: 50, triceps: 50 });
  });
});

describe('strengthMuscleHeat from the muscles written on a saved workout', () => {
  it('counts each written muscle as a main muscle, in words the app already uses', () => {
    const heat = strengthMuscleHeat([
      { name: 'Mystery Move A', sets: 2, muscleGroups: ['Chest'] },
      { name: 'Mystery Move B', sets: 3, muscleGroups: ['quads'] },
    ]);
    expect(heat.muscleIntensities).toEqual({ quadriceps: 100, chest: 67 });
    expect(heat.targetMuscles).toEqual(['quadriceps', 'chest']);
  });

  it('paints lats, upper back, traps and lower back as one "back", counted once per exercise', () => {
    const heat = strengthMuscleHeat([
      { name: 'Mystery Row', sets: 3, muscleGroups: ['lats', 'upper back', 'traps'] },
      { name: 'Mystery Squat', sets: 3, muscleGroups: ['quads'] },
    ]);
    expect(heat.muscleIntensities).toEqual({ back: 100, quadriceps: 100 });
  });

  it('leaves out muscles the body figure has no region for', () => {
    expect(strengthMuscleHeat([{ name: 'Mystery Curl', sets: 3, muscleGroups: ['forearms', 'neck'] }])).toEqual({ targetMuscles: [], muscleIntensities: {} });
  });

  it('takes the number of sets from a number, from a list of sets, or counts one when it is not said', () => {
    const only = (sets) => strengthMuscleHeat([{ name: 'Mystery Move A', sets, muscleGroups: ['chest'] }, { name: 'Mystery Move B', sets: 1, muscleGroups: ['core'] }]).muscleIntensities;
    expect(only(4)).toEqual({ chest: 100, core: 25 });
    expect(only([{}, {}, {}, {}])).toEqual({ chest: 100, core: 25 });
    expect(only(undefined)).toEqual({ chest: 100, core: 100 });
    expect(only(0)).toEqual({ chest: 100, core: 100 });
  });
});

describe('strengthMuscleHeat with nothing to go on', () => {
  it.each([[undefined], [null], [[]], ['chest'], [[{ name: 'No Such Exercise' }]], [[{}]]])('is empty for %j', (input) => {
    expect(strengthMuscleHeat(input)).toEqual({ targetMuscles: [], muscleIntensities: {} });
  });
});

describe('every region it returns is one the body figure can paint', () => {
  it('holds for every day of every program', () => {
    WORKOUT_PROGRAMS.forEach((program) => {
      for (let weekNumber = 1; weekNumber <= 9; weekNumber += 1) {
        const week = getProgramWeek(program.id, weekNumber);
        if (!week) continue;
        week.days.forEach((day) => {
          const heat = strengthMuscleHeat(day.exercises);
          expect(heat.targetMuscles.length).toBeGreaterThan(0);
          heat.targetMuscles.forEach((m) => expect(Object.keys(MUSCLE_ANCHORS)).toContain(m));
          expect(Math.max(...Object.values(heat.muscleIntensities))).toBe(100);
        });
      }
    });
  });
});

describe('runningMuscleHeat', () => {
  it('is the fixed running weights the trail preview also uses', () => {
    const heat = runningMuscleHeat();
    expect(heat.targetMuscles).toEqual(getTargetMuscles('running'));
    expect(heat.muscleIntensities).toEqual(getTargetMuscleIntensities('running'));
    expect(Math.max(...Object.values(heat.muscleIntensities))).toBe(100);
  });
});

describe('weekExercises', () => {
  it('lists the exercises of every day in a week, and nothing for no week', () => {
    const week = getProgramWeek(WORKOUT_PROGRAMS[0].id, 1);
    expect(weekExercises(week)).toHaveLength(week.days.reduce((n, d) => n + d.exercises.length, 0));
    expect(weekExercises(null)).toEqual([]);
  });
});
