// lib/recipeScale.js
//
// A recipe for a different number of servings, and in US or metric measures.
//
//   displayIngredient(ing, { factor: 1.5, system: 'metric' })  ->  "360 ml milk"
//
// An ingredient is either { name, amount, unit } (what the recipe import makes)
// or plain text ("1 1/2 cups flour"). Plain text is read from the front: an
// amount (1, 1/2, 1 1/2, 1½, 2-3, 1 to 2), then a unit if the next word is one
// the grocery list knows. Anything else about it (what is in brackets, "chopped")
// is left alone, and a line with no amount at the front ("salt, to taste") is
// shown as written.
//
// Numbers are worked out exactly and rounded once, at the end, the way a cook
// would measure: cups, spoons and ounces to the nearest 1/8, 1/4, 1/3 or 1/2,
// grams and millilitres to a figure you can read off a scale.

import { parseQuantity, recognizedUnit, formatAmount, unitLabel } from './groceryList';

export const UNIT_SYSTEMS = ['original', 'us', 'metric'];
export const MAX_SERVINGS = 99;

// A cup is 240 ml, a tablespoon 15 ml and a teaspoon 5 ml (the sizes food labels use).
const VOLUME = { tsp: 5, tbsp: 15, cup: 240, ml: 1, l: 1000 };
const MASS = { oz: 28.3495, lb: 453.592, g: 1, kg: 1000 };
// From 15 1/2 oz up, weights are shown in pounds (so 450 g is "1 lb", not "16 oz").
const LB_FROM_G = 15.5 * MASS.oz;
const US_UNITS = ['tsp', 'tbsp', 'cup', 'oz', 'lb'];
const METRIC_UNITS = ['ml', 'l', 'g', 'kg'];

/** 'us' or 'metric' for a unit that has a measuring system; null for "clove", "can" and the like. */
export function systemOfUnit(unit) {
  if (US_UNITS.includes(unit)) return 'us';
  if (METRIC_UNITS.includes(unit)) return 'metric';
  return null;
}

// ---- servings ------------------------------------------------------------

/** A number of servings as a whole number of at least 1: 4, "4", "4 servings", "4-6" (the first). Null when there is none. */
export function parseServings(value) {
  let n = null;
  if (typeof value === 'number') n = value;
  else if (typeof value === 'string') {
    const m = /\d+(?:\.\d+)?/.exec(value);
    if (m) n = Number(m[0]);
  }
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(1, Math.round(n));
}

/** A servings count kept between 1 and 99 and rounded to a whole number. */
export function clampServings(n) {
  return Math.min(MAX_SERVINGS, Math.max(1, Math.round(n)));
}

/** How much to multiply a recipe by to go from `base` servings to `target`; 1 when either is not a number. */
export function scaleFactor(base, target) {
  const b = parseServings(base);
  const t = parseServings(target);
  return b && t ? t / b : 1;
}

function validFactor(f) {
  return Number.isFinite(f) && f > 0 ? f : 1;
}

// ---- reading an ingredient -----------------------------------------------

const GLYPHS = '\\u00BC\\u00BD\\u00BE\\u2153\\u2154\\u215B';
const DASHES = '\\u2013\\u2014-';
const QTY = `(?:\\d+\\s*[${GLYPHS}]|[${GLYPHS}]|\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d*\\.\\d+|\\d+)`;
// An amount at the front of a line, alone or as a range, that is followed by a space, a bracket or a letter.
const LEADING = new RegExp(`^\\s*(${QTY}(?:\\s*[${DASHES}]\\s*${QTY}|\\s+to\\s+${QTY})?)(?=$|[\\s(A-Za-z])`);
const RANGE = new RegExp(`^(.+?)\\s*(?:[${DASHES}]|\\bto\\b)\\s*(.+)$`);

// An amount as { lo, hi } ("2" is 2 to 2); null for no amount, zero, or something that is not an amount.
function parseRange(value) {
  const single = parseQuantity(value);
  if (single) return { lo: single, hi: single };
  const m = typeof value === 'string' ? RANGE.exec(value) : null;
  const lo = m ? parseQuantity(m[1]) : null;
  const hi = m ? parseQuantity(m[2]) : null;
  // (null is not above 0, so a side that is not an amount fails here)
  return lo > 0 && lo <= hi ? { lo, hi } : null;
}

// { lo, hi, unit, name } for an ingredient that starts with an amount, else null.
// An object ingredient can have a unit the app has not heard of ("bunch"): that word is
// kept as it is and the number is only scaled.
function read(ing) {
  if (typeof ing === 'string') {
    const m = LEADING.exec(ing);
    const range = m ? parseRange(m[1]) : null;
    if (!range) return null;
    let rest = ing.slice(m[0].length);
    let unit = '';
    const u = /^\s*([A-Za-z]+)\.?/.exec(rest);
    if (u && recognizedUnit(u[1])) {
      unit = recognizedUnit(u[1]);
      rest = rest.slice(u[0].length);
    }
    return { ...range, unit, name: rest.trim() };
  }
  if (!ing) return null;
  const range = parseRange(ing.amount);
  if (!range) return null;
  const raw = typeof ing.unit === 'string' ? ing.unit.trim() : '';
  return { ...range, unit: recognizedUnit(raw) || raw, name: String(ing.name || '').trim() };
}

