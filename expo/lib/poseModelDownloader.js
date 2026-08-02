// lib/poseModelDownloader.js
//
// react-native-mediapipe's usePoseDetection() takes a bare model filename
// (e.g. 'pose_landmarker_lite.task') and passes it straight to native code,
// which resolves it via Swift's URL(fileURLWithPath:) - a raw file path,
// not a bundle-resource lookup, and not a file:// URI. The package's own
// example apps handle this with an Xcode "Run Script" build phase that
// downloads the .task file into the app bundle at build time - not
// something that translates to a managed Expo project without ejecting or
// a custom config plugin.
//
// This does the equivalent at runtime instead: downloads the real model
// file (same file, same public Google-hosted URL the package's own
// download scripts use) into the app's document directory on first use,
// and returns a real, raw filesystem path (file:// scheme stripped, since
// URL(fileURLWithPath:) expects a plain path, not a URI) - the exact form
// the native code expects. Cached after the first download.
//
// Targets the exact version actually installed (expo-file-system@19.0.23),
// verified directly against that version's real package contents:
//   - No File.createDownloadTask in this version - only downloadFileAsync.
//   - downloadFileAsync resolves with a plain URI string here (confirmed
//     against ios/FileSystemModule.swift: promise.resolve(destination.absoluteString)),
//     not a File object like later versions.
//   - No onProgress support in this version's DownloadOptions at all.
//
// Real, unresolved problem as of the last on-device test: MODEL_NOT_FOUND
// still fired after a genuine full reload, despite the above all being
// individually verified correct. react-native-mediapipe's own error
// handling only logs failures internally via console.error and doesn't
// expose the detector-creation error back to the calling component, so
// there's no way from here to see the *exact* path value the native
// pose-detection code actually received when it failed - only what this
// function itself resolves with. Added a real, fresh re-verification
// after download (a brand new File instance, not trusting the download
// promise's resolution alone) and now returns diagnostic info alongside
// the path so it can be shown directly in the app for the next attempt,
// rather than guessing again blind.

import { File, Paths } from 'expo-file-system';

const MODEL_FILENAME = 'pose_landmarker_lite.task';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

function toRawPath(fileUri) {
  return fileUri.startsWith('file://') ? fileUri.slice('file://'.length) : fileUri;
}

/**
 * Ensures the pose landmarker model is present on-device, downloading it
 * if necessary. Returns { path, size } - path is the real, raw local file
 * path react-native-mediapipe's native code expects; size is included so
 * the caller can display it as a concrete sanity check (a suspiciously
 * small size, e.g. under a few hundred KB, would mean the "download"
 * actually saved an error page or empty response, not a real model).
 */
export async function ensurePoseModelDownloaded() {
  let destination = new File(Paths.document, MODEL_FILENAME);

  if (!destination.exists) {
    await File.downloadFileAsync(MODEL_URL, destination, { idempotent: true });
  }

  // Real re-check, not trusting the download call's resolution alone -
  // construct a fresh File instance pointed at the same path and verify
  // it independently. If this still doesn't exist here, the failure is
  // in the download/filesystem step itself, not in react-native-mediapipe.
  const verified = new File(Paths.document, MODEL_FILENAME);
  if (!verified.exists) {
    throw new Error(`Model file does not exist after download at: ${verified.uri}`);
  }
  if (verified.size < 100000) {
    // The real pose_landmarker_lite.task is several MB; anything this
    // small is not a valid model file, likely an error response saved
    // as if it were the download.
    throw new Error(`Downloaded file is only ${verified.size} bytes at ${verified.uri} - not a valid model`);
  }

  return { path: toRawPath(verified.uri), size: verified.size };
}
