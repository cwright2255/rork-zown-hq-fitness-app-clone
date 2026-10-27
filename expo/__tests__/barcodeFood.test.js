import { foodFromBarcode, sodiumMg } from '../lib/barcodeFood';

// What the Calorie API answers for a barcode, per 100 g. A ready-meal chicken tikka masala:
// 140 kcal, 8 g protein, 12 g carbohydrate, 6 g fat, 1.2 g fibre, 3.5 g sugars, 1.7 g saturated fat, 0.9 g salt (360 mg sodium).
const tikka = (nutrition = {}, extra = {}) => ({
  found: true,
  barcode: '4056489123456',
  product: { name: 'Chicken Tikka Masala', brand: 'Lidl' },
  nutrition_per_100g: {
    energy_kcal: 140, protein_g: 8, carbohydrates_g: 12, fat_g: 6, fiber_g: 1.2, sugars_g: 3.5, saturated_fat_g: 1.7, salt_g: 0.9,
    ...nutrition,
  },
  ...extra,
});

describe('foodFromBarcode', () => {
  it('turns the answer into a food per 100 g, with the figures the app shows and logs', () => {
    expect(foodFromBarcode(tikka(), '0000')).toEqual({
      name: 'Chicken Tikka Masala', brand: 'Lidl', calories: 140, protein: 8, carbs: 12, fat: 6,
      fiber: 1.2, sugar: 3.5, sodium: 360, servingSize: '100g', barcode: '4056489123456',
      nutritionalScore: { score: 'C', stars: 3 },
    });
  });

  describe('the rating (a scanned food used to have none, so a meal of it showed no stars)', () => {
    it('is given, and is the real grade when everything it is judged on is listed', () => {
      const food = foodFromBarcode(tikka(), '0');
      expect(food.nutritionalScore).toEqual({ score: 'C', stars: 3 });
      expect(food.nutritionalScore).not.toHaveProperty('partial');
    });

    it('is worked out from the figures: a healthy product earns a better grade than a sugary one', () => {
      const oats = foodFromBarcode(tikka({ energy_kcal: 120, protein_g: 12, carbohydrates_g: 12, fat_g: 2.5, fiber_g: 4, sugars_g: 1, saturated_fat_g: 0.2, salt_g: 0.05 }), '0');
      const sweets = foodFromBarcode(tikka({ energy_kcal: 380, protein_g: 0, carbohydrates_g: 95, fat_g: 0, fiber_g: 0, sugars_g: 80, saturated_fat_g: 0, salt_g: 0.01 }), '0');
      expect(oats.nutritionalScore.score).toBe('A');
      expect(sweets.nutritionalScore.score).toBe('E');
    });

    it('is marked partial when a figure is not listed, and is then held back from the top grades', () => {
      const food = foodFromBarcode(tikka({ saturated_fat_g: undefined }), '0');
      expect(food.nutritionalScore).toEqual({ score: 'C', stars: 3, partial: true });
      const bare = foodFromBarcode(tikka({ saturated_fat_g: undefined, salt_g: undefined, fiber_g: 6 }), '0');
      expect(bare.nutritionalScore.partial).toBe(true);
    });

    it('is left off, so no stars show, when the product lists no energy', () => {
      const food = foodFromBarcode(tikka({ energy_kcal: undefined }), '0');
      expect(food).not.toHaveProperty('nutritionalScore');
      expect(food.calories).toBe(0);
    });

    it('counts the fibre', () => {
      const dense = { energy_kcal: 200, protein_g: 0, carbohydrates_g: 40, fat_g: 4.4, sugars_g: 1, saturated_fat_g: 0, salt_g: 0.025 };
      expect(foodFromBarcode(tikka({ ...dense, fiber_g: 7.5 }), '0').nutritionalScore).toEqual({ score: 'A', stars: 4.5 });
      expect(foodFromBarcode(tikka({ ...dense, fiber_g: 0 }), '0').nutritionalScore).toEqual({ score: 'B', stars: 3.5 });
    });

    it('does not hold a lean product back for sugars and saturated fat it cannot hold much of (the carbohydrate and fat tell)', () => {
      const lean = { energy_kcal: 30, protein_g: 5, fat_g: 0.5, fiber_g: 0, sugars_g: undefined, saturated_fat_g: undefined, salt_g: 0.01 };
      // 2 g of carbohydrate cannot hold more than 3.4 g of sugars, and 0.5 g of fat cannot hold more than 1 g of saturated fat.
      expect(foodFromBarcode(tikka({ ...lean, carbohydrates_g: 2 }), '0').nutritionalScore).toEqual({ score: 'A', stars: 4.5 });
      // 20 g of carbohydrate could be mostly sugars: one figure missing.
      expect(foodFromBarcode(tikka({ ...lean, carbohydrates_g: 20 }), '0').nutritionalScore).toEqual({ score: 'B', stars: 4, partial: true });
    });

    it('counts the protein', () => {
      // The same 118.5 kcal either way (4 kcal a gram of protein or carbohydrate), so only the protein differs.
      const base = { energy_kcal: 118.5, fat_g: 2.5, fiber_g: 0, sugars_g: 1, saturated_fat_g: 0.2, salt_g: 0.05 };
      expect(foodFromBarcode(tikka({ ...base, protein_g: 12, carbohydrates_g: 12 }), '0').nutritionalScore.score).toBe('A');
      expect(foodFromBarcode(tikka({ ...base, protein_g: 0, carbohydrates_g: 24 }), '0').nutritionalScore.score).toBe('B');
    });

    it('is given for a product with 0 kcal, which is a real figure', () => {
      const water = foodFromBarcode(tikka({ energy_kcal: 0, protein_g: 0, carbohydrates_g: 0, fat_g: 0, fiber_g: 0, sugars_g: 0, saturated_fat_g: 0, salt_g: 0.01 }), '0');
      expect(water.nutritionalScore).toEqual({ score: 'B', stars: 4 });
    });
  });

  describe('sodium', () => {
    it('is the product\'s sodium in mg when it lists sodium in g', () => {
      expect(foodFromBarcode(tikka({ salt_g: undefined, sodium_g: 0.36 }), '0').sodium).toBe(360);
    });

    it('is worked out from the salt when only salt is listed: 1 g of salt is 400 mg of sodium', () => {
      expect(foodFromBarcode(tikka({ salt_g: 1 }), '0').sodium).toBe(400);
    });

    it('goes by the sodium when both are listed', () => {
      expect(foodFromBarcode(tikka({ sodium_g: 0.1, salt_g: 5 }), '0').sodium).toBe(100);
    });

    it('is a real 0 when the product lists none, and left out when it lists nothing', () => {
      expect(foodFromBarcode(tikka({ salt_g: 0 }), '0').sodium).toBe(0);
      expect(foodFromBarcode(tikka({ salt_g: undefined }), '0')).toHaveProperty('sodium', undefined);
    });
  });

  describe('figures the product does not list', () => {
    it('are left out of the food rather than shown as a real 0', () => {
      const food = foodFromBarcode(tikka({ fiber_g: undefined, sugars_g: null, salt_g: '' }), '0');
      expect(food.fiber).toBeUndefined();
      expect(food.sugar).toBeUndefined();
      expect(food.sodium).toBeUndefined();
    });

    it('keep a listed 0', () => {
      const food = foodFromBarcode(tikka({ fiber_g: 0, sugars_g: 0 }), '0');
      expect(food.fiber).toBe(0);
      expect(food.sugar).toBe(0);
    });

    it('are not taken from nonsense: text, negatives, true, infinity', () => {
      const food = foodFromBarcode(tikka({ fiber_g: 'lots', sugars_g: -4, salt_g: true }), '0');
      expect(food.fiber).toBeUndefined();
      expect(food.sugar).toBeUndefined();
      expect(food.sodium).toBeUndefined();
      expect(foodFromBarcode(tikka({ fiber_g: Infinity }), '0').fiber).toBeUndefined();
    });

    it('read numbers sent as text', () => {
      const food = foodFromBarcode(tikka({ energy_kcal: '140', fiber_g: '1.2' }), '0');
      expect(food.calories).toBe(140);
      expect(food.fiber).toBe(1.2);
    });
  });

  it('rounds the figures the way the diary shows them: calories whole, the rest to a tenth', () => {
    const food = foodFromBarcode(tikka({ energy_kcal: 389.4, protein_g: 10.26, carbohydrates_g: 66.34, fat_g: 6.91, fiber_g: 1.26, sugars_g: 3.54, salt_g: 0.913 }), '0');
    expect(food).toMatchObject({ calories: 389, protein: 10.3, carbs: 66.3, fat: 6.9, fiber: 1.3, sugar: 3.5, sodium: 365.2 });
  });

  it('shows 0 for a macro the product does not list, as the scan always has, and rates from the rest', () => {
    const food = foodFromBarcode(tikka({ protein_g: undefined, fat_g: null }), '0');
    expect(food).toMatchObject({ protein: 0, carbs: 12, fat: 0 });
  });

  it('is named Unknown Product, with no brand, when the answer names nothing', () => {
    const food = foodFromBarcode({ found: true, nutrition_per_100g: { energy_kcal: 100 } }, '123');
    expect(food.name).toBe('Unknown Product');
    expect(food.brand).toBeUndefined();
  });

  it('takes the barcode from the answer, or else the one scanned', () => {
    expect(foodFromBarcode(tikka(), 'scanned').barcode).toBe('4056489123456');
    expect(foodFromBarcode(tikka({}, { barcode: undefined }), 'scanned').barcode).toBe('scanned');
  });

  it('copes with an answer that has no nutrition at all', () => {
    const food = foodFromBarcode({ found: true, barcode: '9', product: { name: 'Mystery' } }, '9');
    expect(food).toMatchObject({ name: 'Mystery', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '100g' });
    expect(food).not.toHaveProperty('nutritionalScore');
  });

  it('survives being sent to the log screen as text', () => {
    const food = JSON.parse(JSON.stringify(foodFromBarcode(tikka(), '0')));
    expect(food.nutritionalScore).toEqual({ score: 'C', stars: 3 });
    expect(food.sodium).toBe(360);
  });
});

