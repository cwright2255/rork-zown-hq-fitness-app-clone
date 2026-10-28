// metro.config.js: expo-three imports three's loaders without ".js" ("three/examples/jsm/loaders/GLTFLoader"), and three lists ./examples/jsm/*
// in its "exports" with no extension, so Metro printed an "invalid package.json configuration" warning for each of them on every bundle.
// The resolver in the config gives Metro the file's real name. The bundler is not run here; the config's own resolver is, with a stand-in for
// the resolver underneath it that records the name it was asked for.
const path = require('path');
const config = require('../metro.config.js');

const asked = (name, platform = 'ios') => {
  const calls = [];
  const context = { resolveRequest: (_ctx, moduleName) => { calls.push(moduleName); return { type: 'sourceFile', filePath: `/stub/${moduleName}` }; } };
  config.resolver.resolveRequest(context, name, platform);
  return calls;
};

describe('three\'s loaders, as expo-three asks for them', () => {
  it.each(['ColladaLoader', 'GLTFLoader', 'MTLLoader', 'OBJLoader'])('%s is looked up with its .js', (loader) => {
    expect(asked(`three/examples/jsm/loaders/${loader}`)).toEqual([`three/examples/jsm/loaders/${loader}.js`]);
  });

  it('does the same on every platform the app is built for', () => {
    ['ios', 'android', 'web'].forEach((platform) => {
      expect(asked('three/examples/jsm/loaders/GLTFLoader', platform)).toEqual(['three/examples/jsm/loaders/GLTFLoader.js']);
    });
  });

  it('does the same for anything else under three/examples/jsm/ that is asked for without an extension', () => {
    expect(asked('three/examples/jsm/utils/BufferGeometryUtils')).toEqual(['three/examples/jsm/utils/BufferGeometryUtils.js']);
  });

  it('leaves a request that already names its file alone, as the app\'s own imports do', () => {
    ['three/examples/jsm/loaders/GLTFLoader.js', 'three/examples/jsm/exporters/GLTFExporter.js', 'three/examples/jsm/libs/draco/draco_decoder.mjs',
      'three/examples/jsm/libs/ammo.wasm.cjs', 'three/examples/jsm/loaders/config.json'].forEach((name) => {
      expect(asked(name)).toEqual([name]);
    });
  });

  it('leaves everything outside three/examples/jsm/ alone', () => {
    ['three', 'three/src/Three', 'three/examples/fonts/helvetiker_regular.typeface.json', 'three-stdlib/loaders/GLTFLoader', 'expo-three',
      'react-native', './GLTFLoader', '../three/examples/jsm/loaders/GLTFLoader'].forEach((name) => {
      expect(asked(name)).toEqual([name]);
    });
  });
});

describe('the other redirects in the config', () => {
  it('still sends ai and @ai-sdk/* to the stub, whatever the platform', () => {
    const stub = path.resolve(__dirname, '..', 'metro-stubs/ai-sdk-stub.js');
    ['ai', '@ai-sdk/provider-utils', '@ai-sdk/react'].forEach((name) => {
      const calls = [];
      const result = config.resolver.resolveRequest({ resolveRequest: () => calls.push(name) }, name, 'ios');
      expect(result).toEqual({ filePath: stub, type: 'sourceFile' });
      expect(calls).toEqual([]);
    });
  });

  it('keeps the folders it looks for packages in', () => {
    expect(config.resolver.nodeModulesPaths).toEqual([
      path.resolve(__dirname, '..', 'node_modules'),
      path.resolve(__dirname, '..', '..', 'node_modules'),
    ]);
  });
});
