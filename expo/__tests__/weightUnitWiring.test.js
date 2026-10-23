// Where the weight unit (lib/weightUnits.js, Settings > Weight Units) is hooked in. The screens are not rendered here, so the hookups are read
// from the source, the way sessionWiring.test.js and loadRulesWiring.test.js read theirs. The conversions are tested in weightUnits.test.js; what
// the phone shows is checked on the phone (docs/DEVICE_CHECKS.md).
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const importsOf = (src) => [...src.matchAll(/^import [^;]*? from '([^']+)';$/gm)].map((m) => m[1]).sort();
const units = read('lib/weightUnits.js');
const active = read('app/workout/active.jsx');
const sessionService = read('services/sessionService.js');
const stateService = read('services/trainingStateService.js');
const coachScreen = read('app/coach.jsx');
const coachService = read('services/coachService.js');
const brief = read('services/briefService.js');

describe('the unit module', () => {
  it('reads no store, no Firestore and no screen: only the body-weight factor', () => {
    expect(importsOf(units)).toEqual(['./macroWeightData']);
    expect(units).not.toMatch(/require\(|firebase|AsyncStorage|react|fetch\(/);
  });

  it('says, at the top, that what is saved stays in pounds', () => {
    expect(units.slice(0, 900).replace(/\n\/\/ ?/g, ' ')).toMatch(/POUNDS/);
    expect(units.slice(0, 900).replace(/\n\/\/ ?/g, ' ')).toMatch(/never changes unit/);
  });
});

describe('the workout screen', () => {
  it('follows the setting, and only the setting, for the unit', () => {
    expect(active).toContain("const weightUnit = useSettingsStore((s) => unitFromSetting(s.weightUnits));");
  });

  it('turns what is typed into pounds before it is saved, and nothing else is saved in kilograms', () => {
    expect(active).toContain('const weight = isBodyweight ? 0 : toPounds(parseFloat(weightSource), weightUnit);');
    expect(active).not.toMatch(/weight: parseFloat\(/);
  });

  it('works the target out from the history in the person\'s unit, and rounds a kilogram target to what can be loaded', () => {
    expect(active).toContain('targetIn(getNextPrescription(historyIn(history, weightUnit), {');
    expect(active).toContain('unit: weightUnit,');
  });

  it('shows the target, the logged sets and the record in the person\'s unit', () => {
    expect(active).toContain('unit: weightUnit })');
    expect(active).toContain('placeholder={weightUnit}');
    expect(active).toContain('weightText(logged.weight, weightUnit)');
    expect(active).toContain('weightText(prCelebration?.weight, weightUnit)');
    expect(active).toContain('fromPounds(');
  });
});

describe('the services', () => {
  it('Today\'s Session works its targets out in the setting\'s unit, read when it is built', () => {
    expect(sessionService).toContain("unitFromSetting(require('@/store/settingsStore').useSettingsStore.getState().weightUnits)");
    expect(sessionService).toContain('getNextPrescription(historyIn(history, unit), {');
    expect(sessionService).toContain('attachTargets(session, prescriptions, { unit })');
  });

  it('the training state follows the setting too, when no unit is given', () => {
    expect(stateService).toContain("unitFromSetting(require('@/store/settingsStore').useSettingsStore.getState().weightUnits)");
    expect(stateService).toContain('weightUnit = currentUnit()');
    expect(stateService).toMatch(/buildTrainingState\(\{[^}]*weightUnit \}\)/);
  });

  it('the Coach and the Today brief write the lifts in the setting\'s unit', () => {
    expect(coachService).toContain("import { fromPounds, weightNumber } from '../lib/weightUnits';");
    expect(coachScreen).toContain('weightUnit: unitFromSetting(useSettingsStore.getState().weightUnits)');
    expect(brief).toContain("weightUnit: pounds ? 'lb' : 'kg',");
  });
});
