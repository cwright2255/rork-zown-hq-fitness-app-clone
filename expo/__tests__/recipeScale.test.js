import {
  MAX_SERVINGS, UNIT_SYSTEMS, canConvert, clampServings, displayIngredient, ingredientAsWritten, parseServings,
  scaleFactor, scaleIngredient, scaleRecipe, snapKitchen, systemOfUnit,
} from '../lib/recipeScale';

const show = (ing, factor = 1, system = 'original') => displayIngredient(ing, { factor, system });
const obj = (name, amount, unit) => ({ id: name, name, amount, unit });

describe('servings', () => {
  it.each([
    [4, 4], ['4', 4], ['4 servings', 4], ['Serves 6', 6], ['4-6', 4], [2.6, 3], [0.4, 1], ['0.2', 1], [120, 120], [1, 1],
  ])('reads %p as %p servings', (input, expected) => {
    expect(parseServings(input)).toBe(expected);
  });

  it.each([[0], [-2], [''], [null], [undefined], [NaN], [Infinity], ['many'], [{}], [[4]], [true]])(
    'has no servings in %p', (input) => {
      expect(parseServings(input)).toBeNull();
    },
  );

  it('keeps a stepper count between 1 and 99 and whole', () => {
    expect(MAX_SERVINGS).toBe(99);
    expect([0, -5, 1, 3.4, 3.5, 98.6, 99, 100, 5000].map(clampServings)).toEqual([1, 1, 1, 3, 4, 99, 99, 99, 99]);
  });

  it('gives how many times a recipe is multiplied', () => {
    expect(scaleFactor(4, 6)).toBe(1.5);
    expect(scaleFactor(4, 2)).toBe(0.5);
    expect(scaleFactor('4 servings', 8)).toBe(2);
    expect(scaleFactor(4, 4)).toBe(1);
    expect(scaleFactor(120, 60)).toBe(0.5);
  });

  it('is 1 when either side is not a number of servings', () => {
    expect(scaleFactor(null, 4)).toBe(1);
    expect(scaleFactor(4, null)).toBe(1);
    expect(scaleFactor(0, 4)).toBe(1);
    expect(scaleFactor(4, 'lots')).toBe(1);
    expect(scaleFactor(undefined, undefined)).toBe(1);
  });
});

describe('systemOfUnit', () => {
  it.each([['tsp', 'us'], ['tbsp', 'us'], ['cup', 'us'], ['oz', 'us'], ['lb', 'us'], ['ml', 'metric'], ['l', 'metric'], ['g', 'metric'], ['kg', 'metric']])(
    '%s is %s', (unit, system) => {
      expect(systemOfUnit(unit)).toBe(system);
    },
  );

  it.each([['clove'], ['can'], ['slice'], ['pinch'], [''], ['bunch'], [undefined]])('%p has no system', (unit) => {
    expect(systemOfUnit(unit)).toBeNull();
  });

  it('lists the three ways to show units', () => {
    expect(UNIT_SYSTEMS).toEqual(['original', 'us', 'metric']);
  });
});

describe('snapKitchen', () => {
  it.each([
    [0, 0], [-1, 0], [NaN, 0],
    [0.01, 1 / 8], [0.2, 1 / 4], [0.3, 1 / 3], [0.45, 1 / 2], [0.65, 2 / 3], [0.8, 3 / 4], [0.9, 7 / 8], [0.95, 1],
    [1, 1], [1.1, 1], [1.3, 1 + 1 / 3], [1.5, 1.5], [1.65, 1 + 2 / 3], [1.9, 2], [2.4, 2 + 1 / 3], [2.6, 2 + 2 / 3], [2.9, 3],
    [3.3, 3 + 1 / 3], [3.9, 4], [3.99, 4],
    [4, 4], [4.2, 4], [4.3, 4.5], [6.25, 6.5], [10.7, 10.5],
  ])('measures %p as %p', (input, expected) => {
    expect(snapKitchen(input)).toBeCloseTo(expected, 6);
  });
});

