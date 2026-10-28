// The Recipes tab's service calls (services/recipeExtractionService.js): the browse results now carry the nutrition the ranking
// needs, still carry the short labels the cards always showed, and a recipe opened from the tab remembers its Spoonacular id.
jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn() }), { virtual: true });
jest.mock('@/services/llmClient', () => ({ askLLM: jest.fn() }));

import recipeExtractionService from '../services/recipeExtractionService';

const raw = (over = {}) => ({
  id: 716429, title: 'Pasta with Garlic', image: 'https://img/1.jpg', readyInMinutes: 45, servings: 2, healthScore: 31, aggregateLikes: 209,
  dishTypes: ['Lunch', 'main course'], cuisines: ['Italian'],
  nutrition: { nutrients: [{ name: 'Calories', amount: 584.4 }, { name: 'Protein', amount: 19.9 }, { name: 'Carbohydrates', amount: 89 }, { name: 'Fat', amount: 18.4 }] },
  ...over,
});

const mockCalls = [];
let mockReply = {};
beforeEach(() => {
  mockCalls.length = 0;
  mockReply = {};
  jest.spyOn(recipeExtractionService, 'callCloudFunction').mockImplementation(async (name, payload) => {
    mockCalls.push([name, payload]);
    if (mockReply instanceof Error) throw mockReply;
    return { data: mockReply };
  });
});
afterEach(() => { jest.restoreAllMocks(); });

describe('getSpoonacularBrowse', () => {
  it('passes the question through unchanged and maps each result, keeping the short labels', async () => {
    mockReply = { results: [raw()] };
    const out = await recipeExtractionService.getSpoonacularBrowse({ type: 'main course' }, 12);
    expect(mockCalls).toEqual([['browseSpoonacularRecipes', { params: { type: 'main course' }, number: 12 }]]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: '716429', name: 'Pasta with Garlic', imageUrl: 'https://img/1.jpg', cal: '584 cal', time: '45 min',
      calories: 584.4, protein: 19.9, carbs: 89, fat: 18.4, minutes: 45, healthScore: 31, likes: 209, servings: 2,
      dishTypes: ['lunch', 'main course'], cuisines: ['italian'],
    });
  });

  it('leaves out a result that is not a recipe, and keeps the labels empty when a figure is missing', async () => {
    mockReply = { results: [null, { title: 'no id' }, raw({ id: 2, nutrition: undefined, readyInMinutes: undefined })] };
    const out = await recipeExtractionService.getSpoonacularBrowse({});
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: '2', cal: '', time: '', calories: null, minutes: null });
  });

  it('gives an empty list, and a reason, when the call fails', async () => {
    mockReply = new Error('offline');
    expect(await recipeExtractionService.getSpoonacularBrowse({})).toEqual([]);
    expect(recipeExtractionService.lastDiagnostic).toContain('offline');
  });
});

describe('getSpoonacularBrowseBatch', () => {
  it('maps every section by its key', async () => {
    mockReply = { sections: [{ key: 'pool', results: [raw(), raw({ id: 3 })] }, { key: 'quickEasy', results: [raw({ id: 4 })] }, { key: 'empty' }] };
    const out = await recipeExtractionService.getSpoonacularBrowseBatch([{ key: 'pool', params: {}, number: 36 }]);
    expect(mockCalls[0][0]).toBe('browseSpoonacularRecipesBatch');
    expect(Object.keys(out)).toEqual(['pool', 'quickEasy', 'empty']);
    expect(out.pool.map((r) => r.id)).toEqual(['716429', '3']);
    expect(out.pool[0]).toMatchObject({ cal: '584 cal', protein: 19.9, cuisines: ['italian'] });
    expect(out.empty).toEqual([]);
  });

  it('gives nothing, and a reason, when the call fails', async () => {
    mockReply = new Error('timeout');
    expect(await recipeExtractionService.getSpoonacularBrowseBatch([])).toEqual({});
    expect(recipeExtractionService.lastDiagnostic).toContain('timeout');
  });
});

describe('getSpoonacularById', () => {
  it('remembers which Spoonacular recipe it is', async () => {
    mockReply = { id: 716429, title: 'Pasta with Garlic', extendedIngredients: [], analyzedInstructions: [], servings: 2 };
    const out = await recipeExtractionService.getSpoonacularById(716429);
    expect(out).toMatchObject({ name: 'Pasta with Garlic', sourceId: '716429' });
  });

  it('falls back to the id it was asked for', async () => {
    mockReply = { title: 'Soup' };
    expect((await recipeExtractionService.getSpoonacularById('55')).sourceId).toBe('55');
  });

  it('is null when the call fails', async () => {
    mockReply = new Error('nope');
    expect(await recipeExtractionService.getSpoonacularById(1)).toBeNull();
  });
});
