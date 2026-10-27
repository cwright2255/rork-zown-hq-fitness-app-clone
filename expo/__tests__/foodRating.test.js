import { scoreFood, rateFood, ratingFor, starsForScore, starsOf, gradeToStars } from '../lib/foodRating';

// A food with every figure given, all at zero: nothing against it, nothing for it.
const base = { calories: 0, sugar: 0, saturatedFat: 0, sodium: 0 };
const food = (extra) => ({ ...base, ...extra });

// One point for each step a value is above. `at` is the last value that earns the points before it,
// `over` is the first that earns one more.
const negative = (extra) => scoreFood(food(extra)).negative;
// 200 kcal keeps the food from counting as plain fruit or vegetable, which earns its own credit.
const positive = (extra) => scoreFood(food({ calories: 200, ...extra })).positive;

// The published point scales: a value earns one point for each step it is above. These are written out
// again here on purpose, so that a changed number in the rating fails a test.
const AGAINST = {
  calories: [80, 160, 240, 320, 400, 480, 560, 640, 720, 800],
  sugar: [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51],
  saturatedFat: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  sodium: [80, 160, 240, 320, 400, 480, 560, 640, 720, 800, 880, 960, 1040, 1120, 1200, 1280, 1360, 1440, 1520, 1600],
};
const FOR = {
  fiber: [3, 4.1, 5.2, 6.3, 7.4],
  protein: [2.4, 4.8, 7.2, 9.6, 12, 14, 17],
};

describe('points against a food', () => {
  it.each(Object.keys(AGAINST))('%s: one point for each step it is above, and no more after the last', (key) => {
    const steps = AGAINST[key];
    expect(negative({ [key]: 0 })).toBe(0);
    steps.forEach((step, i) => {
      expect([key, step, negative({ [key]: step })]).toEqual([key, step, i]);
      expect([key, step + 0.01, negative({ [key]: step + 0.01 })]).toEqual([key, step + 0.01, i + 1]);
    });
    expect(negative({ [key]: steps[steps.length - 1] * 10 })).toBe(steps.length);
  });

  it('adds the four together', () => {
    expect(negative({ calories: 500, sugar: 12, saturatedFat: 4.5, sodium: 500 })).toBe(6 + 3 + 4 + 6);
  });
});

describe('points for a food', () => {
  it.each(Object.keys(FOR))('%s: one point for each step it is above, and no more after the last', (key) => {
    const steps = FOR[key];
    expect(positive({ [key]: 0 })).toBe(0);
    steps.forEach((step, i) => {
      expect([key, step, positive({ [key]: step })]).toEqual([key, step, i]);
      expect([key, step + 0.01, positive({ [key]: step + 0.01 })]).toEqual([key, step + 0.01, i + 1]);
    });
    expect(positive({ [key]: steps[steps.length - 1] * 10 })).toBe(steps.length);
  });

  it('counts protein only while the points against the food are under 11', () => {
    // Energy over 800 kcal is 10 points; over 3.4 g of sugar makes it 11.
    const ten = food({ calories: 900, protein: 20 });
    const eleven = food({ calories: 900, sugar: 4, protein: 20 });
    expect(scoreFood(ten)).toMatchObject({ negative: 10, positive: 7 });
    expect(scoreFood(eleven)).toMatchObject({ negative: 11, positive: 0 });
  });

  it('keeps counting fibre when protein is left out', () => {
    expect(scoreFood(food({ calories: 900, sugar: 4, protein: 20, fiber: 8 }))).toMatchObject({ negative: 11, positive: 5 });
  });
});

describe('grades from the score', () => {
  // A food that lands on exactly this score: saturated fat for up to 10 points, energy for the rest,
  // and a little fibre for -1.
  const withScore = (k) => {
    if (k < 0) return food({ calories: 111, fiber: 4.2 }); // 1 point against, 2 for
    if (k <= 10) return food({ saturatedFat: k === 0 ? 0 : k + 0.5 });
    return food({ saturatedFat: 10.5, calories: 80 * (k - 10) + 1 });
  };

  it('builds foods that land on the scores below', () => {
    for (const k of [-1, 0, 1, 2, 3, 10, 11, 18, 19]) expect([k, scoreFood(withScore(k)).score]).toEqual([k, k]);
  });

  it.each([
    [-1, 'A'], [0, 'B'], [2, 'B'], [3, 'C'], [10, 'C'], [11, 'D'], [18, 'D'], [19, 'E'],
  ])('a score of %i is %s', (score, grade) => {
    expect(rateFood(withScore(score))).toBe(grade);
  });
});

