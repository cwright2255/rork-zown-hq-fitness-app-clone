// The alpha-only try-on runtime test screen (app/shop/try-on-runtime-test.jsx), opened from Settings -> About. The two parts that do the measuring have
// their own tests (tryOnRunJsBenchmarks, tryOnRunGlTest); here: what the person sees and presses, when the body scan is and is not touched, and that
// nothing is left running or loaded when the screen is closed.
const fs = require('fs');
const path = require('path');
import React from 'react';
import { Platform, Share } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}), { virtual: true });
jest.mock('@/components/ScreenHeader', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { __esModule: true, default: ({ title }) => mockReact.createElement(mockRn.Text, null, title) };
});
jest.mock('expo-gl', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    GLView: (props) => {
      global.__glView = props;
      return mockReact.createElement(mockRn.View, { testID: 'gl-view' });
    },
  };
});
jest.mock('expo-three', () => ({
  Renderer: class { setSize() {} setClearColor() {} },
  loadTextureAsync: (...a) => global.__loadTexture(...a),
}));
jest.mock('expo-crypto', () => ({ digest: jest.fn(async () => new ArrayBuffer(32)), CryptoDigestAlgorithm: { SHA256: 'SHA-256' } }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.1' } } }));
jest.mock('@/store/bodyCompositionStore', () => ({ useBodyCompositionStore: { getState: () => global.__bodyStore() } }));
jest.mock('@/store/userStore', () => ({ useUserStore: { getState: () => ({ user: global.__user }) } }));
jest.mock('@/lib/loadScanMesh', () => ({ loadScanMesh: (...a) => global.__loadScanMesh(...a) }));
jest.mock('@/lib/tryOnSpike/runJsBenchmarks', () => ({
  ...jest.requireActual('@/lib/tryOnSpike/runJsBenchmarks'),
  runJsBenchmarks: (...a) => global.__runJs(...a),
}));
jest.mock('@/lib/tryOnSpike/runGlTest', () => ({
  ...jest.requireActual('@/lib/tryOnSpike/runGlTest'),
  runGlTest: (...a) => global.__runGl(...a),
}));

import TryOnRuntimeTestScreen from '../app/shop/try-on-runtime-test';

const s = (median) => ({ n: 20, min: median, median, p95: median, max: median, mean: median });
const goodJs = () => ({
  vertices: 17004, triangles: 33790,
  blend: { 8: { ...s(5), megabytes: 1.6 }, 16: { ...s(10), megabytes: 3.3 }, 32: { ...s(20), megabytes: 6.5 } },
  normals: s(12),
  pack: { bytes: 3264768, encodeMs: 40, writeMs: 30, readMs: 20, decodeMs: 10, hashMs: 15, loadMs: 45, intact: true },
});
const goodGl = () => ({
  textures: { firstMs: 100, secondMs: 90, totalMs: 190, decodedMB: 44.8 },
  firstFrameMs: 200,
  spin: { frames: 180, fps: 59.9, gapMedian: 16.7, gapP95: 17.5, gapMax: 30 },
  swaps: { blend: s(10), normals: s(12), draw: s(5) },
});

const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
// Press "Run test": runs the no-graphics part, then mounts the graphics view and hands it a graphics context.
const runThrough = async (utils, testID = 'run-garment-only') => {
  await act(async () => { fireEvent.press(utils.getByTestId(testID)); });
  await settle();
  await act(async () => { await global.__glView.onContextCreate({ drawingBufferWidth: 1, drawingBufferHeight: 1 }); });
  await settle();
};

beforeEach(() => {
  global.__runJs = jest.fn(async () => goodJs());
  global.__runGl = jest.fn(async () => goodGl());
  global.__loadScanMesh = jest.fn();
  global.__loadTexture = jest.fn();
  global.__user = { uid: 'u1' };
  global.__scans = [{ id: 'old' }, { id: 'latest' }];
  global.__loadScans = jest.fn();
  global.__bodyStore = () => ({ scans: global.__scans, loadScans: global.__loadScans });
  global.__glView = null;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); });

describe('before a run', () => {
  it('says what the test is, and offers a plain run and a run with the body scan', () => {
    const utils = render(<TryOnRuntimeTestScreen />);
    expect(utils.getByText('Try-On Runtime Test')).toBeTruthy();
    expect(utils.getByText(/stand-in made in code with the same sizes as the real shorts/)).toBeTruthy();
    expect(utils.getByText('Run test')).toBeTruthy();
    expect(utils.getByText('Run test with my body scan')).toBeTruthy();
    expect(utils.queryByTestId('report')).toBeNull();
    expect(utils.queryByTestId('gl-view')).toBeNull();
    expect(global.__runJs).not.toHaveBeenCalled();
  });

  it('tells the person where the body scan comes from before they choose it', () => {
    const utils = render(<TryOnRuntimeTestScreen />);
    expect(utils.getByText(/same mesh service the Body Scan screen uses/)).toBeTruthy();
  });

  it('says it needs a phone when it is opened on the web, and shows no buttons', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const utils = render(<TryOnRuntimeTestScreen />);
    expect(utils.getByText(/runs only in the app on a phone/)).toBeTruthy();
    expect(utils.queryByTestId('run-garment-only')).toBeNull();
  });
});

