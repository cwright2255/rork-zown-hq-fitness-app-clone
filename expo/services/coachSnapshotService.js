// services/coachSnapshotService.js
//
// Reads the app's stores (weight logs, body scans, goals, nutrition,
// calendar) at the moment a coach message is sent and turns them into the
// system message built by lib/userProfileData.js. Read fresh each time so
// the coach never works from numbers that were changed after the screen
// opened. Any problem reading a store just leaves that part out.
import { useWeightLogStore } from '../store/weightLogStore';
import { useBodyCompositionStore } from '../store/bodyCompositionStore';
import { useGoalsStore } from '../store/goalsStore';
import { useNutritionStore } from '../store/nutritionStore';
import { useScheduleStore } from '../store/scheduleStore';
import { upcomingEvents } from '../lib/scheduleUtils';
import { formatEventWhen } from '../lib/coachActions';
import { buildProfile, buildSnapshotMessage, dayTotals } from '../lib/userProfileData';

const safe = (fn, fallback) => {
  try { return fn(); } catch (e) { console.warn('[coachSnapshot] skipped:', e?.message); return fallback; }
};

export function loadSnapshotSources(uid) {
  return Promise.all([
    useWeightLogStore.getState().loadLogs(uid),
    useBodyCompositionStore.getState().loadScans(uid),
    useGoalsStore.getState().loadGoals(uid),
  ]);
}

export function getProfileFromStores(user) {
  const weightLogs = safe(() => useWeightLogStore.getState().logs, []);
  const scans = safe(() => useBodyCompositionStore.getState().scans, []);
  return buildProfile({ user, weightLogs, scans });
}

export function buildSnapshotFromStores(user, now = new Date()) {
  const weightLogs = safe(() => useWeightLogStore.getState().logs, []);
  const scans = safe(() => useBodyCompositionStore.getState().scans, []);
  const goals = safe(() => useGoalsStore.getState().goals, []);
  const profile = buildProfile({ user, weightLogs, scans });
  const nutrition = safe(() => {
    const { meals, dailyGoals } = useNutritionStore.getState();
    // The nutrition store keys days by the UTC date; include the local date too.
    const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return { dailyGoals, today: dayTotals(meals, [now.toISOString().slice(0, 10), local]) };
  }, null);
  const upcoming = safe(
    () => upcomingEvents(useScheduleStore.getState().events, now, 6).map((e) => ({ title: e.title, when: formatEventWhen(e.start) })),
    []
  );
  return buildSnapshotMessage({ profile, weightLogs, goals, nutrition, upcoming, now });
}