describe('plain fruit and vegetables', () => {
  const apple = { calories: 52, protein: 0.3, fiber: 2.4, sugar: 10.4, saturatedFat: 0.03, sodium: 1, fat: 0.2 };

  it('earn the fruit-and-vegetable credit and rate A', () => {
    expect(scoreFood(apple)).toMatchObject({ produce: true, grade: 'A' });
  });

  it('would not without it', () => {
    // 3 points against it for the sugar, none for fibre under 3 g.
    expect(scoreFood(apple).negative).toBe(3);
    expect(scoreFood(apple).positive).toBe(5);
  });

  it.each([
    ['too much energy', { calories: 111 }],
    ['too much fat (over 1 g)', { fat: 1.1 }],
    ['saturated fat over 0.5 g', { saturatedFat: 0.6 }],
    ['salted (over 100 mg of sodium)', { sodium: 101 }],
    ['too sweet (over 16 g of sugar)', { sugar: 16.1 }],
    ['too much protein', { protein: 6.1 }],
    ['no fibre at all', { fiber: 0.2 }],
  ])('a food that is %s does not', (_why, change) => {
    expect(scoreFood({ ...apple, ...change }).produce).toBe(false);
  });

  it.each([
    ['energy of 110 kcal', { calories: 110 }],
    ['fat of 1 g', { fat: 1 }],
    ['saturated fat of 0.5 g', { saturatedFat: 0.5 }],
    ['sodium of 100 mg', { sodium: 100 }],
    ['sugar of 16 g', { sugar: 16 }],
    ['protein of 6 g', { protein: 6 }],
    ['fibre of 0.3 g', { fiber: 0.3 }],
  ])('a food with %s still does', (_what, change) => {
    expect(scoreFood({ ...apple, ...change }).produce).toBe(true);
  });

  it('a figure that is missing does not either', () => {
    expect(scoreFood({ ...apple, sodium: undefined }).produce).toBe(false);
    expect(scoreFood({ ...apple, saturatedFat: undefined, fat: 5 }).produce).toBe(false);
  });

  it('does not need the fat figure', () => {
    expect(scoreFood({ ...apple, fat: undefined }).produce).toBe(true);
  });
});

describe('sugar and nothing else', () => {
  const cola = { calories: 42, protein: 0, fiber: 0, sugar: 10.6, saturatedFat: 0, sodium: 4 };

  it('holds a sugary drink to D at best', () => {
    // On the general scale it is only 3 points.
    expect(scoreFood(cola)).toMatchObject({ negative: 3, sugarOnly: true, grade: 'D' });
  });

  it('applies from 5 g of sugar, with under 0.3 g of fibre and under 2 g of protein', () => {
    expect(scoreFood({ ...cola, sugar: 5 }).sugarOnly).toBe(true);
    expect(scoreFood({ ...cola, sugar: 4.9 }).sugarOnly).toBe(false);
    expect(scoreFood({ ...cola, fiber: 0.29 }).sugarOnly).toBe(true);
    expect(scoreFood({ ...cola, fiber: 0.3 }).sugarOnly).toBe(false);
    expect(scoreFood({ ...cola, protein: 1.9 }).sugarOnly).toBe(true);
    expect(scoreFood({ ...cola, protein: 2 }).sugarOnly).toBe(false);
  });

  it('counts a missing fibre or protein figure as none', () => {
    expect(scoreFood({ calories: 42, sugar: 10.6, saturatedFat: 0, sodium: 4 }).sugarOnly).toBe(true);
  });

  it('does not apply when the sugar figure is missing', () => {
    expect(scoreFood({ ...cola, sugar: undefined }).sugarOnly).toBe(false);
  });

  it('does not hold milk back for its sugar', () => {
    const milk = { calories: 34, protein: 3.4, fiber: 0, sugar: 5, saturatedFat: 0.1, sodium: 42 };
    expect(scoreFood(milk).sugarOnly).toBe(false);
  });

  it('does not hold back fruit', () => {
    const grapes = { calories: 69, protein: 0.7, fiber: 0.9, sugar: 15.5, saturatedFat: 0.05, sodium: 2, fat: 0.2 };
    expect(scoreFood(grapes)).toMatchObject({ sugarOnly: false, grade: 'A' });
    const watermelon = { calories: 30, protein: 0.6, fiber: 0.4, sugar: 6.2, saturatedFat: 0.02, sodium: 1, fat: 0.2 };
    expect(scoreFood(watermelon)).toMatchObject({ produce: true, sugarOnly: false });
  });

  it('leaves water, coffee and diet drinks alone', () => {
    expect(scoreFood(food({ calories: 0 })).sugarOnly).toBe(false);
    expect(rateFood(food({ calories: 0 }))).toBe('B');
  });

  it('never makes a food better', () => {
    // Already E: stays E.
    expect(rateFood({ calories: 400, protein: 0, fiber: 0, sugar: 90, saturatedFat: 0, sodium: 0 })).toBe('E');
  });
});

