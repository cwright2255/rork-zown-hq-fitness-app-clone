// What the newer Home widgets say (lib/homeWidgetData.js). jest.global-setup.js pins the time zone to America/New_York.
import {
  battlePassSummary, muscleLabel, musclesSentence, nextUpSummary, recoveryInputs, streakCaption, streakSentence, topMuscles,
  trainingLoadSummary,
} from '../lib/homeWidgetData';
import { LEVEL_CAP, levelFromXp, xpRequiredForLevel } from '../lib/xpRules';

// Mon 19 Oct 2026, 8:00 AM in New York.
const NOW = new Date(2026, 9, 19, 8, 0);
const local = (y, m, d, h = 7, mi = 0) => new Date(y, m - 1, d, h, mi).toISOString();
const ev = (o = {}) => ({
  id: 'e1', title: 'Leg day', kind: 'workout', start: local(2026, 10, 19, 18, 30), notes: '', workoutId: null, repeat: null,
  remindMinutes: null, doneDates: [], skipDates: [], source: 'user', inviteId: null, host: null, updatedAt: '2026-10-01T00:00:00.000Z', ...o,
});

describe('streakCaption', () => {
  it.each([
    [0, 'Train today to start one'],
    [1, 'day in a row'],
    [2, 'days in a row'],
    [30, 'days in a row'],
  ])('for a streak of %s says "%s"', (n, caption) => {
    expect(streakCaption(n)).toBe(caption);
  });

  it.each([[undefined], [null], [NaN], ['x'], [-3]])('gives the nudge, not a count, for %s', (bad) => {
    expect(streakCaption(bad)).toBe('Train today to start one');
  });
});

describe('streakSentence', () => {
  it('says the streak in words for a screen reader', () => {
    expect(streakSentence(0)).toBe('no streak yet');
    expect(streakSentence(1)).toBe('1 day in a row');
    expect(streakSentence(12)).toBe('12 days in a row');
    expect(streakSentence(undefined)).toBe('no streak yet');
    expect(streakSentence(-2)).toBe('no streak yet');
  });
});

