// What the person tells the training engine about its picks (lib/trainingFeedback.js). Every expected number below was worked out by hand from the
// rules at the top of that file: More 1.3, Less 0.7, each swap and each skip 0.9 for 28 days and never below 0.5 together, Exclude until restored.
import {
  FEEDBACK_RULES, feedbackKey, emptyFeedback, sanitizeFeedback, voteOf, nextVote, setVote, excludeExercise, restoreExercise, excludedKeys,
  excludedList, recordSwap, recordSkip, multiplierFor, weightsFor, pruneFeedback,
} from '../lib/trainingFeedback';

const NOW = new Date('2026-10-26T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const ago = (days) => NOW.getTime() - days * DAY;
const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); }
  return o;
};
const BENCH = 'barbell-bench-press';

describe('the rules', () => {
  it('are these, and no others (the starting values; change them in lib/trainingFeedback.js)', () => {
    expect(FEEDBACK_RULES).toEqual({
      version: 1, more: 1.3, less: 0.7, swap: 0.9, skip: 0.9, floor: 0.5, memoryDays: 28, eventsKept: 12, maxKeys: 300, nameMax: 80,
    });
  });

  it('cannot be changed by a caller', () => {
    expect(Object.isFrozen(FEEDBACK_RULES)).toBe(true);
  });
});

describe('feedbackKey', () => {
  it('is the library id of an exercise that is not on a ladder', () => {
    expect(feedbackKey(BENCH)).toBe(BENCH);
    expect(feedbackKey({ id: BENCH, name: 'Barbell Bench Press' })).toBe(BENCH);
  });

  it('is the same for every rung of a bodyweight ladder, so the ladder is one exercise as far as feedback goes', () => {
    expect(feedbackKey('wall-push-up')).toBe('ladder:push');
    expect(feedbackKey('push-up')).toBe('ladder:push');
    expect(feedbackKey('single-arm-push-up')).toBe('ladder:push');
    expect(feedbackKey({ id: 'archer-push-up' })).toBe('ladder:push');
    expect(feedbackKey('plank')).toBe('ladder:plank');
    expect(feedbackKey('pike-push-up')).toBe('ladder:pike');
    expect(feedbackKey('pike-push-up')).not.toBe(feedbackKey('push-up'));
  });

  it('is empty for anything that is not an exercise with an id', () => {
    [undefined, null, 5, {}, { id: 7 }, []].forEach((x) => expect(feedbackKey(x)).toBe(''));
  });

  it('keeps the id of one the library does not know, so what is saved is not lost', () => {
    expect(feedbackKey('some-future-exercise')).toBe('some-future-exercise');
  });
});

