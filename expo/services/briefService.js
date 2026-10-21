// services/briefService.js
//
// The daily Today brief (lib/todayBrief.js): written once a day from everything the Coach knows and kept on the phone, so opening the
// Home screen again reads the kept one instead of spending another of the day's AI requests. Asking for it never throws: a brief
// that cannot be had is simply null, and the Home screen shows nothing in its place.
//
// getTodayBrief does the keeping and asking; loadBriefMessages reads the app's stores and builds what the AI is told. Both take their
// stores, AI and storage as arguments (with the real ones as defaults) so a test can stand in for them.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateTodayBrief } from '@/services/aiService';
import { loadSnapshotSources, loadHabitSources, buildSnapshotFromStores } from '@/services/coachSnapshotService';
import { coachProfileLines, summarizeLiftPRs, summarizeCardioVolume, buildUserDataContext } from '@/services/coachService';
import { loadCoachMemory, getCachedCoachMemory } from '@/services/coachMemoryService';
import { memoryLine } from '@/lib/coachMemory';
import { useWorkoutStore } from '@/store/workoutStore';
import { useRunningStore } from '@/store/runningStore';
import { useHikingStore } from '@/store/hikingStore';
import { useHealthStore } from '@/store/healthStore';
import { useWeightLogStore } from '@/store/weightLogStore';
import { useSettingsStore } from '@/store/settingsStore';
import { PRIMARY_LIFT_MUSCLES } from '@/lib/crossDomainInsights';
import { aggregateDailyLoad, calculateTrainingLoad } from '@/lib/trainingLoad';
import { computeReadiness } from '@/lib/readiness';
import { hrvTitle } from '@/lib/healthDisplay';
import { localDateKey } from '@/lib/localDate';
import { readInsight, rememberInsight } from '@/lib/insightCache';
import {
  BRIEF_STORAGE_KEY, briefKey, parseBrief, serializeBrief, buildBriefMessages, trendFacts,
} from '@/lib/todayBrief';

/** How long the brief waits for the stores to load before it goes ahead with what they have. */
export const BRIEF_LOAD_PATIENCE_MS = 10000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// Briefs being written, by key: two callers asking for the same brief at the same moment share one request.
const inFlight = new Map();

