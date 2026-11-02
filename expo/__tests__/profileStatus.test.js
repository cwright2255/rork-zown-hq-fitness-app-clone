// Whether a person has finished onboarding, judged from their saved profile (services/profileStatus.js).
jest.mock('../src/config/firebase', () => ({ __esModule: true, db: { name: 'db' } }));
jest.mock('firebase/firestore', () => ({
  doc: (db, ...path) => ({ path: path.join('/') }),
  getDoc: (...a) => global.__getDoc(...a),
}));

import { isProfileComplete, fetchProfileComplete } from '../services/profileStatus';

const snapshot = (data) => ({ exists: () => data !== undefined, data: () => data });

beforeEach(() => {
  global.__getDoc = jest.fn(async () => snapshot({ onboardedAt: '2026-11-02T17:00:00.000Z' }));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  delete global.__getDoc;
});

describe('isProfileComplete', () => {
  it('is true when Finish stamped the profile', () => {
    expect(isProfileComplete({ onboardedAt: '2026-11-02T17:00:00.000Z' })).toBe(true);
  });

  it('is true for a profile that finished before the stamp existed: an activity level, or a height and a weight', () => {
    expect(isProfileComplete({ fitnessMetrics: { activityLevel: 'moderately_active' } })).toBe(true);
    expect(isProfileComplete({ heightCm: 180, weightKg: 80 })).toBe(true);
  });

  it('is true when the person finished onboarding with the height and the weight left blank', () => {
    expect(isProfileComplete({ onboardedAt: '2026-11-02T17:00:00.000Z', heightCm: null, weightKg: null, age: 31 })).toBe(true);
  });

  it('is false for a profile that was never finished', () => {
    expect(isProfileComplete({})).toBe(false);
    expect(isProfileComplete({ name: 'Cj', email: 'cj@example.com', fitnessMetrics: {} })).toBe(false);
    expect(isProfileComplete({ fitnessMetrics: { height: null, weight: null, bodyFat: null } })).toBe(false);
  });

  it('needs both a height and a weight, and real numbers', () => {
    expect(isProfileComplete({ heightCm: 180 })).toBe(false);
    expect(isProfileComplete({ weightKg: 80 })).toBe(false);
    expect(isProfileComplete({ heightCm: 0, weightKg: 0 })).toBe(false);
    expect(isProfileComplete({ heightCm: '180', weightKg: '80' })).toBe(false);
    expect(isProfileComplete({ heightCm: NaN, weightKg: Infinity })).toBe(false);
    expect(isProfileComplete({ heightCm: Infinity, weightKg: Infinity })).toBe(false);
  });

  it('does not count an empty stamp or an empty activity level', () => {
    expect(isProfileComplete({ onboardedAt: '' })).toBe(false);
    expect(isProfileComplete({ onboardedAt: 123 })).toBe(false);
    expect(isProfileComplete({ fitnessMetrics: { activityLevel: '' } })).toBe(false);
  });

  it('is false for nothing at all', () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete(undefined)).toBe(false);
    expect(isProfileComplete('profile')).toBe(false);
  });
});

describe('fetchProfileComplete', () => {
  it('reads users/{uid} and says true for a finished profile', async () => {
    expect(await fetchProfileComplete('u1')).toBe(true);
    expect(global.__getDoc).toHaveBeenCalledWith({ path: 'users/u1' });
  });

  it('says false for a profile that was never finished', async () => {
    global.__getDoc = jest.fn(async () => snapshot({ name: 'Cj', fitnessMetrics: {} }));
    expect(await fetchProfileComplete('u1')).toBe(false);
  });

  it('says false when there is no profile document yet', async () => {
    global.__getDoc = jest.fn(async () => snapshot(undefined));
    expect(await fetchProfileComplete('u1')).toBe(false);
  });

  it('says null, "not known", when the profile cannot be read, and does not throw', async () => {
    global.__getDoc = jest.fn(async () => { throw new Error('offline'); });
    expect(await fetchProfileComplete('u1')).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  it('says null without reading anything when there is no one signed in', async () => {
    expect(await fetchProfileComplete(null)).toBeNull();
    expect(await fetchProfileComplete(undefined)).toBeNull();
    expect(await fetchProfileComplete('')).toBeNull();
    expect(global.__getDoc).not.toHaveBeenCalled();
  });
});
