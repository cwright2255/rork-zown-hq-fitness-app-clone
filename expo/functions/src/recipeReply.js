// What a recipe request to postLLM (kind 'recipe') sends back to the app.
//
// The app's recipe import asks the AI to turn a post's caption, a page's details or pasted text into a recipe. That request skips the
// topic check (functions/src/scope.js): the topic check judged the whole request, and turned the captions of real recipe posts away as
// "outside fitness and health", so no recipe came in. The rule that goes in front of every request still applies, and in place of the
// topic check the reply is read here: only a recipe, in the shape the app saves, is sent on, with every field cut to a sensible size.
// Whatever else the model wrote (a sentence, a refusal, anything that is not a recipe) is dropped and the app is told there is none.
//
// Pure functions with no Firebase in them, so they are tested directly (__tests__/recipeReply.test.js).

const MAX_INGREDIENTS = 100;
const MAX_STEPS = 100;
const MAX_TAGS = 20;
const MAX_NUMBER = 100000;

const NUTRITION_FIELDS = ['calories', 'protein', 'carbs', 'fat', 'fiber'];

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function words(value, max) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function amount(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(value, MAX_NUMBER) : undefined;
}

function ingredient(item, index) {
  const fallbackId = String(index + 1);
  if (typeof item === 'string') {
    const name = words(item, 300);
    return name ? { id: fallbackId, name } : null;
  }
  if (!isPlainObject(item)) return null;
  const name = words(item.name, 300);
  if (!name) return null;
  const id = typeof item.id === 'string' || typeof item.id === 'number' ? words(String(item.id), 20) : undefined;
  const out = { id: id || fallbackId, name };
  const quantity = amount(item.amount);
  if (quantity !== undefined) out.amount = quantity;
  const unit = words(item.unit, 40);
  if (unit) out.unit = unit;
  return out;
}

function list(value, max, keep) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (let i = 0; i < value.length && out.length < max; i += 1) {
    const kept = keep(value[i], out.length);
    if (kept) out.push(kept);
  }
  return out;
}

function nutrition(value) {
  if (!isPlainObject(value)) return undefined;
  const out = {};
  for (const field of NUTRITION_FIELDS) {
    const n = amount(value[field]);
    if (n !== undefined) out[field] = n;
  }
  return Object.keys(out).length ? out : undefined;
}

/** The first JSON object in the model's reply (the whole reply, or the first {...} in it), or null. */
function objectIn(text) {
  if (typeof text !== 'string') return null;
  const candidates = [text.trim()];
  const match = text.match(/\{[\s\S]*\}/);
  if (match) candidates.push(match[0]);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (isPlainObject(parsed)) return parsed;
    } catch {
      // try the next way of reading it
    }
  }
  return null;
}

/**
 * The recipe in a model reply, in the shape the app saves, or null when the reply holds none. A recipe needs a name, at least one
 * ingredient with a name and at least one step. Nothing but these fields is passed on, and each is cut to size.
 */
export function readRecipe(text) {
  const found = objectIn(text);
  if (!found) return null;

  const name = words(found.name, 200);
  const ingredients = list(found.ingredients, MAX_INGREDIENTS, ingredient);
  const instructions = list(found.instructions, MAX_STEPS, (step) => words(step, 2000));
  if (!name || !ingredients.length || !instructions.length) return null;

  const recipe = { name, ingredients, instructions };
  const text200 = (field, max) => {
    const value = words(found[field], max);
    if (value) recipe[field] = value;
  };
  text200('description', 1000);
  text200('difficulty', 20);
  text200('category', 20);
  text200('imageUrl', 2000);
  text200('author', 100);
  for (const field of ['prepTime', 'cookTime', 'servings']) {
    const n = amount(found[field]);
    if (n !== undefined) recipe[field] = n;
  }
  for (const field of ['tags', 'dietaryTags']) {
    const tags = list(found[field], MAX_TAGS, (tag) => words(tag, 40));
    if (tags.length) recipe[field] = tags;
  }
  const facts = nutrition(found.nutrition);
  if (facts) recipe.nutrition = facts;
  return recipe;
}
