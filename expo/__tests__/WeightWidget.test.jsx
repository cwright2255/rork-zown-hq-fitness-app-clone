// Home > Weight: the latest weight, how far it has moved since the first log, the distance to the target and the latest scan's body
// fat, and a tap that opens Progress. The card only reads: it loads the weight log and the body scans and never writes either.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: { name: 'db' }, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((db, ...path) => ({ path: path.join('/') })),
  doc: jest.fn((db, ...path) => ({ path: path.join('/') })),
  query: jest.fn((...parts) => ({ query: parts })),
  orderBy: jest.fn((field, dir) => ({ orderBy: field, dir })),
  limit: jest.fn((n) => ({ limit: n })),
  getDocs: jest.fn(),
  addDoc: jest.fn(async () => ({ id: 'new' })),
  setDoc: jest.fn(async () => undefined),
  updateDoc: jest.fn(async () => undefined),
  deleteDoc: jest.fn(async () => undefined),
  serverTimestamp: jest.fn(() => 'now'),
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });

import { router } from 'expo-router';
import { addDoc, deleteDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import WeightWidget from '../components/WeightWidget';
import { useUserStore } from '../store/userStore';
import { useSettingsStore } from '../store/settingsStore';
import { useWeightLogStore } from '../store/weightLogStore';
import { useBodyCompositionStore } from '../store/bodyCompositionStore';
import { KG_TO_LB } from '../lib/macroWeightData';

const DASH = '\u2014';
const DOWN = '\u2193';
const UP = '\u2191';
const lbs = (n) => n / KG_TO_LB; // the kg that shows as n lbs
const docs = (list) => ({ docs: list.map(({ id, ...data }) => ({ id, data: () => data })) });
const iconNames = (utils) => utils.UNSAFE_root.findAll((n) => n.type === 'Ionicons').map((n) => n.props.name);
const settle = () => act(async () => {});

// What the "server" holds. Firestore answers newest first, which is how the stores ask for it.
let server;
const fresh = () => ({ weightLogs: [], scans: [], failLogs: false, failScans: false });
const answer = async (q) => {
  const path = q.query ? q.query[0].path : q.path;
  if (/^users\/[^/]+\/weightLogs$/.test(path)) {
    if (server.failLogs) throw new Error('offline');
    return docs(server.weightLogs);
  }
  if (/^users\/[^/]+\/bodyScans$/.test(path)) {
    if (server.failScans) throw new Error('offline');
    return docs(server.scans);
  }
  throw new Error(`unexpected read of ${path}`);
};
const readsOf = (suffix) => getDocs.mock.calls.filter(([q]) => (q.query ? q.query[0].path : q.path).endsWith(suffix));
const open = async (props = {}) => {
  const utils = render(<WeightWidget {...props} />);
  await settle();
  return utils;
};

beforeEach(() => {
  server = fresh();
  getDocs.mockReset();
  getDocs.mockImplementation(answer);
  [addDoc, setDoc, updateDoc, deleteDoc].forEach((f) => f.mockClear());
  router.push.mockClear();
  useUserStore.setState({ user: { uid: 'u1', name: 'Cj', targetWeightKg: null } });
  useSettingsStore.setState({ weightUnits: 'imperial' });
  useWeightLogStore.setState({ logs: [], isLoading: false, error: null });
  useBodyCompositionStore.setState({ scans: [], isLoading: false, error: null });
});

describe('Home > Weight', () => {
  it('shows a dash and asks for a weight when nothing is logged', async () => {
    const utils = await open();
    expect(utils.getByText('Weight')).toBeTruthy();
    expect(utils.getByText(DASH)).toBeTruthy();
    expect(utils.getByText('Log your weight')).toBeTruthy();
    expect(utils.queryByTestId('home-weight-change')).toBeNull();
    expect(utils.queryByTestId('home-weight-bodyfat')).toBeNull();
  });

  it('shows the latest logged weight and how far it has come down since the first log', async () => {
    server.weightLogs = [{ id: 'c', weightKg: lbs(172) }, { id: 'b', weightKg: lbs(174) }, { id: 'a', weightKg: lbs(176) }];
    const utils = await open();
    expect(utils.getByText('172 lbs')).toBeTruthy();
    expect(utils.getByTestId('home-weight-change').props.children).toBe(`${DOWN} 4 lbs from start`);
    expect(utils.getByText('View progress')).toBeTruthy();
  });

  it('shows a rise as well', async () => {
    server.weightLogs = [{ id: 'b', weightKg: lbs(157) }, { id: 'a', weightKg: lbs(150) }];
    const utils = await open();
    expect(utils.getByTestId('home-weight-change').props.children).toBe(`${UP} 7 lbs from start`);
  });

  it('has no change line with a single log', async () => {
    server.weightLogs = [{ id: 'a', weightKg: lbs(172) }];
    const utils = await open();
    expect(utils.getByText('172 lbs')).toBeTruthy();
    expect(utils.queryByTestId('home-weight-change')).toBeNull();
  });

  it('shows kilograms when Weight Units is kg, and follows the setting when it changes', async () => {
    server.weightLogs = [{ id: 'b', weightKg: 78.44 }, { id: 'a', weightKg: 80.3 }];
    useSettingsStore.setState({ weightUnits: 'metric' });
    const utils = await open();
    expect(utils.getByText('78.4 kg')).toBeTruthy();
    expect(utils.getByTestId('home-weight-change').props.children).toBe(`${DOWN} 1.9 kg from start`);
    act(() => { useSettingsStore.setState({ weightUnits: 'imperial' }); });
    expect(utils.getByText('173 lbs')).toBeTruthy();
    expect(utils.queryByText('78.4 kg')).toBeNull();
  });

  it('says how far it is from the target weight in the person\'s profile', async () => {
    server.weightLogs = [{ id: 'b', weightKg: 78 }, { id: 'a', weightKg: 80 }];
    useUserStore.setState({ user: { uid: 'u1', name: 'Cj', targetWeightKg: 75 } });
    const utils = await open();
    expect(utils.getByText('7 lbs to target')).toBeTruthy(); // 172 against 165
    expect(utils.queryByText('View progress')).toBeNull();
  });

  it('shows the target distance in kilograms for a kg person', async () => {
    server.weightLogs = [{ id: 'b', weightKg: 78.1 }];
    useSettingsStore.setState({ weightUnits: 'metric' });
    useUserStore.setState({ user: { uid: 'u1', name: 'Cj', targetWeightKg: 75 } });
    expect((await open()).getByText('3.1 kg to target')).toBeTruthy();
  });

  it('shows the latest scan\'s body fat and how it has moved since the scan before', async () => {
    server.weightLogs = [{ id: 'a', weightKg: lbs(172) }];
    server.scans = [{ id: 's2', bodyFatPercent: 18.2 }, { id: 's1', bodyFatPercent: 19.3 }];
    const utils = await open();
    expect(utils.getByText('Body fat')).toBeTruthy();
    expect(utils.getByTestId('home-weight-bodyfat-text').props.children).toBe(`18.2% ${DOWN}1.1`);
  });

  it('shows the body fat without an arrow for a first scan', async () => {
    server.scans = [{ id: 's1', bodyFatPercent: 18.2 }];
    const utils = await open();
    expect(utils.getByTestId('home-weight-bodyfat-text').props.children).toBe('18.2%');
    expect(utils.getByText(DASH)).toBeTruthy(); // no weight is logged, and the card still shows the scan
  });

  it('shows no body fat line when the latest scan has none', async () => {
    server.weightLogs = [{ id: 'a', weightKg: lbs(172) }];
    server.scans = [{ id: 's2' }, { id: 's1', bodyFatPercent: 19.3 }];
    expect((await open()).queryByTestId('home-weight-bodyfat')).toBeNull();
  });

  it('opens Progress when tapped', async () => {
    const utils = await open();
    fireEvent.press(utils.getByTestId('home-widget-weight'));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/progress');
  });

  it('reads out the figures for a screen reader, and says where a tap goes', async () => {
    server.weightLogs = [{ id: 'b', weightKg: lbs(172) }, { id: 'a', weightKg: lbs(176) }];
    server.scans = [{ id: 's1', bodyFatPercent: 18.2 }];
    useUserStore.setState({ user: { uid: 'u1', name: 'Cj', targetWeightKg: 75 } });
    const utils = await open();
    expect(utils.getByTestId('home-widget-weight').props.accessibilityLabel).toBe(
      'Weight: 172 lbs, down 4 lbs from the start, 7 lbs from the target, body fat 18.2 percent. Opens Progress.'
    );
  });

  it('has the scale icon and a chevron', async () => {
    expect(iconNames(await open())).toEqual(['scale-outline', 'chevron-forward']);
  });

  describe('loading', () => {
    it('reads the signed-in person\'s weight log and body scans once, and writes nothing', async () => {
      await open();
      expect(readsOf('users/u1/weightLogs')).toHaveLength(1);
      expect(readsOf('users/u1/bodyScans')).toHaveLength(1);
      [addDoc, setDoc, updateDoc, deleteDoc].forEach((f) => expect(f).not.toHaveBeenCalled());
    });

    it('reads nothing while signed out, and reads once the person signs in', async () => {
      useUserStore.setState({ user: null });
      await open();
      expect(getDocs).not.toHaveBeenCalled();
      server.weightLogs = [{ id: 'a', weightKg: lbs(172) }];
      await act(async () => { useUserStore.setState({ user: { uid: 'u1', name: 'Cj' } }); });
      expect(readsOf('users/u1/weightLogs')).toHaveLength(1);
    });

    it('reads again each time Home is pulled down to refresh', async () => {
      server.weightLogs = [{ id: 'a', weightKg: lbs(172) }];
      const utils = await open({ refreshTick: 0 });
      expect(utils.getByText('172 lbs')).toBeTruthy();
      server.weightLogs = [{ id: 'b', weightKg: lbs(170) }, { id: 'a', weightKg: lbs(172) }];
      utils.rerender(<WeightWidget refreshTick={1} />);
      await settle();
      expect(readsOf('users/u1/weightLogs')).toHaveLength(2);
      expect(readsOf('users/u1/bodyScans')).toHaveLength(2);
      expect(utils.getByText('170 lbs')).toBeTruthy();
    });

    it('does not read again when it is drawn again with the same refresh count', async () => {
      const utils = await open({ refreshTick: 3 });
      utils.rerender(<WeightWidget refreshTick={3} />);
      await settle();
      expect(readsOf('users/u1/weightLogs')).toHaveLength(1);
    });

    it('keeps showing the last weight when a refresh cannot reach the server', async () => {
      server.weightLogs = [{ id: 'a', weightKg: lbs(172) }];
      const utils = await open({ refreshTick: 0 });
      server.failLogs = true;
      server.failScans = true;
      jest.spyOn(console, 'error').mockImplementation(() => {});
      utils.rerender(<WeightWidget refreshTick={1} />);
      await settle();
      console.error.mockRestore();
      expect(utils.getByText('172 lbs')).toBeTruthy();
    });

    it('shows a weight logged on the Progress screen without another read', async () => {
      const utils = await open();
      act(() => { useWeightLogStore.setState({ logs: [{ id: 'x', weightKg: lbs(169) }] }); });
      expect(utils.getByText('169 lbs')).toBeTruthy();
      expect(readsOf('users/u1/weightLogs')).toHaveLength(1);
    });
  });
});
