// lib/usdaFill.js
//
// Fills in a figure a Calorie API record leaves out (sodium, saturated fat, fibre) from USDA FoodData Central, only
// when that is safe. The records come in many shapes: an ordinary food lists most figures and the odd one is missing,
// and the missing one cannot be worked out from the food's own numbers (lib/completeFigures.js does the cases that can).
//
// What probes of the real services showed, and so the rules below:
//  - Looking a food up by name finds foods that are NOT the same food: "Spaghetti" found spinach spaghetti, with three
//    times the fibre. So a USDA food is only used when its calories, protein, fat and carbs agree with the record's.
//  - Agreeing on those is still not enough to be the same food. So one agreeing food is never used: at least
//    MIN_AGREEING must agree, and every one of them must leave the food with the same rating whichever figure it gives
//    (orange juice's sodium is 0 to 10 mg in all of them; peanut butter's fibre is 5 to 8 g, which are different
//    ratings, so it is left unfilled). The rating only cares about the steps in lib/foodRating.js, so a figure
//    that every agreeing food puts on the same side of the same steps does not depend on which of them is the right one.
//  - What is filled in is the middle value of the agreeing foods. It is an estimate from similar foods, not that
//    food's own measurement, so the app marks it (see `estimated` in services/calorieApiService.js).

import { amount, scoreFood } from './foodRating';

export const MIN_AGREEING = 3;

// A food's figure as it is called on the rating (lib/foodRating.js) and on a USDA food (functions/src/usdaFoods.js).
const FIGURES = { sodium: 'sodium', saturatedFat: 'satFat', fiber: 'fibre' };

// Within `floor`, or within `share` of `of` (a figure that is never below 0), whichever is more.
const within = (value, of, floor, share) => Math.abs(value - of) <= Math.max(floor, share * of);

/**
 * Whether a USDA food looks like the same food as a record: calories within 15% (or 20 kcal), and protein, fat and
 * carbohydrate each within 20% (or 3 g). `food` is a record's figures as the rating takes them; both need all four.
 */
export function agrees(food, usda) {
  const record = { kcal: amount(food?.calories), protein: amount(food?.protein), fat: amount(food?.fat), carbs: amount(food?.carbs) };
  const other = { kcal: amount(usda?.kcal), protein: amount(usda?.protein), fat: amount(usda?.fat), carbs: amount(usda?.carbs) };
  if (Object.values(record).some((v) => v === undefined) || Object.values(other).some((v) => v === undefined)) return false;
  return (
    within(other.kcal, record.kcal, 20, 0.15) &&
    within(other.protein, record.protein, 3, 0.2) &&
    within(other.fat, record.fat, 3, 0.2) &&
    within(other.carbs, record.carbs, 3, 0.2)
  );
}

const middle = (sorted) => {
  const m = sorted.length >> 1;
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
};

// What the rating makes of a food: its score and its grade. The grade as well as the score, because a drink that is nothing
// but sugar is held at D when it has under 0.3 g of fibre, and 0.1 g of fibre and 0.5 g of fibre earn the same points.
const outcomeOf = (food) => {
  const { score, grade } = scoreFood(food);
  return `${score}|${grade}`;
};

/**
 * The figures to fill in. `food` is the record's figures as the rating takes them (calories, protein, carbs, fat,
 * fiber, saturatedFat, sugar, sodium, alcohol), `lacking` the names of the ones it does not list (any of 'sodium',
 * 'saturatedFat', 'fiber'), `foods` the USDA foods found for it (functions/src/usdaFoods.js). Returns an object with
 * the figures that are safe to fill in, which is often none: { sodium: 3 }.
 */
export function usdaFigures({ food, foods, lacking }) {
  const wanted = (Array.isArray(lacking) ? lacking : []).filter((name) => FIGURES[name]);
  if (!food || !Array.isArray(foods)) return {};

  const same = foods.filter((usda) => agrees(food, usda));
  const values = {};
  for (const name of wanted) {
    const list = same.map((usda) => amount(usda[FIGURES[name]])).filter((v) => v !== undefined).sort((a, b) => a - b);
    if (list.length >= MIN_AGREEING) values[name] = list;
  }

  // Each figure is tried with the others at their middle values, so a food is judged with every figure that is going in.
  const middles = Object.fromEntries(Object.entries(values).map(([name, list]) => [name, middle(list)]));
  const filled = {};
  for (const [name, list] of Object.entries(values)) {
    const outcomes = new Set(list.map((value) => outcomeOf({ ...food, ...middles, [name]: value })));
    if (outcomes.size === 1) filled[name] = middles[name];
  }
  return filled;
}
