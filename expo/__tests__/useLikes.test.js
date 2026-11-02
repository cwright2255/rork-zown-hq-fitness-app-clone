// The heart on a post (hooks/useLikes.js): it flips at once, a double tap is one like, and the number does not lag behind the heart
// while the Cloud Function that moves the real count catches up.
import { act, renderHook } from '@testing-library/react-native';
import { useLikes, shownLikeCount, OWN_CHANGE_MS } from '../hooks/useLikes';

const post = (extra = {}) => ({ id: 'p1', likeCount: 3, ...extra });

/** A toggleLike whose answer the test lets through when it likes. */
function slowToggle(answer = true) {
  const pending = [];
  const fn = jest.fn(() => new Promise((resolve) => { pending.push(() => resolve(answer)); }));
  fn.finish = async () => { await act(async () => { pending.splice(0).forEach((f) => f()); }); };
  return fn;
}

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

describe('shownLikeCount', () => {
  it('is the real count when this phone has changed nothing', () => {
    expect(shownLikeCount(3, undefined)).toBe(3);
    expect(shownLikeCount(undefined, undefined)).toBe(0);
    expect(shownLikeCount('4', undefined)).toBe(4);
  });

  it('adds this phone\'s own like or unlike to the count it saw', () => {
    expect(shownLikeCount(3, { base: 3, change: 1 })).toBe(4);
    expect(shownLikeCount(3, { base: 3, change: -1 })).toBe(2);
  });

  it('shows the real count once it has moved, so the number is not counted twice', () => {
    expect(shownLikeCount(4, { base: 3, change: 1 })).toBe(4);
  });

  it('never shows less than zero', () => {
    expect(shownLikeCount(0, { base: 0, change: -1 })).toBe(0);
  });
});

describe('useLikes', () => {
  it('flips the heart and the number at once, before the like is written', async () => {
    const toggleLike = slowToggle(true);
    const { result } = renderHook(() => useLikes({ uid: 'u1', toggleLike }));
    let tapped;
    act(() => { tapped = result.current.handleLike(post()); });
    expect(result.current.likedByMe.p1).toBe(true);
    expect(result.current.likeCountOf(post())).toBe(4);
    expect(toggleLike).toHaveBeenCalledWith('p1', 'u1');
    await toggleLike.finish();
    await tapped;
    expect(result.current.likedByMe.p1).toBe(true);
    expect(result.current.likeCountOf(post())).toBe(4);
  });

  it('makes a double tap one like: the second tap, made while the first is being written, is ignored', async () => {
    const toggleLike = slowToggle(true);
    const { result } = renderHook(() => useLikes({ uid: 'u1', toggleLike }));
    let first;
    let second;
    act(() => { first = result.current.handleLike(post()); });
    act(() => { second = result.current.handleLike(post()); });
    expect(toggleLike).toHaveBeenCalledTimes(1);
    await toggleLike.finish();
    await first;
    await second;
    expect(result.current.likedByMe.p1).toBe(true);
    expect(result.current.likeCountOf(post())).toBe(4); // up by one, not two and not back to three
  });

  it('lets a later tap take the like back, and shows the number go back down', async () => {
    const toggleLike = jest.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const { result } = renderHook(() => useLikes({ uid: 'u1', toggleLike }));
    await act(async () => { await result.current.handleLike(post()); });
    expect(result.current.likeCountOf(post())).toBe(4);
    await act(async () => { await result.current.handleLike(post()); });
    expect(result.current.likedByMe.p1).toBe(false);
    expect(result.current.likeCountOf(post())).toBe(3);
  });

  it('puts the heart and the number back when the like could not be written', async () => {
    const toggleLike = jest.fn().mockResolvedValue(null);
    const { result } = renderHook(() => useLikes({ uid: 'u1', toggleLike }));
    await act(async () => { await result.current.handleLike(post()); });
    expect(result.current.likedByMe.p1).toBe(false);
    expect(result.current.likeCountOf(post())).toBe(3);
  });

  it('shows what really happened when the post was already liked and the heart had not loaded', async () => {
    const toggleLike = jest.fn().mockResolvedValue(false); // it was liked: this tap took it back
    const { result } = renderHook(() => useLikes({ uid: 'u1', toggleLike }));
    await act(async () => { await result.current.handleLike(post()); });
    expect(result.current.likedByMe.p1).toBe(false);
    expect(result.current.likeCountOf(post())).toBe(2);
  });

  it('takes an unlike of a post it knew was liked down by one', async () => {
    const toggleLike = jest.fn().mockResolvedValue(false);
    const { result } = renderHook(() => useLikes({ uid: 'u1', toggleLike }));
    act(() => { result.current.setLikedByMe({ p1: true }); });
    await act(async () => { await result.current.handleLike(post()); });
    expect(result.current.likedByMe.p1).toBe(false);
    expect(result.current.likeCountOf(post())).toBe(2);
  });

  it('shows the real count when it moves, rather than adding the like twice', async () => {
    const toggleLike = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useLikes({ uid: 'u1', toggleLike }));
    await act(async () => { await result.current.handleLike(post()); });
    expect(result.current.likeCountOf(post({ likeCount: 3 }))).toBe(4); // the function has not run yet
    expect(result.current.likeCountOf(post({ likeCount: 4 }))).toBe(4); // it has: the real count
  });

  it('stops adding its own like after a few seconds if the real count never moves', async () => {
    const toggleLike = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useLikes({ uid: 'u1', toggleLike }));
    await act(async () => { await result.current.handleLike(post()); });
    expect(result.current.likeCountOf(post())).toBe(4);
    act(() => { jest.advanceTimersByTime(OWN_CHANGE_MS + 1); });
    expect(result.current.likeCountOf(post())).toBe(3);
  });

  it('keeps each post\'s heart and number to itself', async () => {
    const toggleLike = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useLikes({ uid: 'u1', toggleLike }));
    await act(async () => { await result.current.handleLike(post({ id: 'p1' })); });
    expect(result.current.likedByMe.p2).toBeUndefined();
    expect(result.current.likeCountOf(post({ id: 'p2', likeCount: 7 }))).toBe(7);
  });

  it('does nothing without a signed-in person', async () => {
    const toggleLike = jest.fn();
    const { result } = renderHook(() => useLikes({ uid: undefined, toggleLike }));
    await act(async () => { await result.current.handleLike(post()); });
    expect(toggleLike).not.toHaveBeenCalled();
    expect(result.current.likedByMe).toEqual({});
  });

  it('can take a tap again once the last one is done, even when it failed', async () => {
    const toggleLike = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(true);
    const { result } = renderHook(() => useLikes({ uid: 'u1', toggleLike }));
    await act(async () => { await result.current.handleLike(post()); });
    await act(async () => { await result.current.handleLike(post()); });
    expect(toggleLike).toHaveBeenCalledTimes(2);
    expect(result.current.likedByMe.p1).toBe(true);
  });

  it('survives the screen closing while a like is being written: nothing is held or started afterwards', async () => {
    const toggleLike = slowToggle(true);
    const held = () => setTimeout.mock.calls.filter(([, ms]) => ms === OWN_CHANGE_MS).length;
    jest.spyOn(global, 'setTimeout');
    const { result, unmount } = renderHook(() => useLikes({ uid: 'u1', toggleLike }));
    act(() => { result.current.handleLike(post()); });
    expect(held()).toBe(1); // the number is held while the like is written
    unmount();
    await toggleLike.finish();
    expect(held()).toBe(1); // finishing after the screen closed holds nothing more
    setTimeout.mockRestore();
  });
});
