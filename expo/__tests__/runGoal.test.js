import { cleanGoalKm, goalOptions, isSameGoal, goalProgress, goalLabel } from '../lib/runGoal';

describe('cleanGoalKm', () => {
  it('keeps a distance above zero', () => {
    expect(cleanGoalKm(5)).toBe(5);
    expect(cleanGoalKm(0.5)).toBe(0.5);
    expect(cleanGoalKm('10')).toBe(10);
  });

  it('turns anything else into no goal', () => {
    for (const bad of [0, -3, NaN, Infinity, undefined, null, 'far', '', {}]) expect(cleanGoalKm(bad)).toBeNull();
  });
});

describe('goalOptions', () => {
  it('offers round kilometres for metric', () => {
    expect(goalOptions('metric').map((o) => o.label)).toEqual(['1 km', '3 km', '5 km', '10 km', '15 km', '21.1 km']);
    expect(goalOptions('metric').map((o) => o.km)).toEqual([1, 3, 5, 10, 15, 21.1]);
  });

  it('offers round miles for imperial, each with its distance in km', () => {
    const options = goalOptions('imperial');
    expect(options.map((o) => o.label)).toEqual(['1 mi', '2 mi', '3 mi', '5 mi', '10 mi', '13.1 mi']);
    expect(options[0].km).toBeCloseTo(1.609344, 6);
    expect(options[3].km).toBeCloseTo(8.04672, 5);
    expect(options[5].km).toBeCloseTo(21.0825, 3); // a half marathon
  });

  it('offers kilometres when there is no setting', () => {
    expect(goalOptions(undefined).map((o) => o.label)[2]).toBe('5 km');
  });
});

describe('isSameGoal', () => {
  it('finds the option a goal in km came from, in either unit', () => {
    const miles = goalOptions('imperial');
    expect(isSameGoal(miles[3].km, miles[3])).toBe(true);
    expect(isSameGoal(miles[3].km, miles[2])).toBe(false);
    const km = goalOptions('metric');
    expect(isSameGoal(5, km[2])).toBe(true);
    expect(isSameGoal(5, miles[3])).toBe(false); // 5 km is not 5 miles
  });

  it('is false for no goal', () => {
    expect(isSameGoal(null, goalOptions('metric')[0])).toBe(false);
    expect(isSameGoal(undefined, goalOptions('metric')[0])).toBe(false);
    expect(isSameGoal(5, undefined)).toBe(false);
  });
});

describe('goalProgress', () => {
  it('counts whole percents towards the goal', () => {
    expect(goalProgress(0, 5)).toEqual({ percent: 0, reached: false });
    expect(goalProgress(1, 5)).toEqual({ percent: 20, reached: false });
    expect(goalProgress(2.49, 5)).toEqual({ percent: 49, reached: false });
  });

  it('never says 100% until the goal is reached', () => {
    expect(goalProgress(4.99, 5)).toEqual({ percent: 99, reached: false });
    expect(goalProgress(4.999, 5)).toEqual({ percent: 99, reached: false });
  });

  it('is reached at the goal and past it', () => {
    expect(goalProgress(5, 5)).toEqual({ percent: 100, reached: true });
    expect(goalProgress(7.5, 5)).toEqual({ percent: 100, reached: true });
  });

  it('is nothing without a goal or without a distance', () => {
    expect(goalProgress(3, null)).toEqual({ percent: 0, reached: false });
    expect(goalProgress(3, 0)).toEqual({ percent: 0, reached: false });
    expect(goalProgress(undefined, 5)).toEqual({ percent: 0, reached: false });
    expect(goalProgress(-1, 5)).toEqual({ percent: 0, reached: false });
    expect(goalProgress(NaN, 5)).toEqual({ percent: 0, reached: false });
  });
});

describe('goalLabel', () => {
  it('writes the goal in the unit shown, without a pointless ".0"', () => {
    expect(goalLabel(5, 'metric')).toBe('5 km');
    expect(goalLabel(10, 'metric')).toBe('10 km');
    expect(goalLabel(21.1, 'metric')).toBe('21.1 km');
    expect(goalLabel(5, 'imperial')).toBe('3.1 mi');
    expect(goalLabel(1.609344, 'imperial')).toBe('1 mi');
    expect(goalLabel(goalOptions('imperial')[5].km, 'imperial')).toBe('13.1 mi');
    expect(goalLabel(goalOptions('imperial')[5].km, 'metric')).toBe('21.1 km');
  });

  it('is empty for no goal', () => {
    expect(goalLabel(null, 'metric')).toBe('');
    expect(goalLabel(0, 'imperial')).toBe('');
  });
});
