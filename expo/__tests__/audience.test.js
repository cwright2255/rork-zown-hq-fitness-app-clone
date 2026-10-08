import {
  AUDIENCES, audienceUids, filterByAudience, chunk, rankEntries, challengeEntryId,
  emptyAudienceMessage, nextFollowState, isAudience,
} from '../lib/audience';

const follows = [
  { uid: 'a', name: 'Alex', close: true },
  { uid: 'b', name: 'Bea', close: false },
  { uid: 'c', name: 'Cam', close: true },
  { uid: 'd', name: 'Dee' },
  { uid: '', name: 'Broken' },
  null,
];

describe('audiences', () => {
  it('has the three choices in order', () => {
    expect(AUDIENCES.map((a) => a.id)).toEqual(['everyone', 'following', 'close']);
    expect(isAudience('close')).toBe(true);
    expect(isAudience('friends')).toBe(false);
  });

  it('everyone means no filter', () => {
    expect(audienceUids('everyone', follows)).toBeNull();
    expect(audienceUids('anything-else', follows)).toBeNull();
  });

  it('following includes close friends; close is the starred subset; junk is ignored', () => {
    expect(audienceUids('following', follows)).toEqual(['a', 'b', 'c', 'd']);
    expect(audienceUids('close', follows)).toEqual(['a', 'c']);
    expect(audienceUids('close', null)).toEqual([]);
  });
});

describe('filterByAudience', () => {
  const entries = [{ id: 'me' }, { id: 'a' }, { id: 'b' }, { id: 'x' }, { id: 'c' }];
  const opts = { getUid: (e) => e.id, myUid: 'me' };

  it('keeps everything for everyone', () => {
    expect(filterByAudience(entries, 'everyone', follows, opts)).toHaveLength(5);
  });
  it('filters to following, or to close friends', () => {
    expect(filterByAudience(entries, 'following', follows, opts).map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(filterByAudience(entries, 'close', follows, opts).map((e) => e.id)).toEqual(['a', 'c']);
  });
  it('can keep you in the list', () => {
    expect(filterByAudience(entries, 'close', follows, { ...opts, keepSelf: true }).map((e) => e.id)).toEqual(['me', 'a', 'c']);
  });
  it('shows nobody when you follow nobody', () => {
    expect(filterByAudience(entries, 'following', [], opts)).toEqual([]);
  });
});

describe('helpers', () => {
  it('chunks into groups of ten for Firestore in-queries', () => {
    const ids = Array.from({ length: 23 }, (_, i) => `u${i}`);
    expect(chunk(ids, 10).map((g) => g.length)).toEqual([10, 10, 3]);
    expect(chunk([], 10)).toEqual([]);
  });
  it('ranks highest first with stable ties and adds rank', () => {
    const ranked = rankEntries([
      { id: '2', name: 'Bea', xp: 50 }, { id: '1', name: 'Alex', xp: 50 }, { id: '3', name: 'Cam', xp: 90 }, { id: '4', name: 'Dee' },
    ]);
    expect(ranked.map((e) => e.id)).toEqual(['3', '1', '2', '4']);
    expect(ranked.map((e) => e.rank)).toEqual([1, 2, 3, 4]);
    expect(rankEntries([{ id: 'a', current: 3 }, { id: 'b', current: 7 }], 'current')[0].id).toBe('b');
  });
  it('ranks by a number worked out for each entry when given a function', () => {
    const entries = [
      { id: 'a', name: 'Ana', distance: { w1: 4.5 } },
      { id: 'b', name: 'Ben', distance: { w1: 12 } },
      { id: 'c', name: 'Cat' },
    ];
    const ranked = rankEntries(entries, (e) => e.distance?.w1);
    expect(ranked.map((e) => e.id)).toEqual(['b', 'a', 'c']);
    expect(ranked.map((e) => e.rank)).toEqual([1, 2, 3]);
  });
  it('breaks ties between function-ranked entries by name', () => {
    const ranked = rankEntries([{ id: '2', name: 'Bea', v: 5 }, { id: '1', name: 'Alex', v: 5 }], (e) => e.v);
    expect(ranked.map((e) => e.id)).toEqual(['1', '2']);
  });
  it('builds the challenge entry id the Firestore rule checks', () => {
    expect(challengeEntryId('week-2026-10-05', 'uid1')).toBe('week-2026-10-05_uid1');
  });
  it('words empty states for each audience', () => {
    expect(emptyAudienceMessage('leaderboard', 'close')).toContain('close friends');
    expect(emptyAudienceMessage('challenges', 'following')).toContain('follow');
    expect(emptyAudienceMessage('leaderboard', 'everyone')).toContain('No one');
  });
});

describe('follow state', () => {
  it('following keeps an existing close-friend star', () => {
    expect(nextFollowState(null, 'follow')).toEqual({ following: true, close: false });
    expect(nextFollowState({ close: true }, 'follow')).toEqual({ following: true, close: true });
  });
  it('unfollowing also removes the close-friend star', () => {
    expect(nextFollowState({ close: true }, 'unfollow')).toEqual({ following: false, close: false });
  });
  it('starring someone follows them; unstarring keeps the follow', () => {
    expect(nextFollowState(null, 'addClose')).toEqual({ following: true, close: true });
    expect(nextFollowState({ close: true }, 'removeClose')).toEqual({ following: true, close: false });
    expect(nextFollowState(null, 'removeClose')).toEqual({ following: false, close: false });
  });
});
