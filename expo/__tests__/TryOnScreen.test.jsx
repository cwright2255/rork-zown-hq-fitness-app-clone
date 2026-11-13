// The Digital Try-On screen (app/shop/try-on.jsx): the person's body, a garment on it, the size and what is said about the fit. The parts that do the
// work have their own tests (tryOnPack, tryOnPushOut, tryOnSizing, tryOnPackStore, tryOnSession); here they are stand-ins, so this looks at what the
// person sees and can press in each situation, that a slow answer never overwrites a newer one, and that nothing is left loaded when the screen closes.
import React from 'react';
import { Pressable } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() } }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@expo/vector-icons', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { Ionicons: ({ name }) => mockReact.createElement(mockRn.Text, null, `icon:${name}`) };
}, { virtual: true });
jest.mock('@/components/TryOnScene', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { __esModule: true, default: (props) => { global.__scene = props; return mockReact.createElement(mockRn.View, { testID: 'try-on-scene' }); } };
});
jest.mock('@/lib/tryOn/latestScan', () => ({ latestScan: (...a) => global.__latestScan(...a) }));
jest.mock('@/lib/loadScanMesh', () => ({ loadScanMesh: (...a) => global.__loadScanMesh(...a) }));
jest.mock('@/lib/tryOn/appPackStore', () => ({ getAppPackStore: () => global.__store }));
jest.mock('@/lib/tryOn/tryOnSession', () => ({
  loadSizing: (...a) => global.__loadSizing(...a),
  recommend: (...a) => global.__recommend(...a),
  fitGarment: (...a) => global.__fitGarment(...a),
  readBodyGeometry: (...a) => global.__readBodyGeometry(...a),
}));

import { router as mockRouter } from 'expo-router';
import TryOnScreen from '../app/shop/try-on';

const texts = (view) => view.UNSAFE_root.findAll((n) => n.type === 'Text').map((n) => [].concat(n.props.children).join('')).filter((t) => !t.startsWith('icon:'));
const pressables = (view) => view.UNSAFE_root.findAll((n) => n.type === Pressable.type);
const labelOf = (node) => node.findAll((n) => n.type === 'Text').map((t) => [].concat(t.props.children).join('')).filter((t) => !t.startsWith('icon:')).join(' ');
const pressableWith = (view, label) => pressables(view).find((p) => labelOf(p) === label);
const hasText = (view, re) => texts(view).some((t) => re.test(t));
const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

const SIZES = { S: {}, M: {}, L: {}, XL: {} };
const sizingFor = (garments) => ({ garments: Object.fromEntries(garments.map((g) => [g, { features: ['waist'], sizes: SIZES }])) });
const fitResult = (size, extra = {}) => ({
  size, positions: new Float32Array([Object.keys(SIZES).indexOf(size) + 1, 0, 0]), faces: new Uint16Array([0, 0, 0]), fit: { verdict: 'good' }, outsidePack: false, pushed: 12, downloaded: false,
  timings: { pack: 5, blend: 20, push: 275, total: 300 }, ...extra,
});

let geometry; let material;
beforeEach(() => {
  jest.clearAllMocks();
  global.__scene = null;
  global.__store = { stand: 'in' };
  geometry = { dispose: jest.fn() };
  material = { dispose: jest.fn() };
  global.__latestScan = jest.fn(async () => ({ id: 's1', gender: 'male', heightCm: 180 }));
  global.__loadScanMesh = jest.fn(async () => ({ displayObject: { name: 'body' }, geometry, material, usedHighQualityMesh: true }));
  global.__readBodyGeometry = jest.fn(() => ({ positions: new Float32Array([1, 2, 3]), faces: new Uint16Array([0, 0, 0]) }));
  global.__loadSizing = jest.fn(async (store, group) => sizingFor(group === 'men' ? ['shorts', 'sweatpants'] : ['bra', 'cami']));
  global.__recommend = jest.fn((sizing, key) => ({ size: key === 'sweatpants' ? 'L' : 'M', verdict: 'good' }));
  global.__fitGarment = jest.fn(async (deps, args) => fitResult(args.size));
});

