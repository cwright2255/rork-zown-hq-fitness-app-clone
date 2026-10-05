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
# 0) remove the stray delivery script that got committed by accident
#    (git add -A sweeping up apply_cross_domain_insights.py)
# ============================================================
stray_script = pathlib.Path('apply_cross_domain_insights.py')
if stray_script.exists():
    stray_script.unlink()
    print("REMOVED stray apply_cross_domain_insights.py")
else:
    print("apply_cross_domain_insights.py already gone - nothing to remove")


# ============================================================
# 1) services/coachService.js - the real fix. buildCoachSystemPrompt
#    only ever injected static profile fields (goals/injuries/fitness
#    level) - the existing coach chat has never had access to anything
#    the user actually logged, so it can't answer a real question about
#    real training with anything but generic encouragement. These three
#    functions give it real numbers to cite instead, from the same real
#    data/math lib/crossDomainInsights.js's plateau detection already
#    uses and already verified this session.
# ============================================================
coach_service_replacements = []

old_cs_import = """import { db } from '../src/config/firebase';
import {
  collection, addDoc, query, where, getDocs, serverTimestamp,
} from 'firebase/firestore';"""
new_cs_import = """import { db } from '../src/config/firebase';
import {
  collection, addDoc, query, where, getDocs, serverTimestamp,
} from 'firebase/firestore';
import { groupSetsBySession, estimateOneRepMax } from './progressiveOverloadService';"""
coach_service_replacements.append(('import groupSetsBySession/estimateOneRepMax', old_cs_import, new_cs_import))

