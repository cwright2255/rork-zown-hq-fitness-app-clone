import {
  parseQuantity, normalizeUnit, formatAmount, formatGroceryLine, categorizeIngredient,
  buildGroceryItems, mergeGroceryItems, isRecipeOnList, remainingCount,
} from '../lib/groceryList';

const ing = (name, amount, unit) => ({ id: name, name, amount, unit });
const recipe = (id, name, ingredients) => ({ id, name, ingredients });
let n = 0;
const makeId = () => `g${++n}`;
beforeEach(() => { n = 0; });

describe('parseQuantity', () => {
  it('reads numbers, decimals and fractions', () => {
    expect(parseQuantity(2)).toBe(2);
    expect(parseQuantity('2')).toBe(2);
    expect(parseQuantity('1.5')).toBe(1.5);
    expect(parseQuantity('1/2')).toBe(0.5);
    expect(parseQuantity('1 1/2')).toBe(1.5);
    expect(parseQuantity('½')).toBe(0.5);
    expect(parseQuantity('1½')).toBe(1.5);
    expect(parseQuantity('1 ¾')).toBe(1.75);
  });

  it('gives null for blanks, words and impossible fractions', () => {
    [null, undefined, '', '  ', 'some', '1/0', '-1', NaN, {}].forEach((v) => expect(parseQuantity(v)).toBeNull());
  });
});

describe('normalizeUnit', () => {
  it('folds the usual spellings into one', () => {
    expect(normalizeUnit('Tbsps')).toBe('tbsp');
    expect(normalizeUnit('tablespoons')).toBe('tbsp');
    expect(normalizeUnit('Cups')).toBe('cup');
    expect(normalizeUnit('tsp.')).toBe('tsp');
    expect(normalizeUnit('lbs')).toBe('lb');
    expect(normalizeUnit('Pinches')).toBe('pinch');
  });

  it('singularizes other units but leaves short or double-s words alone', () => {
    expect(normalizeUnit('servings')).toBe('serving');
    expect(normalizeUnit('glass')).toBe('glass');
    expect(normalizeUnit('as')).toBe('as');
  });

  it('is empty when there is no unit', () => {
    expect(normalizeUnit(undefined)).toBe('');
    expect(normalizeUnit(null)).toBe('');
    expect(normalizeUnit('  ')).toBe('');
  });
});

describe('formatAmount and formatGroceryLine', () => {
  it('shows fractions the way a recipe does', () => {
    expect(formatAmount(0.5)).toBe('1/2');
    expect(formatAmount(1.5)).toBe('1 1/2');
    expect(formatAmount(0.33)).toBe('1/3');
    expect(formatAmount(2)).toBe('2');
    expect(formatAmount(2.35)).toBe('2.35');
    expect(formatAmount(null)).toBe('');
    expect(formatAmount(undefined)).toBe('');
  });

  it('writes a line, pluralizing a unit only when there is more than one', () => {
    expect(formatGroceryLine({ amount: 1, unit: 'cup', ingredient: 'flour' })).toBe('1 cup flour');
    expect(formatGroceryLine({ amount: 2, unit: 'cup', ingredient: 'flour' })).toBe('2 cups flour');
    expect(formatGroceryLine({ amount: 1.5, unit: 'pinch', ingredient: 'salt' })).toBe('1 1/2 pinches salt');
    expect(formatGroceryLine({ amount: 2, unit: 'tbsp', ingredient: 'olive oil' })).toBe('2 tbsp olive oil');
  });

  it('has no stray spaces when the amount or unit is missing', () => {
    expect(formatGroceryLine({ amount: null, unit: '', ingredient: 'salt' })).toBe('salt');
    expect(formatGroceryLine({ amount: null, unit: 'cup', ingredient: 'salt' })).toBe('salt');
    expect(formatGroceryLine({ amount: 3, unit: '', ingredient: 'eggs' })).toBe('3 eggs');
  });
});

