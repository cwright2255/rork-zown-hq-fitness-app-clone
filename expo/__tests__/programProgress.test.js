import { isSessionDone } from '../lib/programProgress';

describe('isSessionDone', () => {
  const progress = { currentWeek: 3, completedSessionIndexes: [0, 1] };

  it('marks the sessions finished in the current week', () => {
    expect(isSessionDone(progress, 3, 0)).toBe(true);
    expect(isSessionDone(progress, 3, 1)).toBe(true);
    expect(isSessionDone(progress, 3, 2)).toBe(false);
  });

  it('keeps every session of an earlier week ticked off after the program moves on', () => {
    [0, 1, 2, 3].forEach((i) => {
      expect(isSessionDone(progress, 1, i)).toBe(true);
      expect(isSessionDone(progress, 2, i)).toBe(true);
    });
  });

  it('shows later weeks as not started', () => {
    expect(isSessionDone(progress, 4, 0)).toBe(false);
    expect(isSessionDone({ currentWeek: 1, completedSessionIndexes: [0] }, 2, 0)).toBe(false);
  });

  it('shows a finished program as done all the way through', () => {
    expect(isSessionDone({ currentWeek: 9, completedSessionIndexes: [] }, 8, 2)).toBe(true);
  });

  it('is false for a program that was never started or has odd data', () => {
    expect(isSessionDone(undefined, 1, 0)).toBe(false);
    expect(isSessionDone(null, 1, 0)).toBe(false);
    expect(isSessionDone({}, 1, 0)).toBe(false);
    expect(isSessionDone({ currentWeek: 2 }, 2, 0)).toBe(false);
    expect(isSessionDone({ currentWeek: 2, completedSessionIndexes: [0] }, null, 0)).toBe(false);
  });
});
