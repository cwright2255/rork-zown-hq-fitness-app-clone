// Where the training state is hooked in. The store and the Coach screen are not run here (the store loads Firebase with dynamic
// imports, and the Coach screen's tests replace most of what it reads), so the hookups are read from the source, the way
// entitlementsWiring.test.js reads the functions. The logic behind each is tested in trainingState.test.js, trainingStateService.test.js,
// coachDataContext.test.js and trainingStateServer.test.js; what the phone really sends is checked on the phone (docs/DEVICE_CHECKS.md).
import fs from 'fs';
import path from 'path';

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const store = read('store/workoutStore.js');
const coach = read('app/coach.jsx');
const index = read('functions/src/index.js');
const brief = read('services/briefService.js');

describe('the plan request', () => {
  const fn = store.slice(store.indexOf('generateNewWorkoutRecommendation: async'), store.indexOf('getWorkoutStreak:'));

  it('asks for the training state from the service, loaded on demand so the store does not import the other stores', () => {
    expect(fn).toMatch(/await import\('\.\.\/services\/trainingStateService'\)/);
    expect(store).not.toMatch(/^import .*trainingStateService/m);
    expect(fn).toMatch(/getTrainingState\(uid\)/);
  });

  it('carries on without the state if asking for it fails', () => {
    expect(fn).toMatch(/try \{\s*const \{ getTrainingState \} = await import[\s\S]*?\} catch \{\s*trainingState = null;\s*\}/);
  });

  it('lists the recent workouts after the state has brought them up to date, and sends the request through the builder', () => {
    expect(fn.indexOf('getTrainingState(uid)')).toBeLessThan(fn.indexOf('historyForPlan(get().completedWorkouts)'));
    expect(fn).toMatch(/fn\(workoutPlanRequest\(\{ fitnessLevel, goals, history, profile, trainingState \}\)\)/);
    expect(store).toMatch(/import \{ workoutPlanRequest \} from '@\/lib\/trainingState';/);
  });
});

describe('the cloud plan function', () => {
  const fn = index.slice(index.indexOf('export const generateWorkoutPlan'), index.indexOf('export const postLLM'));

  it('reads the state from the request and checks it before the prompt is written', () => {
    expect(index).toMatch(/import \{ sanitizeTrainingState, trainingStateText \} from '\.\/trainingState\.js';/);
    expect(fn).toMatch(/const \{ fitnessLevel, goals, history, profile, trainingState \} = req\.data;/);
    expect(fn).toMatch(/const stateText = trainingStateText\(sanitizeTrainingState\(trainingState\), \{\s*hasInjuries: Array\.isArray\(p\.injuries\) && p\.injuries\.length > 0,\s*\}\);/);
  });

  it('puts the checked text between the profile text and the recent history, and nowhere else', () => {
    expect(fn).toMatch(/\$\{profileText\}\$\{stateText\} Recent workout history:/);
    expect(fn.match(/stateText/g)).toHaveLength(2);
  });
});

describe('the Coach', () => {
  it('reads the state on its own, inside a try, so a reading that cannot be had leaves out only its lines', () => {
    expect(coach).toMatch(/import \{ readTrainingState \} from '@\/services\/trainingStateService';/);
    expect(coach).toMatch(/try \{ trainingState = readTrainingState\(\{ liftPRs, injuries \}\); \} catch \{ trainingState = null; \}/);
  });

  it('reads the injuries the person reported from their profile, and rebuilds the state when they change', () => {
    expect(coach).toMatch(/const injuries = user\?\.fitnessMetrics\?\.injuries;/);
    expect(coach).toMatch(/\[liftPRs, runs, completedHikes, completedWorkouts, injuries\]/);
  });

  it('hands the state to the data message with the rest of what it is told', () => {
    const context = coach.slice(coach.indexOf('const dataContext = useMemo'), coach.indexOf('// ---- Chat helpers'));
    expect(context).toMatch(/trainingLoad: calculateTrainingLoad\([\s\S]*?\),\s*trainingState,\s*\};/);
  });

  it('does not import the health store itself', () => {
    expect(coach).not.toMatch(/store\/healthStore/);
  });
});

describe('the Today brief', () => {
  it('is left as it was: it passes no training state', () => {
    expect(brief).not.toMatch(/trainingState/);
  });
});
