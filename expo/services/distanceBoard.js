// services/distanceBoard.js
//
// Puts this person's weekly and monthly distance on the leaderboard
// (store/leaderboardStore.js, lib/runLeaderboard.js). Called after a run is
// saved and when the leaderboard is opened, so a history recorded before the
// distance boards existed shows up too. It never throws; a failed publish just
// tries again the next time.
import { useLeaderboardStore } from '../store/leaderboardStore';
import { useRunningStore } from '../store/runningStore';
import { useSettingsStore } from '../store/settingsStore';

/**
 * @param {object} options
 *   user       the signed-in user ({ uid, name, profileImage })
 *   loadFirst  refresh the saved runs from the server first (when the runs might not be loaded yet)
 * @returns {Promise<boolean>} true when the leaderboard entry is up to date
 */
export async function publishMyDistance({ user, loadFirst = false } = {}) {
  const uid = user && user.uid;
  if (!uid) return false;
  try {
    const running = useRunningStore.getState();
    if (loadFirst && typeof running.loadRuns === 'function') await running.loadRuns(uid);
    // "Show me in leaderboards" off means no distance is published (and any already there is removed).
    const visible = useSettingsStore.getState().showInLeaderboards !== false;
    return await useLeaderboardStore.getState()._syncDistanceEntry(uid, {
      name: user.name,
      avatar: user.profileImage,
      runs: useRunningStore.getState().runs,
      visible,
    });
  } catch (e) {
    console.warn('[distanceBoard] publish failed:', e?.message);
    return false;
  }
}
