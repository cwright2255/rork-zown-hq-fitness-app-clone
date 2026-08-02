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
// Uses the current, class-based expo-file-system API (File/Directory/
// Paths), not the deprecated function-based one (getInfoAsync,
// createDownloadResumable, etc.) - those throw at runtime as of the
// version installed in this app, confirmed directly against the official
// docs at docs.expo.dev/versions/latest/sdk/filesystem.

import { File, Paths } from 'expo-file-system';

const MODEL_FILENAME = 'pose_landmarker_lite.task';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

function toRawPath(fileUri) {
  // File.uri is a file:// URI; URL(fileURLWithPath:) on the native side
  // expects a plain filesystem path, not a URI with a scheme.
  return fileUri.startsWith('file://') ? fileUri.slice('file://'.length) : fileUri;
}

/**
 * Ensures the pose landmarker model is present on-device, downloading it
 * if necessary, and returns its real, raw local file path - the form
 * react-native-mediapipe's native code actually expects.
 */
export async function ensurePoseModelDownloaded(onProgress) {
  const destination = new File(Paths.document, MODEL_FILENAME);

  if (destination.exists) {
    return toRawPath(destination.uri);
  }

  const task = File.createDownloadTask(MODEL_URL, destination, {
    onProgress: onProgress
      ? ({ bytesWritten, totalBytes }) => {
          if (totalBytes > 0) onProgress(bytesWritten / totalBytes);
        }
      : undefined,
  });

  const downloadedFile = await task.downloadAsync();
  if (!downloadedFile || !downloadedFile.exists) {
    throw new Error('Pose model download did not complete');
  }
  return toRawPath(downloadedFile.uri);
}
