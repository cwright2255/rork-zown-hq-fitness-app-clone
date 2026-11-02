// The profile saved to Firestore (store/userStore.js, saveProfile) carries onboardedAt, the time onboarding was finished, which is how
// signing in again tells a finished setup from one quit part way (services/profileStatus.js). It is written only when there is one.
jest.mock('../src/config/firebase', () => ({ __esModule: true, db: { name: 'db' }, auth: {}, storage: {}, functions: {} }));
jest.mock('firebase/firestore', () => ({
  doc: (db, ...path) => ({ path: path.join('/') }),
  getDoc: jest.fn(async () => ({ exists: () => false })),
  setDoc: (...a) => global.__setDoc(...a),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));
jest.mock('../store/expStore', () => ({ useExpStore: { getState: () => ({}) } }));

import { useUserStore } from '../store/userStore';
import { isProfileComplete } from '../services/profileStatus';

// The store restores what the phone saved a moment after it loads and finishes on the next animation frame; let that happen inside the test.
beforeAll(() => new Promise((resolve) => { setTimeout(resolve, 50); }));
beforeEach(() => {
  global.__setDoc = jest.fn(async () => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  delete global.__setDoc;
  useUserStore.setState({ user: null, isOnboarded: false });
});

const saved = () => global.__setDoc.mock.calls[0][1];

describe('saveProfile and onboardedAt', () => {
  it('saves the time onboarding was finished', async () => {
    useUserStore.setState({ user: { name: 'Cj', onboardedAt: '2026-11-02T17:00:00.000Z', heightCm: null, weightKg: null, age: 31 } });
    await useUserStore.getState().saveProfile('u1');
    expect(global.__setDoc).toHaveBeenCalledTimes(1);
    expect(global.__setDoc.mock.calls[0][0]).toEqual({ path: 'users/u1' });
    expect(saved().onboardedAt).toBe('2026-11-02T17:00:00.000Z');
    expect(global.__setDoc.mock.calls[0][2]).toEqual({ merge: true });
  });

  it('writes a blank height and weight as null, so the saved profile shows them as blank', async () => {
    useUserStore.setState({ user: { name: 'Cj', onboardedAt: '2026-11-02T17:00:00.000Z' } });
    await useUserStore.getState().saveProfile('u1');
    expect(saved().heightCm).toBeNull();
    expect(saved().weightKg).toBeNull();
  });

  it('counts as finished once read back, even with the height and weight blank', async () => {
    useUserStore.setState({ user: { name: 'Cj', onboardedAt: '2026-11-02T17:00:00.000Z' } });
    await useUserStore.getState().saveProfile('u1');
    expect(isProfileComplete(saved())).toBe(true);
  });

  it('writes no onboardedAt at all for a profile that was not finished, so a later save never invents one', async () => {
    useUserStore.setState({ user: { name: 'Cj', email: 'cj@example.com' } });
    await useUserStore.getState().saveProfile('u1');
    expect(saved()).not.toHaveProperty('onboardedAt');
    expect(isProfileComplete(saved())).toBe(false);
  });

  it('does not save without a signed-in person', async () => {
    useUserStore.setState({ user: { name: 'Cj', onboardedAt: '2026-11-02T17:00:00.000Z' } });
    await useUserStore.getState().saveProfile(null);
    expect(global.__setDoc).not.toHaveBeenCalled();
  });
});
