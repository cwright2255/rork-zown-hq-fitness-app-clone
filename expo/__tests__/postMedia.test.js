import {
  MAX_PHOTOS, MAX_VIDEO_SECONDS, MAX_PHOTO_BYTES, MAX_VIDEO_BYTES,
  assetKind, assetToItem, addPicked, removeAt, canPost, remainingPhotos, pickerHint,
  formatDuration, buildStoragePath, contentTypeFor, extensionFor, toMediaDescriptor,
  normalizeMedia, clampAspect, gridRows, mediaSummary, initialsFor, progressPercent, uploadLabel,
  errorCode, shouldRetryUpload, errorDetails, postErrorMessage,
} from '../lib/postMedia';

const photo = (n, extra = {}) => ({ uri: `file:///tmp/p${n}.jpg`, type: 'image', width: 1200, height: 900, fileSize: 2_000_000, ...extra });
const video = (n, extra = {}) => ({ uri: `file:///tmp/v${n}.mov`, type: 'video', width: 1080, height: 1920, duration: 12_000, fileSize: 20_000_000, ...extra });

describe('assetKind / assetToItem', () => {
  it('reads the picker type first', () => {
    expect(assetKind({ type: 'image' })).toBe('image');
    expect(assetKind({ type: 'video' })).toBe('video');
    expect(assetKind({ type: 'livePhoto' })).toBe('image');
  });
  it('falls back to mime type and file extension', () => {
    expect(assetKind({ mimeType: 'video/mp4' })).toBe('video');
    expect(assetKind({ uri: 'file:///a/b/clip.MOV' })).toBe('video');
    expect(assetKind({ uri: 'file:///a/b/pic.heic' })).toBe('image');
    expect(assetKind({ uri: 'file:///a/b/notes.txt' })).toBe(null);
    expect(assetKind(null)).toBe(null);
  });
  it('maps an asset to our shape and rejects ones without a uri or a known kind', () => {
    expect(assetToItem(video(1))).toMatchObject({ kind: 'video', durationMs: 12000, width: 1080, height: 1920 });
    expect(assetToItem(photo(1))).toMatchObject({ kind: 'image', durationMs: null });
    expect(assetToItem({ type: 'image' })).toBe(null);
    expect(assetToItem({ uri: 'file:///x.txt' })).toBe(null);
  });
});