old_cs_anchor = """// Real, new: persistent coaching history, distinct from"""
new_cs_block = """// Real, new: this is what actually closes the "AI chat over your own
// logged data, with cited sources" gap - buildCoachSystemPrompt above
// only ever injects static profile fields (goals/injuries/fitness
// level), never anything the user has actually logged, so today the
// coach can't answer "how's my squat going?" with anything but generic
// encouragement. These three functions give it real numbers to cite
// instead: an honest summary computed from the exact same real data
// (per-lift logged-set history, runs, hikes) and the exact same
// real math (estimateOneRepMax, groupSetsBySession) already verified
// for lib/crossDomainInsights.js's plateau detection - no new, separate
// "fitness math" to trust.

/**
 * Real per-lift PR summary from each lift's actual logged-set history
 * (store/workoutStore.js's getExerciseHistory - the same real query
 * lib/crossDomainInsights.js's plateau detection already uses). Finds
 * the single heaviest real set ever logged for each lift (by estimated
 * 1RM), not an average or an estimate layered on top of one. A lift
 * with zero logged sets - or only bodyweight sets, which
 * estimateOneRepMax correctly can't rate - is left out of the result
 * entirely, rather than reported as a 0 lb "PR": no data is not the
 * same claim as no progress.
 * @param {Record<string, Array<{weight:number, reps:number, date:any}>>} historiesByLift
 */
export function summarizeLiftPRs(historiesByLift) {
  const summary = [];
  Object.entries(historiesByLift || {}).forEach(([name, sets]) => {
    const sessions = groupSetsBySession(sets || []);
    if (sessions.length === 0) return;

    let bestE1RM = null;
    let bestSet = null;
    sessions.forEach((session) => {
      session.sets.forEach((s) => {
        const e1rm = estimateOneRepMax(s.weight, s.reps);
        if (e1rm != null && (bestE1RM === null || e1rm > bestE1RM)) {
          bestE1RM = e1rm;
          bestSet = { weight: s.weight, reps: s.reps, day: session.day };
        }
      });
    });
    if (!bestSet) return; // every set in this lift's history was unratable (e.g. bodyweight)

    summary.push({
      name,
      bestWeight: bestSet.weight,
      bestReps: bestSet.reps,
      bestE1RM: Math.round(bestE1RM),
      bestDate: bestSet.day,
      lastSessionDate: sessions[sessions.length - 1].day,
      sessionCount: sessions.length,
    });
  });
  return summary;
}

/**
 * Real running/hiking volume over the trailing window (default 7 real
 * days) - plain totals from the user's actual logged runs/hikes, same
 * date fields lib/trainingLoad.js's aggregateDailyLoad already reads
 * (runs: endTime||startTime; hikes: completedAt). Always returns real
 * totals (0 when nothing was logged in the window) rather than null,
 * since "0 km this week" is itself real, citable information for a
 * coaching conversation - unlike an absent lift PR, there's no
 * ambiguity here between "no data" and "none logged."
 */
export function summarizeCardioVolume({ runs = [], completedHikes = [], days = 7 } = {}) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const inWindow = (dateInput) => {
    const d = new Date(dateInput);
    return !Number.isNaN(d.getTime()) && d.getTime() >= cutoff;
  };
  const recentRuns = (runs || []).filter((r) => inWindow(r.endTime || r.startTime));
  const recentHikes = (completedHikes || []).filter((h) => inWindow(h.completedAt));
  return {
    days,
    runCount: recentRuns.length,
    runKm: Math.round(recentRuns.reduce((sum, r) => sum + (r.distance || 0), 0) * 10) / 10,
    hikeCount: recentHikes.length,
    hikeKm: Math.round(recentHikes.reduce((sum, h) => sum + (h.distance || 0), 0) * 10) / 10,
  };
}

/**
 * Turns the real summaries above into one compact system message the
 * coach chat can actually cite from. Explicitly told to stick to what's
 * given here and admit what it doesn't have, rather than filling gaps
 * with generic advice dressed up as a real number - same "don't invent
 * what the data doesn't show" principle services/aiService.js's
 * generateTrainingLoadInsight prompt already states for its own signal.
 * @param {{ liftPRs?: object[], cardioVolume?: object|null, monthlyWorkoutCount?: number|null, trainingLoad?: object|null }} params
 */
export function buildUserDataContext({ liftPRs = [], cardioVolume = null, monthlyWorkoutCount = null, trainingLoad = null } = {}) {
  const lines = [
    "Here is this user's real, current logged data. Only cite specific numbers or dates from this message - " +
      "if asked about something not covered here, say you don't have that logged rather than guessing or estimating.",
  ];

  if (monthlyWorkoutCount != null) {
    lines.push(`Workouts logged in the last 30 days: ${monthlyWorkoutCount}.`);
  }

  if (liftPRs.length > 0) {
    const liftLines = liftPRs
      .map((p) => `${p.name} - best ${p.bestWeight} lb x ${p.bestReps} (est. 1RM ~${p.bestE1RM} lb) on ${p.bestDate}, most recent session ${p.lastSessionDate}, ${p.sessionCount} sessions logged.`)
      .join(' ');
    lines.push(`Primary lift history: ${liftLines}`);
  } else {
    lines.push('No logged history yet for Squat, Bench Press, or Deadlift specifically.');
  }

  if (cardioVolume) {
    lines.push(
      `Last ${cardioVolume.days} days: ${cardioVolume.runCount} run(s) totaling ${cardioVolume.runKm} km, ` +
        `${cardioVolume.hikeCount} hike(s) totaling ${cardioVolume.hikeKm} km.`
    );
  }

  if (trainingLoad && trainingLoad.zone !== 'insufficient_data') {
    lines.push(`Current training load: ${trainingLoad.zoneLabel} (acute:chronic ratio ${trainingLoad.ratio}).`);
  }

  return { role: 'system', content: lines.join(' ') };
}

// Real, new: persistent coaching history, distinct from"""
coach_service_replacements.append(('add summarizeLiftPRs/summarizeCardioVolume/buildUserDataContext', old_cs_anchor, new_cs_block))

apply_replacements('services/coachService.js', coach_service_replacements)


# ============================================================
# 2) app/coach.jsx - wire the real data context into the existing coach
#    chat: load the three stores, fetch each primary lift's real
#    history, summarize it, and include it in every message sent.
# ============================================================
coach_jsx_replacements = []

old_coach_import = """import { chatAI } from '@/services/aiService';
import { buildCoachSystemPrompt, getCoachHistory, saveCoachMessage } from '@/services/coachService';
import { useUserStore } from '@/store/userStore';"""
new_coach_import = """import { chatAI } from '@/services/aiService';
import {
  buildCoachSystemPrompt, getCoachHistory, saveCoachMessage,
  summarizeLiftPRs, summarizeCardioVolume, buildUserDataContext,
} from '@/services/coachService';
import { useUserStore } from '@/store/userStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useRunningStore } from '@/store/runningStore';
import { useHikingStore } from '@/store/hikingStore';
import { PRIMARY_LIFT_MUSCLES } from '@/lib/crossDomainInsights';
import { aggregateDailyLoad, calculateTrainingLoad } from '@/lib/trainingLoad';"""
coach_jsx_replacements.append(('import the new data-context pieces', old_coach_import, new_coach_import))

