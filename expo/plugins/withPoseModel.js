// plugins/withPoseModel.js
//
// Traced the actual crash to react-native-mediapipe's native iOS source
// (ios/posedetection/PoseDetectorHelper.swift):
//
//   let fileURL = URL(fileURLWithPath: modelName)
//   let basename = fileURL.deletingPathExtension().lastPathComponent
//   let fileExtension = fileURL.pathExtension
//   guard let modelPath = Bundle.main.path(forResource: basename, ofType: fileExtension)
//   else { throw NSError(domain: "MODEL_NOT_FOUND", ...) }
//
// This never actually checks the path string it's given - it only ever
// extracts a basename and extension from it, then looks for a resource
// with that name exclusively inside Bundle.main (the app's compiled
// bundle). No runtime-downloaded file, at any path, could ever satisfy
// this - confirmed by testing exactly that and hitting MODEL_NOT_FOUND
// despite a verified, correctly-downloaded, correctly-pathed 5.8MB file.
//
// The package's own example apps solve this with an Xcode "Run Script"
// build phase that downloads the .task file into the app bundle at
// build time. This does the Expo-managed-project equivalent: downloads
// the model during prebuild (when this plugin runs, on a machine with
// real network access, unlike the runtime device) and registers it in
// the Xcode project's actual Resources build phase - the only place
// this package's native code will ever find it.
//
// Uses the xcode package's addResourceFile directly (verified against
// its real source: lib/pbxProject.js), not @expo/config-plugins'
// higher-level IOSConfig.XcodeUtils.addResourceFileToGroup - that
// helper has a documented bug (expo/expo#20091) where the resulting
// file reference doesn't point to a real file, crashing when the app
// tries to load it. addResourceFile properly creates both the
// PBXBuildFile and PBXResourcesBuildPhase entries directly.
//
// Real fix after a real build failure: the first version of this
// plugin used config.modRequest.projectName inside withDangerousMod.
// That property is genuinely optional in @expo/config-plugins' own
// type definition (projectName?: string) - confirmed directly against
// the type declaration, not assumed - and evidently isn't reliably
// populated at the point a dangerous mod runs, causing path.join() to
// throw on undefined and crash the whole prebuild with an opaque
// "Unknown error". Switched to IOSConfig.XcodeUtils.getProjectName(),
// which derives the name by reading the actual generated project
// structure from disk rather than depending on mod-request state -
// verified against its real implementation (ios/utils/Xcodeproj.js),
// which is exactly what @expo/config-plugins' own internals use for
// the same purpose.

const { withDangerousMod, withXcodeProject, IOSConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
const https = require('https');

const MODEL_FILENAME = 'pose_landmarker_lite.task';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

function downloadFile(url, destPath, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location &&
          redirectsLeft > 0
        ) {
          response.resume();
          downloadFile(response.headers.location, destPath, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download pose model: HTTP ${response.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(destPath);
        response.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
        file.on('error', reject);
      })
      .on('error', reject);
  });
}

const withPoseModelDownload = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(config.modRequest.projectRoot);
      const iosDir = path.join(config.modRequest.platformProjectRoot, projectName);
      const destPath = path.join(iosDir, MODEL_FILENAME);

      if (fs.existsSync(destPath) && fs.statSync(destPath).size > 100000) {
        console.log(`[withPoseModel] ${MODEL_FILENAME} already present (${fs.statSync(destPath).size} bytes), skipping download`);
        return config;
      }

      console.log(`[withPoseModel] Downloading ${MODEL_FILENAME} into ${iosDir}...`);
      await downloadFile(MODEL_URL, destPath);
      const size = fs.statSync(destPath).size;
      if (size < 100000) {
        throw new Error(`[withPoseModel] Downloaded file is only ${size} bytes - not a valid model, aborting build`);
      }
      console.log(`[withPoseModel] Downloaded ${MODEL_FILENAME} (${size} bytes)`);
      return config;
    },
  ]);
};

const withPoseModelXcodeEntry = (config) => {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectName = IOSConfig.XcodeUtils.getProjectName(config.modRequest.projectRoot);
    const relativePath = `${projectName}/${MODEL_FILENAME}`;
    const targetUuid = project.getFirstTarget().uuid;

    // Real build failure, not a guess: addResourceFile unconditionally
    // runs an internal path-correction step that calls
    // project.pbxGroupByName('Resources').path - no null guard. Confirmed
    // this is a documented upstream bug (expo/expo-cli#4293): a newer
    // version of this exact file (in the standalone cordova-node-xcode
    // project) has the guard (`pbxGroupByName(group) &&
    // pbxGroupByName(group).path`), but the version bundled with Expo's
    // tooling doesn't. Expo's freshly-generated Xcode project genuinely
    // has no group literally named "Resources", so this always crashed.
    // Creating that group first - with no path property, so the
    // unrelated string-replace this same check gates never even runs -
    // makes pbxGroupByName('Resources') return a real object instead of
    // null, avoiding the crash without needing to patch the dependency.
    if (!project.pbxGroupByName('Resources')) {
      project.addPbxGroup([], 'Resources');
    }

    const result = project.addResourceFile(relativePath, { target: targetUuid });
    if (result === false) {
      console.log(`[withPoseModel] ${MODEL_FILENAME} already registered in Xcode project, skipping`);
    } else {
      console.log(`[withPoseModel] Registered ${MODEL_FILENAME} in the Resources build phase`);
    }
    return config;
  });
};

module.exports = function withPoseModel(config) {
  config = withPoseModelDownload(config);
  config = withPoseModelXcodeEntry(config);
  return config;
};
