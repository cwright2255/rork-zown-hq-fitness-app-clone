// services/journeyRewards.js
//
// What finishing a virtual journey (lib/virtualJourneys.js) pays: XP, once, and the
// Trailblazer badge. store/virtualChallengeStore.js calls this at the moment a
// journey is first completed and never again for that journey on that phone, so a
// reward that fails is logged and not retried. There is no physical medal.
import { useExpStore } from '../store/expStore';
import { useBadgeStore } from '../store/badgeStore';
import { journeyXp } from '../lib/virtualJourneys';

/** The badge for finishing a virtual journey (see store/badgeStore.js). */
export const JOURNEY_BADGE_ID = 'badge-15';

/**
 * @param journey a catalogue entry (lib/virtualJourneys.js)
 * @param uid     the signed-in user
 * @param now     the time of the finish, in ms
 */
export function rewardJourney(journey, uid, now = Date.now()) {
  if (!journey || !uid) return;
  try {
    useExpStore.getState().addExpActivity({
      id: `journey-${journey.id}`,
      type: 'running',
      baseExp: journeyXp(journey.distanceKm),
      multiplier: 1.0,
      date: new Date(now).toISOString().split('T')[0],
      description: `Finished the ${journey.title} journey`,
      completed: true,
    }, uid);
  } catch (e) {
    console.warn('[journeyRewards] XP failed:', e?.message);
  }
  try {
    useBadgeStore.getState().unlockBadge(JOURNEY_BADGE_ID, uid);
  } catch (e) {
    console.warn('[journeyRewards] badge failed:', e?.message);
  }
}
