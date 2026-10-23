// The AI call behind the words around Today's Session (services/aiService.js generateSessionWording): what it sends, under which allowance, and
// that it never throws. What the AI is told and how its answer is checked are tested in sessionWording.test.js.
jest.mock('@/store/expStore', () => ({ useExpStore: { getState: () => ({ addExpActivity: jest.fn() }) } }));
jest.mock('@/services/wearableService', () => ({ wearableService: { getMoodDataFromWearables: jest.fn(async () => null), getConnectedDevices: jest.fn(() => []) } }));
jest.mock('@/store/userStore', () => ({ useUserStore: { getState: () => ({ user: { uid: 'u1', name: 'Sam', fitnessMetrics: {} } }) } }));
jest.mock('firebase/functions', () => ({ httpsCallable: (...a) => global.__httpsCallable(...a) }), { virtual: true });
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), addDoc: jest.fn(), query: jest.fn(), where: jest.fn(), getDocs: jest.fn(), serverTimestamp: jest.fn(),
}), { virtual: true });
jest.mock('../src/config/firebase', () => ({ functions: { fake: true }, db: {} }));

import { generateSessionWording } from '../services/aiService';

const MESSAGES = [
  { role: 'system', content: 'Put words on the workout.' },
  { role: 'user', content: '{"goal":"Strength"}' },
];
const WORDING = { name: 'Chest Day', note: '', picks: [{ id: 'plank', why: 'Your core has no sets logged this week.' }] };

let call;
const reply = (data) => { call = jest.fn(async () => ({ data })); global.__httpsCallable = jest.fn(() => call); };
const fail = (error) => { call = jest.fn(async () => { throw error; }); global.__httpsCallable = jest.fn(() => call); };
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  reply({ completion: JSON.stringify(WORDING) });
});
afterEach(() => { jest.restoreAllMocks(); });

describe('the Today\'s Session wording request', () => {
  it('is the JSON object in the reply postLLM sends back', async () => {
    expect(await generateSessionWording({ messages: MESSAGES })).toEqual(WORDING);
  });

  it('is found when the model wraps the JSON in a code fence or a few words', async () => {
    reply({ completion: `Here you go: \`\`\`json\n${JSON.stringify(WORDING)}\n\`\`\`` });
    expect(await generateSessionWording({ messages: MESSAGES })).toEqual(WORDING);
  });

  it('sends the messages exactly as built, as the "insight" kind of request that is open to every plan', async () => {
    await generateSessionWording({ messages: MESSAGES });
    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith({ messages: MESSAGES, kind: 'insight' });
    expect(global.__httpsCallable).toHaveBeenCalledWith({ fake: true }, 'postLLM');
  });

  it('sends nothing but the messages and the kind: no user, no history', async () => {
    await generateSessionWording({ messages: MESSAGES, user: { name: 'Sam' }, history: [1, 2] });
    expect(Object.keys(call.mock.calls[0][0]).sort()).toEqual(['kind', 'messages']);
  });

  it('is nothing, and costs no request, when there is nothing to send', async () => {
    for (const messages of [undefined, null, [], 'text', {}]) {
      expect(await generateSessionWording({ messages })).toBeNull();
    }
    expect(await generateSessionWording({})).toBeNull();
    expect(call).not.toHaveBeenCalled();
  });

  it('is nothing when the scope check turned the request away: that is not wording', async () => {
    reply({ completion: JSON.stringify(WORDING), refused: true });
    expect(await generateSessionWording({ messages: MESSAGES })).toBeNull();
  });

  it('is nothing when the reply holds no JSON object, including the refusal sentence', async () => {
    for (const completion of ['', 'Rest day today.', '[]', '{not json}', 'I can only help with fitness, health, nutrition and using ZOWN HQ.']) {
      reply({ completion });
      expect({ completion, out: await generateSessionWording({ messages: MESSAGES }) }).toEqual({ completion, out: null });
    }
  });

  it('is nothing, and is not asked twice, when the call fails', async () => {
    fail(new Error('offline'));
    expect(await generateSessionWording({ messages: MESSAGES })).toBeNull();
    expect(call).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('is nothing when the reply is not the shape postLLM sends', async () => {
    reply({ choices: [] });
    expect(await generateSessionWording({ messages: MESSAGES })).toBeNull();
    reply(undefined);
    expect(await generateSessionWording({ messages: MESSAGES })).toBeNull();
  });

  it('is nothing, without a fuss, when the allowance for the day is used up', async () => {
    fail(Object.assign(new Error('limit'), { code: 'functions/resource-exhausted', details: { reason: 'ai_limit', bucket: 'insight', limit: 9, tier: 'free' } }));
    expect(await generateSessionWording({ messages: MESSAGES })).toBeNull();
    expect(call).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
  });
});