describe('categorizeIngredient', () => {
  it('sorts into the same aisles as before', () => {
    expect(categorizeIngredient('Whole milk')).toBe('Dairy');
    expect(categorizeIngredient('chicken breast')).toBe('Meat & Seafood');
    expect(categorizeIngredient('lemon')).toBe('Fruits');
    expect(categorizeIngredient('baby spinach')).toBe('Vegetables');
    expect(categorizeIngredient('brown rice')).toBe('Grains & Bread');
    expect(categorizeIngredient('black beans')).toBe('Pantry');
    expect(categorizeIngredient('paprika')).toBe('Other');
    expect(categorizeIngredient(undefined)).toBe('Other');
  });
});

describe('buildGroceryItems', () => {
  it('adds the same ingredient and unit across recipes into one line', () => {
    const items = buildGroceryItems([
      recipe('r1', 'Pancakes', [ing('flour', 1, 'cups'), ing('eggs', 2, undefined)]),
      recipe('r2', 'Bread', [ing('Flour', 2.5, 'cup'), ing('salt', null, undefined)]),
    ]);
    const flour = items.find((i) => i.ingredient.toLowerCase() === 'flour');
    expect(flour).toMatchObject({ amount: 3.5, unit: 'cup', recipes: ['Pancakes', 'Bread'], recipeIds: ['r1', 'r2'], category: 'Grains & Bread' });
    expect(items).toHaveLength(3);
  });

  it('keeps the same ingredient in a different unit as its own line instead of dropping it', () => {
    const items = buildGroceryItems([
      recipe('r1', 'A', [ing('sugar', 1, 'cup')]),
      recipe('r2', 'B', [ing('sugar', 2, 'tbsp')]),
    ]);
    expect(items.map((i) => [i.ingredient, i.amount, i.unit])).toEqual([['sugar', 1, 'cup'], ['sugar', 2, 'tbsp']]);
  });

  it('adds a known amount to a missing one without turning it into NaN', () => {
    const items = buildGroceryItems([
      recipe('r1', 'A', [ing('salt', null, undefined)]),
      recipe('r2', 'B', [ing('salt', 2, undefined)]),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].amount).toBe(2);
  });

  it('adds string amounts as numbers, not by joining them', () => {
    const items = buildGroceryItems([
      recipe('r1', 'A', [ing('milk', '1/2', 'cup')]),
      recipe('r2', 'B', [ing('milk', '1 1/2', 'cups')]),
    ]);
    expect(items[0].amount).toBe(2);
  });

  it('takes plain-text ingredients as they are', () => {
    const items = buildGroceryItems([recipe('r1', 'A', ['2 cups flour', '  pinch of salt '])]);
    expect(items.map((i) => [i.ingredient, i.amount, i.unit])).toEqual([['2 cups flour', null, ''], ['pinch of salt', null, '']]);
  });

  it('skips ingredients with no name and recipes with no ingredients', () => {
    const items = buildGroceryItems([recipe('r1', 'A', [ing('', 1, 'cup'), null, ing('  ', 2, 'g')]), { id: 'r2', name: 'B' }, null]);
    expect(items).toEqual([]);
  });

  it('counts one recipe once even if it lists an ingredient twice', () => {
    const items = buildGroceryItems([recipe('r1', 'A', [ing('onion', 1, undefined), ing('onion', 1, undefined)])]);
    expect(items[0]).toMatchObject({ amount: 2, recipes: ['A'], recipeIds: ['r1'] });
  });

  it('uses the recipe title when there is one', () => {
    const items = buildGroceryItems([{ id: 'r1', title: 'Big Title', name: 'small', ingredients: [ing('egg', 1)] }]);
    expect(items[0].recipes).toEqual(['Big Title']);
  });
});