describe('before there is a body', () => {
  it('asks for a body scan when the person has none, and the button opens the scan screen', async () => {
    global.__latestScan.mockResolvedValue(null);
    const view = render(<TryOnScreen />);
    await settle();
    expect(hasText(view, /Take a body scan first/)).toBe(true);
    expect(global.__loadScanMesh).not.toHaveBeenCalled();
    fireEvent.press(view.getByText('Take a Body Scan'));
    expect(mockRouter.push).toHaveBeenCalledWith('/body-scan/capture');
  });

  it('says so while it looks for the scan and builds the body', async () => {
    let release;
    global.__loadScanMesh.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    const view = render(<TryOnScreen />);
    await settle();
    expect(hasText(view, /Loading your 3D body/)).toBe(true);
    await act(async () => { release({ displayObject: {}, geometry, material, usedHighQualityMesh: true }); });
    await settle();
    expect(hasText(view, /Loading your 3D body/)).toBe(false);
  });

  it('says what is needed when the scan does not say male or female, and does not build a body', async () => {
    global.__latestScan.mockResolvedValue({ id: 's1', gender: 'other' });
    const view = render(<TryOnScreen />);
    await settle();
    expect(hasText(view, /male or a female/)).toBe(true);
    expect(global.__loadScanMesh).not.toHaveBeenCalled();
  });

  it('says so when only the simple stand-in body was available, releases it, and Try Again tries again', async () => {
    global.__loadScanMesh.mockResolvedValueOnce({ displayObject: {}, geometry, material, usedHighQualityMesh: false });
    const view = render(<TryOnScreen />);
    await settle();
    expect(hasText(view, /needs the detailed 3D body/)).toBe(true);
    expect(geometry.dispose).toHaveBeenCalled();
    expect(material.dispose).toHaveBeenCalled();
    await act(async () => { fireEvent.press(view.getByText('Try Again')); });
    await settle();
    expect(global.__loadScanMesh).toHaveBeenCalledTimes(2);
    expect(view.queryByTestId('try-on-scene')).toBeTruthy();
  });

  it('says so when the body cannot be built at all', async () => {
    global.__loadScanMesh.mockRejectedValueOnce(new Error('boom'));
    const view = render(<TryOnScreen />);
    await settle();
    expect(hasText(view, /could not be loaded/)).toBe(true);
    expect(view.queryByTestId('try-on-scene')).toBeNull();
  });

  it('treats a body the fitting cannot read as the stand-in', async () => {
    global.__readBodyGeometry.mockImplementation(() => { const e = new Error('simple'); e.code = 'no-detailed-body'; throw e; });
    const view = render(<TryOnScreen />);
    await settle();
    expect(hasText(view, /needs the detailed 3D body/)).toBe(true);
  });
});

