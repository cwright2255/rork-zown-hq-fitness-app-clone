jest.mock('../store/expStore', () => ({
  useExpStore: { getState: () => global.__exp },
}));
import fs from 'fs';
import path from 'path';
import { rewardJourney } from '../services/journeyRewards';
import { journeyById } from '../lib/virtualJourneys';

const canyon = journeyById('grand-canyon-rim'); // 34 km: 500 XP
const camino = journeyById('camino-frances'); // 780 km: 2000 XP
const NOW = Date.UTC(2026, 9, 14, 23, 30); // 14 Oct, 19:30 in New York but still the 14th in UTC

let warn;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  global.__exp = { addExpActivity: jest.fn() };
});
afterEach(() => warn.mockRestore());

describe('rewardJourney', () => {
  it('pays XP for the journey, once under its own id', () => {
    rewardJourney(canyon, 'u1', NOW);
    expect(global.__exp.addExpActivity).toHaveBeenCalledTimes(1);
    expect(global.__exp.addExpActivity).toHaveBeenCalledWith({
      id: 'journey-grand-canyon-rim',
      type: 'running',
      baseExp: 500,
      multiplier: 1.0,
      date: '2026-10-14',
      description: 'Finished the Grand Canyon Rim Trail journey',
      completed: true,
    }, 'u1');
  });

  it('leaves the Trailblazer badge to the server, which gives it once it has accepted that XP claim: nothing here unlocks a badge', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'services', 'journeyRewards.js'), 'utf8');
    expect(source).not.toMatch(/badgeStore|useBadgeStore|unlockBadge/);
  });

  it('pays more for a longer route', () => {
    rewardJourney(camino, 'u1', NOW);
    expect(global.__exp.addExpActivity.mock.calls[0][0]).toMatchObject({ id: 'journey-camino-frances', baseExp: 2000 });
  });

  it('dates the reward with the time of the finish', () => {
    rewardJourney(canyon, 'u1', Date.UTC(2026, 11, 31, 8));
    expect(global.__exp.addExpActivity.mock.calls[0][0].date).toBe('2026-12-31');
  });

  it('dates a finish in the evening as that evening, not the next day (9:30 PM in New York is already tomorrow in UTC)', () => {
    rewardJourney(canyon, 'u1', Date.UTC(2026, 9, 15, 1, 30));
    expect(global.__exp.addExpActivity.mock.calls[0][0].date).toBe('2026-10-14');
  });

  it('uses the time now when none is given', () => {
    jest.useFakeTimers({ now: Date.UTC(2026, 5, 1, 12) });
    try {
      rewardJourney(canyon, 'u1');
      expect(global.__exp.addExpActivity.mock.calls[0][0].date).toBe('2026-06-01');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not throw when the XP fails, and says so', () => {
    global.__exp.addExpActivity.mockImplementation(() => { throw new Error('exp down'); });
    expect(() => rewardJourney(canyon, 'u1', NOW)).not.toThrow();
    expect(warn).toHaveBeenCalledWith('[journeyRewards] XP failed:', 'exp down');
  });

  it('pays nothing without a route or a person', () => {
    rewardJourney(null, 'u1', NOW);
    rewardJourney(undefined, 'u1', NOW);
    rewardJourney(canyon, '', NOW);
    rewardJourney(canyon, undefined, NOW);
    expect(global.__exp.addExpActivity).not.toHaveBeenCalled();
  });
});