describe('mergeGroceryItems', () => {
  const fresh = (recipes) => buildGroceryItems(recipes);

  it('gives new lines an id and an unticked box', () => {
    const out = mergeGroceryItems([], fresh([recipe('r1', 'A', [ing('egg', 2)])]), makeId);
    expect(out).toEqual([expect.objectContaining({ id: 'g1', ingredient: 'egg', amount: 2, checked: false })]);
  });

  it('keeps what is already on the list when another recipe is added', () => {
    const first = mergeGroceryItems([], fresh([recipe('r1', 'A', [ing('egg', 2), ing('milk', 1, 'cup')])]), makeId);
    const out = mergeGroceryItems(first, fresh([recipe('r2', 'B', [ing('rice', 1, 'cup')])]), makeId);
    expect(out.map((i) => i.ingredient)).toEqual(['egg', 'milk', 'rice']);
    expect(out[0].id).toBe(first[0].id);
  });

  it('adds to a line the second recipe shares, and unticks it', () => {
    const first = mergeGroceryItems([], fresh([recipe('r1', 'A', [ing('egg', 2)])]), makeId);
    const ticked = first.map((i) => ({ ...i, checked: true }));
    const out = mergeGroceryItems(ticked, fresh([recipe('r2', 'B', [ing('egg', 3)])]), makeId);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: first[0].id, amount: 5, recipes: ['A', 'B'], recipeIds: ['r1', 'r2'], checked: false });
  });

  it('leaves the ticks alone when nothing is added to a line', () => {
    const first = mergeGroceryItems([], fresh([recipe('r1', 'A', [ing('egg', 2), ing('milk', 1, 'cup')])]), makeId);
    const ticked = first.map((i) => (i.ingredient === 'egg' ? { ...i, checked: true } : i));
    const out = mergeGroceryItems(ticked, fresh([recipe('r2', 'B', [ing('rice', 1, 'cup')])]), makeId);
    expect(out.find((i) => i.ingredient === 'egg').checked).toBe(true);
  });

  it('does nothing when the same recipe is added again', () => {
    const r = recipe('r1', 'A', [ing('egg', 2)]);
    const first = mergeGroceryItems([], fresh([r]), makeId);
    const again = mergeGroceryItems(first, fresh([r]), makeId);
    expect(again).toEqual(first);
  });

  it('recognises an already-counted recipe on older lines that only have names', () => {
    const legacy = [{ id: 'old', ingredient: 'egg', amount: 2, unit: '', recipes: ['A'], checked: false, category: 'Other' }];
    const out = mergeGroceryItems(legacy, fresh([recipe('r1', 'A', [ing('egg', 2)])]), makeId);
    expect(out).toHaveLength(1);
    expect(out[0].amount).toBe(2);
    const more = mergeGroceryItems(legacy, fresh([recipe('r2', 'B', [ing('egg', 1)])]), makeId);
    expect(more[0]).toMatchObject({ amount: 3, recipes: ['A', 'B'], recipeIds: ['r2'] });
  });

  it('does not change the list it was given', () => {
    const first = mergeGroceryItems([], fresh([recipe('r1', 'A', [ing('egg', 2)])]), makeId);
    const copy = JSON.parse(JSON.stringify(first));
    mergeGroceryItems(first, fresh([recipe('r2', 'B', [ing('egg', 3)])]), makeId);
    expect(first).toEqual(copy);
  });

  it('copes with junk', () => {
    expect(mergeGroceryItems(undefined, undefined, makeId)).toEqual([]);
  });
});

describe('isRecipeOnList and remainingCount', () => {
  const list = mergeGroceryItems([], buildGroceryItems([recipe('r1', 'A', [ing('egg', 2)])]), makeId);

  it('knows which recipes are on the list', () => {
    expect(isRecipeOnList(list, 'r1')).toBe(true);
    expect(isRecipeOnList(list, 'r2')).toBe(false);
    expect(isRecipeOnList(list, undefined)).toBe(false);
    expect(isRecipeOnList(undefined, 'r1')).toBe(false);
    expect(isRecipeOnList([{ id: 'x', recipes: ['A'] }], 'r1')).toBe(false);
  });

  it('counts the lines still to buy', () => {
    expect(remainingCount([{ checked: false }, { checked: true }, {}])).toBe(2);
    expect(remainingCount(undefined)).toBe(0);
  });
});
