// What a recipe request to postLLM sends back (functions/src/recipeReply.js): only a recipe, in the shape the app saves, with every
// field cut to size, or null. The topic check is left out of that request, and this is what stops it being used to ask the model
// anything else.
import { readRecipe } from '../functions/src/recipeReply';

const full = {
  name: 'Fiesta Taco Potato Skillet',
  description: 'An easy weeknight dinner',
  ingredients: [
    { id: '1', name: '5 small potatoes', amount: 5, unit: 'whole' },
    { id: '2', name: '1 lb ground beef', amount: 1, unit: 'lb' },
  ],
  instructions: ['Cube the potatoes', 'Brown the beef'],
  prepTime: 15,
  cookTime: 30,
  servings: 4,
  difficulty: 'easy',
  category: 'dinner',
  tags: ['skillet', 'weeknight'],
  dietaryTags: ['gluten-free'],
  imageUrl: 'https://cdn.example/pic.jpg',
  author: 'cookinginthemidwest',
  nutrition: { calories: 520, protein: 32, carbs: 40, fat: 24, fiber: 5 },
};
const json = (value) => JSON.stringify(value);

describe('readRecipe: a recipe', () => {
  it('passes a full recipe on as it is', () => {
    expect(readRecipe(json(full))).toEqual(full);
  });

  it('needs only a name, one ingredient and one step', () => {
    expect(readRecipe(json({ name: 'Toast', ingredients: ['bread'], instructions: ['Toast it'] }))).toEqual({
      name: 'Toast', ingredients: [{ id: '1', name: 'bread' }], instructions: ['Toast it'],
    });
  });

  it('reads a recipe in a code fence or inside a sentence', () => {
    expect(readRecipe('```json\n' + json(full) + '\n```')).toEqual(full);
    expect(readRecipe('Here is the recipe: ' + json(full) + ' Enjoy!')).toEqual(full);
  });

  it('gives each ingredient the id the app expects, from its place in the list, when the reply has none', () => {
    const out = readRecipe(json({ name: 'A', ingredients: ['one', { name: 'two' }, { id: 7, name: 'three' }], instructions: ['x'] }));
    expect(out.ingredients).toEqual([{ id: '1', name: 'one' }, { id: '2', name: 'two' }, { id: '7', name: 'three' }]);
  });

  it('trims the words it keeps', () => {
    const out = readRecipe(json({ name: '  Soup  ', ingredients: ['  water '], instructions: ['  Boil  '], author: ' Amy ' }));
    expect(out).toEqual({ name: 'Soup', ingredients: [{ id: '1', name: 'water' }], instructions: ['Boil'], author: 'Amy' });
  });
});

describe('readRecipe: nothing that is a recipe', () => {
  it.each([
    ['text with no object', 'I can only help with fitness, health, nutrition and using ZOWN HQ.'],
    ['the word null', 'null'],
    ['an empty reply', ''],
    ['broken JSON', '{"name":"Soup","ingredients":['],
    ['a list of numbers', json([1, 2, 3])],
    ['a number', '42'],
    ['the refusal sentence in a message field', json({ message: 'I can only help with fitness, health, nutrition and using ZOWN HQ.' })],
    ['an empty object', '{}'],
    ['a poem in a field it does not read', json({ poem: 'Roses are red' })],
  ])('is null for %s', (_what, text) => {
    expect(readRecipe(text)).toBeNull();
  });

  it.each([
    ['no name', { ...full, name: undefined }],
    ['a name that is blank', { ...full, name: '   ' }],
    ['a name that is not text', { ...full, name: 42 }],
    ['no ingredients', { ...full, ingredients: undefined }],
    ['an empty list of ingredients', { ...full, ingredients: [] }],
    ['ingredients none of which has a name', { ...full, ingredients: [{ amount: 3 }, 7, null, '  '] }],
    ['ingredients that are not a list', { ...full, ingredients: 'flour and water' }],
    ['no steps', { ...full, instructions: undefined }],
    ['an empty list of steps', { ...full, instructions: [] }],
    ['steps that are all blank or not text', { ...full, instructions: ['  ', 5, null, {}] }],
    ['steps that are not a list', { ...full, instructions: 'Mix and bake' }],
  ])('is null for a reply with %s', (_what, value) => {
    expect(readRecipe(json(value))).toBeNull();
  });

  it('is null for anything that is not text', () => {
    for (const value of [undefined, null, 5, {}, ['x'], true]) expect(readRecipe(value)).toBeNull();
  });
});