describe('with a body: a man', () => {
  it('shows the body, offers the two men\'s garments, starts on the recommended size and fits it', async () => {
    const view = render(<TryOnScreen />);
    await settle();
    expect(view.queryByTestId('try-on-scene')).toBeTruthy();
    expect(global.__loadSizing).toHaveBeenCalledWith(global.__store, 'men');
    expect(global.__recommend).toHaveBeenCalledWith(expect.anything(), 'shorts', expect.any(Float32Array));
    expect(global.__fitGarment).toHaveBeenCalledTimes(1);
    expect(global.__fitGarment.mock.calls[0][1]).toMatchObject({ garmentKey: 'shorts', group: 'men', size: 'M' });
    expect(texts(view)).toEqual(expect.arrayContaining(["Men's Shorts", "Men's Sweatpants", 'S', 'M', 'L', 'XL']));
    expect(hasText(view, /Women/)).toBe(false);
    expect(hasText(view, /best fit for you: M/)).toBe(true);
    expect(hasText(view, /Expected to fit you well/)).toBe(true);
    expect(global.__scene.garment.positions).toBeInstanceOf(Float32Array);
    expect(global.__scene.body.displayObject).toEqual({ name: 'body' });
  });

  it('says how long the fit took and that the garment has no fabric picture', async () => {
    const view = render(<TryOnScreen />);
    await settle();
    expect(hasText(view, /Fitted in 0\.3 s/)).toBe(true);
    expect(hasText(view, /one colour/)).toBe(true);
  });

  it('says when the garment had to be downloaded', async () => {
    global.__fitGarment.mockImplementation(async (d, a) => fitResult(a.size, { downloaded: true }));
    const view = render(<TryOnScreen />);
    await settle();
    expect(hasText(view, /first time: the garment was downloaded/)).toBe(true);
  });

  it('tells the person their scan stays on the phone', async () => {
    const view = render(<TryOnScreen />);
    await settle();
    expect(hasText(view, /fitted on this phone/)).toBe(true);
  });

  it('fits another size when its pill is pressed, and moves the garment on the body', async () => {
    const view = render(<TryOnScreen />);
    await settle();
    const first = global.__scene.garment;
    await act(async () => { fireEvent.press(pressableWith(view, 'XL')); });
    await settle();
    expect(global.__fitGarment).toHaveBeenCalledTimes(2);
    expect(global.__fitGarment.mock.calls[1][1]).toMatchObject({ garmentKey: 'shorts', size: 'XL' });
    expect(global.__scene.garment).not.toBe(first);
  });

  it('starts on that garment\'s own recommended size when another garment is chosen', async () => {
    const view = render(<TryOnScreen />);
    await settle();
    await act(async () => { fireEvent.press(pressableWith(view, "Men's Sweatpants")); });
    await settle();
    expect(global.__recommend).toHaveBeenLastCalledWith(expect.anything(), 'sweatpants', expect.any(Float32Array));
    expect(global.__fitGarment.mock.calls.at(-1)[1]).toMatchObject({ garmentKey: 'sweatpants', size: 'L' });
    expect(hasText(view, /best fit for you: L/)).toBe(true);
  });

  it('shows what it says about the fit for each verdict, and when the body is unusual for the garment', async () => {
    const cases = [['tight', /tight on you/], ['loose', /loose on you/], ['likely', /Should fit/], ['outside', /outside what this garment was tested on/]];
    for (const [verdict, re] of cases) {
      global.__fitGarment.mockImplementation(async (d, a) => fitResult(a.size, { fit: { verdict } }));
      const view = render(<TryOnScreen />);
      await settle();
      expect(hasText(view, re)).toBe(true);
      view.unmount();
    }
    global.__fitGarment.mockImplementation(async (d, a) => fitResult(a.size, { outsidePack: true }));
    const view = render(<TryOnScreen />);
    await settle();
    expect(hasText(view, /body shape is unusual for this garment/)).toBe(true);
  });

  it('never lets a slow answer for an earlier size replace the one the person chose later', async () => {
    const view = render(<TryOnScreen />);
    await settle();
    const pending = {};
    global.__fitGarment.mockImplementation((d, a) => new Promise((resolve) => { pending[a.size] = () => resolve(fitResult(a.size)); }));
    await act(async () => { fireEvent.press(pressableWith(view, 'S')); });
    await act(async () => { fireEvent.press(pressableWith(view, 'L')); });
    await act(async () => { pending.L(); });
    await settle();
    expect(global.__scene.garment.positions[0]).toBe(3); // L is the third size
    await act(async () => { pending.S(); });
    await settle();
    expect(global.__scene.garment.positions[0]).toBe(3); // the earlier, slower answer for S did not replace it
  });

  it('says what went wrong when a garment cannot be fitted, and the pills still work', async () => {
    global.__fitGarment.mockRejectedValueOnce(new Error('bad pack'));
    const view = render(<TryOnScreen />);
    await settle();
    expect(hasText(view, /could not be fitted just now/)).toBe(true);
    expect(global.__scene.garment).toBeNull();
    await act(async () => { fireEvent.press(pressableWith(view, 'L')); });
    await settle();
    expect(hasText(view, /could not be fitted/)).toBe(false);
    expect(global.__scene.garment).not.toBeNull();
  });

  it('says to connect to the internet when the garment has never been downloaded and there is no network', async () => {
    const e = new Error('offline');
    e.name = 'PackStoreError';
    e.code = 'offline';
    global.__fitGarment.mockRejectedValueOnce(e);
    const view = render(<TryOnScreen />);
    await settle();
    expect(hasText(view, /Connect to the internet/)).toBe(true);
  });
});

