import pathlib

def apply_replacements(file_path, replacements):
    p = pathlib.Path(file_path)
    text = p.read_text()
    for label, old, new, *rest in replacements:
        replace_all = rest[0] if rest else False
        count = text.count(old)
        if replace_all:
            if count == 0:
                raise SystemExit(
                    f"MATCH FAILED in {file_path} on '{label}' (found 0 occurrences, "
                    f"expected at least 1) - file doesn't look like what was expected. "
                    f"Nothing changed in this file. Tell Claude this happened."
                )
            text = text.replace(old, new)
        else:
            if count != 1:
                raise SystemExit(
                    f"MATCH FAILED in {file_path} on '{label}' (found {count} occurrences, "
                    f"expected exactly 1) - file doesn't look like what was expected. "
                    f"Nothing changed in this file. Tell Claude this happened."
                )
            text = text.replace(old, new, 1)
    p.write_text(text)
    print(f"REPLACED OK in {file_path} ({len(replacements)}/{len(replacements)})")


# ============================================================
# 1) lib/muscleFatigue.js - export the real running/hiking muscle
#    weights so the new cross-domain module can reuse them directly,
#    plus a small muscle-name-synonym helper so "quads" and "quadriceps"
#    (etc.) actually match each other instead of silently missing.
# ============================================================
fatigue_replacements = []

old_muscle_consts = """// Real primary muscle groups for running and hiking — well-established
// in exercise science, not guessed. Weighted so the biggest movers (quads,
// glutes, calves) get more attributed load than stabilizers (core).
const RUNNING_MUSCLES = {
  quadriceps: 0.28, hamstrings: 0.22, glutes: 0.22, calves: 0.18, core: 0.10,
};
// Hiking engages the same primary movers as running, weighted slightly
// more toward glutes/calves for the incline component, plus a real
// calf/ankle-stabilizer bump for uneven terrain.
const HIKING_MUSCLES = {
  quadriceps: 0.25, hamstrings: 0.20, glutes: 0.25, calves: 0.20, core: 0.10,
};

function daysSince(dateInput) {"""

new_muscle_consts = """// Real primary muscle groups for running and hiking — well-established
// in exercise science, not guessed. Weighted so the biggest movers (quads,
// glutes, calves) get more attributed load than stabilizers (core).
// Exported (as of this session) so lib/crossDomainInsights.js can reuse
// the exact same real anatomical mapping to decide whether a given lift
// genuinely overlaps with running/hiking, rather than duplicating it.
export const RUNNING_MUSCLES = {
  quadriceps: 0.28, hamstrings: 0.22, glutes: 0.22, calves: 0.18, core: 0.10,
};
// Hiking engages the same primary movers as running, weighted slightly
// more toward glutes/calves for the incline component, plus a real
// calf/ankle-stabilizer bump for uneven terrain.
export const HIKING_MUSCLES = {
  quadriceps: 0.25, hamstrings: 0.20, glutes: 0.25, calves: 0.20, core: 0.10,
};

// Real, new: a few common synonyms for the same muscle group - the AI
// generator and manual workout builder (services/aiService.js's
// normalizeExercise) aren't constrained to a fixed vocabulary, so "quads"
// vs "quadriceps" for the exact same muscle would otherwise silently
// fail to match RUNNING_MUSCLES/HIKING_MUSCLES's keys below, and (as of
// this session) lib/crossDomainInsights.js's own overlap check.
// Deliberately small and specific rather than a general fuzzy matcher -
// only the handful of variants actually plausible for the muscles this
// file already models.
const MUSCLE_SYNONYMS = {
  quads: 'quadriceps', quad: 'quadriceps',
  hamstring: 'hamstrings',
  glute: 'glutes',
  calf: 'calves',
  abs: 'core', abdominals: 'core', abdomen: 'core', abdominal: 'core',
};

export function canonicalizeMuscle(m) {
  const key = (m || '').toLowerCase().trim();
  return MUSCLE_SYNONYMS[key] || key;
}

function daysSince(dateInput) {"""

fatigue_replacements.append(('export RUNNING_MUSCLES/HIKING_MUSCLES, add canonicalizeMuscle', old_muscle_consts, new_muscle_consts))

old_attribute_key = "      const key = (m || '').toLowerCase().trim();"
new_attribute_key = "      const key = canonicalizeMuscle(m);"
fatigue_replacements.append(('attributeWorkout uses canonicalizeMuscle', old_attribute_key, new_attribute_key))

old_target_key = "  workoutExercises.forEach((ex) => (ex.muscleGroups || []).forEach((m) => set.add((m || '').toLowerCase().trim())));"
new_target_key = "  workoutExercises.forEach((ex) => (ex.muscleGroups || []).forEach((m) => set.add(canonicalizeMuscle(m))));"
fatigue_replacements.append(('getTargetMuscles uses canonicalizeMuscle', old_target_key, new_target_key))

