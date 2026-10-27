// lib/completeFigures.js
//
// Fills in a figure a food does not list, but only when the food's own numbers settle it. A figure that is not listed is
// otherwise "unknown": it is left out of the nutrients on the food's page and in the day's totals, and the rating holds the food's
// grade back for it (lib/foodRating.js). Most unlisted figures cannot be told from the rest, and are left unknown. These can:
//
//   - Saturated fat is part of the fat, so a food with no fat (0.1 g or less per 100 g, the tenth of a gram the figures are
//     listed to) has no saturated fat.
//   - Sugars are part of the carbohydrate, so a food with no carbohydrate has no sugars. (Fibre is not done the same way: whether
//     the carbohydrate figure includes the fibre depends on the country the label comes from.)
//   - Sodium: a food that is 98 g or more fat in 100 g is an oil or a pure fat (olive oil, lard, shortening, ghee). The part that
//     is not fat is at most 2 g, there is no water in it for salt to be in, and a salted fat (butter, margarine) is 80 to 83 g fat
//     with the rest water. Such a food has no sodium to speak of (olive oil: 2 mg per 100 g, a tenth of the first point on the
//     rating's scale), and the Calorie API's records of oils list none. It is taken as 0.
//
// A figure the food does list is never changed, a 0 included. Takes and returns per 100 g, with sodium in mg and the rest in g.
// Inputs may be anything (a missing figure is null, undefined or empty); the result has a number or undefined for each.

import { amount } from './foodRating';

// The figures are listed to a tenth of a gram, so 0.1 g or less is none.
const NEGLIGIBLE_G = 0.1;
const PURE_FAT_G = 98;

export function completeFigures({ carbs, fat, sugar, saturatedFat, sodium } = {}) {
  const totalCarbs = amount(carbs);
  const totalFat = amount(fat);
  let sugars = amount(sugar);
  let saturated = amount(saturatedFat);
  let salt = amount(sodium);

  // (A total that is not listed is undefined, and undefined is neither at most nor at least any number.)
  if (sugars === undefined && totalCarbs <= NEGLIGIBLE_G) sugars = 0;
  if (saturated === undefined && totalFat <= NEGLIGIBLE_G) saturated = 0;
  if (salt === undefined && totalFat >= PURE_FAT_G) salt = 0;

  return { sugar: sugars, saturatedFat: saturated, sodium: salt };
}
