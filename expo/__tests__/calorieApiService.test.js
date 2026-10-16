const mockCall = jest.fn();
const mockFunctionsCalled = [];
jest.mock('firebase/functions', () => ({ httpsCallable: (_functions, name) => { mockFunctionsCalled.push(name); return mockCall; } }), { virtual: true });
jest.mock('../src/config/firebase', () => ({ functions: {} }));

import { searchFoodsDetailed, searchFoods, getFoodById, calculateNutritionalScore, gradeToStars, gradeToMealStars } from '../services/calorieApiService';

const apiFood = (extra = {}) => ({
  id: 77, name: 'Chicken Soup', calories_100g: 40, protein_100g: 3, carbs_100g: 4, fat_100g: 1.2,
  fiber_100g: 0.5, sugar_100g: 1, sodium_100g: 300, saturated_fat_100g: 0.3, ...extra,
});

let errorSpy;
beforeEach(() => {
  mockCall.mockReset();
  mockFunctionsCalled.length = 0;
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

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
    expect(await rating('rating soup', {}, 901)).toEqual({ score: 'B' });
  });

  it('puts a biscuit at the bottom', async () => {
    mockCall.mockResolvedValueOnce({ data: { data: [cookie] } });
    const { results } = await searchFoodsDetailed('rating cookie');
    expect(results[0].nutritionalScore).toEqual({ score: 'E' });
  });

  it('is left off, so no stars show, when the food has no energy figure', async () => {
    mockCall.mockResolvedValueOnce({ data: { data: [apiFood({ id: 902, calories_100g: undefined })] } });
    const { results } = await searchFoodsDetailed('rating no energy');
    expect(results[0]).not.toHaveProperty('nutritionalScore');
    expect(results[0].calories).toBe(0);
  });

  it('is rated for a real 0 kcal', async () => {
    expect(await rating('rating water', { name: 'Water', calories_100g: 0, protein_100g: 0, fiber_100g: 0, sugar_100g: 0, sodium_100g: 2, saturated_fat_100g: 0 }, 903)).toEqual({ score: 'B' });
  });

  it('counts the fibre', async () => {
    // 200 kcal that the carbohydrate and fat account for.
    const dense = { calories_100g: 200, protein_100g: 0, carbs_100g: 40, fat_100g: 4.4, sugar_100g: 1, sodium_100g: 10, saturated_fat_100g: 0 };
    expect(await rating('rating fibre', { ...dense, fiber_100g: 7.5 }, 911)).toEqual({ score: 'A' });
    expect(await rating('rating no fibre', { ...dense, fiber_100g: undefined }, 912)).toEqual({ score: 'B' });
  });

  it('uses the carbohydrate to fill in a missing sugar figure', async () => {
    const lean = { calories_100g: 30, protein_100g: 5, fiber_100g: 4, sodium_100g: 10, saturated_fat_100g: 0, sugar_100g: undefined };
    // 20 g of carbohydrate could be mostly sugar: one figure missing, B at best.
    expect(await rating('rating carbs high', { ...lean, id: 904, carbs_100g: 20 }, 904)).toEqual({ score: 'B' });
    // 2 g of carbohydrate cannot hold more than 3.4 g of sugar: nothing missing.
    expect(await rating('rating carbs low', { ...lean, id: 905, carbs_100g: 2 }, 905)).toEqual({ score: 'A' });
  });

  it('uses the fat to fill in a missing saturated fat figure', async () => {
    const lean = { calories_100g: 30, protein_100g: 5, fiber_100g: 4, sodium_100g: 10, sugar_100g: 1, carbs_100g: 6, saturated_fat_100g: undefined };
    expect(await rating('rating fat high', { ...lean, fat_100g: 5 }, 906)).toEqual({ score: 'B' });
    expect(await rating('rating fat low', { ...lean, fat_100g: 0.5 }, 907)).toEqual({ score: 'A' });
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

describe('grades as stars', () => {
  it('shows A to E as 5 to 1 stars', () => {
    expect(['A', 'B', 'C', 'D', 'E'].map(gradeToStars)).toEqual([5, 4, 3, 2, 1]);
  });

  it('gives the experience tiers 5, 4 and 3 stars, with C to E sharing the lowest', () => {
    expect(['A', 'B', 'C', 'D', 'E'].map(gradeToMealStars)).toEqual([5, 4, 3, 3, 3]);
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