describe('alcohol', () => {
  // A drink with nothing else wrong with it: low energy, no sugar, salt or fat.
  const drink = { calories: 43, protein: 0.5, fiber: 0, sugar: 0, saturatedFat: 0, sodium: 4, carbs: 3.6, fat: 0 };

  it('holds beer, cider and wine (3 g of alcohol per 100 g or more) to D at best', () => {
    expect(rateFood({ ...drink, alcohol: 2.9 })).toBe('B');
    expect(rateFood({ ...drink, alcohol: 3 })).toBe('D');
    expect(rateFood({ ...drink, alcohol: 10.6 })).toBe('D');
    expect(rateFood({ ...drink, alcohol: 14.9 })).toBe('D');
  });

  it('holds spirits and fortified wine (15 g or more) to E', () => {
    expect(rateFood({ ...drink, alcohol: 15 })).toBe('E');
    expect(rateFood({ ...drink, alcohol: 33 })).toBe('E');
  });

  it('does not touch a drink with a trace of alcohol, or none', () => {
    expect(rateFood({ ...drink, alcohol: 0.4 })).toBe('B');
    expect(rateFood({ ...drink, alcohol: 0 })).toBe('B');
  });

  it('never makes a food better', () => {
    expect(rateFood({ calories: 400, protein: 0, fiber: 0, sugar: 90, saturatedFat: 0, sodium: 0, alcohol: 5 })).toBe('E');
  });

  it('reports the amount it used', () => {
    expect(scoreFood({ ...drink, alcohol: 4.2 }).alcohol).toBe(4.2);
    expect(scoreFood({ ...drink, alcohol: 0 }).alcohol).toBe(0);
    expect(scoreFood(base).alcohol).toBe(0);
  });

  describe('worked out from the energy the macros leave over', () => {
    const beer = { calories: 43, protein: 0.46, carbs: 3.55, fat: 0, sugar: 0, saturatedFat: 0, sodium: 4 };
    const wine = { calories: 85, protein: 0.07, carbs: 2.61, fat: 0, sugar: 0.6, saturatedFat: 0, sodium: 4 };
    const vodka = { calories: 231, protein: 0, carbs: 0, fat: 0, sugar: 0, saturatedFat: 0, sodium: 1 };

    it('finds the alcohol in beer, wine and vodka', () => {
      expect(scoreFood(beer).alcohol).toBeCloseTo(3.9, 1);
      expect(scoreFood(wine).alcohol).toBeCloseTo(10.6, 1);
      expect(scoreFood(vodka).alcohol).toBeCloseTo(33, 0);
      expect([rateFood(beer), rateFood(wine), rateFood(vodka)]).toEqual(['D', 'D', 'E']);
    });

    it('prefers a listed amount, even a listed 0', () => {
      expect(scoreFood({ ...beer, alcohol: 0 }).alcohol).toBe(0);
      expect(rateFood({ ...beer, alcohol: 0 })).toBe('B');
      expect(scoreFood({ ...wine, alcohol: 9 }).alcohol).toBe(9);
    });

    it('uses it when the listed amount is not a usable number', () => {
      expect(scoreFood({ ...wine, alcohol: 'abc' }).alcohol).toBeCloseTo(10.6, 1);
      expect(scoreFood({ ...wine, alcohol: -1 }).alcohol).toBeCloseTo(10.6, 1);
      expect(scoreFood({ ...wine, alcohol: null }).alcohol).toBeCloseTo(10.6, 1);
    });

    it.each(['calories', 'protein', 'carbs', 'fat'])('needs the %s figure', (key) => {
      expect(scoreFood({ ...wine, [key]: undefined }).alcohol).toBe(0);
    });

    it('needs the gap to be at least 15% of the energy', () => {
      // 400 kcal with 340 explained: a gap of exactly 15%, which is 8.6 g of alcohol.
      expect(scoreFood({ calories: 400, protein: 25, carbs: 60, fat: 0 }).alcohol).toBeCloseTo(60 / 7, 5);
      // 341 explained: a gap just under 15%, which is a food that does not quite add up, not a drink.
      expect(scoreFood({ calories: 400, protein: 25, carbs: 60.25, fat: 0 }).alcohol).toBe(0);
    });

    it('counts fat at 9 kcal a gram', () => {
      // 400 kcal; protein 40 + carbohydrate 180 + fat 108 = 328 explained, leaving 72 kcal.
      expect(scoreFood({ calories: 400, protein: 10, carbs: 45, fat: 12 }).alcohol).toBeCloseTo(72 / 7, 5);
    });

    it('needs the gap to come to 3 g of alcohol (vinegar is not a drink)', () => {
      expect(scoreFood({ calories: 18, protein: 0, carbs: 0.04, fat: 0 }).alcohol).toBe(0);
      expect(scoreFood({ calories: 88, protein: 0.5, carbs: 17, fat: 0 }).alcohol).toBe(0);
      // 21 kcal unexplained is exactly 3 g.
      expect(scoreFood({ calories: 21, protein: 0, carbs: 0, fat: 0 }).alcohol).toBe(3);
      expect(scoreFood({ calories: 20.9, protein: 0, carbs: 0, fat: 0 }).alcohol).toBe(0);
    });

    it('does not read a food with its macros missing as a spirit', () => {
      // 315 kcal and nothing else would be 45 g of alcohol: the edge. Past it, it is a gap in the data.
      expect(scoreFood({ calories: 315, protein: 0, carbs: 0, fat: 0 }).alcohol).toBe(45);
      expect(scoreFood({ calories: 316, protein: 0, carbs: 0, fat: 0 }).alcohol).toBe(0);
      expect(scoreFood({ calories: 600, protein: 0, carbs: 0, fat: 0 }).alcohol).toBe(0);
    });

    it('does not read ordinary foods as drinks', () => {
      const cheese = { calories: 330, protein: 18, carbs: 5, fat: 24 };
      const bread = { calories: 265, protein: 9, carbs: 49, fat: 3.2 };
      const oil = { calories: 884, protein: 0, carbs: 0, fat: 100 };
      for (const f of [cheese, bread, oil]) expect(scoreFood(f).alcohol).toBe(0);
    });
  });
});

