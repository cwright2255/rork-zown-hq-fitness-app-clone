// services/raceBoard.js
//
// What happens when a virtual race is finished, and keeping your results on the
// boards (store/virtualRaceStore.js, lib/virtualRaces.js). Screens call this, not
// the store, so the rules are in one place:
//
//   - the time must be a run's, inside the race's dates
//   - XP (once) and the Race Day badge come with your first finish of a race
//   - a result goes on the board only while "Show in Leaderboards" is on; turning
//     it off takes your results off the boards, turning it on puts them back
//
// A result that could not be posted is kept on the phone and sent the next time
// (publishMyRaces); a failed post never throws.
import { useVirtualRaceStore } from '../store/virtualRaceStore';
import { useSettingsStore } from '../store/settingsStore';
import { useExpStore, baseExpValues } from '../store/expStore';
import { useBadgeStore } from '../store/badgeStore';
import {
  raceTimeSec, isPlausibleTime, isRaceOpen, areaOf, raceEntryId,
} from '../lib/virtualRaces';
import { localDateKey } from '../lib/localDate';

/** The badge for finishing a virtual race (see store/badgeStore.js). */
export const RACE_BADGE_ID = 'badge-14';

// "Show in Leaderboards" in Settings, on unless the person turned it off.
const shownOnBoards = () => useSettingsStore.getState().showInLeaderboards !== false;

function reward(race, uid, now) {
  try {
    useExpStore.getState().addExpActivity({
      id: `race-${race.id}`,
      type: 'running',
      baseExp: baseExpValues.virtualRace,
      multiplier: 1.0,
      date: localDateKey(new Date(now)),
      description: `Finished the ${race.name}`,
      completed: true,
    }, uid);
  } catch (e) {
    console.warn('[raceBoard] XP failed:', e?.message);
  }
  try {
    useBadgeStore.getState().unlockBadge(RACE_BADGE_ID, uid);
  } catch (e) {
    console.warn('[raceBoard] badge failed:', e?.message);
  }
}

/**
 * Called when a run reaches a race's distance.
 * @param {object} options
 *   race    the race being run (lib/virtualRaces.js currentRace)
 *   user    the signed-in user ({ uid, name, profileImage })
 *   splits  the run's kilometre splits so far (runTracker `splits`)
 *   coords  the run's route so far; the local race is put in the map square it started in
 *   now     the time of the finish, in ms
 * @returns {Promise<object>} { status: 'finished', timeSec, bestSec, first, improved, posted }
 *   (posted: 'posted' | 'hidden' | 'failed' | 'noArea'), or { status } alone:
 *   'unfinished' (not far enough yet), 'implausible', 'closed' (the race ended), 'signedOut'
 */
export async function finishRace({ race, user, splits, coords, now = Date.now() } = {}) {
  if (!race) return { status: 'unfinished' };
  const timeSec = raceTimeSec(splits, race.distanceKm);
  if (timeSec === null) return { status: 'unfinished' };
  if (!isPlausibleTime(timeSec, race.distanceKm)) return { status: 'implausible', timeSec };
  if (!isRaceOpen(race, now)) return { status: 'closed', timeSec };
  if (!user || !user.uid) return { status: 'signedOut', timeSec };

  const store = useVirtualRaceStore.getState();
  const areaId = race.kind === 'local' ? areaOf(coords && coords[0]) : null;
  const { first, improved, record } = store.recordFinish(race, user.uid, {
    timeSec, finishedAt: new Date(now).toISOString(), areaId,
  });
  if (first) reward(race, user.uid, now);

  let posted = 'hidden';
  if (shownOnBoards()) posted = record.posted ? 'posted' : await store.publish(raceEntryId(race.id, user.uid), user);
  return { status: 'finished', timeSec, bestSec: record.timeSec, first, improved, posted };
}

/**
 * Sends the results that have not reached the board (a failed post, or made while
 * hidden). Called when a race screen opens. Does nothing while hidden.
 * @returns {Promise<boolean>} true when nothing is left waiting that could be sent
 */
export async function publishMyRaces({ user } = {}) {
  const uid = user && user.uid;
  if (!uid) return false;
  if (!shownOnBoards()) return true;
  const store = useVirtualRaceStore.getState();
  const results = await Promise.all(store.unposted(uid).map((key) => store.publish(key, user)));
  return results.every((result) => result === 'posted' || result === 'noArea');
}

/**
 * Takes the person's results off the boards (they hid themselves from the leaderboards).
 * @returns {Promise<boolean>} true when they are all gone
 */
export async function withdrawMyRaces({ user } = {}) {
  // With nobody signed in the store has nothing to take down and says false.
  return useVirtualRaceStore.getState().withdraw(user && user.uid);
}
