// What getNutritionRecommendations (functions/src/index.js) tells the model about food: the evidence notes in
// functions/src/nutritionKnowledge.js and the diet note the app sends inside the profile. index.js is loaded with
// the Firebase packages and OpenAI replaced by small fakes, so nothing leaves the test.

jest.mock('firebase-admin/app', () => ({ initializeApp: jest.fn() }), { virtual: true });
jest.mock('firebase-admin/firestore', () => ({ getFirestore: () => global.__db, FieldValue: { serverTimestamp: () => 'ts' } }), { virtual: true });
jest.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({}) }), { virtual: true });
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({}) }), { virtual: true });
jest.mock('firebase-admin/storage', () => ({ getStorage: () => ({ bucket: () => ({}) }) }), { virtual: true });
jest.mock('firebase-functions/v2/https', () => {
  class HttpsError extends Error {
    constructor(code, message, details) { super(message); this.code = code; this.details = details; }
  }
  return { onCall: (opts, handler) => Object.assign(handler, { __opts: opts }), onRequest: (opts, handler) => handler, HttpsError };
}, { virtual: true });
jest.mock('firebase-functions/v2/firestore', () => ({ onDocumentCreated: (opts, handler) => handler, onDocumentDeleted: (opts, handler) => handler }), { virtual: true });
jest.mock('firebase-functions/params', () => ({ defineSecret: (name) => ({ name, value: () => 'secret-' + name }) }), { virtual: true });
jest.mock('openai', () => ({
  __esModule: true,
  default: class OpenAI {
    constructor() { this.chat = { completions: { create: (...args) => global.__create(...args) } }; }
  },
}), { virtual: true });
jest.mock('../functions/src/accountErasure.js', () => ({ eraseUserAccount: jest.fn() }));

import { nutritionPreferenceText } from '../lib/userProfileData';

const AUTH = { uid: 'u1' };
const REPLY = JSON.stringify({ dailyMacros: { calories: 2200, protein: 150, carbs: 250, fat: 70 }, mealIdeas: [], summary: 'ok' });

let fns;
let notes;
const askForTargets = (data = {}) => fns.getNutritionRecommendations({ auth: AUTH, data: { recentWorkouts: [], goals: [], profile: {}, ...data } });
const sentPrompt = () => global.__create.mock.calls[0][0].messages.slice(-1)[0].content;

beforeEach(() => {
  jest.resetModules();
  fns = require('../functions/src/index.js');
  notes = require('../functions/src/nutritionKnowledge.js').NUTRITION_EVIDENCE_NOTES;
  global.__create = jest.fn(async () => ({ choices: [{ message: { content: REPLY } }] }));
  // The day's count (aiUsage) is taken in a transaction before the targets are worked out.
  const docs = new Map();
  global.__db = {
    collection: () => ({ add: async () => ({ id: 'rec1' }) }),
    doc: (path) => ({ path, get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }) }),
    runTransaction: async (fn) => fn({
      get: async (r) => r.get(),
      set: (r, data, opts) => docs.set(r.path, opts && opts.merge ? { ...docs.get(r.path), ...data } : data),
    }),
  };
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); delete global.__create; delete global.__db; });

describe('the evidence notes', () => {
  it('open by saying how to use them', () => {
    expect(notes.startsWith('Evidence to apply. Let it shape the numbers and the meal ideas; do not recite it back as a lecture.')).toBe(true);
  });

  it('state the numbers the nutrition knowledge base gives', () => {
    for (const fact of [
      '14 g per 1,000 kcal', '25 g a day for women and 38 g for men',
      '1.2-2.0 g per kg a day', '0.25-0.4 g per kg (20-40 g)',
      '3-10 g per kg a day', 'up to 12 g per kg', '20-35% of calories',
      'free sugars under 10% of calories (under 5% gives extra benefit)', 'saturated fat under 10%', 'trans fat under 1%', 'salt under 5 g a day',
      'at least 400 g of vegetables and fruit a day',
      'about 500 more calories a day on an ultra-processed diet',
    ]) {
      expect(notes).toContain(fact);
    }
  });

  it('guard against a deficit that is too big, and tell the model how to treat a diet\'s cautions', () => {
    expect(notes).toContain('never set a deficit big enough to risk low energy availability');
    expect(notes).toContain('see a doctor or sports dietitian');
    expect(notes).toContain('name the single most relevant caution in the summary');
    expect(notes).toContain('never claim a diet treats or cures a disease');
    expect(notes).toContain('a doctor or registered dietitian');
  });

  it('say what to do for intuitive eating', () => {
    expect(notes).toContain('intuitive eating');
    expect(notes).toContain('flexible rough estimate at maintenance with no deficit');
    expect(notes).toContain('good and bad foods');
  });
});

describe('getNutritionRecommendations', () => {
  it('puts the evidence notes in the request, before the JSON shape it wants back', async () => {
    await askForTargets();
    const prompt = sentPrompt();
    expect(prompt).toContain(notes);
    expect(prompt.indexOf(notes)).toBeLessThan(prompt.indexOf('Return strict JSON'));
    expect(prompt.indexOf(notes)).toBeGreaterThan(prompt.indexOf('genuinely fit it, not generic meals with a note bolted on.'));
  });

  it('keeps its own calculation rules and the shape of its answer', async () => {
    await askForTargets();
    const prompt = sentPrompt();
    expect(prompt).toContain('Mifflin-St Jeor');
    expect(prompt).toContain('Never recommend a deficit below 1200 kcal/day for any adult');
    expect(prompt).toContain('roughly 1.6g per kg of body weight per day');
    expect(prompt).toContain('Return strict JSON { "dailyMacros": { "calories": number, "protein": number, "carbs": number, "fat": number }, "mealIdeas"');
  });

  it('passes the diet, with its note, as the app sends it', async () => {
    const preference = nutritionPreferenceText({ dietId: 'carnivore', allergies: ['shellfish'], avoid: [] });
    await askForTargets({ profile: { weightKg: 90, nutritionPreference: preference } });
    const prompt = sentPrompt();
    expect(prompt).toContain(`Dietary preference: ${preference}`);
    expect(prompt).toContain('long-term safety is unproven');
    expect(prompt).toContain('allergies (strict): shellfish');
  });

  it('leaves the preference line out when there is none', async () => {
    await askForTargets({ profile: { weightKg: 90, nutritionPreference: 'no_preference' } });
    expect(sentPrompt()).not.toContain('Dietary preference:');
  });

  it('still gives back the recommendations and keeps the record, with the scope rule first', async () => {
    const out = await askForTargets({ profile: { weightKg: 90 } });
    expect(out.recommendationId).toBe('rec1');
    expect(out.recommendations.dailyMacros.calories).toBe(2200);
    expect(global.__create.mock.calls[0][0].messages[0].content).toMatch(/^Scope rule from ZOWN HQ/);
    expect(global.__create.mock.calls[0][0]).toMatchObject({ model: 'gpt-4o', response_format: { type: 'json_object' } });
  });
});
