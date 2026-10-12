import { durationLabel, findStepTimers, formatClock, MAX_TIMERS_PER_STEP } from '../lib/stepTimers';

const secs = (text) => findStepTimers(text).map((t) => t.seconds);

describe('findStepTimers', () => {
  it('finds a time in minutes', () => {
    expect(findStepTimers('Simmer for 10 minutes.')).toEqual([{ seconds: 600, label: '10 min' }]);
  });

  it.each([
    ['10 min', 600], ['10 mins', 600], ['10 minute', 600], ['10 MINUTES', 600], ['10min', 600],
    ['1 hour', 3600], ['2 hours', 7200], ['1 hr', 3600], ['2 hrs', 7200],
    ['30 seconds', 30], ['30 secs', 30], ['45 sec', 45], ['1 second', 1],
  ])('reads %p as %p seconds', (text, seconds) => {
    expect(secs(`Cook ${text} then stir.`)).toEqual([seconds]);
  });

  it('reads fractions and decimals', () => {
    expect(secs('Bake 1 1/2 hours.')).toEqual([5400]);
    expect(secs('Bake 1½ hours.')).toEqual([5400]);
    expect(secs('Bake 1/2 hour.')).toEqual([1800]);
    expect(secs('Bake 0.5 hour.')).toEqual([1800]);
    expect(secs('Bake 1.5 hours.')).toEqual([5400]);
    expect(secs('Bake .5 hour.')).toEqual([1800]);
    expect(secs('Bake ½ hour.')).toEqual([1800]);
  });

  it('rounds to a whole second', () => {
    expect(secs('Simmer 0.33 minutes.')).toEqual([20]);
  });

  it.each([
    ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5], ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
    ['eleven', 11], ['twelve', 12], ['fifteen', 15], ['twenty', 20], ['thirty', 30], ['forty', 40], ['forty-five', 45],
  ])('reads "%s" minutes as %p', (word, minutes) => {
    expect(secs(`Stir ${word} minutes.`)).toEqual([minutes * 60]);
    expect(secs(`Stir ${word} hours.`)).toEqual(minutes <= 24 ? [minutes * 3600] : []);
    expect(secs(`Stir ${word} seconds.`)).toEqual([minutes]);
  });

  it('reads thirds of an hour to the whole second', () => {
    expect(secs('Chill 1/3 hour.')).toEqual([1200]);
    expect(secs('Chill 2/3 hour.')).toEqual([2400]);
  });

  it('gives nothing for an amount that can not be read, and keeps the part that can', () => {
    expect(secs('Bake 1/0 hour.')).toEqual([]);
    expect(secs('Bake 1 hour 1/0 minutes.')).toEqual([3600]);
  });

  it('does not join two times that are both hours', () => {
    expect(secs('Rest 1 hour 2 hours more.')).toEqual([3600, 7200]);
  });

  it('does not read the end of a decimal as a time', () => {
    expect(secs('Add x2.5 hours.')).toEqual([]);
    expect(secs('Add 2.5 hours.')).toEqual([9000]);
  });

  it('reads times written in words', () => {
    expect(secs('Stir for five minutes.')).toEqual([300]);
    expect(secs('Rest Twenty minutes.')).toEqual([1200]);
    expect(secs('Bake forty-five minutes.')).toEqual([2700]);
    expect(secs('Bake forty minutes.')).toEqual([2400]);
    expect(secs('Chill for one hour.')).toEqual([3600]);
    expect(secs('Wait twelve minutes.')).toEqual([720]);
    expect(secs('Wait fifteen minutes.')).toEqual([900]);
    expect(secs('Wait thirty seconds.')).toEqual([30]);
    expect(secs('Stir for a minute.')).toEqual([60]);
    expect(secs('Rest for an hour.')).toEqual([3600]);
    expect(secs('Rest for half an hour.')).toEqual([1800]);
    expect(secs('Half an hour later.')).toEqual([1800]);
  });

  it('uses the lower end of a range', () => {
    expect(secs('Bake 20-25 minutes.')).toEqual([1200]);
    expect(secs('Bake 20 - 25 minutes.')).toEqual([1200]);
    expect(secs('Bake 20 to 25 minutes.')).toEqual([1200]);
    expect(secs('Bake 20–25 minutes.')).toEqual([1200]);
    expect(secs('Bake 20—25 minutes.')).toEqual([1200]);
    expect(secs('Bake 1 to 2 hours.')).toEqual([3600]);
  });

  it('adds a second part: an hour and a half', () => {
    expect(findStepTimers('Roast 1 hour 30 minutes.')).toEqual([{ seconds: 5400, label: '1 hr 30 min' }]);
    expect(secs('Roast 1 hour and 30 minutes.')).toEqual([5400]);
    expect(secs('Roast 1 hour, 30 minutes.')).toEqual([5400]);
    expect(secs('Roast 1 hour,30 minutes.')).toEqual([5400]);
    expect(findStepTimers('Boil 2 minutes 30 seconds.')).toEqual([{ seconds: 150, label: '2 min 30 sec' }]);
    expect(secs('Boil two minutes thirty seconds.')).toEqual([150]);
  });

  it('finds every time in a step, in the order written', () => {
    expect(findStepTimers('Bake 20 minutes, then rest 5 minutes.')).toEqual([
      { seconds: 1200, label: '20 min' },
      { seconds: 300, label: '5 min' },
    ]);
  });

  it('gives a time that is written twice once', () => {
    expect(secs('Cook 5 minutes, flip, then 5 minutes more.')).toEqual([300]);
  });

  it('gives at most three', () => {
    expect(MAX_TIMERS_PER_STEP).toBe(3);
    expect(secs('Do 1 minute, then 2 minutes, then 3 minutes, then 4 minutes.')).toEqual([60, 120, 180]);
  });

  it('finds a time in brackets and at the start or end of the step', () => {
    expect(secs('Bake (about 10 minutes) until set.')).toEqual([600]);
    expect(secs('10 minutes in the oven')).toEqual([600]);
    expect(secs('Leave to cool 5 min')).toEqual([300]);
    expect(secs('Bake at 350°F for 20-25 minutes.')).toEqual([1200]);
    expect(secs('Marinate for 8 hours or overnight.')).toEqual([28800]);
  });

  it('finds no time where there is none', () => {
    [
      'Add 10 eggs.', 'Heat to 350 degrees.', 'Mix well.', 'Wait a bit.', 'Stir every minute detail.',
      'Fill the hourglass.', 'Add 5 minimum.', 'Add 2 secretly.', 'Use someone minutes.', 'Cook 0 minutes.',
      'Add x10 minutes.', 'Add 3 widgets.', '',
    ].forEach((text) => {
      expect(findStepTimers(text)).toEqual([]);
    });
  });

  it('ignores a time over a day', () => {
    expect(secs('Cure for 24 hours.')).toEqual([86400]);
    expect(secs('Cure for 25 hours.')).toEqual([]);
    expect(secs('Cure for 100 hours.')).toEqual([]);
  });

  it('is empty for anything that is not text', () => {
    [undefined, null, 5, {}, ['10 minutes']].forEach((value) => {
      expect(findStepTimers(value)).toEqual([]);
    });
  });
});

describe('durationLabel', () => {
  it.each([[600, '10 min'], [5400, '1 hr 30 min'], [3600, '1 hr'], [45, '45 sec'], [150, '2 min 30 sec'], [3661, '1 hr 1 min 1 sec'], [59, '59 sec'], [60, '1 min']])(
    '%p seconds is %p', (seconds, label) => {
      expect(durationLabel(seconds)).toBe(label);
    },
  );
});

describe('formatClock', () => {
  it.each([
    [0, '0:00'], [5, '0:05'], [59, '0:59'], [60, '1:00'], [61, '1:01'], [600, '10:00'], [3599, '59:59'],
    [3600, '1:00:00'], [5400, '1:30:00'], [3661, '1:01:01'], [36000, '10:00:00'],
  ])('%p seconds is %p', (seconds, clock) => {
    expect(formatClock(seconds)).toBe(clock);
  });

  it('counts up to the next second, so it never reads 0:00 while time is left', () => {
    expect(formatClock(0.2)).toBe('0:01');
    expect(formatClock(59.2)).toBe('1:00');
    expect(formatClock(1.01)).toBe('0:02');
  });

  it('never goes below zero', () => {
    expect(formatClock(-5)).toBe('0:00');
  });
});
