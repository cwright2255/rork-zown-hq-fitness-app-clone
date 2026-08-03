// plugins/withPoseDetectorErrorPatch.js
//
// Real, confirmed bug in react-native-mediapipe's own native source
// (ios/posedetection/PoseDetectorHelper.swift), not a guess:
//
//   try poseLandmarker?.detectAsync(image: image, timestampInMilliseconds: timeStamps)
//   } catch {
//     print(error)
//   }
//
// Any error from the actual per-frame detection call - including
// MediaPipe's well-documented requirement that live-stream timestamps be
// strictly increasing - is only ever print()ed to a native console the
// app has no access to. It never reaches onError, never reaches JS at
// all. Confirmed this is exactly what's happening on-device: the
// frame-processor's own frame counter climbs continuously (proving the
// camera is delivering frames and the plugin is being invoked), while
// onResults/onError both stay at zero - not intermittently, the entire
// time. That pattern is only explained by every single call to
// detectAsync throwing internally and being silently swallowed right
// here.
//
// This patches that one catch block to also route the error through
// the same liveStreamDelegate mechanism the working MODEL_NOT_FOUND
// error already proved reaches JS correctly - self.liveStreamDelegate
// is already set (helper.liveStreamDelegate = self in
// PoseDetectionModule.swift's createDetector), so this doesn't require
// wiring up anything new, just using a path that already works.
//
// Runs as an Xcode "Run Script" build phase, deliberately not a
// withDangerousMod during prebuild - CocoaPods installs
// react-native-mediapipe's source (into Pods/) later, as its own build
// step, so the file doesn't exist yet when prebuild's dangerous mods
// run. A build phase executes during the actual xcodebuild invocation,
// which is necessarily after `pod install` has completed - sidesteps
// the prebuild-vs-pod-install ordering question entirely. Inserted as
// the very first build phase so it runs before Compile Sources.
//
// Defensive by design: uses `find` rather than a hardcoded path (more
// robust to exact CocoaPods layout), checks for its own marker before
// patching (safe to run on every build without double-patching), and
// verifies the exact expected code is present before touching the file
// (skips cleanly rather than corrupting anything if a future package
// version changes this code).

const { withXcodeProject } = require('@expo/config-plugins');

const PATCH_SCRIPT = `
FILE=$(find "\${PODS_ROOT}" -path "*react-native-mediapipe/ios/posedetection/PoseDetectorHelper.swift" 2>/dev/null | head -1)
if [ -z "$FILE" ]; then
  echo "warning: PoseDetectorHelper.swift not found, skipping error-propagation patch"
  exit 0
fi
python3 - "$FILE" << 'PYEOF'
import sys
path = sys.argv[1]
with open(path, 'r') as f:
    content = f.read()
marker = "already-patched-error-propagation"
if marker in content:
    print("Already patched, skipping")
    sys.exit(0)
old = """      try poseLandmarker?.detectAsync(image: image, timestampInMilliseconds: timeStamps)
    } catch {
      print(error)
    }"""
new = """      try poseLandmarker?.detectAsync(image: image, timestampInMilliseconds: timeStamps)
    } catch {
      // already-patched-error-propagation
      print(error)
      self.liveStreamDelegate?.poseDetectorHelper(self, onResults: nil, error: error)
    }"""
if old not in content:
    print("WARNING: expected code not found, file may have changed - skipping patch")
    sys.exit(0)
content = content.replace(old, new)
with open(path, 'w') as f:
    f.write(content)
print("Patched PoseDetectorHelper.swift to propagate detectAsync errors to JS")
PYEOF
`;

module.exports = function withPoseDetectorErrorPatch(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const targetUuid = project.getFirstTarget().uuid;

    const result = project.addBuildPhase(
      [],
      'PBXShellScriptBuildPhase',
      'Patch MediaPipe error propagation',
      targetUuid,
      { shellPath: '/bin/sh', shellScript: PATCH_SCRIPT }
    );

    // addBuildPhase appends to the end of the target's build phases
    // (after Compile Sources) - this needs to run before compilation,
    // so move it to the front instead.
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
