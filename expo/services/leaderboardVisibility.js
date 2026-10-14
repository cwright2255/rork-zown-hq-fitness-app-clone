// services/leaderboardVisibility.js
//
// "Show in Leaderboards" in Settings. When it is off, nothing about the person
// is put on the leaderboard: not their XP, level or streak (publishMyXp), not
// their distance (services/distanceBoard.js), not their virtual race times
// (services/raceBoard.js), and whatever is already there is taken off
// (setShowInLeaderboards). Everything that writes the person's entry goes
// through here, distanceBoard or raceBoard, so the setting is checked in one place. Nothing here throws; a failed write just tries again the next
// time something is published.
import { useExpStore } from '../store/expStore';
import { useLeaderboardStore } from '../store/leaderboardStore';
import { useSettingsStore } from '../store/settingsStore';
import { publishMyDistance } from './distanceBoard';
import { publishMyRaces, withdrawMyRaces } from './raceBoard';

/** Whether the person is to be shown on the boards. On unless they turned it off. */
export function isShownOnLeaderboards() {
  return useSettingsStore.getState().showInLeaderboards !== false;
}

/**
 * Puts this person's XP, level and streak on the leaderboard (nothing when they
 * are hidden). Called after XP is earned.
 * @param {object} options
 *   user    the signed-in user ({ uid, name, profileImage })
 *   streak  days in a row with a workout, a run or a hike (services/streakService.js); 0 when not given
 * @returns {Promise<boolean>} true when the entry was written
 */
export async function publishMyXp({ user, streak } = {}) {
  const uid = user && user.uid;
  if (!uid) return false;
  try {
    const { expSystem } = useExpStore.getState();
    return await useLeaderboardStore.getState()._syncLeaderboardEntry(uid, {
      name: user.name,
      avatar: user.profileImage,
      xp: expSystem.totalExp,
      level: expSystem.level,
      streak: Number.isFinite(streak) && streak > 0 ? streak : 0,
      visible: isShownOnLeaderboards(),
    });
  } catch (e) {
    console.warn('[leaderboardVisibility] publish failed:', e?.message);
    return false;
  }
}

/**
 * Saves the setting and acts on it at once: off takes the person's whole entry
 * and their virtual race times off the boards, on puts their XP, distance and
 * race times back.
 * @param {boolean} show    true to be shown
 * @param {object} user     the signed-in user ({ uid, name, profileImage })
 * @param {number} streak   days in a row with a workout, a run or a hike (services/streakService.js), put back with the XP
 * @returns {Promise<boolean>} true when the leaderboard now matches the setting
 */
export async function setShowInLeaderboards(show, user, streak) {
  const uid = user && user.uid;
  useSettingsStore.getState().updateSetting('showInLeaderboards', !!show, uid);
  if (!uid) return false;
  const xp = show ? await publishMyXp({ user, streak }) : true;
  const distance = await publishMyDistance({ user, loadFirst: !!show });
  const races = show ? await publishMyRaces({ user }) : await withdrawMyRaces({ user });
  return xp && distance && races;
}
