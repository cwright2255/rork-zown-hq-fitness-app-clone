// What the Challenges & Rank card on Home says (lib/rankChallengeData.js). jest.global-setup.js pins the time zone to America/New_York.
import { daysLeftLabel, friendsRankSummary, liveChallengeSummary, ordinal } from '../lib/rankChallengeData';

// Mon 19 Oct 2026, 8:00 AM in New York.
const NOW = new Date(2026, 9, 19, 8, 0);
const at = (m, d, h = 8, mi = 0) => new Date(2026, m - 1, d, h, mi).toISOString();
const DASH = '\u2014';

describe('ordinal', () => {
  it.each([
    [1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [9, '9th'], [10, '10th'],
    [11, '11th'], [12, '12th'], [13, '13th'], [14, '14th'],
    [21, '21st'], [22, '22nd'], [23, '23rd'], [24, '24th'],
    [101, '101st'], [111, '111th'], [112, '112th'], [113, '113th'], [122, '122nd'],
  ])('writes %s as %s', (n, text) => {
    expect(ordinal(n)).toBe(text);
  });
});

describe('friendsRankSummary', () => {
  const entries = [
    { id: 'ana', name: 'Ana', xp: 100 },
    { id: 'ben', name: 'Ben', xp: 900 },
    { id: 'cat', name: 'Cat', xp: 500 },
    { id: 'me', name: 'Cj', xp: 700 },
  ];
  const ready = (o = {}) => friendsRankSummary({ myUid: 'me', hidden: false, status: 'ready', followingCount: 3, entries, ...o });

  describe('when ranked', () => {
    it('is the place among the people you follow and you, by XP', () => {
      expect(ready()).toEqual({
        state: 'ranked', rank: 2, total: 4, value: '#2', caption: 'of 4 by XP',
        sentence: 'Friends rank: 2nd of 4 by XP', route: '/leaderboard',
      });
    });

    it('is first when nobody has more XP', () => {
      const s = ready({ entries: entries.map((e) => (e.id === 'me' ? { ...e, xp: 5000 } : e)) });
      expect([s.rank, s.value, s.sentence]).toEqual([1, '#1', 'Friends rank: 1st of 4 by XP']);
    });

    it('is last when everybody has more', () => {
      const s = ready({ entries: entries.map((e) => (e.id === 'me' ? { ...e, xp: 1 } : e)) });
      expect([s.rank, s.value, s.caption]).toEqual([4, '#4', 'of 4 by XP']);
    });

    it('does not depend on the order the entries come in', () => {
      expect(ready({ entries: [...entries].reverse() })).toEqual(ready());
    });

    it('breaks a tie the way the Leaderboard screen does: by name, then id', () => {
      const tied = [{ id: 'z1', name: 'Zed', xp: 700 }, { id: 'me', name: 'Cj', xp: 700 }, { id: 'a1', name: 'Abe', xp: 700 }];
      expect(ready({ entries: tied }).rank).toBe(2); // Abe, Cj, Zed
      expect(ready({ entries: [{ id: 'b', name: 'Cj', xp: 5 }, { id: 'me', name: 'Cj', xp: 5 }] }).rank).toBe(2); // same name: by id, "b" before "me"
    });

    it('counts a missing XP as none, and reads a number written as text', () => {
      const s = ready({ entries: [{ id: 'me', name: 'Cj', xp: '300' }, { id: 'x', name: 'X' }, { id: 'y', name: 'Y', xp: 'lots' }] });
      expect([s.rank, s.total]).toEqual([1, 3]);
    });

    it('leaves out entries that are not records', () => {
      const s = ready({ entries: [null, undefined, 'x', 7, ...entries] });
      expect([s.rank, s.total]).toEqual([2, 4]);
    });

    it('still ranks when the lookup is fresh and the person is shown', () => {
      expect(ready({ hidden: undefined }).state).toBe('ranked');
    });
  });

  describe('when there is no place to show', () => {
    const none = (state, caption, route = '/leaderboard') => ({
      state, rank: null, total: null, value: DASH, caption, sentence: `Friends rank: ${caption.toLowerCase()}`, route,
    });

    it('says it is still loading', () => {
      expect(ready({ status: 'loading' })).toEqual(none('loading', 'Loading'));
      expect(ready({ status: undefined })).toEqual(none('loading', 'Loading'));
      expect(friendsRankSummary()).toEqual(none('loading', 'Loading'));
    });

    it('says it could not load, rather than that nobody is ranked', () => {
      expect(ready({ status: 'failed', entries: null })).toEqual(none('failed', "Couldn't load"));
    });

    it('says the person is hidden, whatever else is known', () => {
      expect(ready({ hidden: true })).toEqual(none('hidden', 'Hidden from leaderboards'));
      expect(ready({ hidden: true, status: 'failed' }).state).toBe('hidden');
      expect(ready({ hidden: true, status: 'loading' }).state).toBe('hidden');
      expect(ready({ hidden: true, followingCount: 0 }).state).toBe('hidden');
    });

    it('asks the person to follow friends when they follow nobody, and sends a tap to Friends', () => {
      expect(ready({ followingCount: 0, entries: [{ id: 'me', name: 'Cj', xp: 5 }] })).toEqual(none('noFollowing', 'Follow friends to compare', '/friends'));
      expect(ready({ followingCount: undefined }).state).toBe('noFollowing');
      expect(ready({ followingCount: 0, entries: [] }).route).toBe('/friends');
    });

    it('goes to the Leaderboard when they follow people', () => {
      expect(ready({ followingCount: 1 }).route).toBe('/leaderboard');
      expect(ready({ followingCount: 1, entries: [{ id: 'me', name: 'Cj', xp: 5 }] }).route).toBe('/leaderboard');
      expect(ready({ status: 'failed' }).route).toBe('/leaderboard');
    });

    it('says the person is not ranked when they have no entry of their own', () => {
      const others = entries.filter((e) => e.id !== 'me');
      expect(ready({ entries: others })).toEqual(none('unranked', 'Not ranked yet'));
      expect(ready({ myUid: undefined }).state).toBe('unranked');
      expect(ready({ myUid: '' }).state).toBe('unranked');
    });

    it('does not take an entry with no id for the person when the person is not known', () => {
      const s = friendsRankSummary({ myUid: undefined, status: 'ready', followingCount: 1, entries: [{ name: 'No id', xp: 5 }, { id: 'x', name: 'X', xp: 1 }] });
      expect(s.state).toBe('unranked');
    });

    it('says no friends are ranked when only the person has an entry', () => {
      expect(ready({ followingCount: 2, entries: [{ id: 'me', name: 'Cj', xp: 5 }] })).toEqual(none('alone', 'No friends ranked yet'));
    });

    it('treats a lookup with nothing in it as not ranked', () => {
      expect(ready({ entries: [] }).state).toBe('unranked');
      expect(ready({ entries: null }).state).toBe('unranked');
      expect(ready({ entries: 'x' }).state).toBe('unranked');
    });
  });
});

describe('daysLeftLabel', () => {
  it.each([
    [at(10, 24, 8, 0), '5 days left'],
    [at(10, 24, 8, 1), '6 days left'],
    [at(10, 21, 8, 0), '2 days left'],
    [at(10, 20, 8, 0), '1 day left'],
    [at(10, 19, 20, 0), '1 day left'],
    [at(10, 19, 8, 1), '1 day left'],
    [at(10, 19, 8, 0), 'ends today'],
    [at(10, 18, 8, 0), 'ends today'],
  ])('says a challenge ending %s has %s', (end, text) => {
    expect(daysLeftLabel(end, NOW)).toBe(text);
  });

  it.each([[undefined], [null], [''], ['not a date']])('says nothing for an end of %j', (bad) => {
    expect(daysLeftLabel(bad, NOW)).toBe('');
  });

  it('uses the time now when none is given', () => {
    expect(daysLeftLabel(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 - 1000).toISOString())).toBe('3 days left');
  });
});

