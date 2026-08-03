// plugins/withPoseDetectionThreadingPatch.js
//
// Real, documented bug class in react-native-mediapipe's own native
// source (ios/posedetection/PoseDetectionModule.swift), not a guess:
//
//   private func sendResultsEvent(handle: Int, bundle: PoseDetectionResultBundle) {
//     ...
//     self.sendEvent(withName: "onResults", body: resultArgs)
//   }
//
// PoseDetectionModule extends RCTEventEmitter, and this is called
// directly from MediaPipe's own completion delegate - which, for
// live-stream mode, fires on MediaPipe's internal processing queue,
// not the main thread (this is the documented, intentional point of
// live-stream mode: it doesn't block the calling thread). sendEvent is
// never dispatched onto any specific thread here.
//
// This is a known, documented failure class for RCTEventEmitter
// subclasses under React Native's New Architecture: see
// reactwg/react-native-new-architecture discussion #134, where calling
// sendEvent from a background thread hits RCTEventEmitter's internal
// _callableJSModules being nil - an assertion failure in debug builds,
// and event delivery silently failing in release builds, with no
// crash and no error surfaced to JS.
//
// This app is confirmed running the New Architecture: it's Expo SDK 54's
// default (docs.expo.dev/guides/new-architecture), and react-native-worklets
// - which the working, frame-counting frame processor itself depends on
// - only supports the New Architecture at all. That combination matches
// the exact on-device symptom precisely: frames climbing continuously
// (vision-camera and worklets-core are both fully New Architecture
// native, no interop layer involved), while onResults/onError stay at
// exactly zero the entire time with no error ever surfaced - not
// intermittent, structural. Also checked and ruled out separately:
// RunningMode's raw values (confirmed against Google's own official
// MediaPipeTasksVision framework reference, not assumed) and the
// orientation-string conversion both match correctly on both sides.
//
// Patches both sendEvent call sites to dispatch onto the main thread,
// the documented workaround for this exact failure class.
//
// Same defensive pattern as withPoseDetectorErrorPatch.js: an Xcode
// "Run Script" build phase, not a withDangerousMod during prebuild,
// since CocoaPods installs this file into Pods/ as its own later step -
// it doesn't exist yet when prebuild's dangerous mods run. Uses `find`
// rather than a hardcoded path, checks its own marker before patching,
// and verifies the exact expected code is present before touching
// anything - skips cleanly rather than corrupting the file if a future
// package version changes this code.

const { withXcodeProject } = require('@expo/config-plugins');

const PATCH_SCRIPT = `
FILE=$(find "\${PODS_ROOT}" -path "*react-native-mediapipe/ios/posedetection/PoseDetectionModule.swift" 2>/dev/null | head -1)
if [ -z "$FILE" ]; then
  echo "warning: PoseDetectionModule.swift not found, skipping main-thread-dispatch patch"
  exit 0
fi
python3 - "$FILE" << 'PYEOF'
import sys
path = sys.argv[1]
with open(path, 'r') as f:
    content = f.read()
marker = "already-patched-main-thread-dispatch"
if marker in content:
    print("Already patched, skipping")
    sys.exit(0)

old_error = """  private func sendErrorEvent(handle: Int, message: String, code: Int) {
    self.sendEvent(withName: "onError", body: ["handle": handle, "message": message, "code": code])
  }"""
new_error = """  private func sendErrorEvent(handle: Int, message: String, code: Int) {
    // already-patched-main-thread-dispatch
    DispatchQueue.main.async {
      self.sendEvent(withName: "onError", body: ["handle": handle, "message": message, "code": code])
    }
  }"""

old_results = """  private func sendResultsEvent(handle: Int, bundle: PoseDetectionResultBundle) {
    // Assuming convertResultBundleToDictionary exists and converts ResultBundle to a suitable dictionary
    var resultArgs = convertPdResultBundleToDictionary(bundle)
    resultArgs["handle"] = handle
    self.sendEvent(withName: "onResults", body: resultArgs)
  }"""
new_results = """  private func sendResultsEvent(handle: Int, bundle: PoseDetectionResultBundle) {
    // Assuming convertResultBundleToDictionary exists and converts ResultBundle to a suitable dictionary
    var resultArgs = convertPdResultBundleToDictionary(bundle)
    resultArgs["handle"] = handle
    DispatchQueue.main.async {
      self.sendEvent(withName: "onResults", body: resultArgs)
    }
  }"""

if old_error not in content or old_results not in content:
    print("WARNING: expected code not found, file may have changed - skipping patch")
    sys.exit(0)

content = content.replace(old_error, new_error)
content = content.replace(old_results, new_results)
with open(path, 'w') as f:
    f.write(content)
print("Patched PoseDetectionModule.swift to dispatch sendEvent onto the main thread")
PYEOF
`;

module.exports = function withPoseDetectionThreadingPatch(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const targetUuid = project.getFirstTarget().uuid;

    const result = project.addBuildPhase(
      [],
      'PBXShellScriptBuildPhase',
      'Patch MediaPipe sendEvent main-thread dispatch',
      targetUuid,
      { shellPath: '/bin/sh', shellScript: PATCH_SCRIPT }
    );

    // addBuildPhase appends to the end (after Compile Sources) - needs
    // to run before compilation, so move it to the front instead.
    const nativeTarget = project.pbxNativeTargetSection()[targetUuid];
    const phases = nativeTarget.buildPhases;
    const newPhaseIndex = phases.findIndex((p) => p.value === result.uuid);
    if (newPhaseIndex > 0) {
      const [newPhase] = phases.splice(newPhaseIndex, 1);
      phases.unshift(newPhase);
    }

    return config;
  });
};
