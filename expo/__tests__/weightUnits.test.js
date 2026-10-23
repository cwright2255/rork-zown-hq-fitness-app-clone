import {
  unitFromSetting, unitLabel, fromPounds, toPounds, weightNumber, weightText, historyIn, targetIn,
} from '../lib/weightUnits';
import { KG_TO_LB } from '../lib/macroWeightData';

describe('unitFromSetting', () => {
  it.each([
    ['metric', 'kg'],
    ['imperial', 'lb'],
    [undefined, 'lb'],
    [null, 'lb'],
    ['', 'lb'],
    ['Metric', 'lb'],
    ['kg', 'lb'],
    [1, 'lb'],
  ])('%p is %s', (setting, unit) => {
    expect(unitFromSetting(setting)).toBe(unit);
  });
});

describe('unitLabel', () => {
  it('is kg for kg and lb for everything else', () => {
    expect(unitLabel('kg')).toBe('kg');
    expect(unitLabel('lb')).toBe('lb');
    expect(unitLabel(undefined)).toBe('lb');
    expect(unitLabel('KG')).toBe('lb');
  });
});

describe('the factor', () => {
  it('is the one the Progress screen and the body weight maths use', () => {
    expect(KG_TO_LB).toBe(2.20462);
  });
});

describe('fromPounds', () => {
  it.each([
    [225, 'kg', 102.06],
    [135, 'kg', 61.24],
    [45, 'kg', 20.41],
    [100, 'kg', 45.36],
    [5, 'kg', 2.27],
    [0, 'kg', 0],
    [225, 'lb', 225],
    [220.46, 'lb', 220.46],
    [137.5, 'lb', 137.5],
    [225, undefined, 225],
  ])('%p lb in %s is %p', (pounds, unit, expected) => {
    expect(fromPounds(pounds, unit)).toBe(expected);
  });

  it.each([[null], [undefined], ['225'], [NaN], [Infinity], [{}]])('%p is not a weight', (value) => {
    expect(fromPounds(value, 'kg')).toBeNull();
    expect(fromPounds(value, 'lb')).toBeNull();
  });
});

describe('toPounds', () => {
  it.each([
    [100, 'kg', 220.46],
    [102.5, 'kg', 225.97],
    [20, 'kg', 44.09],
    [2.5, 'kg', 5.51],
    [0, 'kg', 0],
    [225, 'lb', 225],
    [137.5, 'lb', 137.5],
    [225, undefined, 225],
  ])('%p in %s is %p lb', (value, unit, expected) => {
    expect(toPounds(value, unit)).toBe(expected);
  });

  it.each([[null], [undefined], ['100'], [NaN], [-Infinity]])('%p is not a weight', (value) => {
    expect(toPounds(value, 'kg')).toBeNull();
    expect(toPounds(value, 'lb')).toBeNull();
  });
});

describe('a weight typed in kilograms and read back', () => {
  it('comes back as typed, for every hundredth of a kilogram from 0.01 to 300', () => {
    const bad = [];
    for (let hundredths = 1; hundredths <= 30000; hundredths += 1) {
      const kg = hundredths / 100;
      const back = fromPounds(toPounds(kg, 'kg'), 'kg');
      if (back !== kg) bad.push([kg, toPounds(kg, 'kg'), back]);
    }
    expect(bad).toEqual([]);
  });

  it('comes back as typed in the plate jumps the load rules use (2.5 kg), up to 500 kg', () => {
    for (let kg = 2.5; kg <= 500; kg += 2.5) {
      expect(fromPounds(toPounds(kg, 'kg'), 'kg')).toBe(kg);
    }
  });

  it('is not changed by pounds going in and out', () => {
    [5, 45, 135, 225, 315, 137.5, 0.5].forEach((lb) => {
      expect(toPounds(fromPounds(lb, 'lb'), 'lb')).toBe(lb);
    });
  });
});

describe('weightNumber', () => {
  it.each([
    [100, '100'],
    [102.5, '102.5'],
    [102.06, '102.1'],
    [99.96, '100'],
    [0.04, '0'],
    [0.05, '0.1'],
    [225, '225'],
    [0, '0'],
  ])('%p is %p', (value, text) => {
    expect(weightNumber(value)).toBe(text);
  });

  it.each([[null], [undefined], ['5'], [NaN]])('%p is empty text', (value) => {
    expect(weightNumber(value)).toBe('');
  });
});

describe('weightText', () => {
  it('shows a stored weight in the unit chosen, with the unit', () => {
    expect(weightText(225, 'lb')).toBe('225 lb');
    expect(weightText(225, 'kg')).toBe('102.1 kg');
    expect(weightText(225.97, 'kg')).toBe('102.5 kg');
    expect(weightText(220.46, 'kg')).toBe('100 kg');
    expect(weightText(137.5, 'lb')).toBe('137.5 lb');
  });

  it('is empty text for something that is not a weight', () => {
    expect(weightText(null, 'kg')).toBe('');
    expect(weightText(undefined, 'lb')).toBe('');
    expect(weightText('225', 'lb')).toBe('');
  });
});

