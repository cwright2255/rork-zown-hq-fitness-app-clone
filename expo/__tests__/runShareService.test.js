import { shareRunToFeed, shareErrorText } from '../services/runShare';

const START = new Date(2026, 9, 8, 7, 5, 0).toISOString();
const run = (extra = {}) => ({
  id: 'run-1', uid: 'u1', startTime: START, distance: 5.234, duration: 1610, calories: 366,
  track: Array.from({ length: 41 }, (_, i) => [40 + i * 0.001, -74]).flat(),
  ...extra,
});
const user = (extra = {}) => ({ uid: 'u1', name: 'Cj', displayName: 'Cj W', profileImage: 'https://img/p.png', ...extra });

let warn;
beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => warn.mockRestore());

describe('shareRunToFeed', () => {
  it('posts the run as a run card and remembers the post on the run', async () => {
    const createPost = jest.fn(async () => 'post-1');
    const markShared = jest.fn();
    const result = await shareRunToFeed({ run: run(), user: user(), createPost, markShared });

    expect(result).toEqual({ ok: true, postId: 'post-1' });
    expect(createPost).toHaveBeenCalledTimes(1);
    const args = createPost.mock.calls[0][0];
    expect(args).toMatchObject({
      uid: 'u1',
      authorName: 'Cj W',
      authorAvatar: 'https://img/p.png',
      type: 'run',
      text: 'Morning Run: 5.23 km in 26:50 \uD83D\uDCAA',
    });
    expect(args.run).toMatchObject({ v: 1, activity: 'run', distance: 5.23, duration: 1610, calories: 366 });
    expect(args.run.route.length).toBeGreaterThan(0);
    expect(markShared).toHaveBeenCalledWith('u1', 'run-1', 'post-1');
  });

  it('names the author from the display name, then the name, then "Zown User"', async () => {
    const make = () => jest.fn(async () => 'p');
    let createPost = make();
    await shareRunToFeed({ run: run(), user: user({ displayName: undefined }), createPost });
    expect(createPost.mock.calls[0][0].authorName).toBe('Cj');
    createPost = make();
    await shareRunToFeed({ run: run(), user: { uid: 'u1' }, createPost });
    expect(createPost.mock.calls[0][0].authorName).toBe('Zown User');
  });

  it('does not post a run that was already shared', async () => {
    const createPost = jest.fn();
    const result = await shareRunToFeed({ run: run({ sharedPostId: 'old' }), user: user(), createPost });
    expect(result).toEqual({ ok: false, reason: 'already-shared', postId: 'old' });
    expect(createPost).not.toHaveBeenCalled();
  });

  it('needs a run and a signed-in user', async () => {
    const createPost = jest.fn();
    expect(await shareRunToFeed({ user: user(), createPost })).toEqual({ ok: false, reason: 'no-run' });
    expect(await shareRunToFeed({ run: run(), user: null, createPost })).toEqual({ ok: false, reason: 'signed-out' });
    expect(await shareRunToFeed({ run: run(), user: {}, createPost })).toEqual({ ok: false, reason: 'signed-out' });
    expect(await shareRunToFeed()).toEqual({ ok: false, reason: 'no-run' });
    expect(createPost).not.toHaveBeenCalled();
  });

  it('does not post a run too short to mean anything', async () => {
    const createPost = jest.fn();
    const result = await shareRunToFeed({ run: run({ distance: 0.001 }), user: user(), createPost });
    expect(result).toEqual({ ok: false, reason: 'too-short' });
    expect(createPost).not.toHaveBeenCalled();
  });

  it('reports an error, without throwing, when the post could not be made', async () => {
    const markShared = jest.fn();
    const failing = jest.fn(async () => { throw new Error('offline'); });
    expect(await shareRunToFeed({ run: run(), user: user(), createPost: failing, markShared })).toEqual({ ok: false, reason: 'error' });
    const empty = jest.fn(async () => null);
    expect(await shareRunToFeed({ run: run(), user: user(), createPost: empty, markShared })).toEqual({ ok: false, reason: 'error' });
    expect(markShared).not.toHaveBeenCalled(); // nothing was posted, so the run stays shareable
  });

  it('still counts as shared if remembering the post fails', async () => {
    const createPost = jest.fn(async () => 'post-9');
    const markShared = jest.fn(() => { throw new Error('storage full'); });
    expect(await shareRunToFeed({ run: run(), user: user(), createPost, markShared })).toEqual({ ok: true, postId: 'post-9' });
  });

  it('works without a way to remember the post', async () => {
    const createPost = jest.fn(async () => 'post-2');
    expect(await shareRunToFeed({ run: run(), user: user(), createPost })).toEqual({ ok: true, postId: 'post-2' });
  });
});

describe('shareErrorText', () => {
  it('says what to do about each problem', () => {
    expect(shareErrorText('signed-out')).toBe('Sign in to share your run.');
    expect(shareErrorText('too-short')).toBe('This run is too short to share.');
    expect(shareErrorText('error')).toBe('Could not share your run. Try again in a moment.');
    expect(shareErrorText(undefined)).toBe('Could not share your run. Try again in a moment.');
  });
});