describe('a run without the body scan', () => {
  it('measures, shows the graphics view, then shows the report and a way to share it', async () => {
    const utils = render(<TryOnRuntimeTestScreen />);
    await runThrough(utils);
    expect(global.__runJs).toHaveBeenCalledTimes(1);
    expect(global.__runGl).toHaveBeenCalledTimes(1);
    const text = utils.getByTestId('report').props.children;
    expect(text).toContain('TRY-ON RUNTIME TEST');
    expect(text).toContain('App: 1.0.1');
    expect(text).toContain('not included (garment only)');
    expect(utils.getByTestId('share-results')).toBeTruthy();
    expect(utils.queryByTestId('gl-view')).toBeNull(); // the graphics view is let go once the test is done
  });

  it('never asks for the body scan, so nothing is requested from the mesh service', async () => {
    const utils = render(<TryOnRuntimeTestScreen />);
    await runThrough(utils);
    expect(global.__loadScanMesh).not.toHaveBeenCalled();
    expect(global.__loadScans).not.toHaveBeenCalled();
    expect(global.__runGl.mock.calls[0][2]).toBeNull();
  });

  it('gives the graphics part the stand-in garment with the number of shape changes a saved pack holds, and the stand-in picture', async () => {
    const utils = render(<TryOnRuntimeTestScreen />);
    await runThrough(utils);
    const [deps, garment] = global.__runGl.mock.calls[0];
    expect(garment.components).toBe(16);
    expect(garment.vertexCount).toBe(17004);
    expect(deps.textureAsset).toBeTruthy();
    await deps.loadTexture('x');
    expect(global.__loadTexture).toHaveBeenCalledWith({ asset: 'x' });
  });

  it('keeps both buttons off while a run is going, so a second press cannot start another', async () => {
    let release;
    global.__runJs = jest.fn(() => new Promise((resolve) => { release = () => resolve(goodJs()); }));
    const utils = render(<TryOnRuntimeTestScreen />);
    await act(async () => { fireEvent.press(utils.getByTestId('run-garment-only')); });
    await act(async () => { fireEvent.press(utils.getByTestId('run-garment-only')); fireEvent.press(utils.getByTestId('run-with-body')); });
    expect(global.__runJs).toHaveBeenCalledTimes(1);
    await act(async () => { release(); });
  });

  it('can be run again once it has finished, with a fresh graphics view', async () => {
    const utils = render(<TryOnRuntimeTestScreen />);
    await runThrough(utils);
    await runThrough(utils);
    expect(global.__runJs).toHaveBeenCalledTimes(2);
    expect(global.__runGl).toHaveBeenCalledTimes(2);
  });

  it('shares the report as text', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({});
    const utils = render(<TryOnRuntimeTestScreen />);
    await runThrough(utils);
    await act(async () => { fireEvent.press(utils.getByTestId('share-results')); });
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0][0].message).toBe(utils.getByTestId('report').props.children);
  });

  it('does not break when sharing is cancelled or fails', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('cancelled'));
    const utils = render(<TryOnRuntimeTestScreen />);
    await runThrough(utils);
    await act(async () => { fireEvent.press(utils.getByTestId('share-results')); });
    expect(utils.getByTestId('report')).toBeTruthy();
  });
});

