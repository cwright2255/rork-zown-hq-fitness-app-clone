import {
  FASTING_PLANS, DEFAULT_PLAN_ID, CUSTOM_PLAN_ID, MAX_FAST_HOURS, LONG_FAST_NOTE_HOURS,
  planById, stepCustomHours, fastLabel, planIdFor, MIN_CUSTOM_HOURS, DEFAULT_CUSTOM_HOURS,
} from '../lib/fastingPlans';

describe('the fasting plans', () => {
  it('offers 13h, 16h, 18h, 20h, OMAD, 24h and 36h, shortest first', () => {
    expect(FASTING_PLANS.map((p) => p.label)).toEqual(['13h', '16h', '18h', '20h', 'OMAD', '24h', '36h']);
    expect(FASTING_PLANS.map((p) => p.hours)).toEqual([13, 16, 18, 20, 23, 24, 36]);
  });

  it('makes OMAD a 23 hour fast with a one meal a day name', () => {
    expect(planById('omad')).toEqual({ id: 'omad', label: 'OMAD', hours: 23, name: 'One meal a day' });
  });

  it('has unique ids, none of them "custom", all within the longest fast allowed', () => {
    const ids = FASTING_PLANS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(CUSTOM_PLAN_ID);
    FASTING_PLANS.forEach((p) => {
      expect(p.hours).toBeGreaterThan(0);
      expect(p.hours).toBeLessThanOrEqual(MAX_FAST_HOURS);
      expect(p.name).toBeTruthy();
    });
  });

  it('starts on 16 hours', () => {
    expect(planById(DEFAULT_PLAN_ID).hours).toBe(16);
  });

  it('allows up to three days, and shows the doctor note above one', () => {
    expect(MAX_FAST_HOURS).toBe(72);
    expect(LONG_FAST_NOTE_HOURS).toBe(24);
  });

  it('finds a plan by id, and nothing for an unknown id', () => {
    expect(planById('18').hours).toBe(18);
    expect(planById('custom')).toBeNull();
    expect(planById(undefined)).toBeNull();
  });
});

describe('stepCustomHours', () => {
  it('moves the length up and down', () => {
    expect(stepCustomHours(16, 1)).toBe(17);
    expect(stepCustomHours(16, -1)).toBe(15);
    expect(stepCustomHours(16, 6)).toBe(22);
    expect(stepCustomHours(16, -6)).toBe(10);
  });

  it('stays between 1 hour and the longest fast allowed', () => {
    expect(MIN_CUSTOM_HOURS).toBe(1);
    expect(stepCustomHours(1, -1)).toBe(1);
    expect(stepCustomHours(4, -6)).toBe(1);
    expect(stepCustomHours(72, 1)).toBe(72);
    expect(stepCustomHours(70, 6)).toBe(72);
    expect(stepCustomHours(72, -6)).toBe(66);
  });

  it('starts from 16 when the length is not a number, and ignores a step that is not a number', () => {
    expect(DEFAULT_CUSTOM_HOURS).toBe(16);
    expect(stepCustomHours(undefined, 1)).toBe(17);
    expect(stepCustomHours(null, -1)).toBe(15);
    expect(stepCustomHours('abc', 0)).toBe(16);
    expect(stepCustomHours(NaN, 2)).toBe(18);
    expect(stepCustomHours(20, undefined)).toBe(20);
    expect(stepCustomHours(20, NaN)).toBe(20);
  });

  it('keeps whole hours', () => {
    expect(stepCustomHours(16.4, 1)).toBe(17);
    expect(stepCustomHours(16, 0.6)).toBe(17);
  });
});

describe('fastLabel and planIdFor', () => {
  it('uses the plan label when the hours match the plan', () => {
    expect(fastLabel(23, 'omad')).toBe('OMAD');
    expect(fastLabel(13, '13')).toBe('13h');
  });

  it('falls back to the hours for a custom length, no plan, or hours that no longer match the plan', () => {
    expect(fastLabel(30, 'custom')).toBe('30h');
    expect(fastLabel(16, null)).toBe('16h');
    expect(fastLabel(16, undefined)).toBe('16h');
    expect(fastLabel(22, 'omad')).toBe('22h');
    expect(fastLabel(16, 'nonsense')).toBe('16h');
  });

  it('remembers a picked plan by its id and anything else as custom', () => {
    expect(planIdFor('omad')).toBe('omad');
    expect(planIdFor('36')).toBe('36');
    expect(planIdFor('custom')).toBe('custom');
    expect(planIdFor(undefined)).toBe('custom');
  });
});
