// services/leaderboardVisibility.js
//
// "Show in Leaderboards" in Settings. When it is off, nothing about the person
// is put on the leaderboard: not their XP, level or streak (publishMyXp), not
// their distance (services/distanceBoard.js), and whatever is already there is
// taken off (setShowInLeaderboards). Everything that writes the person's
// entry goes through here or through distanceBoard, so the setting is checked
// in one place. Nothing here throws; a failed write just tries again the next
// time something is published.
import { useExpStore } from '../store/expStore';
import { useLeaderboardStore } from '../store/leaderboardStore';
import { useSettingsStore } from '../store/settingsStore';
import { publishMyDistance } from './distanceBoard';

/** Whether the person is to be shown on the boards. On unless they turned it off. */
export function isShownOnLeaderboards() {
  return useSettingsStore.getState().showInLeaderboards !== false;
}

/**
 * Puts this person's XP, level and streak on the leaderboard (nothing when they
 * are hidden). Called after XP is earned.
 * @param {object} options
 *   user  the signed-in user ({ uid, name, profileImage, streak })
 * @returns {Promise<boolean>} true when the entry was written
 */
export async function publishMyXp({ user } = {}) {
  const uid = user && user.uid;
  if (!uid) return false;
  try {
    const { expSystem } = useExpStore.getState();
    return await useLeaderboardStore.getState()._syncLeaderboardEntry(uid, {
      name: user.name,
      avatar: user.profileImage,
      xp: expSystem.totalExp,
      level: expSystem.level,
      streak: user.streak,
      visible: isShownOnLeaderboards(),
    });
  } catch (e) {
    console.warn('[leaderboardVisibility] publish failed:', e?.message);
    return false;
  }
}

/**
 * Saves the setting and acts on it at once: off takes the person's whole entry
 * off the boards, on puts their XP and distance back.
 * @param {boolean} show  true to be shown
 * @param {object} user   the signed-in user ({ uid, name, profileImage, streak })
 * @returns {Promise<boolean>} true when the leaderboard now matches the setting
 */
export async function setShowInLeaderboards(show, user) {
  const uid = user && user.uid;
  useSettingsStore.getState().updateSetting('showInLeaderboards', !!show, uid);
  if (!uid) return false;
  const xp = show ? await publishMyXp({ user }) : true;
  const distance = await publishMyDistance({ user, loadFirst: !!show });
  return xp && distance;
}