describe('a line that is left as it was written', () => {
  it('when nothing is scaled or converted', () => {
    expect(show('1½ Cups Flour')).toBe('1½ Cups Flour');
    expect(show(obj('flour', 1.5, 'cups'))).toBe('1.5 cups flour');
    expect(show(obj('flour', '1/2', 'Cup'), 1, 'original')).toBe('1/2 Cup flour');
  });

  it('when it already uses the units asked for', () => {
    expect(show('250 millilitres milk', 1, 'metric')).toBe('250 millilitres milk');
    expect(show('2 cups milk', 1, 'us')).toBe('2 cups milk');
    expect(show(obj('milk', 2, 'cups'), 1, 'us')).toBe('2 cups milk');
  });

  it('even when another unit would suit the amount better', () => {
    expect(show('3 tsp sugar', 1, 'us')).toBe('3 tsp sugar');
    expect(show('16 tbsp butter', 1, 'us')).toBe('16 tbsp butter');
    expect(show('20 oz beef', 1, 'us')).toBe('20 oz beef');
    expect(show('1500 g flour', 1, 'metric')).toBe('1500 g flour');
    expect(show('1200 ml milk', 1, 'metric')).toBe('1200 ml milk');
  });

  it('when the unit has no other system', () => {
    expect(show('2 cloves garlic', 1, 'metric')).toBe('2 cloves garlic');
    expect(show('1 can beans', 1, 'us')).toBe('1 can beans');
    expect(show('3 eggs', 1, 'metric')).toBe('3 eggs');
  });

  it.each([
    ['salt, to taste'], ['Juice of 1 lemon'], ['2% milk'], ['1-inch piece of ginger'], ['1,000 g flour'], ['a handful of basil'], [''],
  ])('when there is no amount at the front: %p', (line) => {
    expect(show(line, 3, 'metric')).toBe(line);
  });

  it('when an object has no amount that can be scaled', () => {
    expect(show(obj('salt'), 2)).toBe('salt');
    expect(show(obj('salt', '', 'tsp'), 2)).toBe('tsp salt');
    expect(show(obj('basil', 'a handful'), 2)).toBe('a handful basil');
    expect(show(obj('flour', 0, 'cup'), 2)).toBe('cup flour');
    expect(show(obj('flour', -1, 'cup'), 2)).toBe('-1 cup flour');
    expect(show(obj('flour', null, 'cup'), 2, 'metric')).toBe('cup flour');
  });

  it('when it is not a line at all', () => {
    expect(show(null, 2)).toBe('');
    expect(show(undefined, 2)).toBe('');
    expect(show(7, 2)).toBe('');
  });

  it('when the factor is not a number above zero', () => {
    ['2', NaN, 0, -1, Infinity, null, undefined].forEach((factor) => {
      expect(show('1 1/2 cups flour', factor)).toBe('1 1/2 cups flour');
    });
  });

  it('when the units asked for are not one of the three', () => {
    expect(show('1 cup milk', 1, 'imperial')).toBe('1 cup milk');
    expect(show('1 cup milk', 1, undefined)).toBe('1 cup milk');
    expect(displayIngredient('1 cup milk')).toBe('1 cup milk');
    expect(displayIngredient('1 cup milk', {})).toBe('1 cup milk');
    expect(displayIngredient('1 cup milk', { system: 'metric' })).toBe('240 ml milk');
  });

  it('reads the line as saved', () => {
    expect(ingredientAsWritten('2 eggs')).toBe('2 eggs');
    expect(ingredientAsWritten(obj('eggs', 2))).toBe('2 eggs');
    expect(ingredientAsWritten({ amount: 1 })).toBe('1');
    expect(ingredientAsWritten(null)).toBe('');
  });
});

