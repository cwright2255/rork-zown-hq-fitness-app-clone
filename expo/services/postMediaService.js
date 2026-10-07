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
import { storage, auth } from '../src/config/firebase';
import {
  MAX_PHOTOS, MAX_VIDEO_SECONDS, buildStoragePath, contentTypeFor, toMediaDescriptor,
  errorCode, errorDetails, shouldRetryUpload,
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

function codedError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/** Reads a picked file into a Blob. Tries fetch first, then XMLHttpRequest; refuses empty files. */
async function uriToBlob(uri) {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    if (blob && blob.size > 0) return blob;
  } catch (e) {
    // fall through to the XMLHttpRequest route below
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      const blob = xhr.response;
      if (blob && blob.size > 0) resolve(blob);
      else reject(codedError('storage/unreadable-file', 'The selected file is empty or could not be read.'));
    };
    xhr.onerror = () => reject(codedError('storage/unreadable-file', 'The selected file could not be read.'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

/** Upload with the Firebase SDK. onFraction gets 0 to 1 for this one file. */
function uploadWithSdk(fileRef, blob, contentType, onFraction) {
  const task = uploadBytesResumable(fileRef, blob, {
    contentType,
    cacheControl: 'public,max-age=31536000',
  });
  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => { if (snap.totalBytes > 0) onFraction(snap.bytesTransferred / snap.totalBytes); },
      reject,
      resolve
    );
  });
}

/**
 * Second way to upload, used only if the SDK upload fails for a reason a retry
 * could fix: one plain HTTPS request to the Firebase Storage endpoint with the
 * user's sign-in token. The same security rules apply. Resolves with the
 * object's metadata (which includes its download token).
 */
async function uploadWithRest(fileRef, blob, contentType, onFraction) {
  const current = auth && auth.currentUser;
  if (!current) throw codedError('storage/unauthenticated', 'Not signed in.');
  const token = await current.getIdToken();
  const url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(fileRef.bucket)}/o?name=${encodeURIComponent(fileRef.fullPath)}`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Firebase ${token}`);
    xhr.setRequestHeader('Content-Type', contentType);
    if (xhr.upload) {
      xhr.upload.onprogress = (e) => { if (e && e.lengthComputable && e.total > 0) onFraction(e.loaded / e.total); };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        let meta = {};
        try { meta = JSON.parse(xhr.responseText); } catch (e) { meta = {}; }
        resolve(meta);
        return;
      }
      const code = xhr.status === 401 ? 'storage/unauthenticated' : xhr.status === 403 ? 'storage/unauthorized' : `storage/http-${xhr.status}`;
      reject(codedError(code, `HTTP ${xhr.status} ${String(xhr.responseText || '').replace(/\s+/g, ' ').slice(0, 160)}`.trim()));
    };
    xhr.onerror = () => reject(codedError('storage/network', 'Network request failed.'));
    xhr.send(blob);
  });
}

async function downloadUrlFor(fileRef, restMeta) {
  try {
    return await getDownloadURL(fileRef);
  } catch (e) {
    const tokens = restMeta && restMeta.downloadTokens ? String(restMeta.downloadTokens).split(',')[0] : '';
    if (!tokens) throw e;
    return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(fileRef.bucket)}/o/${encodeURIComponent(fileRef.fullPath)}?alt=media&token=${tokens}`;
  }
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
      const contentType = contentTypeFor(item);
      const blob = await uriToBlob(item.uri);
      const report = (fraction) => { if (onProgress) onProgress((i + Math.min(1, Math.max(0, fraction))) / items.length); };

      let restMeta = null;
      try {
        await uploadWithSdk(fileRef, blob, contentType, report);
      } catch (sdkError) {
        if (!shouldRetryUpload(sdkError)) throw sdkError;
        console.warn('[postMedia] SDK upload failed, trying direct upload:', errorCode(sdkError), sdkError && sdkError.message);
        try {
          restMeta = await uploadWithRest(fileRef, blob, contentType, report);
        } catch (restError) {
          throw codedError(errorCode(sdkError) || errorCode(restError), `${errorDetails(sdkError, 140)} | retry: ${errorDetails(restError, 140)}`);
        }
      }
      if (blob && typeof blob.close === 'function') blob.close();
      uploaded.push(fileRef);
      const url = await downloadUrlFor(fileRef, restMeta);
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