describe('nextUpSummary', () => {
  it('is null when nothing is on the calendar', () => {
    expect(nextUpSummary([], NOW)).toBeNull();
    expect(nextUpSummary(undefined, NOW)).toBeNull();
    expect(nextUpSummary('not a list', NOW)).toBeNull();
  });

  it('says Today with the time for an event later today', () => {
    expect(nextUpSummary([ev()], NOW)).toEqual({
      key: 'e1@2026-10-19', title: 'Leg day', kind: 'workout', date: '2026-10-19', when: 'Today \u00B7 6:30 PM',
    });
  });

  it('says Tomorrow for an event tomorrow', () => {
    const s = nextUpSummary([ev({ start: local(2026, 10, 20, 7, 0) })], NOW);
    expect(s.when).toBe('Tomorrow \u00B7 7:00 AM');
    expect(s.date).toBe('2026-10-20');
  });

  it('says the day for an event further off, as the Calendar does', () => {
    const s = nextUpSummary([ev({ start: local(2026, 10, 23, 12, 0) })], NOW);
    expect(s.when).toBe('Fri, Oct 23 \u00B7 12:00 PM');
  });

  it('picks the soonest of several, whatever order they are kept in', () => {
    const later = ev({ id: 'later', title: 'Long run', start: local(2026, 10, 22, 6, 0) });
    const soon = ev({ id: 'soon', title: 'Stretch', start: local(2026, 10, 19, 12, 0) });
    expect(nextUpSummary([later, soon], NOW).title).toBe('Stretch');
    expect(nextUpSummary([soon, later], NOW).title).toBe('Stretch');
  });

  it('skips one that is ticked off for that day', () => {
    const done = ev({ id: 'done', title: 'Done already', start: local(2026, 10, 19, 9, 0), doneDates: ['2026-10-19'] });
    const open = ev({ id: 'open', title: 'Still to do', start: local(2026, 10, 19, 17, 0) });
    expect(nextUpSummary([done, open], NOW).title).toBe('Still to do');
    expect(nextUpSummary([done], NOW)).toBeNull();
  });

  it('still shows one that started within the last hour', () => {
    const started = ev({ start: local(2026, 10, 19, 7, 30) });
    expect(nextUpSummary([started], NOW).when).toBe('Today \u00B7 7:30 AM');
  });

  it('leaves out one that started more than an hour ago', () => {
    const over = ev({ start: local(2026, 10, 19, 6, 30) });
    expect(nextUpSummary([over], NOW)).toBeNull();
  });

  it('finds the next day of a repeating event', () => {
    const daily = ev({ id: 'daily', title: 'Morning mobility', start: local(2026, 10, 12, 6, 0), repeat: { every: 'day', until: null } });
    const s = nextUpSummary([daily], NOW);
    // 6:00 AM today has gone by two hours ago, so the next one is tomorrow's.
    expect(s.date).toBe('2026-10-20');
    expect(s.when).toBe('Tomorrow \u00B7 6:00 AM');
    expect(s.key).toBe('daily@2026-10-20');
  });

  it('skips a day of a repeat that was removed', () => {
    const daily = ev({ id: 'daily', start: local(2026, 10, 12, 18, 0), repeat: { every: 'day', until: null }, skipDates: ['2026-10-19'] });
    expect(nextUpSummary([daily], NOW).date).toBe('2026-10-20');
  });

  it('moves on as the clock does', () => {
    const e = [ev({ id: 'a', title: 'First', start: local(2026, 10, 19, 9, 0) }), ev({ id: 'b', title: 'Second', start: local(2026, 10, 19, 15, 0) })];
    expect(nextUpSummary(e, new Date(2026, 9, 19, 8, 0)).title).toBe('First');
    expect(nextUpSummary(e, new Date(2026, 9, 19, 10, 30)).title).toBe('Second');
    expect(nextUpSummary(e, new Date(2026, 9, 19, 16, 30))).toBeNull();
  });

  it('goes by the person\'s own day in the evening, when it is already tomorrow in UTC', () => {
    // 9:30 PM on Mon 19 Oct in New Jersey is 01:30Z on the 20th.
    const evening = new Date('2026-10-20T01:30:00Z');
    const tonight = ev({ id: 't', title: 'Late stretch', start: local(2026, 10, 19, 22, 30) });
    const tomorrow = ev({ id: 'm', title: 'Morning run', start: local(2026, 10, 20, 6, 30) });
    expect(nextUpSummary([tomorrow, tonight], evening).when).toBe('Today \u00B7 10:30 PM');
    expect(nextUpSummary([tomorrow], evening).when).toBe('Tomorrow \u00B7 6:30 AM');
  });

  it('works for events the coach added or someone invited the person to', () => {
    const coach = ev({ id: 'c', title: 'Coach: tempo run', source: 'coach', start: local(2026, 10, 20, 6, 0) });
    expect(nextUpSummary([coach], NOW).title).toBe('Coach: tempo run');
  });

  it('ignores records that are not events', () => {
    expect(nextUpSummary([null, 3, { id: 'x' }, ev()], NOW).title).toBe('Leg day');
  });
});

