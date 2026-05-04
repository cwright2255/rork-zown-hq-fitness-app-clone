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

module.exports = withRorkMetro(config);
