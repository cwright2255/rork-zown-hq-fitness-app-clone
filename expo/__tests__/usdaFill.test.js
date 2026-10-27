// Filling in a figure a Calorie API record leaves out from USDA FoodData Central (lib/usdaFill.js). The foods are shaped as the
// searchUsdaFoods function sends them (functions/src/usdaFoods.js). The cases named after a food come from what a probe of the real
// services found for that food (orange juice's sodium in every matching food is 0 to 10 mg, peanut butter's fibre is 5 to 8 g, and
// "Spaghetti" found a spinach pasta); the figures of the foods in those lists are rounded or made up within the ranges the probe saw.

import { agrees, usdaFigures, MIN_AGREEING } from '../lib/usdaFill';
import { ratingFor } from '../lib/foodRating';

const usda = (description, [kcal, protein, fat, carbs], { fibre = null, sodium = null, satFat = null } = {}) => (
  { fdcId: 1, description, dataType: 'SR Legacy', kcal, protein, fat, carbs, fibre, sodium, satFat }
);

describe('agrees', () => {
  const record = { calories: 48, protein: 0.5, fat: 0.5, carbs: 11 };

  it('says yes for a food with much the same calories and macros', () => {
    expect(agrees(record, usda('Orange juice, canned', [47, 0.68, 0.15, 11]))).toBe(true);
  });

  it('says yes to the same food exactly, and no to a different one', () => {
    expect(agrees(record, usda('x', [48, 0.5, 0.5, 11]))).toBe(true);
    expect(agrees(record, usda('Cola', [150, 5, 5, 40]))).toBe(false);
  });

  // The macros alone do not tell the foods apart: spinach spaghetti agrees with the spaghetti record, which is why
  // one agreeing food is never enough (see usdaFigures).
  it('says yes to a different food whose macros are alike, and no to one whose are not', () => {
    const spaghetti = { calories: 357.1429, protein: 12.5, fat: 0, carbs: 75 };
    expect(agrees(spaghetti, usda('Spaghetti, spinach, dry', [372, 13.4, 1.57, 74.8]))).toBe(true);
    expect(agrees(spaghetti, usda("DENNY'S, spaghetti and meatballs", [170, 7.84, 8.52, 15.5]))).toBe(false);
  });

  describe('calories are within 15%, or 20 kcal when that is more', () => {
    it.each([
      [200, 230, true], [200, 230.01, false], [200, 170, true], [200, 169.99, false],
      [50, 70, true], [50, 70.01, false], [50, 30, true], [50, 29.99, false],
    ])('a record of %s kcal and a food of %s kcal: %s', (recordKcal, kcal, expected) => {
      expect(agrees({ ...record, calories: recordKcal }, usda('x', [kcal, 0.5, 0.5, 11]))).toBe(expected);
    });
  });

  describe.each([['protein', 'protein', 1], ['fat', 'fat', 2], ['carbs', 'carbs', 3]])('%s is within 20%, or 3 g when that is more', (label, key, at) => {
    const food = (value) => { const m = [48, 0.5, 0.5, 11]; m[at] = value; return usda('x', m); };
    it.each([
      [10, 13, true], [10, 13.01, false], [10, 7, true], [10, 6.99, false],
      [50, 60, true], [50, 60.01, false], [50, 40, true], [50, 39.99, false],
    ])(`a record of %s g and a food of %s g: %s`, (recordValue, value, expected) => {
      const base = { calories: 48, protein: 0.5, fat: 0.5, carbs: 11 };
      // Calories are held right whatever the macros say: the test is of the one macro.
      expect(agrees({ ...base, [key]: recordValue }, food(value))).toBe(expected);
    });
  });

  it('says no when either side lacks one of the four', () => {
    for (const key of ['calories', 'protein', 'fat', 'carbs']) {
      expect(agrees({ ...record, [key]: undefined }, usda('x', [48, 0.5, 0.5, 11]))).toBe(false);
    }
    for (const [i, name] of [[0, 'kcal'], [1, 'protein'], [2, 'fat'], [3, 'carbs']]) {
      const macros = [48, 0.5, 0.5, 11];
      macros[i] = null;
      expect(agrees(record, usda(name, macros))).toBe(false);
    }
    expect(agrees(undefined, usda('x', [48, 0.5, 0.5, 11]))).toBe(false);
    expect(agrees(record, undefined)).toBe(false);
  });

  it('reads a record\'s numbers sent as text', () => {
    expect(agrees({ calories: '48', protein: '0.5', fat: '0.5', carbs: '11' }, usda('x', [48, 0.5, 0.5, 11]))).toBe(true);
  });
});

