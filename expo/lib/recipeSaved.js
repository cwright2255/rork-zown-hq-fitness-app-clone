// lib/recipeSaved.js
//
// Whether a recipe on the Recipes tab (a Spoonacular search result) is already one of the person's saved recipes, so its bookmark
// shows as saved and tapping it does not save a second copy.
//
// A recipe saved from now on carries `sourceId`, the Spoonacular id it came from. One saved before that has no sourceId, so it is
// matched by its name (ignoring case and spacing) instead. A saved recipe that has a sourceId is only ever matched by it: a recipe
// the person typed in themselves with the same name as a different search result does not count.

const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();

/** The saved recipe a browsed recipe ({ id, name }) matches, or null. */
export function findSavedMatch(savedRecipes, item) {
  if (!item || !Array.isArray(savedRecipes)) return null;
  const id = item.id == null ? '' : String(item.id);
  const name = norm(item.name);
  return savedRecipes.find((r) => {
    if (!r) return false;
    if (r.sourceId != null && r.sourceId !== '') return !!id && String(r.sourceId) === id;
    return !!name && norm(r.name || r.title) === name;
  }) || null;
}

export const isSavedRecipe = (savedRecipes, item) => !!findSavedMatch(savedRecipes, item);
