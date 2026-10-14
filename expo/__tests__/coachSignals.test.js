import {
  recoveryLine, waterLine, stepsLine, fastingLines, eatingLine, burnLine, buildSignalLines,
} from '../lib/coachSignals';

const H = 3600000;
const NOW = new Date('2026-10-15T01:30:00Z'); // 9:30 PM on Wed 14 Oct in New Jersey

describe('recoveryLine', () => {
  it('gives the latest heart rate, HRV and sleep, and names where they came from', () => {
    const line = recoveryLine({ restingHeartRate: 54.4, hrv: 61.2, sleepHours: 7.46, sleepEfficiency: 91.3, source: 'Oura' });
    expect(line).toContain('Latest recovery reading from Oura');
    expect(line).toContain('resting heart rate 54 bpm');
    expect(line).toContain('HRV 61 ms (RMSSD)');
    expect(line).toContain('sleep 7.5 h (efficiency 91%)');
  });

  it('calls Apple Health\'s HRV SDNN, since it is a different measure from the RMSSD the wearables report', () => {
    expect(recoveryLine({ restingHeartRate: 58, hrv: 48, source: 'Apple Health' })).toContain('HRV 48 ms (SDNN)');
  });

  it('tells the Coach there is no personal baseline, so it does not call a reading high or low', () => {
    expect(recoveryLine({ hrv: 48, source: 'Apple Health' })).toContain('no personal baseline recorded so do not call it high or low');
  });

  it('leaves out whatever is missing, including the sleep Apple Health never reports', () => {
    const line = recoveryLine({ restingHeartRate: 58, hrv: 48, sleepHours: null, sleepEfficiency: null, source: 'Apple Health' });
    expect(line).not.toContain('sleep');
    expect(recoveryLine({ sleepHours: 6, source: 'Whoop' })).toBe('Latest recovery reading from Whoop: sleep 6 h.');
  });

  it('says nothing for no reading, or one with only zeros and blanks', () => {
    for (const bad of [null, undefined, {}, 'x', 7, { restingHeartRate: 0, hrv: 0, sleepHours: 0 }, { restingHeartRate: null, hrv: '', sleepHours: true }]) {
      expect(recoveryLine(bad)).toBeNull();
    }
  });

  it('falls back to a plain name when the source is missing', () => {
    expect(recoveryLine({ restingHeartRate: 60 })).toContain('from a connected device');
    expect(recoveryLine({ restingHeartRate: 60, source: '  ' })).toContain('from a connected device');
  });
});

describe('waterLine', () => {
  it('gives the glasses logged today', () => {
    expect(waterLine({ glasses: 5, target: 8, date: '2026-10-14' }, '2026-10-14')).toBe('Water logged today: 5 of 8 glasses.');
  });

  it('says nothing while no water is logged, since an untouched counter is also what someone who never uses it has', () => {
    expect(waterLine({ glasses: 0, target: 8, date: '2026-10-14' }, '2026-10-14')).toBeNull();
  });

  it('says nothing about a count from another day', () => {
    expect(waterLine({ glasses: 7, target: 8, date: '2026-10-13' }, '2026-10-14')).toBeNull();
    expect(waterLine({ glasses: 7, target: 8 }, '2026-10-14')).toBeNull();
  });

  it('says nothing when the numbers are not real', () => {
    for (const h of [null, undefined, 'x', { date: '2026-10-14' }, { glasses: -1, target: 8, date: '2026-10-14' }, { glasses: 3, target: 0, date: '2026-10-14' }, { glasses: 'a', target: 8, date: '2026-10-14' }]) {
      expect(waterLine(h, '2026-10-14')).toBeNull();
    }
  });
});

describe('stepsLine', () => {
  it('gives the steps so far today', () => {
    expect(stepsLine(6420)).toBe('Steps so far today: 6,420.');
    expect(stepsLine(0)).toBe('Steps so far today: 0.');
  });

  it('says nothing when there is no count for today', () => {
    for (const bad of [null, undefined, -1, -0.5, -5, NaN, 'lots', true, false]) expect(stepsLine(bad)).toBeNull();
  });
});

