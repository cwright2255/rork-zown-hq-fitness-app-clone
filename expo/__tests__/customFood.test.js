import {
  parseAmount, buildCustomFood, buildQuickAdd, matchesFoodQuery, customFoodToFields,
  MAX_NAME, MAX_SERVING,
} from '../lib/customFood';

describe('parseAmount', () => {
  it('reads plain numbers and decimals', () => {
    expect(parseAmount('12')).toBe(12);
    expect(parseAmount(' 12.5 ')).toBe(12.5);
    expect(parseAmount('.5')).toBe(0.5);
    expect(parseAmount('0')).toBe(0);
    expect(parseAmount(7)).toBe(7);
  });

  it('reads a thousands comma', () => {
    expect(parseAmount('1,200')).toBe(1200);
    expect(parseAmount('12,345.5')).toBe(12345.5);
  });

  it('does not guess at a European decimal comma', () => {
    expect(parseAmount('1,5')).toBeNull();
    expect(parseAmount('12,34')).toBeNull();
  });

  it('rejects negatives, exponents, words and blanks', () => {
    ['-3', '1e3', 'abc', '', '  ', '1.2.3', '12g', null, undefined, {}].forEach((v) => {
      expect(parseAmount(v)).toBeNull();
    });
    expect(parseAmount(-1)).toBeNull();
    expect(parseAmount(NaN)).toBeNull();
    expect(parseAmount(Infinity)).toBeNull();
  });
});

