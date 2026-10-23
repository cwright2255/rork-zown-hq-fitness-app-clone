// Where muscle recovery (lib/muscleRecovery.js) is hooked in. The Health screen, the workout screen and the Home card are not rendered
// here (the Home card has its own test, MusclesWidget.test.jsx), so the hookups are read from the source, the way trainingStateWiring.test.js
// reads the training-state ones. The rules themselves are tested in muscleRecovery.test.js; what the phone shows is checked on the phone
// (docs/DEVICE_CHECKS.md).
import fs from 'fs';
import path from 'path';
import { calculateMuscleRecovery, workoutLoads } from '../lib/muscleRecovery';
import { withoutUndefined } from '../lib/firestoreSafe';
import { TRAINING_STATE_VERSION as PHONE_VERSION } from '../lib/trainingState';
import { TRAINING_STATE_VERSION as SERVER_VERSION } from '../functions/src/trainingState.js';

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const active = read('app/workout/active.jsx');
const health = read('app/health.jsx');
const widget = read('components/MusclesWidget.jsx');
const service = read('services/trainingStateService.js');
const trainingState = read('lib/trainingState.js');

describe('the workout screen records what was done', () => {
  it('saves every exercise with whether it was finished and the sets that were logged, in both ways of finishing', () => {
    expect(active.match(/exercises: exercisesToSave\(\),/g)).toHaveLength(2);
    expect(active.match(/await addCompletedWorkout\(/g)).toHaveLength(2);
    expect(active).not.toMatch(/exercises: exercises\.map\(/);
  });

  it('builds each saved exercise from the plan, the finished set and the logged sets', () => {
    const body = active.slice(active.indexOf('const exercisesToSave = () =>'), active.indexOf('/* ', active.indexOf('const exercisesToSave = () =>')));
    expect(body).toMatch(/name: e\.name,/);
    expect(body).toMatch(/sets: e\.sets,/);
    expect(body).toMatch(/reps: e\.reps,/);
    expect(body).toMatch(/muscleGroups: e\.muscleGroups \|\| \[\],/);
    expect(body).toMatch(/done: completedSet\.has\(e\.id\),/);
    expect(body).toMatch(/performed: \(loggedSetsByExercise\[e\.id\] \|\| \[\]\)\.map\(\(\{ weight, reps, rpe \}\) => \(\{ weight, reps, rpe \}\)\),/);
  });

  it('reads the finished set and the logged sets from the state the screen already keeps, declared before it is used', () => {
    expect(active.indexOf('const [loggedSetsByExercise')).toBeLessThan(active.indexOf('const exercisesToSave'));
    expect(active).toMatch(/const completedCount = completedSet\.size;/);
  });

  it('is read by the recovery rules as the sets that were done: the shape the screen saves is the shape the model reads', () => {
    const saved = withoutUndefined({
      completedAt: '2026-10-14T16:00:00.000Z', // 9.5 hours before the time given below
      exercises: [
        { name: 'Barbell Bench Press', sets: 3, reps: '8-10', muscleGroups: ['chest'], done: true, performed: [
          { weight: 135, reps: 8, rpe: 'hard' }, { weight: 135, reps: 8, rpe: 'hard' }, { weight: 135, reps: 6, rpe: 'hard' }, { weight: 135, reps: 5, rpe: 'hard' },
        ] },
        { name: 'Pull-Up', sets: 3, reps: 8, muscleGroups: ['lats'], done: false, performed: [] },
      ],
    });
    expect(workoutLoads(saved)).toEqual({ chest: 4, shoulders: 2, triceps: 2 }); // four hard sets; the pull-ups were skipped
    expect(calculateMuscleRecovery({ completedWorkouts: [saved], now: new Date('2026-10-15T01:30:00Z') })).toEqual({ chest: 70, shoulders: 87, triceps: 87 });
  });
});

describe('the screens read recovery from the one module', () => {
  it('has the Health heatmap and the Home card work out recovery with it, and show tiredness as 100 minus recovery', () => {
    for (const source of [health, widget]) {
      expect(source).toMatch(/import \{ calculateMuscleRecovery, fatigueFromRecovery \} from '@\/lib\/muscleRecovery';/);
      expect(source).not.toMatch(/calculateMuscleFatigue/);
    }
    expect(health).toMatch(/const fatigue = fatigueFromRecovery\(calculateMuscleRecovery\(\{ completedWorkouts, runs, completedHikes, recovery \}\)\);/);
    expect(widget).toMatch(/const recovery = calculateMuscleRecovery\(\{[\s\S]*?completedWorkouts: workouts,[\s\S]*?recovery: recoveryInputs\(rookRecovery, sleep\),[\s\S]*?\}\);\s*return topMuscles\(fatigueFromRecovery\(recovery\), 3\);/);
  });

  it('has the training state work it out with the same module, so the AI and the screens read the same numbers', () => {
    expect(service).toMatch(/import \{ calculateMuscleRecovery \} from '@\/lib\/muscleRecovery';/);
    expect(service).toMatch(/const recovery = calculateMuscleRecovery\(\{/);
    expect(service).toMatch(/buildTrainingState\(\{ now, workouts, runs, hikes, recovery, /);
    expect(service).not.toMatch(/calculateMuscleFatigue/);
  });

  it('reads dates and the muscles a workout worked from the same module as the screens, not from its own copy', () => {
    expect(trainingState).toMatch(/import \{ workoutLoads, timeOf, workoutTime \} from '\.\/muscleRecovery';/);
    expect(trainingState).not.toMatch(/const timeOf =|const workoutTime =/);
    expect(trainingState).not.toMatch(/canonicalizeMuscle/);
  });

  it('leaves nothing but the old module itself, and its test, using the relative fatigue figure', () => {
    const files = [];
    const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).forEach((entry) => {
      const relative = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (!['node_modules', '__tests__', 'functions', 'docs', '.expo'].includes(entry.name)) walk(relative); }
      else if (/\.(js|jsx)$/.test(entry.name)) files.push(relative);
    });
    ['app', 'components', 'lib', 'services', 'store', 'hooks', 'src'].filter((d) => fs.existsSync(path.join(root, d))).forEach(walk);
    // A comment may name it; an import or a call may not.
    const uses = /import[^;]*\bcalculateMuscleFatigue\b|\bcalculateMuscleFatigue\(/;
    const users = files.filter((f) => uses.test(read(f)) && !f.endsWith(path.join('lib', 'muscleFatigue.js')));
    expect(users).toEqual([]);
  });
});

describe('the phone and the plan function agree on the shape of the training state', () => {
  it('send and accept the same version', () => {
    expect(PHONE_VERSION).toBe(3);
    expect(SERVER_VERSION).toBe(PHONE_VERSION);
  });

  it('name the recovery list the same way', () => {
    const server = read('functions/src/trainingState.js');
    expect(trainingState).toMatch(/muscleRecovery: hasHistory \? leastRecovered\(recovery, MAX_MUSCLES\) : null,/);
    expect(server).toMatch(/muscleList\(input\.muscleRecovery, 'recovery', 0, 99\)/);
  });
});