describe('battlePassSummary', () => {
  const missions = (done) => [0, 1, 2].map((i) => ({ title: `m${i}`, xp: 1, current: i < done ? 1 : 0, target: 1 }));

  it('says the level, and how far through it the XP bar is', () => {
    const floor = xpRequiredForLevel(4);
    const span = xpRequiredForLevel(5) - floor;
    const r = battlePassSummary({ level: 4, totalExp: floor + span / 4, dailyMissions: missions(0) });
    expect(r.level).toBe(4);
    expect(r.value).toBe('Lv 4');
    expect(r.pct).toBeCloseTo(25, 6);
    expect(r.atCap).toBe(false);
  });

  it('starts the bar empty at the start of a level and full just before the next', () => {
    expect(battlePassSummary({ level: 3, totalExp: xpRequiredForLevel(3) }).pct).toBe(0);
    expect(battlePassSummary({ level: 3, totalExp: xpRequiredForLevel(4) - 1 }).pct).toBeGreaterThan(99);
  });

  it('keeps the bar between empty and full whatever the numbers say', () => {
    expect(battlePassSummary({ level: 5, totalExp: 0 }).pct).toBe(0); // fewer XP than the level asks for
    expect(battlePassSummary({ level: 2, totalExp: 10 * xpRequiredForLevel(3) }).pct).toBe(100); // far past the next level
  });

  it('says how many of the missions for the day are done', () => {
    expect(battlePassSummary({ level: 1, totalExp: 0, dailyMissions: missions(0) })).toMatchObject({ missionsDone: 0, missionsTotal: 3, caption: '0/3 missions today' });
    expect(battlePassSummary({ level: 1, totalExp: 0, dailyMissions: missions(1) })).toMatchObject({ missionsDone: 1, caption: '1/3 missions today' });
    expect(battlePassSummary({ level: 1, totalExp: 0, dailyMissions: missions(2) })).toMatchObject({ missionsDone: 2, caption: '2/3 missions today' });
    expect(battlePassSummary({ level: 1, totalExp: 0, dailyMissions: missions(3) })).toMatchObject({ missionsDone: 3, caption: 'All missions done' });
  });

  it('points to the Battle Pass when there are no missions to count', () => {
    expect(battlePassSummary({ level: 1, totalExp: 0 })).toMatchObject({ missionsDone: 0, missionsTotal: 0, caption: 'Open the Battle Pass' });
    expect(battlePassSummary({ level: 1, totalExp: 0, dailyMissions: [] }).caption).toBe('Open the Battle Pass');
  });

  it('says it all in a sentence for a screen reader', () => {
    expect(battlePassSummary({ level: 1, totalExp: 250, dailyMissions: missions(1) }).sentence)
      .toBe('Battle Pass: level 1, 250 of 1000 XP toward level 2, 1 of 3 daily missions done');
    expect(battlePassSummary({ level: 1, totalExp: 250 }).sentence).toBe('Battle Pass: level 1, 250 of 1000 XP toward level 2');
  });

  it('shows whole XP, not fractions of one', () => {
    expect(battlePassSummary({ level: 1, totalExp: 250.9 }).sentence).toContain('250 of 1000 XP');
  });

  it('is full at the top level', () => {
    const r = battlePassSummary({ level: LEVEL_CAP, totalExp: xpRequiredForLevel(LEVEL_CAP) + 5, dailyMissions: missions(2) });
    expect(r).toMatchObject({ level: LEVEL_CAP, value: `Lv ${LEVEL_CAP}`, pct: 100, atCap: true });
    expect(r.sentence).toBe(`Battle Pass: level ${LEVEL_CAP}, the highest level, 2 of 3 daily missions done`);
  });

  it('does not go past the top level', () => {
    expect(battlePassSummary({ level: LEVEL_CAP + 40, totalExp: 1 })).toMatchObject({ level: LEVEL_CAP, atCap: true });
  });

  it('works the level out from the XP when it is not given one', () => {
    const total = xpRequiredForLevel(6) + 10;
    expect(levelFromXp(total)).toBe(6);
    expect(battlePassSummary({ totalExp: total }).level).toBe(6);
    expect(battlePassSummary({ level: null, totalExp: total }).level).toBe(6);
    expect(battlePassSummary({ level: 'x', totalExp: total }).level).toBe(6);
    expect(battlePassSummary({ level: 0, totalExp: total }).level).toBe(6);
  });

  it('goes by the level it is given, not the one the XP would give', () => {
    expect(battlePassSummary({ level: 1, totalExp: xpRequiredForLevel(6) + 10 }).level).toBe(1);
    expect(battlePassSummary({ level: 2, totalExp: xpRequiredForLevel(6) + 10 }).level).toBe(2);
  });

  it('counts no XP into a level the XP has not reached, rather than a minus number', () => {
    const r = battlePassSummary({ level: 5, totalExp: 0 });
    expect(r.sentence).toBe(`Battle Pass: level 5, 0 of ${Math.round(xpRequiredForLevel(6) - xpRequiredForLevel(5))} XP toward level 6`);
  });

  it('rounds a level down to a whole one', () => {
    expect(battlePassSummary({ level: 3.9, totalExp: 0 }).level).toBe(3);
  });

  it('starts at level 1 with nothing, and with nothing at all', () => {
    expect(battlePassSummary({ level: 1, totalExp: -50 })).toMatchObject({ level: 1, pct: 0 });
    expect(battlePassSummary({ level: 1, totalExp: NaN })).toMatchObject({ level: 1, pct: 0 });
    expect(battlePassSummary({ level: 1, totalExp: Infinity })).toMatchObject({ level: 1, pct: 0 });
    expect(battlePassSummary()).toMatchObject({ level: 1, value: 'Lv 1', pct: 0, atCap: false, caption: 'Open the Battle Pass' });
  });
});