describe('a food with figures missing', () => {
  // Scores -3 with everything listed.
  const good = { calories: 30, protein: 5, fiber: 4, sugar: 1, saturatedFat: 0, sodium: 10, carbs: 6, fat: 0.5 };

  it('can be A when nothing is missing', () => {
    expect(rateFood(good)).toBe('A');
  });

  it.each(['sugar', 'saturatedFat', 'sodium'])('is B at best with %s missing', (key) => {
    const { carbs, fat, ...rest } = good; // no carbs or fat to work the missing figure out from
    expect(rateFood({ ...rest, [key]: undefined })).toBe('B');
  });

  it('is C at best with two missing', () => {
    const { carbs, fat, ...rest } = good;
    expect(rateFood({ ...rest, sugar: undefined, sodium: undefined })).toBe('C');
    expect(rateFood({ ...rest, sugar: undefined, saturatedFat: undefined, sodium: undefined })).toBe('C');
  });

  it('is not marked down below what its listed figures earn', () => {
    const { carbs, fat, ...rest } = good;
    expect(rateFood({ ...rest, sodium: undefined, calories: 900, saturatedFat: 12 })).toBe('E');
  });

  it('is rated by the figures that are there, so junk with a gap is still junk', () => {
    // Butter: energy and saturated fat alone put it at D.
    expect(rateFood({ calories: 717, saturatedFat: 51, sugar: 0.1, protein: 0.9 })).toBe('D');
  });

  it('counts missing fibre and protein as none, never as a gap', () => {
    expect(scoreFood(food({ calories: 100 })).missing).toBe(0);
    expect(rateFood({ calories: 30, sugar: 1, saturatedFat: 0, sodium: 10 })).toBe('B');
  });

  it('works sugars out from the carbohydrate when that is under the first step', () => {
    const { carbs, fat, ...rest } = good;
    expect(scoreFood({ ...rest, sugar: undefined, carbs: 3.4 }).missing).toBe(0);
    expect(scoreFood({ ...rest, sugar: undefined, carbs: 3.5 }).missing).toBe(1);
    expect(scoreFood({ ...rest, sugar: undefined }).missing).toBe(1);
  });

  it('works saturated fat out from the fat when that is at or under 1 g', () => {
    const { carbs, fat, ...rest } = good;
    expect(scoreFood({ ...rest, saturatedFat: undefined, fat: 1 }).missing).toBe(0);
    expect(scoreFood({ ...rest, saturatedFat: undefined, fat: 1.1 }).missing).toBe(1);
  });

  it('counts every figure it is judged on that is missing, energy included', () => {
    expect(scoreFood({}).missing).toBe(4);
    expect(scoreFood({ calories: 100 }).missing).toBe(3);
    expect(scoreFood({ calories: 100, sodium: 5 }).missing).toBe(2);
  });

  it('is not rated at all without an energy figure', () => {
    expect(rateFood({ protein: 20, fiber: 5, sugar: 0, saturatedFat: 0, sodium: 0 })).toBeNull();
    expect(rateFood({})).toBeNull();
    expect(rateFood()).toBeNull();
  });

  it('is rated when the energy figure is a real 0', () => {
    expect(rateFood(food({ calories: 0 }))).toBe('B');
  });

  it('treats a figure that is not a usable number as missing', () => {
    for (const bad of [null, '', 'abc', NaN, -3, true, Infinity]) {
      expect([bad, scoreFood({ ...good, carbs: undefined, fat: undefined, sodium: bad }).missing]).toEqual([bad, 1]);
    }
    expect(rateFood({ ...good, calories: 'abc' })).toBeNull();
  });

  it('reads numbers given as text', () => {
    expect(scoreFood({ calories: '90', sugar: '12', saturatedFat: '0', sodium: '5' }).negative).toBe(1 + 3);
  });
});