describe('a run with the body scan', () => {
  const mesh = () => {
    const geometry = { dispose: jest.fn() };
    const material = { dispose: jest.fn() };
    return { displayObject: { isObject: true }, geometry, material };
  };

  it('loads the latest scan\'s body, hands it to the graphics part, and says it was added', async () => {
    const loaded = mesh();
    global.__loadScanMesh = jest.fn(async () => loaded);
    const utils = render(<TryOnRuntimeTestScreen />);
    await runThrough(utils, 'run-with-body');
    expect(global.__loadScanMesh).toHaveBeenCalledWith({ id: 'latest' });
    const body = global.__runGl.mock.calls[0][2];
    expect(body.object).toBe(loaded.displayObject);
    body.dispose();
    expect(loaded.geometry.dispose).toHaveBeenCalledTimes(1);
    expect(loaded.material.dispose).toHaveBeenCalledTimes(1);
    expect(utils.getByTestId('report').props.children).toContain('BODY SCAN IN THE SCENE: added');
  });

  it('loads the person\'s scans first when none are in memory yet', async () => {
    global.__scans = [];
    global.__loadScans = jest.fn(async () => { global.__scans = [{ id: 'fetched' }]; });
    global.__loadScanMesh = jest.fn(async () => mesh());
    const utils = render(<TryOnRuntimeTestScreen />);
    await runThrough(utils, 'run-with-body');
    expect(global.__loadScans).toHaveBeenCalledWith('u1');
    expect(global.__loadScanMesh).toHaveBeenCalledWith({ id: 'fetched' });
  });

  it('runs without a body, and says why, when the account has no scan', async () => {
    global.__scans = [];
    const utils = render(<TryOnRuntimeTestScreen />);
    await runThrough(utils, 'run-with-body');
    expect(global.__loadScanMesh).not.toHaveBeenCalled();
    expect(global.__runGl.mock.calls[0][2]).toBeNull();
    expect(utils.getByTestId('report').props.children).toContain('no body scan on this account yet');
  });

  it('runs without a body, and says why, when the body cannot be loaded', async () => {
    global.__loadScanMesh = jest.fn(async () => { throw new Error('service unavailable'); });
    const utils = render(<TryOnRuntimeTestScreen />);
    await runThrough(utils, 'run-with-body');
    expect(global.__runGl.mock.calls[0][2]).toBeNull();
    expect(utils.getByTestId('report').props.children).toContain('could not be loaded (service unavailable)');
  });

  it('runs without a body when the scans cannot be read at all', async () => {
    global.__bodyStore = () => { throw new Error('store broke'); };
    const utils = render(<TryOnRuntimeTestScreen />);
    await runThrough(utils, 'run-with-body');
    expect(global.__runGl).toHaveBeenCalledTimes(1);
    expect(utils.getByTestId('report').props.children).toContain('no body scan on this account yet');
  });

  it('lets go of the body if the screen is closed before the graphics part starts', async () => {
    const loaded = mesh();
    global.__loadScanMesh = jest.fn(async () => loaded);
    const utils = render(<TryOnRuntimeTestScreen />);
    await act(async () => { fireEvent.press(utils.getByTestId('run-with-body')); });
    await settle();
    expect(global.__glView).not.toBeNull(); // the graphics view is up, its context not yet made
    utils.unmount();
    expect(loaded.geometry.dispose).toHaveBeenCalledTimes(1);
    expect(loaded.material.dispose).toHaveBeenCalledTimes(1);
  });

  it('lets go of the body if the screen is closed while the body was loading', async () => {
    const loaded = mesh();
    let finish;
    global.__loadScanMesh = jest.fn(() => new Promise((resolve) => { finish = () => resolve(loaded); }));
    const utils = render(<TryOnRuntimeTestScreen />);
    await act(async () => { fireEvent.press(utils.getByTestId('run-with-body')); });
    await settle();
    utils.unmount();
    await act(async () => { finish(); });
    await settle();
    expect(loaded.geometry.dispose).toHaveBeenCalledTimes(1);
    expect(global.__runGl).not.toHaveBeenCalled();
  });
});

