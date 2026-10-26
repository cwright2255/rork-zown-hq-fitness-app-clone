// Where the session picker (lib/sessionPicker.js) is hooked in. The screens are not rendered here, so the hookups are read from the source, the
// way loadRulesWiring.test.js reads the load-rule ones. The picker is tested in sessionPicker.test.js and sessionPickerSimulation.test.js, the
// service in sessionService.test.js; what the phone shows is checked on the phone (docs/DEVICE_CHECKS.md, "Today's Session").
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const importsOf = (src) => [...src.matchAll(/^import [^;]*? from '([^']+)';$/gm)].map((m) => m[1]).sort();
const picker = read('lib/sessionPicker.js');
const injuries = read('lib/injuryRules.js');
const service = read('services/sessionService.js');
const screen = read('app/workout/session.jsx');
const workouts = read('app/workouts.jsx');
const active = read('app/workout/active.jsx');

// The names an options object passes: `name:` and shorthand `name,` lines between two markers.
const optionNames = (src, from, to) => {
  const block = src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));
  return [...block.matchAll(/^\s+(\w+)(?::|,)/gm)].map((m) => m[1]).sort();
};

describe('the picker and the injury list', () => {
  it('read no store, no Firestore and no screen: only the lib modules they are built from', () => {
    expect(importsOf(picker)).toEqual([
      './coachActions', './exerciseLibrary', './homeWidgetData', './injuryRules', './loadRules', './muscleRecovery', './trainingFeedback',
    ]);
    expect(importsOf(injuries)).toEqual([]);
    [picker, injuries].forEach((src) => expect(src).not.toMatch(/require\(|firebase|AsyncStorage|react|fetch\(/));
  });

  it('say, at the top, that they are a model and not clinically validated', () => {
    const words = (src) => src.slice(0, 2400).replace(/\n\/\/ ?/g, ' ');
    expect(words(picker)).toMatch(/not a measurement/);
    expect(words(picker)).toMatch(/deterministic/);
    expect(words(injuries)).toMatch(/not medical advice/i);
    expect(words(injuries)).toMatch(/professional should read it/);
  });
});

describe('the session service', () => {
  it('reads the same stores the Health screen reads, and the Health store only when it needs it', () => {
    const imports = importsOf(service);
    ['@/store/workoutStore', '@/store/runningStore', '@/store/hikingStore'].forEach((s) => expect(imports).toContain(s));
    expect(service).not.toMatch(/^import .*healthStore/m);
    expect(service).toMatch(/require\('@\/store\/healthStore'\)\.useHealthStore\.getState\(\)/);
    expect(service).toMatch(/recoveryInputs\(health\.rookRecovery, health\.sleep\)/);
  });

  it('asks the load rules the way the workout screen does: the same options, with the same values', () => {
    const fromScreen = optionNames(active, 'getNextPrescription(historyIn(history, weightUnit), {', 'setPrescriptions((prev)');
    const fromService = optionNames(service, 'getNextPrescription(historyIn(history, unit), {', 'return out;');
    expect(fromService).toEqual(fromScreen);
    expect(fromService).toEqual(['bodyweight', 'exerciseName', 'goal', 'level', 'lowReadinessDays', 'readiness', 'unit']);
    const start = service.indexOf('getNextPrescription(historyIn(history, unit), {');
    const call = service.slice(start, service.indexOf('return out;', start));
    expect(call).toMatch(/exerciseName: x\.name,/);
    expect(call).toMatch(/bodyweight: isBodyweightExercise\(x\.name\),/);
    expect(call).toMatch(/goal: goalForLoad\(getGoalIds\(user\)\),/);
    expect(call).toMatch(/level: user \? user\.fitnessLevel : undefined,/);
    expect(call).toMatch(/unit,/);
    expect(call).toMatch(/lowReadinessDays,/);
    expect(service).toMatch(/const lowReadinessDays = countLowReadinessDays\(healthStore\(\)\.readingsHistory\);/);
    expect(service).toMatch(/getCurrentReadiness\(\)/);
  });

  it('never throws and never waits for ever', () => {
    expect(service).toMatch(/catch \{\s*return null;/);
    expect(service).toMatch(/const settle = \(work\) => Promise\.resolve\(\)\.then\(work\)\.catch\(\(\) => undefined\);/);
    expect(service).toMatch(/within\(refreshes, patience\)/);
    expect(service).toMatch(/within\(getCurrentReadiness\(\), patience\)/);
    expect(service).toMatch(/within\(cache\.get\(x\.name\), patience\)/);
  });

  it('calls no AI and no network of its own', () => {
    expect(service).not.toMatch(/aiService|openai|anthropic|fetch\(|httpsCallable/i);
    expect(screen).not.toMatch(/aiService|openai|anthropic|fetch\(|httpsCallable/i);
  });
});

describe('the Today\'s Session screen', () => {
  it('builds the session through the service, with the time and the equipment chosen on the screen', () => {
    expect(screen).toMatch(/import \{\s*refreshSessionSources, buildTodaySession, getSwapOptions, swapInExercise,\s*\} from '@\/services\/sessionService';/);
    expect(screen).toMatch(/buildTodaySession\(\{ uid, user: useUserStore\.getState\(\)\.user, minutes, equipment, cache: histories\.current \}\)/);
    expect(screen).toMatch(/\}, \[uid, minutes, equipment\]\);/);
    expect(screen).toMatch(/useEffect\(\(\) => \{ build\(\); \}, \[build\]\);/);
  });

  it('starts at the length on the profile, offers the times and the equipment from the picker, and defaults to the gym', () => {
    expect(screen).toMatch(/useState\(\(\) => minutesFromPreference\(useUserStore\.getState\(\)\.user\?\.preferences\?\.preferredDuration\)\)/);
    expect(screen).toMatch(/SESSION_RULES\.minutesOptions\.map\(/);
    expect(screen).toMatch(/const EQUIPMENT_CHOICES = \['gym', 'dumbbells', 'bodyweight'\];/);
    expect(screen).toMatch(/EQUIPMENT_LABELS\[id\]/);
    expect(screen).toMatch(/useState\('gym'\)/);
  });

  it('refreshes the stores once, ignores an answer that is no longer the latest, and clears the session when a rebuild fails', () => {
    expect(screen).toMatch(/if \(!refreshed\.current\) refreshed\.current = refreshSessionSources\(uid\);/);
    expect(screen).toMatch(/if \(latest\.current !== mine\) return;/);
    expect(screen).toMatch(/else \{ setSession\(null\); setError\(/);
    expect(screen).toMatch(/if \(latest\.current === mine\) \{ setSession\(null\); setError\(/);
  });

  it('shows why each exercise was picked, the injuries that took something out, and the disclaimer', () => {
    expect(screen).toMatch(/<Text style=\{styles\.cardReason\}>\{x\.reason\}<\/Text>/);
    expect(screen).toMatch(/Left out because of the injuries you reported:/);
    expect(screen).toMatch(/INJURY_LABELS\[id\]/);
    expect(screen).toMatch(/<Text style=\{styles\.disclaimer\}>\{SESSION_DISCLAIMER\}<\/Text>/);
    expect(screen).toMatch(/Start at \{x\.target\}/);
    expect(screen).toMatch(/\{session\.message\}/);
  });

  it('saves the session the way Quick Workout does and opens it on the workout screen, where the usual Start button and target card work', () => {
    expect(screen).toMatch(/const workout = sessionToWorkout\(shown\);/);
    expect(screen).toMatch(/useWorkoutStore\.getState\(\)\.addWorkout\(workout, uid\)/);
    expect(screen).toMatch(/router\.replace\(`\/workout\/\$\{saved\.id\}`\)/);
    expect(screen).toMatch(/if \(!workout \|\| !uid \|\| saving\) return;/);
    const quick = read('app/workout/quick.jsx');
    expect(quick).toMatch(/addWorkout\(/);
    expect(quick).toMatch(/router\.replace\(`\/workout\/\$\{[a-zA-Z.]*id\}`\)|router\.replace\(`\/workout\/\$\{saved\.id\}`\)/);
  });

  it('has a route that needs no entry in the root layout, like Quick Workout, and hides the bottom bar like every workout screen', () => {
    expect(fs.existsSync(path.join(root, 'app/workout/session.jsx'))).toBe(true);
    const layout = read('app/_layout.jsx');
    expect(layout).not.toMatch(/workout\/quick/);
    expect(layout).toMatch(/!\/\^\\\/workout\\\/\.\+\$\/\.test\(pathname\)/);
  });
});

describe('the Workouts screen', () => {
  it('has a Today\'s Session button under Quick Workout that opens the screen', () => {
    expect(workouts).toMatch(/onPress=\{\(\) => router\.push\('\/workout\/session'\)\}/);
    expect(workouts).toMatch(/<Text style=\{\[styles\.createBtnText, styles\.sessionBtnText\]\}>Today's Session<\/Text>/);
    expect(workouts.indexOf("router.push('/workout/session')")).toBeGreaterThan(workouts.lastIndexOf('Quick Workout</Text>'));
    expect(workouts).toMatch(/Quick Workout<\/Text>/); // the button it sits under is still there
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The feedback loop: More, Less, Swap and Exclude on Today's Session, and what the workout screen counts. The behaviour is tested where it lives
// (trainingFeedback.test.js, trainingMeasures.test.js, trainingFeedbackStore.test.js, sessionPickerFeedback.test.js, TodaySessionScreen.test.jsx);
// the workout screen is too big to render here, so its hookups are read from the source.
describe('the feedback loop on the workout screen', () => {
  const feedbackStoreSrc = read('store/trainingFeedbackStore.js');
  const measures = read('lib/trainingMeasures.js');
  const feedbackRules = read('lib/trainingFeedback.js');
  const count = (src, re) => (src.match(re) || []).length;

  it('brings the cloud copy in when the person is known, and counts through the one store', () => {
    expect(active).toContain("import { useTrainingFeedbackStore } from '@/store/trainingFeedbackStore';");
    expect(active).toContain("import { setHitTarget, sessionOutcome } from '@/lib/trainingMeasures';");
    expect(active).toMatch(/useEffect\(\(\) => \{\s*if \(user\?\.uid\) useTrainingFeedbackStore\.getState\(\)\.startSync\(user\.uid\);\s*\}, \[user\?\.uid\]\);/);
  });

  it('counts a set that had a target after it is logged, with the weight as typed (in the unit on screen) and never changes what is saved', () => {
    const at = active.indexOf('const handleLogSet = async');
    const body = active.slice(at, active.indexOf('const centerIcon', at));
    expect(body).toMatch(/await logSet\(exercise\.name, weight, reps, rpe, workoutId, user\?\.uid\);/);
    expect(body.indexOf('await logSet(')).toBeLessThan(body.indexOf('useTrainingFeedbackStore.getState().recordSet(hit)'));
    expect(body).toMatch(/const typedWeight = parseFloat\(weightSource\);/);
    expect(body).toMatch(/const hit = setHitTarget\(\{ weight: typedWeight, reps, prescription, bodyweight: isBodyweight \}\);/);
    expect(body).toMatch(/if \(hit !== null\) useTrainingFeedbackStore\.getState\(\)\.recordSet\(hit\);/);
    // it sits inside the try, so a set that could not be saved is not counted
    expect(body.indexOf('try {')).toBeLessThan(body.indexOf('recordSet(hit)'));
    expect(body.indexOf('recordSet(hit)')).toBeLessThan(body.indexOf('} finally {'));
  });

  it('reports the end of a workout once, after it is saved, for the save-and-exit and for the finish', () => {
    expect(count(active, /reportEnd\(true\);/g)).toBe(1);
    expect(count(active, /reportEnd\(false\);/g)).toBe(1);
    const partial = active.slice(active.indexOf('const handleSaveAndExit'), active.indexOf('const handleDiscardAndExit'));
    expect(partial.indexOf('await addCompletedWorkout(')).toBeLessThan(partial.indexOf('reportEnd(true);'));
    expect(partial.indexOf('reportEnd(true);')).toBeLessThan(partial.indexOf('addExpActivity'));
    expect(partial.indexOf('if (completedCount > 0) {')).toBeLessThan(partial.indexOf('reportEnd(true);'));
    const finish = active.slice(active.indexOf('isWorkoutDone ? async () => {'));
    expect(finish.indexOf('await addCompletedWorkout(')).toBeLessThan(finish.indexOf('reportEnd(false);'));
    expect(finish.indexOf('reportEnd(false);')).toBeLessThan(finish.indexOf('logWorkoutCompleted('));
  });

  it('reports only a workout the engine built, and not an exercise that was done before the workout was continued', () => {
    const at = active.indexOf('const reportEnd = (partial) => {');
    const body = active.slice(at, active.indexOf('/* ', at));
    expect(body).toMatch(/sessionOutcome\(selectedWorkout\?\.source, done, partial\)/);
    expect(body).toMatch(/exercisesToSave\(\)\.filter\(\(_, i\) => !restoredIndices\.current\.includes\(i\)\)/);
    expect(body).toMatch(/if \(outcome\) useTrainingFeedbackStore\.getState\(\)\.recordEnd\(outcome\);/);
    expect(body).toMatch(/catch \(e\) \{\s*console\.warn\(/); // counting never holds up saving
    expect(active).toMatch(/const restoredIndices = useRef\(savedIndices\);/);
    expect(measures).toMatch(/if \(source !== 'engine_session'\) return null;/);
    expect(picker).toMatch(/source: 'engine_session',/);
  });

  it('counts at Start Workout on Today\'s Session, after the workout is saved and before the workout screen opens', () => {
    const at = screen.indexOf('const handleStart');
    const body = screen.slice(at, screen.indexOf('const currentUser', at));
    expect(body.indexOf('await useWorkoutStore.getState().addWorkout(workout, uid)')).toBeLessThan(body.indexOf('.recordStart({'));
    expect(body.indexOf('.recordStart({')).toBeLessThan(body.indexOf('router.replace('));
    expect(body).toMatch(/exercises: shown\.exercises\.length, swapped: edits\.current\.swapped, excluded: edits\.current\.excluded/);
    expect(screen).toMatch(/useEffect\(\(\) => \{\s*if \(uid\) useTrainingFeedbackStore\.getState\(\)\.startSync\(uid\);\s*\}, \[uid\]\);/);
  });

  it('keeps the swaps and exclusions to Today\'s Session: the workout screen has no swap, no exclude and no change of plan', () => {
    expect(active).not.toMatch(/swapInExercise|getSwapOptions|\.exclude\(|\.noteSwap\(|\.vote\(/);
    expect(screen).toMatch(/\.noteSwap\(feedbackKey\(x\)\)/);
    expect(screen).toMatch(/\.exclude\(feedbackKey\(x\), \{ name: x\.name, ladder: !!\(lib && lib\.ladder\) \}\)/);
    expect(screen).toMatch(/\.vote\(feedbackKey\(x\), tapped\)/);
    expect(screen).toMatch(/\.restore\(e\.key\)/);
  });

  it('keeps the cloud copy in one document under the person, in a place the Firestore rules already let them write', () => {
    expect(feedbackStoreSrc).toMatch(/doc\(db, 'users', uid, 'data', 'trainingFeedback'\)/);
    expect(count(feedbackStoreSrc, /'trainingFeedback'/g)).toBe(2); // read and write
    expect(feedbackStoreSrc).toMatch(/name: 'zown-training-feedback-storage'/); // cleared on sign-out with every other zown- key
    const rules = read('firestore.rules');
    const rule = rules.slice(rules.indexOf('match /data/{docId}'));
    expect(rule).toMatch(/allow write: if request\.auth != null && request\.auth\.uid == userId &&\s*!\(docId in \['achievements', 'badges', 'battlePass'\]\);/);
    expect(rule).not.toMatch(/trainingFeedback/);
  });

  it('keeps the logic out of the store and the screens: pure modules that read no store and no Firestore', () => {
    expect(importsOf(feedbackRules)).toEqual(['./exerciseLibrary']);
    expect(importsOf(measures)).toEqual(['./exerciseLibrary', './loadRules', './trainingFeedback']);
    [feedbackRules, measures].forEach((src) => expect(src).not.toMatch(/require\(|firebase|AsyncStorage|react|fetch\(/));
  });

  it('does not send the feedback to the AI: nothing the person tapped leaves the phone for the plan or the wording', () => {
    const wording = read('services/sessionWordingService.js');
    const generator = read('lib/sessionWording.js');
    [wording, generator, read('services/aiService.js')].forEach((src) => {
      expect(src).not.toMatch(/trainingFeedback|trainingMeasures|FEEDBACK_RULES|weightsFor|excludedKeys/);
    });
  });

  it('says in the rules module that the numbers are starting values and not measurements', () => {
    const words = feedbackRules.slice(0, 1800).replace(/\n\/\/ ?/g, ' ');
    expect(words).toMatch(/starting values from judgement, not measurements/);
    expect(words).toMatch(/nobody has checked that they are the right size/);
  });
});