// Approximate figures per 100 g (USDA values), to check that the ratings spread out the way real foods do.
// [name, kcal, protein, fibre, sugar, saturated fat, sodium mg, carbs, fat]
const TABLE = [
  ['Apple', 52, 0.3, 2.4, 10.4, 0.03, 1, 13.8, 0.2], ['Banana', 89, 1.1, 2.6, 12.2, 0.1, 1, 22.8, 0.3],
  ['Orange', 47, 0.9, 2.4, 9.4, 0.02, 0, 11.8, 0.1], ['Strawberries', 32, 0.7, 2, 4.9, 0.02, 1, 7.7, 0.3],
  ['Blueberries', 57, 0.7, 2.4, 10, 0.03, 1, 14.5, 0.3], ['Broccoli', 34, 2.8, 2.6, 1.7, 0.04, 33, 6.6, 0.4],
  ['Spinach', 23, 2.9, 2.2, 0.4, 0.06, 79, 3.6, 0.4], ['Kale', 35, 2.9, 4.1, 0.8, 0.1, 53, 4.4, 0.5],
  ['Carrot', 41, 0.9, 2.8, 4.7, 0.04, 69, 9.6, 0.2], ['Baked potato', 93, 2.5, 2.2, 1.2, 0.03, 10, 21, 0.1],
  ['Sweet potato', 90, 2, 3.3, 6.5, 0.05, 36, 20.7, 0.2], ['Chicken breast', 165, 31, 0, 0, 1, 74, 0, 3.6],
  ['Salmon', 208, 20, 0, 0, 3.1, 59, 0, 13], ['Boiled egg', 155, 13, 0, 1.1, 3.3, 124, 1.1, 11],
  ['Shrimp', 99, 24, 0, 0, 0.3, 111, 0.2, 0.3], ['Tuna in water', 116, 26, 0, 0, 0.2, 247, 0, 0.8],
  ['Greek yogurt, nonfat', 59, 10, 0, 3.6, 0.1, 36, 3.6, 0.4], ['Tofu', 76, 8, 0.3, 0.6, 0.7, 7, 1.9, 4.8],
  ['Lentils, cooked', 116, 9, 7.9, 1.8, 0.05, 2, 20, 0.4], ['Black beans, cooked', 132, 8.9, 8.7, 0.3, 0.1, 1, 23.7, 0.5],
  ['Edamame', 121, 12, 5, 2.2, 0.6, 6, 9, 5], ['Rolled oats, dry', 389, 17, 10.6, 1, 1.2, 2, 66, 6.9],
  ['Oatmeal, cooked', 71, 2.5, 1.7, 0.3, 0.4, 4, 12, 1.5], ['Quinoa, cooked', 120, 4.4, 2.8, 0.9, 0.2, 7, 21, 1.9],
  ['Egg white', 52, 11, 0, 0.7, 0, 166, 0.7, 0.2], ['Pasta, cooked', 158, 5.8, 1.8, 0.6, 0.2, 1, 31, 0.9],
  ['Air-popped popcorn', 387, 13, 14.5, 0.9, 0.2, 8, 78, 4.5],
  ['Bacon', 541, 37, 0, 1.3, 14, 1717, 1.4, 42], ['Cheddar', 403, 25, 0, 0.5, 21, 621, 1.3, 33],
  ['Milk chocolate', 535, 7.7, 3.4, 52, 18.5, 79, 59, 30], ['Chocolate chip cookie', 488, 5.7, 3.5, 36, 8, 350, 65, 24],
  ['Vanilla ice cream', 207, 3.5, 0.7, 21, 6.8, 80, 24, 11], ['Glazed donut', 421, 4.9, 1.7, 22, 5.5, 346, 51, 22],
  ['Cola', 42, 0, 0, 10.6, 0, 4, 10.6, 0], ['Lemon-lime soda', 41, 0, 0, 10, 0, 10, 10.5, 0],
  ['Energy drink', 45, 0, 0, 11, 0, 40, 11, 0], ['Sports drink', 26, 0, 0, 6, 0, 41, 6.5, 0],
  ['Orange juice', 45, 0.7, 0.2, 8.4, 0.02, 1, 10.4, 0.2], ['Peanut butter', 588, 25, 6, 9, 10, 426, 20, 50],
  ['Olive oil', 884, 0, 0, 0, 13.8, 2, 0, 100], ['Butter', 717, 0.9, 0, 0.1, 51, 11, 0.1, 81],
  ['Hot dog', 290, 10, 0, 3, 5.2, 1090, 4, 26], ['Sugary cereal', 375, 6, 3, 38, 1, 500, 85, 3],
  ['Mayonnaise', 680, 1, 0, 1, 11, 635, 0.6, 75], ['Ketchup', 101, 1, 0.3, 22, 0, 907, 26, 0.1],
  ['Ranch dressing', 430, 1, 0.5, 4, 5, 900, 6, 45], ['Cheese pizza', 266, 11, 2.3, 3.6, 4.5, 598, 33, 10],
  ['Cheeseburger', 250, 13, 1.3, 5, 5, 480, 20, 14], ['Potato chips', 536, 7, 4.8, 0.3, 3.1, 525, 53, 35],
  ['Gummy bears', 343, 6.9, 0, 46, 0, 60, 77, 0], ['Croissant', 406, 8, 2.6, 11, 12, 490, 46, 21],
  ['Chicken nuggets', 296, 15, 1, 0.5, 4, 600, 18, 19], ['Fried chicken', 290, 22, 0, 0, 5, 650, 12, 17],
  ['Honey', 304, 0.3, 0.2, 82, 0, 4, 82, 0], ['Pretzels', 380, 9, 3, 3, 0.5, 1500, 80, 3],
  ['Saltine crackers', 421, 9, 2.7, 0.8, 2.5, 1100, 74, 9], ['Pork sausage', 339, 19, 0, 0.6, 10, 750, 1.5, 29],
  ['Instant ramen, dry', 440, 10, 2, 2, 6.5, 1500, 60, 18], ['Cream cheese', 342, 6, 0, 3.2, 19, 321, 4, 34],
  ['Candy bar', 500, 6, 3, 50, 17, 100, 60, 26], ['Blueberry muffin', 377, 5, 1.5, 33, 2.5, 400, 53, 15],
  ['Beer', 43, 0.5, 0, 0, 0, 4, 3.6, 0], ['Light beer', 29, 0.2, 0, 0.1, 0, 4, 1.6, 0], ['Red wine', 85, 0.1, 0, 0.6, 0, 4, 2.6, 0],
  ['White wine', 82, 0.1, 0, 1, 0, 5, 2.6, 0], ['Hard cider', 45, 0.1, 0, 3.5, 0, 4, 4.5, 0], ['Gin and tonic', 80, 0, 0, 5.5, 0, 5, 6, 0],
  ['Vodka', 231, 0, 0, 0, 0, 1, 0, 0], ['Whiskey', 250, 0, 0, 0, 0, 0, 0.1, 0], ['Port', 160, 0.1, 0, 12, 0, 4, 12, 0],
  // In between
  ['White rice, cooked', 130, 2.7, 0.4, 0.1, 0.1, 1, 28, 0.3], ['White bread', 265, 9, 2.7, 5, 0.7, 491, 49, 3.2],
  ['Whole milk', 61, 3.2, 0, 5.1, 1.9, 43, 4.8, 3.3], ['French fries', 312, 3.4, 3.8, 0.3, 2.3, 210, 41, 15],
  ['Ground beef, 80/20', 254, 26, 0, 0, 6.5, 66, 0, 17], ['Almonds', 579, 21, 12.5, 4.4, 3.8, 1, 22, 50],
  ['Granola', 471, 10, 8, 25, 4, 40, 64, 20], ['Sushi roll', 150, 5, 1, 6, 0.3, 330, 28, 1],
  ['Canned chicken soup', 31, 1.8, 0.2, 0.4, 0.3, 380, 3.8, 1], ['Mac and cheese', 164, 6, 1, 3, 3, 420, 20, 6],
];
const foodOf = ([, calories, protein, fiber, sugar, saturatedFat, sodium, carbs, fat]) =>
  ({ calories, protein, fiber, sugar, saturatedFat, sodium, carbs, fat });