describe('liveChallengeSummary', () => {
  const periodKeyOf = (cadence) => `${cadence}-now`;
  const ch = (cadence, o = {}) => ({
    id: `${cadence}-1`, cadence, periodKey: `${cadence}-now`, title: `The ${cadence} one`,
    endDate: { daily: at(10, 19, 23, 59), weekly: at(10, 24), monthly: at(10, 31), seasonal: at(11, 30) }[cadence], ...o,
  });
  const ALL = ['daily', 'weekly', 'monthly', 'seasonal'].map((c) => ch(c));
  const prog = (current, target = 5, o = {}) => ({ current, target, percent: Math.min(100, Math.round((current / target) * 100)), completed: current >= target, ...o });
  const run = (o = {}) => liveChallengeSummary({
    challenges: ALL, periodKeyOf, joinedIds: new Set(), progressOf: () => prog(0), now: NOW, ...o,
  });
  const joinedOnly = (...cadences) => new Set(cadences.map((c) => `${c}-1`));

  describe('with nothing live', () => {
    const none = {
      state: 'none', cadence: null, challengeId: null, label: 'Challenges', title: '', value: DASH, pct: null, completed: false,
      caption: 'Open Challenges', sentence: 'Challenges: none live right now',
    };

    it('says so when there are no challenges', () => {
      expect(run({ challenges: [] })).toEqual(none);
      expect(run({ challenges: undefined })).toEqual(none);
      expect(run({ challenges: null })).toEqual(none);
      expect(liveChallengeSummary({ periodKeyOf })).toEqual(none);
    });

    it('does not count a challenge from an earlier day, week, month or season', () => {
      const old = ALL.map((c) => ({ ...c, periodKey: `${c.cadence}-before` }));
      expect(run({ challenges: old, joinedIds: new Set(old.map((c) => c.id)) })).toEqual(none);
    });

    it('does not count a challenge of a cadence there is none of', () => {
      expect(run({ challenges: [{ ...ch('weekly'), cadence: 'yearly', periodKey: 'yearly-now' }] }).state).toBe('none');
    });

    it('does not take a challenge of one cadence for another because their period keys match', () => {
      expect(run({ challenges: [{ ...ch('weekly'), periodKey: 'daily-now' }] })).toEqual(none);
    });

    it('leaves out entries that are not records', () => {
      expect(run({ challenges: [null, undefined, 'x', 7] })).toEqual(none);
    });
  });

  describe('suggesting one to join', () => {
    it('suggests this week\'s first', () => {
      expect(run()).toEqual({
        state: 'join', cadence: 'weekly', challengeId: 'weekly-1', label: 'Weekly challenge', title: 'The weekly one', value: 'Join',
        pct: null, completed: false, caption: 'Tap to join', sentence: 'Weekly challenge: The weekly one, not joined yet',
      });
    });

    it.each([
      [['daily', 'monthly', 'seasonal'], 'daily'],
      [['monthly', 'seasonal'], 'monthly'],
      [['seasonal'], 'seasonal'],
      [['seasonal', 'weekly'], 'weekly'],
    ])('suggests, from %j, the %s one', (present, cadence) => {
      const s = run({ challenges: present.map((c) => ch(c)) });
      expect([s.state, s.cadence, s.label]).toEqual(['join', cadence, `${cadence[0].toUpperCase()}${cadence.slice(1)} challenge`]);
    });

    it('uses the cadence for the name when a challenge has no title', () => {
      const s = run({ challenges: [ch('weekly', { title: undefined })] });
      expect(s.title).toBe('Weekly challenge');
      expect(s.sentence).toBe('Weekly challenge: Weekly challenge, not joined yet');
    });

    it('reads the joined ids from a list as well as a Set, and from nothing', () => {
      expect(run({ joinedIds: undefined }).state).toBe('join');
      expect(run({ joinedIds: null }).state).toBe('join');
      expect(run({ joinedIds: [] }).state).toBe('join');
      expect(run({ joinedIds: ['someone-else'] }).state).toBe('join');
      expect(run({ joinedIds: ['weekly-1'] }).state).toBe('joined');
      expect(run({ joinedIds: new Set(['weekly-1']) }).state).toBe('joined');
      expect(run({ joinedIds: 'weekly-1' }).state).toBe('join');
    });
  });

  describe('a joined challenge', () => {
    it('shows the progress, the bar and the days left', () => {
      const s = run({ joinedIds: joinedOnly('weekly'), progressOf: () => prog(3) });
      expect(s).toEqual({
        state: 'joined', cadence: 'weekly', challengeId: 'weekly-1', label: 'Weekly challenge', title: 'The weekly one', value: '3/5',
        pct: 60, completed: false, caption: '5 days left', sentence: 'Weekly challenge: The weekly one, 3 of 5, 5 days left',
      });
    });

    it('asks for the progress of the challenge it shows, and only of joined ones', () => {
      const progressOf = jest.fn(() => prog(1));
      run({ joinedIds: joinedOnly('weekly', 'monthly'), progressOf });
      expect(progressOf.mock.calls.map(([c]) => c.id).sort()).toEqual(['monthly-1', 'weekly-1']);
    });

    it('says Complete once the goal is reached, and a progress past the goal as it is', () => {
      const s = run({ joinedIds: joinedOnly('weekly'), progressOf: () => prog(7) });
      expect([s.value, s.pct, s.completed, s.caption]).toEqual(['7/5', 100, true, 'Complete']);
      expect(s.sentence).toBe('Weekly challenge: The weekly one, 7 of 5, complete');
    });

    it('shows no days left for a challenge with no end', () => {
      const s = run({ challenges: [ch('weekly', { endDate: undefined })], joinedIds: joinedOnly('weekly'), progressOf: () => prog(2) });
      expect([s.caption, s.sentence]).toEqual(['', 'Weekly challenge: The weekly one, 2 of 5']);
    });

    it('uses the cadence for the name when a challenge has no title', () => {
      const s = run({ challenges: [ch('daily', { title: '' })], joinedIds: joinedOnly('daily'), progressOf: () => prog(0) });
      expect(s.title).toBe('Daily challenge');
    });

    it.each([[150, 100], [100, 100], [0, 0], [-5, 0], [NaN, 0], [undefined, 0], ['40', 40], [33.5, 33.5]])('draws a percent of %j as a bar of %j', (percent, bar) => {
      const s = run({ joinedIds: joinedOnly('weekly'), progressOf: () => prog(2, 5, { percent }) });
      expect(s.pct).toBe(bar);
    });

    it('leaves out a joined challenge whose progress cannot be worked out', () => {
      const s = run({ challenges: [ch('weekly')], joinedIds: joinedOnly('weekly'), progressOf: () => null });
      expect(s.state).toBe('join');
    });
  });

  describe('picking among several joined', () => {
    const progressByCadence = (map) => (c) => map[c.cadence];

    it('picks the unfinished one that ends soonest', () => {
      const s = run({
        joinedIds: joinedOnly('daily', 'weekly', 'monthly'),
        progressOf: progressByCadence({ daily: prog(0, 1), weekly: prog(2), monthly: prog(1, 10) }),
      });
      expect(s.cadence).toBe('daily');
    });

    it('passes over a finished one for an unfinished one that ends later', () => {
      const s = run({
        joinedIds: joinedOnly('daily', 'weekly', 'monthly'),
        progressOf: progressByCadence({ daily: prog(1, 1), weekly: prog(2), monthly: prog(1, 10) }),
      });
      expect([s.cadence, s.completed]).toEqual(['weekly', false]);
    });

    it('picks the one that ends soonest when all are finished', () => {
      const s = run({
        joinedIds: joinedOnly('daily', 'weekly', 'monthly'),
        progressOf: progressByCadence({ daily: prog(1, 1), weekly: prog(5), monthly: prog(10, 10) }),
      });
      expect([s.cadence, s.completed, s.caption]).toEqual(['daily', true, 'Complete']);
    });

    it('does not depend on the order the challenges come in', () => {
      const progressOf = progressByCadence({ daily: prog(0, 1), weekly: prog(2), monthly: prog(1, 10), seasonal: prog(1, 20) });
      const joinedIds = joinedOnly('daily', 'weekly', 'monthly', 'seasonal');
      expect(run({ challenges: [...ALL].reverse(), joinedIds, progressOf }).cadence).toBe('daily');
      const noDaily = ALL.filter((c) => c.cadence !== 'daily');
      expect(run({ challenges: [...noDaily].reverse(), joinedIds, progressOf }).cadence).toBe('weekly');
    });

    it('takes the earlier cadence when two end together', () => {
      const same = at(10, 24);
      const challenges = [ch('weekly', { endDate: same }), ch('daily', { endDate: same })];
      expect(run({ challenges, joinedIds: joinedOnly('daily', 'weekly'), progressOf: () => prog(1) }).cadence).toBe('daily');
      expect(run({ challenges: [...challenges].reverse(), joinedIds: joinedOnly('daily', 'weekly'), progressOf: () => prog(1) }).cadence).toBe('daily');
    });

    it('puts one with no end after one with an end', () => {
      const challenges = [ch('daily', { endDate: undefined }), ch('monthly')];
      expect(run({ challenges, joinedIds: joinedOnly('daily', 'monthly'), progressOf: () => prog(1) }).cadence).toBe('monthly');
      expect(run({ challenges: [ch('daily', { endDate: 'soon' }), ch('seasonal')], joinedIds: joinedOnly('daily', 'seasonal'), progressOf: () => prog(1) }).cadence).toBe('seasonal');
    });

    it('shows a joined challenge rather than suggesting one it has not joined', () => {
      const s = run({ joinedIds: joinedOnly('seasonal'), progressOf: () => prog(1, 20) });
      expect([s.state, s.cadence, s.value]).toEqual(['joined', 'seasonal', '1/20']);
    });
  });
});