describe('usdaFigures', () => {
  // Orange juice: the record lists its saturated fat and fibre, not its sodium.
  const juice = { calories: 48, protein: 0.5, carbs: 11, fat: 0.5, fiber: 0.2, sugar: 8.5, saturatedFat: 0.05 };
  const juiceFoods = [
    usda('Orange juice, canned, unsweetened', [47, 0.68, 0.15, 11], { fibre: 0.3, sodium: 4, satFat: 0.02 }),
    usda('Babyfood, juice, orange and pineapple', [48, 0.6, 0.2, 11], { fibre: 0.1, sodium: 2, satFat: 0.01 }),
    usda('Orange juice, chilled, includes from concentrate', [47, 0.7, 0.2, 11], { fibre: 0.3, sodium: 2, satFat: 0.01 }),
    usda('Babyfood, juice, orange and apple and banana', [47, 0.4, 0.1, 11], { fibre: 0.1, sodium: 0, satFat: 0.02 }),
  ];

  it('fills in the middle value when every food that agrees puts the figure in the same place', () => {
    // 0, 2, 2, 4 mg: all under the first step (80 mg), so the rating cannot tell them apart. The middle of 2 and 2 is 2.
    expect(usdaFigures({ food: juice, foods: juiceFoods, lacking: ['sodium'] })).toEqual({ sodium: 2 });
  });

  it('uses the average of the two in the middle when there is an even number', () => {
    const foods = juiceFoods.map((f, i) => ({ ...f, sodium: [0, 2, 4, 10][i] }));
    expect(usdaFigures({ food: juice, foods, lacking: ['sodium'] })).toEqual({ sodium: 3 });
  });

  it('uses the one in the middle when there is an odd number', () => {
    const foods = juiceFoods.slice(0, 3).map((f, i) => ({ ...f, sodium: [9, 1, 5][i] }));
    expect(usdaFigures({ food: juice, foods, lacking: ['sodium'] })).toEqual({ sodium: 5 });
  });

  it('only gives the figures that were asked for', () => {
    expect(usdaFigures({ food: juice, foods: juiceFoods, lacking: ['saturatedFat'] })).toEqual({ saturatedFat: 0.015 });
    expect(usdaFigures({ food: juice, foods: juiceFoods, lacking: ['sodium', 'saturatedFat'] })).toEqual({ sodium: 2, saturatedFat: 0.015 });
  });

  describe('tofu: saturated fat of 0.2 to 0.92 g, all under the first step of 1 g', () => {
    const tofu = { calories: 70, protein: 8, carbs: 1.9, fat: 4, fiber: 0.3, sugar: 0.5, sodium: 7 };
    const satFats = [0.5, 0.69, 0.53, 0.5, 0.41, 0.48, 0.3, 0.2, 0.92];
    const foods = satFats.map((satFat, i) => usda(`Tofu ${i}`, [76, 8.7, 4.8, 1.9], { satFat }));
    it('is filled in with the middle value', () => {
      expect(usdaFigures({ food: tofu, foods, lacking: ['saturatedFat'] })).toEqual({ saturatedFat: 0.5 });
    });
    it('is not, if one of them is 1.2 g and so earns a point', () => {
      const mixed = [...foods, usda('Tofu, with a point', [76, 8.7, 4.8, 1.9], { satFat: 1.2 })];
      expect(usdaFigures({ food: tofu, foods: mixed, lacking: ['saturatedFat'] })).toEqual({});
    });
  });

  describe('peanut butter: fibre of 5 to 8 g, which the rating scores as 2 to 5 points', () => {
    const peanutButter = { calories: 600, protein: 25, carbs: 22, fat: 50, sodium: 400, saturatedFat: 10 };
    const fibres = [5, 5.6, 5.7, 6.32, 6.6, 8, 8];
    const foods = fibres.map((fibre, i) => usda(`Peanut butter ${i}`, [590 + i, 25, 50, 22], { fibre }));
    it('is left alone, because which food it is would change the rating', () => {
      expect(usdaFigures({ food: peanutButter, foods, lacking: ['fiber'] })).toEqual({});
    });
    it('is filled in when they do agree (all above 7.4 g)', () => {
      const same = [8, 8.5, 9].map((fibre, i) => usda(`Almonds ${i}`, [600, 25, 50, 22], { fibre }));
      expect(usdaFigures({ food: peanutButter, foods: same, lacking: ['fiber'] })).toEqual({ fiber: 8.5 });
    });
  });

  describe('spaghetti: only a spinach pasta agrees', () => {
    const spaghetti = { calories: 357.1429, protein: 12.5, carbs: 75, fat: 0, sugar: 3.57, saturatedFat: 0 };
    const foods = [
      usda('Spaghetti, spinach, dry', [372, 13.4, 1.57, 74.8], { fibre: 10.6, sodium: 36, satFat: 0.23 }),
      usda("DENNY'S, spaghetti and meatballs", [170, 7.84, 8.52, 15.5], { fibre: 1.5, sodium: 351, satFat: 3.1 }),
      usda('Spaghetti with sauce', [90, 3, 2, 15], { fibre: 1.5, sodium: 300, satFat: 0.5 }),
    ];
    it('fills in nothing: one agreeing food is not enough', () => {
      expect(usdaFigures({ food: spaghetti, foods, lacking: ['sodium', 'saturatedFat', 'fiber'] })).toEqual({});
    });
  });

  describe('how many foods it takes', () => {
    it(`needs ${MIN_AGREEING} that agree`, () => {
      expect(MIN_AGREEING).toBe(3);
      expect(usdaFigures({ food: juice, foods: juiceFoods.slice(0, 3), lacking: ['sodium'] })).toEqual({ sodium: 2 });
      expect(usdaFigures({ food: juice, foods: juiceFoods.slice(0, 2), lacking: ['sodium'] })).toEqual({});
    });

    it('counts only the foods that agree', () => {
      const cola = usda('Cola', [150, 5, 5, 40], { sodium: 5 });
      expect(usdaFigures({ food: juice, foods: [...juiceFoods.slice(0, 2), cola, cola, cola], lacking: ['sodium'] })).toEqual({});
    });

    it('counts only the foods that give the figure', () => {
      const without = juiceFoods.map((f, i) => (i < 2 ? { ...f, sodium: null } : f));
      expect(usdaFigures({ food: juice, foods: without, lacking: ['sodium'] })).toEqual({});
      const withOne = juiceFoods.map((f, i) => (i === 0 ? { ...f, sodium: null } : f));
      expect(usdaFigures({ food: juice, foods: withOne, lacking: ['sodium'] })).toEqual({ sodium: 2 });
    });

    it('does not count a figure that is not a number, or is below 0', () => {
      const odd = juiceFoods.map((f, i) => ({ ...f, sodium: [-5, 'lots', 2, 3][i] }));
      expect(usdaFigures({ food: juice, foods: odd, lacking: ['sodium'] })).toEqual({});
    });
  });

  describe('a figure counts as one when the foods put it on different sides of a step', () => {
    it('sodium on both sides of 80 mg is left alone', () => {
      const foods = juiceFoods.map((f, i) => ({ ...f, sodium: [70, 75, 85, 90][i] }));
      expect(usdaFigures({ food: juice, foods, lacking: ['sodium'] })).toEqual({});
    });
    it('sodium on one side of 80 mg is filled in', () => {
      const foods = juiceFoods.map((f, i) => ({ ...f, sodium: [81, 85, 90, 100][i] }));
      expect(usdaFigures({ food: juice, foods, lacking: ['sodium'] })).toEqual({ sodium: 87.5 });
    });
  });

  it('judges each figure with the others at their middle values (a fruit is plain fruit only with every figure in)', () => {
    // A fruit: under 100 mg of sodium and with some fibre makes it plain fruit, worth 5 points. Its sodium is 90, 95 or 110 mg
    // by the food, 1 point either way, but 110 mg takes the 5 points away. With the fibre not yet in, none of them is plain fruit
    // and the three look alike; with the fibre in (0.5 g), they do not.
    const fruit = { calories: 40, protein: 1, carbs: 9, fat: 0.2, sugar: 8, saturatedFat: 0.1 };
    const foods = [[90, 0.4], [95, 0.5], [110, 0.6]].map(([sodium, fibre], i) => usda(`Fruit ${i}`, [40, 1, 0.2, 9], { sodium, fibre }));
    expect(usdaFigures({ food: fruit, foods, lacking: ['sodium', 'fiber'] })).toEqual({ fiber: 0.5 });
  });

  it('keeps a drink that is only sugar apart from one that is not, though they score the same', () => {
    // Under 0.3 g of fibre a drink with nothing but sugar is held at D, and 0.1 g and 0.5 g of fibre earn the same points: 5 for the
    // sugar, so a C, held to a D. (20 g of sugar is more than a plain fruit or vegetable may have, so the 0.5 g does not make it one.)
    const drink = { calories: 80, protein: 0, carbs: 20, fat: 0, sugar: 20, saturatedFat: 0, sodium: 4 };
    const foods = [0.1, 0.1, 0.5].map((fibre, i) => usda(`Juice drink ${i}`, [80, 0, 0, 20], { fibre }));
    expect(usdaFigures({ food: drink, foods, lacking: ['fiber'] })).toEqual({});
    const alike = [0.4, 0.5, 0.6].map((fibre, i) => usda(`Juice drink ${i}`, [80, 0, 0, 20], { fibre }));
    expect(usdaFigures({ food: drink, foods: alike, lacking: ['fiber'] })).toEqual({ fiber: 0.5 });
    const noFibre = [0.1, 0.2, 0.2].map((fibre, i) => usda(`Juice drink ${i}`, [80, 0, 0, 20], { fibre }));
    expect(usdaFigures({ food: drink, foods: noFibre, lacking: ['fiber'] })).toEqual({ fiber: 0.2 });
  });

  it('fills in a figure so that the rating is the one the food would have had if it had listed it', () => {
    const filled = usdaFigures({ food: juice, foods: juiceFoods, lacking: ['sodium'] });
    expect(ratingFor({ ...juice })).toMatchObject({ partial: true });
    const full = ratingFor({ ...juice, ...filled });
    expect(full.partial).toBeUndefined();
    expect(full).toEqual(ratingFor({ ...juice, sodium: 2 }));
  });

  describe('gives nothing for', () => {
    it.each([
      ['no foods', { foods: [] }],
      ['foods that are not a list', { foods: 'orange juice' }],
      ['no foods at all', { foods: undefined }],
      ['no figures asked for', { lacking: [] }],
      ['figures it has no name for', { lacking: ['sugar', 'protein', 'calories'] }],
      ['a list of figures that is not a list', { lacking: 'sodium' }],
      ['no record', { food: undefined }],
      ['a record with no calories', { food: { ...juice, calories: undefined } }],
      ['a record with no protein', { food: { ...juice, protein: undefined } }],
      ['a record with no fat', { food: { ...juice, fat: undefined } }],
      ['a record with no carbs', { food: { ...juice, carbs: undefined } }],
    ])('%s', (_, change) => {
      expect(usdaFigures({ food: juice, foods: juiceFoods, lacking: ['sodium'], ...change })).toEqual({});
    });
  });

  it('leaves what it was given as it was', () => {
    const food = { ...juice };
    const foods = JSON.parse(JSON.stringify(juiceFoods));
    const lacking = ['sodium'];
    usdaFigures({ food, foods, lacking });
    expect(food).toEqual(juice);
    expect(foods).toEqual(juiceFoods);
    expect(lacking).toEqual(['sodium']);
  });
});
