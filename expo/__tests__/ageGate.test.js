// The date of birth asked for in onboarding (lib/ageGate.js): it must be a real date, and the person must be 13 or older.
import { MIN_AGE, MAX_AGE, ageOn, checkDateOfBirth, dateOfBirthMessage } from '../lib/ageGate';

// A fixed "today" on the phone's own calendar: Monday 2 November 2026.
const TODAY = new Date(2026, 10, 2);

describe('the minimum and maximum age', () => {
  it('is 13 to 120', () => {
    expect(MIN_AGE).toBe(13);
    expect(MAX_AGE).toBe(120);
  });
});

describe('ageOn', () => {
  it('counts whole years, and only after the birthday has come round', () => {
    expect(ageOn(1995, 11, 2, TODAY)).toBe(31); // birthday today
    expect(ageOn(1995, 11, 3, TODAY)).toBe(30); // birthday tomorrow
    expect(ageOn(1995, 10, 31, TODAY)).toBe(31); // birthday two days ago
    expect(ageOn(1995, 12, 1, TODAY)).toBe(30); // later this year
    expect(ageOn(1995, 1, 1, TODAY)).toBe(31); // earlier this year
  });

  it('turns a 29 February birthday into a year on 1 March in a year with no 29 February', () => {
    expect(ageOn(2000, 2, 29, new Date(2013, 1, 28))).toBe(12);
    expect(ageOn(2000, 2, 29, new Date(2013, 2, 1))).toBe(13);
    expect(ageOn(2000, 2, 29, new Date(2016, 1, 29))).toBe(16);
  });

  it('uses today\'s date when none is given', () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 2) });
    try {
      expect(ageOn(2000, 11, 2)).toBe(26);
      expect(ageOn(2000, 11, 3)).toBe(25);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('checkDateOfBirth: what is accepted', () => {
  it.each([
    ['1995-04-12', '1995-04-12'],
    ['1995/4/12', '1995-04-12'],
    ['1995.04.12', '1995-04-12'],
    ['1995-4-2', '1995-04-02'],
    ['  1995-04-12  ', '1995-04-12'],
    ['2000-02-29', '2000-02-29'],
  ])('reads %p as %p', (typed, iso) => {
    const result = checkDateOfBirth(typed, TODAY);
    expect(result.ok).toBe(true);
    expect(result.iso).toBe(iso);
  });

  it('gives the age with the date', () => {
    expect(checkDateOfBirth('1995-04-12', TODAY).age).toBe(31);
    expect(checkDateOfBirth('1995-11-03', TODAY).age).toBe(30);
  });

  it('lets someone through on the day they turn 13, and not the day before', () => {
    expect(checkDateOfBirth('2013-11-02', TODAY)).toEqual({ ok: true, iso: '2013-11-02', age: 13 });
    expect(checkDateOfBirth('2013-11-03', TODAY)).toEqual({ ok: false, reason: 'under_age', age: 12 });
  });

  it('lets someone through at the top of the range, and not a year past it', () => {
    expect(checkDateOfBirth('1906-11-02', TODAY)).toEqual({ ok: true, iso: '1906-11-02', age: 120 });
    expect(checkDateOfBirth('1905-11-02', TODAY)).toEqual({ ok: false, reason: 'too_old' });
  });
});

describe('checkDateOfBirth: what is refused, and why', () => {
  it.each([[''], ['   '], [undefined], [null], [19950412]])('says blank for %p', (typed) => {
    expect(checkDateOfBirth(typed, TODAY)).toEqual({ ok: false, reason: 'blank' });
  });

  it.each([
    ['abc'],
    ['1995-04'],
    ['95-04-12'],
    ['1995 04 12'],
    ['12-04-1995'],
    ['1995-04-12T00:00'],
    ['1995-04-123'],
    ['19950412'],
    ['1995-04_12'],
  ])('says format for %p', (typed) => {
    expect(checkDateOfBirth(typed, TODAY)).toEqual({ ok: false, reason: 'format' });
  });

  it.each([
    ['1995-02-30'],
    ['1995-13-01'],
    ['1995-00-10'],
    ['1995-04-00'],
    ['1995-04-31'],
    ['2023-02-29'],
    ['1900-02-29'], // 1900 was not a leap year
  ])('says impossible for %p', (typed) => {
    expect(checkDateOfBirth(typed, TODAY)).toEqual({ ok: false, reason: 'impossible' });
  });

  it('says future for a date that has not happened yet, including tomorrow', () => {
    expect(checkDateOfBirth('2026-11-03', TODAY)).toEqual({ ok: false, reason: 'future' });
    expect(checkDateOfBirth('2027-01-01', TODAY)).toEqual({ ok: false, reason: 'future' });
  });

  it('says too_old for a year that cannot be right', () => {
    expect(checkDateOfBirth('1900-01-01', TODAY)).toEqual({ ok: false, reason: 'too_old' });
    expect(checkDateOfBirth('0999-01-01', TODAY)).toEqual({ ok: false, reason: 'too_old' });
  });

  it('says under_age, with the age, for anyone younger than 13', () => {
    expect(checkDateOfBirth('2020-05-05', TODAY)).toEqual({ ok: false, reason: 'under_age', age: 6 });
    expect(checkDateOfBirth('2026-11-02', TODAY)).toEqual({ ok: false, reason: 'under_age', age: 0 });
    expect(checkDateOfBirth('2014-01-01', TODAY)).toEqual({ ok: false, reason: 'under_age', age: 12 });
  });

  it('never throws, whatever it is given', () => {
    [{}, [], () => {}, NaN, true, 'null', '\u0000'].forEach((typed) => {
      expect(() => checkDateOfBirth(typed, TODAY)).not.toThrow();
      expect(checkDateOfBirth(typed, TODAY).ok).toBe(false);
    });
  });
});

describe('dateOfBirthMessage', () => {
  it('has a plain sentence for each refusal that is shown under the box', () => {
    expect(dateOfBirthMessage('blank')).toBe('Enter your date of birth to continue.');
    expect(dateOfBirthMessage('format')).toBe('Enter your date of birth as YYYY-MM-DD, for example 1995-04-12.');
    expect(dateOfBirthMessage('impossible')).toBe('That date does not exist. Check the month and the day.');
    expect(dateOfBirthMessage('future')).toBe('That date has not happened yet. Check the year.');
    expect(dateOfBirthMessage('too_old')).toBe('That year does not look right. Check it and try again.');
  });

  it('falls back to the format sentence for anything else', () => {
    expect(dateOfBirthMessage('something else')).toBe(dateOfBirthMessage('format'));
    expect(dateOfBirthMessage(undefined)).toBe(dateOfBirthMessage('format'));
  });
});
