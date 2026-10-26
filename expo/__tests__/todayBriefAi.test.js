// The AI call behind the daily Today brief (services/aiService.js generateTodayBrief): what it sends, under which allowance, and that it
// never throws. What goes into the messages and how a reply is read are tested in todayBrief.test.js.
jest.mock('@/store/expStore', () => ({ useExpStore: { getState: () => ({ addExpActivity: jest.fn() }) } }));
jest.mock('@/services/wearableService', () => ({ wearableService: { getMoodDataFromWearables: jest.fn(async () => null), getConnectedDevices: jest.fn(() => []) } }));
jest.mock('@/store/userStore', () => ({ useUserStore: { getState: () => ({ user: { uid: 'u1', name: 'Sam', fitnessMetrics: {} } }) } }));
jest.mock('firebase/functions', () => ({ httpsCallable: (...a) => global.__httpsCallable(...a) }), { virtual: true });
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), addDoc: jest.fn(), query: jest.fn(), where: jest.fn(), getDocs: jest.fn(), serverTimestamp: jest.fn(),
}), { virtual: true });
jest.mock('../src/config/firebase', () => ({ functions: { fake: true }, db: {} }));

import { generateTodayBrief } from '../services/aiService';

const MESSAGES = [
  { role: 'system', content: 'Write the brief.' },
  { role: 'user', content: 'Write my Today brief.' },
];
const BRIEF = { headline: 'A good day to train', points: ['Sleep was 7.5 hours.', 'Keep the lifting moderate.'] };

let call;
const reply = (data) => { call = jest.fn(async () => ({ data })); global.__httpsCallable = jest.fn(() => call); };
const fail = (error) => { call = jest.fn(async () => { throw error; }); global.__httpsCallable = jest.fn(() => call); };
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  reply({ completion: JSON.stringify(BRIEF) });
});
afterEach(() => { jest.restoreAllMocks(); });

describe('the Today brief request', () => {
  it('is the headline and points of the reply postLLM sends back', async () => {
    expect(await generateTodayBrief({ messages: MESSAGES })).toEqual(BRIEF);
  });

  it('is found when the model wraps the JSON in a code fence or a few words', async () => {
    reply({ completion: `Here you go: \`\`\`json\n${JSON.stringify(BRIEF)}\n\`\`\`` });
    expect(await generateTodayBrief({ messages: MESSAGES })).toEqual(BRIEF);
  });

  it('sends the messages exactly as built, as the Pro-only "brief" kind of request', async () => {
    await generateTodayBrief({ messages: MESSAGES });
    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith({ messages: MESSAGES, kind: 'brief' });
    expect(global.__httpsCallable).toHaveBeenCalledWith({ fake: true }, 'postLLM');
  });

  it('is nothing, and costs no request, when there is nothing to send', async () => {
    for (const messages of [undefined, null, [], 'text', {}]) {
      expect(await generateTodayBrief({ messages })).toBeNull();
    }
    expect(await generateTodayBrief({})).toBeNull();
    expect(call).not.toHaveBeenCalled();
  });

  it('is nothing when the scope check turned the request away: that is not a brief', async () => {
    reply({ completion: JSON.stringify(BRIEF), refused: true });
    expect(await generateTodayBrief({ messages: MESSAGES })).toBeNull();
  });

  it('is nothing when the reply holds no usable brief', async () => {
    for (const completion of ['', 'Rest day today.', '{}', '{"headline":"","points":[]}', '[]']) {
      reply({ completion });
      expect({ completion, out: await generateTodayBrief({ messages: MESSAGES }) }).toEqual({ completion, out: null });
    }
  });

  it('is nothing, and is not asked twice, when the call fails: the answer or its absence is kept for the day', async () => {
    fail(new Error('offline'));
    expect(await generateTodayBrief({ messages: MESSAGES })).toBeNull();
    expect(call).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('is nothing when the reply is not the shape postLLM sends', async () => {
    reply({ choices: [] });
    expect(await generateTodayBrief({ messages: MESSAGES })).toBeNull();
    reply(undefined);
    expect(await generateTodayBrief({ messages: MESSAGES })).toBeNull();
  });

  it('is nothing, without a fuss, when a server that still locks the brief turns the request away', async () => {
    fail(Object.assign(new Error('plan'), { code: 'functions/permission-denied', details: { reason: 'plan_required', feature: 'todayBrief', needs: 'pro', tier: 'free' } }));
    expect(await generateTodayBrief({ messages: MESSAGES })).toBeNull();
    expect(call).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('is nothing, without a fuss, when the allowance for the day is used up', async () => {
    fail(Object.assign(new Error('limit'), { code: 'functions/resource-exhausted', details: { reason: 'ai_limit', bucket: 'insight', limit: 60, tier: 'pro' } }));
    expect(await generateTodayBrief({ messages: MESSAGES })).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });
});
