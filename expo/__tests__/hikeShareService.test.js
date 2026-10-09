import { shareHikeToFeed, hikeShareErrorText } from '../services/hikeShare';

const START = new Date(2026, 9, 8, 7, 5, 0).toISOString();
const hike = (extra = {}) => ({
  id: 'hike-1', uid: 'u1', startTime: START, trailName: 'Old Rag', distanceKm: 6.6, durationSeconds: 9000,
  elevationGainM: 412, difficultyTier: 'Moderate', calories: 880,
  track: Array.from({ length: 60 }, (_, i) => [40 + i * 0.001, -74]).flat(),
  ...extra,
});
const user = (extra = {}) => ({ uid: 'u1', name: 'Cj', displayName: 'Cj W', profileImage: 'https://img/p.png', ...extra });

let warn;
beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => warn.mockRestore());

describe('shareHikeToFeed', () => {
  it('posts the hike as a hike card and remembers the post on the hike', async () => {
    const createPost = jest.fn(async () => 'post-1');
    const markShared = jest.fn();
    const result = await shareHikeToFeed({ hike: hike(), user: user(), createPost, markShared });

    expect(result).toEqual({ ok: true, postId: 'post-1' });
    expect(createPost).toHaveBeenCalledTimes(1);
    const args = createPost.mock.calls[0][0];
    expect(args).toMatchObject({
      uid: 'u1',
      authorName: 'Cj W',
      authorAvatar: 'https://img/p.png',
      type: 'hike',
      text: 'Old Rag: 6.60 km in 2:30:00 \uD83E\uDD7E',
    });
    expect(args.run).toMatchObject({ v: 1, activity: 'hike', distance: 6.6, duration: 9000, tier: 'Moderate' });
    expect(args.run.route.length).toBeGreaterThan(0);
    expect(markShared).toHaveBeenCalledWith('u1', 'hike-1', 'post-1');
  });

  it('names the author from the display name, then the name, then "Zown User"', async () => {
    let createPost = jest.fn(async () => 'p');
    await shareHikeToFeed({ hike: hike(), user: user({ displayName: undefined }), createPost });
    expect(createPost.mock.calls[0][0].authorName).toBe('Cj');
    createPost = jest.fn(async () => 'p');
    await shareHikeToFeed({ hike: hike(), user: { uid: 'u1' }, createPost });
    expect(createPost.mock.calls[0][0].authorName).toBe('Zown User');
  });

  it('does not post a hike that was already shared', async () => {
    const createPost = jest.fn();
    const result = await shareHikeToFeed({ hike: hike({ sharedPostId: 'old' }), user: user(), createPost });
    expect(result).toEqual({ ok: false, reason: 'already-shared', postId: 'old' });
    expect(createPost).not.toHaveBeenCalled();
  });

  it('needs a hike and a signed-in user', async () => {
    const createPost = jest.fn();
    expect(await shareHikeToFeed({ user: user(), createPost })).toEqual({ ok: false, reason: 'no-hike' });
    expect(await shareHikeToFeed({ hike: hike(), user: null, createPost })).toEqual({ ok: false, reason: 'signed-out' });
    expect(await shareHikeToFeed({ hike: hike(), user: {}, createPost })).toEqual({ ok: false, reason: 'signed-out' });
    expect(await shareHikeToFeed()).toEqual({ ok: false, reason: 'no-hike' });
    expect(createPost).not.toHaveBeenCalled();
  });

  it('does not post a hike too short to mean anything', async () => {
    const createPost = jest.fn();
    const result = await shareHikeToFeed({ hike: hike({ distanceKm: 0 }), user: user(), createPost });
    expect(result).toEqual({ ok: false, reason: 'too-short' });
    expect(createPost).not.toHaveBeenCalled();
  });

  it('reports an error, without throwing, when the post could not be made', async () => {
    const markShared = jest.fn();
    const failing = jest.fn(async () => { throw new Error('offline'); });
    expect(await shareHikeToFeed({ hike: hike(), user: user(), createPost: failing, markShared })).toEqual({ ok: false, reason: 'error' });
    const empty = jest.fn(async () => null);
    expect(await shareHikeToFeed({ hike: hike(), user: user(), createPost: empty, markShared })).toEqual({ ok: false, reason: 'error' });
    expect(markShared).not.toHaveBeenCalled(); // nothing was posted, so the hike stays shareable
  });

  it('still counts as shared if remembering the post fails', async () => {
    const createPost = jest.fn(async () => 'post-9');
    const markShared = jest.fn(() => { throw new Error('storage full'); });
    expect(await shareHikeToFeed({ hike: hike(), user: user(), createPost, markShared })).toEqual({ ok: true, postId: 'post-9' });
  });
});

describe('hikeShareErrorText', () => {
  it('says what to do for each reason', () => {
    expect(hikeShareErrorText('signed-out')).toMatch(/Sign in/);
    expect(hikeShareErrorText('too-short')).toMatch(/too short/);
    expect(hikeShareErrorText('error')).toMatch(/Try again/);
    expect(hikeShareErrorText('something else')).toMatch(/Try again/);
  });
});
