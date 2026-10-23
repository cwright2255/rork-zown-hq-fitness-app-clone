// Where the load rules (lib/loadRules.js) are hooked in. The workout screen is not rendered here, so the hookups are read from the source,
// the way muscleRecoveryWiring.test.js reads the recovery ones. The rules themselves are tested in loadRules.test.js and
// loadRulesSimulation.test.js; what the phone shows is checked on the phone (docs/DEVICE_CHECKS.md, "Load rules").
import fs from 'fs';
import path from 'path';
import { getNextPrescription, estimateOneRepMax, groupSetsBySession } from '../services/progressiveOverloadService';
import { prescribeNext } from '../lib/loadRules';

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const active = read('app/workout/active.jsx');
const service = read('services/progressiveOverloadService.js');
const rules = read('lib/loadRules.js');

describe('the overload service', () => {
  it('hands the work to the load rules, with the same answer', () => {
    const history = [
      { weight: 50, reps: 12, rpe: 'moderate', date: '2026-10-20' }, { weight: 50, reps: 12, rpe: 'moderate', date: '2026-10-20' },
    ];
    const options = { exerciseName: 'Tricep Pushdown', goal: 'muscle', level: 'intermediate', today: '2026-10-23' };
    expect(getNextPrescription(history, options)).toEqual(prescribeNext(history, options));
    expect(getNextPrescription(history, options).weight).toBe(55);
    expect(getNextPrescription([], options)).toBeNull();
    expect(getNextPrescription(null)).toBeNull();
  });

  it('keeps the one-rep-max estimate and the grouping of sets into sessions that other code uses', () => {
    expect(estimateOneRepMax(100, 10)).toBeCloseTo(133.333, 3);
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(0, 5)).toBeNull();
    expect(estimateOneRepMax(100, 0)).toBeNull();
    const sessions = groupSetsBySession([
      { weight: 1, reps: 1, date: '2026-10-21' }, { weight: 1, reps: 1, date: '2026-10-20' }, { weight: 2, reps: 1, date: '2026-10-21' }, { weight: 3, reps: 1 },
    ]);
    expect(sessions.map((s) => [s.day, s.sets.length])).toEqual([['2026-10-20', 1], ['2026-10-21', 2]]);
    expect(service).toMatch(/import \{ prescribeNext \} from '\.\.\/lib\/loadRules';/);
    expect(service).toMatch(/return prescribeNext\(loggedSets, options\);/);
  });

  it('is imported by the same callers as before', () => {
    expect(read('services/coachService.js')).toMatch(/from '@\/services\/progressiveOverloadService'|from '\.\/progressiveOverloadService'/);
    expect(read('lib/crossDomainInsights.js')).toMatch(/progressiveOverloadService/);
    expect(read('services/strengthStandardsService.js')).toMatch(/progressiveOverloadService/);
  });
});

