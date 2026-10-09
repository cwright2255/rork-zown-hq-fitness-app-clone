// lib/groceryList.js
//
// The grocery list: turning saved recipes into shopping lines, merging a new
// recipe into a list that already has items on it, and showing a line.
//
// A line is { id, ingredient, amount (number or null), unit, recipes (names),
// recipeIds, checked, category }. Lines for the same ingredient in the same
// unit are added together; the same ingredient in a different unit stays its
// own line (1 cup and 2 tbsp can not be added without guessing).

const UNIT_ALIASES = {
  c: 'cup', cup: 'cup', cups: 'cup',
  tbsp: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  tsp: 'tsp', tsps: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  g: 'g', gm: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml',
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  clove: 'clove', cloves: 'clove',
  can: 'can', cans: 'can',
  slice: 'slice', slices: 'slice',
  pinch: 'pinch', pinches: 'pinch',
};
// Units that read the same for one or many ("2 tbsp", not "2 tbsps").
const SHORT_UNITS = ['tbsp', 'tsp', 'oz', 'lb', 'g', 'kg', 'ml', 'l'];

const FRACTIONS = {
  '¼': 0.25, '½': 0.5, '¾': 0.75,
  '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125,
};

/** A quantity as a number: 2, "2", "1.5", "1/2", "1 1/2", "1½". Null when blank or not a quantity. */
export function parseQuantity(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== 'string') return null;
  let t = value.trim();
  if (!t) return null;
  let extra = 0;
  const glyph = /([¼½¾⅓⅔⅛])\s*$/.exec(t);
  if (glyph) {
    extra = FRACTIONS[glyph[1]];
    t = t.slice(0, glyph.index).trim();
    if (!t) return extra;
  }
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(t);
  if (mixed && Number(mixed[3]) > 0) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]) + extra;
  const frac = /^(\d+)\/(\d+)$/.exec(t);
  if (frac && Number(frac[2]) > 0) return Number(frac[1]) / Number(frac[2]) + extra;
  if (/^(\d+\.?\d*|\.\d+)$/.test(t)) return Number(t) + extra;
  return null;
}

/** A unit in one spelling ("Tbsps" and "tablespoons" are both "tbsp"); '' when there is none. */
export function normalizeUnit(unit) {
  if (typeof unit !== 'string') return '';
  const u = unit.trim().toLowerCase().replace(/\.$/, '');
  if (!u) return '';
  if (UNIT_ALIASES[u]) return UNIT_ALIASES[u];
  return u.length > 3 && u.endsWith('s') && !u.endsWith('ss') ? u.slice(0, -1) : u;
}

function unitLabel(unit, amount) {
  if (!unit || !(amount > 1) || SHORT_UNITS.includes(unit)) return unit || '';
  return /(ch|sh|s|x)$/.test(unit) ? `${unit}es` : `${unit}s`;
}

/** 0.5 as "1/2", 1.5 as "1 1/2", 2.35 as "2.35"; '' for no amount. */
export function formatAmount(amount) {
  if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) return '';
  const n = Math.round(Number(amount) * 100) / 100;
  const whole = Math.floor(n);
  const rest = n - whole;
  const nice = [[0.125, '1/8'], [0.25, '1/4'], [1 / 3, '1/3'], [0.5, '1/2'], [2 / 3, '2/3'], [0.75, '3/4'], [0.875, '7/8']];
  if (rest < 0.005) return String(whole);
  const hit = nice.find(([v]) => Math.abs(v - rest) < 0.01);
  if (hit) return whole ? `${whole} ${hit[1]}` : hit[1];
  return String(n);
}

/** One shopping line as text: "1 1/2 cups flour", "salt". */
export function formatGroceryLine(item) {
  const amount = formatAmount(item && item.amount);
  const unit = amount ? unitLabel(item.unit, Number(item.amount)) : '';
  return [amount, unit, item && item.ingredient].filter(Boolean).join(' ');
}

/** Which aisle an ingredient is in (the name is matched in lower case). */
export function categorizeIngredient(ingredient) {
  const s = String(ingredient || '').toLowerCase();
  const has = (...words) => words.some((w) => s.includes(w));
  if (has('milk', 'cheese', 'yogurt', 'butter', 'cream')) return 'Dairy';
  if (has('chicken', 'beef', 'pork', 'fish', 'salmon', 'turkey')) return 'Meat & Seafood';
  if (has('apple', 'banana', 'orange', 'berry', 'lemon', 'lime')) return 'Fruits';
  if (has('lettuce', 'spinach', 'broccoli', 'carrot', 'onion', 'tomato')) return 'Vegetables';
  if (has('bread', 'rice', 'pasta', 'flour', 'oats', 'quinoa')) return 'Grains & Bread';
  if (has('beans', 'lentils', 'chickpeas', 'nuts', 'seeds')) return 'Pantry';
  return 'Other';
}

