// What the nutrition advice says about the person's readiness when there is no wearable reading. With no data it must not
// claim one: the activity line it adds to the XP history ("Received nutrition advice (medium readiness)") is shown on the
// XP screen, so a made-up "medium" there reads as something that was measured.

const mockAddExpActivity = jest.fn();
jest.mock('@/store/expStore', () => ({ useExpStore: { getState: () => ({ addExpActivity: mockAddExpActivity }) } }));
jest.mock('@/services/wearableService', () => ({ wearableService: { getMoodDataFromWearables: jest.fn(async () => null), getConnectedDevices: jest.fn(() => []) } }));
jest.mock('@/store/userStore', () => ({ useUserStore: { getState: () => ({ user: { uid: 'u1', name: 'Sam', fitnessMetrics: {} } }) } }));
jest.mock('firebase/functions', () => ({ httpsCallable: (...a) => global.__httpsCallable(...a) }), { virtual: true });
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), addDoc: jest.fn(), query: jest.fn(), where: jest.fn(), getDocs: jest.fn(), serverTimestamp: jest.fn(),
}), { virtual: true });
jest.mock('../src/config/firebase', () => ({ functions: { fake: true }, db: {} }));

import { generateNutritionAdvice, getFitnessMetrics } from '../services/aiService';
import { wearableService } from '@/services/wearableService';

const asked = [];
beforeEach(() => {
  asked.length = 0;
  mockAddExpActivity.mockClear();
  wearableService.getMoodDataFromWearables.mockReset().mockResolvedValue(null);
  global.__httpsCallable = jest.fn(() => async ({ messages }) => {
    asked.push(messages);
    return { data: { completion: 'advice' } };
  });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const userMessage = () => asked[0].find((m) => m.role === 'user').content;
const loggedDescription = () => mockAddExpActivity.mock.calls[0][0].description;

describe('nutrition advice with no wearable reading', () => {
  it('sends the AI no recovery numbers', async () => {
    await generateNutritionAdvice(['lose fat'], 90, 80);
    expect(userMessage()).not.toContain('TodayRecovery');
  });

  it('does not log a readiness it never had', async () => {
    await generateNutritionAdvice(['lose fat'], 90, 80);
    expect(loggedDescription()).toBe('Received nutrition advice');
    expect(loggedDescription()).not.toMatch(/readiness/i);
  });
});

describe('nutrition advice with a real wearable reading', () => {
  it('sends the reading and logs the readiness worked out from it', async () => {
    wearableService.getMoodDataFromWearables.mockResolvedValue({ mood: 5, energy: 5, stress: 1, sleep: 5, confidence: 80 });
    await generateNutritionAdvice(['lose fat'], 90, 80);
    expect(userMessage()).toContain('TodayRecovery(mood:5/5');
    expect(loggedDescription()).toBe('Received nutrition advice (high readiness)');
  });

  it('logs "medium" when the reading really is in the middle', async () => {
    wearableService.getMoodDataFromWearables.mockResolvedValue({ mood: 3, energy: 3, stress: 3, sleep: 3, confidence: 80 });
    await generateNutritionAdvice(['lose fat'], 90, 80);
    expect(loggedDescription()).toBe('Received nutrition advice (medium readiness)');
  });
});

describe('fitness metrics with nothing connected', () => {
  it('are all empty, not estimated', async () => {
    expect(await getFitnessMetrics('u1')).toEqual({ steps: null, sleep: null, activity: null, heartRate: null, source: null });
  });
});
