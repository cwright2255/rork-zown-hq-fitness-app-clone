const mockCall = jest.fn();
jest.mock('firebase/functions', () => ({ httpsCallable: () => mockCall }), { virtual: true });
jest.mock('../src/config/firebase', () => ({ functions: {} }));

import { searchFoodsDetailed, searchFoods } from '../services/calorieApiService';

const apiFood = (extra = {}) => ({
  id: 77, name: 'Chicken Soup', calories_100g: 40, protein_100g: 3, carbs_100g: 4, fat_100g: 1.2,
  fiber_100g: 0.5, sugar_100g: 1, sodium_100g: 300, saturated_fat_100g: 0.3, ...extra,
});

let errorSpy;
beforeEach(() => {
  mockCall.mockReset();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

describe('searchFoodsDetailed', () => {
  it('returns the real results and says they are not a fallback', async () => {
    mockCall.mockResolvedValueOnce({ data: { data: [apiFood()] } });
    const { results, fallback } = await searchFoodsDetailed('soup real');
    expect(fallback).toBe(false);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Chicken Soup');
    expect(results[0].calories).toBe(40);
  });

  it('says so when the search could not be reached and only the built-in list is shown', async () => {
    mockCall.mockRejectedValueOnce(new Error('offline'));
    const { results, fallback } = await searchFoodsDetailed('chicken');
    expect(fallback).toBe(true);
    expect(results.map((f) => f.name)).toEqual(['Chicken Breast']);
  });

  it('shows an empty list, still marked as a fallback, when nothing built-in matches', async () => {
    mockCall.mockRejectedValueOnce(new Error('offline'));
    const { results, fallback } = await searchFoodsDetailed('dragonfruit smoothie');
    expect(fallback).toBe(true);
    expect(results).toEqual([]);
  });

  it('does not remember a fallback: the next try goes back to the real search', async () => {
    mockCall.mockRejectedValueOnce(new Error('offline'));
    const first = await searchFoodsDetailed('chicken retry');
    expect(first.fallback).toBe(true);

    mockCall.mockResolvedValueOnce({ data: { data: [apiFood({ name: 'Chicken Wrap' })] } });
    const second = await searchFoodsDetailed('chicken retry');
    expect(second.fallback).toBe(false);
    expect(second.results[0].name).toBe('Chicken Wrap');
  });

  it('remembers a real result for a few minutes', async () => {
    mockCall.mockResolvedValueOnce({ data: { data: [apiFood()] } });
    await searchFoodsDetailed('soup cached');
    const again = await searchFoodsDetailed('soup cached');
    expect(again.fallback).toBe(false);
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  it('returns nothing for an empty search', async () => {
    expect(await searchFoodsDetailed('   ')).toEqual({ results: [], fallback: false });
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
