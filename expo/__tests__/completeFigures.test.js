import { completeFigures } from '../lib/completeFigures';

describe('completeFigures', () => {
  describe('sodium of a pure fat', () => {
    it('is 0 for olive oil, whose record lists none', () => {
      expect(completeFigures({ carbs: 0, fat: 100 })).toEqual({ sugar: 0, saturatedFat: undefined, sodium: 0 });
    });

    it('is 0 from 98 g of fat in 100 g, and not below (butter is 81 g, margarine 80)', () => {
      expect(completeFigures({ fat: 98 }).sodium).toBe(0);
      expect(completeFigures({ fat: 99.9 }).sodium).toBe(0);
      expect(completeFigures({ fat: 97.9 }).sodium).toBeUndefined();
      expect(completeFigures({ fat: 81 }).sodium).toBeUndefined();
    });

    it('needs the fat to be listed', () => {
      expect(completeFigures({ carbs: 0 }).sodium).toBeUndefined();
      expect(completeFigures({ fat: null }).sodium).toBeUndefined();
      expect(completeFigures({ fat: '' }).sodium).toBeUndefined();
      expect(completeFigures({}).sodium).toBeUndefined();
      expect(completeFigures().sodium).toBeUndefined();
    });

    it('is never worked out for a food that is not a pure fat: bacon, cheese, chicken', () => {
      expect(completeFigures({ carbs: 1.4, fat: 42, protein: 37 }).sodium).toBeUndefined();
      expect(completeFigures({ carbs: 2.4, fat: 34 }).sodium).toBeUndefined();
      expect(completeFigures({ carbs: 0, fat: 3.6 }).sodium).toBeUndefined();
    });

    it('keeps the sodium a food lists, a 0 included', () => {
      expect(completeFigures({ fat: 100, sodium: 12 }).sodium).toBe(12);
      expect(completeFigures({ fat: 100, sodium: 0 }).sodium).toBe(0);
      expect(completeFigures({ fat: 100, sodium: '12' }).sodium).toBe(12);
    });
  });

  describe('saturated fat of a food with no fat', () => {
    it('is 0 at 0.1 g of fat or less (the figures are listed to a tenth of a gram)', () => {
      expect(completeFigures({ fat: 0 }).saturatedFat).toBe(0);
      expect(completeFigures({ fat: 0.1 }).saturatedFat).toBe(0);
      expect(completeFigures({ fat: 0.11 }).saturatedFat).toBeUndefined();
      expect(completeFigures({ fat: 0.5 }).saturatedFat).toBeUndefined();
    });

    it('needs the fat to be listed', () => {
      expect(completeFigures({}).saturatedFat).toBeUndefined();
      expect(completeFigures({ fat: null }).saturatedFat).toBeUndefined();
    });

    it('keeps the figure a food lists', () => {
      expect(completeFigures({ fat: 0, saturatedFat: 0.3 }).saturatedFat).toBe(0.3);
      expect(completeFigures({ fat: 0, saturatedFat: 0 }).saturatedFat).toBe(0);
    });
  });

  describe('sugar of a food with no carbohydrate', () => {
    it('is 0 at 0.1 g of carbohydrate or less', () => {
      expect(completeFigures({ carbs: 0 }).sugar).toBe(0);
      expect(completeFigures({ carbs: 0.1 }).sugar).toBe(0);
      expect(completeFigures({ carbs: 0.11 }).sugar).toBeUndefined();
      expect(completeFigures({ carbs: 12 }).sugar).toBeUndefined();
    });

    it('needs the carbohydrate to be listed', () => {
      expect(completeFigures({}).sugar).toBeUndefined();
      expect(completeFigures({ carbs: undefined }).sugar).toBeUndefined();
      expect(completeFigures({ carbs: null }).sugar).toBeUndefined();
      expect(completeFigures({ carbs: '' }).sugar).toBeUndefined();
    });

    it('keeps the figure a food lists', () => {
      expect(completeFigures({ carbs: 0.09, sugar: 0.09 }).sugar).toBe(0.09);
      expect(completeFigures({ carbs: 0, sugar: 0 }).sugar).toBe(0);
    });
  });

  it('does not take a figure that is not a usable number for a listed one', () => {
    const r = completeFigures({ carbs: 50, fat: 50, sugar: true, saturatedFat: -2, sodium: 'lots' });
    expect(r).toEqual({ sugar: undefined, saturatedFat: undefined, sodium: undefined });
  });

  it('returns a number or undefined for each of the three, and nothing else', () => {
    expect(Object.keys(completeFigures({ carbs: 3, fat: 4, fiber: 2, protein: 1 })).sort()).toEqual(['saturatedFat', 'sodium', 'sugar']);
  });
});