const load = async (storage) => {
  try {
    const raw = await storage.getItem(BRIEF_STORAGE_KEY);
    // Nothing kept is null, which lib/insightCache.js reads as no entries; kept text that cannot be read throws and is started over.
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const save = async (storage, entries) => {
  try {
    await storage.setItem(BRIEF_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Not being able to keep it only means it is asked for again next time.
  }
};

// A load that fails is a load that adds nothing; it never holds up or breaks the others.
const settle = (work) => Promise.resolve().then(work).catch(() => undefined);

/**
 * Brings the stores the brief reads up to date, then the heaviest lifts' histories, and gives up waiting after `patience`
 * milliseconds. Resolves to the lift PRs found (an empty list when there was no time or no history). Never rejects.
 */
export async function loadBriefSources(uid, { patience = BRIEF_LOAD_PATIENCE_MS } = {}) {
  const found = { liftPRs: [] };
  let timer;
  const read = (async () => {
    const health = useHealthStore.getState();
    await Promise.all([
      settle(() => useWorkoutStore.getState().loadWorkouts(uid)),
      settle(() => useRunningStore.getState().loadRuns(uid)),
      settle(() => useHikingStore.getState().loadCompletedHikes(uid)),
      settle(() => loadSnapshotSources(uid)),
      settle(() => loadHabitSources(uid)),
      settle(() => health.loadAllHealth(uid)),
      settle(() => health.loadRookRecovery()),
      settle(() => loadCoachMemory(uid)),
    ]);
    // After the saved record is in, so a reading from this phone is added to it and not the other way round.
    await settle(() => useHealthStore.getState().syncReadings(uid));
    const names = Object.keys(PRIMARY_LIFT_MUSCLES);
    const histories = await Promise.all(names.map((name) => settle(() => useWorkoutStore.getState().getExerciseHistory(name, uid))));
    const byLift = {};
    names.forEach((name, i) => { byLift[name] = histories[i]; });
    found.liftPRs = summarizeLiftPRs(byLift);
  })().catch(() => undefined);
  const patient = new Promise((resolve) => { timer = setTimeout(resolve, patience); });
  await Promise.race([read, patient]);
  clearTimeout(timer);
  return found.liftPRs;
}

/** The workouts logged in the 30 days up to `now`. A date that is not one is not a number of milliseconds, so it is never counted. */
const monthlyCount = (workouts, now) => workouts.filter((w) => {
  const d = w.date?.toDate ? w.date.toDate() : new Date(w.date);
  return d.getTime() >= now.getTime() - MONTH_MS;
}).length;

/**
 * What the AI is told for today's brief, built from the app's stores after bringing them up to date. Every piece that cannot be read is
 * left out of the brief, and the brief is still written from the rest.
 * @returns {Promise<{ role: string, content: string }[]>}
 */
export async function loadBriefMessages({ user, now = new Date(), patience } = {}) {
  const liftPRs = await loadBriefSources(user.uid, { patience });

  const workouts = useWorkoutStore.getState().completedWorkouts || [];
  const runs = useRunningStore.getState().runs || [];
  const hikes = useHikingStore.getState().completedHikes || [];
  const health = useHealthStore.getState();
  const today = localDateKey(now);
  const trainingLoad = calculateTrainingLoad(aggregateDailyLoad({ completedWorkouts: workouts, runs, completedHikes: hikes }));
  const hrvLabel = hrvTitle(health.rookRecovery);
  const pounds = useSettingsStore.getState().weightUnits !== 'metric';

  let snapshot = null;
  try { snapshot = buildSnapshotFromStores(user, now); } catch { snapshot = null; }

  return buildBriefMessages({
    now,
    name: user.name,
    profileLines: [...coachProfileLines(user), memoryLine(getCachedCoachMemory(user.uid))], // buildBriefMessages leaves out a line that is null
    readiness: computeReadiness({ history: health.readingsHistory, today, trainingLoad, hrvLabel }),
    trends: trendFacts({ history: health.readingsHistory, weightLogs: useWeightLogStore.getState().logs, pounds, today, hrvLabel }),
    snapshot,
    dataMessage: buildUserDataContext({
      liftPRs,
      cardioVolume: summarizeCardioVolume({ runs, completedHikes: hikes, days: 7 }),
      monthlyWorkoutCount: monthlyCount(workouts, now),
      trainingLoad,
    }),
  });
}

/**
 * Today's brief for this person: the kept one if there is one, otherwise a new one from the AI, which is then kept for the rest of the
 * day. When the AI gives nothing, that is kept for half an hour, so a failed try is not repeated every time the Home screen opens.
 * Resolves to { headline, points }, or null.
 * `ask`, `buildMessages` and `storage` are only there so a test can stand in for the AI, the stores and the phone's storage.
 */
export async function getTodayBrief({
  user, now = new Date(), ask = generateTodayBrief, buildMessages = loadBriefMessages, storage = AsyncStorage,
}) {
  const key = briefKey(user?.uid, localDateKey(now));
  if (!key) return null;

  const kept = readInsight(await load(storage), key, now.getTime());
  if (kept.found) {
    const brief = parseBrief(kept.text);
    if (brief || kept.text === null) return brief;
    // Kept text that is not a brief (damaged, or from another version of the app) is written again.
  }

  if (inFlight.has(key)) return inFlight.get(key);
  const request = (async () => {
    let brief = null;
    try {
      const messages = await buildMessages({ user, now });
      brief = await ask({ messages });
    } catch {
      brief = null;
    }
    // Filed on top of what is kept at this moment, not what was read before the wait.
    await save(storage, rememberInsight(await load(storage), key, brief ? serializeBrief(brief) : null, now.getTime()));
    return brief;
  })().finally(() => { inFlight.delete(key); });
  inFlight.set(key, request);
  return request;
}