describe('historyIn', () => {
  const when = new Date('2026-10-01T10:00:00Z');
  const sets = [
    { weight: 225, reps: 5, rpe: 'moderate', date: when },
    { weight: 135, reps: 8, rpe: 'easy', date: when },
  ];

  it('is the same list for pounds, and for a unit that is not kg', () => {
    expect(historyIn(sets, 'lb')).toBe(sets);
    expect(historyIn(sets, undefined)).toBe(sets);
    expect(historyIn(sets, 'KG')).toBe(sets);
    expect(historyIn(sets, 'stone')).toBe(sets);
  });

  it('turns every weight into kilograms and keeps everything else', () => {
    expect(historyIn(sets, 'kg')).toEqual([
      { weight: 102.06, reps: 5, rpe: 'moderate', date: when },
      { weight: 61.24, reps: 8, rpe: 'easy', date: when },
    ]);
  });

  it('does not change the list it was given', () => {
    const before = JSON.stringify(sets);
    historyIn(sets, 'kg');
    expect(JSON.stringify(sets)).toBe(before);
  });

  it('keeps a set whose weight is not a number as it was, and a set that is not an object', () => {
    const odd = [{ weight: undefined, reps: 10 }, { weight: '50', reps: 3 }, null, { weight: 100, reps: 1 }];
    expect(historyIn(odd, 'kg')).toEqual([{ weight: undefined, reps: 10 }, { weight: '50', reps: 3 }, null, { weight: 45.36, reps: 1 }]);
  });

  it.each([[null], [undefined], ['x'], [{}], [7]])('%p is an empty list', (value) => {
    expect(historyIn(value, 'kg')).toEqual([]);
    expect(historyIn(value, 'lb')).toEqual([]);
  });
});

describe('targetIn', () => {
  const p = (extra = {}) => ({ weight: 25.18, targetReps: 8, estimatedOneRepMax: 40, shareOfOneRepMax: 63, reason: 'r', deload: false, ...extra });

  it('leaves a prescription in pounds exactly as it was', () => {
    const input = p({ weight: 52.5 });
    expect(targetIn(input, 'lb')).toBe(input);
    expect(targetIn(input, undefined)).toBe(input);
  });

  it.each([
    [25.18, 25],
    [25.25, 25.5],
    [25.24, 25],
    [22, 22],
    [22.5, 22.5],
    [45.36, 45.5],
    [45.74, 45.5],
    [45.75, 46],
    [100, 100],
    [0.4, 0.5],
    [0.2, 0],
  ])('%p kg is loaded as %p kg', (weight, loaded) => {
    expect(targetIn(p({ weight }), 'kg').weight).toBe(loaded);
  });

  it('works out the share of the one-rep max again from the weight it rounded to', () => {
    // each starts with a share that is not the answer, so only working it out again gives the answer
    expect(targetIn(p({ weight: 25.18, estimatedOneRepMax: 40, shareOfOneRepMax: 1 }), 'kg').shareOfOneRepMax).toBe(63); // 25 / 40 = 62.5
    expect(targetIn(p({ weight: 30.2, estimatedOneRepMax: 40, shareOfOneRepMax: 1 }), 'kg').shareOfOneRepMax).toBe(75); // 30 / 40
    expect(targetIn(p({ weight: 22.4, estimatedOneRepMax: 25, shareOfOneRepMax: 1 }), 'kg').shareOfOneRepMax).toBe(90); // 22.5 / 25
    expect(targetIn(p({ weight: 22.6, estimatedOneRepMax: 45, shareOfOneRepMax: 1 }), 'kg').shareOfOneRepMax).toBe(50); // 22.5 / 45
    expect(targetIn(p({ weight: 25.18, estimatedOneRepMax: 100, shareOfOneRepMax: 99 }), 'kg').shareOfOneRepMax).toBe(25);
  });

  it('keeps the share it had when there is no one-rep max to work it out from', () => {
    expect(targetIn(p({ weight: 25.18, estimatedOneRepMax: null, shareOfOneRepMax: null }), 'kg').shareOfOneRepMax).toBeNull();
    expect(targetIn(p({ weight: 25.18, estimatedOneRepMax: 0, shareOfOneRepMax: 12 }), 'kg').shareOfOneRepMax).toBe(12);
    const bare = { weight: 25.18, targetReps: 8 };
    expect(targetIn(bare, 'kg')).toEqual({ weight: 25, targetReps: 8, shareOfOneRepMax: undefined });
  });

  it('keeps everything else on the prescription', () => {
    const input = p({ dayType: 'heavy', deload: true, setsFactor: 0.5, repRange: { min: 6, max: 8 } });
    const out = targetIn(input, 'kg');
    expect(out).toEqual({ ...input, weight: 25 });
    expect(input.weight).toBe(25.18); // the prescription it was given is not changed
  });

  it('leaves a prescription without a weight (a bodyweight move) and anything else alone', () => {
    const bodyweight = { weight: 0, targetReps: 12, reason: 'x' };
    expect(targetIn(bodyweight, 'kg')).toBe(bodyweight);
    const noWeight = { targetReps: 12 };
    expect(targetIn(noWeight, 'kg')).toBe(noWeight);
    expect(targetIn({ weight: '25.2' }, 'kg')).toEqual({ weight: '25.2' });
    expect(targetIn({ weight: -5 }, 'kg')).toEqual({ weight: -5 });
    expect(targetIn(null, 'kg')).toBeNull();
    expect(targetIn(undefined, 'kg')).toBeUndefined();
    expect(targetIn('x', 'kg')).toBe('x');
  });
});
