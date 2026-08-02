// lib/poseModelDownloader.js
//
// react-native-mediapipe's usePoseDetection() takes a bare model filename
// (e.g. 'pose_landmarker_lite.task') and passes it straight to native code,
// which resolves it via Swift's URL(fileURLWithPath:) - a raw file path,
// not a bundle-resource lookup. The package's own example apps handle this
// with an Xcode "Run Script" build phase that downloads the .task file into
// the app bundle at build time - not something that translates to a
// managed Expo project without ejecting or a custom config plugin.
//
// This does the equivalent at runtime instead: downloads the real model
// file (same file, same public Google-hosted URL the package's own
// download scripts use) into the app's document directory on first use,
// and returns the real absolute path on-device - which is exactly what
// URL(fileURLWithPath:) expects. Cached after the first download, so this
// only touches the network once per install.

import * as FileSystem from 'expo-file-system';

const MODEL_FILENAME = 'pose_landmarker_lite.task';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

/**
 * Ensures the pose landmarker model is present on-device, downloading it
 * if necessary, and returns its real, absolute local file path - the form
 * react-native-mediapipe's native code actually expects.
 */
export async function ensurePoseModelDownloaded(onProgress) {
  const localPath = `${FileSystem.documentDirectory}${MODEL_FILENAME}`;

  const info = await FileSystem.getInfoAsync(localPath);
  if (info.exists && info.size > 0) {
    return localPath;
  }

  const downloadResumable = FileSystem.createDownloadResumable(
    MODEL_URL,
    localPath,
    {},
    onProgress
      ? (progress) => {
          const fraction =
            progress.totalBytesExpectedToWrite > 0
              ? progress.totalBytesWritten / progress.totalBytesExpectedToWrite
              : 0;
          onProgress(fraction);
        }
      : undefined
  );

  const result = await downloadResumable.downloadAsync();
  if (!result || !result.uri) {
    throw new Error('Pose model download did not complete');
  }
  return result.uri;
}