describe('trainingLoadSummary', () => {
  const load = (zone, ratio) => ({ acuteLoad: 3000, chronicWeeklyAvg: 3000, ratio, zone, zoneLabel: 'a long sentence' });

  it.each([
    ['detraining', 0.5, 'Below usual', '0.50', 25],
    ['sweet_spot', 1.05, 'In your range', '1.05', 52.5],
    ['elevated', 1.4, 'Above usual', '1.40', 70],
    ['high', 1.8, 'Well above usual', '1.80', 90],
  ])('for a %s reading of %s says "%s", the number %s and a marker %s%% along', (zone, ratio, caption, value, markerPct) => {
    expect(trainingLoadSummary(load(zone, ratio))).toMatchObject({ zone, caption, value, markerPct });
  });

  it('puts the marker at the end of the scale for a reading off it, and at the start for one below it', () => {
    expect(trainingLoadSummary(load('high', 3.2)).markerPct).toBe(100);
    expect(trainingLoadSummary(load('high', 2)).markerPct).toBe(100);
    expect(trainingLoadSummary(load('detraining', 0)).markerPct).toBe(0);
    expect(trainingLoadSummary(load('detraining', -0.4)).markerPct).toBe(0);
  });

  it('keeps two decimal places', () => {
    expect(trainingLoadSummary(load('sweet_spot', 1)).value).toBe('1.00');
    expect(trainingLoadSummary(load('sweet_spot', 1.2)).value).toBe('1.20');
  });

  it('says there is not enough history, with a dash and no marker', () => {
    expect(trainingLoadSummary(load('insufficient_data', null))).toEqual({
      zone: 'insufficient_data',
      value: '\u2014',
      caption: 'Needs more history',
      markerPct: null,
      sentence: 'Training load: not enough history yet',
    });
  });

  it('says the reading in a sentence for a screen reader', () => {
    expect(trainingLoadSummary(load('sweet_spot', 1.05)).sentence).toBe('Training load 1.05, in your range');
    expect(trainingLoadSummary(load('high', 1.8)).sentence).toBe('Training load 1.80, well above usual');
    expect(trainingLoadSummary(load('detraining', 0.5)).sentence).toBe('Training load 0.50, below usual');
    expect(trainingLoadSummary(load('elevated', 1.4)).sentence).toBe('Training load 1.40, above usual');
  });

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['an empty object', {}],
    ['a zone with no number', load('sweet_spot', null)],
    ['a number that is not one', load('sweet_spot', NaN)],
    ['a number as text', load('sweet_spot', '1.2')],
    ['an infinite number', load('high', Infinity)],
    ['a zone nobody knows', load('mystery', 1.1)],
    ['a zone of a prototype name', load('constructor', 1.1)],
    ['the not-enough-history zone with a number', load('insufficient_data', 1.1)],
  ])('says there is not enough history for %s, not a number that is not there', (_name, bad) => {
    expect(trainingLoadSummary(bad)).toMatchObject({ zone: 'insufficient_data', value: '\u2014', markerPct: null, caption: 'Needs more history' });
  });
});

describe('recoveryInputs', () => {
  it('uses the wearable\'s reading when it has a heart-rate-variability one', () => {
    expect(recoveryInputs({ hrv: 55, sleepHours: null, sleepEfficiency: null }, { hours: 8, quality: 'good' })).toEqual({ hrv: 55, sleepHours: null, sleepQuality: undefined });
  });

  it('uses the wearable\'s reading when it has sleep, and says how well the person slept from the efficiency', () => {
    expect(recoveryInputs({ sleepHours: 7.5, sleepEfficiency: 90 }, null)).toEqual({ hrv: undefined, sleepHours: 7.5, sleepQuality: 'good' });
  });

  it.each([
    [100, 'good'], [85, 'good'], [84.9, 'fair'], [60, 'fair'], [59.9, 'poor'], [0, 'poor'],
  ])('calls a sleep efficiency of %s %s', (eff, quality) => {
    expect(recoveryInputs({ sleepHours: 7, sleepEfficiency: eff }).sleepQuality).toBe(quality);
  });

  it('leaves the quality out when the wearable did not say', () => {
    expect(recoveryInputs({ sleepHours: 7 }).sleepQuality).toBeUndefined();
    expect(recoveryInputs({ sleepHours: 7, sleepEfficiency: null }).sleepQuality).toBeUndefined();
  });

  it('prefers the wearable to the sleep the person logged', () => {
    expect(recoveryInputs({ hrv: 60 }, { hours: 4, quality: 'poor' }).hrv).toBe(60);
  });

  it('falls back to the logged sleep when the wearable has neither reading', () => {
    expect(recoveryInputs({ restingHeartRate: 55 }, { hours: 6.5, quality: 'fair' })).toEqual({ sleepHours: 6.5, sleepQuality: 'fair' });
    expect(recoveryInputs(null, { hours: 7, quality: null })).toEqual({ sleepHours: 7, sleepQuality: null });
  });

  it('is nothing when there is no reading and no sleep logged', () => {
    expect(recoveryInputs(null, { hours: 0, quality: null })).toBeUndefined();
    expect(recoveryInputs(undefined, undefined)).toBeUndefined();
    expect(recoveryInputs({}, {})).toBeUndefined();
    expect(recoveryInputs({ restingHeartRate: 55 }, null)).toBeUndefined();
  });
});

