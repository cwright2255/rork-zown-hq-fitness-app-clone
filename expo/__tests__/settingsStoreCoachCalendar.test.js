// The "Let the coach add to my calendar" setting in store/settingsStore.js: on by default, saved to the person's account with the other
// settings, read back from it, and kept on the phone.
jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((db, ...path) => ({ path: path.join('/') })),
  getDoc: jest.fn(),
  setDoc: jest.fn(async () => undefined),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDoc, setDoc } from 'firebase/firestore';
import { useSettingsStore } from '../store/settingsStore';

const snap = (data) => ({ exists: () => data !== null, data: () => data });
const settle = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
});

describe('coachCanAddToCalendar', () => {
  it('is on in a new store', () => {
    expect(useSettingsStore.getInitialState().coachCanAddToCalendar).toBe(true);
    expect(useSettingsStore.getState().coachCanAddToCalendar).toBe(true);
  });

  it('is saved to the account with the other settings when it is changed', async () => {
    useSettingsStore.getState().updateSetting('coachCanAddToCalendar', false, 'u1');
    await settle();
    expect(useSettingsStore.getState().coachCanAddToCalendar).toBe(false);
    expect(setDoc).toHaveBeenCalledTimes(1);
    const [ref, data, options] = setDoc.mock.calls[0];
    expect(ref).toEqual({ path: 'users/u1/data/settings' });
    expect(data.coachCanAddToCalendar).toBe(false);
    expect(data.weightUnits).toBe('imperial');
    expect(options).toEqual({ merge: true });
  });

  it('saves "on" as on', async () => {
    useSettingsStore.setState({ coachCanAddToCalendar: false });
    useSettingsStore.getState().updateSetting('coachCanAddToCalendar', true, 'u1');
    await settle();
    expect(setDoc.mock.calls[0][1].coachCanAddToCalendar).toBe(true);
  });

  it('is changed on the phone without an account, and nothing is sent', async () => {
    useSettingsStore.getState().updateSetting('coachCanAddToCalendar', false, undefined);
    await settle();
    expect(useSettingsStore.getState().coachCanAddToCalendar).toBe(false);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('is read back from the account', async () => {
    getDoc.mockResolvedValue(snap({ coachCanAddToCalendar: false }));
    await useSettingsStore.getState().loadSettings('u1');
    expect(useSettingsStore.getState().coachCanAddToCalendar).toBe(false);
  });

  it('is turned on again by the account when the account says on', async () => {
    useSettingsStore.setState({ coachCanAddToCalendar: false });
    getDoc.mockResolvedValue(snap({ coachCanAddToCalendar: true }));
    await useSettingsStore.getState().loadSettings('u1');
    expect(useSettingsStore.getState().coachCanAddToCalendar).toBe(true);
  });

  it('is on for an account that saved its settings before this one existed', async () => {
    getDoc.mockResolvedValue(snap({ weightUnits: 'metric' }));
    await useSettingsStore.getState().loadSettings('u1');
    expect(useSettingsStore.getState().coachCanAddToCalendar).toBe(true);
    expect(useSettingsStore.getState().weightUnits).toBe('metric');
  });

  it('keeps what is on the phone when the account has no settings yet', async () => {
    useSettingsStore.setState({ coachCanAddToCalendar: false });
    getDoc.mockResolvedValue(snap(null));
    await useSettingsStore.getState().loadSettings('u1');
    expect(useSettingsStore.getState().coachCanAddToCalendar).toBe(false);
  });

  it('is kept on the phone', async () => {
    useSettingsStore.getState().updateSetting('coachCanAddToCalendar', false, undefined);
    await settle();
    const written = AsyncStorage.setItem.mock.calls.filter(([key]) => key === 'settings-storage').pop();
    expect(JSON.parse(written[1]).state.coachCanAddToCalendar).toBe(false);
  });

  it('does not change the other settings when it changes', () => {
    const before = { ...useSettingsStore.getState() };
    useSettingsStore.getState().updateSetting('coachCanAddToCalendar', false, undefined);
    const after = useSettingsStore.getState();
    ['notifications', 'darkMode', 'units', 'weightUnits', 'workoutReminders', 'rememberMeDuration', 'privacy'].forEach((k) => {
      expect(after[k]).toEqual(before[k]);
    });
  });
});