describe('addPicked', () => {
  it('adds photos up to the limit and explains what it left out', () => {
    const picked = Array.from({ length: MAX_PHOTOS + 2 }, (_, i) => photo(i));
    const { items, rejected } = addPicked([], picked);
    expect(items).toHaveLength(MAX_PHOTOS);
    expect(rejected).toEqual([`You can add up to ${MAX_PHOTOS} photos per post.`]);
  });

  it('adds one video', () => {
    const { items, rejected } = addPicked([], [video(1)]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('video');
    expect(rejected).toEqual([]);
  });

  it('does not mix photos and a video, whichever comes first wins', () => {
    const a = addPicked([], [photo(1), video(1)]);
    expect(a.items.map((i) => i.kind)).toEqual(['image']);
    expect(a.rejected[0]).toMatch(/not both/);

    const b = addPicked([], [video(1), photo(1)]);
    expect(b.items.map((i) => i.kind)).toEqual(['video']);
    expect(b.rejected[0]).toMatch(/not both/);
  });

  it('refuses a second video', () => {
    const first = addPicked([], [video(1)]).items;
    const { items, rejected } = addPicked(first, [video(2)]);
    expect(items).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it('refuses videos that are too long or too big', () => {
    const long = addPicked([], [video(1, { duration: (MAX_VIDEO_SECONDS + 5) * 1000 })]);
    expect(long.items).toHaveLength(0);
    expect(long.rejected[0]).toMatch(/60 seconds/);

    const exactlyLimit = addPicked([], [video(2, { duration: MAX_VIDEO_SECONDS * 1000 })]);
    expect(exactlyLimit.items).toHaveLength(1);

    const big = addPicked([], [video(3, { fileSize: MAX_VIDEO_BYTES + 1 })]);
    expect(big.items).toHaveLength(0);
    expect(big.rejected[0]).toMatch(/too large/);
  });

  it('refuses photos that are too big, and unsupported files', () => {
    const big = addPicked([], [photo(1, { fileSize: MAX_PHOTO_BYTES + 1 })]);
    expect(big.items).toHaveLength(0);
    expect(big.rejected[0]).toMatch(/too large/);

    const bad = addPicked([], [{ uri: 'file:///a.txt' }]);
    expect(bad.items).toHaveLength(0);
    expect(bad.rejected[0]).toMatch(/not supported/);
  });

  it('ignores the same file picked twice and keeps what was already chosen', () => {
    const first = addPicked([], [photo(1)]).items;
    const again = addPicked(first, [photo(1), photo(2)]);
    expect(again.items.map((i) => i.uri)).toEqual(['file:///tmp/p1.jpg', 'file:///tmp/p2.jpg']);
    expect(again.rejected).toEqual([]);
  });

  it('accepts items that are already in our shape', () => {
    const items = addPicked([], [photo(1)]).items;
    const { items: next } = addPicked(items, items);
    expect(next).toHaveLength(1);
  });
});

describe('small helpers', () => {
  it('removeAt', () => {
    expect(removeAt([1, 2, 3], 1)).toEqual([1, 3]);
    expect(removeAt(null, 0)).toEqual([]);
  });

  it('canPost needs text or media', () => {
    expect(canPost('', [])).toBe(false);
    expect(canPost('   ', [])).toBe(false);
    expect(canPost('hi', [])).toBe(true);
    expect(canPost('', [{ uri: 'x' }])).toBe(true);
    expect(canPost(undefined, undefined)).toBe(false);
  });

  it('remainingPhotos and pickerHint follow what is chosen', () => {
    expect(remainingPhotos([])).toBe(MAX_PHOTOS);
    const two = addPicked([], [photo(1), photo(2)]).items;
    expect(remainingPhotos(two)).toBe(MAX_PHOTOS - 2);
    expect(pickerHint(two)).toBe(`2/${MAX_PHOTOS} photos`);
    const vid = addPicked([], [video(1)]).items;
    expect(remainingPhotos(vid)).toBe(0);
    expect(pickerHint(vid)).toBe('1 video added');
    expect(pickerHint([])).toMatch(/Up to 4 photos or 1 video/);
  });

  it('formatDuration', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(7400)).toBe('0:07');
    expect(formatDuration(60000)).toBe('1:00');
    expect(formatDuration(754000)).toBe('12:34');
    expect(formatDuration(undefined)).toBe('0:00');
  });

  it('clampAspect keeps media between 4:5 and 1.91:1', () => {
    expect(clampAspect(1000, 2000)).toBe(0.8);
    expect(clampAspect(4000, 1000)).toBe(1.91);
    expect(clampAspect(1200, 900)).toBeCloseTo(4 / 3, 5);
    expect(clampAspect(null, null)).toBeCloseTo(4 / 3, 5);
    expect(clampAspect(0, 10, 1)).toBe(1);
  });

  it('gridRows lays out 1 to 4 photos', () => {
    expect(gridRows(1)).toEqual([[0]]);
    expect(gridRows(2)).toEqual([[0, 1]]);
    expect(gridRows(3)).toEqual([[0], [1, 2]]);
    expect(gridRows(4)).toEqual([[0, 1], [2, 3]]);
  });

  it('mediaSummary reads naturally', () => {
    expect(mediaSummary([])).toBe('');
    expect(mediaSummary([{ type: 'image' }])).toBe('a photo');
    expect(mediaSummary([{ type: 'image' }, { type: 'image' }, { type: 'image' }])).toBe('3 photos');
    expect(mediaSummary([{ type: 'video' }])).toBe('a video');
  });
});

describe('storage paths and descriptors', () => {
  it('builds the path the Storage rule allows (posts/{uid}/{postId}/{n}.{ext})', () => {
    const item = assetToItem(photo(1));
    expect(buildStoragePath('u1', 'p9', 0, item)).toBe('posts/u1/p9/0.jpg');
    expect(buildStoragePath('u1', 'p9', 1, assetToItem(video(1)))).toBe('posts/u1/p9/1.mov');
  });

  it('picks sensible extensions and content types', () => {
    expect(extensionFor({ kind: 'image', uri: 'file:///a/b' })).toBe('jpg');
    expect(extensionFor({ kind: 'video', uri: 'file:///a/b' })).toBe('mp4');
    expect(contentTypeFor({ kind: 'video', uri: 'file:///a/b.mov' })).toBe('video/quicktime');
    expect(contentTypeFor({ kind: 'image', uri: 'file:///a/b.png' })).toBe('image/png');
    expect(contentTypeFor({ kind: 'image', uri: 'file:///a/b.jpg', mimeType: 'image/heic' })).toBe('image/heic');
    expect(contentTypeFor({ kind: 'video', uri: 'file:///a/b.weird' })).toBe('video/mp4');
  });

  it('descriptors never contain undefined values (Firestore rejects them)', () => {
    const d = toMediaDescriptor(assetToItem(video(1)), 'https://x/y', 'posts/u/p/0.mov');
    expect(d).toEqual({ type: 'video', url: 'https://x/y', path: 'posts/u/p/0.mov', width: 1080, height: 1920, durationMs: 12000 });
    const bare = toMediaDescriptor({ kind: 'image', uri: 'file:///a.jpg' }, 'https://x/z', 'posts/u/p/0.jpg');
    expect(bare).toEqual({ type: 'image', url: 'https://x/z', path: 'posts/u/p/0.jpg' });
    Object.values(d).concat(Object.values(bare)).forEach((v) => expect(v).not.toBeUndefined());
  });
});

describe('normalizeMedia', () => {
  it('uses the media list when present', () => {
    const media = [{ type: 'image', url: 'https://a/1.jpg' }, { type: 'image', url: 'https://a/2.jpg' }];
    expect(normalizeMedia({ media, imageUrl: 'https://old' })).toEqual(media);
  });
  it('falls back to the older imageUrl field', () => {
    expect(normalizeMedia({ imageUrl: 'https://a/1.jpg' })).toEqual([{ type: 'image', url: 'https://a/1.jpg' }]);
  });
  it('drops bad entries and non-http urls', () => {
    expect(normalizeMedia({ media: [{ type: 'gif', url: 'https://a' }, { type: 'image', url: 'file:///x' }, null] })).toEqual([]);
    expect(normalizeMedia({ imageUrl: 'file:///x.jpg' })).toEqual([]);
    expect(normalizeMedia(null)).toEqual([]);
    expect(normalizeMedia({})).toEqual([]);
  });
});

describe('Create Post screen helpers', () => {
  it('initialsFor', () => {
    expect(initialsFor('Carlton Wright')).toBe('CW');
    expect(initialsFor('  carlton   v   wright ')).toBe('CV');
    expect(initialsFor('Madonna')).toBe('M');
    expect(initialsFor('')).toBe('?');
    expect(initialsFor(null)).toBe('?');
  });

  it('progressPercent keeps the value between 0 and 100', () => {
    expect(progressPercent(0)).toBe(0);
    expect(progressPercent(0.426)).toBe(43);
    expect(progressPercent(1)).toBe(100);
    expect(progressPercent(1.7)).toBe(100);
    expect(progressPercent(-0.2)).toBe(0);
    expect(progressPercent(undefined)).toBe(0);
    expect(progressPercent(NaN)).toBe(0);
  });

  it('uploadLabel says Posting for text only and a percent when media is uploading', () => {
    expect(uploadLabel([], 0.5)).toBe('Posting…');
    expect(uploadLabel(undefined, 0.5)).toBe('Posting…');
    expect(uploadLabel([{ uri: 'x' }], 0.426)).toBe('Uploading 43%');
    expect(uploadLabel([{ uri: 'x' }], 0)).toBe('Uploading 0%');
  });
});

describe('upload errors', () => {
  const fbError = (code, message, serverResponse) => Object.assign(new Error(message), { code, customData: serverResponse ? { serverResponse } : undefined });

  it('errorCode reads Firebase codes', () => {
    expect(errorCode(fbError('storage/unknown', 'x'))).toBe('storage/unknown');
    expect(errorCode(new Error('plain'))).toBe('');
    expect(errorCode(null)).toBe('');
    expect(errorCode({ customData: { code: 'storage/retry-limit-exceeded' } })).toBe('storage/retry-limit-exceeded');
  });

  it('shouldRetryUpload skips errors a second try cannot fix', () => {
    expect(shouldRetryUpload(fbError('storage/unauthorized', 'x'))).toBe(false);
    expect(shouldRetryUpload(fbError('storage/unauthenticated', 'x'))).toBe(false);
    expect(shouldRetryUpload(fbError('storage/canceled', 'x'))).toBe(false);
    expect(shouldRetryUpload(fbError('storage/unknown', 'x'))).toBe(true);
    expect(shouldRetryUpload(new Error('Network request failed'))).toBe(true);
  });

  it('errorDetails is one short line with the code and the server reply', () => {
    expect(errorDetails(fbError('storage/unknown', 'Firebase Storage: unknown', '{\n "error": "x" }'))).toBe('storage/unknown: Firebase Storage: unknown (server: { "error": "x" })');
    expect(errorDetails(new Error('boom'))).toBe('boom');
    expect(errorDetails(null)).toBe('');
    expect(errorDetails(new Error('x'.repeat(500)), 50)).toHaveLength(50);
  });

  it('postErrorMessage explains the likely cause and keeps the details', () => {
    const denied = postErrorMessage(fbError('storage/unauthorized', 'denied'), true);
    expect(denied).toMatch(/Couldn't upload your post/);
    expect(denied).toMatch(/settings problem/);
    expect(denied).toMatch(/storage\/unauthorized: denied/);
    expect(postErrorMessage(fbError('permission-denied', 'Missing permissions'), false)).toMatch(/Couldn't post right now.*settings problem/);
    expect(postErrorMessage(fbError('storage/unauthenticated', 'x'), true)).toMatch(/sign back in/);
    expect(postErrorMessage(new Error('Network request failed'), true)).toMatch(/Check your connection/);
    expect(postErrorMessage(undefined, false)).toBe("Couldn't post right now. Check your connection and try again.");
  });
});