describe('more or fewer servings', () => {
  it.each([
    ['1 1/2 cups flour', 2, '3 cups flour'],
    ['1 1/2 cups flour', 1.5, '2 1/4 cups flour'],
    ['1 cup milk', 0.5, '1/2 cup milk'],
    ['1 cup milk', 2, '2 cups milk'],
    ['2 tbsp butter', 0.5, '1 tbsp butter'],
    ['1 tbsp butter', 0.5, '1/2 tbsp butter'],
    ['1 tbsp butter', 1 / 3, '1/3 tbsp butter'],
    ['1/4 tsp salt', 1.5, '1/3 tsp salt'],
    ['1 tsp salt', 3, '3 tsp salt'],
    ['1/8 tsp pepper', 0.1, '1/8 tsp pepper'],
    ['1 lb beef', 2, '2 lb beef'],
    ['8 oz cheese', 0.5, '4 oz cheese'],
    ['3 tbsp oil', 1.5, '4 1/2 tbsp oil'],
  ])('%s x %p is %s', (line, factor, expected) => {
    expect(show(line, factor)).toBe(expected);
  });

  it('says one of a thing in the singular and more in the plural', () => {
    expect(show('2 cloves garlic', 0.5)).toBe('1 clove garlic');
    expect(show('1 can beans', 3)).toBe('3 cans beans');
    expect(show('1 slice bread', 2)).toBe('2 slices bread');
    expect(show('1 pinch salt', 2)).toBe('2 pinches salt');
    expect(show('1 cup milk', 1.5)).toBe('1 1/2 cups milk');
    expect(show('2 cups milk', 0.5)).toBe('1 cup milk');
    expect(show('1 cups milk', 0.5)).toBe('1/2 cup milk');
  });

  it('writes the unit in its short form once it has been worked out', () => {
    expect(show('2 tablespoons olive oil', 2)).toBe('4 tbsp olive oil');
    expect(show('1 Teaspoon salt', 2)).toBe('2 tsp salt');
    expect(show('1 pound beef', 2)).toBe('2 lb beef');
    expect(show('3 ounces cheese', 2)).toBe('6 oz cheese');
    expect(show('1 c. sugar', 2)).toBe('2 cups sugar');
    expect(show('2 lbs. beef', 2)).toBe('4 lb beef');
  });

  it('reads amounts written with fraction signs', () => {
    expect(show('½ cup rice', 2)).toBe('1 cup rice');
    expect(show('1½ cups rice', 2)).toBe('3 cups rice');
    expect(show('1 ½ cups rice', 2)).toBe('3 cups rice');
    expect(show('¾ cup rice', 2)).toBe('1 1/2 cups rice');
    expect(show('⅓ cup rice', 3)).toBe('1 cup rice');
    expect(show('⅔ cup rice', 3)).toBe('2 cups rice');
    expect(show('⅛ tsp salt', 4)).toBe('1/2 tsp salt');
    expect(show('¼ cup rice', 4)).toBe('1 cup rice');
  });

  it('reads decimals, fractions and mixed numbers', () => {
    expect(show('.5 cup rice', 2)).toBe('1 cup rice');
    expect(show('2.5 lb chicken', 2)).toBe('5 lb chicken');
    expect(show('1/2 cup rice', 4)).toBe('2 cups rice');
    expect(show('2 3/4 cups rice', 2)).toBe('5 1/2 cups rice');
  });

  it('scales both ends of a range', () => {
    expect(show('2-3 cloves garlic', 2)).toBe('4-6 cloves garlic');
    expect(show('2 - 3 cloves garlic', 2)).toBe('4-6 cloves garlic');
    expect(show('2 to 3 cloves garlic', 2)).toBe('4-6 cloves garlic');
    expect(show('2–3 eggs', 2)).toBe('4-6 eggs');
    expect(show('2—3 eggs', 2)).toBe('4-6 eggs');
    expect(show('1/2 to 3/4 cup milk', 2)).toBe('1-1 1/2 cups milk');
    expect(show(obj('garlic', '2-3', 'cloves'), 2)).toBe('4-6 cloves garlic');
    expect(show(obj('milk', '1 to 2', 'cups'), 2)).toBe('2-4 cups milk');
    expect(show(obj('milk', '1–2', 'cups'), 2)).toBe('2-4 cups milk');
  });

  it('shows a range that rounds to one amount as that amount', () => {
    expect(show('4-4.2 cups flour', 1.1)).toBe('4 1/2 cups flour');
  });

  it('reads a unit written straight after the amount', () => {
    expect(show('500g flour', 2)).toBe('1000 g flour');
    expect(show('1.5L water', 2)).toBe('3 l water');
    expect(show('2lb beef', 2)).toBe('4 lb beef');
  });

  it('scales a line that is only an amount, and a range of the same amount', () => {
    expect(show('3', 2)).toBe('6');
    expect(show('2 cups', 2)).toBe('4 cups');
    expect(show('2-2 cloves garlic', 2)).toBe('4 cloves garlic');
    expect(show('0-2 cups flour', 2)).toBe('0-2 cups flour');
    expect(show('3-2 cups flour', 2)).toBe('3-2 cups flour');
  });

  it('scales an amount with no unit', () => {
    expect(show('2 eggs', 1.5)).toBe('3 eggs');
    expect(show('3 eggs', 1.5)).toBe('4 1/2 eggs');
    expect(show('2 large eggs, beaten', 2)).toBe('4 large eggs, beaten');
  });

  it('leaves what is in brackets alone', () => {
    expect(show('2 (14 oz) cans tomatoes', 2)).toBe('4 (14 oz) cans tomatoes');
    expect(show('2 (14 oz) cans tomatoes', 2, 'metric')).toBe('4 (14 oz) cans tomatoes');
    expect(show('2(14 oz) cans tomatoes', 2)).toBe('4 (14 oz) cans tomatoes');
    expect(show('1 cup milk (whole)', 2)).toBe('2 cups milk (whole)');
  });

  it('keeps the rest of the line, with commas and all', () => {
    expect(show('1 1/2 cups all-purpose flour, sifted', 2)).toBe('3 cups all-purpose flour, sifted');
    expect(show('1 cup of milk', 2)).toBe('2 cups of milk');
  });

  it('does not mistake a unit-like word at the start of the name for a unit', () => {
    expect(show('2 large eggs', 2)).toBe('4 large eggs');
    expect(show('2 canned peaches', 2)).toBe('4 canned peaches');
    expect(show('2 gingersnaps', 2)).toBe('4 gingersnaps');
    expect(show('2 constructor widgets', 2)).toBe('4 constructor widgets');
  });

  it('works on ingredients saved as objects', () => {
    expect(show(obj('flour', '1 1/2', 'cups'), 2)).toBe('3 cups flour');
    expect(show(obj('milk', 0.5, 'cup'), 4)).toBe('2 cups milk');
    expect(show(obj('eggs', 2), 1.5)).toBe('3 eggs');
    expect(show(obj('butter', 2, 'Tbsp'), 2)).toBe('4 tbsp butter');
    expect(show(obj('  flour  ', 1, ' cup '), 2)).toBe('2 cups flour');
    expect(show({ amount: 1, unit: 'cup' }, 2)).toBe('2 cups');
    expect(show({ name: 'flour', amount: '1', unit: undefined }, 2)).toBe('2 flour');
  });

  it('keeps a unit it does not know exactly as written', () => {
    expect(show(obj('kale', 1, 'bunch'), 2)).toBe('2 bunch kale');
    expect(show(obj('kale', 1, ' bunch '), 2)).toBe('2 bunch kale');
    expect(show(obj('x', 2, 'Bunches'), 2)).toBe('4 Bunches x');
    expect(show(obj('kale', 1, 'bunch'), 2, 'metric')).toBe('2 bunch kale');
    expect(show(obj('kale', 1, 'bunch'), 1, 'metric')).toBe('1 bunch kale');
  });

  it('rounds metric amounts to what a scale shows', () => {
    expect(show('250 g flour', 1.5)).toBe('375 g flour');
    expect(show('250 g flour', 1.01)).toBe('255 g flour');
    expect(show('250 g flour', 1.03)).toBe('260 g flour');
    expect(show('50 g flour', 1.5)).toBe('75 g flour');
    expect(show('50 g flour', 1.011)).toBe('51 g flour');
    expect(show('7 g yeast', 1.5)).toBe('11 g yeast');
    expect(show('3 g yeast', 1.5)).toBe('4.5 g yeast');
    expect(show('3 g yeast', 0.01)).toBe('0.5 g yeast');
    expect(show('200 ml milk', 1.5)).toBe('300 ml milk');
    expect(show('12 ml milk', 1.5)).toBe('20 ml milk');
    expect(show('5 ml milk', 1.5)).toBe('8 ml milk');
    expect(show('5 ml milk', 0.01)).toBe('1 ml milk');
    expect(show('0.5 kg flour', 1.5)).toBe('0.75 kg flour');
    expect(show('1 l milk', 1.26)).toBe('1.25 l milk');
    expect(show('1 l milk', 0.01)).toBe('0.05 l milk');
    expect(show('1 kg flour', 3)).toBe('3 kg flour');
    expect(show('1 kg flour', 1.3)).toBe('1.3 kg flour');
    expect(show('1 l milk', 1.3)).toBe('1.3 l milk');
    expect(show('1500 g flour', 2)).toBe('3000 g flour');
  });
});

