// Where a person is in a Training Program (lib/trainingProgramProgress.js), read from the program days they have finished.
import { programProgress, progressLabel } from '../lib/trainingProgramProgress';
import { WORKOUT_PROGRAMS } from '../data/workoutPrograms';

const PROGRAM = WORKOUT_PROGRAMS[0]; // Sweat Symphony: 9 weeks of 3 days = 27 days
const OTHER = WORKOUT_PROGRAMS[1];
const WEEKS = PROGRAM.weeks.length;

// A program day as app/workout/active.jsx saves it when it is finished all the way.
const finished = (week, day, over = {}) => ({
  workoutId: null, name: `${PROGRAM.title} - Day ${'ABC'[day]}`, completedAt: '2026-11-18T12:00:00.000Z',
  programId: PROGRAM.id, programWeek: week, programDay: day, ...over,
});
const weekOf = (week, days = [0, 1, 2]) => days.map((d) => finished(week, d));
const label = (list, program = PROGRAM) => progressLabel(programProgress(program, list));

describe('the program', () => {
  it('is 9 weeks of 3 days, which is what these tests count against', () => {
    expect(WEEKS).toBe(9);
    expect(PROGRAM.weeks.every((w) => w.days.length === 3)).toBe(true);
  });
});

describe('before anything is finished', () => {
  it('has not started, and has nothing to say', () => {
    const p = programProgress(PROGRAM, []);
    expect(p).toEqual({ started: false, finished: false, week: 0, weeks: 9, done: 0, total: 27 });
    expect(progressLabel(p)).toBeNull();
  });

  it('is the same for no list at all', () => {
    expect(label(null)).toBeNull();
    expect(label(undefined)).toBeNull();
  });

  it('does not count workouts saved before these fields existed: they say a name, not which week', () => {
    expect(label([{ name: 'Sweat Symphony - Day A', completedAt: '2026-10-01T10:00:00Z', workoutId: null }])).toBeNull();
  });
});

describe('the week shown', () => {
  it('is week 1 after the first day', () => {
    expect(label([finished(1, 0)])).toBe('Week 1 of 9');
  });

  it('stays on the week until every day of it is done, then moves to the next', () => {
    expect(label(weekOf(1, [0, 1]))).toBe('Week 1 of 9');
    expect(label(weekOf(1))).toBe('Week 2 of 9');
  });

  it('is the week the person is training in, even when a day was skipped earlier', () => {
    expect(label([...weekOf(1, [0, 2]), finished(2, 0)])).toBe('Week 2 of 9');
  });

  it('follows the furthest week, whatever order the list is in', () => {
    expect(label([finished(3, 1), ...weekOf(1), ...weekOf(2)])).toBe('Week 3 of 9');
  });

  it('stays on the last week when it is done but something earlier was missed, and never says week 10', () => {
    const everyDayButOne = [];
    for (let w = 1; w <= WEEKS; w += 1) everyDayButOne.push(...weekOf(w, w === 4 ? [0, 1] : [0, 1, 2]));
    expect(label(everyDayButOne)).toBe('Week 9 of 9');
    expect(programProgress(PROGRAM, everyDayButOne).finished).toBe(false);
  });
});

describe('finishing the program', () => {
  it('says Completed once every day of every week is done', () => {
    const all = [];
    for (let w = 1; w <= WEEKS; w += 1) all.push(...weekOf(w));
    const p = programProgress(PROGRAM, all);
    expect(p).toMatchObject({ started: true, finished: true, done: 27, total: 27 });
    expect(progressLabel(p)).toBe('Completed');
  });
});

describe('what does not count', () => {
  it('a day saved part-way', () => {
    expect(label([finished(1, 0, { partial: true, completed: false })])).toBeNull();
    expect(label([finished(1, 0, { partial: true })])).toBeNull();
    expect(label([finished(1, 0, { completed: false })])).toBeNull();
  });

  it('a day of another program', () => {
    expect(label([finished(1, 0, { programId: OTHER.id })])).toBeNull();
    expect(label([finished(1, 0, { programId: OTHER.id })], OTHER)).toBe('Week 1 of 9');
  });

  it('a week or a day the program does not have, or one that is not a whole number', () => {
    const bad = [
      finished(10, 0), finished(0, 0), finished(1, 3), finished(1, -1), finished(1.5, 0), finished(1, 0.5),
      finished('1', 0), finished(1, '0'), finished(null, 0), finished(1, undefined),
    ];
    expect(label(bad)).toBeNull();
  });

  it('a hole in the list', () => {
    expect(label([null, undefined, {}, finished(1, 0)])).toBe('Week 1 of 9');
  });

  it('the same day twice counts once', () => {
    const p = programProgress(PROGRAM, [finished(1, 0), finished(1, 0), finished(1, 0)]);
    expect(p.done).toBe(1);
    expect(p.week).toBe(1);
  });
});

describe('a program it cannot read', () => {
  it('has not started and does not fall over', () => {
    expect(programProgress(null, [finished(1, 0)])).toMatchObject({ started: false, finished: false, week: 0, weeks: 0, total: 0 });
    expect(label([finished(1, 0)], { id: PROGRAM.id })).toBeNull();
  });
});

describe('progressLabel', () => {
  it('is nothing for no progress at all', () => {
    expect(progressLabel(null)).toBeNull();
    expect(progressLabel(undefined)).toBeNull();
  });
});