describe('sodiumMg', () => {
  it('is in mg, from sodium_g first and salt_g after, and undefined when neither is listed', () => {
    expect(sodiumMg({ sodium_g: 0.5 })).toBe(500);
    expect(sodiumMg({ salt_g: 2.5 })).toBe(1000);
    expect(sodiumMg({ sodium_g: 0, salt_g: 2.5 })).toBe(0);
    expect(sodiumMg({})).toBeUndefined();
  });
});

// Two answers exactly as the Calorie API sent them for real barcodes (a Coca-Cola can and a jar of Nutella): the whole answer, with the
// parts the app does not use (ingredients, serving, per-serving figures), and a figure the product does not list sent as null.
describe('a scanned answer as the API really sends it', () => {
  const coke = {
    found: true,
    barcode: '5449000000996',
    food_id: null,
    product: { name: 'Coca-Cola', brand: 'Coca-Cola', category: 'Colas, Sweetened beverages', generic_name: null, quantity: '0kg', ingredients: 'carbonated water, sugar, colour (caramel e150d)', allergens: [] },
    serving: { label: '1 can (330 ml)', quantity: 330, unit: 'ml' },
    nutrition_per_100g: { energy_kcal: 42, protein_g: 0, carbohydrates_g: 10.6, fat_g: 0, fiber_g: null, sugars_g: 10.6, saturated_fat_g: 0, salt_g: 0, sodium_g: 0, added_sugars_g: 5.3 },
    nutrition_per_serving: { energy_kcal: 139, protein_g: 0, carbohydrates_g: 35, fat_g: 0, fiber_g: null, sugars_g: 35, saturated_fat_g: 0, salt_g: 0, sodium_g: 0, added_sugars_g: 17.5 },
    micronutrients_per_100g: [],
  };
  const nutella = {
    found: true,
    barcode: '3017620422003',
    food_id: null,
    product: { name: 'Nutella', brand: 'Nutella', category: 'Pâtes à tartiner', generic_name: 'Pâte à tartiner aux noisettes et au cacao', quantity: null, ingredients: 'sugar, palm oil, hazelnuts 13%', allergens: ['milk', 'nuts', 'soybeans'] },
    serving: { label: '100g', quantity: null, unit: 'g' },
    nutrition_per_100g: { energy_kcal: 539, protein_g: 6.3, carbohydrates_g: 57.5, fat_g: 30.9, fiber_g: 3.4, sugars_g: 56.3, saturated_fat_g: 10.6, salt_g: 0.107, sodium_g: 0.0428, added_sugars_g: 38.35 },
    nutrition_per_serving: null,
    micronutrients_per_100g: [{ name: 'Calcium', amount: 0.108, unit: 'g' }],
  };

  it('rates a cola from what it lists: sugar and nothing else is held at 2 stars, and nothing is missing', () => {
    const food = foodFromBarcode(coke, '5449000000996');
    expect(food).toMatchObject({ name: 'Coca-Cola', calories: 42, sugar: 10.6, sodium: 0, barcode: '5449000000996' });
    expect(food.fiber).toBeUndefined();
    expect(food.nutritionalScore).toEqual({ score: 'D', stars: 2 });
  });

  it('rates a chocolate spread at the very bottom, half a star, with sodium read from grams to mg', () => {
    const food = foodFromBarcode(nutella, '3017620422003');
    expect(food.sodium).toBe(42.8);
    expect(food.nutritionalScore).toEqual({ score: 'E', stars: 0.5 });
  });
});