describe('US to metric', () => {
  it.each([
    ['1 cup milk', '240 ml milk'],
    ['1/2 cup milk', '120 ml milk'],
    ['1/4 cup milk', '60 ml milk'],
    ['1/3 cup milk', '80 ml milk'],
    ['2/3 cup milk', '160 ml milk'],
    ['3/4 cup milk', '180 ml milk'],
    ['1/8 cup milk', '30 ml milk'],
    ['2 cups milk', '480 ml milk'],
    ['2 1/2 cups milk', '600 ml milk'],
    ['4 cups milk', '960 ml milk'],
    ['4 1/2 cups milk', '1.1 l milk'],
    ['5 cups milk', '1.2 l milk'],
    ['1 tbsp oil', '15 ml oil'],
    ['2 tbsp oil', '30 ml oil'],
    ['1 tsp vanilla', '5 ml vanilla'],
    ['1/2 tsp vanilla', '3 ml vanilla'],
    ['1/4 tsp vanilla', '1 ml vanilla'],
    ['1/8 tsp vanilla', '1 ml vanilla'],
    ['1 oz cheese', '28 g cheese'],
    ['3 oz cheese', '85 g cheese'],
    ['1/2 oz cheese', '14 g cheese'],
    ['0.2 oz saffron', '5.5 g saffron'],
    ['4 oz cheese', '115 g cheese'],
    ['8 oz cheese', '225 g cheese'],
    ['1 lb beef', '455 g beef'],
    ['2 lb beef', '905 g beef'],
    ['2.5 lb beef', '1.15 kg beef'],
    ['3 lb beef', '1.35 kg beef'],
  ])('%s is %s', (line, expected) => {
    expect(show(line, 1, 'metric')).toBe(expected);
  });

  it('converts both ends of a range', () => {
    expect(show('1-2 cups milk', 1, 'metric')).toBe('240-480 ml milk');
    expect(show(obj('milk', '1/2 to 1', 'cup'), 1, 'metric')).toBe('120-240 ml milk');
  });

  it('works out the new amount before rounding, once', () => {
    expect(show('1 cup milk', 1.5, 'metric')).toBe('360 ml milk');
    expect(show('1/3 cup milk', 3, 'metric')).toBe('240 ml milk');
    expect(show('1 cup milk', 4, 'metric')).toBe('960 ml milk');
    expect(show('1 lb beef', 0.5, 'metric')).toBe('225 g beef');
  });

  it('converts an ingredient saved as an object', () => {
    expect(show(obj('milk', 1, 'cups'), 1, 'metric')).toBe('240 ml milk');
    expect(show(obj('beef', '1 1/2', 'lb'), 1, 'metric')).toBe('680 g beef');
  });

  it('writes metric amounts as decimals, not fractions', () => {
    expect(show('1 3/4 lb beef', 1, 'metric')).toBe('795 g beef');
    expect(show('1 l milk', 1.5)).toBe('1.5 l milk');
    expect(show('1.5 kg flour', 1.5)).toBe('2.25 kg flour');
    expect(show('0.25 l milk', 3)).toBe('0.75 l milk');
  });
});