const wholeStars = { A: 5, B: 4, C: 3, D: 2, E: 1 };
const wholeStarsOf = (row) => wholeStars[rateFood(foodOf(row))];
const halfStarsOf = (row) => scoreFood(foodOf(row)).stars;
const named = (names) => TABLE.filter((row) => names.includes(row[0]));

describe('real foods', () => {
  const WHOLE_FOODS = [
    'Apple', 'Banana', 'Orange', 'Strawberries', 'Blueberries', 'Broccoli', 'Spinach', 'Kale', 'Carrot', 'Baked potato',
    'Sweet potato', 'Chicken breast', 'Salmon', 'Boiled egg', 'Shrimp', 'Tuna in water', 'Greek yogurt, nonfat', 'Tofu',
    'Lentils, cooked', 'Black beans, cooked', 'Edamame', 'Rolled oats, dry', 'Oatmeal, cooked', 'Quinoa, cooked',
    'Egg white', 'Pasta, cooked', 'Air-popped popcorn',
  ];
  const JUNK = [
    'Bacon', 'Cheddar', 'Milk chocolate', 'Chocolate chip cookie', 'Vanilla ice cream', 'Glazed donut', 'Cola',
    'Lemon-lime soda', 'Energy drink', 'Sports drink', 'Orange juice', 'Peanut butter', 'Olive oil', 'Butter', 'Hot dog',
    'Sugary cereal', 'Mayonnaise', 'Ketchup', 'Ranch dressing', 'Cheese pizza', 'Cheeseburger', 'Potato chips',
    'Gummy bears', 'Croissant', 'Chicken nuggets', 'Fried chicken', 'Honey', 'Pretzels', 'Saltine crackers',
    'Pork sausage', 'Instant ramen, dry', 'Cream cheese', 'Candy bar', 'Blueberry muffin',
    'Beer', 'Light beer', 'Red wine', 'White wine', 'Hard cider', 'Gin and tonic',
  ];
  const STRONG_DRINKS = ['Vodka', 'Whiskey', 'Port'];

  it('has every food it is named for in the table', () => {
    expect(named(WHOLE_FOODS)).toHaveLength(WHOLE_FOODS.length);
    expect(named(JUNK)).toHaveLength(JUNK.length);
    expect(named(STRONG_DRINKS)).toHaveLength(STRONG_DRINKS.length);
  });

  it.each(STRONG_DRINKS)('%s is 1 star', (name) => {
    expect(wholeStarsOf(named([name])[0])).toBe(1);
  });

  it.each(WHOLE_FOODS)('%s is 4 or 5 stars', (name) => {
    expect(wholeStarsOf(named([name])[0])).toBeGreaterThanOrEqual(4);
  });

  it.each(JUNK)('%s is 2 stars or fewer', (name) => {
    expect(wholeStarsOf(named([name])[0])).toBeLessThanOrEqual(2);
  });

  it('spreads the table over the whole scale instead of piling up at 3 stars', () => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of TABLE) counts[wholeStarsOf(row)] += 1;
    for (const level of [1, 2, 3, 4, 5]) expect(counts[level]).toBeGreaterThan(0);
    expect(counts[3] / TABLE.length).toBeLessThan(0.2);
    expect(Math.max(...Object.values(counts)) / TABLE.length).toBeLessThan(0.4);
  });

  it('puts a vegetable above a processed snack, and a whole fruit above its juice', () => {
    expect(wholeStarsOf(named(['Broccoli'])[0])).toBeGreaterThan(wholeStarsOf(named(['Potato chips'])[0]));
    expect(wholeStarsOf(named(['Orange'])[0])).toBeGreaterThan(wholeStarsOf(named(['Orange juice'])[0]));
  });
});

