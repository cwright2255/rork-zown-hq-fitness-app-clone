import { db } from '../src/config/firebase';
import {
  collection, addDoc, query, where, getDocs, serverTimestamp,
} from 'firebase/firestore';
import { groupSetsBySession, estimateOneRepMax } from './progressiveOverloadService';

// Real, new: readable labels for the raw ids app/profile/edit.jsx's
// GOALS/INJURIES constants store on the user, so the system prompt below
// can reference them in plain English rather than raw snake_case ids.
// Kept local rather than importing from edit.jsx, since that file doesn't
// currently export these lists.
const GOAL_LABELS = {
  lose_weight: 'Lose Weight',
  build_muscle: 'Build Muscle',
  improve_endurance: 'Improve Endurance',
  stay_active: 'Stay Active',
  train_for_race: 'Train for a Race',
  eat_healthier: 'Eat Healthier',
  reduce_stress: 'Reduce Stress',
};

const INJURY_LABELS = {
  knee: 'Knee',
  shoulder: 'Shoulder',
  lower_back: 'Lower Back',
  hip: 'Hip',
  ankle: 'Ankle',
  wrist: 'Wrist',
  elbow: 'Elbow',
  neck: 'Neck',
};

// Real, new: this is what actually makes this a "coach" rather than a
// generic chatbot - injects the user's real, stored goals, injuries,
// fitness level, and nutrition preference (app/profile/edit.jsx's
// fitnessMetrics fields) as a system message, so the AI can reference
// real specifics rather than only what the user happens to type in a
// given message. Every field degrades gracefully when unset - a brand
// new profile with nothing filled in still produces a clean, sensible
// prompt, not an awkward "Goals: ." fragment.
export function buildCoachSystemPrompt(user) {
  const name = user?.name?.trim() || 'there';
  const goals = (user?.fitnessMetrics?.targetGoals || []).map((id) => GOAL_LABELS[id] || id);
  const injuries = (user?.fitnessMetrics?.injuries || []).map((id) => INJURY_LABELS[id] || id);
  const level = user?.fitnessLevel || 'unspecified';
  const nutritionPref = user?.fitnessMetrics?.nutritionPreference;

  const lines = [
    `You are ZOWN's AI fitness coach, in an ongoing coaching conversation with ${name}.`,
    `Fitness level: ${level}.`,
    goals.length ? `Goals: ${goals.join(', ')}.` : null,
    injuries.length
      ? `Reported injuries/areas to be careful with: ${injuries.join(', ')}. Take these seriously when suggesting exercises.`
      : null,
    nutritionPref && nutritionPref !== 'no_preference'
      ? `Nutrition preference: ${nutritionPref.replace(/_/g, ' ')}.`
      : null,
    'Be encouraging, specific, and concise. Reference their real goals and injuries naturally when relevant, not every message.',
  ].filter(Boolean);

  return { role: 'system', content: lines.join(' ') };
}

// Real, new: this is what actually closes the "AI chat over your own
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

// Real, new: persistent coaching history, distinct from
// app/profile/help.jsx's chat (which is local component state only and
// resets on navigation). Equality-only where clause, matching
// store/workoutStore.js's getExerciseHistory - avoids needing a
// composite index; sorted chronologically client-side instead.
export async function getCoachHistory(uid) {
  if (!uid) return [];
  const q = query(collection(db, 'coachMessages'), where('userId', '==', uid));
  const snap = await getDocs(q);
  const messages = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      role: data.role,
      content: data.content,
      createdAt: data.createdAt?.toDate?.() ?? new Date(0),
    };
  });
  messages.sort((a, b) => a.createdAt - b.createdAt);
  return messages;
}

export async function saveCoachMessage(uid, role, content) {
  if (!uid) return;
  await addDoc(collection(db, 'coachMessages'), {
    userId: uid,
    role,
    content,
    createdAt: serverTimestamp(),
  });
}