describe('metric to US', () => {
  it.each([
    ['240 ml milk', '1 cup milk'],
    ['250 ml milk', '1 cup milk'],
    ['500 ml milk', '2 cups milk'],
    ['120 ml milk', '1/2 cup milk'],
    ['60 ml milk', '1/4 cup milk'],
    ['55 ml milk', '3 2/3 tbsp milk'],
    ['59 ml milk', '4 tbsp milk'],
    ['480 ml milk', '2 cups milk'],
    ['1 l milk', '4 cups milk'],
    ['1.5 l milk', '6 1/2 cups milk'],
    ['45 ml oil', '3 tbsp oil'],
    ['30 ml oil', '2 tbsp oil'],
    ['15 ml oil', '1 tbsp oil'],
    ['20 ml oil', '1 1/3 tbsp oil'],
    ['5 ml vanilla', '1 tsp vanilla'],
    ['10 ml vanilla', '2 tsp vanilla'],
    ['14 ml vanilla', '2 3/4 tsp vanilla'],
    ['2 ml vanilla', '1/3 tsp vanilla'],
    ['28 g cheese', '1 oz cheese'],
    ['100 g cheese', '3 1/2 oz cheese'],
    ['250 g cheese', '9 oz cheese'],
    ['400 g cheese', '14 oz cheese'],
    ['5 g saffron', '1/8 oz saffron'],
    ['439 g beef', '15 1/2 oz beef'],
    ['440 g beef', '1 lb beef'],
    ['450 g beef', '1 lb beef'],
    ['500 g beef', '1 lb beef'],
    ['1 kg beef', '2 1/4 lb beef'],
    ['1.5 kg beef', '3 1/3 lb beef'],
    ['2 kg beef', '4 1/2 lb beef'],
  ])('%s is %s', (line, expected) => {
    expect(show(line, 1, 'us')).toBe(expected);
  });

  it('picks the unit from the bigger end of a range', () => {
    expect(show('120-240 ml milk', 1, 'us')).toBe('1/2-1 cup milk');
    expect(show('5-10 ml vanilla', 1, 'us')).toBe('1-2 tsp vanilla');
  });

  it('scales, then converts', () => {
    expect(show('120 ml milk', 2, 'us')).toBe('1 cup milk');
    expect(show('250 g flour', 2, 'us')).toBe('1 lb flour');
    expect(show(obj('milk', 250, 'ml'), 1, 'us')).toBe('1 cup milk');
    expect(show(obj('flour', 0.5, 'kg'), 1, 'us')).toBe('1 lb flour');
    expect(show(obj('flour', '250', 'Grams'), 1, 'us')).toBe('9 oz flour');
  });
});

