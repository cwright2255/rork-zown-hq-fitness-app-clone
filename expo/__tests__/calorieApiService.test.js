const mockCall = jest.fn();
// USDA FoodData Central's foods for a name (the searchUsdaFoods function): its own mock, so that it does not take the answers the Calorie API ones queue.
const mockUsda = jest.fn();
const mockFunctionsCalled = [];
jest.mock('firebase/functions', () => ({
  httpsCallable: (_functions, name) => { mockFunctionsCalled.push(name); return name === 'searchUsdaFoods' ? mockUsda : mockCall; },
}), { virtual: true });
jest.mock('../src/config/firebase', () => ({ functions: {} }));

import { searchFoodsDetailed, searchFoods, getFoodById, withFullRating, calculateNutritionalScore } from '../services/calorieApiService';

const apiFood = (extra = {}) => ({
  id: 77, name: 'Chicken Soup', calories_100g: 40, protein_100g: 3, carbs_100g: 4, fat_100g: 1.2,
  fiber_100g: 0.5, sugar_100g: 1, sodium_100g: 300, saturated_fat_100g: 0.3, ...extra,
});

let errorSpy;
let warnSpy;
beforeEach(() => {
  mockCall.mockReset();
  mockUsda.mockReset();
  mockUsda.mockResolvedValue({ data: { foods: [] } });
  mockFunctionsCalled.length = 0;
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { errorSpy.mockRestore(); warnSpy.mockRestore(); });

describe('searchFoodsDetailed', () => {
  it('returns the real results and says the search worked', async () => {
    mockCall.mockResolvedValueOnce({ data: { data: [apiFood()] } });
    const { results, failed } = await searchFoodsDetailed('soup real');
    expect(failed).toBe(false);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Chicken Soup');
    expect(results[0].calories).toBe(40);
    expect(mockFunctionsCalled).toEqual(['searchCalorieApiFoods']);
    expect(mockCall).toHaveBeenCalledWith({ query: 'soup real' });
  });

  it('says so, and lists no foods at all, when the search could not be reached', async () => {
    mockCall.mockRejectedValueOnce(new Error('offline'));
    const { results, failed } = await searchFoodsDetailed('chicken');
    expect(failed).toBe(true);
    expect(results).toEqual([]);
  });

  it('never fills in foods of its own, whatever was searched for', async () => {
    for (const word of ['chicken', 'banana', 'egg', 'salmon', 'spinach', 'avocado', 'rice']) {
      mockCall.mockRejectedValueOnce(new Error('offline'));
      expect(await searchFoodsDetailed(`${word} offline`)).toEqual({ results: [], failed: true });
    }
  });

  it('does not remember a failure: the next try goes back to the real search', async () => {
    mockCall.mockRejectedValueOnce(new Error('offline'));
    const first = await searchFoodsDetailed('chicken retry');
    expect(first.failed).toBe(true);

    mockCall.mockResolvedValueOnce({ data: { data: [apiFood({ name: 'Chicken Wrap' })] } });
    const second = await searchFoodsDetailed('chicken retry');
    expect(second.failed).toBe(false);
    expect(second.results[0].name).toBe('Chicken Wrap');
  });

  it('remembers a real result for a few minutes', async () => {
    mockCall.mockResolvedValueOnce({ data: { data: [apiFood()] } });
    await searchFoodsDetailed('soup cached');
    const again = await searchFoodsDetailed('soup cached');
    expect(again.failed).toBe(false);
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  it('returns nothing for an empty search', async () => {
    expect(await searchFoodsDetailed('   ')).toEqual({ results: [], failed: false });
    expect(mockCall).not.toHaveBeenCalled();
  });
});

describe('fiber, sugar and sodium', () => {
  it('are kept when the API lists them', async () => {
    mockCall.mockResolvedValueOnce({ data: { data: [apiFood({ id: 801 })] } });
    const { results } = await searchFoodsDetailed('fiber listed');
    expect([results[0].fiber, results[0].sugar, results[0].sodium]).toEqual([0.5, 1, 300]);
  });

  it('are left off, not shown as 0, when the API has no figure', async () => {
    mockCall.mockResolvedValueOnce({
      data: { data: [apiFood({ id: 802, fiber_100g: undefined, sugar_100g: null, sodium_100g: undefined })] },
    });
    const { results } = await searchFoodsDetailed('fiber missing');
    expect(results[0].fiber).toBeUndefined();
    expect(results[0].sugar).toBeUndefined();
    expect(results[0].sodium).toBeUndefined();
    expect(results[0].calories).toBe(40);
  });

  it('keep a real 0', async () => {
    mockCall.mockResolvedValueOnce({ data: { data: [apiFood({ id: 803, fiber_100g: 0, sugar_100g: 0, sodium_100g: 0 })] } });
    const { results } = await searchFoodsDetailed('fiber zero');
    expect([results[0].fiber, results[0].sugar, results[0].sodium]).toEqual([0, 0, 0]);
  });

  it('read sodium from the nutrients list when the top-level figure is missing', async () => {
    mockCall.mockResolvedValueOnce({
      data: { data: [apiFood({ id: 804, sodium_100g: undefined, nutrients: [{ nutrient_name: 'Sodium, Na', amount: 42.26 }] })] },
    });
    const { results } = await searchFoodsDetailed('sodium nutrients');
    expect(results[0].sodium).toBe(42.3);
  });
});

describe('searchFoods', () => {
  it('still returns just the list', async () => {
    mockCall.mockResolvedValueOnce({ data: { data: [apiFood()] } });
    const list = await searchFoods('soup plain');
    expect(Array.isArray(list)).toBe(true);
    expect(list[0].name).toBe('Chicken Soup');
  });
});

describe('the rating on a food', () => {
  const cookie = {
    id: 910, name: 'Cookie', calories_100g: 488, protein_100g: 5.7, carbs_100g: 65, fat_100g: 24,
    fiber_100g: 3.5, sugar_100g: 36, sodium_100g: 350, saturated_fat_100g: 8,
  };
  const rating = async (query, extra, id) => {
    mockCall.mockResolvedValueOnce({ data: { data: [apiFood({ id, ...extra })] } });
    return (await searchFoodsDetailed(query)).results[0].nutritionalScore;
  };

  it('is worked out from the figures per 100 g', async () => {
    expect(await rating('rating soup', {}, 901)).toEqual({ score: 'B', stars: 3.5 });
  });

  it('puts a biscuit at the bottom', async () => {
    mockCall.mockResolvedValueOnce({ data: { data: [cookie] } });
    const { results } = await searchFoodsDetailed('rating cookie');
    expect(results[0].nutritionalScore).toEqual({ score: 'E', stars: 1 });
  });

  it('is left off, so no stars show, when the food has no energy figure', async () => {
    mockCall.mockResolvedValueOnce({ data: { data: [apiFood({ id: 902, calories_100g: undefined })] } });
    const { results } = await searchFoodsDetailed('rating no energy');
    expect(results[0]).not.toHaveProperty('nutritionalScore');
    expect(results[0].calories).toBe(0);
  });

  it('is rated for a real 0 kcal', async () => {
    expect(await rating('rating water', { name: 'Water', calories_100g: 0, protein_100g: 0, fiber_100g: 0, sugar_100g: 0, sodium_100g: 2, saturated_fat_100g: 0 }, 903)).toEqual({ score: 'B', stars: 4 });
  });

  it('counts the fibre', async () => {
    // 200 kcal that the carbohydrate and fat account for.
    const dense = { calories_100g: 200, protein_100g: 0, carbs_100g: 40, fat_100g: 4.4, sugar_100g: 1, sodium_100g: 10, saturated_fat_100g: 0 };
    expect(await rating('rating fibre', { ...dense, fiber_100g: 7.5 }, 911)).toEqual({ score: 'A', stars: 4.5 });
    expect(await rating('rating no fibre', { ...dense, fiber_100g: undefined }, 912)).toEqual({ score: 'B', stars: 3.5 });
  });

  it('uses the carbohydrate to fill in a missing sugar figure', async () => {
    const lean = { calories_100g: 30, protein_100g: 5, fiber_100g: 4, sodium_100g: 10, saturated_fat_100g: 0, sugar_100g: undefined };
    // 20 g of carbohydrate could be mostly sugar: one figure missing, B at best.
    expect(await rating('rating carbs high', { ...lean, id: 904, carbs_100g: 20 }, 904)).toEqual({ score: 'B', stars: 4, partial: true });
    // 2 g of carbohydrate cannot hold more than 3.4 g of sugar: nothing missing.
    expect(await rating('rating carbs low', { ...lean, id: 905, carbs_100g: 2 }, 905)).toEqual({ score: 'A', stars: 4.5 });
  });

  it('uses the fat to fill in a missing saturated fat figure', async () => {
    const lean = { calories_100g: 30, protein_100g: 5, fiber_100g: 4, sodium_100g: 10, sugar_100g: 1, carbs_100g: 6, saturated_fat_100g: undefined };
    expect(await rating('rating fat high', { ...lean, fat_100g: 5 }, 906)).toEqual({ score: 'B', stars: 4, partial: true });
    expect(await rating('rating fat low', { ...lean, fat_100g: 0.5 }, 907)).toEqual({ score: 'A', stars: 5 });
  });

  it('reads saturated fat and sodium from the nutrients list when the top-level figures are missing', async () => {
    const nutrients = [{ nutrient_name: 'Sodium, Na', amount: 900 }, { nutrient_name: 'Fatty acids, total saturated', amount: 6 }];
    const withList = await rating('rating list', { sodium_100g: undefined, saturated_fat_100g: undefined, nutrients }, 908);
    const without = await rating('rating no list', { sodium_100g: undefined, saturated_fat_100g: undefined }, 909);
    // With the figures: 900 mg of sodium and 6 g of saturated fat count against it. Without them: C at best.
    expect(withList.score).toBe('D');
    expect(without.score).toBe('C');
  });
});

// Records exactly as the Calorie API sends them (a food's own record, per 100 g). The API sends only calories, protein, carbs, fat, fibre and
// sugar at the top level; sodium and saturated fat are only in the `nutrients` list, whose entries call the name `name` (a search row's list
// and portion_nutrients call it `nutrient_name`). Every test above this one gave sodium_100g and saturated_fat_100g at the top level, which the
// real API never does, so nothing noticed that the app was not finding them and holding nearly every food to 3 or 4 stars.
describe('a food\'s own record as the API really sends it', () => {
  const entry = (name, unit, amount, nutrient_id = 1) => ({ name, unit, amount, nutrient_id });
  const apple = {
    id: 8113846, name: 'Apple', brand_name: 'Verified', serving_size: 182, serving_unit: 'g',
    calories_100g: 52, protein_100g: 0.25, carbs_100g: 11.6, fat_100g: 0.25, fiber_100g: 1.4, sugar_100g: 9.35,
    nutrients: [entry('Carbohydrates', 'g', 11.6), entry('Energy (kcal)', 'kcal', 52), entry('Fiber', 'g', 1.4), entry('Fiber and Sugar', 'g', 10.75),
      entry('Net Carbohydrates', 'g', 10.2), entry('Protein', 'g', 0.25), entry('Saturated Fat', 'g', 0.052), entry('Sodium', 'mg', 4),
      entry('Sugars', 'g', 9.35), entry('Total Fat', 'g', 0.25)],
    portion_nutrients: [{ nutrient_id: 106916, nutrient_name: 'Saturated Fat', amount: 0.0946, unit: 'g' }, { nutrient_id: 106901, nutrient_name: 'Sodium', amount: 7.28, unit: 'mg' }],
  };
  // "Monounsaturated Fat" and "Polyunsaturated Fat" come before "Saturated Fat" in the list.
  const cheddar = {
    id: 8093809, name: 'Cheese, Cheddar', brand_name: 'Verified', calories_100g: 408, protein_100g: 23.3, carbs_100g: 2.44, fat_100g: 34, fiber_100g: 0, sugar_100g: 0,
    nutrients: [entry('Calcium', 'mg', 707), entry('Carbohydrates', 'g', 2.44), entry('Energy (kcal)', 'kcal', 408), entry('Monounsaturated Fat', 'g', 7.44),
      entry('Polyunsaturated Fat', 'g', 1.18), entry('Protein', 'g', 23.3), entry('Saturated Fat', 'g', 19.2), entry('Sodium', 'mg', 654),
      entry('Total Fat', 'g', 34), entry('Trans Fat', 'g', 1.14)],
  };
  // No sodium in the list at all.
  const oliveOil = {
    id: 8102585, name: 'Olive Oil', brand_name: 'Verified', calories_100g: 884, protein_100g: 0, carbs_100g: 0, fat_100g: 100, fiber_100g: 0, sugar_100g: 0,
    nutrients: [entry('Calcium', 'mg', 1), entry('Energy (kcal)', 'kcal', 884), entry('Iron', 'mg', 0.56), entry('Monounsaturated Fat', 'g', 68.42),
      entry('Polyunsaturated Fat', 'g', 9.469), entry('Saturated Fat', 'g', 14.5), entry('Total Fat', 'g', 100)],
  };
  const chickenBreast = {
    id: 8099899, name: 'Chicken Breast', brand_name: 'Verified', calories_100g: 175, protein_100g: 26.37, carbs_100g: 0.09, fat_100g: 7.67, fiber_100g: 0, sugar_100g: 0.09,
    nutrients: [entry('Monounsaturated Fat', 'g', 3.131), entry('Polyunsaturated Fat', 'g', 0.945), entry('Protein', 'g', 26.37), entry('Saturated Fat', 'g', 1.958),
      entry('Sodium', 'mg', 329), entry('Total Fat', 'g', 7.67)],
  };
  const broccoli = {
    id: 8093774, name: 'Broccoli, Steamed', brand_name: 'Verified', calories_100g: 47, protein_100g: 2.8, carbs_100g: 8.5, fat_100g: 0.5, fiber_100g: 3.1, sugar_100g: 1.9,
    nutrients: [entry('Fiber', 'g', 3.1), entry('Potassium', 'mg', 293), entry('Saturated Fat', 'g', 0.1), entry('Sodium', 'mg', 30), entry('Sugars', 'g', 1.9)],
  };
  // The row a search lists for cheddar: energy, protein, carbs, fat (and sugar when it has it), with `nutrient_name`.
  const cheddarRow = {
    id: 8093809, name: 'Cheese, Cheddar', brand_name: 'Verified', calories_100g: 408, protein_100g: 23.3, carbs_100g: 2.44, fat_100g: 34, fiber_100g: 0, sugar_100g: 0,
    nutrients: [{ nutrient_id: 106888, nutrient_name: 'Calories', amount: 408 }, { nutrient_id: 106899, nutrient_name: 'Protein', amount: 23.3 },
      { nutrient_id: 106896, nutrient_name: 'Carbohydrates', amount: 2.44 }, { nutrient_id: 106891, nutrient_name: 'Fat', amount: 34 }],
  };
  const load = async (record, key) => {
    mockCall.mockResolvedValueOnce({ data: { data: { ...record, id: key } } });
    return getFoodById(key);
  };

  it('finds the sodium and saturated fat in the list, so the rating is complete (not partial)', async () => {
    const food = await load(apple, 'real-apple');
    expect(food.sodium).toBe(4);
    expect(food.nutritionalDetails.saturatedFat).toBe(0.1);
    expect(food.nutritionalScore).toEqual({ score: 'A', stars: 4.5 });
    expect(food.nutritionalScore).not.toHaveProperty('partial');
  });

  it('gives a vegetable its 5 stars, which a record that could not be read could never reach (4 at best)', async () => {
    expect((await load(broccoli, 'real-broccoli')).nutritionalScore).toEqual({ score: 'A', stars: 5 });
  });

  it('reads "Saturated Fat" whole: not the "Monounsaturated Fat" in front of it', async () => {
    const food = await load(cheddar, 'real-cheddar');
    expect(food.nutritionalDetails.saturatedFat).toBe(19.2);
    expect(food.sodium).toBe(654);
    expect(food.nutritionalScore).toEqual({ score: 'E', stars: 1 });
  });

  it('takes the sodium of an oil, which the record does not list, as 0, and rates it without holding it back', async () => {
    const food = await load(oliveOil, 'real-oil');
    expect(food.sodium).toBe(0);
    expect(food.nutritionalDetails.saturatedFat).toBe(14.5);
    expect(food.nutritionalScore).toEqual({ score: 'E', stars: 1 });
    expect(food.nutritionalScore).not.toHaveProperty('partial');
  });

  it('does not guess the sodium of a food that is not a pure fat: chicken with no sodium listed stays partial', async () => {
    const noSodium = { ...chickenBreast, nutrients: chickenBreast.nutrients.filter((e) => e.name !== 'Sodium') };
    const food = await load(noSodium, 'real-chicken-no-sodium');
    expect(food.sodium).toBeUndefined();
    expect(food.nutritionalScore).toEqual({ score: 'B', stars: 4, partial: true });
  });

  it('leaves a fat with no saturated fat listed partial: an oil\'s sodium is settled, its saturated fat is not', async () => {
    // (Made up: a fat whose record lists only its energy and fat. The real avocado oil record does list its saturated fat.)
    const avocadoOil = { ...oliveOil, id: 8098800, name: 'Oil, Avocado', nutrients: [entry('Energy (kcal)', 'kcal', 884), entry('Total Fat', 'g', 100)] };
    const food = await load(avocadoOil, 'real-avocado-oil');
    expect(food.sodium).toBe(0);
    expect(food.nutritionalScore).toMatchObject({ partial: true });
  });

  it('leaves a search row partial (its list has no sodium or saturated fat), and completes it from the record', async () => {
    mockCall.mockResolvedValueOnce({ data: { data: [{ ...cheddarRow, id: 'row-cheddar' }] } });
    const { results } = await searchFoodsDetailed('real cheddar row');
    expect(results[0].nutritionalScore).toEqual({ score: 'C', stars: 3, partial: true });
    mockCall.mockResolvedValueOnce({ data: { data: { ...cheddar, id: 'row-cheddar' } } });
    const full = await withFullRating(results[0]);
    expect(full.nutritionalScore).toEqual({ score: 'E', stars: 1 });
    expect(full.nutritionalDetails.saturatedFat).toBe(19.2);
  });

  describe('reading one figure from the list', () => {
    const rated = async (key, nutrients, extra = {}) => {
      mockCall.mockResolvedValueOnce({ data: { data: { id: key, name: 'Test', calories_100g: 120, protein_100g: 5, carbs_100g: 10, fat_100g: 6, fiber_100g: 1, sugar_100g: 2, nutrients, ...extra } } });
      return getFoodById(key);
    };

    it('takes `name` from a record and `nutrient_name` from a row, in any capital letters', async () => {
      expect((await rated('u-1', [entry('SODIUM', 'mg', 200)])).sodium).toBe(200);
      expect((await rated('u-2', [{ nutrient_name: 'sodium', unit: 'mg', amount: 210 }])).sodium).toBe(210);
      expect((await rated('u-3', [{ name: '  Sodium ', amount: 220 }])).sodium).toBe(220);
    });

    it('reads it in the unit the rating uses, whatever unit the list gives it in', async () => {
      expect((await rated('u-4', [entry('Sodium', 'g', 0.3)])).sodium).toBe(300);
      expect((await rated('u-5', [entry('Sodium', 'mcg', 150000)])).sodium).toBe(150);
      expect((await rated('u-6', [entry('Saturated Fat', 'mg', 3000)])).nutritionalDetails.saturatedFat).toBe(3);
    });

    it('takes a figure with no unit (or an empty one) to be in the usual one, and a unit in any capitals or spaces', async () => {
      expect((await rated('u-7', [{ name: 'Sodium', amount: 180 }])).sodium).toBe(180);
      expect((await rated('u-7b', [{ name: 'Sodium', unit: '', amount: 181 }])).sodium).toBe(181);
      expect((await rated('u-7c', [{ name: 'Sodium', unit: ' MG ', amount: 182 }])).sodium).toBe(182);
    });

    it('also knows the longer names a USDA-style list uses', async () => {
      const food = await rated('u-7d', [{ nutrient_name: 'Sodium, Na', amount: 240 }, { nutrient_name: 'Fatty acids, total saturated', amount: 6 }]);
      expect([food.sodium, food.nutritionalDetails.saturatedFat]).toEqual([240, 6]);
    });

    it('does not read a figure it cannot trust: an amount that is not a number, below 0, or in a unit that is not a weight', async () => {
      expect((await rated('u-8', [entry('Sodium', 'mg', 'lots')])).sodium).toBeUndefined();
      expect((await rated('u-9', [entry('Sodium', 'mg', -5)])).sodium).toBeUndefined();
      expect((await rated('u-10', [entry('Sodium', 'IU', 50)])).sodium).toBeUndefined();
      expect((await rated('u-11', [entry('Sodium', 'mg', null)])).sodium).toBeUndefined();
      expect((await rated('u-12', [entry('Sodium', 'mg', true)])).sodium).toBeUndefined();
      expect((await rated('u-12b', [entry('Sodium', 'mg', '')])).sodium).toBeUndefined();
    });

    it('keeps a real 0', async () => {
      const food = await rated('u-13', [entry('Sodium', 'mg', 0), entry('Saturated Fat', 'g', 0)]);
      expect(food.sodium).toBe(0);
      expect(food.nutritionalScore).not.toHaveProperty('partial');
    });

    it('prefers a top-level figure when the API ever sends one', async () => {
      const food = await rated('u-14', [entry('Sodium', 'mg', 999), entry('Saturated Fat', 'g', 9)], { sodium_100g: 12, saturated_fat_100g: 2 });
      expect([food.sodium, food.nutritionalDetails.saturatedFat]).toEqual([12, 2]);
    });

    it('copes with a list that is missing, empty or has odd entries', async () => {
      expect((await rated('u-15', undefined)).sodium).toBeUndefined();
      expect((await rated('u-16', [])).sodium).toBeUndefined();
      // (A list that is not a list at all: the food still loads, with no sodium.)
      expect((await rated('u-16b', 'oops'))).toMatchObject({ name: 'Test', calories: 120 });
      expect((await rated('u-16c', { name: 'Sodium', amount: 70 })).sodium).toBeUndefined();
      expect((await rated('u-17', [null, 'x', {}, entry('Sodium', 'mg', 70)])).sodium).toBe(70);
    });
  });
});

// Why nearly every chicken food was 3 stars: a search row lists no sodium and no saturated fat, and a food missing two figures it is
// judged on is held to C. The rating says so (partial) so the screens can tell a held-back grade from a real one.
describe('a rating held back by missing figures', () => {
  const breast = {
    id: 1501, name: 'Chicken Breast', calories_100g: 165, protein_100g: 31, carbs_100g: 0, fat_100g: 3.6, fiber_100g: 0, sugar_100g: 0,
  };
  const ratingOf = async (query, food) => {
    mockCall.mockResolvedValueOnce({ data: { data: [food] } });
    return (await searchFoodsDetailed(query)).results[0].nutritionalScore;
  };

  it('is marked partial, and is C, for chicken breast listed without sodium and saturated fat', async () => {
    expect(await ratingOf('partial breast', breast)).toEqual({ score: 'C', stars: 3, partial: true });
  });

  it('is the real grade, and not marked partial, once sodium and saturated fat are listed', async () => {
    const rated = await ratingOf('complete breast', { ...breast, id: 1502, sodium_100g: 74, saturated_fat_100g: 1 });
    expect(rated).toEqual({ score: 'A', stars: 4.5 });
    expect(rated).not.toHaveProperty('partial');
  });

  it('is marked partial with one figure missing as well', async () => {
    expect(await ratingOf('one missing', { ...breast, id: 1503, saturated_fat_100g: 1 })).toEqual({ score: 'B', stars: 4, partial: true });
  });

  it('gives the foods that the chicken search finds their own grades once the figures are there', async () => {
    const grade = async (id, food) => (await ratingOf(`spread ${id}`, { ...food, id })).score;
    const listed = { sodium_100g: 74, saturated_fat_100g: 1 };
    expect(await grade(1510, { ...breast, ...listed })).toBe('A');
    expect(await grade(1511, { name: 'Chicken wing, fried', calories_100g: 290, protein_100g: 27, carbs_100g: 3, fat_100g: 19, fiber_100g: 0, sugar_100g: 0, sodium_100g: 600, saturated_fat_100g: 5.3 })).toBe('D');
    expect(await grade(1512, { name: 'Chicken fat', calories_100g: 900, protein_100g: 0, carbs_100g: 0, fat_100g: 100, fiber_100g: 0, sugar_100g: 0, sodium_100g: 0, saturated_fat_100g: 30 })).toBe('E');
  });
});

describe('alcohol in the rating', () => {
  // Beer per 100 g, with no alcohol figure of its own.
  const beer = {
    name: 'Beer', calories_100g: 43, protein_100g: 0.5, carbs_100g: 3.6, fat_100g: 0, fiber_100g: 0,
    sugar_100g: 0, sodium_100g: 4, saturated_fat_100g: 0,
  };
  const rating = async (query, extra) => {
    mockCall.mockResolvedValueOnce({ data: { data: [{ ...beer, ...extra }] } });
    return (await searchFoodsDetailed(query)).results[0].nutritionalScore.score;
  };

  it('is worked out from the energy when the food lists none', async () => {
    expect(await rating('alcohol estimated', { id: 920 })).toBe('D');
  });

  it('is read from a top-level alcohol figure', async () => {
    expect(await rating('alcohol top level', { id: 921, alcohol_100g: 33 })).toBe('E');
    expect(await rating('alcohol top level zero', { id: 922, alcohol_100g: 0 })).toBe('B');
  });

  it('is read from the nutrients list ("Alcohol, ethyl")', async () => {
    const nutrients = [{ nutrient_name: 'Alcohol, ethyl', amount: 33 }];
    expect(await rating('alcohol in list', { id: 923, nutrients })).toBe('E');
  });

  it('does not take sugar alcohols for ethanol', async () => {
    const nutrients = [{ nutrient_name: 'Sugar alcohol', amount: 33 }];
    // The energy still gives the beer away, so it is D (not E).
    expect(await rating('sugar alcohol', { id: 924, nutrients })).toBe('D');
  });

  it('leaves an alcohol-free drink alone', async () => {
    expect(await rating('alcohol free', { id: 925, name: 'Non-alcoholic beer', calories_100g: 20, protein_100g: 0.2, carbs_100g: 4, alcohol_100g: 0.4 })).toBe('B');
  });
});

describe('calculateNutritionalScore', () => {
  it('is the food rating', () => {
    expect(calculateNutritionalScore({ calories: 52, protein: 0.3, fiber: 2.4, sugar: 10.4, saturatedFat: 0.03, sodium: 1 })).toBe('A');
    expect(calculateNutritionalScore({})).toBeNull();
  });
});

describe('looking up one food', () => {
  it('returns the real food', async () => {
    mockCall.mockResolvedValueOnce({ data: { data: apiFood({ id: 'real-1' }) } });
    const food = await getFoodById('real-1');
    expect(food.name).toBe('Chicken Soup');
    expect(food.calories).toBe(40);
    expect(mockFunctionsCalled).toEqual(['getCalorieApiFoodById']);
    expect(mockCall).toHaveBeenCalledWith({ id: 'real-1' });
  });

  it('returns nothing, not a stand-in food, when it cannot be loaded', async () => {
    mockCall.mockRejectedValueOnce(new Error('offline'));
    expect(await getFoodById('real-2')).toBeNull();
  });

  it('remembers a real food for the next time', async () => {
    mockCall.mockResolvedValueOnce({ data: { data: apiFood({ id: 'real-3' }) } });
    await getFoodById('real-3');
    await getFoodById('real-3');
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  // The numbers 1 to 10 were the ids of the ten foods the app used to make up when a search failed. Nothing real has
  // those ids, so one that turns up (an old "recent" food) is not looked up: it could come back as an unrelated food.
  it('does not look up the ids the old built-in foods had, and has no food for them', async () => {
    for (const id of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']) {
      expect(await getFoodById(id)).toBeNull();
    }
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('still looks up an id that only starts like one of them', async () => {
    mockCall.mockResolvedValueOnce({ data: { data: apiFood({ id: '11' }) } });
    expect((await getFoodById('11')).name).toBe('Chicken Soup');
    mockCall.mockResolvedValueOnce({ data: { data: apiFood({ id: '100' }) } });
    expect((await getFoodById('100')).name).toBe('Chicken Soup');
  });
});

// A search row is completed with the food's own record before it is logged: the record lists what the row cannot.
describe('withFullRating', () => {
  const row = {
    id: 'wf-1', name: 'Chicken Breast', servingSize: '170g', calories: 165, protein: 31, carbs: 0, fat: 3.6,
    fiber: 0, sugar: 0, nutritionalScore: { score: 'C', partial: true }, nutritionalDetails: { saturatedFat: 0, sugar: 0, fiber: 0, sodium: 0 },
  };
  const record = (extra = {}) => ({
    id: 'wf-1', name: 'Chicken breast, roasted', calories_100g: 165, protein_100g: 31, carbs_100g: 0, fat_100g: 3.6, fiber_100g: 0, sugar_100g: 0,
    sodium_100g: 74, saturated_fat_100g: 1, ...extra,
  });

  it('gives back the row with the rating and nutrition figures of the food\'s own record', async () => {
    mockCall.mockResolvedValueOnce({ data: { data: record() } });
    const out = await withFullRating(row);
    expect(mockCall).toHaveBeenCalledWith({ id: 'wf-1' });
    expect(out.nutritionalScore).toEqual({ score: 'A', stars: 4.5 });
    expect(out.sodium).toBe(74);
    expect(out.nutritionalDetails).toEqual({ saturatedFat: 1, sugar: 0, fiber: 0, sodium: 74 });
  });

  it('keeps everything else about the row as it was, the name and the serving the person picked above all', async () => {
    mockCall.mockResolvedValueOnce({ data: { data: record({ id: 'wf-2' }) } });
    const out = await withFullRating({ ...row, id: 'wf-2' });
    expect(out).toMatchObject({ id: 'wf-2', name: 'Chicken Breast', servingSize: '170g', calories: 165, protein: 31 });
  });

  it('takes the fibre and sugar from the record when it lists them, since the row may not', async () => {
    mockCall.mockResolvedValueOnce({ data: { data: record({ id: 'wf-3b', fiber_100g: 2.5, sugar_100g: 1.5 }) } });
    const out = await withFullRating({ ...row, id: 'wf-3b', fiber: 0, sugar: 0 });
    expect(out).toMatchObject({ fiber: 2.5, sugar: 1.5 });
  });

  it('keeps a figure of the row that the record does not list', async () => {
    // (12 g of carbohydrate, so the record cannot be taken to have no sugar: see lib/completeFigures.js.)
    mockCall.mockResolvedValueOnce({ data: { data: record({ id: 'wf-3', carbs_100g: 12, fiber_100g: undefined, sugar_100g: undefined, sodium_100g: undefined }) } });
    const out = await withFullRating({ ...row, id: 'wf-3', fiber: 1.5, sugar: 2.5, sodium: 40 });
    expect(out).toMatchObject({ fiber: 1.5, sugar: 2.5, sodium: 40 });
  });

  it('gives back the row as it was when the record cannot be loaded', async () => {
    mockCall.mockRejectedValueOnce(new Error('offline'));
    expect(await withFullRating({ ...row, id: 'wf-4' })).toEqual({ ...row, id: 'wf-4' });
  });

  it('gives back the row as it was when the record comes with no rating (no energy figure)', async () => {
    mockCall.mockResolvedValueOnce({ data: { data: record({ id: 'wf-5', calories_100g: undefined }) } });
    expect(await withFullRating({ ...row, id: 'wf-5' })).toEqual({ ...row, id: 'wf-5' });
  });

  it('does not look up the ids the old built-in foods had', async () => {
    const old = { ...row, id: '3' };
    expect(await withFullRating(old)).toBe(old);
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('uses a record already loaded, without asking again', async () => {
    mockCall.mockResolvedValueOnce({ data: { data: record({ id: 'wf-6' }) } });
    await getFoodById('wf-6');
    const out = await withFullRating({ ...row, id: 'wf-6' });
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(out.nutritionalScore).toEqual({ score: 'A', stars: 4.5 });
  });

  describe('when the record is slow', () => {
    beforeEach(() => { jest.useFakeTimers(); });
    afterEach(() => { jest.useRealTimers(); });

    it('gives back the row as it was after 6 seconds, and not before', async () => {
      mockCall.mockReturnValueOnce(new Promise(() => {}));
      let out;
      const waiting = withFullRating({ ...row, id: 'wf-7' }).then((food) => { out = food; });
      await jest.advanceTimersByTimeAsync(5999);
      expect(out).toBeUndefined();
      await jest.advanceTimersByTimeAsync(1);
      await waiting;
      expect(out).toEqual({ ...row, id: 'wf-7' });
    });

    it('does not leave its timer running once the record has come', async () => {
      mockCall.mockResolvedValueOnce({ data: { data: record({ id: 'wf-8' }) } });
      await withFullRating({ ...row, id: 'wf-8' });
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});

// A figure the record leaves out can come from USDA FoodData Central (lib/usdaFill.js says when it is safe; the searchUsdaFoods
// function sends the foods). Each test uses its own food name: the foods found for a name are kept for the session.
describe('figures a record leaves out, from USDA FoodData Central', () => {
  const entry = (name, unit, amount) => ({ name, unit, amount, nutrient_id: 1 });
  let n = 0;
  // An orange juice record that lists its saturated fat and fibre but not its sodium.
  const juiceRecord = (extra = {}) => {
    n += 1;
    return {
      id: `usda-${n}`, name: `Orange Juice ${n}`, brand_name: 'Verified', calories_100g: 48, protein_100g: 0.5, carbs_100g: 11, fat_100g: 0.5, fiber_100g: 0.2, sugar_100g: 8.5,
      nutrients: [entry('Fiber', 'g', 0.2), entry('Saturated Fat', 'g', 0.05), entry('Sugars', 'g', 8.5), entry('Total Fat', 'g', 0.5)], ...extra,
    };
  };
  const usdaFood = (macros, { fibre = null, sodium = null, satFat = null } = {}) => ({
    fdcId: 1, description: 'x', dataType: 'SR Legacy', kcal: macros[0], protein: macros[1], fat: macros[2], carbs: macros[3], fibre, sodium, satFat,
  });
  const juiceFoods = [[4, 0.3], [2, 0.5], [2, 0.4], [0, 0.4]].map(([sodium, satFat]) => usdaFood([47, 0.6, 0.2, 11], { fibre: 0.2, sodium, satFat }));
  const serve = (record) => mockCall.mockResolvedValueOnce({ data: { data: record } });
  const knows = (foods) => mockUsda.mockResolvedValue({ data: { foods } });

  it('fills in a sodium the record does not list when the foods that agree put it in the same place', async () => {
    const record = juiceRecord();
    serve(record);
    knows(juiceFoods);
    const food = await getFoodById(record.id);
    expect(mockUsda).toHaveBeenCalledWith({ query: record.name });
    expect(food.sodium).toBe(2);
    expect(food.nutritionalDetails.sodium).toBe(2);
    expect(food.estimated).toEqual(['sodium']);
    expect(food.nutritionalScore.partial).toBeUndefined();
  });

  it('gives the food the rating it would have had if the record had listed that sodium', async () => {
    const filled = juiceRecord();
    serve(filled);
    knows(juiceFoods);
    const listed = juiceRecord({ sodium_100g: 2 });
    serve(listed);
    const [a, b] = [await getFoodById(filled.id), await getFoodById(listed.id)];
    expect(a.nutritionalScore).toEqual(b.nutritionalScore);
    expect(a.nutritionalScore.partial).toBeUndefined();
  });

  it('leaves the food as it was when too few foods agree', async () => {
    const record = juiceRecord();
    serve(record);
    knows(juiceFoods.slice(0, 2));
    const food = await getFoodById(record.id);
    expect(food.sodium).toBeUndefined();
    expect(food.estimated).toBeUndefined();
    expect(food.nutritionalScore.partial).toBe(true);
  });

  it('leaves the food as it was when the foods that agree do not put the figure in the same place', async () => {
    const record = juiceRecord();
    serve(record);
    knows([70, 75, 85].map((sodium) => usdaFood([47, 0.6, 0.2, 11], { sodium })));
    const food = await getFoodById(record.id);
    expect(food.sodium).toBeUndefined();
    expect(food.nutritionalScore.partial).toBe(true);
  });

  it('never changes a figure the record lists', async () => {
    const record = juiceRecord({ sodium_100g: 9 });
    serve(record);
    knows(juiceFoods);
    const food = await getFoodById(record.id);
    expect(food.sodium).toBe(9);
    expect(food.estimated).toBeUndefined();
    expect(mockFunctionsCalled).not.toContain('searchUsdaFoods');
  });

  it('does not ask about a food that lists everything, or can be worked out from its own numbers', async () => {
    const complete = juiceRecord({ sodium_100g: 4 });
    serve(complete);
    await getFoodById(complete.id);
    const oil = juiceRecord({ name: 'Olive Oil usda', calories_100g: 884, protein_100g: 0, carbs_100g: 0, fat_100g: 100, fiber_100g: 0, sugar_100g: 0, nutrients: [entry('Saturated Fat', 'g', 14.5), entry('Fiber', 'g', 0)] });
    serve(oil);
    await getFoodById(oil.id);
    expect(mockFunctionsCalled).toEqual(['getCalorieApiFoodById', 'getCalorieApiFoodById']);
    expect(mockUsda).not.toHaveBeenCalled();
  });

  it('asks for a saturated fat the record does not list', async () => {
    const record = juiceRecord({ nutrients: [entry('Fiber', 'g', 0.2), entry('Sodium', 'mg', 4)] });
    serve(record);
    knows(juiceFoods);
    const food = await getFoodById(record.id);
    expect(food.estimated).toEqual(['saturatedFat']);
    expect(food.nutritionalDetails.saturatedFat).toBe(0.4);
  });

  it('asks for more than one figure at once', async () => {
    const record = juiceRecord({ nutrients: [entry('Fiber', 'g', 0.2)] });
    serve(record);
    knows(juiceFoods);
    const food = await getFoodById(record.id);
    expect(mockUsda).toHaveBeenCalledTimes(1);
    expect(food.estimated).toEqual(['sodium', 'saturatedFat']);
    expect(food.sodium).toBe(2);
    expect(food.nutritionalDetails).toMatchObject({ sodium: 2, saturatedFat: 0.4 });
  });

  describe('fibre', () => {
    // Almonds as the Calorie API sends them: a list with no Fiber entry, and 0 at the top. They hold about 12 g.
    const almonds = (extra = {}) => {
      n += 1;
      return {
        id: `usda-${n}`, name: `Almonds ${n}`, brand_name: 'Verified', calories_100g: 612, protein_100g: 21, carbs_100g: 10, fat_100g: 52, fiber_100g: 0, sugar_100g: 4.9,
        nutrients: [entry('Saturated Fat', 'g', 4.1), entry('Sodium', 'mg', 320), entry('Sugars', 'g', 4.9)], ...extra,
      };
    };
    const almondFoods = [9, 12, 12.5].map((fibre) => usdaFood([600, 21, 50, 11], { fibre, sodium: 1, satFat: 3.7 }));

    it('is filled in for a food whose record has no Fiber entry, when the foods that agree put it in the same place', async () => {
      const record = almonds();
      serve(record);
      knows(almondFoods);
      const food = await getFoodById(record.id);
      expect(food.fiber).toBe(12);
      expect(food.nutritionalDetails.fiber).toBe(12);
      expect(food.estimated).toEqual(['fiber']);
    });

    it('is not asked about when the record lists it, even as 0', async () => {
      const record = almonds({ nutrients: [entry('Saturated Fat', 'g', 4.1), entry('Sodium', 'mg', 320), entry('Fiber', 'g', 0)] });
      serve(record);
      knows(almondFoods);
      const food = await getFoodById(record.id);
      expect(food.fiber).toBe(0);
      expect(mockUsda).not.toHaveBeenCalled();
    });

    it('is not asked about when the top-level figure is more than 0', async () => {
      const record = almonds({ fiber_100g: 2 });
      serve(record);
      knows(almondFoods);
      expect((await getFoodById(record.id)).fiber).toBe(2);
      expect(mockUsda).not.toHaveBeenCalled();
    });

    it('is not asked about when the record has no list of nutrients to tell from', async () => {
      for (const nutrients of [undefined, []]) {
        const record = almonds({ nutrients: undefined });
        record.nutrients = nutrients;
        serve({ ...record, sodium_100g: 320, saturated_fat_100g: 4.1 });
        await getFoodById(record.id);
      }
      expect(mockUsda).not.toHaveBeenCalled();
    });

    it('is only asked about for a food with 3 g of carbohydrate or more (under that it cannot hold the 3 g that earn a point)', async () => {
      const low = almonds({ carbs_100g: 2.99 });
      serve(low);
      knows(almondFoods);
      await getFoodById(low.id);
      expect(mockUsda).not.toHaveBeenCalled();
      const enough = almonds({ carbs_100g: 3, calories_100g: 590 });
      serve(enough);
      await getFoodById(enough.id);
      expect(mockUsda).toHaveBeenCalledTimes(1);
    });

    it('reads a Fiber entry in any of the names the API might use', async () => {
      for (const name of ['Fiber', 'Fibre', 'Dietary Fiber', 'Fiber, total dietary']) {
        const record = almonds({ nutrients: [entry('Saturated Fat', 'g', 4.1), entry('Sodium', 'mg', 320), entry(name, 'g', 0)] });
        serve(record);
        await getFoodById(record.id);
      }
      expect(mockUsda).not.toHaveBeenCalled();
    });
  });

  describe('when USDA cannot be had', () => {
    it('gives the food as it was, and goes on to ask again for the next food of that name', async () => {
      const record = juiceRecord();
      serve(record);
      mockUsda.mockRejectedValueOnce(new Error('offline'));
      const food = await getFoodById(record.id);
      expect(food.sodium).toBeUndefined();
      expect(food.nutritionalScore.partial).toBe(true);
      expect(food.estimated).toBeUndefined();

      const again = juiceRecord({ name: record.name });
      serve(again);
      knows(juiceFoods);
      expect((await getFoodById(again.id)).sodium).toBe(2);
      expect(mockUsda).toHaveBeenCalledTimes(2);
    });

    it('gives the food as it was when the answer has no list of foods, and asks again next time', async () => {
      const record = juiceRecord();
      serve(record);
      mockUsda.mockResolvedValue({ data: {} });
      expect((await getFoodById(record.id)).sodium).toBeUndefined();
      const none = juiceRecord();
      serve(none);
      mockUsda.mockResolvedValue(undefined);
      expect((await getFoodById(none.id)).sodium).toBeUndefined();

      // The same name again, now with a real answer: the empty ones were not remembered.
      const again = juiceRecord({ name: record.name });
      serve(again);
      knows(juiceFoods);
      expect((await getFoodById(again.id)).sodium).toBe(2);
    });

    it('does not wait for it for more than 2 seconds', async () => {
      jest.useFakeTimers();
      try {
        const record = juiceRecord();
        serve(record);
        mockUsda.mockReturnValue(new Promise(() => {}));
        let food;
        const waiting = getFoodById(record.id).then((f) => { food = f; });
        await jest.advanceTimersByTimeAsync(1999);
        expect(food).toBeUndefined();
        await jest.advanceTimersByTimeAsync(1);
        await waiting;
        expect(food.name).toBe(record.name);
        expect(food.sodium).toBeUndefined();
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    });

    it('does not leave its timer running once USDA has answered', async () => {
      jest.useFakeTimers();
      try {
        const record = juiceRecord();
        serve(record);
        knows(juiceFoods);
        await getFoodById(record.id);
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  it('keeps the foods found for a name for the session, an empty list as well', async () => {
    const record = juiceRecord();
    serve(record);
    knows(juiceFoods);
    await getFoodById(record.id);
    const same = juiceRecord({ name: record.name });
    serve(same);
    expect((await getFoodById(same.id)).sodium).toBe(2);
    expect(mockUsda).toHaveBeenCalledTimes(1);

    const other = juiceRecord();
    serve(other);
    knows([]);
    await getFoodById(other.id);
    const otherAgain = juiceRecord({ name: other.name.toUpperCase() });
    serve(otherAgain);
    await getFoodById(otherAgain.id);
    expect(mockUsda).toHaveBeenCalledTimes(2);
  });

  it('does not look up a food with no name', async () => {
    const record = juiceRecord({ name: '   ' });
    serve(record);
    knows(juiceFoods);
    expect((await getFoodById(record.id)).sodium).toBeUndefined();
    expect(mockUsda).not.toHaveBeenCalled();
  });

  it('does not look up a search row: the row has no figures to tell, and the food\'s own record is looked up when it is logged', async () => {
    mockCall.mockResolvedValueOnce({ data: { data: [{ ...juiceRecord(), nutrients: undefined, sodium_100g: undefined }] } });
    const { results } = await searchFoodsDetailed('orange juice usda row');
    expect(results).toHaveLength(1);
    expect(results[0].estimated).toBeUndefined();
    expect(mockFunctionsCalled).toEqual(['searchCalorieApiFoods']);
  });

  it('gives a search row that is logged the filled figure, the note about it, and a rating that is no longer limited', async () => {
    const record = juiceRecord();
    serve(record);
    knows(juiceFoods);
    const row = {
      id: record.id, name: record.name, servingSize: '100g', calories: 48, protein: 0.5, carbs: 11, fat: 0.5,
      nutritionalScore: { score: 'B', partial: true }, nutritionalDetails: { saturatedFat: 0, sugar: 8.5, fiber: 0, sodium: 0 },
    };
    const out = await withFullRating(row);
    expect(out.estimated).toEqual(['sodium']);
    expect(out.sodium).toBe(2);
    expect(out.nutritionalScore.partial).toBeUndefined();
    expect(out.name).toBe(record.name);
  });

  it('leaves `estimated` off a row whose record had nothing filled in', async () => {
    const record = juiceRecord({ sodium_100g: 5 });
    serve(record);
    const out = await withFullRating({ id: record.id, name: 'x', nutritionalScore: { score: 'B', partial: true } });
    expect('estimated' in out).toBe(false);
  });
});
