import { cookingSteps } from '../lib/cookingSteps';

describe('cookingSteps', () => {
  it('gives the steps as text, one per step', () => {
    expect(cookingSteps(['Mix the flour.', 'Bake it.'])).toEqual(['Mix the flour.', 'Bake it.']);
  });

  it('tidies the spaces', () => {
    expect(cookingSteps(['  Mix   the\n flour.  '])).toEqual(['Mix the flour.']);
  });

  it.each([
    ['1. Mix the flour.', 'Mix the flour.'],
    ['12. Mix the flour.', 'Mix the flour.'],
    ['2) Mix the flour.', 'Mix the flour.'],
    ['3: Mix the flour.', 'Mix the flour.'],
    ['Step 4: Mix the flour.', 'Mix the flour.'],
    ['step 5. Mix the flour.', 'Mix the flour.'],
    ['STEP 6) Mix the flour.', 'Mix the flour.'],
    ['Step7: Mix the flour.', 'Mix the flour.'],
    ['  8 .  Mix the flour.', 'Mix the flour.'],
  ])('takes the number off %p', (raw, expected) => {
    expect(cookingSteps([raw])).toEqual([expected]);
  });

  it.each([
    ['350 degrees is hot enough.'],
    ['2 cups of flour go in first.'],
    ['1.5 cups of flour go in first.'],
    ['1 - 2 tbsp of oil go in the pan.'],
    ['Wait 10 minutes: stir.'],
    ['Step by step, mix.'],
    ['Preheat the oven. 2. Mix'],
  ])('leaves %p as it is', (raw) => {
    expect(cookingSteps([raw])).toEqual([raw]);
  });

  it('takes off only the first number', () => {
    expect(cookingSteps(['1. 2. Mix'])).toEqual(['2. Mix']);
  });

  it('drops empty steps and anything that is not text', () => {
    expect(cookingSteps(['Mix.', '', '   ', null, undefined, 5, { text: 'no' }, ['x'], '3. ', 'Bake.'])).toEqual(['Mix.', '3.', 'Bake.']);
  });

  it('splits one block of text at its line breaks', () => {
    expect(cookingSteps('1. Mix\n2. Bake\r\n\r\n3. Eat')).toEqual(['Mix', 'Bake', 'Eat']);
    expect(cookingSteps('Just one step')).toEqual(['Just one step']);
  });

  it('is empty when there are no instructions', () => {
    [undefined, null, 5, {}, [], '', '   \n  '].forEach((value) => {
      expect(cookingSteps(value)).toEqual([]);
    });
  });
});
