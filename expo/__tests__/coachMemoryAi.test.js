// The AI call behind the Coach's notes (services/aiService.js generateCoachMemory): what it sends, under which allowance, how the answer is
// read, and that it never throws. What goes into the messages and how an answer is checked are tested in coachMemory.test.js.
jest.mock('@/store/expStore', () => ({ useExpStore: { getState: () => ({ addExpActivity: jest.fn() }) } }));
jest.mock('@/services/wearableService', () => ({ wearableService: { getMoodDataFromWearables: jest.fn(async () => null), getConnectedDevices: jest.fn(() => []) } }));
jest.mock('@/store/userStore', () => ({ useUserStore: { getState: () => ({ user: { uid: 'u1', name: 'Sam', fitnessMetrics: {} } }) } }));
jest.mock('firebase/functions', () => ({ httpsCallable: (...a) => global.__httpsCallable(...a) }), { virtual: true });
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), addDoc: jest.fn(), query: jest.fn(), where: jest.fn(), getDocs: jest.fn(), serverTimestamp: jest.fn(),
}), { virtual: true });
jest.mock('../src/config/firebase', () => ({ functions: { fake: true }, db: {} }));

import { generateCoachMemory } from '../services/aiService';

const MESSAGES = [
  { role: 'system', content: 'Keep the notes.' },
  { role: 'user', content: 'Update my Coach notes.' },
];
const FACTS = ['Can train 3 days a week', 'Prefers short workouts'];

let call;
const reply = (data) => { call = jest.fn(async () => ({ data })); global.__httpsCallable = jest.fn(() => call); };
const fail = (error) => { call = jest.fn(async () => { throw error; }); global.__httpsCallable = jest.fn(() => call); };
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  reply({ completion: JSON.stringify({ facts: FACTS }) });
});
afterEach(() => { jest.restoreAllMocks(); });

describe('the Coach notes request', () => {
  it('is the list of notes in the reply postLLM sends back', async () => {
    expect(await generateCoachMemory({ messages: MESSAGES })).toEqual(FACTS);
  });

  it('is found when the model wraps the JSON in a code fence', async () => {
    reply({ completion: `\`\`\`json\n${JSON.stringify({ facts: FACTS })}\n\`\`\`` });
    expect(await generateCoachMemory({ messages: MESSAGES })).toEqual(FACTS);
  });

  it('sends the messages exactly as built, as the "memory" kind of request', async () => {
    await generateCoachMemory({ messages: MESSAGES });
    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith({ messages: MESSAGES, kind: 'memory' });
    expect(global.__httpsCallable).toHaveBeenCalledWith({ fake: true }, 'postLLM');
  });

  it('is nothing, and costs no request, when there is nothing to send', async () => {
    for (const messages of [undefined, null, [], 'text', {}]) expect(await generateCoachMemory({ messages })).toBeNull();
    expect(await generateCoachMemory({})).toBeNull();
    expect(call).not.toHaveBeenCalled();
  });

  it('is nothing when the scope check turned the request away', async () => {
    reply({ completion: JSON.stringify({ facts: FACTS }), refused: true });
    expect(await generateCoachMemory({ messages: MESSAGES })).toBeNull();
  });

  it('is nothing when the reply is not an answer', async () => {
    for (const completion of ['', 'Nothing to note.', '{}', '{"facts":"x"}', '[]']) {
      reply({ completion });
      expect({ completion, out: await generateCoachMemory({ messages: MESSAGES }) }).toEqual({ completion, out: null });
    }
  });

  it('is an empty list for a person with no notes, and nothing for a person with notes: a slip is not a wipe', async () => {
    reply({ completion: '{"facts":[]}' });
    expect(await generateCoachMemory({ messages: MESSAGES })).toEqual([]);
    expect(await generateCoachMemory({ messages: MESSAGES, current: [] })).toEqual([]);
    expect(await generateCoachMemory({ messages: MESSAGES, current: ['Likes running'] })).toBeNull();
  });

  it('is nothing, and is not asked twice, when the call fails', async () => {
    fail(new Error('offline'));
    expect(await generateCoachMemory({ messages: MESSAGES })).toBeNull();
    expect(call).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('is nothing when the reply is not the shape postLLM sends', async () => {
    reply({ choices: [] });
    expect(await generateCoachMemory({ messages: MESSAGES })).toBeNull();
    reply(undefined);
    expect(await generateCoachMemory({ messages: MESSAGES })).toBeNull();
  });

  it('is nothing, without a fuss, when the allowance for the day is used up', async () => {
    fail(Object.assign(new Error('limit'), { code: 'functions/resource-exhausted', details: { reason: 'ai_limit', bucket: 'insight', limit: 9, tier: 'free' } }));
    expect(await generateCoachMemory({ messages: MESSAGES })).toBeNull();
    expect(call).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
  });
});