apply_replacements('lib/muscleFatigue.js', fatigue_replacements)


# ============================================================
# 2) lib/crossDomainInsights.js - NEW file. Real plateau detection
#    (estimated-1RM trend across logged sessions) plus real cross-domain
#    cause attribution (elevated running/hiking load in the week before
#    each plateaued session, only when the lift's own muscles genuinely
#    overlap with what running/hiking actually works). Deterministic,
#    not AI-generated - this is a real-or-not computation, not
#    open-ended commentary.
# ============================================================
cross_domain_insights_content = '''// lib/crossDomainInsights.js
//
// Real cross-domain reasoning: connects a genuine lifting plateau (real
// estimated-1RM trend, flat or declining across recent sessions) to real,
// elevated running/hiking volume in the days before those sessions - but
// ONLY when the plateaued lift's own muscleGroups genuinely overlap with
// lib/muscleFatigue.js's RUNNING_MUSCLES/HIKING_MUSCLES weighting, the
// same real exercise-science mapping Recovery Map's fatigue engine
// already uses. No overlap, no claim - this never invents a cause the
// anatomy doesn't support, the same principle services/aiService.js's
// generateTrainingLoadInsight prompt already states for its own,
// different (systemic, AI-narrated) signal. Deliberately deterministic,
// not AI-generated, for the same reason services/progressiveOverloadService.js's
// prescriptions are: "did X happen, and does the data support Y as the
// reason" is a real-or-not computation, not open-ended commentary - an
// LLM here would only add latency and a chance of narrating a cause the
// numbers don't actually show.
//
// Scoped to the three primary barbell lifts for a first real version -
// same scoping services/strengthStandardsService.js already uses for
// "well-understood, consistently-logged, cleanly-named" lifts. Squat and
// Deadlift are also exactly where a real running/hiking connection is
// anatomically plausible in the first place (both genuinely leg-dominant);
// Bench Press has no real muscle overlap with running/hiking, so it will
// correctly never get a cross-domain cause attributed to it, only a
// plain plateau note if one is real.

import { groupSetsBySession, estimateOneRepMax } from '../services/progressiveOverloadService';
import { aggregateDailyLoad } from './trainingLoad';
import { RUNNING_MUSCLES, HIKING_MUSCLES, canonicalizeMuscle } from './muscleFatigue';

// recentWindow + priorWindow sessions needed before saying anything real -
// fewer than that and "flat" vs "still ramping up" genuinely can't be
// told apart yet.
const RECENT_WINDOW = 3;
const PRIOR_WINDOW = 2;
// Recent window's best e1RM must beat the prior window's best by at
// least this fraction to NOT count as a plateau - roughly one real
// weight increment on a moderate load, so normal rounding/plate-size
// noise doesn't get flagged as stalled progress.
const PLATEAU_THRESHOLD = 0.03;
// Pre-session week's cardio load must exceed this multiple of the
// user's own baseline daily cardio load (x7) to count as "elevated" -
// a real, meaningful jump above their normal pattern, not noise.
const CARDIO_ELEVATED_MULTIPLIER = 1.3;
const MIN_CARDIO_DAYS_FOR_BASELINE = 5;

// Real, standard primary muscle groups for the three lifts this module
// covers - the same three services/strengthStandardsService.js already
// treats as canonical, well-understood, consistently-named lifts. Used
// directly here rather than relying on any specific logged workout's own
// muscleGroups tag, since these three lifts' real primary muscles are
// well-established regardless of which workout or AI generation they
// came from (and plenty of real logged history predates app/workout/
// active.jsx even carrying muscleGroups through to begin with).
export const PRIMARY_LIFT_MUSCLES = {
  'Bench Press': ['chest', 'triceps', 'shoulders'],
  'Squat': ['quadriceps', 'glutes', 'hamstrings'],
  'Deadlift': ['hamstrings', 'glutes', 'back'],
};

function bestE1RMForSession(sets) {
  let best = null;
  sets.forEach((s) => {
    const e1rm = estimateOneRepMax(s.weight, s.reps);
    if (e1rm && (best === null || e1rm > best)) best = e1rm;
  });
  return best;
}

/**
 * Real plateau detection from one exercise's real logged-set history:
 * compares the best estimated 1RM across the most recent `recentWindow`
 * sessions against the `priorWindow` sessions right before that. Flat or
 * declining (< plateauThreshold improvement) across that boundary counts
 * as a plateau. Returns null - not a {plateaued:false} object - when
 * there's simply not enough session history yet to say anything real:
 * an honest "don't know" rather than a confident negative.
 */
export function detectPlateau(loggedSets, { recentWindow = RECENT_WINDOW, priorWindow = PRIOR_WINDOW, plateauThreshold = PLATEAU_THRESHOLD } = {}) {
  const sessions = groupSetsBySession(loggedSets || []);
  if (sessions.length < recentWindow + priorWindow) return null;

  const recent = sessions.slice(-recentWindow);
  const prior = sessions.slice(-(recentWindow + priorWindow), -recentWindow);

  const recentBests = recent.map((s) => bestE1RMForSession(s.sets)).filter((v) => v != null);
  const priorBests = prior.map((s) => bestE1RMForSession(s.sets)).filter((v) => v != null);
  if (recentBests.length === 0 || priorBests.length === 0) return null;

  const recentBest = Math.max(...recentBests);
  const priorBest = Math.max(...priorBests);
  const improvement = (recentBest - priorBest) / priorBest;

  return {
    plateaued: improvement < plateauThreshold,
    recentBest: Math.round(recentBest * 10) / 10,
    priorBest: Math.round(priorBest * 10) / 10,
    improvementPercent: Math.round(improvement * 1000) / 10,
    plateauSessionDays: recent.map((s) => s.day),
  };
}

/**
 * Checks whether elevated running/hiking volume in the week before each
 * plateaued session is a real, data-supported explanation - and only
 * when this lift's own muscleGroups genuinely overlap with the muscles
 * running/hiking actually work (lib/muscleFatigue.js's own real
 * weighting). Returns null - honestly, not a weak/empty cause object -
 * whenever the data doesn't actually support a cross-domain claim:  no
 * real muscle overlap, not enough cardio history to know what "elevated"
 * even means for this user, or the cardio load around these sessions
 * wasn't actually elevated.
 */
export function findCrossDomainCause({ muscleGroups, plateauSessionDays, runs = [], completedHikes = [] }) {
  const sharedMuscles = [...new Set((muscleGroups || []).map(canonicalizeMuscle))]
    .filter((m) => m in RUNNING_MUSCLES || m in HIKING_MUSCLES);
  if (sharedMuscles.length === 0 || !plateauSessionDays?.length) return null;

  const cardioDailyLoad = aggregateDailyLoad({ runs, completedHikes });
  const loadValues = Object.values(cardioDailyLoad);
  if (loadValues.length < MIN_CARDIO_DAYS_FOR_BASELINE) return null;

  // This user's own average daily cardio load, across every day they've
  // logged any real running/hiking activity - the baseline "elevated"
  // gets compared against, not an arbitrary fixed number.
  const baseline = loadValues.reduce((a, b) => a + b, 0) / loadValues.length;
  if (baseline <= 0) return null;

  const dayMs = 24 * 60 * 60 * 1000;
  let elevatedCount = 0;
  plateauSessionDays.forEach((day) => {
    const sessionTime = new Date(day).getTime();
    let weekSum = 0;
    for (let i = 1; i <= 7; i++) {
      const key = new Date(sessionTime - i * dayMs).toISOString().split('T')[0];
      weekSum += cardioDailyLoad[key] || 0;
    }
    if (weekSum > baseline * 7 * CARDIO_ELEVATED_MULTIPLIER) elevatedCount++;
  });

  if (elevatedCount <= plateauSessionDays.length / 2) return null; // not a majority - not a real pattern

  return {
    sharedMuscles,
    elevatedSessionCount: elevatedCount,
    totalSessionsChecked: plateauSessionDays.length,
  };
}

/**
 * Top-level, per-lift insight for one of the three primary lifts: a real
 * plateau plus a real, data-supported cross-domain cause when both
 * exist; a plain plateau-only note when the plateau is real but nothing
 * in the data explains it (honest - never forces a cause that isn't
 * there); null when there's simply nothing notable to say (still
 * progressing, or not enough history yet either way).
 */
export function getLiftInsight({ exerciseName, muscleGroups, loggedSets, runs = [], completedHikes = [] }) {
  const plateau = detectPlateau(loggedSets);
  if (!plateau || !plateau.plateaued) return null;

  const cause = findCrossDomainCause({
    muscleGroups,
    plateauSessionDays: plateau.plateauSessionDays,
    runs,
    completedHikes,
  });

  if (cause) {
    return {
      exerciseName,
      hasCause: true,
      sharedMuscles: cause.sharedMuscles,
      message: `Your ${exerciseName} has been flat the last few sessions (est. 1RM ~${Math.round(plateau.recentBest)} lb, barely above ~${Math.round(plateau.priorBest)} lb before that) - likely connected to your running/hiking load, which works your ${cause.sharedMuscles.join('/')} too.`,
    };
  }

  return {
    exerciseName,
    hasCause: false,
    message: `Your ${exerciseName} has been flat the last few sessions (est. 1RM ~${Math.round(plateau.recentBest)} lb, barely above ~${Math.round(plateau.priorBest)} lb before that). Nothing in your running/hiking load explains it - could be worth a deload week.`,
  };
}
'''

