// What the Macros and Weight cards on Home say (lib/macroWeightData.js): plain functions, so every rule is checked here.
import { KG_TO_LB, macrosSummary, weightSummary } from '../lib/macroWeightData';
import { foodTotals } from '../lib/nutritionHistory';

const DASH = '\u2014';
const DOWN = '\u2193';
const UP = '\u2191';
const food = (o = {}) => ({ name: 'Food', calories: 100, protein: 10, carbs: 20, fat: 5, ...o });
const meal = (date, foods, o = {}) => ({ id: `${date}-m`, date, foods, ...o });
const GOALS = { calories: 2000, protein: 150, carbs: 200, fat: 65, water: 2000 };
const TODAY = '2026-10-20';
const lbs = (n) => n / KG_TO_LB; // the kg that shows as n lbs

describe('macrosSummary', () => {
  it('adds up the protein, carbs and fat eaten today across meals, and ignores other days', () => {
    const meals = [
      meal(TODAY, [food({ protein: 30, carbs: 40, fat: 10 }), food({ protein: 20, carbs: 5, fat: 2 })]),
      meal(TODAY, [food({ protein: 12, carbs: 60, fat: 20 })], { id: 'dinner' }),
      meal('2026-10-19', [food({ protein: 99, carbs: 99, fat: 99 })]),
      meal('2026-10-21', [food({ protein: 77, carbs: 77, fat: 77 })]),
    ];
    const s = macrosSummary({ meals, goals: GOALS, dateKey: TODAY });
    expect(s.rows.map((r) => [r.key, r.grams])).toEqual([['protein', 62], ['carbs', 105], ['fat', 32]]);
    expect(s.state).toBe('logged');
    expect(s.caption).toBe('Today');
  });

  it('lists protein, carbs and fat in that order, with the colours the Nutrition screen gives them', () => {
    const s = macrosSummary({ meals: [], goals: GOALS, dateKey: TODAY });
    expect(s.rows.map((r) => [r.key, r.label, r.color])).toEqual([
      ['protein', 'Protein', '#3B82F6'],
      ['carbs', 'Carbs', '#F97316'],
      ['fat', 'Fat', '#A855F7'],
    ]);
  });

  it('gives the same grams as the Nutrition screen, which rounds each macro of the day total', () => {
    const foods = [food({ protein: 10.4, carbs: 20.4, fat: 5.4 }), food({ protein: 10.4, carbs: 20.4, fat: 5.4 })];
    const totals = foodTotals(foods);
    const s = macrosSummary({ meals: [meal(TODAY, foods)], goals: GOALS, dateKey: TODAY });
    expect(s.rows.map((r) => r.grams)).toEqual([Math.round(totals.protein), Math.round(totals.carbs), Math.round(totals.fat)]);
    expect(s.rows.map((r) => r.grams)).toEqual([21, 41, 11]); // 20.8, 40.8, 10.8: rounded once, after adding
  });

  it('writes each row as grams out of the goal, and how full its bar is', () => {
    const s = macrosSummary({ meals: [meal(TODAY, [food({ protein: 75, carbs: 50, fat: 13 })])], goals: GOALS, dateKey: TODAY });
    const [protein, carbs, fat] = s.rows;
    expect(protein).toMatchObject({ text: '75/150g', goal: 150, pct: 50, over: false });
    expect(carbs).toMatchObject({ text: '50/200g', goal: 200, pct: 25, over: false });
    expect(fat).toMatchObject({ text: '13/65g', goal: 65, pct: 20, over: false });
  });

  it('fills the bar and says over once the goal is passed, but not at the goal', () => {
    const at = macrosSummary({ meals: [meal(TODAY, [food({ protein: 150, carbs: 200, fat: 65 })])], goals: GOALS, dateKey: TODAY });
    expect(at.rows.map((r) => [r.pct, r.over])).toEqual([[100, false], [100, false], [100, false]]);
    const past = macrosSummary({ meals: [meal(TODAY, [food({ protein: 151, carbs: 400, fat: 66 })])], goals: GOALS, dateKey: TODAY });
    expect(past.rows.map((r) => [r.pct, r.over])).toEqual([[100, true], [100, true], [100, true]]);
    expect(past.rows[1].text).toBe('400/200g');
  });

  it('measures the bar against the goal as it is set, and writes a goal with a fraction to the gram', () => {
    const s = macrosSummary({ meals: [meal(TODAY, [food({ protein: 75, carbs: 0, fat: 0 })])], goals: { ...GOALS, protein: 150.4 }, dateKey: TODAY });
    expect(s.rows[0]).toMatchObject({ goal: 150, text: '75/150g', pct: 50 });
  });

  it('never draws a bar below empty', () => {
    const s = macrosSummary({ meals: [meal(TODAY, [food({ protein: 10, carbs: 10, fat: -5 })])], goals: GOALS, dateKey: TODAY });
    expect(s.rows[2]).toMatchObject({ grams: -5, pct: 0, over: false });
  });

  it.each([[undefined], [null], [0], [-5], [NaN], ['soon'], ['']])('shows just the grams, with no bar, when the goal is %s', (bad) => {
    const s = macrosSummary({ meals: [meal(TODAY, [food({ protein: 40, carbs: 10, fat: 3 })])], goals: { protein: bad, carbs: bad, fat: bad }, dateKey: TODAY });
    expect(s.rows.map((r) => [r.text, r.goal, r.pct, r.over])).toEqual([['40g', null, null, false], ['10g', null, null, false], ['3g', null, null, false]]);
  });

  it('takes a goal given as a number in a string', () => {
    const s = macrosSummary({ meals: [meal(TODAY, [food({ protein: 75 })])], goals: { protein: '150' }, dateKey: TODAY });
    expect(s.rows[0]).toMatchObject({ goal: 150, pct: 50 });
  });

  it('says nothing is logged when the day has no food, with the goals shown as zero of each', () => {
    const s = macrosSummary({ meals: [meal('2026-10-19', [food()])], goals: GOALS, dateKey: TODAY });
    expect(s.state).toBe('empty');
    expect(s.caption).toBe('Nothing logged yet');
    expect(s.sentence).toBe('Macros today: nothing logged yet');
    expect(s.rows.map((r) => r.text)).toEqual(['0/150g', '0/200g', '0/65g']);
    expect(s.rows.map((r) => r.pct)).toEqual([0, 0, 0]);
  });

  it('counts a day as logged when it has food, even food with no macros', () => {
    const s = macrosSummary({ meals: [meal(TODAY, [{ name: 'Water' }])], goals: GOALS, dateKey: TODAY });
    expect(s.state).toBe('logged');
    expect(s.rows.map((r) => r.grams)).toEqual([0, 0, 0]);
  });

  it('writes the day as a sentence for a screen reader', () => {
    const s = macrosSummary({ meals: [meal(TODAY, [food({ protein: 82, carbs: 120, fat: 40 })])], goals: GOALS, dateKey: TODAY });
    expect(s.sentence).toBe('Macros today: protein 82 of 150 grams, carbs 120 of 200 grams, fat 40 of 65 grams');
    const noGoals = macrosSummary({ meals: [meal(TODAY, [food({ protein: 82, carbs: 120, fat: 40 })])], goals: {}, dateKey: TODAY });
    expect(noGoals.sentence).toBe('Macros today: protein 82 grams, carbs 120 grams, fat 40 grams');
  });

  it('treats a food with a missing or broken number as zero for it, not as NaN for the day', () => {
    const meals = [meal(TODAY, [food({ protein: 'abc', carbs: undefined, fat: null }), food({ protein: '12', carbs: 8, fat: 2 })])];
    const s = macrosSummary({ meals, goals: GOALS, dateKey: TODAY });
    expect(s.rows.map((r) => r.grams)).toEqual([12, 8, 2]);
  });

  it('survives missing or malformed input', () => {
    expect(() => macrosSummary()).not.toThrow();
    expect(macrosSummary().state).toBe('empty');
    const odd = macrosSummary({ meals: [null, undefined, 5, { date: TODAY }, { date: TODAY, foods: 'x' }, meal(TODAY, [null, food({ protein: 9 })])], goals: GOALS, dateKey: TODAY });
    expect(odd.rows[0].grams).toBe(9);
    expect(macrosSummary({ meals: 'nope', goals: null, dateKey: TODAY }).rows.map((r) => r.text)).toEqual(['0g', '0g', '0g']);
  });
});