old_coach_state = """export default function CoachScreen() {
  const { user } = useUserStore();
  const [chatHistory, setChatHistory] = useState([WELCOME_MESSAGE]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const scrollViewRef = useRef(null);"""
new_coach_state = """export default function CoachScreen() {
  const { user } = useUserStore();
  const { completedWorkouts, loadWorkouts, getExerciseHistory } = useWorkoutStore();
  const { runs, loadRuns } = useRunningStore();
  const { completedHikes, loadCompletedHikes } = useHikingStore();
  const [chatHistory, setChatHistory] = useState([WELCOME_MESSAGE]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [dataContext, setDataContext] = useState(null);
  const scrollViewRef = useRef(null);"""
coach_jsx_replacements.append(('pull in the workout/running/hiking stores + dataContext state', old_coach_state, new_coach_state))

old_effect_anchor = """    return () => { cancelled = true; };
  }, [user?.uid]);

  const handleSend = async (textToSend) => {"""
new_effect_block = """    return () => { cancelled = true; };
  }, [user?.uid]);

  // Real, new: this is what actually lets the coach cite real numbers
  // instead of only ever giving generic encouragement - a compact,
  // honest summary of the user's actual logged lifts/runs/hikes, built
  // fresh into every message below (services/coachService.js). Loads
  // the three stores' own data directly (same loader calls app/health.jsx
  // already makes) since there's no shared cache between screens, then
  // fetches each primary lift's real set-by-set history the same way
  // lib/crossDomainInsights.js's plateau detection already does.
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    (async () => {
      await Promise.all([loadWorkouts(user.uid), loadRuns(user.uid), loadCompletedHikes(user.uid)]);
      if (cancelled) return;

      const liftNames = Object.keys(PRIMARY_LIFT_MUSCLES);
      const histories = await Promise.all(
        liftNames.map((name) => getExerciseHistory(name, user.uid))
      );
      if (cancelled) return;

      const historiesByLift = {};
      liftNames.forEach((name, i) => { historiesByLift[name] = histories[i]; });

      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const monthlyWorkoutCount = completedWorkouts.filter((w) => {
        const d = w.date?.toDate ? w.date.toDate() : new Date(w.date);
        return !Number.isNaN(d.getTime()) && d.getTime() >= thirtyDaysAgo;
      }).length;

      const trainingLoad = calculateTrainingLoad(
        aggregateDailyLoad({ completedWorkouts, runs, completedHikes })
      );

      setDataContext({
        liftPRs: summarizeLiftPRs(historiesByLift),
        cardioVolume: summarizeCardioVolume({ runs, completedHikes, days: 7 }),
        monthlyWorkoutCount,
        trainingLoad,
      });
    })();
    return () => { cancelled = true; };
  }, [user?.uid, runs, completedHikes, completedWorkouts]);

  const handleSend = async (textToSend) => {"""
coach_jsx_replacements.append(('add the real-data-fetching effect', old_effect_anchor, new_effect_block))

old_send = """    try {
      const systemMsg = buildCoachSystemPrompt(user);
      const messagesPayload = [systemMsg]
        .concat(chatHistory.filter((m) => m.id !== 'welcome'))
        .concat(userMsg)
        .map((m) => ({ role: m.role, content: m.content }));"""
new_send = """    try {
      const systemMsg = buildCoachSystemPrompt(user);
      // Real, new: rebuilt fresh on every send, same as systemMsg itself -
      // reflects whatever's actually been loaded so far rather than a
      // stale snapshot from when the screen first mounted. Omitted
      // entirely (not sent as an empty/placeholder message) until the
      // real fetch above finishes, so the model is never told "here is
      // the user's data" with nothing actually in it yet.
      const dataMsg = dataContext ? buildUserDataContext(dataContext) : null;
      const messagesPayload = [systemMsg]
        .concat(dataMsg ? [dataMsg] : [])
        .concat(chatHistory.filter((m) => m.id !== 'welcome'))
        .concat(userMsg)
        .map((m) => ({ role: m.role, content: m.content }));"""
coach_jsx_replacements.append(('send the real data context with every message', old_send, new_send))

apply_replacements('app/coach.jsx', coach_jsx_replacements)

print("ALL FILES UPDATED OK")
