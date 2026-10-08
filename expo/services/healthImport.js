// services/healthImport.js
//
// Brings runs and walks in from Apple Health, start to finish: check Health is
// there, ask for access, read the workouts, leave out what is already in Zown,
// and save the rest. The screen (app/running/import.jsx) only shows progress and
// the outcome. Everything it depends on is passed in, so it is easy to test.
//
// Importing never earns XP and never counts toward challenges: these are
// outings from the past (often already counted elsewhere), and paying out for
// them would make the totals easy to inflate.
import { appleHealthService } from './appleHealthService';
import {
  DEFAULT_RANGE, MAX_IMPORT_WORKOUTS, describeImport, planImport, rangeStartMs,
} from '../lib/runImport';

/**
 * @param {object} options
 *   uid        signed-in user
 *   rangeId    '30d' | '90d' | '1y'
 *   loadRuns   (uid) => Promise  refresh the saved history first, so a stale copy is never saved over the real one
 *   getRuns    () => array       the saved history right now
 *   saveRuns   (uid, runs) => { added, dropped }  saves the new runs (the store's importRuns)
 *   onProgress ({ done, total })
 *   health     the Health service (defaults to Apple Health)
 * @returns {Promise<{ok:true, added:array, headline:string, lines:string[], found:number}
 *   | {ok:false, reason:'signed-out'|'unavailable'|'denied'|'error', message?:string}>}
 */
export async function importWorkouts({
  uid, rangeId = DEFAULT_RANGE, loadRuns, getRuns, saveRuns, onProgress, health = appleHealthService, now = Date.now(),
} = {}) {
  if (!uid) return { ok: false, reason: 'signed-out' };
  try {
    if (!(await health.isAvailable())) return { ok: false, reason: 'unavailable' };
    if (!(await health.requestWorkoutAccess())) return { ok: false, reason: 'denied' };

    if (typeof loadRuns === 'function') await loadRuns(uid);
    const existing = (typeof getRuns === 'function' ? getRuns() : []) || [];
    const skipIds = new Set(existing.filter(Boolean).map((r) => String(r.id)));

    const read = await health.readWorkouts({
      sinceMs: rangeStartMs(rangeId, now), uid, skipIds, limit: MAX_IMPORT_WORKOUTS, onProgress,
    });
    if (!read || !read.ok) return { ok: false, reason: (read && read.reason) || 'error', message: read && read.message };

    const plan = planImport(read.runs, existing);
    let added = [];
    let dropped = 0;
    if (plan.add.length > 0) {
      const saved = await saveRuns(uid, plan.add);
      added = saved && Array.isArray(saved.added) ? saved.added : plan.add;
      dropped = saved && typeof saved.dropped === 'number' ? saved.dropped : 0;
    }
    const summary = describeImport({
      added,
      alreadyThere: plan.alreadyThere + read.skipped,
      overlapping: plan.overlapping,
      dropped,
      found: read.found,
    });
    return { ok: true, added, found: read.found, ...summary };
  } catch (e) {
    console.warn('[healthImport] import failed:', e?.message);
    return { ok: false, reason: 'error', message: e?.message || '' };
  }
}
