// What the AI Coach and the nutrition advice are told about the diet a person picked (lib/dietProfile.js notes), and
// that the Coach is told to be honest about how strong the evidence for a diet is. The model itself is faked.

jest.mock('@/store/expStore', () => ({ useExpStore: { getState: () => ({ addExpActivity: jest.fn() }) } }));
jest.mock('@/services/wearableService', () => ({ wearableService: { getMoodDataFromWearables: jest.fn(async () => null) } }));
jest.mock('@/store/userStore', () => ({ useUserStore: { getState: () => global.__userState() } }));
jest.mock('firebase/functions', () => ({ httpsCallable: (...a) => global.__httpsCallable(...a) }), { virtual: true });
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), addDoc: jest.fn(), query: jest.fn(), where: jest.fn(), getDocs: jest.fn(), serverTimestamp: jest.fn(),
}), { virtual: true });
jest.mock('../src/config/firebase', () => ({ functions: { fake: true }, db: {} }));

import { generateNutritionAdvice, getAIDailyTargets } from '../services/aiService';
import { buildCoachSystemPrompt } from '../services/coachService';
import { dietAiNote } from '../lib/dietProfile';

const userOn = (nutritionPreference, extra = {}) => ({ uid: 'u1', name: 'Sam', fitnessMetrics: { nutritionPreference, ...extra } });
const asked = [];

beforeEach(() => {
  asked.length = 0;
  global.__userState = () => ({ user: userOn('keto') });
  global.__httpsCallable = jest.fn(() => async ({ messages }) => {
    asked.push(messages);
    return { data: { completion: '{"calories":2200,"protein":160,"carbs":60,"fat":150,"water":3000}' } };
  });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const userMessage = () => asked[0].find((m) => m.role === 'user').content;

describe('nutrition advice', () => {
  it('is told what the chosen diet is and what to watch', async () => {
    await generateNutritionAdvice(['lose fat'], 90, 80);
    expect(userMessage()).toContain(`DietGuidance: ${dietAiNote('keto')}. `);
    expect(userMessage()).toContain('Restrictions: Keto');
  });

  it('puts the guidance after the restrictions and before the recovery note and the closing instruction', async () => {
    const { wearableService } = require('@/services/wearableService');
    wearableService.getMoodDataFromWearables.mockResolvedValueOnce({ mood: 3, energy: 3, stress: 3, sleep: 3, confidence: 80 });
    await generateNutritionAdvice(['lose fat'], 90, 80);
    const text = userMessage();
    expect(text).toContain('TodayRecovery(');
    expect(text.indexOf('Restrictions:')).toBeLessThan(text.indexOf('DietGuidance:'));
    expect(text.indexOf('DietGuidance:')).toBeLessThan(text.indexOf('TodayRecovery('));
    expect(text.indexOf('TodayRecovery(')).toBeLessThan(text.indexOf('Provide precise, safe, practical guidance for today.'));
  });

  it('is not given a diet note when the person has no diet', async () => {
    global.__userState = () => ({ user: userOn('no_preference') });
    await generateNutritionAdvice(['lose fat'], 90, 80);
    expect(userMessage()).not.toContain('DietGuidance');
  });

  it('does not describe the profile diet when the caller passes restrictions of its own', async () => {
    await generateNutritionAdvice(['lose fat'], 90, 80, ['vegan']);
    expect(userMessage()).toContain('Restrictions: vegan');
    expect(userMessage()).not.toContain('DietGuidance');
  });

  it('still works when the profile cannot be read', async () => {
    global.__userState = () => { throw new Error('store not ready'); };
    await expect(generateNutritionAdvice(['lose fat'], 90, 80)).resolves.toEqual(expect.any(String));
    expect(userMessage()).not.toContain('DietGuidance');
  });

  it('keeps the new choices working', async () => {
    global.__userState = () => ({ user: userOn('intuitive_eating') });
    await generateNutritionAdvice(['eat better'], 70, 70);
    expect(userMessage()).toContain('DietGuidance: no calorie counting or food rules');
  });
});

describe('daily targets', () => {
  it('is told about the diet, in the same compact style as the rest of that request', async () => {
    const targets = await getAIDailyTargets({ goals: ['fat loss'], currentWeightKg: 90, activityLevel: 'moderate' });
    expect(userMessage()).toContain(`DietGuidance:${dietAiNote('keto')}. `);
    expect(targets).toMatchObject({ calories: 2200, protein: 160, carbs: 60, fat: 150 });
  });

  it('is not given a note for no diet, or for restrictions the caller chose', async () => {
    global.__userState = () => ({ user: userOn('no_preference') });
    await getAIDailyTargets({ goals: ['fat loss'] });
    expect(userMessage()).not.toContain('DietGuidance');
    asked.length = 0;
    global.__userState = () => ({ user: userOn('keto') });
    await getAIDailyTargets({ goals: ['fat loss'], dietaryRestrictions: ['vegan'] });
    expect(userMessage()).toContain('Restrictions:vegan');
    expect(userMessage()).not.toContain('DietGuidance');
  });
});

describe('the Coach prompt', () => {
  const NOW = new Date(2026, 9, 14, 9, 0);
  const text = (user) => buildCoachSystemPrompt(user, NOW).content;

  it('carries the chosen diet and its note', () => {
    expect(text(userOn('carnivore'))).toContain(`Diet: Carnivore (${dietAiNote('carnivore')}). Keep meal and food suggestions consistent with it.`);
  });

  it('tells the model to be honest about how strong the evidence is, and when to send people to a professional', () => {
    const prompt = text(userOn('keto'));
    expect(prompt).toContain('give evidence-based guidance and say plainly when the evidence for a diet is limited or mixed');
    expect(prompt).toContain('Never claim a diet treats or cures a disease');
    expect(prompt).toContain('medical conditions, medications, pregnancy or a history of eating disorders, suggest a doctor or registered dietitian');
  });

  it('says it for a person with no diet too, before the instructions about creating things', () => {
    const prompt = text({ name: 'Sam', fitnessMetrics: {} });
    expect(prompt).not.toContain('Diet:');
    expect(prompt.indexOf('evidence-based guidance')).toBeGreaterThan(prompt.indexOf('Be encouraging, specific, and concise.'));
    expect(prompt.indexOf('evidence-based guidance')).toBeLessThan(prompt.indexOf('You can create things inside'));
  });

  it('is still a system message', () => {
    expect(buildCoachSystemPrompt(userOn('keto'), NOW).role).toBe('system');
  });
});
