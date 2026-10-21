// Today's readiness, worked out from HRV, resting heart rate, sleep and training load, with the working shown (lib/readiness.js).
import {
  BASELINE_DAYS, MIN_BASELINE_READINGS, SLEEP_TARGET_HOURS, SLEEP_POINTS_PER_HOUR, USUAL_SCORE, HRV_POINTS_PER_100_PERCENT,
  RESTING_HR_POINTS_PER_100_PERCENT, LOAD_FULL_UNTIL, LOAD_HALF_AT, LOAD_ZERO_AT, MIN_BODY_PARTS, READINESS_WEIGHTS, READINESS_BANDS,
  READINESS_FORMULA, readinessLabel, hrvScore, restingHeartRateScore, sleepScore, loadScore, computeReadiness,
} from '../lib/readiness';
import { shiftDateKey } from '../lib/localDate';

const TODAY = '2026-10-20';
const day = (offset) => shiftDateKey(TODAY, offset);

// A record with `field` set to `value` on each of the `count` days before today (yesterday first), plus any extra days.
const record = (parts) => {
  const history = {};
  for (const [field, value, count, extra = {}] of parts) {
    for (let i = 1; i <= count; i += 1) history[day(-i)] = { ...(history[day(-i)] || {}), [field]: value };
    for (const [offset, v] of Object.entries(extra)) history[day(Number(offset))] = { ...(history[day(Number(offset))] || {}), [field]: v };
  }
  return history;
};
const withToday = (history, values) => ({ ...history, [TODAY]: { ...(history[TODAY] || {}), ...values } });
const STEADY_LOAD = { zone: 'sweet_spot', ratio: 1, zoneLabel: 'In your typical training range', acuteLoad: 2000, chronicWeeklyAvg: 2000 };

// 28 days of HRV 50 and resting heart rate 60: this is "as usual".
const BASELINE = record([['hrv', 50, 28], ['restingHeartRate', 60, 28]]);
const byKey = (result) => Object.fromEntries(result.parts.map((p) => [p.key, p]));

