// services/journeyRewards.js
//
// What finishing a virtual journey (lib/virtualJourneys.js) pays: XP, once.
// store/virtualChallengeStore.js calls this at the moment a journey is first completed
// and never again for that journey on that phone, so a reward that fails is logged and
// not retried. The Trailblazer badge (badge-15) is not given here: the server gives it
// once it has accepted the XP claim filed below (functions/src/unlocks.js). There is no
// physical medal.
import { useExpStore } from '../store/expStore';
import { journeyXp } from '../lib/virtualJourneys';
import { localDateKey } from '../lib/localDate';

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
      date: localDateKey(new Date(now)),
      description: `Finished the ${journey.title} journey`,
      completed: true,
    }, uid);
  } catch (e) {
    console.warn('[journeyRewards] XP failed:', e?.message);
  }
}