describe('buildCustomFood', () => {
  const full = {
    name: '  Protein   shake ', servingSize: ' 1 scoop (30g) ',
    calories: '120', protein: '24', carbs: '3', fat: '1.5',
    fiber: '1', sugar: '2', sodium: '150',
  };

  it('builds a food the diary can log', () => {
    const r = buildCustomFood(full, { id: 'custom-x' });
    expect(r.ok).toBe(true);
    expect(r.food).toEqual({
      id: 'custom-x', name: 'Protein shake', servingSize: '1 scoop (30g)',
      calories: 120, protein: 24, carbs: 3, fat: 1.5, fiber: 1, sugar: 2, sodium: 150, custom: true,
    });
  });

  it('needs only a name and calories; the rest default', () => {
    const r = buildCustomFood({ name: 'Mystery bar', calories: '210' }, { id: 'c1' });
    expect(r.ok).toBe(true);
    expect(r.food).toEqual({
      id: 'c1', name: 'Mystery bar', servingSize: '1 serving',
      calories: 210, protein: 0, carbs: 0, fat: 0, custom: true,
    });
    expect('fiber' in r.food).toBe(false);
    expect('sugar' in r.food).toBe(false);
    expect('sodium' in r.food).toBe(false);
  });

  it('keeps a typed 0 for fiber (it is a number, not "not listed")', () => {
    const r = buildCustomFood({ name: 'Soda', calories: '150', fiber: '0', sodium: '0' }, { id: 'c1' });
    expect(r.food.fiber).toBe(0);
    expect(r.food.sodium).toBe(0);
  });

  it('rounds calories to whole numbers and the rest to a tenth', () => {
    const r = buildCustomFood({ name: 'X', calories: '99.6', protein: '10.26', sodium: '10.04' }, { id: 'c1' });
    expect(r.food.calories).toBe(100);
    expect(r.food.protein).toBe(10.3);
    expect(r.food.sodium).toBe(10);
  });

  it('asks for a name and calories', () => {
    const r = buildCustomFood({ name: '   ', calories: '' });
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual({ name: 'Enter a name', calories: 'Required' });
  });

  it('says which number is not a number', () => {
    const r = buildCustomFood({ name: 'X', calories: '100', protein: 'lots', fiber: '-2' });
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual({ protein: 'Enter a number', fiber: 'Enter a number' });
  });

  it('refuses numbers that are far too big', () => {
    const r = buildCustomFood({ name: 'X', calories: '10001', protein: '2001', sodium: '50001' });
    expect(r.errors).toEqual({ calories: 'That is too high', protein: 'That is too high', sodium: 'That is too high' });
    expect(buildCustomFood({ name: 'X', calories: '10000', protein: '2000', sodium: '50000' }).ok).toBe(true);
  });

  it('limits the name and serving label length', () => {
    expect(buildCustomFood({ name: 'a'.repeat(MAX_NAME), calories: '1' }).ok).toBe(true);
    expect(buildCustomFood({ name: 'a'.repeat(MAX_NAME + 1), calories: '1' }).errors.name).toMatch(/60/);
    expect(buildCustomFood({ name: 'a', calories: '1', servingSize: 'b'.repeat(MAX_SERVING + 1) }).errors.servingSize).toMatch(/40/);
  });

  it('allows 0 calories (water, black coffee)', () => {
    expect(buildCustomFood({ name: 'Black coffee', calories: '0' }, { id: 'c1' }).food.calories).toBe(0);
  });

  it('gives each food its own id when none is passed', () => {
    const a = buildCustomFood({ name: 'A', calories: '1' }, { now: 1000, random: () => 0.1 }).food.id;
    const b = buildCustomFood({ name: 'A', calories: '1' }, { now: 1000, random: () => 0.9 }).food.id;
    expect(a.startsWith('custom-')).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe('buildQuickAdd', () => {
  it('is just calories, named "Quick add"', () => {
    const r = buildQuickAdd({ calories: '350' });
    expect(r.ok).toBe(true);
    expect(r.food).toEqual({
      id: 'quick-add', name: 'Quick add', servingSize: '1 serving',
      calories: 350, protein: 0, carbs: 0, fat: 0, quickAdd: true,
    });
  });

  it('takes optional macros and a label', () => {
    const r = buildQuickAdd({ calories: '600', protein: '30', carbs: '70', fat: '20.25', label: ' Restaurant   burger ' });
    expect(r.food.name).toBe('Restaurant burger');
    expect([r.food.protein, r.food.carbs, r.food.fat]).toEqual([30, 70, 20.3]);
  });

  it('needs at least 1 calorie', () => {
    expect(buildQuickAdd({ calories: '' }).errors).toEqual({ calories: 'Required' });
    expect(buildQuickAdd({ calories: '0' }).errors).toEqual({ calories: 'Enter at least 1 calorie' });
    expect(buildQuickAdd({ calories: '0.4' }).errors).toEqual({ calories: 'Enter at least 1 calorie' });
    expect(buildQuickAdd({ calories: 'abc' }).errors).toEqual({ calories: 'Enter a number' });
    expect(buildQuickAdd({ calories: '10001' }).errors).toEqual({ calories: 'That is too high' });
  });

  it('flags bad macros without losing the calorie error', () => {
    const r = buildQuickAdd({ calories: '', protein: 'x' });
    expect(r.errors).toEqual({ calories: 'Required', protein: 'Enter a number' });
  });

  it('limits the label length', () => {
    expect(buildQuickAdd({ calories: '5', label: 'a'.repeat(MAX_NAME + 1) }).errors.label).toMatch(/60/);
  });
});

describe('matchesFoodQuery', () => {
  const f = { name: 'Protein  Shake' };
  it('ignores case and spacing', () => {
    expect(matchesFoodQuery(f, 'protein')).toBe(true);
    expect(matchesFoodQuery(f, 'N SHA')).toBe(true);
    expect(matchesFoodQuery(f, ' shake ')).toBe(true);
  });

  it('is false for a different food or an empty search', () => {
    expect(matchesFoodQuery(f, 'banana')).toBe(false);
    expect(matchesFoodQuery(f, '')).toBe(false);
    expect(matchesFoodQuery(f, '   ')).toBe(false);
    expect(matchesFoodQuery(null, 'a')).toBe(false);
  });
});

describe('customFoodToFields', () => {
  it('turns a saved food back into form text and builds the same food again', () => {
    const made = buildCustomFood({ name: 'Bar', servingSize: '1 bar', calories: '200', protein: '10', carbs: '20', fat: '8', fiber: '3' }, { id: 'c1' }).food;
    const fields = customFoodToFields(made);
    expect(fields).toEqual({
      name: 'Bar', servingSize: '1 bar', calories: '200', protein: '10', carbs: '20', fat: '8',
      fiber: '3', sugar: '', sodium: '',
    });
    expect(buildCustomFood(fields, { id: 'c1' }).food).toEqual(made);
  });

  it('leaves the serving blank when it is the default, so the hint shows', () => {
    const made = buildCustomFood({ name: 'Bar', calories: '1' }, { id: 'c1' }).food;
    expect(customFoodToFields(made).servingSize).toBe('');
    expect(buildCustomFood(customFoodToFields(made), { id: 'c1' }).food.servingSize).toBe('1 serving');
  });
});
