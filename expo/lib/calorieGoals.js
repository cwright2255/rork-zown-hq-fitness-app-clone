// lib/calorieGoals.js
//
// The app has two calorie goals, and they mean opposite things:
//
//   EAT goal  - how many calories to take in each day. It lives in store/nutritionStore.js (dailyGoals.calories),
//               and the Nutrition screen, the food diary and the Coach's plans all use it.
//   BURN goal - how many calories to burn through activity each day. It lives on the user (user.dailyCalorieGoal),
//               is set from the home Calories card ("How many calories do you want to burn per day?"), and the
//               card's streak counts the days it was met.
//
// Before this file the Recipes screen read the BURN goal as if it were the EAT goal, so someone who aimed to burn
// 500 a day was shown recipes sized for a 500-calorie day (125-175 calories a meal). Anything that needs a goal
// asks for it by name here, so the two cannot be swapped again.

function positive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/**
 * The calories the person is meant to EAT in a day, or null when no target has been worked out for them yet.
 * `nutrition` is the nutrition store's state ({ dailyGoals, dailyGoalsUpdatedAt }).
 *
 * The store starts every account at a placeholder of 2000. dailyGoalsUpdatedAt stays null until a real target
 * is set (the personalised one from the nutrition advice, or one the Coach sets), so a placeholder is never
 * mistaken for the person's own goal.
 */
export function eatGoal(nutrition) {
  if (!nutrition || !nutrition.dailyGoalsUpdatedAt) return null;
  return positive(nutrition.dailyGoals && nutrition.dailyGoals.calories);
}

/** The calories the person wants to BURN in a day, or null when they have not set one. `user` is the user record. */
export function burnGoal(user) {
  return positive(user && user.dailyCalorieGoal);
}

/**
 * Calories eaten on one calendar day (YYYY-MM-DD), added up from the food diary (nutritionStore.meals). A food
 * with no usable calorie figure counts as 0 instead of turning the whole day into NaN.
 */
export function eatenOn(meals, dateKey) {
  if (!Array.isArray(meals) || !dateKey) return 0;
  let total = 0;
  for (const meal of meals) {
    if (!meal || meal.date !== dateKey || !Array.isArray(meal.foods)) continue;
    for (const food of meal.foods) {
      const kcal = Number(food && food.calories);
      if (Number.isFinite(kcal) && kcal > 0) total += kcal;
    }
  }
  return Math.round(total);
}