cdi_path = pathlib.Path('lib/crossDomainInsights.js')
if cdi_path.exists():
    raise SystemExit(
        "lib/crossDomainInsights.js already exists - expected to create it fresh. "
        "Nothing changed. Tell Claude this happened."
    )
cdi_path.write_text(cross_domain_insights_content)
print("CREATED OK lib/crossDomainInsights.js")


# ============================================================
# 3) app/health.jsx - wire the new per-lift insights in: fetch each
#    primary lift's real logged-set history, run it through
#    getLiftInsight, and show whatever comes back. Anchored throughout
#    on text independent of the separate Recovery Map delivery (scan/
#    onRetryScan props on MuscleHeatmapCard), so this script applies
#    cleanly whether or not that one has already run.
# ============================================================
health_replacements = []

old_import = """import { calculateMuscleFatigue } from '@/lib/muscleFatigue';
import { rookService } from '@/services/rookService';"""
new_import = """import { calculateMuscleFatigue } from '@/lib/muscleFatigue';
import { getLiftInsight, PRIMARY_LIFT_MUSCLES } from '@/lib/crossDomainInsights';
import { rookService } from '@/services/rookService';"""
health_replacements.append(('import getLiftInsight/PRIMARY_LIFT_MUSCLES', old_import, new_import))

