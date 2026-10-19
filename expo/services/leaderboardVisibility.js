// services/leaderboardVisibility.js
//
// "Show in Leaderboards" in Settings. When it is off, nothing about the person is put on the leaderboard: not their name or
// picture (publishMyProfile), not their XP, level, streak or distance (the server writes those, and leaves a person who is hidden
// off: functions/src/xpLedger.js), and not their virtual race times (services/raceBoard.js). Whatever is already there is taken off
// (setShowInLeaderboards). Everything the app writes to the person's entry goes through here, or through raceBoard for race times,
// so the setting is checked in one place. Nothing here throws; a failed write just tries again the next time something is published.
//
// The app does not write a score. XP, level, streak and distance come from the XP ledger, which the server works out from claims the
// app files (store/expStore.js, services/xpSync.js); all the app puts on its entry is who the person is.
import { useLeaderboardStore } from '../store/leaderboardStore';
import { useSettingsStore } from '../store/settingsStore';
import { publishMyRaces, withdrawMyRaces } from './raceBoard';

/** Whether the person is to be shown on the boards. On unless they turned it off. */
export function isShownOnLeaderboards() {
  return useSettingsStore.getState().showInLeaderboards !== false;
}

/**
 * Puts this person's name and picture on their leaderboard entry, making it if there is none (the server then fills in the XP,
 * level, streak and distance), or takes the entry off the boards when they are hidden. Called when the app opens, when the
 * leaderboard or social screen opens, and when the setting changes.
 * @param {object} options
 *   user    the signed-in user ({ uid, name, profileImage })
 * @returns {Promise<boolean>} true when the entry is as it should be
 */
export async function publishMyProfile({ user } = {}) {
  const uid = user && user.uid;
  if (!uid) return false;
  try {
    return await useLeaderboardStore.getState()._syncProfile(uid, {
      name: user.name,
      avatar: user.profileImage,
      visible: isShownOnLeaderboards(),
    });
  } catch (e) {
    console.warn('[leaderboardVisibility] publish failed:', e?.message);
    return false;
  }
}

/**
 * Saves the setting and acts on it at once: off takes the person's whole entry and their virtual race times off the boards, on
 * puts their entry (and so their XP, filled in by the server) and race times back.
 * @param {boolean} show    true to be shown
 * @param {object} user     the signed-in user ({ uid, name, profileImage })
 * @returns {Promise<boolean>} true when the leaderboard now matches the setting
 */
export async function setShowInLeaderboards(show, user) {
  const uid = user && user.uid;
  useSettingsStore.getState().updateSetting('showInLeaderboards', !!show, uid);
  if (!uid) return false;
  const profile = await publishMyProfile({ user });
  const races = show ? await publishMyRaces({ user }) : await withdrawMyRaces({ user });
  return profile && races;
}
