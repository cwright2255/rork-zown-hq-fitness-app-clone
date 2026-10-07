import {
  DIET_OPTIONS, ALLERGY_OPTIONS, AVOID_OPTIONS,
  getDietProfile, buildDietFilters, describeDietForAI, listDietRestrictions,
} from '../lib/dietProfile';

const userWith = (fitnessMetrics) => ({ fitnessMetrics });

describe('dietProfile', () => {
  it('defaults to no preference for missing or unknown data', () => {
    expect(getDietProfile(null)).toEqual({ dietId: 'no_preference', allergies: [], avoid: [] });
    expect(getDietProfile(userWith({ nutritionPreference: 'bogus', foodAllergies: 'x', avoidFoods: [1, 'nope'] })))
      .toEqual({ dietId: 'no_preference', allergies: [], avoid: [] });
  });

  it('maps app diet ids to Spoonacular diet values', () => {
    const f = (id) => buildDietFilters(getDietProfile(userWith({ nutritionPreference: id })));
    expect(f('keto').diet).toBe('ketogenic');
    expect(f('pescatarian').diet).toBe('pescetarian');
    expect(f('gluten_free').diet).toBe('gluten free');
    expect(f('low_fodmap').diet).toBe('low FODMAP');
    expect(f('intermittent_fasting').diet).toBeNull();
    expect(f('no_preference').diet).toBeNull();
  });

  it('approximates diets Spoonacular has no label for', () => {
    const f = (id) => buildDietFilters(getDietProfile(userWith({ nutritionPreference: id })));
    expect(f('mediterranean').extras).toEqual({ cuisine: 'mediterranean' });
    expect(f('carnivore').extras).toEqual({ maxCarbs: '5' });
    expect(f('low_carb').extras).toEqual({ maxCarbs: '30' });
    expect(f('high_protein').extras).toEqual({ minProtein: '30' });
  });

  it('turns allergies into intolerances and avoided foods into excluded ingredients', () => {
    const filters = buildDietFilters(getDietProfile(userWith({
      foodAllergies: ['tree_nut', 'fish', 'dairy'],
      avoidFoods: ['pork', 'fish'],
    })));
    expect(filters.intolerances).toEqual(['tree nut', 'seafood', 'dairy']);
    expect(filters.excludeIngredients.split(',').sort()).toEqual(['bacon', 'fish', 'ham', 'pork', 'salmon', 'tuna']);
  });

  it('every option has a unique id', () => {
    [DIET_OPTIONS, ALLERGY_OPTIONS, AVOID_OPTIONS].forEach((list) => {
      expect(new Set(list.map((o) => o.id)).size).toBe(list.length);
    });
  });

  it('describes strict allergies and preferences for the AI, and nothing when empty', () => {
    expect(describeDietForAI(getDietProfile(null))).toEqual([]);
    const lines = describeDietForAI(getDietProfile(userWith({
      nutritionPreference: 'carnivore', foodAllergies: ['peanut'], avoidFoods: ['lamb'],
    })));
    expect(lines.join(' ')).toMatch(/Carnivore/);
    expect(lines.join(' ')).toMatch(/FOOD ALLERGIES\/INTOLERANCES: Peanuts/);
    expect(lines.join(' ')).toMatch(/avoid: Lamb/);
  });

  it('lists restrictions for flat-list callers', () => {
    expect(listDietRestrictions(userWith({ nutritionPreference: 'vegan', foodAllergies: ['soy'], avoidFoods: ['mushrooms'] })))
      .toEqual(['Vegan', 'allergy: Soy', 'avoids: Mushrooms']);
    expect(listDietRestrictions(null)).toEqual([]);
  });
});