describe('fastingLines', () => {
  const fast = (endedHoursAgo, hours, target = 16) => ({
    startedAt: new Date(NOW.getTime() - (endedHoursAgo + hours) * H),
    endedAt: new Date(NOW.getTime() - endedHoursAgo * H),
    targetHours: target,
  });

  it('says how long the running fast has gone and what it is aiming for', () => {
    const lines = fastingLines({ startedAt: new Date(NOW.getTime() - 9.5 * H), targetHours: 16 }, undefined, NOW);
    expect(lines).toEqual(['Fasting right now: 9h 30m into a 16h fast.']);
  });

  it('notes when the goal is reached', () => {
    const lines = fastingLines({ startedAt: new Date(NOW.getTime() - 17 * H), targetHours: 16 }, undefined, NOW);
    expect(lines[0]).toBe('Fasting right now: 17h into a 16h fast (goal reached).');
  });

  it('ignores a running fast with no usable start, or one that starts in the future', () => {
    expect(fastingLines({ startedAt: 'nope', targetHours: 16 }, undefined, NOW)).toEqual([]);
    expect(fastingLines({ startedAt: new Date(NOW.getTime() + H), targetHours: 16 }, undefined, NOW)).toEqual([]);
    expect(fastingLines({ targetHours: 16 }, undefined, NOW)).toEqual([]);
    expect(fastingLines(null, undefined, NOW)).toEqual([]);
  });

  it('assumes 16 hours when the target is missing', () => {
    expect(fastingLines({ startedAt: new Date(NOW.getTime() - 2 * H) }, undefined, NOW)[0]).toContain('into a 16h fast');
  });

  it('sums up the fasts finished in the last 7 days, and how many made their goal', () => {
    const history = [fast(5, 18, 16), fast(30, 15, 16), fast(60, 16, 16), fast(24 * 6, 12, 14)];
    expect(fastingLines(null, history, NOW)).toEqual(['Fasts finished in the last 7 days: 4 (average 15.3h, 2 reached their goal).']);
  });

  it('leaves out fasts that finished more than 7 days ago or have not finished yet', () => {
    const history = [fast(24 * 8, 16), fast(-3, 4)];
    expect(fastingLines(null, history, NOW)).toEqual([]);
  });

  it('says nothing about finished fasts when they could not be read or there are none, and copes with bad entries', () => {
    expect(fastingLines(null, undefined, NOW)).toEqual([]);
    expect(fastingLines(null, null, NOW)).toEqual([]);
    expect(fastingLines(null, [], NOW)).toEqual([]);
    expect(fastingLines(null, [null, {}, { startedAt: 'x', endedAt: 'y' }, fast(5, 16)], NOW)).toEqual(['Fasts finished in the last 7 days: 1 (average 16h, 1 reached their goal).']);
  });

  it('can report the running fast and the finished ones together', () => {
    const lines = fastingLines({ startedAt: new Date(NOW.getTime() - 3 * H), targetHours: 16 }, [fast(10, 16)], NOW);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Fasting right now');
    expect(lines[1]).toContain('Fasts finished in the last 7 days: 1');
  });
});

describe('eatingLine', () => {
  const day = (date, calories, protein = 100) => ({ id: 'dinner', date, foods: [{ calories, protein, carbs: 200, fat: 60 }] });

  it('averages the days before today on which food was logged, and compares with a real eating target', () => {
    const meals = [day('2026-10-13', 2000), day('2026-10-12', 2400), day('2026-10-10', 2200), day('2026-10-14', 900)];
    const line = eatingLine(meals, { todayKey: '2026-10-14', eatTarget: 2500 });
    expect(line).toContain('food logged on 3 of 7 days');
    expect(line).toContain('averaged 2,200 kcal, 100 g protein, 200 g carbs and 60 g fat');
    expect(line).toContain('a day with only some meals logged pulls these down');
    expect(line).toContain('Their eating target is 2,500 kcal, so that is 300 kcal under it on average.');
  });

  it('does not count today, which is not over, or days more than a week back', () => {
    const meals = [day('2026-10-14', 5000), day('2026-10-06', 5000)];
    expect(eatingLine(meals, { todayKey: '2026-10-14', eatTarget: null })).toBeNull();
  });

  it('says over, and on target, when that is the case', () => {
    expect(eatingLine([day('2026-10-13', 2700)], { todayKey: '2026-10-14', eatTarget: 2500 })).toContain('200 kcal over it');
    expect(eatingLine([day('2026-10-13', 2500)], { todayKey: '2026-10-14', eatTarget: 2500 })).toContain('That matches their 2,500 kcal eating target.');
  });

  it('makes no comparison without a real eating target', () => {
    const line = eatingLine([day('2026-10-13', 2000)], { todayKey: '2026-10-14', eatTarget: null });
    expect(line).toContain('averaged 2,000 kcal');
    expect(line).not.toContain('target');
  });

  it('says nothing when the diary is empty or malformed', () => {
    for (const meals of [[], undefined, null, 'x', [null, { date: 5 }, { date: '2026-10-13' }]]) {
      expect(eatingLine(meals, { todayKey: '2026-10-14' })).toBeNull();
    }
  });

  it('counts back whole calendar days across the clocks going back (2026-11-01 was a 25-hour day)', () => {
    const meals = [day('2026-10-31', 2000), day('2026-10-30', 2000), day('2026-10-25', 2000), day('2026-10-24', 2000)];
    // the 7 days before 2 Nov: 26 Oct .. 1 Nov; the 25th and 24th are outside
    expect(eatingLine(meals, { todayKey: '2026-11-02' })).toContain('food logged on 2 of 7 days');
  });
});

