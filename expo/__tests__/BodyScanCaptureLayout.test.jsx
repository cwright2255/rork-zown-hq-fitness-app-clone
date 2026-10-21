// The Body Scan camera screen draws four things over the camera: the progress ring and a diagnostics box at the top, a "tap to
// continue" button and the caption at the bottom. Each used to be pinned to its edge by itself, so the ring was drawn on top of the
// diagnostics, the button on top of the caption, and the caption (black text on a dark box) could not be read. They now take turns
// down a column from each edge.
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn() }) }), { virtual: true });
jest.mock('react-native-vision-camera', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    Camera: (props) => mockReact.createElement(mockRn.View, { testID: 'camera', style: props.style }),
    useCameraDevice: () => ({ id: 'front' }),
    useCameraPermission: () => ({ hasPermission: true, requestPermission: jest.fn() }),
    useFrameProcessor: () => ({}),
  };
}, { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, props) };
}, { virtual: true });
jest.mock('react-native-worklets-core', () => ({ useRunOnJS: (fn) => fn }), { virtual: true });
jest.mock('react-native-mediapipe', () => ({
  usePoseDetection: (callbacks) => {
    global.__pose = callbacks;
    return { cameraDevice: { id: 'front' }, cameraViewLayoutChangeHandler: () => {}, frameProcessor: { frameProcessor: () => {} }, fpsMode: 15 };
  },
  Delegate: { GPU: 'GPU' },
  RunningMode: { LIVE_STREAM: 'LIVE_STREAM' },
  KnownPoseLandmarks: { nose: 0, leftShoulder: 11, rightShoulder: 12, leftHip: 23, rightHip: 24, leftAnkle: 27, rightAnkle: 28 },
}), { virtual: true });
jest.mock('react-native-svg', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  const Plain = () => mockReact.createElement(mockRn.View);
  return { __esModule: true, default: Plain, Circle: Plain };
}, { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }), { virtual: true });
jest.mock('@/components/ScreenHeader', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/PrimaryButton', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/PaywallGate', () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock('@/store/userStore', () => ({
  useUserStore: () => ({ user: { uid: 'u1', heightCm: 180, weightKg: 80, age: 30, gender: 'male' }, updateUser: jest.fn(), saveProfile: jest.fn() }),
}));
jest.mock('@/store/bodyCompositionStore', () => ({
  useBodyCompositionStore: () => ({ runScan: jest.fn(), isScanning: false, error: null }),
}));
jest.mock('@/lib/rotationTracker', () => ({
  createRotationTracker: () => ({
    processFrame: () => ({ step: 'right', progress: 0.3, ratio: 1, noseVisibility: 0.9 }),
    forceAdvanceStep: () => ({ step: 'right', progress: 0.3, ratio: 1, noseVisibility: 0.9 }),
    getCapturedLandmarks: () => ({}),
    reset: jest.fn(),
  }),
}));
jest.mock('@/lib/userProfileData', () => ({ getGoalLabels: () => [] }));
jest.mock('@/services/voiceGuidanceService', () => ({
  loadVoiceGuidancePreference: () => Promise.resolve(true),
  setVoiceGuidanceEnabled: jest.fn(),
  speakPrompt: jest.fn(),
  stopSpeaking: jest.fn(),
}));

import BodyScanCaptureGate from '../app/body-scan/capture';

// A person whose whole body is in frame: every landmark the screen checks is visible and well inside it.
const landmark = (x, y) => ({ x, y, visibility: 0.95 });
const wholeBody = () => {
  const pose = [];
  pose[0] = landmark(0.5, 0.15);
  pose[11] = landmark(0.45, 0.3); pose[12] = landmark(0.55, 0.3);
  pose[23] = landmark(0.46, 0.55); pose[24] = landmark(0.54, 0.55);
  pose[27] = landmark(0.46, 0.9); pose[28] = landmark(0.54, 0.9);
  return pose;
};

const flat = (node) => StyleSheet.flatten(node.props.style) || {};
const childrenOf = (node) => node.children.filter((c) => typeof c !== 'string');
const text = (node) => {
  const out = [];
  const walk = (n) => (typeof n === 'string' ? out.push(n) : n.children.forEach(walk));
  walk(node);
  return out.join(' ');
};

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const renderCamera = async () => {
  const utils = render(<BodyScanCaptureGate />);
  await act(async () => {});
  return utils;
};

describe('the top of the camera view', () => {
  it('stacks the ring above the diagnostics, so neither is drawn on the other', async () => {
    const utils = await renderCamera();
    const column = utils.getByTestId('scan-top-overlays');
    const [ring, diagnostics] = childrenOf(column);
    expect(childrenOf(column)).toHaveLength(2);
    expect(text(diagnostics)).toContain('frames:');
    expect(flat(ring).alignSelf).toBe('flex-end');
    expect(flat(ring).position).not.toBe('absolute');
    expect(flat(diagnostics).position).not.toBe('absolute');
  });

  it('is anchored to the top edge with a gap between its overlays', async () => {
    const utils = await renderCamera();
    const style = flat(utils.getByTestId('scan-top-overlays'));
    expect(style).toMatchObject({ position: 'absolute', top: 16, left: 16, right: 16 });
    expect(style.gap).toBeGreaterThan(0);
    expect(style.bottom).toBeUndefined();
  });
});

describe('the bottom of the camera view', () => {
  it('holds the caption, with its second line, anchored to the bottom edge', async () => {
    const utils = await renderCamera();
    const column = utils.getByTestId('scan-bottom-overlays');
    expect(flat(column)).toMatchObject({ position: 'absolute', bottom: 16, left: 16, right: 16 });
    expect(flat(column).top).toBeUndefined();
    const [caption] = childrenOf(column);
    expect(childrenOf(column)).toHaveLength(1);
    expect(text(caption)).toContain('Hold still, facing forward');
    expect(text(caption)).toContain('Step back until your full body is visible');
    expect(flat(caption).position).not.toBe('absolute');
  });

  it('shows the caption in white, which can be read on its dark box', async () => {
    const utils = await renderCamera();
    const caption = utils.getByText('Hold still, facing forward');
    expect(flat(caption).color).toBe('#FFFFFF');
    const subtext = utils.getByText('Step back until your full body is visible');
    expect(flat(subtext).color).not.toBe('#000000');
    expect(flat(subtext).color).toMatch(/^rgba\(255, ?255, ?255/);
  });

  it('puts the tap-to-continue button above the caption, not on it', async () => {
    const utils = await renderCamera();
    // The person turns to the next step, and then stays on it long enough for the way out to be offered.
    await act(async () => { global.__pose.onResults({ results: [{ landmarks: [wholeBody()] }] }); });
    await act(async () => { jest.advanceTimersByTime(15000); });

    const column = utils.getByTestId('scan-bottom-overlays');
    const [button, caption] = childrenOf(column);
    expect(childrenOf(column)).toHaveLength(2);
    expect(text(button)).toContain('Trouble detecting your turn? Tap to continue');
    expect(text(caption)).toContain('Slowly turn right');
    expect(flat(button).position).not.toBe('absolute');
    expect(flat(caption).position).not.toBe('absolute');
  });
});