// The rating as it is kept on a food: the grade, its stars in half steps, and partial: true when a missing figure held it back.
describe('ratingFor', () => {
  const chickenBreast = { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sugar: 0 };

  it('is just the grade when every figure the food is judged on is there', () => {
    const rating = ratingFor({ ...chickenBreast, saturatedFat: 1, sodium: 74 });
    expect(rating).toEqual({ score: 'A', stars: 4.5 });
    expect(rating).not.toHaveProperty('partial');
  });

  it('is marked partial when sodium and saturated fat are missing, which also holds chicken breast to C', () => {
    expect(ratingFor(chickenBreast)).toEqual({ score: 'C', stars: 3, partial: true });
  });

  it('is marked partial when only one figure is missing', () => {
    expect(ratingFor({ ...chickenBreast, saturatedFat: 1 })).toEqual({ score: 'B', stars: 4, partial: true });
  });

  it('is nothing, so no stars, when there is no energy figure', () => {
    expect(ratingFor({ protein: 31 })).toBeNull();
    expect(ratingFor({})).toBeNull();
    expect(ratingFor()).toBeNull();
  });

  it('carries the same grade as rateFood', () => {
    for (const row of [{ ...chickenBreast, sodium: 600, saturatedFat: 5 }, { calories: 900, fat: 100, sugar: 0, saturatedFat: 30, sodium: 0 }, chickenBreast]) {
      expect(ratingFor(row).score).toBe(rateFood(row));
    }
  });
});

