// Where the app sends its analytics events from. The Coach screen and the Spotify store are tested by running them
// (coachAnalytics.test.jsx, spotifyAnalytics.test.js); the workout screen is too big to render here and the root layout starts
// the whole app, so these read their sources, the way workoutFinishStreak and xpCallSites do.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
  const rel = path.join(dir, entry.name);
  if (entry.isDirectory()) return walk(rel);
  return /\.(js|jsx)$/.test(entry.name) ? [rel] : [];
});
const sources = ['app', 'components', 'constants', 'data', 'hooks', 'lib', 'services', 'src', 'store', 'utils']
  .flatMap((dir) => (fs.existsSync(path.join(root, dir)) ? walk(dir) : []));

describe('the workout screen', () => {
  const source = read('app/workout/active.jsx');
  const count = (re) => (source.match(re) || []).length;

  it('gets its events from the analytics service', () => {
    expect(source).toContain("import { logWorkoutStarted, logWorkoutCompleted, logFirstWorkoutCompleted } from '@/src/services/analytics';");
  });

  it('names a workout by its id, or by the program\'s id for a day of a program', () => {
    expect(source).toContain('const analyticsWorkoutId = selectedWorkout?.id ?? (isProgramSession ? programId : null);');
  });

  it('logs a start once each time the screen opens: from an effect, behind a ref', () => {
    expect(count(/logWorkoutStarted\(/g)).toBe(1);
    const block = source.slice(source.indexOf('const startLoggedRef'), source.indexOf('const startLoggedRef') + 400);
    expect(block).toMatch(/useRef\(false\);\s*useEffect\(\(\) => \{\s*if \(startLoggedRef\.current\) return;\s*startLoggedRef\.current = true;\s*logWorkoutStarted\(analyticsWorkoutId, workoutDisplayName\);\s*\}, \[analyticsWorkoutId, workoutDisplayName\]\);/);
  });

  it('logs a completion only when the workout is finished all the way, after it is saved', () => {
    expect(count(/logWorkoutCompleted\(/g)).toBe(1);
    const finish = source.slice(source.indexOf('onPress={isWorkoutDone ? async () => {'));
    const saved = finish.indexOf('await addCompletedWorkout(');
    const logged = finish.indexOf('logWorkoutCompleted(analyticsWorkoutId, Math.round(elapsedSeconds / 60), caloriesBurned);');
    expect(saved).toBeGreaterThan(-1);
    expect(logged).toBeGreaterThan(saved);
    expect(logged).toBeLessThan(finish.indexOf("router.replace('/workout/complete')"));
  });

  it('logs the first workout once, only when none has been finished before, and works that out before this one is saved', () => {
    expect(source).toContain("import { isFirstFinishedWorkout } from '@/lib/firstWorkout';");
    expect(count(/logFirstWorkoutCompleted\(/g)).toBe(1);
    expect(count(/isFirstFinishedWorkout\(/g)).toBe(1);
    const finish = source.slice(source.indexOf('onPress={isWorkoutDone ? async () => {'));
    const asked = finish.indexOf('const isFirstWorkout = isFirstFinishedWorkout(useWorkoutStore.getState().completedWorkouts);');
    const saved = finish.indexOf('await addCompletedWorkout(');
    const completed = finish.indexOf('logWorkoutCompleted(analyticsWorkoutId');
    const first = finish.indexOf('if (isFirstWorkout) logFirstWorkoutCompleted();');
    expect(asked).toBeGreaterThan(-1);
    expect(saved).toBeGreaterThan(asked);
    expect(first).toBeGreaterThan(completed);
    expect(first).toBeLessThan(finish.indexOf("router.replace('/workout/complete')"));
  });

  it('does not call saving a workout and leaving early the first workout either', () => {
    const exit = source.slice(source.indexOf('const handleSaveAndExit'), source.indexOf('const handleDiscardAndExit'));
    expect(exit).not.toContain('logFirstWorkoutCompleted');
  });

  it('does not call saving a workout and leaving early a completion', () => {
    const exit = source.slice(source.indexOf('const handleSaveAndExit'), source.indexOf('const handleDiscardAndExit'));
    expect(exit.length).toBeGreaterThan(500);
    expect(exit).not.toContain('logWorkoutCompleted');
  });
});

describe('the root layout', () => {
  const layout = read('app/_layout.jsx');

  it('gets the user call from the analytics service', () => {
    expect(layout).toContain("import { setAnalyticsUser, logScreenView, screenNameOf } from '@/src/services/analytics';");
  });

  it('logs a screen view each time the screen changes, named by the route and not by what is in it', () => {
    expect(layout).toContain("import { Stack, usePathname, useSegments } from 'expo-router';");
    expect(layout).toContain('const screenName = screenNameOf(useSegments());');
    expect(layout).toContain('useEffect(() => { logScreenView(screenName); }, [screenName]);');
    expect((layout.match(/logScreenView\(/g) || []).length).toBe(1);
  });

  it('gives analytics the same uid Crashlytics gets, so signing out (no uid) clears it', () => {
    expect(layout).toContain('const crashUid = useUserStore((s) => s.user?.uid);');
    expect(layout).toContain('useEffect(() => { setAnalyticsUser(crashUid); }, [crashUid]);');
  });
});

describe('across the app', () => {
  it('nothing uses the web analytics package, which cannot run on a phone', () => {
    const offenders = sources.filter((file) => /['"]firebase\/analytics['"]/.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it('only the analytics service looks for the native module, and only when it needs it', () => {
    const mentions = sources.filter((file) => read(file).includes('@react-native-firebase/analytics'));
    expect(mentions).toEqual([path.join('src', 'services', 'analytics.js')]);
    // A top-level import would load it when the app starts, which on a build made before the module was added is an error
    // at launch. The service requires it inside a function, in a try.
    expect(read('src/services/analytics.js')).not.toMatch(/^import .*@react-native-firebase\/analytics/m);
  });

  it('every analytics helper is used by something: an event nothing sends is the bug this replaced', () => {
    const service = read('src/services/analytics.js');
    const helpers = [
      'logWorkoutStarted', 'logWorkoutCompleted', 'logAICoachUsed', 'logSpotifyConnected', 'setAnalyticsUser',
      'logScreenView', 'logSignUp', 'logOnboardingCompleted', 'logFirstWorkoutCompleted', 'logPaywallViewed', 'logMealLogged',
      'logRunFinished',
    ];
    const users = sources.filter((file) => file !== path.join('src', 'services', 'analytics.js'));
    for (const name of helpers) {
      expect(service).toContain(`export const ${name}`);
      expect(users.some((file) => new RegExp(`\\b${name}\\(`).test(read(file)))).toBe(true);
    }
  });
});