describe('canConvert', () => {
  it('is true when some line has a unit that has another system', () => {
    expect(canConvert(['2 eggs', '1 cup flour'])).toBe(true);
    expect(canConvert([obj('milk', 250, 'ml')])).toBe(true);
    expect(canConvert([obj('flour', 1, 'Tbsp')])).toBe(true);
    expect(canConvert(['500g flour'])).toBe(true);
  });

  it('is false when none does', () => {
    expect(canConvert(['2 eggs', 'salt, to taste', '2 cloves garlic'])).toBe(false);
    expect(canConvert([obj('kale', 1, 'bunch')])).toBe(false);
    expect(canConvert([obj('milk', null, 'cup')])).toBe(false);
    expect(canConvert([obj('milk', 0, 'cup')])).toBe(false);
    expect(canConvert([])).toBe(false);
    expect(canConvert(undefined)).toBe(false);
    expect(canConvert('1 cup')).toBe(false);
    expect(canConvert([null, 5])).toBe(false);
  });
});

describe('scaleIngredient (the shape stays the same)', () => {
  it('hands back the same ingredient for one times the recipe', () => {
    const ing = obj('flour', 1, 'cup');
    expect(scaleIngredient(ing, 1)).toBe(ing);
    expect(scaleIngredient(ing, 'x')).toBe(ing);
    expect(scaleIngredient('1 cup flour', 1)).toBe('1 cup flour');
  });

  it('scales text into text', () => {
    expect(scaleIngredient('1 cup flour', 2)).toBe('2 cups flour');
    expect(scaleIngredient('salt', 2)).toBe('salt');
  });

  it('scales an object and keeps everything else on it', () => {
    const ing = { id: 'i1', name: 'flour', amount: '1 1/2', unit: 'cups', note: 'sifted' };
    expect(scaleIngredient(ing, 2)).toEqual({ id: 'i1', name: 'flour', amount: 3, unit: 'cups', note: 'sifted' });
    expect(ing.amount).toBe('1 1/2');
  });

  it('keeps the exact amount for the shopping list, to three decimals', () => {
    expect(scaleIngredient(obj('milk', '1/3', 'cup'), 2).amount).toBe(0.667);
    expect(scaleIngredient(obj('milk', 1, 'cup'), 1.5).amount).toBe(1.5);
    expect(scaleIngredient(obj('milk', 1, 'cup'), 1 / 3).amount).toBe(0.333);
  });

  it('scales a range into a range', () => {
    expect(scaleIngredient(obj('garlic', '2-3', 'cloves'), 2).amount).toBe('4-6');
    expect(scaleIngredient(obj('garlic', '1 to 1.5', 'cloves'), 2).amount).toBe('2-3');
  });

  it('leaves an ingredient with no amount to scale as it is', () => {
    const salt = obj('salt', 'to taste', '');
    expect(scaleIngredient(salt, 2)).toBe(salt);
    const none = { name: 'salt' };
    expect(scaleIngredient(none, 2)).toBe(none);
    expect(scaleIngredient(null, 2)).toBeNull();
    expect(scaleIngredient(undefined, 2)).toBeUndefined();
  });
});

