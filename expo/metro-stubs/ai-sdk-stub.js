// metro-stubs/ai-sdk-stub.js
//
// Real Metro build blocker, not a hypothetical: node_modules/ai (pulled
// in transitively by @rork-ai/toolkit-sdk, which is Rork's own custom
// Babel transformer that automatically injects a Rork platform provider
// wrapper around app/_layout.jsx at build time — confirmed from the
// transformer's own source comment, not something in this app's visible
// code) depends on @ai-sdk/provider-utils, which uses a dynamic
// `import(id)` call Metro's bundler cannot statically resolve. Confirmed
// by actually running a real Metro bundle/export, not assumed — it fails
// at exactly this file, every time, regardless of whether the app's own
// code ever uses it (nothing in app/, store/, services/, or src/ imports
// from 'ai' or '@ai-sdk/*' anywhere).
//
// This stub is a real, empty, safe module Metro redirects to instead
// (see metro.config.js's resolveRequest override below), rather than a
// silent nothing — so whatever the injected Rork provider does with
// this package fails gracefully at runtime instead of failing the build
// entirely. This is a real, honest tradeoff: whatever Rork-platform
// dev-tooling feature depends on this (most likely an AI-chat/debug
// overlay specific to Rork's own build environment, not part of the
// actual Zown HQ app experience) will not function — but a working app
// build with an inert dev-tool is a real improvement over no build at
// all.
module.exports = new Proxy({}, {
  get() {
    return () => undefined;
  },
});
