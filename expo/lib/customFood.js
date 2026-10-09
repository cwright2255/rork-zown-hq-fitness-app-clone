// lib/customFood.js
//
// Foods the person makes up themselves: a custom food saved to "My Foods", and
// a quick add (just calories, no food). Both end up as the same shape the
// diary already logs, so they scale, edit and total like any other food.

export const MAX_NAME = 60;
export const MAX_SERVING = 40;
export const MAX_CUSTOM_FOODS = 200;

const LIMITS = { calories: 10000, grams: 2000, sodium: 50000 };
const GROUPED = /^\d{1,3}(,\d{3})+(\.\d+)?$/;
const PLAIN = /^(\d+\.?\d*|\.\d+)$/;

/** A typed amount as a number (0 or more), or null when it is not one. "1,200" is 1200; "1,5" is not a number. */
export function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (GROUPED.test(t)) return Number(t.replace(/,/g, ''));
  if (PLAIN.test(t)) return Number(t);
  return null;
}

const isBlank = (v) => v == null || (typeof v === 'string' && v.trim() === '');
const whole = (n) => Math.round(n);
const tenth = (n) => Math.round(n * 10) / 10;

// Reads one typed field. Returns { value } (undefined when left blank and optional) or { error }.
function read(raw, { required = false, max, round }) {
  if (isBlank(raw)) return required ? { error: 'Required' } : { value: undefined };
  const n = parseAmount(raw);
  if (n === null) return { error: 'Enter a number' };
  if (n > max) return { error: 'That is too high' };
  return { value: round(n) };
}

function newId(prefix, now, random) {
  return `${prefix}-${now.toString(36)}${Math.floor(random() * 36 ** 3).toString(36)}`;
}

/**
 * A custom food from what was typed in the form. Name and calories are
 * required; protein, carbs and fat default to 0; fiber, sugar and sodium are
 * left off when blank (so the diary can tell "not listed" from 0).
 * Returns { ok: true, food } or { ok: false, errors: { field: message } }.
 */
export function buildCustomFood(fields = {}, { id, now = Date.now(), random = Math.random } = {}) {
  const errors = {};
  const name = String(fields.name == null ? '' : fields.name).trim().replace(/\s+/g, ' ');
  if (!name) errors.name = 'Enter a name';
  else if (name.length > MAX_NAME) errors.name = `Keep the name to ${MAX_NAME} characters or fewer`;

  const serving = String(fields.servingSize == null ? '' : fields.servingSize).trim().replace(/\s+/g, ' ');
  if (serving.length > MAX_SERVING) errors.servingSize = `Keep this to ${MAX_SERVING} characters or fewer`;

  const out = {};
  const spec = {
    calories: { required: true, max: LIMITS.calories, round: whole },
    protein: { max: LIMITS.grams, round: tenth },
    carbs: { max: LIMITS.grams, round: tenth },
    fat: { max: LIMITS.grams, round: tenth },
    fiber: { max: LIMITS.grams, round: tenth },
    sugar: { max: LIMITS.grams, round: tenth },
    sodium: { max: LIMITS.sodium, round: tenth },
  };
  Object.keys(spec).forEach((k) => {
    const r = read(fields[k], spec[k]);
    if (r.error) errors[k] = r.error;
    else out[k] = r.value;
  });

  if (Object.keys(errors).length) return { ok: false, errors };

  const food = {
    id: id || newId('custom', now, random),
    name,
    servingSize: serving || '1 serving',
    calories: out.calories,
    protein: out.protein === undefined ? 0 : out.protein,
    carbs: out.carbs === undefined ? 0 : out.carbs,
    fat: out.fat === undefined ? 0 : out.fat,
    custom: true,
  };
  ['fiber', 'sugar', 'sodium'].forEach((k) => {
    if (out[k] !== undefined) food[k] = out[k];
  });
  return { ok: true, food };
}

/**
 * A quick add: calories (at least 1) with optional macros and an optional
 * label. It is flagged `quickAdd` so the diary does not file it under recent
 * foods or give XP for it.
 */
export function buildQuickAdd(fields = {}) {
  const errors = {};
  const label = String(fields.label == null ? '' : fields.label).trim().replace(/\s+/g, ' ');
  if (label.length > MAX_NAME) errors.label = `Keep the name to ${MAX_NAME} characters or fewer`;

  const cals = read(fields.calories, { required: true, max: LIMITS.calories, round: whole });
  if (cals.error) errors.calories = cals.error;
  else if (cals.value < 1) errors.calories = 'Enter at least 1 calorie';

  const macros = {};
  ['protein', 'carbs', 'fat'].forEach((k) => {
    const r = read(fields[k], { max: LIMITS.grams, round: tenth });
    if (r.error) errors[k] = r.error;
    else macros[k] = r.value === undefined ? 0 : r.value;
  });

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    food: {
      id: 'quick-add',
      name: label || 'Quick add',
      servingSize: '1 serving',
      calories: cals.value,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      quickAdd: true,
    },
  };
}

/** Whether a food's name contains what was typed (ignoring case and extra spaces). */
export function matchesFoodQuery(food, query) {
  const q = String(query == null ? '' : query).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return false;
  return String((food && food.name) || '').toLowerCase().replace(/\s+/g, ' ').includes(q);
}

/** The form fields (all text) to start an edit of a saved custom food. */
export function customFoodToFields(food) {
  const s = (v) => (v === undefined || v === null ? '' : String(v));
  const f = food || {};
  return {
    name: s(f.name),
    servingSize: f.servingSize === '1 serving' ? '' : s(f.servingSize),
    calories: s(f.calories),
    protein: s(f.protein),
    carbs: s(f.carbs),
    fat: s(f.fat),
    fiber: s(f.fiber),
    sugar: s(f.sugar),
    sodium: s(f.sodium),
  };
}
