// plugins/withMediaPipeFrameworkHeaderPatch.js
//
// Needed because the app builds its iOS pods as static FRAMEWORKS (required
// by Firebase Crashlytics via expo-build-properties' useFrameworks).
//
// react-native-mediapipe's three Objective-C frame-processor files do:
//
//   #import "ReactNativeMediaPipe-Swift.h"
//
// That quoted form only resolves when the pod is built as a plain static
// library. Built as a framework, Xcode places the generated Swift header
// inside the framework, so the import must be namespaced:
//
//   #import <ReactNativeMediaPipe/ReactNativeMediaPipe-Swift.h>
//
// Without this the build fails with
//   'ReactNativeMediaPipe-Swift.h' file not found
//
// This adds a snippet to the Podfile's post_install step (which runs after
// CocoaPods has laid out the pods and before Xcode compiles anything) that
// rewrites that one import line in the package's own source. It is
// idempotent (a no-op once rewritten) and only touches that exact line.

const { withPodfile } = require('@expo/config-plugins');

const MARKER = '# zown-mediapipe-swift-header-patch';

const RUBY_SNIPPET = `    ${MARKER}
    begin
      mp_dir = installer.sandbox.pod_dir('ReactNativeMediaPipe').to_s
      Dir.glob(File.join(mp_dir, 'ios', '**', '*.m')).each do |f|
        src = File.read(f)
        patched = src.gsub('#import "ReactNativeMediaPipe-Swift.h"', '#import <ReactNativeMediaPipe/ReactNativeMediaPipe-Swift.h>')
        File.write(f, patched) if patched != src
      end
    rescue => e
      Pod::UI.warn "[zown] MediaPipe Swift header patch skipped: #{e.message}"
    end
`;

function patchPodfile(contents) {
  if (contents.includes(MARKER)) return contents; // already patched
  const hook = /post_install do \|installer\|\n/;
  if (!hook.test(contents)) {
    throw new Error('withMediaPipeFrameworkHeaderPatch: could not find "post_install do |installer|" in the Podfile');
  }
  return contents.replace(hook, (m) => m + RUBY_SNIPPET);
}

module.exports = function withMediaPipeFrameworkHeaderPatch(config) {
  return withPodfile(config, (cfg) => {
    cfg.modResults.contents = patchPodfile(cfg.modResults.contents);
    return cfg;
  });
};

module.exports.patchPodfile = patchPodfile;
