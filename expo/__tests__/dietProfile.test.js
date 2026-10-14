import fs from 'fs';
import path from 'path';
import {
  DIET_OPTIONS, ALLERGY_OPTIONS, AVOID_OPTIONS,
  getDietProfile, buildDietFilters, describeDietForAI, listDietRestrictions, dietAiNote,
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

describe('what the AI is told about each diet', () => {
  const withNote = DIET_OPTIONS.filter((d) => d.id !== 'no_preference');
  const note = (id) => dietAiNote(id);

  it('has a note for every diet except no preference, short enough to put in a prompt', () => {
    expect(withNote.length).toBeGreaterThanOrEqual(16);
    for (const d of withNote) {
      expect(typeof d.aiNote).toBe('string');
      expect(d.aiNote.length).toBeGreaterThan(60);
      expect(d.aiNote.length).toBeLessThan(700);
      expect(d.aiNote).toBe(d.aiNote.trim());
      expect(d.aiNote).not.toMatch(/[.]$/);
    }
    expect(DIET_OPTIONS.find((d) => d.id === 'no_preference').aiNote).toBeUndefined();
  });

  it('gives the note for a diet id, and nothing for no preference or an unknown id', () => {
    expect(dietAiNote('keto')).toBe(DIET_OPTIONS.find((d) => d.id === 'keto').aiNote);
    expect(dietAiNote('no_preference')).toBe('');
    expect(dietAiNote('bogus')).toBe('');
    expect(dietAiNote(undefined)).toBe('');
    expect(dietAiNote(null)).toBe('');
  });

  it('puts the note on the diet line the Coach reads', () => {
    const lines = describeDietForAI(getDietProfile(userWith({ nutritionPreference: 'keto' })));
    expect(lines[0]).toBe(`Diet: Keto (${dietAiNote('keto')}). Keep meal and food suggestions consistent with it.`);
  });

  it('names the caution that matters for each diet', () => {
    const expectations = {
      vegetarian: [/B12/, /every life stage/],
      vegan: [/B12/, /supplement/, /every life stage/],
      pescatarian: [/omega-3/],
      mediterranean: [/PREDIMED/, /olive oil/, /calorie-dense/],
      whole_foods: [/ultra-processed/, /500 more calories/],
      paleo: [/calcium, vitamin D and fiber/, /short-term/],
      pegan: [/three quarters/, /not evidence-based/],
      keto: [/LDL/, /not clearly different/, /doctor/, /pregnant/],
      low_carb: [/not ketogenic/, /fiber/],
      high_protein: [/1\.6-2\.0 g/, /kidney/],
      carnivore: [/very limited/, /fiber is near zero/, /LDL/, /unproven/, /blood work/],
      whole30: [/30-day/, /temporary/, /little formal research/],
      low_fodmap: [/2-6 weeks/, /dietitian/, /not meant to be followed long term/],
      gluten_free: [/celiac/, /no proven health or weight-loss benefit/, /fiber, iron, calcium and B vitamins/],
      intermittent_fasting: [/no clear weight-loss edge/, /eating disorders/, /pregnancy/],
      intuitive_eating: [/not designed for weight loss/, /do not push calorie deficits/],
    };
    expect(Object.keys(expectations).sort()).toEqual(withNote.map((d) => d.id).sort());
    for (const [id, patterns] of Object.entries(expectations)) {
      for (const pattern of patterns) expect(note(id)).toMatch(pattern);
    }
  });

  it('keeps the new choices out of the recipe filters that would be wrong for them', () => {
    const f = (id) => buildDietFilters(getDietProfile(userWith({ nutritionPreference: id })));
    expect(f('pegan').diet).toBe('paleo');
    expect(f('pegan').extras).toEqual({});
    for (const id of ['whole_foods', 'intuitive_eating']) {
      expect(f(id).diet).toBeNull();
      expect(f(id).extras).toEqual({});
    }
  });

  it('lists the new choices, and still lists the old ones in the same order', () => {
    const ids = DIET_OPTIONS.map((d) => d.id);
    expect(ids).toEqual([
      'no_preference', 'vegetarian', 'vegan', 'pescatarian', 'mediterranean', 'whole_foods', 'paleo', 'pegan', 'keto',
      'low_carb', 'high_protein', 'carnivore', 'whole30', 'low_fodmap', 'gluten_free', 'intermittent_fasting', 'intuitive_eating',
    ]);
    expect(getDietProfile(userWith({ nutritionPreference: 'pegan' })).dietId).toBe('pegan');
    expect(listDietRestrictions(userWith({ nutritionPreference: 'intuitive_eating' }))).toEqual(['Intuitive Eating']);
  });

  it('is written up, with its evidence, in the knowledge base the notes come from', () => {
    const doc = fs.readFileSync(path.join(__dirname, '../functions/EXERCISE_SCIENCE_KNOWLEDGE.md'), 'utf8').toLowerCase();
    const section = doc.slice(doc.indexOf('### 8.2'), doc.indexOf('### 8.3'));
    for (const d of withNote) expect(section).toContain(d.label.toLowerCase());
  });
});