describe('when something goes wrong', () => {
  it('shows what stopped the no-graphics part, and lets the person try again', async () => {
    global.__runJs = jest.fn(async () => { throw new Error('out of memory'); });
    const utils = render(<TryOnRuntimeTestScreen />);
    await act(async () => { fireEvent.press(utils.getByTestId('run-garment-only')); });
    await settle();
    expect(utils.getByTestId('report').props.children).toContain('The test stopped: out of memory');
    expect(global.__runGl).not.toHaveBeenCalled();
    global.__runJs = jest.fn(async () => goodJs());
    await runThrough(utils);
    expect(utils.getByTestId('report').props.children).toContain('TRY-ON RUNTIME TEST');
  });

  it('still shows the no-graphics measurements when the graphics part fails', async () => {
    global.__runGl = jest.fn(async () => { throw new Error('no GL context'); });
    const utils = render(<TryOnRuntimeTestScreen />);
    await runThrough(utils);
    const text = utils.getByTestId('report').props.children;
    expect(text).toContain('GRAPHICS: failed, no GL context');
    expect(text).toContain('16 shape changes');
  });

  it('shows nothing, and does not fail, when the screen is closed during the graphics part', async () => {
    let finish;
    global.__runGl = jest.fn(() => new Promise((resolve) => { finish = () => resolve(goodGl()); }));
    const utils = render(<TryOnRuntimeTestScreen />);
    await act(async () => { fireEvent.press(utils.getByTestId('run-garment-only')); });
    await settle();
    const done = global.__glView.onContextCreate({ drawingBufferWidth: 1, drawingBufferHeight: 1 });
    utils.unmount();
    await act(async () => { finish(); await done; });
  });
});

describe('what is in the app for this test', () => {
  const root = path.join(__dirname, '..');

  it('carries one picture and nothing else: a made-up 2048 x 2048 weave, no model, no pattern files, no product data', () => {
    const files = fs.readdirSync(path.join(root, 'assets', 'tryon-runtime-test'));
    expect(files).toEqual(['stand-in-2048.jpg']);
    const jpg = fs.readFileSync(path.join(root, 'assets', 'tryon-runtime-test', files[0]));
    expect(jpg.length).toBeLessThan(100 * 1024);
    // the picture's size, read from its header
    let i = 2; let size = null;
    while (i < jpg.length) {
      if (jpg[i] !== 0xff) { i += 1; continue; }
      const marker = jpg[i + 1];
      if (marker >= 0xc0 && marker <= 0xc2) { size = [jpg.readUInt16BE(i + 7), jpg.readUInt16BE(i + 5)]; break; }
      i += 2 + jpg.readUInt16BE(i + 2);
    }
    const { TEXTURE_SIZE } = jest.requireActual('../lib/tryOnSpike/runGlTest');
    expect(size).toEqual([TEXTURE_SIZE, TEXTURE_SIZE]);
  });

  it('adds no model or pattern files anywhere in the app\'s own folders', () => {
    const found = [];
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        if (name === 'node_modules' || name.startsWith('.')) continue;
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (/\.(pkl|fbx|usdz)$/i.test(name) || /Mens_7inShorts/i.test(name)) found.push(path.relative(root, full));
      }
    };
    ['app', 'assets', 'components', 'lib', 'constants', 'services', 'store'].forEach((d) => fs.existsSync(path.join(root, d)) && walk(path.join(root, d)));
    expect(found).toEqual([]);
  });

  it('is opened from the Settings About section, at the path the layout hides the bottom bar on', () => {
    const settings = fs.readFileSync(path.join(root, 'app', 'profile', 'settings.jsx'), 'utf8');
    expect(settings).toMatch(/label="Try-On Runtime Test"[\s\S]{0,200}router\.push\('\/shop\/try-on-runtime-test'\)/);
    const { showsBottomNavigation } = require('../lib/bottomNavigationRoutes');
    expect(showsBottomNavigation('/shop/try-on-runtime-test')).toBe(false);
  });
});