describe('muscleLabel', () => {
  it.each([
    ['quadriceps', 'Quadriceps'],
    ['upper_back', 'Upper back'],
    ['lower-back', 'Lower back'],
    ['  glutes ', 'Glutes'],
    ['front__delts', 'Front delts'],
    ['full body', 'Full body'],
    ['upper   back', 'Upper back'],
    ['lower _back', 'Lower back'],
  ])('writes %s as %s', (key, label) => {
    expect(muscleLabel(key)).toBe(label);
  });

  it.each([[''], ['  '], [null], [undefined], ['_']])('gives nothing for %s', (bad) => {
    expect(muscleLabel(bad)).toBe('');
  });
});

describe('topMuscles', () => {
  it('lists the most worked first, and three of them', () => {
    expect(topMuscles({ core: 10, quadriceps: 100, calves: 45, glutes: 82 })).toEqual([
      { muscle: 'quadriceps', label: 'Quadriceps', intensity: 100 },
      { muscle: 'glutes', label: 'Glutes', intensity: 82 },
      { muscle: 'calves', label: 'Calves', intensity: 45 },
    ]);
  });

  it('takes as many as it is asked for', () => {
    const f = { a: 4, b: 3, c: 2, d: 1 };
    expect(topMuscles(f, 2).map((m) => m.muscle)).toEqual(['a', 'b']);
    expect(topMuscles(f, 10).map((m) => m.muscle)).toEqual(['a', 'b', 'c', 'd']);
    expect(topMuscles(f, 0)).toEqual([]);
  });

  it('puts equal ones in alphabetical order, whatever order they came in', () => {
    expect(topMuscles({ d: 50, b: 50, c: 50, a: 50 }).map((m) => m.muscle)).toEqual(['a', 'b', 'c']);
    expect(topMuscles({ a: 50, b: 50, c: 50, d: 50 }).map((m) => m.muscle)).toEqual(['a', 'b', 'c']);
    expect(topMuscles({ hamstrings: 22, glutes: 22, quadriceps: 28 }).map((m) => m.muscle)).toEqual(['quadriceps', 'glutes', 'hamstrings']);
  });

  it('leaves out a muscle with nothing on it, and anything that is not a number', () => {
    expect(topMuscles({ a: 0, b: -3, c: NaN, d: '40', e: null, f: undefined, g: Infinity, h: 5 }).map((m) => m.muscle)).toEqual(['h']);
  });

  it('gives nothing when there is nothing', () => {
    expect(topMuscles({})).toEqual([]);
    expect(topMuscles(null)).toEqual([]);
    expect(topMuscles(undefined)).toEqual([]);
    expect(topMuscles('chest')).toEqual([]);
    expect(topMuscles({ '': 40 })).toEqual([]);
  });
});

describe('musclesSentence', () => {
  it('names the muscles still recovering, the least recovered first', () => {
    const top = topMuscles({ quadriceps: 100, glutes: 82, calves: 45 }); // tiredness, from fatigueFromRecovery
    expect(musclesSentence(top)).toBe('Muscles still recovering, least recovered first: Quadriceps, Glutes, Calves');
    expect(musclesSentence(topMuscles({ chest: 9 }))).toBe('Muscles still recovering, least recovered first: Chest');
  });

  it('says there is nothing when there is nothing', () => {
    expect(musclesSentence([])).toBe('Muscles: none still recovering');
    expect(musclesSentence(undefined)).toBe('Muscles: none still recovering');
    expect(musclesSentence(null)).toBe('Muscles: none still recovering');
  });
});