describe('the numbers behind it', () => {
  it('are these, and no others', () => {
    expect(BASELINE_DAYS).toBe(28);
    expect(MIN_BASELINE_READINGS).toBe(10);
    expect(SLEEP_TARGET_HOURS).toBe(8);
    expect(SLEEP_POINTS_PER_HOUR).toBe(25);
    expect(USUAL_SCORE).toBe(75);
    expect(HRV_POINTS_PER_100_PERCENT).toBe(250);
    expect(RESTING_HR_POINTS_PER_100_PERCENT).toBe(500);
    expect([LOAD_FULL_UNTIL, LOAD_HALF_AT, LOAD_ZERO_AT]).toEqual([1.3, 1.5, 2]);
    expect(MIN_BODY_PARTS).toBe(2);
    expect(READINESS_WEIGHTS).toEqual({ hrv: 35, restingHeartRate: 25, sleep: 25, load: 15 });
    expect(Object.values(READINESS_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
    expect(READINESS_BANDS).toEqual([{ min: 75, label: 'High' }, { min: 50, label: 'Moderate' }, { min: 0, label: 'Low' }]);
  });

  it('are written out in the formula the screen shows', () => {
    expect(READINESS_FORMULA).toContain('average of the scores above');
    expect(READINESS_FORMULA).toContain('last 4 weeks');
    expect(READINESS_FORMULA).toContain('75 means the same as usual');
    expect(READINESS_FORMULA).toContain('loses 25 points for every hour under');
    expect(READINESS_FORMULA).toContain('100 up to 1.3 and falls to 0 at 2');
    expect(READINESS_FORMULA).toContain('not medical advice');
  });
});

describe('readinessLabel', () => {
  it.each([[100, 'High'], [75, 'High'], [74, 'Moderate'], [50, 'Moderate'], [49, 'Low'], [0, 'Low']])('calls %p %p', (score, label) => {
    expect(readinessLabel(score)).toBe(label);
  });

  it.each([[null], [undefined], [NaN], ['80'], [Infinity]])('has no word for %p', (score) => {
    expect(readinessLabel(score)).toBeNull();
  });
});

describe('HRV', () => {
  it('scores 75 when it is the same as usual, 100 from 10% above, and 0 from 30% below', () => {
    expect(hrvScore(50, 50)).toBe(75);
    expect(hrvScore(55, 50)).toBe(100);
    expect(hrvScore(65, 50)).toBe(100);
    expect(hrvScore(35, 50)).toBe(0);
    expect(hrvScore(10, 50)).toBe(0);
  });

  it('moves 2.5 points for each 1% either way', () => {
    expect(hrvScore(52, 50)).toBe(85);
    expect(hrvScore(45, 50)).toBe(50);
    expect(hrvScore(47.5, 50)).toBe(63);
    expect(hrvScore(110, 100)).toBe(100);
    expect(hrvScore(96, 100)).toBe(65);
  });
});

describe('resting heart rate', () => {
  it('scores 75 when it is the same as usual, 100 from 5% below, and 0 from 15% above', () => {
    expect(restingHeartRateScore(60, 60)).toBe(75);
    expect(restingHeartRateScore(57, 60)).toBe(100);
    expect(restingHeartRateScore(50, 60)).toBe(100);
    expect(restingHeartRateScore(69, 60)).toBe(0);
    expect(restingHeartRateScore(80, 60)).toBe(0);
  });

  it('moves 5 points for each 1% either way, a higher rate scoring less', () => {
    expect(restingHeartRateScore(63, 60)).toBe(50);
    expect(restingHeartRateScore(66, 60)).toBe(25);
    expect(restingHeartRateScore(58, 60)).toBe(92);
    expect(restingHeartRateScore(62, 60)).toBe(58);
  });
});

describe('sleep', () => {
  it.each([[8, 100], [9, 100], [12, 100], [7, 75], [6, 50], [5, 25], [4, 0], [3, 0], [0.5, 0], [7.4, 85], [6.6, 65]])('scores %p hours %p', (hours, score) => {
    expect(sleepScore(hours)).toBe(score);
  });
});

describe('training load', () => {
  it.each([[0, 100], [0.5, 100], [1, 100], [1.3, 100], [1.4, 75], [1.5, 50], [1.6, 40], [1.75, 25], [2, 0], [3, 0]])('scores a ratio of %p %p', (ratio, score) => {
    expect(loadScore(ratio)).toBe(score);
  });
});

describe('computeReadiness with everything', () => {
  const full = () => computeReadiness({
    history: withToday(BASELINE, { hrv: 55, restingHeartRate: 57, sleepHours: 7 }),
    today: TODAY,
    trainingLoad: STEADY_LOAD,
  });

  it('is the average of the four scores, counted by their weights', () => {
    const r = full();
    // HRV 100 x 35, resting heart rate 100 x 25, sleep 75 x 25, load 100 x 15: 9375 / 100
    expect(r.ready).toBe(true);
    expect(r.hidden).toBe(false);
    expect(r.score).toBe(94);
    expect(r.label).toBe('High');
    expect(r.used).toBe(4);
    expect(r.parts.map((p) => [p.key, p.state, p.score, p.weight])).toEqual([
      ['hrv', 'used', 100, 35], ['restingHeartRate', 'used', 100, 25], ['sleep', 'used', 75, 25], ['load', 'used', 100, 15],
    ]);
    expect(r.formula).toBe(READINESS_FORMULA);
  });

  it('says what each part is made from', () => {
    const parts = byKey(full());
    expect(parts.hrv.title).toBe('HRV');
    expect(parts.hrv.detail).toBe('55 ms today, 50 ms usual (+10%)');
    expect(parts.restingHeartRate.title).toBe('Resting heart rate');
    expect(parts.restingHeartRate.detail).toBe('57 bpm today, 60 bpm usual (-5%)');
    expect(parts.sleep.title).toBe('Sleep');
    expect(parts.sleep.detail).toBe('7.0 h last night (8 h scores 100)');
    expect(parts.load.title).toBe('Training load');
    expect(parts.load.detail).toBe('1.00 this week against your usual week');
  });

  it('adds up from the scores it shows, so the person can check it', () => {
    const r = full();
    const sum = r.parts.reduce((total, p) => total + p.weight * p.score, 0);
    expect(r.score).toBe(Math.round(sum / r.parts.reduce((total, p) => total + p.weight, 0)));
  });

  it('is low after a hard night, a high resting heart rate, a low HRV and a spike in training', () => {
    const r = computeReadiness({
      history: withToday(BASELINE, { hrv: 38, restingHeartRate: 66, sleepHours: 5 }),
      today: TODAY,
      trainingLoad: { ...STEADY_LOAD, zone: 'high', ratio: 1.75 },
    });
    // HRV 15 x 35 (24% under usual: 75 - 60), resting heart rate 25 x 25 (10% over), sleep 25 x 25, load 25 x 15: 2150 / 100 = 21.5
    expect(byKey(r).hrv.score).toBe(15);
    expect(byKey(r).restingHeartRate.score).toBe(25);
    expect(r.score).toBe(22);
    expect(r.label).toBe('Low');
  });

  it('is in the middle for an ordinary day', () => {
    const r = computeReadiness({ history: withToday(BASELINE, { hrv: 50, restingHeartRate: 60, sleepHours: 6.5 }), today: TODAY, trainingLoad: { ...STEADY_LOAD, ratio: 1.45 } });
    expect(byKey(r).sleep.score).toBe(63); // 100 - 1.5 x 25 = 62.5, rounded up
    expect(byKey(r).load.score).toBe(63);
    expect(r.score).toBe(Math.round((35 * 75 + 25 * 75 + 25 * 63 + 15 * 63) / 100));
    expect(r.label).toBe('Moderate');
  });

  it('writes the change from usual with its sign, and 0% when it rounds to nothing', () => {
    const lower = computeReadiness({ history: withToday(BASELINE, { hrv: 44, restingHeartRate: 60.1, sleepHours: 8 }), today: TODAY });
    expect(byKey(lower).hrv.detail).toBe('44 ms today, 50 ms usual (-12%)');
    expect(byKey(lower).restingHeartRate.detail).toBe('60 bpm today, 60 bpm usual (0%)');
  });
});

describe('computeReadiness when a part is missing', () => {
  it('leaves out training load, and the others share its weight', () => {
    const r = computeReadiness({ history: withToday(BASELINE, { hrv: 55, restingHeartRate: 57, sleepHours: 7 }), today: TODAY, trainingLoad: null });
    expect(r.used).toBe(3);
    expect(r.score).toBe(Math.round((35 * 100 + 25 * 100 + 25 * 75) / 85)); // 93
    expect(r.score).toBe(93);
    expect(byKey(r).load).toMatchObject({ state: 'building', score: null, detail: 'Needs about a week of workouts, runs or hikes' });
  });

  it.each([
    ['too early', { zone: 'insufficient_data', ratio: null }],
    ['no ratio', { zone: 'sweet_spot', ratio: null }],
    ['not a number', { zone: 'sweet_spot', ratio: 'high' }],
    ['not finite', { zone: 'sweet_spot', ratio: NaN }],
    ['marked too early with a ratio', { zone: 'insufficient_data', ratio: 1.2 }],
  ])('leaves out training load that is %s', (_, trainingLoad) => {
    const r = computeReadiness({ history: withToday(BASELINE, { hrv: 50, sleepHours: 8 }), today: TODAY, trainingLoad });
    expect(byKey(r).load.state).toBe('building');
    expect(r.used).toBe(2);
  });

  it('scores a ratio of nothing as full marks, since less training is not worse for readiness', () => {
    const r = computeReadiness({ history: withToday(BASELINE, { hrv: 50, sleepHours: 8 }), today: TODAY, trainingLoad: { zone: 'detraining', ratio: 0 } });
    expect(byKey(r).load).toMatchObject({ state: 'used', score: 100, detail: '0.00 this week against your usual week' });
  });

  it('waits for today\'s reading when there is a usual to compare with but nothing yet today', () => {
    const r = computeReadiness({ history: withToday(BASELINE, { hrv: 55, sleepHours: 8 }), today: TODAY, trainingLoad: STEADY_LOAD });
    expect(byKey(r).restingHeartRate).toMatchObject({ state: 'waiting', score: null, detail: 'Waiting for today\'s reading' });
    expect(r.ready).toBe(true);
    expect(r.score).toBe(Math.round((35 * 100 + 25 * 100 + 15 * 100) / 75));
  });

  it('waits for last night\'s sleep', () => {
    const r = computeReadiness({ history: withToday(BASELINE, { hrv: 55, restingHeartRate: 60 }), today: TODAY });
    expect(byKey(r).sleep).toMatchObject({ state: 'waiting', score: null, detail: 'Waiting for last night\'s sleep' });
    expect(r.ready).toBe(true);
    expect(r.used).toBe(2);
  });

  it('does not use yesterday\'s reading as today\'s', () => {
    const history = { ...BASELINE, [day(-1)]: { hrv: 55, restingHeartRate: 57, sleepHours: 8 } };
    const r = computeReadiness({ history, today: TODAY, trainingLoad: STEADY_LOAD });
    expect(r.ready).toBe(false);
    expect(byKey(r).hrv.state).toBe('waiting');
    expect(byKey(r).sleep.state).toBe('waiting');
  });

  it('is not shown as a score from sleep alone, or from one of HRV and resting heart rate alone, however good the training load', () => {
    for (const today of [{ sleepHours: 8 }, { hrv: 60 }, { restingHeartRate: 55 }]) {
      const r = computeReadiness({ history: withToday(BASELINE, today), today: TODAY, trainingLoad: STEADY_LOAD });
      expect(r.ready).toBe(false);
      expect(r.score).toBeNull();
      expect(r.label).toBeNull();
      expect(r.hidden).toBe(false);
    }
  });

  it('is shown from any two of HRV, resting heart rate and sleep', () => {
    for (const today of [{ sleepHours: 8, hrv: 50 }, { sleepHours: 8, restingHeartRate: 60 }, { hrv: 50, restingHeartRate: 60 }]) {
      const r = computeReadiness({ history: withToday(BASELINE, today), today: TODAY });
      expect(r.ready).toBe(true);
      expect(typeof r.score).toBe('number');
    }
  });
});

describe('computeReadiness and the usual', () => {
  it('needs 10 earlier readings of HRV or resting heart rate before it compares, and says how many there are', () => {
    const nine = withToday(record([['hrv', 50, 9], ['restingHeartRate', 60, 9]]), { hrv: 55, restingHeartRate: 57, sleepHours: 8 });
    const r9 = computeReadiness({ history: nine, today: TODAY });
    expect(byKey(r9).hrv).toMatchObject({ state: 'building', score: null, detail: 'Needs about two weeks of readings to compare with (9 of 10 so far)' });
    expect(byKey(r9).restingHeartRate.state).toBe('building');
    expect(r9.ready).toBe(false);

    const ten = withToday(record([['hrv', 50, 10], ['restingHeartRate', 60, 10]]), { hrv: 55, restingHeartRate: 57, sleepHours: 8 });
    const r10 = computeReadiness({ history: ten, today: TODAY });
    expect(byKey(r10).hrv.state).toBe('used');
    expect(r10.ready).toBe(true);
  });

  it('does not need earlier readings of sleep', () => {
    const r = computeReadiness({ history: withToday(record([['hrv', 50, 12]]), { hrv: 50, sleepHours: 8 }), today: TODAY });
    expect(r.ready).toBe(true);
    expect(byKey(r).sleep.state).toBe('used');
  });

  it('averages the 28 days before today: not today, and not older', () => {
    const history = record([['hrv', 50, 28, { 0: 500, '-29': 1, '-40': 1 }]]);
    const r = computeReadiness({ history: withToday(history, { hrv: 50, sleepHours: 8 }), today: TODAY });
    expect(byKey(r).hrv.detail).toBe('50 ms today, 50 ms usual (0%)');
    // 28 days back is the oldest that counts
    const edge = record([['hrv', 50, 9, { '-28': 50 }]]);
    expect(byKey(computeReadiness({ history: withToday(edge, { hrv: 50, sleepHours: 8 }), today: TODAY })).hrv.state).toBe('used');
    const tooOld = record([['hrv', 50, 9, { '-29': 50 }]]);
    expect(byKey(computeReadiness({ history: withToday(tooOld, { hrv: 50, sleepHours: 8 }), today: TODAY })).hrv.state).toBe('building');
  });

  it('uses the average of uneven days', () => {
    const history = {};
    for (let i = 1; i <= 10; i += 1) history[day(-i)] = { hrv: i % 2 ? 40 : 60 };
    const r = computeReadiness({ history: withToday(history, { hrv: 50, sleepHours: 8 }), today: TODAY });
    expect(byKey(r).hrv.detail).toBe('50 ms today, 50 ms usual (0%)');
  });

  it('calls HRV by the name it is given', () => {
    const r = computeReadiness({ history: withToday(BASELINE, { hrv: 50, sleepHours: 8 }), today: TODAY, hrvLabel: 'HRV (SDNN)' });
    expect(byKey(r).hrv.title).toBe('HRV (SDNN)');
    expect(byKey(computeReadiness({ history: BASELINE, today: TODAY })).hrv.title).toBe('HRV');
  });
});

describe('computeReadiness with nothing to build on', () => {
  it('is hidden with no readings at all', () => {
    for (const history of [{}, null, undefined, 'x', []]) {
      const r = computeReadiness({ history, today: TODAY, trainingLoad: STEADY_LOAD });
      expect(r).toMatchObject({ hidden: true, ready: false, score: null, label: null });
      expect(r.parts).toHaveLength(4);
    }
    expect(computeReadiness().hidden).toBe(true);
  });

  it('is not hidden once there is any reading, but has no score', () => {
    const r = computeReadiness({ history: { [day(-3)]: { sleepHours: 7 } }, today: TODAY });
    expect(r).toMatchObject({ hidden: false, ready: false, score: null, label: null, used: 0 });
    expect(byKey(r).hrv).toMatchObject({ state: 'building', detail: 'Needs about two weeks of readings to compare with (0 of 10 so far)' });
  });

  it('does not break on a day that is not a day', () => {
    const r = computeReadiness({ history: withToday(BASELINE, { hrv: 50, sleepHours: 8 }), today: 'tomorrow' });
    expect(r.ready).toBe(false);
    expect(r.score).toBeNull();
  });

  it('ignores readings that cannot be believed', () => {
    const history = withToday(BASELINE, { hrv: 5000, restingHeartRate: 3, sleepHours: 30 });
    const r = computeReadiness({ history, today: TODAY });
    expect(r.ready).toBe(false);
    expect(byKey(r).hrv.state).toBe('waiting');
  });
});
