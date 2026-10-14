// Rates a food from A (best) to E from its nutrition per 100 g. The app shows A-E as 5-1 stars.
//
// The method is Nutri-Score, the A-E label on food packs across Europe: energy, sugars, saturated fat and salt
// count against a food, fibre and protein count for it. The point scales are the published ones. Sugars use the
// stricter scale from the 2022 update, and salt, fibre and protein follow that update's rules (salt in steps of
// 0.2 g, fibre starting at the 3 g "source of fibre" level, protein in steps of 2.4 g). Class cut-offs are the
// original ones. Source: Santé publique France's Nutri-Score algorithm and the Nutri-Score Scientific
// Committee's 2022 update report.
//
// Two parts of Nutri-Score need information the food data does not carry (the share of fruit and vegetables,
// and whether a food is a drink, a fat or a cheese). This file makes up for the two that matter most:
//   - plain fruit and vegetables get the fruit-and-vegetable credit by their nutrient profile: low in energy,
//     fat and salt, with some fibre. Without it an apple would score like a biscuit with a little fibre.
//   - a sugary drink or juice (plenty of sugar, no fibre, no protein) is held at 2 stars or below, because the
//     general scale is too kind to a drink that is only sugar and water.
//
// Alcohol is outside Nutri-Score, which leaves alcoholic drinks unrated. A drink is energy (7 kcal a gram) with
// little else in it; alcohol slows the body's burning of fat, does not fill you up, and lowers folate uptake
// and sleep quality; and no amount is risk-free (Harvard's Nutrition Source and Healthline on alcohol; the
// 2020-2025 Dietary Guidelines allow up to 1 drink a day for women and 2 for men, or none, and the 2025-2030
// ones say only to drink less). So beer, cider and wine (3 g of
// alcohol per 100 g or more) are held at 2 stars or below, and spirits and fortified wine (15 g or more) at 1
// star. The amount comes from the food data when it lists alcohol. When it does not, it is worked out from the
// energy that the protein, carbohydrate and fat do not account for.
//
// A rating is only as good as the data behind it. A food missing a figure it is judged on cannot earn the top
// grade: one missing figure holds it to B or below, two or more to C or below. A food with no energy figure at
// all is not rated.

// Points a value earns: how many of the steps it is above.
const pointsFor = (value, steps) => steps.filter((step) => value > step).length;

// Against a food. Energy in kcal, sugars and saturated fat in g, sodium in mg.
const ENERGY_KCAL = [80, 160, 240, 320, 400, 480, 560, 640, 720, 800];
const SUGARS_G = [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51];
const SATURATED_FAT_G = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
// 0.2 g of salt per point, and salt is 2.5 times the sodium, so 80 mg of sodium per point.
const SODIUM_MG = [80, 160, 240, 320, 400, 480, 560, 640, 720, 800, 880, 960, 1040, 1120, 1200, 1280, 1360, 1440, 1520, 1600];

// For a food, in g.
const FIBRE_G = [3, 4.1, 5.2, 6.3, 7.4];
const PROTEIN_G = [2.4, 4.8, 7.2, 9.6, 12, 14, 17];

// Protein only counts while a food is not already heavily marked down.
const PROTEIN_COUNTS_BELOW = 11;
const PRODUCE_POINTS = 5;

// Upper score for each grade A-D; anything above the last is E.
const GRADE_LIMITS = [-1, 2, 10, 18];
const GRADES = ['A', 'B', 'C', 'D', 'E'];

// A food with fibre of at least this much has some; under it, none to speak of (a juice or a soft drink).
const SOME_FIBRE = 0.3;

// Plain fruit and vegetables, told by what is in them.
const PRODUCE = { maxEnergy: 110, maxFat: 1, maxSaturatedFat: 0.5, maxSodium: 100, maxSugar: 16, maxProtein: 6 };

// Sugar and nothing else: at least this much sugar, no fibre, and under this much protein.
const SUGAR_ONLY = { minSugar: 5, maxProtein: 2 };

// Alcohol in g per 100 g: beer, cider and wine are from drinkG; spirits and fortified wine from spiritG.
// A gram of alcohol is 7 kcal. Nothing sold as a drink is much over 40 g per 100 g (a 100-proof spirit), so
// an amount worked out above maxImpliedG is a food whose macros are missing, not alcohol.
const ALCOHOL = { drinkG: 3, spiritG: 15, kcalPerG: 7, maxImpliedG: 45 };

