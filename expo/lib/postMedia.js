// lib/postMedia.js
//
// Pure helpers for photo and video posts (no Firebase, no React Native, so
// they are easy to test). A post carries either up to 4 photos or one video,
// the same limits X uses. Raise MAX_PHOTOS here if you want more later; the
// Storage rules only cap file sizes, not counts.

export const MAX_PHOTOS = 4;
export const MAX_VIDEOS = 1;
export const MAX_VIDEO_SECONDS = 60;
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024; // keep in sync with storage.rules
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // keep in sync with storage.rules

const IMAGE_EXTENSIONS = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heif', webp: 'image/webp', gif: 'image/gif' };
const VIDEO_EXTENSIONS = { mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v', '3gp': 'video/3gpp', webm: 'video/webm' };

function extensionOf(uriOrName) {
  const clean = String(uriOrName || '').split('?')[0].split('#')[0];
  const match = clean.match(/\.([a-zA-Z0-9]{2,5})$/);
  return match ? match[1].toLowerCase() : '';
}

/** 'image' | 'video' | null for a picker asset (or one of our items). */
export function assetKind(asset) {
  if (!asset) return null;
  if (asset.kind === 'image' || asset.kind === 'video') return asset.kind;
  if (asset.type === 'video' || asset.type === 'pairedVideo') return 'video';
  if (asset.type === 'image' || asset.type === 'livePhoto') return 'image';
  const mime = String(asset.mimeType || '');
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  const ext = extensionOf(asset.fileName || asset.uri);
  if (VIDEO_EXTENSIONS[ext]) return 'video';
  if (IMAGE_EXTENSIONS[ext]) return 'image';
  return null;
}

export function extensionFor(item) {
  const kind = assetKind(item);
  const ext = extensionOf(item?.fileName) || extensionOf(item?.uri);
  if (kind === 'video') return VIDEO_EXTENSIONS[ext] ? ext : 'mp4';
  return IMAGE_EXTENSIONS[ext] ? ext : 'jpg';
}

export function contentTypeFor(item) {
  const kind = assetKind(item);
  const mime = String(item?.mimeType || '');
  if (kind === 'video') {
    if (mime.startsWith('video/')) return mime;
    return VIDEO_EXTENSIONS[extensionFor(item)] || 'video/mp4';
  }
  if (mime.startsWith('image/')) return mime;
  return IMAGE_EXTENSIONS[extensionFor(item)] || 'image/jpeg';
}

/** Our own small shape for a picked file. Returns null if it is not a photo or video we can post. */
export function assetToItem(asset) {
  const kind = assetKind(asset);
  if (!asset || !asset.uri || !kind) return null;
  return {
    uri: asset.uri,
    kind,
    width: Number(asset.width) > 0 ? Number(asset.width) : null,
    height: Number(asset.height) > 0 ? Number(asset.height) : null,
    durationMs: kind === 'video' && Number(asset.duration) > 0 ? Math.round(Number(asset.duration)) : null,
    fileSize: Number(asset.fileSize) > 0 ? Number(asset.fileSize) : null,
    mimeType: asset.mimeType || null,
    fileName: asset.fileName || null,
  };
}

/**
 * Adds picked files to what is already chosen, one at a time, enforcing the
 * rules. Returns { items, rejected } where rejected is a de-duplicated list of
 * plain-English reasons to show the person.
 */
export function addPicked(existing, picked) {
  const items = Array.isArray(existing) ? [...existing] : [];
  const rejected = [];
  const reject = (reason) => { if (!rejected.includes(reason)) rejected.push(reason); };

  (Array.isArray(picked) ? picked : []).forEach((raw) => {
    const item = raw && raw.kind && raw.uri && !raw.type ? raw : assetToItem(raw);
    if (!item) { if (raw) reject('That file type is not supported. Choose a photo or a video.'); return; }
    if (items.some((it) => it.uri === item.uri)) return;

    const hasVideo = items.some((it) => it.kind === 'video');
    const photoCount = items.filter((it) => it.kind === 'image').length;

    if (item.kind === 'video') {
      if (hasVideo || photoCount > 0) { reject('A post can have up to 4 photos or 1 video, not both.'); return; }
      if (item.durationMs && item.durationMs > MAX_VIDEO_SECONDS * 1000 + 500) { reject(`Videos can be up to ${MAX_VIDEO_SECONDS} seconds.`); return; }
      if (item.fileSize && item.fileSize > MAX_VIDEO_BYTES) { reject('That video is too large (100 MB max). Try a shorter clip.'); return; }
      items.push(item);
      return;
    }

    if (hasVideo) { reject('A post can have up to 4 photos or 1 video, not both.'); return; }
    if (photoCount >= MAX_PHOTOS) { reject(`You can add up to ${MAX_PHOTOS} photos per post.`); return; }
    if (item.fileSize && item.fileSize > MAX_PHOTO_BYTES) { reject('That photo is too large (15 MB max).'); return; }
    items.push(item);
  });

  return { items, rejected };
}

export function removeAt(items, index) {
  const list = Array.isArray(items) ? items : [];
  return list.filter((_, i) => i !== index);
}

/** A post needs some text or at least one photo or video. */
export function canPost(text, items) {
  return String(text || '').trim().length > 0 || (Array.isArray(items) && items.length > 0);
}

/** How many more photos can be added (0 once a video is chosen). */
export function remainingPhotos(items) {
  const list = Array.isArray(items) ? items : [];
  if (list.some((it) => it.kind === 'video')) return 0;
  return Math.max(0, MAX_PHOTOS - list.filter((it) => it.kind === 'image').length);
}

export function pickerHint(items) {
  const list = Array.isArray(items) ? items : [];
  if (list.some((it) => it.kind === 'video')) return '1 video added';
  const photos = list.filter((it) => it.kind === 'image').length;
  if (photos > 0) return `${photos}/${MAX_PHOTOS} photos`;
  return `Up to ${MAX_PHOTOS} photos or 1 video (${MAX_VIDEO_SECONDS}s)`;
}

/** 0:07, 1:00, 12:34 */
export function formatDuration(ms) {
  const total = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Where a file goes in Firebase Storage. Matches the `posts/{uid}/{postId}/{file}` rule. */
export function buildStoragePath(uid, postId, index, item) {
  return `posts/${uid}/${postId}/${index}.${extensionFor(item)}`;
}

/** What gets saved on the post document for one uploaded file (never contains undefined). */
export function toMediaDescriptor(item, url, path) {
  const kind = assetKind(item) || 'image';
  const out = { type: kind, url, path };
  if (item?.width) out.width = item.width;
  if (item?.height) out.height = item.height;
  if (kind === 'video' && item?.durationMs) out.durationMs = item.durationMs;
  return out;
}

/** The media list for a post, including older posts that only have `imageUrl`. */
export function normalizeMedia(post) {
  if (!post) return [];
  const fromList = Array.isArray(post.media)
    ? post.media.filter((m) => m && (m.type === 'image' || m.type === 'video') && typeof m.url === 'string' && /^https?:\/\//.test(m.url))
    : [];
  if (fromList.length > 0) return fromList;
  if (typeof post.imageUrl === 'string' && /^https?:\/\//.test(post.imageUrl)) {
    return [{ type: 'image', url: post.imageUrl }];
  }
  return [];
}

/** Keeps a photo or video from being absurdly tall or wide in the feed (4:5 up to 1.91:1, like Instagram). */
export function clampAspect(width, height, fallback = 4 / 3) {
  const w = Number(width);
  const h = Number(height);
  if (!(w > 0) || !(h > 0)) return fallback;
  return Math.min(1.91, Math.max(0.8, w / h));
}

/** Which photo indexes go on which row of the grid. */
export function gridRows(count) {
  if (count <= 1) return [[0]];
  if (count === 2) return [[0, 1]];
  if (count === 3) return [[0], [1, 2]];
  return [[0, 1], [2, 3]];
}

/** Short phrase for share messages, e.g. "3 photos" or "a video". */
export function mediaSummary(media) {
  const list = Array.isArray(media) ? media : [];
  if (list.length === 0) return '';
  if (list[0].type === 'video') return 'a video';
  return list.length === 1 ? 'a photo' : `${list.length} photos`;
}

// ---- Create Post screen helpers (components/PostComposer.jsx) ----

// "CW" for "Carlton Wright"; "?" when there is no name.
export function initialsFor(name) {
  const letters = String(name || '').trim().split(/\s+/).filter(Boolean).map((w) => w[0]).join('');
  return (letters || '?').slice(0, 2).toUpperCase();
}

// Upload progress (0 to 1) as a whole percent, kept between 0 and 100.
export function progressPercent(progress) {
  const p = Number(progress);
  if (!Number.isFinite(p)) return 0;
  return Math.min(100, Math.max(0, Math.round(p * 100)));
}

// The status line under the header while a post is being sent.
export function uploadLabel(items, progress) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return 'Posting…';
  return `Uploading ${progressPercent(progress)}%`;
}