describe('readRecipe: only a recipe goes on', () => {
  it('drops every field it does not know', () => {
    const out = readRecipe(json({ ...full, message: 'Also, here is a poem...', answer: 'Buy index funds', extra: { deep: [1] } }));
    expect(out).toEqual(full);
    expect(Object.keys(out).sort()).toEqual(Object.keys(full).sort());
  });

  it('cannot be made to pass a long text on in a field that is cut to size', () => {
    const long = 'x'.repeat(50000);
    const out = readRecipe(json({
      name: long, description: long, imageUrl: long, author: long, difficulty: long, category: long,
      ingredients: [{ name: long, unit: long }, long], instructions: [long],
    }));
    expect(out.name).toHaveLength(200);
    expect(out.description).toHaveLength(1000);
    expect(out.imageUrl).toHaveLength(2000);
    expect(out.author).toHaveLength(100);
    expect(out.difficulty).toHaveLength(20);
    expect(out.category).toHaveLength(20);
    expect(out.ingredients[0].name).toHaveLength(300);
    expect(out.ingredients[0].unit).toHaveLength(40);
    expect(out.ingredients[1].name).toHaveLength(300);
    expect(out.instructions[0]).toHaveLength(2000);
  });

  it('keeps at most 100 ingredients, 100 steps and 20 tags of each kind, skipping what is not usable without counting it', () => {
    const many = Array.from({ length: 150 }, (_, i) => `item ${i}`);
    const out = readRecipe(json({ name: 'A', ingredients: [null, ...many], instructions: [5, ...many], tags: many, dietaryTags: [3, ...many] }));
    expect(out.ingredients).toHaveLength(100);
    expect(out.ingredients[0]).toEqual({ id: '1', name: 'item 0' });
    expect(out.instructions).toHaveLength(100);
    expect(out.instructions[0]).toBe('item 0');
    expect(out.tags).toHaveLength(20);
    expect(out.dietaryTags).toHaveLength(20);
    expect(out.dietaryTags[0]).toBe('item 0');
    for (const tag of out.tags) expect(tag.length).toBeLessThanOrEqual(40);
  });

  it('cuts a tag to 40 characters and leaves out tags that are not text', () => {
    const out = readRecipe(json({ ...full, tags: ['y'.repeat(100), 5, '', null, 'ok'] }));
    expect(out.tags).toEqual(['y'.repeat(40), 'ok']);
  });

  it('leaves out a list of tags that has none to keep', () => {
    const out = readRecipe(json({ ...full, tags: [1, 2], dietaryTags: 'vegan' }));
    expect(out).not.toHaveProperty('tags');
    expect(out).not.toHaveProperty('dietaryTags');
  });

  it('keeps a number only when it is a number: not a word, not negative, and no larger than 100,000', () => {
    const out = readRecipe(json({ ...full, prepTime: '20', cookTime: -5, servings: 1e12 }));
    expect(out).not.toHaveProperty('prepTime');
    expect(out).not.toHaveProperty('cookTime');
    expect(out.servings).toBe(100000);
  });

  it('leaves out an ingredient amount or unit that is not usable, and keeps the ingredient', () => {
    const out = readRecipe(json({ name: 'A', instructions: ['x'], ingredients: [{ name: 'salt', amount: '1 1/2', unit: 5 }, { name: 'oil', amount: -1, unit: ' ' }] }));
    expect(out.ingredients).toEqual([{ id: '1', name: 'salt' }, { id: '2', name: 'oil' }]);
  });

  it('keeps only the five nutrition numbers that are numbers, and none at all when there are none', () => {
    const out = readRecipe(json({ ...full, nutrition: { calories: 300, protein: 'lots', carbs: -1, fat: 10, fiber: null, sugar: 9, note: 'hi' } }));
    expect(out.nutrition).toEqual({ calories: 300, fat: 10 });
    expect(readRecipe(json({ ...full, nutrition: { protein: 'lots' } }))).not.toHaveProperty('nutrition');
    expect(readRecipe(json({ ...full, nutrition: 'high' }))).not.toHaveProperty('nutrition');
    expect(readRecipe(json({ ...full, nutrition: [1, 2] }))).not.toHaveProperty('nutrition');
  });

  it('leaves out an id that is not text or a number, and gives the ingredient its place in the list instead', () => {
    const out = readRecipe(json({ name: 'A', instructions: ['x'], ingredients: [{ id: { a: 1 }, name: 'salt' }, { id: 'z'.repeat(50), name: 'pepper' }] }));
    expect(out.ingredients[0].id).toBe('1');
    expect(out.ingredients[1].id).toHaveLength(20);
  });
});