// Energy that the macros do not account for counts as alcohol only when it is at least this share of the
// food's energy (so rounding in the data does not look like a drink) and comes to at least the beer line
// (which also keeps out the acetic acid in vinegar).
const UNEXPLAINED_SHARE = 0.15;

// A listed amount, or undefined when the figure is missing or not a usable number.
function amount(value) {
  if (value == null || value === '' || typeof value === 'boolean') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

// Alcohol in g per 100 g worked out from the energy that protein, carbohydrate (4 kcal a gram each) and fat
// (9) leave over. Only when all four figures are there, the gap is plain, and it comes to at least the
// beer line; otherwise undefined.
function impliedAlcohol(energy, protein, carbs, fat) {
  // A missing figure makes this NaN, and NaN passes none of the checks below.
  const unexplained = energy - (4 * protein + 4 * carbs + 9 * fat);
  if (unexplained < UNEXPLAINED_SHARE * energy) return undefined;
  const grams = unexplained / ALCOHOL.kcalPerG;
  return grams >= ALCOHOL.drinkG && grams <= ALCOHOL.maxImpliedG ? grams : undefined;
}

// The score and everything behind it:
// { grade, score, negative, positive, missing, produce, sugarOnly, alcohol }.
// `grade` is null when there is no energy figure to rate from. `alcohol` is g per 100 g, listed or worked out.
export function scoreFood(food = {}) {
  const energy = amount(food.calories);
  const carbs = amount(food.carbs);
  const fat = amount(food.fat);
  const sodium = amount(food.sodium);
  let sugar = amount(food.sugar);
  let saturatedFat = amount(food.saturatedFat);
  // A food cannot hold more sugar than carbohydrate, or more saturated fat than fat. When the total is
  // already under the first step, the missing figure would earn no points anyway.
  if (sugar === undefined && carbs !== undefined && carbs <= SUGARS_G[0]) sugar = 0;
  if (saturatedFat === undefined && fat !== undefined && fat <= SATURATED_FAT_G[0]) saturatedFat = 0;

  const fibre = amount(food.fiber) ?? 0;
  const listedProtein = amount(food.protein);
  const protein = listedProtein ?? 0;
  const alcohol = amount(food.alcohol) ?? impliedAlcohol(energy, listedProtein, carbs, fat) ?? 0;
  const missing = [energy, sugar, saturatedFat, sodium].filter((value) => value === undefined).length;

  const negative =
    pointsFor(energy ?? 0, ENERGY_KCAL) +
    pointsFor(sugar ?? 0, SUGARS_G) +
    pointsFor(saturatedFat ?? 0, SATURATED_FAT_G) +
    pointsFor(sodium ?? 0, SODIUM_MG);

  const produce =
    missing === 0 &&
    energy <= PRODUCE.maxEnergy &&
    saturatedFat <= PRODUCE.maxSaturatedFat &&
    sodium <= PRODUCE.maxSodium &&
    sugar <= PRODUCE.maxSugar &&
    protein <= PRODUCE.maxProtein &&
    fibre >= SOME_FIBRE &&
    (fat === undefined || fat <= PRODUCE.maxFat);

  const positive =
    pointsFor(fibre, FIBRE_G) +
    (negative < PROTEIN_COUNTS_BELOW ? pointsFor(protein, PROTEIN_G) : 0) +
    (produce ? PRODUCE_POINTS : 0);

  const score = negative - positive;
  if (energy === undefined) return { grade: null, score, negative, positive, missing, produce, sugarOnly: false, alcohol };

  let level = GRADE_LIMITS.findIndex((limit) => score <= limit);
  if (level === -1) level = GRADES.length - 1;

  // (A missing sugar figure is never at least minSugar, so it never makes a food sugar-only.)
  const sugarOnly = sugar >= SUGAR_ONLY.minSugar && fibre < SOME_FIBRE && protein < SUGAR_ONLY.maxProtein;
  if (sugarOnly) level = Math.max(level, GRADES.indexOf('D'));

  if (alcohol >= ALCOHOL.spiritG) level = GRADES.length - 1;
  else if (alcohol >= ALCOHOL.drinkG) level = Math.max(level, GRADES.indexOf('D'));

  // Nothing missing: any grade. One figure missing: B at best. Two or more: C at best.
  level = Math.max(level, Math.min(missing, 2));

  return { grade: GRADES[level], score, negative, positive, missing, produce, sugarOnly, alcohol };
}

// The grade alone: 'A' to 'E', or null when there is no energy figure.
export const rateFood = (food) => scoreFood(food).grade;
