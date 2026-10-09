// lib/hikeShare.js
//
// Turns a saved hike into the post that goes on the community feed. It is the
// same card as a shared run (lib/runShare.js, drawn by components/RunPostCard.jsx):
// the numbers and a short route, no picture. A hike's card is told apart by
// activity: 'hike', and it also carries the difficulty tier.
//
// Privacy is the same too: the first and last SHARE_HIDE_ENDS_M metres of the
// route are cut off, and a route too short to show anything after that is left
// out (the stats are still shared).

import { compactTrack } from './runStats';
import { formatClock } from './runDetail';
import { RUN_POST_VERSION, SHARE_MAX_POINTS, hideRouteEnds } from './runShare';
import { hikeRoute, hikeTitle } from './hikeLog';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** The line that goes with a shared hike when nobody has written anything. */
export function hikeCaption(post) {
  const title = (post && post.title) || 'Hike';
  // \uD83E\uDD7E is the hiking boot emoji (written as an escape so the file stays plain text).
  return `${title}: ${num(post && post.distance).toFixed(2)} km in ${formatClock(post && post.duration)} \uD83E\uDD7E`;
}

/**
 * What to post for a saved hike: { run, text } where `run` is the compact
 * record stored on the post (the same shape as a shared run) and `text` is the
 * caption. Returns null when there is nothing worth sharing (no distance or no
 * time). Never contains undefined (Firestore refuses it).
 */
export function buildHikePost(hike) {
  if (!hike || typeof hike !== 'object') return null;
  const distance = Math.round(Math.max(0, num(hike.distanceKm)) * 100) / 100;
  const duration = Math.max(0, Math.round(num(hike.durationSeconds)));
  if (!(distance >= 0.01) || !(duration > 0)) return null;

  const shared = {
    v: RUN_POST_VERSION,
    activity: 'hike',
    title: hikeTitle(hike).slice(0, 40),
    distance,
    duration,
    pace: Math.round(duration / distance),
    route: compactTrack(hideRouteEnds(hikeRoute(hike)), SHARE_MAX_POINTS),
  };
  if (typeof hike.startTime === 'string' && hike.startTime) shared.startTime = hike.startTime;
  const calories = Math.round(num(hike.calories));
  if (calories > 0) shared.calories = calories;
  const climb = Math.round(num(hike.elevationGainM));
  if (climb > 0) shared.elevGain = climb;
  const tier = typeof hike.difficultyTier === 'string' ? hike.difficultyTier.trim().slice(0, 20) : '';
  if (tier) shared.tier = tier;

  return { run: shared, text: hikeCaption(shared) };
}