describe('the rules module', () => {
  it('reads no store, no Firestore and no screen', () => {
    const imports = [...rules.matchAll(/^import .* from '(.*)';$/gm)].map((m) => m[1]);
    expect(imports.sort()).toEqual(['./exerciseLibrary', './localDate', './readiness']);
    expect(rules).not.toMatch(/require\(|firebase|AsyncStorage|react/);
  });
});

describe('the workout screen', () => {
  it('asks for the prescription with the exercise, the goal, the level, the unit and the low-readiness days', () => {
    const call = active.slice(active.indexOf('getNextPrescription(historyIn(history, weightUnit), {'), active.indexOf('setPrescriptions((prev)'));
    expect(call).toMatch(/readiness,/);
    expect(call).toMatch(/exerciseName: currentExercise\.name,/);
    expect(call).toMatch(/bodyweight: isBodyweightExercise\(currentExercise\.name\),/);
    expect(call).toMatch(/goal: goalForLoad\(getGoalIds\(user\)\),/);
    expect(call).toMatch(/level: user\?\.fitnessLevel,/);
    expect(call).toMatch(/unit: weightUnit,/);
    expect(call).toMatch(/lowReadinessDays: countLowReadinessDays\(dailyReadings\(\)\),/);
  });

  it('imports what it uses from the rules and the profile', () => {
    expect(active).toMatch(/import \{ goalForLoad, countLowReadinessDays, trustedSets, isOutlierOneRepMax, effortLegend, prescriptionText \} from '@\/lib\/loadRules';/);
    expect(active).toMatch(/import \{ getGoalIds \} from '@\/lib\/userProfileData';/);
    expect(active).toMatch(/import \{ localDateKey, shiftDateKey \} from '@\/lib\/localDate';/);
  });

  it('takes the Health store only when a prescription needs it, so the screen opens without it', () => {
    expect(active).not.toMatch(/^import .*healthStore/m);
    const helper = active.slice(active.indexOf('const dailyReadings = () => {'), active.indexOf('};', active.indexOf('const dailyReadings = () => {')) + 2);
    expect(helper).toMatch(/require\('@\/store\/healthStore'\)\.useHealthStore\.getState\(\)\.readingsHistory/);
    expect(helper).toMatch(/catch \{\s*return undefined;/);
  });

  it('works out the personal best from the sets left after the outlier guard, counting everything up to today', () => {
    expect(active).toMatch(/trustedSets\(history, shiftDateKey\(localDateKey\(\), 1\)\)\.forEach\(\(s\) => \{/);
    // ... and no longer from the raw history
    const effect = active.slice(active.indexOf('let bestOneRepMax = null;'), active.indexOf('setPriorBests((prev) => ({ ...prev, [currentExercise.id]: { bestOneRepMax'));
    expect(effect).not.toMatch(/history\.forEach/);
  });

  it('does not celebrate a set more than 1.5 times the best so far, and leaves the best where it was', () => {
    const block = active.slice(active.indexOf('const oneRm = estimateOneRepMax(weight, reps);'), active.indexOf('setPrCelebration({\n              exerciseName: exercise.name,\n              type: \'oneRepMax\''));
    expect(block).toMatch(/if \(oneRm && prior\.bestOneRepMax != null && oneRm > prior\.bestOneRepMax && !isOutlierOneRepMax\(oneRm, prior\.bestOneRepMax\)\) \{/);
    // the set is logged before the check, so it is not lost
    expect(active.indexOf('await logSet(exercise.name, weight, reps, rpe, workoutId, user?.uid);')).toBeLessThan(active.indexOf('isOutlierOneRepMax(oneRm'));
  });

  it('shows the target, the detail and the reason from the rules, and the line about the three buttons', () => {
    const card = active.slice(active.indexOf('{prescriptions[currentExercise.id] && (() => {'), active.indexOf('{(() => {\n              const isBodyweight'));
    expect(card).toMatch(/prescriptionText\(prescriptions\[currentExercise\.id\], \{ bodyweight: isBodyweightExercise\(currentExercise\.name\), unit: weightUnit \}\)/);
    expect(card).toMatch(/\{text\.target\}/);
    expect(card).toMatch(/\{!!text\.detail && <Text style=\{styles\.prescriptionDetail\}>\{text\.detail\}<\/Text>\}/);
    expect(card).toMatch(/\{text\.reason\}/);
    expect(card).toMatch(/<Text style=\{styles\.effortLegend\}>\{effortLegend\(\)\}<\/Text>/);
  });

  it('keeps the three buttons, and what they save', () => {
    expect(active).toMatch(/handleLogSet\(currentExercise, setIndex, 'easy'\)/);
    expect(active).toMatch(/handleLogSet\(currentExercise, setIndex, 'moderate'\)/);
    expect(active).toMatch(/handleLogSet\(currentExercise, setIndex, 'hard'\)/);
    expect(active).toMatch(/<Text style=\{styles\.rpeBtnText\}>Easy<\/Text>/);
    expect(active).toMatch(/<Text style=\{styles\.rpeBtnText\}>OK<\/Text>/);
    expect(active).toMatch(/<Text style=\{styles\.rpeBtnText\}>Hard<\/Text>/);
  });

  it('asks for the weight in the unit chosen in Settings (weightUnitWiring.test.js has the rest)', () => {
    expect(active).toMatch(/placeholder=\{weightUnit\}/);
    expect(active).not.toMatch(/placeholder="lb"/);
  });
});
