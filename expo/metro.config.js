const path = require('path');
const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

config.watchFolders = [path.resolve(__dirname, '..')];
config.resolver = {
  ...(config.resolver || {}),
  nodeModulesPaths: [
    path.resolve(__dirname, 'node_modules'),
    path.resolve(__dirname, '..', 'node_modules'),
  ],
};

const rorkConfig = withRorkMetro(config);

// Real, confirmed Metro build blocker: 'ai' (pulled in transitively by
// @rork-ai/toolkit-sdk's own auto-injected provider wrapper, not by any
// code in this app) depends on @ai-sdk/provider-utils, which uses a
// dynamic import() Metro cannot statically resolve, confirmed by
// actually running a real bundle/export. Nothing in this app's own code
// imports 'ai' or '@ai-sdk/*' anywhere, so redirecting these to a real,
// safe stub (metro-stubs/ai-sdk-stub.js) doesn't lose any real
// functionality this app actually uses. Wraps withRorkMetro's own
// resolveRequest as a fallback rather than replacing it, so its real,
// needed behavior (the web-platform polyfill redirects) still works.
const rorkResolveRequest = rorkConfig.resolver.resolveRequest;
const aiStubPath = path.resolve(__dirname, 'metro-stubs/ai-sdk-stub.js');

// expo-three (a library, not this app's code) imports three's loaders without the ".js"
// ("three/examples/jsm/loaders/GLTFLoader"). three lists ./examples/jsm/* in its "exports" with no extension, so
// Metro warned about each of them on every bundle ("invalid package.json configuration ... Falling back to
// file-based resolution"). The file it fell back to was always the right one; only the warning was noise. Giving
// Metro the file's real name finds it through "exports" and says nothing. A request that already has an extension,
// and anything outside three/examples/jsm/, is left exactly as it was.
const threeExample = /^three\/examples\/jsm\/.+/;
const hasExtension = /\.(?:[cm]?js|json)$/;

rorkConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'ai' || moduleName.startsWith('@ai-sdk/')) {
    return { filePath: aiStubPath, type: 'sourceFile' };
  }
  const request = threeExample.test(moduleName) && !hasExtension.test(moduleName) ? `${moduleName}.js` : moduleName;
  if (rorkResolveRequest) {
    return rorkResolveRequest(context, request, platform);
  }
  return context.resolveRequest(context, request, platform);
};

module.exports = rorkConfig;