const cleanName = (s) => String(s || '').trim().replace(/\s+/g, ' ');
const itemKey = (item) => `${cleanName(item.ingredient).toLowerCase()}|${item.unit || ''}`;
const addAmounts = (a, b) => {
  if (a === null || a === undefined) return b === undefined ? null : b;
  if (b === null || b === undefined) return a;
  return Math.round((a + b) * 100) / 100;
};

/**
 * Shopping lines for some recipes (saved recipes, with ingredients as
 * { name, amount, unit } or plain text). Same ingredient and unit across
 * recipes become one line with the amounts added. No ids or checked state yet.
 */
export function buildGroceryItems(recipes) {
  const lines = new Map();
  (Array.isArray(recipes) ? recipes : []).forEach((recipe) => {
    if (!recipe) return;
    const recipeName = cleanName(recipe.title || recipe.name) || 'Recipe';
    const recipeId = recipe.id === undefined || recipe.id === null ? null : String(recipe.id);
    (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).forEach((ing) => {
      const isText = typeof ing === 'string';
      const ingredient = cleanName(isText ? ing : ing && (ing.name || ing.originalName || ing.original));
      if (!ingredient) return;
      const amount = isText ? null : parseQuantity(ing.amount);
      const unit = isText ? '' : normalizeUnit(ing.unit);
      const key = itemKey({ ingredient, unit });
      const cur = lines.get(key);
      if (!cur) {
        lines.set(key, {
          ingredient, amount, unit,
          recipes: [recipeName],
          recipeIds: recipeId === null ? [] : [recipeId],
          category: categorizeIngredient(ingredient),
        });
        return;
      }
      cur.amount = addAmounts(cur.amount, amount);
      if (!cur.recipes.includes(recipeName)) cur.recipes.push(recipeName);
      if (recipeId !== null && !cur.recipeIds.includes(recipeId)) cur.recipeIds.push(recipeId);
    });
  });
  return Array.from(lines.values());
}

const withLists = (item) => ({
  ...item,
  recipes: Array.isArray(item.recipes) ? item.recipes : [],
  recipeIds: Array.isArray(item.recipeIds) ? item.recipeIds : [],
});

// A recipe already counted on a line is not added to it a second time.
function alreadyCounted(cur, inc) {
  if (cur.recipeIds.length && inc.recipeIds.length) return inc.recipeIds.every((id) => cur.recipeIds.includes(id));
  if (!inc.recipes.length) return false;
  return inc.recipes.every((name) => cur.recipes.includes(name));
}

/**
 * `incoming` lines added to the list that is already there. Existing lines
 * keep their id and ticks; a line that gains more of an ingredient is
 * unticked (there is more to buy). Adding the same recipe twice changes
 * nothing. `makeId` gives a new line its id.
 */
export function mergeGroceryItems(existing, incoming, makeId) {
  const out = (Array.isArray(existing) ? existing : []).map(withLists);
  const index = new Map(out.map((it, i) => [itemKey(it), i]));
  (Array.isArray(incoming) ? incoming : []).forEach((raw) => {
    const inc = withLists(raw);
    const key = itemKey(inc);
    if (index.has(key)) {
      const i = index.get(key);
      const cur = out[i];
      if (alreadyCounted(cur, inc)) return;
      out[i] = {
        ...cur,
        amount: addAmounts(cur.amount, inc.amount),
        recipes: [...cur.recipes, ...inc.recipes.filter((n) => !cur.recipes.includes(n))],
        recipeIds: [...cur.recipeIds, ...inc.recipeIds.filter((id) => !cur.recipeIds.includes(id))],
        checked: false,
      };
      return;
    }
    index.set(key, out.length);
    out.push({ ...inc, id: makeId(), checked: false });
  });
  return out;
}

/** Whether a recipe's ingredients are already on the list. */
export function isRecipeOnList(list, recipeId) {
  if (recipeId === undefined || recipeId === null) return false;
  const id = String(recipeId);
  return (Array.isArray(list) ? list : []).some((it) => Array.isArray(it.recipeIds) && it.recipeIds.includes(id));
}

/** How many lines are still to buy. */
export function remainingCount(list) {
  return (Array.isArray(list) ? list : []).filter((it) => !it.checked).length;
}