/** The line as it was saved: "1 cup flour". */
export function ingredientAsWritten(ing) {
  if (typeof ing === 'string') return ing;
  if (!ing) return '';
  const amount = ing.amount ? `${ing.amount} ` : '';
  const unit = ing.unit ? `${ing.unit} ` : '';
  return `${amount}${unit}${ing.name || ''}`.trim();
}

// ---- rounding and converting ---------------------------------------------

const SMALL = [1 / 8, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 7 / 8, 1];
const MID = [0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1];
const nearest = (list, x) => list.reduce((best, c) => (Math.abs(c - x) < Math.abs(best - x) ? c : best));

/** An amount to the nearest measure a cook can make: under 1 to eighths and thirds, up to 4 to quarters and thirds, then halves. */
export function snapKitchen(v) {
  if (!(v > 0)) return 0;
  if (v >= 4) return Math.round(v * 2) / 2;
  if (v < 1) return nearest(SMALL, v);
  const whole = Math.floor(v);
  return whole + nearest(MID, v - whole);
}

function roundFor(unit, v) {
  if (unit === 'ml') return v < 10 ? Math.max(1, Math.round(v)) : Math.round(v / 5) * 5;
  if (unit === 'g') {
    if (v < 10) return Math.max(0.5, Math.round(v * 2) / 2);
    return v < 100 ? Math.round(v) : Math.round(v / 5) * 5;
  }
  if (unit === 'kg' || unit === 'l') return Math.max(0.05, Math.round(v * 20) / 20);
  return snapKitchen(v);
}

// Metric amounts are written as decimals ("1.5 kg"), not fractions.
const decimal = (n) => String(n);

// lo..hi in `unit` as the same amount in the other system; the new unit is picked by how big hi is.
function convert(lo, hi, unit, to) {
  const table = VOLUME[unit] !== undefined ? VOLUME : MASS;
  const a = lo * table[unit];
  const b = hi * table[unit];
  let target;
  if (table === VOLUME) {
    if (to === 'metric') target = b >= 1000 ? 'l' : 'ml';
    else target = b < 15 ? 'tsp' : b < 60 ? 'tbsp' : 'cup';
  } else if (to === 'metric') target = b >= 1000 ? 'kg' : 'g';
  else target = b < LB_FROM_G ? 'oz' : 'lb';
  return { lo: a / table[target], hi: b / table[target], unit: target };
}

function render(r, lo, hi, unit) {
  const fmt = systemOfUnit(unit) === 'metric' ? decimal : formatAmount;
  const qty = lo === hi ? fmt(lo) : `${fmt(lo)}-${fmt(hi)}`;
  const label = recognizedUnit(unit) ? unitLabel(unit, hi) : unit;
  return [qty, label, r.name].filter(Boolean).join(' ');
}

/**
 * One ingredient line as text for `factor` times the recipe, in the units of
 * `system` ('original' keeps the recipe's own). Unchanged (and not reworded)
 * when there is nothing to scale or convert.
 */
export function displayIngredient(ing, { factor, system } = {}) {
  const f = validFactor(factor);
  const r = read(ing);
  if (!r) return ingredientAsWritten(ing);
  let { lo, hi, unit } = r;
  lo *= f;
  hi *= f;
  let changed = f !== 1;
  const from = systemOfUnit(unit);
  if (from && (system === 'us' || system === 'metric') && from !== system) {
    ({ lo, hi, unit } = convert(lo, hi, unit, system));
    changed = true;
  }
  if (!changed) return ingredientAsWritten(ing);
  return render(r, roundFor(unit, lo), roundFor(unit, hi), unit);
}

/** Whether some ingredient has a unit that can be shown in the other system. */
export function canConvert(ingredients) {
  return (Array.isArray(ingredients) ? ingredients : []).some((ing) => {
    const r = read(ing);
    return !!r && systemOfUnit(r.unit) !== null;
  });
}

// ---- scaling a recipe for the grocery list --------------------------------

const round3 = (n) => Math.round(n * 1000) / 1000;

/** The ingredient for `factor` times the recipe, in the same shape it came in (text stays text, { name, amount, unit } stays that). */
export function scaleIngredient(ing, factor) {
  const f = validFactor(factor);
  if (f === 1) return ing;
  if (typeof ing === 'string') return displayIngredient(ing, { factor: f });
  const r = read(ing);
  if (!r) return ing;
  const lo = round3(r.lo * f);
  const hi = round3(r.hi * f);
  return { ...ing, amount: lo === hi ? lo : `${lo}-${hi}` };
}

/** The recipe with its ingredients for `factor` times as many servings. */
export function scaleRecipe(recipe, factor) {
  if (!recipe || !Array.isArray(recipe.ingredients) || validFactor(factor) === 1) return recipe;
  return { ...recipe, ingredients: recipe.ingredients.map((ing) => scaleIngredient(ing, factor)) };
}