describe('scaleRecipe', () => {
  const recipe = { id: 'r1', name: 'Pancakes', servings: 4, ingredients: [obj('flour', 1, 'cup'), '2 eggs', 'salt'] };

  it('scales every ingredient and keeps the rest of the recipe', () => {
    expect(scaleRecipe(recipe, 2)).toEqual({
      id: 'r1', name: 'Pancakes', servings: 4,
      ingredients: [{ id: 'flour', name: 'flour', amount: 2, unit: 'cup' }, '4 eggs', 'salt'],
    });
  });

  it('does not change the recipe it was given', () => {
    const before = JSON.stringify(recipe);
    scaleRecipe(recipe, 3);
    expect(JSON.stringify(recipe)).toBe(before);
  });

  it('hands back the same recipe for one times, a bad factor, or a recipe with no ingredient list', () => {
    expect(scaleRecipe(recipe, 1)).toBe(recipe);
    expect(scaleRecipe(recipe, undefined)).toBe(recipe);
    expect(scaleRecipe(recipe, 0)).toBe(recipe);
    const bare = { id: 'r2', name: 'Water' };
    expect(scaleRecipe(bare, 2)).toBe(bare);
    const odd = { id: 'r3', ingredients: 'flour' };
    expect(scaleRecipe(odd, 2)).toBe(odd);
    expect(scaleRecipe(null, 2)).toBeNull();
    expect(scaleRecipe(undefined, 2)).toBeUndefined();
  });
});
