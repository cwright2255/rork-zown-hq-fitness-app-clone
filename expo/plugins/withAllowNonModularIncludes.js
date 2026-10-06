// plugins/withAllowNonModularIncludes.js
//
// The app builds iOS pods as static FRAMEWORKS (needed by Firebase
// Crashlytics). Some React Native libraries (react-native-vision-camera, etc.)
// include React-Core headers from inside their framework module, which Xcode
// treats as an error:
//   include of non-modular header inside framework module ...
//   [-Werror,-Wnon-modular-include-in-framework-module]
//
// This is the standard, widely used workaround: allow non-modular includes in
// framework modules for every pod target. It runs in the Podfile post_install
// step, is idempotent, and only sets one build setting.

const { withPodfile } = require('@expo/config-plugins');

const MARKER = '# zown-allow-non-modular-includes';

const RUBY_SNIPPET = `    ${MARKER}
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |c|
        c.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
`;

function patchPodfile(contents) {
  if (contents.includes(MARKER)) return contents;
  const hook = /post_install do \|installer\|\n/;
  if (!hook.test(contents)) {
    throw new Error('withAllowNonModularIncludes: could not find "post_install do |installer|" in the Podfile');
  }
  return contents.replace(hook, (m) => m + RUBY_SNIPPET);
}

module.exports = function withAllowNonModularIncludes(config) {
  return withPodfile(config, (cfg) => {
    cfg.modResults.contents = patchPodfile(cfg.modResults.contents);
    return cfg;
  });
};

module.exports.patchPodfile = patchPodfile;