describe('burnLine', () => {
  it('gives calories burned against the burn goal and says the goal is not the eating target', () => {
    expect(burnLine({ burnedToday: 320, burnTarget: 500 })).toBe(
      'Calories burned today: 320 kcal (workouts, runs, hikes and an estimate from steps); their burn goal is 500 kcal a day. The burn goal is separate from the eating target.',
    );
  });

  it('gives just the burned calories when there is no burn goal', () => {
    const line = burnLine({ burnedToday: 1200 });
    expect(line).toContain('Calories burned today: 1,200 kcal');
    expect(line).not.toContain('burn goal is');
  });

  it('gives the goal alone when nothing is known to have been burned', () => {
    expect(burnLine({ burnedToday: null, burnTarget: 500 })).toBe('Their burn goal is 500 kcal a day. The burn goal is separate from the eating target.');
  });

  it('counts a real 0 burned against a goal', () => {
    expect(burnLine({ burnedToday: 0, burnTarget: 500 })).toContain('Calories burned today: 0 kcal');
  });

  it('says nothing with neither a goal nor anything burned', () => {
    expect(burnLine({})).toBeNull();
    expect(burnLine()).toBeNull();
    expect(burnLine({ burnedToday: 0 })).toBeNull();
    expect(burnLine({ burnedToday: NaN, burnTarget: 0 })).toBeNull();
    expect(burnLine({ burnedToday: -4, burnTarget: null })).toBeNull();
  });
});

describe('buildSignalLines', () => {
  it('puts every reading in a fixed order and leaves the missing ones out', () => {
    const lines = buildSignalLines({
      now: NOW,
      recovery: { restingHeartRate: 54, source: 'Oura' },
      hydration: { glasses: 4, target: 8, date: '2026-10-14' },
      todaySteps: 5000,
      fastActive: { startedAt: new Date(NOW.getTime() - 4 * H), targetHours: 16 },
      fastHistory: [],
      meals: [{ date: '2026-10-13', foods: [{ calories: 2000, protein: 100, carbs: 200, fat: 60 }] }],
      eatTarget: null,
      burnedToday: 250,
      burnTarget: 500,
    });
    expect(lines.map((l) => l.split(':')[0])).toEqual([
      'Latest recovery reading from Oura',
      'Water logged today',
      'Steps so far today',
      'Fasting right now',
      'Food diary, the 7 days before today',
      'Calories burned today',
    ]);
  });

  it('uses the person\'s own day for water: a count for the 14th is today at 9:30 PM although it is the 15th in UTC', () => {
    expect(buildSignalLines({ now: NOW, hydration: { glasses: 4, target: 8, date: '2026-10-14' } })).toEqual(['Water logged today: 4 of 8 glasses.']);
    expect(buildSignalLines({ now: NOW, hydration: { glasses: 4, target: 8, date: '2026-10-15' } })).toEqual([]);
  });

  it('is empty when nothing is known', () => {
    expect(buildSignalLines({ now: NOW })).toEqual([]);
    expect(buildSignalLines()).toEqual([]);
  });
});
