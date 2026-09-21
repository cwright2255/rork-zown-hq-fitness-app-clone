import { db } from '../src/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { estimateOneRepMax } from './progressiveOverloadService';

const TIERS = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite'];

// Real, new: general, estimated strength standards (1RM as a multiple of
// bodyweight), not a precise scientific measurement - this is genuinely
// an area where published sources vary by several tenths depending on
// dataset and methodology. These are reasonable, round values
// reflecting the general, converging pattern across multiple public
// sources, not one single, authoritative dataset. Only the three
// primary barbell lifts, matched exactly (not variants like "Front
// Squat" or "Romanian Deadlift", which have meaningfully different
// strength profiles the same standards shouldn't be applied to).
const STANDARDS = {
  male: {
    'Bench Press': [0.5, 0.75, 1.25, 1.75, 2.0],
    Squat: [0.75, 1.0, 1.5, 2.0, 2.5],
    Deadlift: [1.0, 1.5, 2.0, 2.5, 3.0],
  },
  female: {
    'Bench Press': [0.35, 0.5, 0.8, 1.15, 1.3],
    Squat: [0.6, 0.8, 1.2, 1.6, 2.0],
    Deadlift: [0.8, 1.2, 1.6, 2.0, 2.4],
  },
};

function getTierForRatio(ratio, thresholds) {
  let tierIndex = -1;
  for (let i = 0; i < thresholds.length; i++) {
    if (ratio >= thresholds[i]) tierIndex = i;
  }
  if (tierIndex === -1) {
    return { tier: 'Untrained', tierIndex: -1, progressToNext: thresholds[0] > 0 ? ratio / thresholds[0] : 0 };
  }
  if (tierIndex === thresholds.length - 1) {
    return { tier: TIERS[tierIndex], tierIndex, progressToNext: 1 };
  }
  const cur = thresholds[tierIndex];
  const next = thresholds[tierIndex + 1];
  return { tier: TIERS[tierIndex], tierIndex, progressToNext: (ratio - cur) / (next - cur) };
}

// Real, new: reads the user's own, real logged history (store/
// workoutStore.js's loggedSets, via the same equality-only query
// pattern getExerciseHistory already uses) for exactly the three
// primary lifts these standards apply to, and returns the best real,
// estimated 1RM (services/progressiveOverloadService.js's own
// estimateOneRepMax) achieved for each - not a guess, the user's own
// actual, real performance.
export async function getBestOneRepMaxes(uid) {
  if (!uid) return {};
  const lifts = ['Bench Press', 'Squat', 'Deadlift'];
  const results = {};
  for (const lift of lifts) {
    const q = query(
      collection(db, 'loggedSets'),
      where('userId', '==', uid),
      where('exerciseName', '==', lift)
    );
    const snap = await getDocs(q);
    let best = null;
    snap.docs.forEach((d) => {
      const data = d.data();
      const oneRm = estimateOneRepMax(data.weight, data.reps);
      if (oneRm && (best === null || oneRm > best)) best = oneRm;
    });
    if (best !== null) results[lift] = best;
  }
  return results;
}

// Real, new: combines the user's own real 1RMs (getBestOneRepMaxes)
// with their own real, stored bodyweight and gender (both already
// collected in onboarding) against the general standards above. Returns
// per-lift tiers plus one overall tier (the lowest of the lifts with
// data - a genuine "strength score" shouldn't be inflated by a single
// strong lift while others lag).
export function computeStrengthScore({ oneRepMaxes, bodyweightKg, gender }) {
  const table = gender === 'female' ? STANDARDS.female : STANDARDS.male;
  const lifts = Object.keys(table);
  const perLift = {};

  lifts.forEach((lift) => {
    const oneRm = oneRepMaxes[lift];
    if (!oneRm || !bodyweightKg) return;
    const ratio = oneRm / bodyweightKg;
    perLift[lift] = { oneRepMaxKg: Math.round(oneRm * 10) / 10, ratio, ...getTierForRatio(ratio, table[lift]) };
  });

  const withData = Object.values(perLift);
  if (withData.length === 0) return { perLift, overallTier: null, overallTierIndex: -1 };

  const lowest = withData.reduce((min, cur) => (cur.tierIndex < min.tierIndex ? cur : min));
  return { perLift, overallTier: lowest.tier, overallTierIndex: lowest.tierIndex };
}
