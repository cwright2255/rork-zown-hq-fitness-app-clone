const path = require('path');
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.watchFolders = [path.resolve(__dirname, '..')];
config.resolver = {
  ...(config.resolver || {}),
  nodeModulesPaths: [
    path.resolve(__dirname, 'node_modules'),
    path.resolve(__dirname, '..', 'node_modules'),
  ],
};

// expo-three (a library, not this app's code) imports three's loaders without the ".js"
// ("three/examples/jsm/loaders/GLTFLoader"). three lists ./examples/jsm/* in its "exports" with no extension, so
// Metro warned about each of them on every bundle ("invalid package.json configuration ... Falling back to
// file-based resolution"). The file it fell back to was always the right one; only the warning was noise. Giving
// Metro the file's real name finds it through "exports" and says nothing. A request that already has an extension,
// and anything outside three/examples/jsm/, is left exactly as it was.
const threeExample = /^three\/examples\/jsm\/.+/;
const hasExtension = /\.(?:[cm]?js|json)$/;

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const request = threeExample.test(moduleName) && !hasExtension.test(moduleName) ? `${moduleName}.js` : moduleName;
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, request, platform);
  }
  return context.resolveRequest(context, request, platform);
};

module.exports = config;
