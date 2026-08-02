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
// IMPORTANT - this targets the exact version actually installed
// (expo-file-system@19.0.23), not the latest docs. Verified directly
// against that version's real package contents, not assumed from
// documentation for a newer release:
//   - No File.createDownloadTask exists in this version at all (that's
//     a later addition) - an earlier attempt at this file called it
//     anyway and threw "undefined is not a function" on-device.
//   - File.downloadFileAsync exists and works, but in this version
//     resolves with a plain URI string, not a File object - confirmed
//     directly against the native Swift source
//     (ios/FileSystemModule.swift: promise.resolve(destination.absoluteString)),
//     which even has its own "TODO: remove once returning shared objects
//     works" comment marking this as pre-File-object behavior.
//   - This version's DownloadOptions type has no onProgress field at
//     all - no progress tracking is possible here, only headers and
//     idempotent.

import { File, Paths } from 'expo-file-system';

const MODEL_FILENAME = 'pose_landmarker_lite.task';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

function toRawPath(fileUri) {
  // Whatever this resolves with (a File's .uri, or downloadFileAsync's
  // returned string) is a file:// URI; URL(fileURLWithPath:) on the
  // native side expects a plain filesystem path, not a URI with a scheme.
  return fileUri.startsWith('file://') ? fileUri.slice('file://'.length) : fileUri;
}

/**
 * Ensures the pose landmarker model is present on-device, downloading it
 * if necessary, and returns its real, raw local file path - the form
 * react-native-mediapipe's native code actually expects.
 */
export async function ensurePoseModelDownloaded() {
  const destination = new File(Paths.document, MODEL_FILENAME);

  if (destination.exists) {
    return toRawPath(destination.uri);
  }

  const resultUri = await File.downloadFileAsync(MODEL_URL, destination, { idempotent: true });
  return toRawPath(resultUri);
}