describe('stars in half steps', () => {
  // Written out again here on purpose: [score, stars]. Each grade is split at its middle (A -1 and under, B 0-2, C 3-10, D 11-18, E 19 and over).
  const STEPS = [
    [-15, 5], [-7, 5], [-6, 5], [-5, 4.5], [-2, 4.5], [-1, 4.5],
    [0, 4], [1, 4], [2, 3.5],
    [3, 3], [6, 3], [7, 2.5], [10, 2.5],
    [11, 2], [14, 2], [15, 1.5], [18, 1.5],
    [19, 1], [28, 1], [29, 0.5], [40, 0.5],
  ];
  const gradeOfScore = (score) => (score <= -1 ? 'A' : score <= 2 ? 'B' : score <= 10 ? 'C' : score <= 18 ? 'D' : 'E');

  it.each(STEPS)('a score of %i is %s stars', (score, stars) => {
    expect(starsForScore(score)).toBe(stars);
  });

  it('keeps every grade between its whole stars and half a star under them, at every score', () => {
    for (let score = -15; score <= 40; score++) {
      const whole = gradeToStars(gradeOfScore(score));
      const stars = starsForScore(score);
      expect([score, stars <= whole]).toEqual([score, true]);
      expect([score, stars >= whole - 0.5]).toEqual([score, true]);
    }
  });

  it('never gives more stars for a worse score, and only uses half steps from 0.5 to 5', () => {
    let last = 5;
    for (let score = -15; score <= 40; score++) {
      const stars = starsForScore(score);
      expect(stars).toBeLessThanOrEqual(last);
      expect(stars * 2).toBe(Math.round(stars * 2));
      expect(stars).toBeGreaterThanOrEqual(0.5);
      last = stars;
    }
  });

  it('is on the score of a food, along with its grade', () => {
    const apple = { calories: 52, protein: 0.3, fiber: 2.4, sugar: 10.4, saturatedFat: 0.03, sodium: 1, fat: 0.2 };
    expect(scoreFood(apple)).toMatchObject({ grade: 'A', score: -2, stars: 4.5 });
    expect(scoreFood({ calories: 541, protein: 37, fiber: 0, sugar: 1.3, saturatedFat: 14, sodium: 1717, carbs: 1.4, fat: 42 })).toMatchObject({ grade: 'E', stars: 0.5 });
  });

  it('is null, like the grade, when there is no energy figure', () => {
    expect(scoreFood({ protein: 31 }).stars).toBeNull();
  });

  it('is held down with the grade when a figure is missing: B at best (4 stars) for one, C at best (3) for two or more', () => {
    const lean = { calories: 30, protein: 5, fiber: 4, sugar: 1, carbs: 3, fat: 0.3, sodium: 10, saturatedFat: 0 };
    expect(ratingFor(lean)).toEqual({ score: 'A', stars: 5 });
    expect(ratingFor({ ...lean, sodium: undefined })).toEqual({ score: 'B', stars: 4, partial: true });
    expect(ratingFor({ ...lean, sodium: undefined, saturatedFat: undefined, fat: 5 })).toEqual({ score: 'C', stars: 3, partial: true });
  });

  it('does not lift a poor food that is also missing a figure: the hold-back only ever lowers the stars', () => {
    const cookie = { calories: 488, protein: 5.7, fiber: 3.5, sugar: 36, saturatedFat: 8, carbs: 65, fat: 24 };
    expect(ratingFor({ ...cookie, sodium: 350 }).stars).toBe(1);
    expect(ratingFor(cookie).stars).toBe(1);
  });

  it('holds a drink that is only sugar to 2 stars, and spirits to 1', () => {
    const cola = { calories: 42, protein: 0, fiber: 0, sugar: 10.6, saturatedFat: 0, sodium: 4, carbs: 10.6, fat: 0 };
    expect(ratingFor(cola)).toEqual({ score: 'D', stars: 2 });
    const vodka = { calories: 231, protein: 0, fiber: 0, sugar: 0, saturatedFat: 0, sodium: 1, carbs: 0, fat: 0 };
    expect(ratingFor(vodka)).toEqual({ score: 'E', stars: 1 });
  });

  it('leaves a sugar-only food that already scores in the worse half of D at 1.5: a hold-back only lowers', () => {
    const syrup = { calories: 300, protein: 0, fiber: 0, sugar: 75, saturatedFat: 0, sodium: 5, carbs: 75, fat: 0 };
    expect(scoreFood(syrup)).toMatchObject({ grade: 'D', score: 18, sugarOnly: true, stars: 1.5 });
  });

  it('spreads the real foods over half steps from 0.5 to 5, instead of five bunches', () => {
    const counts = {};
    for (const row of TABLE) counts[halfStarsOf(row)] = (counts[halfStarsOf(row)] || 0) + 1;
    expect(Object.keys(counts).map(Number).sort((a, b) => a - b)).toEqual([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]);
    expect(Math.max(...Object.values(counts)) / TABLE.length).toBeLessThan(0.3);
  });

  it('puts the real foods in order: vegetables and pulses over fish and eggs over bread over pizza over sweets and processed meat', () => {
    const at = (name) => halfStarsOf(named([name])[0]);
    expect(at('Lentils, cooked')).toBeGreaterThan(at('Salmon'));
    expect(at('Salmon')).toBeGreaterThan(at('Boiled egg'));
    expect(at('Boiled egg')).toBeGreaterThan(at('White bread'));
    expect(at('White bread')).toBeGreaterThan(at('Cheese pizza'));
    expect(at('Cheese pizza')).toBeGreaterThan(at('Milk chocolate'));
    expect(at('Bacon')).toBe(0.5);
  });
});

describe('starsOf, the stars to show for a rating kept on a food', () => {
  it('is the stars the rating carries', () => {
    expect(starsOf({ score: 'C', stars: 2.5 })).toBe(2.5);
    expect(starsOf({ score: 'A', stars: 5 })).toBe(5);
    expect(starsOf({ score: 'E', stars: 0.5, partial: true })).toBe(0.5);
  });

  it('is the whole stars of the grade for a rating kept before half stars, which has only the grade', () => {
    expect(['A', 'B', 'C', 'D', 'E'].map((score) => starsOf({ score }))).toEqual([5, 4, 3, 2, 1]);
  });

  it('puts stars that are not on a half step right, and ignores stars that cannot be real', () => {
    expect(starsOf({ score: 'B', stars: 3.5000001 })).toBe(3.5);
    for (const stars of [0, 0.2, 5.5, 7, -1, NaN, Infinity, '4', true, null, undefined]) expect([stars, starsOf({ score: 'C', stars })]).toEqual([stars, 3]);
  });

  it('is nothing, so no stars, without a rating or a usable grade', () => {
    for (const rating of [null, undefined, {}, 'A', 5, { score: 'Z' }, { score: '' }, { stars: 'many' }]) expect([rating, starsOf(rating)]).toEqual([rating, null]);
  });
});

describe('gradeToStars', () => {
  it('shows A to E as 5 to 1 stars, and anything else as nothing', () => {
    expect(['A', 'B', 'C', 'D', 'E'].map(gradeToStars)).toEqual([5, 4, 3, 2, 1]);
    for (const grade of ['F', 'a', '', null, undefined, 3]) expect(gradeToStars(grade)).toBeNull();
  });
});
