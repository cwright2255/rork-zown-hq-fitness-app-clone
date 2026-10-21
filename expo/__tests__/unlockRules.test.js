import { ACHIEVEMENTS, BADGES, FACT_FOR_TYPE, evaluateUnlocks } from '../functions/src/unlockRules';

const NONE = {
  finishedWorkouts: 0, bestCalories: 0, streak: 0, level: 1, xp: 0,
  hikeCount: 0, hikeMiles: 0, strenuousHikes: 0, raceFinishes: 0, journeyFinishes: 0,
};
const earn = (facts, have = {}) => evaluateUnlocks({
  facts: { ...NONE, ...facts },
  unlockedAchievements: have.achievements || [],
  unlockedBadges: have.badges || [],
});

describe('what the lists hold', () => {
  it('has the fifteen achievements and the six earnable badges, each once', () => {
    expect(ACHIEVEMENTS).toHaveLength(15);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(15);
    expect(BADGES.map((b) => b.id)).toEqual(['badge-1', 'badge-11', 'badge-12', 'badge-13', 'badge-14', 'badge-15']);
  });

  it('gives nothing to a person with no progress', () => {
    expect(earn({})).toEqual({ achievements: [], badges: [] });
  });
});

describe('achievements', () => {
  const withFact = ACHIEVEMENTS.filter((a) => FACT_FOR_TYPE[a.type]);

  it.each(withFact.map((a) => [a.id, a]))('%s is earned at its target and not one short of it', (id, a) => {
    const fact = FACT_FOR_TYPE[a.type];
    expect(earn({ [fact]: a.target - 1 }).achievements).not.toContain(id);
    expect(earn({ [fact]: a.target }).achievements).toContain(id);
    expect(earn({ [fact]: a.target + 1000 }).achievements).toContain(id);
  });

  it('asks for the right kind of progress', () => {
    expect(earn({ finishedWorkouts: 10 }).achievements).toEqual(['first-workout', 'workouts-10']);
    expect(earn({ streak: 7 }).achievements).toEqual(['workout-streak-7']);
    expect(earn({ streak: 30 }).achievements).toEqual(['workout-streak-7', 'workout-streak-30']);
    expect(earn({ bestCalories: 1000 }).achievements).toEqual(['calories-1000']);
    expect(earn({ level: 10 }).achievements).toEqual(['level-5', 'level-10']);
    expect(earn({ xp: 5000 }).achievements).toEqual(['xp-1000', 'xp-5000']);
  });

  it('is not earned by another kind of progress', () => {
    expect(earn({ streak: 99, level: 99, xp: 999999, bestCalories: 99999 }).achievements).not.toContain('first-workout');
    expect(earn({ finishedWorkouts: 99, level: 99 }).achievements).not.toContain('workout-streak-7');
    expect(earn({ finishedWorkouts: 99, streak: 99, xp: 99999 }).achievements).not.toContain('level-5');
    expect(earn({ finishedWorkouts: 99, streak: 99, level: 99 }).achievements).not.toContain('xp-1000');
    expect(earn({ finishedWorkouts: 99, streak: 99, level: 99, xp: 99999 }).achievements).not.toContain('calories-1000');
  });

  it('never earns the four the app never fed anything: weight lost, nutrition days, social, morning workouts', () => {
    const everything = {
      finishedWorkouts: 9999, bestCalories: 9999, streak: 9999, level: 100, xp: 9999999,
      hikeCount: 99, hikeMiles: 999, strenuousHikes: 99, raceFinishes: 99, journeyFinishes: 99,
      weightLost: 99, nutritionLogged: 99, socialInteractions: 99, morningWorkouts: 99,
    };
    const { achievements } = earn(everything);
    ['weight-loss-5', 'nutrition-streak-7', 'social-butterfly', 'early-bird'].forEach((id) => expect(achievements).not.toContain(id));
    expect(achievements).toHaveLength(11);
  });

  it('does not give one again that is already unlocked, and gives the rest', () => {
    const r = earn({ finishedWorkouts: 50 }, { achievements: ['first-workout', 'workouts-10'] });
    expect(r.achievements).toEqual(['workouts-50']);
  });

  it('gives nothing new when everything it has earned is unlocked', () => {
    const r = earn({ finishedWorkouts: 10 }, { achievements: ['first-workout', 'workouts-10'] });
    expect(r.achievements).toEqual([]);
  });

  it('keeps the order of the list', () => {
    const ids = earn({ finishedWorkouts: 100, streak: 30, level: 10, xp: 5000, bestCalories: 1000 }).achievements;
    expect(ids).toEqual(ACHIEVEMENTS.map((a) => a.id).filter((id) => ids.includes(id)));
  });
});

describe('badges', () => {
  it('earns the first workout badge with the first finished workout', () => {
    expect(earn({ finishedWorkouts: 0 }).badges).toEqual([]);
    expect(earn({ finishedWorkouts: 1 }).badges).toEqual(['badge-1']);
  });

  it('earns First Trail with a first hike', () => {
    expect(earn({ hikeCount: 0 }).badges).toEqual([]);
    expect(earn({ hikeCount: 1 }).badges).toEqual(['badge-11']);
  });

  it('earns Strenuous Summit only from a hike rated Strenuous or harder', () => {
    expect(earn({ hikeCount: 3, strenuousHikes: 0 }).badges).toEqual(['badge-11']);
    expect(earn({ hikeCount: 1, strenuousHikes: 1 }).badges).toEqual(['badge-11', 'badge-12']);
  });

  it('earns Trail Blazer at 10 miles, not 9.99', () => {
    expect(earn({ hikeMiles: 9.99 }).badges).toEqual([]);
    expect(earn({ hikeMiles: 10 }).badges).toEqual(['badge-13']);
  });

  it('earns Race Day and Trailblazer from a race and a journey finished', () => {
    expect(earn({ raceFinishes: 1 }).badges).toEqual(['badge-14']);
    expect(earn({ journeyFinishes: 1 }).badges).toEqual(['badge-15']);
    expect(earn({ raceFinishes: 1, journeyFinishes: 1 }).badges).toEqual(['badge-14', 'badge-15']);
  });

  it('is never earned by level, streak or xp (nothing in the app ever earned the other badges that way)', () => {
    expect(earn({ level: 100, streak: 365, xp: 5000000 }).badges).toEqual([]);
  });

  it('does not give one again that is already unlocked', () => {
    const r = earn({ finishedWorkouts: 5, hikeCount: 2, raceFinishes: 1 }, { badges: ['badge-1', 'badge-14'] });
    expect(r.badges).toEqual(['badge-11']);
  });
});

describe('facts that are missing or wrong', () => {
  it('earns nothing from a fact that is missing, not a number, or not finite', () => {
    const r = evaluateUnlocks({ facts: { finishedWorkouts: '100', level: NaN, xp: Infinity, streak: null, hikeCount: undefined, bestCalories: true } });
    expect(r).toEqual({ achievements: [], badges: [] });
  });

  it('copes with nothing at all', () => {
    expect(evaluateUnlocks()).toEqual({ achievements: [], badges: [] });
    expect(evaluateUnlocks({})).toEqual({ achievements: [], badges: [] });
    expect(evaluateUnlocks({ facts: null })).toEqual({ achievements: [], badges: [] });
  });
});