describe('with a body: a woman', () => {
  it('offers the two women\'s garments', async () => {
    global.__latestScan.mockResolvedValue({ id: 's2', gender: 'female' });
    const view = render(<TryOnScreen />);
    await settle();
    expect(global.__loadSizing).toHaveBeenCalledWith(global.__store, 'women');
    expect(texts(view)).toEqual(expect.arrayContaining(["Women's Sports Bra", "Women's Cami"]));
    expect(hasText(view, /Men/)).toBe(false);
    expect(global.__fitGarment.mock.calls[0][1]).toMatchObject({ garmentKey: 'bra', group: 'women' });
  });
});

describe('when the garment files cannot be had', () => {
  const failure = (code) => { const e = new Error(code); e.name = 'PackStoreError'; e.code = code; return e; };

  it.each([['offline', /Connect to the internet/], ['missing', /not available yet/], ['corrupt', /did not download correctly/]])('%s: says so, shows the body, and Try Again asks again', async (code, re) => {
    global.__loadSizing.mockRejectedValueOnce(failure(code));
    const view = render(<TryOnScreen />);
    await settle();
    expect(hasText(view, re)).toBe(true);
    expect(global.__fitGarment).not.toHaveBeenCalled();
    await act(async () => { fireEvent.press(view.getByText('Try Again')); });
    await settle();
    expect(global.__loadSizing).toHaveBeenCalledTimes(2);
    expect(hasText(view, re)).toBe(false);
    expect(global.__fitGarment).toHaveBeenCalledTimes(1);
  });
});

describe('the reason behind a failure', () => {
  it('shows the failure\'s own message in small print under the friendly text', async () => {
    const e = new Error('The try-on file manifest.json is not available (storage answered 403, signed in).');
    e.name = 'PackStoreError';
    e.code = 'missing';
    global.__loadSizing.mockRejectedValueOnce(e);
    const view = render(<TryOnScreen />);
    await settle();
    expect(hasText(view, /not available yet/)).toBe(true);
    expect(hasText(view, /Details: The try-on file manifest\.json is not available \(storage answered 403, signed in\)/)).toBe(true);
  });

  it('shortens a very long reason', async () => {
    const e = new Error('x'.repeat(500));
    e.name = 'PackStoreError';
    e.code = 'missing';
    global.__loadSizing.mockRejectedValueOnce(e);
    const view = render(<TryOnScreen />);
    await settle();
    const line = texts(view).find((t) => t.startsWith('Details: '));
    expect(line.length).toBeLessThan(240);
    expect(line.endsWith('...')).toBe(true);
  });
});

describe('leaving the screen', () => {
  it('releases the body it built', async () => {
    const view = render(<TryOnScreen />);
    await settle();
    view.unmount();
    expect(geometry.dispose).toHaveBeenCalledTimes(1);
    expect(material.dispose).toHaveBeenCalledTimes(1);
  });

  it('releases a body that finished building after the person had gone', async () => {
    let release;
    global.__loadScanMesh.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    const view = render(<TryOnScreen />);
    await settle();
    view.unmount();
    await act(async () => { release({ displayObject: {}, geometry, material, usedHighQualityMesh: true }); });
    await settle();
    expect(geometry.dispose).toHaveBeenCalledTimes(1);
    expect(global.__fitGarment).not.toHaveBeenCalled();
  });

  it('has Back go back', async () => {
    const view = render(<TryOnScreen />);
    await settle();
    fireEvent.press(pressables(view)[0]);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });
});

describe('what the screen no longer is', () => {
  it('has no photo, no "Coming soon" and no Save or Share', async () => {
    const view = render(<TryOnScreen />);
    await settle();
    const all = texts(view).join('|');
    for (const gone of ['Take Photo', 'Retake Photo', 'Coming soon', 'Save Look', 'Share', 'AR Preview']) expect(all).not.toContain(gone);
  });
});
