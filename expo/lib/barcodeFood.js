// lib/barcodeFood.js
//
// A scanned barcode turned into a food the app can show and log. The Calorie API answers a barcode with
// { found, barcode, product: { name, brand }, nutrition_per_100g: { energy_kcal, protein_g, carbohydrates_g, fat_g, fiber_g,
// sugars_g, saturated_fat_g, sodium_g, salt_g, ... } }, all per 100 g. A figure the product does not list is left out (not turned
// into a 0), so it is not shown as a real zero in the diary, and the rating (lib/foodRating.js) can tell "not listed" from "none".
//
// The rating is why this is not just inline in the scan screen: a scanned food used to carry no rating, so a meal made of one
// showed no stars at all. Sodium is in mg in the app; the API gives it in grams (sodium_g), or only as salt (salt_g), which is
// 2.5 times the sodium. Pure function.

import { ratingFor } from './foodRating';

// A listed number, or undefined when the figure is missing, empty or not a number.
const listed = (value) => {
  if (value == null || value === '' || typeof value === 'boolean') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

const tenth = (value) => (value === undefined ? undefined : Math.round(value * 10) / 10);

/** Sodium in mg from what the product lists: sodium_g, or else salt_g divided by 2.5. undefined when it lists neither. */
export function sodiumMg(nutrition) {
  const sodiumG = listed(nutrition.sodium_g);
  if (sodiumG !== undefined) return sodiumG * 1000;
  const saltG = listed(nutrition.salt_g);
  return saltG === undefined ? undefined : (saltG * 1000) / 2.5;
}

/** The scanned food for a barcode answer, per 100 g, with its rating. `barcode` is what was scanned, used when the answer has none. */
export function foodFromBarcode(data, barcode) {
  const n = data.nutrition_per_100g || {};
  const energy = listed(n.energy_kcal);
  const protein = listed(n.protein_g);
  const carbs = listed(n.carbohydrates_g);
  const fat = listed(n.fat_g);
  const fiber = tenth(listed(n.fiber_g));
  const sugar = tenth(listed(n.sugars_g));
  const saturatedFat = tenth(listed(n.saturated_fat_g));
  const sodium = tenth(sodiumMg(n));
  const rating = ratingFor({ calories: energy, protein, carbs, fat, fiber, sugar, saturatedFat, sodium });

  return {
    name: data.product?.name || 'Unknown Product',
    brand: data.product?.brand || undefined,
    calories: Math.round(energy || 0),
    protein: tenth(protein || 0),
    carbs: tenth(carbs || 0),
    fat: tenth(fat || 0),
    fiber,
    sugar,
    sodium,
    // The numbers above are per 100 g, so that is what the serving is called.
    servingSize: '100g',
    barcode: data.barcode || barcode,
    ...(rating ? { nutritionalScore: rating } : {}),
  };
}
