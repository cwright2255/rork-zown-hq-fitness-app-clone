import {
  KM_PER_MILE, usesMiles, distanceUnitLabel, paceUnitLabel, milesToKm, distanceIn,
  formatDistanceValue, formatDistance, formatDistanceTight, paceIn,
} from '../lib/distanceUnits';

describe('which unit a setting means', () => {
  it('shows miles for imperial only', () => {
    expect(usesMiles('imperial')).toBe(true);
    expect(usesMiles('metric')).toBe(false);
  });

  it('stays in kilometres when there is no setting, or a setting it does not know', () => {
    for (const bad of [undefined, null, '', 'miles', 'IMPERIAL', 5]) expect(usesMiles(bad)).toBe(false);
  });

  it('names the unit and the pace unit', () => {
    expect(distanceUnitLabel('imperial')).toBe('mi');
    expect(distanceUnitLabel('metric')).toBe('km');
    expect(distanceUnitLabel(undefined)).toBe('km');
    expect(paceUnitLabel('imperial')).toBe('/mi');
    expect(paceUnitLabel('metric')).toBe('/km');
  });
});

describe('distances', () => {
  it('uses the exact kilometres in a mile', () => {
    expect(KM_PER_MILE).toBe(1.609344);
  });

  it('turns kilometres into miles for imperial and leaves them alone for metric', () => {
    expect(distanceIn(1.609344, 'imperial')).toBeCloseTo(1, 10);
    expect(distanceIn(10, 'imperial')).toBeCloseTo(6.2137, 4);
    expect(distanceIn(10, 'metric')).toBe(10);
    expect(distanceIn(10, undefined)).toBe(10);
  });

  it('turns miles into kilometres (a trail is measured in miles)', () => {
    expect(milesToKm(1)).toBeCloseTo(1.609344, 10);
    expect(milesToKm(9.2)).toBeCloseTo(14.8059648, 6); // 9.2 x 1.609344
  });

  it('round-trips a trail length given in miles back to the same miles', () => {
    expect(formatDistance(milesToKm(9.2), 'imperial')).toBe('9.2 mi');
    expect(formatDistance(milesToKm(9.2), 'metric')).toBe('14.8 km');
  });

  it('formats the number alone, with the number of decimals asked for', () => {
    expect(formatDistanceValue(5, 'imperial')).toBe('3.1');
    expect(formatDistanceValue(5, 'imperial', 2)).toBe('3.11');
    expect(formatDistanceValue(5, 'metric', 2)).toBe('5.00');
    expect(formatDistanceValue(5.04, 'metric', 0)).toBe('5');
  });

  it('formats the number and the unit', () => {
    expect(formatDistance(5, 'imperial')).toBe('3.1 mi');
    expect(formatDistance(5, 'metric')).toBe('5.0 km');
    expect(formatDistance(21.0975, 'imperial', 2)).toBe('13.11 mi');
  });

  it('formats a share caption with the unit tight against the number', () => {
    expect(formatDistanceTight(5.2, 'metric')).toBe('5.20km');
    expect(formatDistanceTight(5.2, 'imperial')).toBe('3.23mi');
    expect(formatDistanceTight(5.2, 'imperial', 1)).toBe('3.2mi');
  });

  it('treats a distance that is not a number as 0 instead of printing NaN', () => {
    for (const bad of [undefined, null, 'x', NaN, Infinity]) {
      expect(formatDistance(bad, 'imperial')).toBe('0.0 mi');
      expect(formatDistance(bad, 'metric')).toBe('0.0 km');
    }
    expect(distanceIn('7', 'metric')).toBe(7);
    expect(milesToKm(undefined)).toBe(0);
  });
});

describe('paces', () => {
  it('turns seconds per kilometre into seconds per mile for imperial', () => {
    expect(paceIn(300, 'metric')).toBe(300);
    expect(paceIn(300, undefined)).toBe(300);
    expect(paceIn(300, 'imperial')).toBeCloseTo(482.8032, 4); // 5:00 /km is 8:03 /mi
  });

  it('gives 0 for a pace that is not a number, which the pace formatters show as "--"', () => {
    for (const bad of [undefined, null, 'x', NaN]) {
      expect(paceIn(bad, 'imperial')).toBe(0);
      expect(paceIn(bad, 'metric')).toBe(0);
    }
  });
});
