// What earns each achievement and each badge, and which of them a set of facts has earned. Pure functions, no Firebase.
//
// These were decided on the phone, which wrote the result to the person's own record itself, so the phone could unlock anything. Now
// the server decides: functions/src/unlocks.js gathers the facts from records the server holds (the XP ledger, the workout totals, the
// hike record, the XP claims for races and journeys) and writes the result to users/{uid}/data/achievements and users/{uid}/data/badges,
// which the rules let only a function write. The names and descriptions are the app's own (store/achievementStore.js,
// store/badgeStore.js); only the ids and what they ask for are here, and __tests__/unlockRulesParity.test.js fails when the two lists differ.
//
// An unlock is kept for good: nothing here takes one away, and one already earned is not given again.

// The facts an unlock can ask for, each a number:
//   finishedWorkouts   workouts the person finished (not saved part way)
//   bestCalories       the most calories burned in one finished workout
//   streak, level, xp  from the XP ledger
//   hikeCount, hikeMiles, strenuousHikes   from the hikes the person has recorded
//   raceFinishes, journeyFinishes          virtual races and journeys finished

// Each achievement asks for a kind of progress (`type`) to reach a `target`. A type with no fact behind it (`FACT_FOR_TYPE` has no
// entry) is never earned: the app never fed those four anything either (weight lost, days of nutrition logged, social interactions,
// morning workouts), so none of them has ever unlocked.
export const ACHIEVEMENTS = [
  { id: 'first-workout', type: 'workout_count', target: 1 },
  { id: 'workout-streak-7', type: 'streak', target: 7 },
  { id: 'workout-streak-30', type: 'streak', target: 30 },
  { id: 'calories-1000', type: 'calories_burned', target: 1000 },
  { id: 'workouts-10', type: 'workout_count', target: 10 },
  { id: 'workouts-50', type: 'workout_count', target: 50 },
  { id: 'workouts-100', type: 'workout_count', target: 100 },
  { id: 'nutrition-streak-7', type: 'nutrition_logged', target: 7 },
  { id: 'weight-loss-5', type: 'weight_lost', target: 5 },
  { id: 'social-butterfly', type: 'social_interactions', target: 10 },
  { id: 'level-5', type: 'level', target: 5 },
  { id: 'level-10', type: 'level', target: 10 },
  { id: 'xp-1000', type: 'xp', target: 1000 },
  { id: 'xp-5000', type: 'xp', target: 5000 },
  { id: 'early-bird', type: 'morning_workouts', target: 5 },
];

export const FACT_FOR_TYPE = {
  workout_count: 'finishedWorkouts',
  streak: 'streak',
  calories_burned: 'bestCalories',
  level: 'level',
  xp: 'xp',
};

// The badges the app has a way to earn: the first finished workout, the three hiking badges, and the race and journey finishes.
// (The other badges in the app's list have never been earned by anything, and still are not.)
export const BADGES = [
  { id: 'badge-1', fact: 'finishedWorkouts', atLeast: 1 },
  { id: 'badge-11', fact: 'hikeCount', atLeast: 1 },
  { id: 'badge-12', fact: 'strenuousHikes', atLeast: 1 },
  { id: 'badge-13', fact: 'hikeMiles', atLeast: 10 },
  { id: 'badge-14', fact: 'raceFinishes', atLeast: 1 },
  { id: 'badge-15', fact: 'journeyFinishes', atLeast: 1 },
];

/** A hike rated Strenuous or harder on the app's difficulty scale (lib/hikeDifficulty.js): its tier name, or the XP multiplier it was claimed with. */
export const STRENUOUS_TIERS = ['Strenuous', 'Very Strenuous'];
export const STRENUOUS_MULTIPLIER = 2.2;
export const MILES_PER_KM = 0.621371;

const reached = (facts, name, target) => {
  const value = facts && facts[name];
  return typeof value === 'number' && Number.isFinite(value) && value >= target;
};

/**
 * Which achievements and badges the facts have earned that are not already unlocked.
 * @param {object} args
 *   facts                 { finishedWorkouts, bestCalories, streak, level, xp, hikeCount, hikeMiles, strenuousHikes, raceFinishes, journeyFinishes }
 *   unlockedAchievements  ids already unlocked
 *   unlockedBadges        ids already unlocked
 * @returns {{ achievements: string[], badges: string[] }} the ids newly earned, in list order
 */
export function evaluateUnlocks({ facts, unlockedAchievements = [], unlockedBadges = [] } = {}) {
  const haveAchievement = new Set(unlockedAchievements);
  const haveBadge = new Set(unlockedBadges);
  const achievements = ACHIEVEMENTS
    .filter((a) => !haveAchievement.has(a.id))
    .filter((a) => FACT_FOR_TYPE[a.type] && reached(facts, FACT_FOR_TYPE[a.type], a.target))
    .map((a) => a.id);
  const badges = BADGES
    .filter((b) => !haveBadge.has(b.id))
    .filter((b) => reached(facts, b.fact, b.atLeast))
    .map((b) => b.id);
  return { achievements, badges };
}
