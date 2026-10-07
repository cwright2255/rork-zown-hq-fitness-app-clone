// services/postMediaService.js
//
// Picking photos and videos, and uploading them to Firebase Storage for a
// post. Only uses packages that are already in the app (expo-image-picker,
// firebase/storage), so it ships as an over-the-air update.
//
// Files go to posts/{uid}/{postId}/{n}.{ext}. storage.rules lets any signed-in
// user read them (the feed is public) and only the owner create or delete.

import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../src/config/firebase';
import {
  MAX_PHOTOS, MAX_VIDEO_SECONDS, buildStoragePath, contentTypeFor, toMediaDescriptor,
} from '../lib/postMedia';

/** Opens the photo library for photos and videos. Returns the raw picker assets ([] if cancelled). */
export async function pickFromLibrary({ selectionLimit = MAX_PHOTOS } = {}) {
  const options = {
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    selectionLimit: Math.max(1, selectionLimit),
    orderedSelection: true,
    quality: 0.8,
    videoMaxDuration: MAX_VIDEO_SECONDS,
  };
  // iOS: re-encode big videos at medium quality so uploads are smaller and faster.
  const preset = ImagePicker.VideoExportPreset && ImagePicker.VideoExportPreset.MediumQuality;
  if (preset !== undefined) options.videoExportPreset = preset;

  const result = await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return [];
  return result.assets || [];
}

/**
 * Takes a photo with the camera. Photos only: recording video from the
 * camera needs a microphone permission string that has not been checked in
 * the shipped build, so video comes from the library for now.
 * Returns { denied, assets }.
 */
export async function capturePhoto() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { denied: true, assets: [] };
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
  if (result.canceled) return { denied: false, assets: [] };
  return { denied: false, assets: result.assets || [] };
}

/**
 * Uploads picked items one after another and returns the media descriptors to
 * save on the post. onProgress gets a number from 0 to 1 across all files.
 * If anything fails, files already uploaded for this post are removed.
 */
export async function uploadPostMedia({ uid, postId, items, onProgress }) {
  const uploaded = [];
  const media = [];
  try {
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const path = buildStoragePath(uid, postId, i, item);
      const fileRef = ref(storage, path);
      const response = await fetch(item.uri);
      const blob = await response.blob();
      const task = uploadBytesResumable(fileRef, blob, {
        contentType: contentTypeFor(item),
        cacheControl: 'public,max-age=31536000',
      });
      await new Promise((resolve, reject) => {
        task.on(
          'state_changed',
          (snap) => {
            if (onProgress && snap.totalBytes > 0) onProgress((i + snap.bytesTransferred / snap.totalBytes) / items.length);
          },
          reject,
          resolve
        );
      });
      if (blob && typeof blob.close === 'function') blob.close();
      uploaded.push(fileRef);
      const url = await getDownloadURL(fileRef);
      media.push(toMediaDescriptor(item, url, path));
    }
    if (onProgress) onProgress(1);
    return media;
  } catch (e) {
    await Promise.all(uploaded.map((r) => deleteObject(r).catch(() => {})));
    throw e;
  }
}

/** Best-effort removal of a post's files (only the owner is allowed to, so other deletes quietly do nothing). */
export async function deletePostMedia(media) {
  const list = Array.isArray(media) ? media : [];
  await Promise.all(
    list
      .filter((m) => m && typeof m.path === 'string' && m.path.startsWith('posts/'))
      .map((m) => deleteObject(ref(storage, m.path)).catch(() => {}))
  );
}