describe('weightSummary', () => {
  it('says nothing is logged, and asks for a weight', () => {
    const s = weightSummary({ logs: [], scans: [], pounds: true });
    expect(s).toEqual({
      state: 'empty', value: DASH, change: null, bodyFat: null, caption: 'Log your weight', sentence: 'Weight: nothing logged yet',
    });
  });

  it('shows the latest weight in pounds, rounded to the pound like the Progress screen', () => {
    const s = weightSummary({ logs: [{ weightKg: 80 }, { weightKg: 78 }], pounds: true });
    expect(s.state).toBe('logged');
    expect(s.value).toBe('172 lbs'); // 78 kg is 171.96 lb
  });

  it('shows the latest weight in kilograms to a tenth', () => {
    const s = weightSummary({ logs: [{ weightKg: 80 }, { weightKg: 78.44 }], pounds: false });
    expect(s.value).toBe('78.4 kg');
  });

  it('defaults to pounds', () => {
    expect(weightSummary({ logs: [{ weightKg: 100 }] }).value).toBe('220 lbs');
  });

  it('has no change line with only one log', () => {
    expect(weightSummary({ logs: [{ weightKg: 78 }], pounds: true }).change).toBeNull();
  });

  it('says how far the weight has come down since the first log', () => {
    const s = weightSummary({ logs: [{ weightKg: lbs(176) }, { weightKg: lbs(174) }, { weightKg: lbs(172) }], pounds: true });
    expect(s.change).toEqual({ text: `${DOWN} 4 lbs from start`, direction: 'down' });
    expect(s.sentence).toBe('Weight: 172 lbs, down 4 lbs from the start');
  });

  it('says how far it has gone up', () => {
    const s = weightSummary({ logs: [{ weightKg: lbs(150) }, { weightKg: lbs(157) }], pounds: true });
    expect(s.change).toEqual({ text: `${UP} 7 lbs from start`, direction: 'up' });
    expect(s.sentence).toBe('Weight: 157 lbs, up 7 lbs from the start');
  });

  it('says there is no change when the weights match', () => {
    const s = weightSummary({ logs: [{ weightKg: lbs(160) }, { weightKg: lbs(165) }, { weightKg: lbs(160) }], pounds: true });
    expect(s.change).toEqual({ text: 'No change from start', direction: 'same' });
    expect(s.sentence).toBe('Weight: 160 lbs, no change from the start');
  });

  it('rounds each weight before taking the difference, as the Progress screen does', () => {
    // 80.0 kg and 79.9 kg are both 176 lb once rounded, so the screen says no change, not "0.2 lbs".
    const s = weightSummary({ logs: [{ weightKg: 80 }, { weightKg: 79.9 }], pounds: true });
    expect(s.change.direction).toBe('same');
    // 80.0 kg (176) and 79.5 kg (175) are one pound apart even though they are half a kilo apart.
    expect(weightSummary({ logs: [{ weightKg: 80 }, { weightKg: 79.5 }], pounds: true }).change.text).toBe(`${DOWN} 1 lbs from start`);
  });

  it('works out a change in kilograms without float noise', () => {
    const s = weightSummary({ logs: [{ weightKg: 80.3 }, { weightKg: 78.1 }], pounds: false });
    expect(s.change).toEqual({ text: `${DOWN} 2.2 kg from start`, direction: 'down' });
    expect(weightSummary({ logs: [{ weightKg: 78.1 }, { weightKg: 80.3 }], pounds: false }).change.text).toBe(`${UP} 2.2 kg from start`);
    expect(weightSummary({ logs: [{ weightKg: 78.1 }, { weightKg: 78.14 }], pounds: false }).change.direction).toBe('same');
  });

  it('skips logs with no usable weight', () => {
    const logs = [{ weightKg: 0 }, { weightKg: -3 }, { weightKg: null }, { weightKg: 'abc' }, {}, null, undefined, { weightKg: lbs(180) }, { weightKg: NaN }, { weightKg: lbs(178) }];
    const s = weightSummary({ logs, pounds: true });
    expect(s.value).toBe('178 lbs');
    expect(s.change.text).toBe(`${DOWN} 2 lbs from start`); // from the first usable log
    expect(weightSummary({ logs: [{ weightKg: 0 }, null], pounds: true }).state).toBe('empty');
  });

  it('takes a weight given as a number in a string', () => {
    expect(weightSummary({ logs: [{ weightKg: '78' }], pounds: false }).value).toBe('78 kg');
  });

  describe('the target', () => {
    const logs = [{ weightKg: 80 }, { weightKg: 78 }];

    it('says how far the weight is from it, in pounds', () => {
      const s = weightSummary({ logs, pounds: true, targetKg: 75 });
      expect(s.caption).toBe('7 lbs to target'); // 172 against 165
      expect(s.sentence).toBe('Weight: 172 lbs, down 4 lbs from the start, 7 lbs from the target');
    });

    it('says how far in kilograms', () => {
      expect(weightSummary({ logs: [{ weightKg: 80 }, { weightKg: 78.1 }], pounds: false, targetKg: 75 }).caption).toBe('3.1 kg to target');
    });

    it('says how far whichever side of the target the weight is on', () => {
      expect(weightSummary({ logs: [{ weightKg: 70 }], pounds: false, targetKg: 75 }).caption).toBe('5 kg to target');
      expect(weightSummary({ logs: [{ weightKg: 80 }], pounds: false, targetKg: 75 }).caption).toBe('5 kg to target');
    });

    it('says at target when the shown weight is the shown target', () => {
      const s = weightSummary({ logs: [{ weightKg: lbs(165) }], pounds: true, targetKg: lbs(165) });
      expect(s.caption).toBe('At target');
      expect(s.sentence).toBe('Weight: 165 lbs, at the target');
      expect(weightSummary({ logs: [{ weightKg: 75.04 }], pounds: false, targetKg: 75 }).caption).toBe('At target');
    });

    it.each([[undefined], [null], [0], [-70], [NaN], ['soon'], ['']])('points to the Progress screen when the target is %s', (bad) => {
      const s = weightSummary({ logs, pounds: true, targetKg: bad });
      expect(s.caption).toBe('View progress');
      expect(s.sentence).toBe('Weight: 172 lbs, down 4 lbs from the start');
    });

    it('does not use the target when nothing is logged', () => {
      const s = weightSummary({ logs: [], pounds: true, targetKg: 75 });
      expect(s.caption).toBe('Log your weight');
      expect(s.sentence).toBe('Weight: nothing logged yet');
    });
  });

  describe('body fat from the scans', () => {
    const logs = [{ weightKg: 78 }];

    it('shows the latest scan\'s body fat', () => {
      const s = weightSummary({ logs, scans: [{ bodyFatPercent: 18.2 }], pounds: true });
      expect(s.bodyFat).toEqual({ text: '18.2%', change: '' });
      expect(s.sentence).toBe('Weight: 172 lbs, body fat 18.2 percent');
    });

    it('shows how it has moved since the scan before', () => {
      const down = weightSummary({ logs, scans: [{ bodyFatPercent: 19.3 }, { bodyFatPercent: 18.2 }], pounds: true });
      expect(down.bodyFat).toEqual({ text: '18.2%', change: `${DOWN}1.1` });
      expect(down.sentence).toBe('Weight: 172 lbs, body fat 18.2 percent, down 1.1 since the scan before');
      const up = weightSummary({ logs, scans: [{ bodyFatPercent: 17 }, { bodyFatPercent: 18.2 }], pounds: true });
      expect(up.bodyFat).toEqual({ text: '18.2%', change: `${UP}1.2` });
      expect(up.sentence).toBe('Weight: 172 lbs, body fat 18.2 percent, up 1.2 since the scan before');
    });

    it('shows no arrow when it has not moved', () => {
      expect(weightSummary({ logs, scans: [{ bodyFatPercent: 18.2 }, { bodyFatPercent: 18.2 }], pounds: true }).bodyFat.change).toBe('');
      expect(weightSummary({ logs, scans: [{ bodyFatPercent: 18.24 }, { bodyFatPercent: 18.2 }], pounds: true }).bodyFat.change).toBe('');
    });

    it('compares with the nearest earlier scan that has a body fat figure', () => {
      const s = weightSummary({ logs, scans: [{ bodyFatPercent: 20 }, { bodyFatPercent: null }, {}, { bodyFatPercent: 18 }], pounds: true });
      expect(s.bodyFat).toEqual({ text: '18%', change: `${DOWN}2` });
    });

    it('compares with the scan just before the latest, not the first one', () => {
      const s = weightSummary({ logs, scans: [{ bodyFatPercent: 22 }, { bodyFatPercent: 19.5 }, { bodyFatPercent: 18 }], pounds: true });
      expect(s.bodyFat.change).toBe('\u21931.5');
    });

    it('shows nothing when the latest scan has no body fat, even if an earlier one did', () => {
      expect(weightSummary({ logs, scans: [{ bodyFatPercent: 18 }, { bodyFatPercent: null }], pounds: true }).bodyFat).toBeNull();
      expect(weightSummary({ logs, scans: [{ bodyFatPercent: 18 }, {}], pounds: true }).bodyFat).toBeNull();
    });

    it('rounds the figure to a tenth', () => {
      expect(weightSummary({ logs, scans: [{ bodyFatPercent: 18.26 }], pounds: true }).bodyFat.text).toBe('18.3%');
    });

    it('is the same in pounds and kilograms', () => {
      const scans = [{ bodyFatPercent: 19 }, { bodyFatPercent: 18 }];
      expect(weightSummary({ logs, scans, pounds: false }).bodyFat).toEqual(weightSummary({ logs, scans, pounds: true }).bodyFat);
    });

    it('shows with no weight logged', () => {
      const s = weightSummary({ logs: [], scans: [{ bodyFatPercent: 18.2 }], pounds: true });
      expect(s.state).toBe('empty');
      expect(s.value).toBe(DASH);
      expect(s.bodyFat).toEqual({ text: '18.2%', change: '' });
      expect(s.sentence).toBe('Weight: nothing logged yet, body fat 18.2 percent');
    });

    it('shows nothing for a body fat that is zero, negative or not a number', () => {
      [0, -4, NaN, 'abc', null].forEach((bad) => {
        expect(weightSummary({ logs, scans: [{ bodyFatPercent: bad }], pounds: true }).bodyFat).toBeNull();
      });
    });
  });

  it('survives missing or malformed input', () => {
    expect(() => weightSummary()).not.toThrow();
    expect(weightSummary().state).toBe('empty');
    expect(weightSummary({ logs: 'x', scans: 5 }).bodyFat).toBeNull();
    expect(weightSummary({ logs: null, scans: [null, undefined] }).state).toBe('empty');
  });
});
