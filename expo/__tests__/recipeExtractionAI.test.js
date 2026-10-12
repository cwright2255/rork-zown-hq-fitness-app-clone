jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn() }), { virtual: true });
jest.mock('@/services/llmClient', () => ({ askLLM: (...a) => global.__askLLM(...a) }));

import recipeExtractionService from '../services/recipeExtractionService';

const recipe = {
  name: 'Garlic Noodles',
  ingredients: [{ name: 'noodles', amount: 200, unit: 'g' }],
  instructions: ['Boil the noodles', 'Toss with garlic'],
  servings: 2,
};
const metadata = { title: 'Garlic Noodles', description: 'Fast and good' };
const url = 'https://example.org/garlic-noodles';

beforeEach(() => {
  global.__askLLM = jest.fn(async () => JSON.stringify(recipe));
  global.fetch = jest.fn();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); });

describe('AI recipe extraction', () => {
  it('asks the AI through the app\'s AI function, with the page details in one message', async () => {
    await recipeExtractionService.extractRecipeWithAI(metadata, url, 'web');
    expect(global.__askLLM).toHaveBeenCalledTimes(1);
    const messages = global.__askLLM.mock.calls[0][0];
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toContain('Title: Garlic Noodles');
    expect(messages[0].content).toContain('Description: Fast and good');
    expect(messages[0].content).toContain(`URL: ${url}`);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns the recipe the AI found', async () => {
    await expect(recipeExtractionService.extractRecipeWithAI(metadata, url, 'web')).resolves.toEqual(recipe);
  });

  it('reads a recipe the AI puts inside a sentence or a code fence', async () => {
    global.__askLLM = jest.fn(async () => 'Sure!\n```json\n' + JSON.stringify(recipe) + '\n```');
    await expect(recipeExtractionService.extractRecipeWithAI(metadata, url, 'web')).resolves.toEqual(recipe);
  });

  it('returns null when the AI finds no recipe', async () => {
    for (const reply of ['null', 'No recipe here', '{"name":"Soup"}', '{"name":"Soup","ingredients":[]}', '{broken']) {
      global.__askLLM = jest.fn(async () => reply);
      await expect(recipeExtractionService.extractRecipeWithAI(metadata, url, 'web')).resolves.toBeNull();
    }
  });

  it('returns null instead of throwing when the AI cannot be reached', async () => {
    global.__askLLM = jest.fn(async () => { throw new Error('functions/unavailable'); });
    await expect(recipeExtractionService.extractRecipeWithAI(metadata, url, 'web')).resolves.toBeNull();
  });

  it('does not use the AI at all when the page already has a complete recipe', async () => {
    const full = {
      name: 'Toast',
      ingredients: ['2 slices bread'],
      instructions: ['Toast the bread'],
      nutrition: { calories: 120 },
    };
    const result = await recipeExtractionService.extractRecipeWithAI({ ...metadata, jsonLdRecipe: full }, url, 'web');
    expect(result.name).toBe('Toast');
    expect(global.__askLLM).not.toHaveBeenCalled();
  });
});