describe('sanitizeFeedback', () => {
  it('gives no feedback for anything that is not an object', () => {
    [undefined, null, 'x', 5, [], true].forEach((raw) => expect(sanitizeFeedback(raw)).toEqual(emptyFeedback()));
    expect(emptyFeedback()).toEqual({ v: 1, votes: {}, excluded: {}, swaps: {}, skips: {} });
  });

  it('keeps what has the right shape', () => {
    const raw = {
      v: 1,
      votes: { [BENCH]: { vote: 'more', at: '2026-10-01T00:00:00.000Z' }, 'ladder:push': { vote: 'less', at: '' } },
      excluded: { deadlift: { name: 'Deadlift', ladder: false, at: '2026-10-02T00:00:00.000Z' } },
      swaps: { [BENCH]: [3, 1, 2] },
      skips: { plank: [5] },
    };
    expect(sanitizeFeedback(raw)).toEqual({
      v: 1,
      votes: { [BENCH]: { vote: 'more', at: '2026-10-01T00:00:00.000Z' }, 'ladder:push': { vote: 'less', at: '' } },
      excluded: { deadlift: { name: 'Deadlift', ladder: false, at: '2026-10-02T00:00:00.000Z' } },
      swaps: { [BENCH]: [1, 2, 3] },
      skips: { plank: [5] },
    });
  });

  it('drops what is wrong, entry by entry, and keeps the rest', () => {
    const out = sanitizeFeedback({
      votes: { a: { vote: 'most' }, b: 'more', c: null, d: { vote: 'less' }, '': { vote: 'more' }, ['x'.repeat(121)]: { vote: 'more' } },
      excluded: { a: 'yes', b: { name: 5 }, c: [] },
      swaps: { a: 'x', b: [], c: ['x', NaN, Infinity, null], d: [4] },
      skips: [],
    });
    expect(out.votes).toEqual({ d: { vote: 'less', at: '' } });
    expect(out.excluded).toEqual({ b: { name: 'b', ladder: false, at: '' } });
    expect(out.swaps).toEqual({ d: [4] });
    expect(out.skips).toEqual({});
  });

  it('keeps the newest twelve swaps and skips of an exercise, oldest first', () => {
    const many = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(sanitizeFeedback({ swaps: { a: many.slice().reverse() } }).swaps.a).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it('calls an excluded exercise by its trimmed name, cut at 80 characters, or by its key when it has none', () => {
    const out = sanitizeFeedback({ excluded: { a: { name: `  ${'n'.repeat(100)}  ` }, b: { name: '   ' }, c: { name: 'Deadlift', ladder: 'yes' } } });
    expect(out.excluded.a.name).toBe('n'.repeat(80));
    expect(out.excluded.b.name).toBe('b');
    expect(out.excluded.c.ladder).toBe(false);
  });

  it('keeps no more than 300 exercises in any list, so a damaged copy cannot grow without limit', () => {
    const votes = {};
    const excluded = {};
    const swaps = {};
    for (let i = 0; i < 400; i += 1) {
      votes[`k${i}`] = { vote: 'more' };
      excluded[`k${i}`] = { name: 'x' };
      swaps[`k${i}`] = [i + 1];
    }
    const out = sanitizeFeedback({ votes, excluded, swaps });
    expect(Object.keys(out.votes)).toHaveLength(300);
    expect(Object.keys(out.excluded)).toHaveLength(300);
    expect(Object.keys(out.swaps)).toHaveLength(300);
  });

  it('does not change what it is given, and gives back a copy that can be changed', () => {
    const raw = deepFreeze({ votes: { a: { vote: 'more', at: '' } }, excluded: {}, swaps: { a: [1] }, skips: {} });
    const out = sanitizeFeedback(raw);
    out.votes.a.vote = 'less';
    out.swaps.a.push(2);
    expect(raw.votes.a.vote).toBe('more');
    expect(raw.swaps.a).toEqual([1]);
  });
});

describe('votes', () => {
  it('are read as more, less or none', () => {
    const fb = { votes: { a: { vote: 'more' }, b: { vote: 'less' }, c: { vote: 'x' } } };
    expect(voteOf(fb, 'a')).toBe('more');
    expect(voteOf(fb, 'b')).toBe('less');
    expect(voteOf(fb, 'c')).toBeNull();
    expect(voteOf(fb, 'zzz')).toBeNull();
    expect(voteOf(null, 'a')).toBeNull();
    expect(voteOf({}, 'a')).toBeNull();
  });

  it('change with a tap: the same one again clears it, the other one changes it', () => {
    expect(nextVote(null, 'more')).toBe('more');
    expect(nextVote(null, 'less')).toBe('less');
    expect(nextVote('more', 'more')).toBeNull();
    expect(nextVote('less', 'less')).toBeNull();
    expect(nextVote('more', 'less')).toBe('less');
    expect(nextVote('less', 'more')).toBe('more');
  });

  it('are not changed by a tap that is neither', () => {
    expect(nextVote('more', 'sideways')).toBe('more');
    expect(nextVote('less', undefined)).toBe('less');
    expect(nextVote(null, 'sideways')).toBeNull();
    expect(nextVote('bogus', 'sideways')).toBeNull();
  });

  it('are set and cleared on a new state, with the time they were set', () => {
    const base = deepFreeze(emptyFeedback());
    const more = setVote(base, BENCH, 'more', NOW);
    expect(more.votes[BENCH]).toEqual({ vote: 'more', at: '2026-10-26T12:00:00.000Z' });
    expect(base.votes).toEqual({});
    expect(setVote(more, BENCH, 'less', NOW).votes[BENCH].vote).toBe('less');
    expect(setVote(more, BENCH, null, NOW).votes).toEqual({});
  });

  it('are not set to anything but more or less, or for an exercise with no key', () => {
    const base = emptyFeedback();
    expect(setVote(base, BENCH, 'sideways', NOW)).toEqual(base);
    expect(setVote(base, '', 'more', NOW)).toEqual(base);
    expect(setVote(base, undefined, 'more', NOW)).toEqual(base);
  });

  it('stop at 300 exercises, but one that already has a vote can still be changed', () => {
    let fb = emptyFeedback();
    for (let i = 0; i < 300; i += 1) fb = setVote(fb, `k${i}`, 'more', NOW);
    expect(Object.keys(setVote(fb, 'one-more', 'more', NOW).votes)).toHaveLength(300);
    expect(setVote(fb, 'one-more', 'more', NOW).votes['one-more']).toBeUndefined();
    expect(setVote(fb, 'k5', 'less', NOW).votes.k5.vote).toBe('less');
  });
});

describe('Exclude and Restore', () => {
  it('exclude an exercise until it is restored', () => {
    const base = deepFreeze(emptyFeedback());
    const out = excludeExercise(base, BENCH, { name: 'Barbell Bench Press', ladder: false }, NOW);
    expect(out.excluded[BENCH]).toEqual({ name: 'Barbell Bench Press', ladder: false, at: '2026-10-26T12:00:00.000Z' });
    expect(excludedKeys(out)).toEqual([BENCH]);
    expect(excludedKeys(restoreExercise(out, BENCH))).toEqual([]);
    expect(base.excluded).toEqual({});
  });

  it('exclude a whole ladder by its key, and say so in the list', () => {
    const out = excludeExercise(emptyFeedback(), feedbackKey('push-up'), { name: 'Push-Up', ladder: true }, NOW);
    expect(excludedKeys(out)).toEqual(['ladder:push']);
    expect(excludedList(out)).toEqual([{ key: 'ladder:push', name: 'Push-Up', ladder: true }]);
  });

  it('are not done for an exercise with no key, and a name is trimmed, cut, or taken from the key', () => {
    expect(excludeExercise(emptyFeedback(), '', { name: 'x' }, NOW)).toEqual(emptyFeedback());
    expect(excludeExercise(emptyFeedback(), 'a', undefined, NOW).excluded.a).toMatchObject({ name: 'a', ladder: false });
    expect(excludeExercise(emptyFeedback(), 'a', { name: ` ${'n'.repeat(90)} ` }, NOW).excluded.a.name).toBe('n'.repeat(80));
  });

  it('restoring one that is not excluded changes nothing', () => {
    expect(restoreExercise(emptyFeedback(), 'nothing')).toEqual(emptyFeedback());
  });

  it('are listed newest first, and by key when excluded at the same moment', () => {
    let fb = emptyFeedback();
    fb = excludeExercise(fb, 'b', { name: 'B' }, new Date('2026-10-01T00:00:00Z'));
    fb = excludeExercise(fb, 'c', { name: 'C' }, new Date('2026-10-03T00:00:00Z'));
    fb = excludeExercise(fb, 'a', { name: 'A' }, new Date('2026-10-03T00:00:00Z'));
    expect(excludedList(fb).map((e) => e.key)).toEqual(['a', 'c', 'b']);
  });

  it('read as nothing excluded from anything that is not feedback', () => {
    [undefined, null, 'x', {}, { excluded: 'x' }, { excluded: [] }].forEach((fb) => expect(excludedKeys(fb)).toEqual([]));
    expect(excludedList(undefined)).toEqual([]);
  });
});

describe('swaps and skips', () => {
  it('are noted with the time, oldest first, and do not change the state they are added to', () => {
    const base = deepFreeze(emptyFeedback());
    const one = recordSwap(base, BENCH, ago(2));
    const two = recordSwap(one, BENCH, ago(1));
    expect(two.swaps[BENCH]).toEqual([ago(2), ago(1)]);
    expect(recordSwap(two, BENCH, ago(5)).swaps[BENCH]).toEqual([ago(5), ago(2), ago(1)]);
    expect(base.swaps).toEqual({});
    expect(recordSkip(base, 'plank', NOW).skips).toEqual({ plank: [NOW.getTime()] });
    expect(recordSkip(base, 'plank', NOW).swaps).toEqual({});
  });

  it('keep the newest twelve of an exercise', () => {
    let fb = emptyFeedback();
    for (let i = 1; i <= 15; i += 1) fb = recordSkip(fb, 'a', ago(30 - i));
    expect(fb.skips.a).toHaveLength(12);
    expect(fb.skips.a[0]).toBe(ago(30 - 4));
    expect(fb.skips.a[11]).toBe(ago(30 - 15));
  });

  it('are not noted for an exercise with no key', () => {
    expect(recordSwap(emptyFeedback(), '', NOW)).toEqual(emptyFeedback());
    expect(recordSkip(emptyFeedback(), undefined, NOW)).toEqual(emptyFeedback());
  });

  it('stop at 300 exercises, but one that is already there can still be added to', () => {
    let fb = emptyFeedback();
    for (let i = 0; i < 300; i += 1) fb = recordSwap(fb, `k${i}`, NOW);
    expect(Object.keys(recordSwap(fb, 'new', NOW).swaps)).toHaveLength(300);
    expect(recordSwap(fb, 'k1', ago(1)).swaps.k1).toHaveLength(2);
  });
});

describe('multiplierFor: what an exercise\'s score is multiplied by', () => {
  const m = (fb) => multiplierFor(fb, BENCH, NOW);
  const withEvents = (swapsAgo = [], skipsAgo = [], vote = null) => ({
    ...emptyFeedback(),
    votes: vote ? { [BENCH]: { vote, at: '' } } : {},
    swaps: swapsAgo.length ? { [BENCH]: swapsAgo.map(ago) } : {},
    skips: skipsAgo.length ? { [BENCH]: skipsAgo.map(ago) } : {},
  });

  it('is 1 when there is nothing to say', () => {
    expect(m(emptyFeedback())).toBe(1);
    [undefined, null, 'x', 5, []].forEach((fb) => expect(m(fb)).toBe(1));
  });

  it('is 1.3 for More and 0.7 for Less', () => {
    expect(m(withEvents([], [], 'more'))).toBe(1.3);
    expect(m(withEvents([], [], 'less'))).toBe(0.7);
  });

  it('is 0.9 for a swap away and 0.9 for a skip, and 0.81 for two of them', () => {
    expect(m(withEvents([1]))).toBe(0.9);
    expect(m(withEvents([], [1]))).toBe(0.9);
    expect(m(withEvents([1, 2]))).toBe(0.81);
    expect(m(withEvents([1], [2]))).toBe(0.81);
    expect(m(withEvents([1, 2, 3]))).toBe(0.729);
  });

  it('multiplies a vote by what the swaps and skips make', () => {
    expect(m(withEvents([1, 2], [], 'more'))).toBe(1.053); // 1.3 x 0.81
    expect(m(withEvents([1], [2], 'less'))).toBe(0.567); // 0.7 x 0.81
  });

  it('never takes the swaps and skips below half, and the floor applies before the vote', () => {
    expect(m(withEvents([1, 2, 3, 4, 5]))).toBe(0.5905); // 0.9^5 = 0.59049, still above the floor
    expect(m(withEvents([1, 2, 3, 4, 5, 6, 7]))).toBe(0.5); // 0.9^7 = 0.478 is held at 0.5
    expect(m(withEvents([1, 2, 3, 4], [5, 6, 7, 8, 9, 10], 'less'))).toBe(0.35); // 0.7 x 0.5
    expect(m(withEvents([1, 2, 3, 4, 5, 6, 7, 8], [], 'more'))).toBe(0.65); // 1.3 x 0.5
  });

  it('counts a swap or a skip for 28 days and not a moment longer', () => {
    expect(m(withEvents([27.9]))).toBe(0.9);
    expect(m(withEvents([28]))).toBe(1);
    expect(m(withEvents([40, 1]))).toBe(0.9);
    expect(m(withEvents([], [28.1, 29, 100]))).toBe(1);
  });

  it('keeps a vote for ever', () => {
    const old = { ...emptyFeedback(), votes: { [BENCH]: { vote: 'more', at: '2020-01-01T00:00:00.000Z' } } };
    expect(m(old)).toBe(1.3);
  });

  it('reads one exercise only', () => {
    const fb = withEvents([1, 2], [], 'more');
    expect(multiplierFor(fb, 'deadlift', NOW)).toBe(1);
  });

  it('is rounded to four places, so two swaps are 0.81 and not 0.8100000000000001', () => {
    expect(String(m(withEvents([1, 2])))).toBe('0.81');
  });

  it('takes the time from the number, the date or the clock', () => {
    const fb = withEvents([27.9]);
    expect(multiplierFor(fb, BENCH, NOW.getTime())).toBe(0.9);
    expect(multiplierFor(fb, BENCH, new Date(NOW.getTime() + 2 * DAY))).toBe(1);
    jest.useFakeTimers({ now: NOW });
    try {
      expect(multiplierFor(fb, BENCH)).toBe(0.9);
      expect(multiplierFor(fb, BENCH, new Date('not a date'))).toBe(0.9);
      expect(multiplierFor(fb, BENCH, Number.NaN)).toBe(0.9);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('weightsFor: what the picker is given', () => {
  it('has only the exercises whose multiplier is not 1', () => {
    const fb = {
      ...emptyFeedback(),
      votes: { a: { vote: 'more', at: '' }, b: { vote: 'less', at: '' } },
      swaps: { b: [ago(1)], c: [ago(40)], d: [ago(2), ago(3)] },
      skips: { e: [ago(1)], a: [ago(1)] },
    };
    expect(weightsFor(fb, NOW)).toEqual({ a: 1.17, b: 0.63, d: 0.81, e: 0.9 });
  });

  it('is empty for no feedback, for feedback that has expired, and for anything that is not feedback', () => {
    expect(weightsFor(emptyFeedback(), NOW)).toEqual({});
    expect(weightsFor({ ...emptyFeedback(), swaps: { a: [ago(50)] } }, NOW)).toEqual({});
    [undefined, null, 'x', 5].forEach((fb) => expect(weightsFor(fb, NOW)).toEqual({}));
  });

  it('says nothing about an exercise that is only excluded: that goes to the picker as excluded, not as a weight', () => {
    expect(weightsFor(excludeExercise(emptyFeedback(), BENCH, { name: 'x' }, NOW), NOW)).toEqual({});
  });
});

describe('pruneFeedback', () => {
  it('drops swaps and skips older than 28 days and the exercises left with none, and keeps the votes and the exclusions', () => {
    let fb = emptyFeedback();
    fb = setVote(fb, 'a', 'more', NOW);
    fb = excludeExercise(fb, 'b', { name: 'B' }, NOW);
    fb = { ...fb, swaps: { a: [ago(40), ago(1)], c: [ago(30)] }, skips: { d: [ago(29)], e: [ago(27)] } };
    const out = pruneFeedback(fb, NOW);
    expect(out.swaps).toEqual({ a: [ago(1)] });
    expect(out.skips).toEqual({ e: [ago(27)] });
    expect(out.votes.a.vote).toBe('more');
    expect(excludedKeys(out)).toEqual(['b']);
  });

  it('drops a swap or a skip that is exactly 28 days old, the moment multiplierFor stops counting it, and keeps one a little younger', () => {
    const fb = { ...emptyFeedback(), swaps: { a: [ago(28)], b: [ago(27.5)] }, skips: { c: [ago(28)] } };
    const out = pruneFeedback(fb, NOW);
    expect(out.swaps).toEqual({ b: [ago(27.5)] });
    expect(out.skips).toEqual({});
    expect(multiplierFor(fb, 'a', NOW)).toBe(1);
    expect(multiplierFor(fb, 'b', NOW)).toBe(0.9);
  });

  it('does not change what it is given', () => {
    const fb = deepFreeze({ ...emptyFeedback(), swaps: { a: [ago(40)] } });
    expect(pruneFeedback(fb, NOW).swaps).toEqual({});
    expect(fb.swaps.a).toHaveLength(1);
  });
});