old_destructure = "  const { completedWorkouts, loadWorkouts } = useWorkoutStore();"
new_destructure = "  const { completedWorkouts, loadWorkouts, getExerciseHistory } = useWorkoutStore();"
health_replacements.append(('pull getExerciseHistory from useWorkoutStore', old_destructure, new_destructure))

old_state = "  const [muscleFatigue, setMuscleFatigue] = useState({});"
new_state = """  const [muscleFatigue, setMuscleFatigue] = useState({});
  const [liftInsights, setLiftInsights] = useState([]);"""
health_replacements.append(('add liftInsights state', old_state, new_state))

old_effect_tail = """  }, [completedWorkouts, runs, completedHikes, sleep?.hours, sleep?.quality]);

  const onRefresh = async () => {"""
new_effect_tail = """  }, [completedWorkouts, runs, completedHikes, sleep?.hours, sleep?.quality]);

  // Real, new: cross-domain lift insights - real plateau detection
  // (lib/crossDomainInsights.js) for each of the three primary lifts,
  // cross-checked against real running/hiking load. Runs once real runs/
  // hikes history is loaded; re-fetches each lift's own logged-set
  // history directly (same query shape getBestOneRepMaxes already uses)
  // rather than depending on completedWorkouts' own exercise list, since
  // the plateau math needs the full per-session history, not just a
  // single best. Silently empty (never a fabricated "all good" message)
  // when nothing real is detected for any of the three.
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    (async () => {
      const liftNames = Object.keys(PRIMARY_LIFT_MUSCLES);
      const histories = await Promise.all(
        liftNames.map((name) => getExerciseHistory(name, user.uid))
      );
      if (cancelled) return;
      const insights = liftNames
        .map((name, i) => getLiftInsight({
          exerciseName: name,
          muscleGroups: PRIMARY_LIFT_MUSCLES[name],
          loggedSets: histories[i],
          runs,
          completedHikes,
        }))
        .filter(Boolean);
      setLiftInsights(insights);
    })();
    return () => { cancelled = true; };
  }, [user?.uid, runs, completedHikes]);

  const onRefresh = async () => {"""
health_replacements.append(('add the per-lift-insight effect', old_effect_tail, new_effect_tail))

old_render_anchor = """        </View>

        <TouchableOpacity
          style={{
            backgroundColor: '#F5F5F5',"""
new_render_anchor = """        </View>

        {liftInsights.length > 0 && (
          <View style={s.insightCard}>
            <View style={s.insightBadge}>
              <Ionicons name="git-compare-outline" size={14} color="#000" />
              <Text style={s.insightBadgeText}>Cross-Training Insight</Text>
            </View>
            {liftInsights.map((insight) => (
              <Text key={insight.exerciseName} style={[s.insightText, { marginBottom: 6 }]}>
                {insight.message}
              </Text>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={{
            backgroundColor: '#F5F5F5',"""
health_replacements.append(('render the Cross-Training Insight card', old_render_anchor, new_render_anchor))

apply_replacements('app/health.jsx', health_replacements)

print("ALL FILES UPDATED OK")
