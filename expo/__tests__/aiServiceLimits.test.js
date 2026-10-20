// How the app asks postLLM (services/aiService.js), now that the server counts each request against a daily allowance
// (functions/src/aiQuota.js): every request says which allowance it uses, and a request the server turned away because of the
// person's plan is not asked again (asking again gets the same answer, and a retry would only look like a second try).
jest.mock('@/store/expStore', () => ({ useExpStore: { getState: () => ({ addExpActivity: jest.fn() }) } }));
jest.mock('@/services/wearableService', () => ({ wearableService: { getMoodDataFromWearables: jest.fn(async () => null), getConnectedDevices: jest.fn(() => []) } }));
jest.mock('@/store/userStore', () => ({ useUserStore: { getState: () => ({ user: { uid: 'u1', name: 'Sam', fitnessMetrics: {} } }) } }));
jest.mock('firebase/functions', () => ({ httpsCallable: (...a) => global.__httpsCallable(...a) }), { virtual: true });
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), addDoc: jest.fn(), query: jest.fn(), where: jest.fn(), getDocs: jest.fn(), serverTimestamp: jest.fn(),
}), { virtual: true });
jest.mock('../src/config/firebase', () => ({ functions: { fake: true }, db: {} }));

import { chatAI, generateTrainingLoadInsight } from '../services/aiService';

const MESSAGES = [{ role: 'user', content: 'How much protein?' }];
const limitError = () => Object.assign(new Error('limit'), {
  code: 'functions/resource-exhausted', details: { reason: 'ai_limit', bucket: 'coach', limit: 5, tier: 'free' },
});

let call;
beforeEach(() => {
  jest.useFakeTimers();
  call = jest.fn(async () => ({ data: { completion: 'Eat more protein.' } }));
  global.__httpsCallable = jest.fn(() => call);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

// chatAI waits a moment between a failed try and the retry; this lets it.
const finish = async (promise) => {
  const done = promise.then((v) => ({ v }), (e) => ({ e }));
  for (let i = 0; i < 6; i += 1) { await Promise.resolve(); jest.advanceTimersByTime(500); }
  return done;
};

describe('which allowance a request uses', () => {
  it('is the Coach\'s unless the caller says otherwise', async () => {
    expect(await chatAI(MESSAGES)).toBe('Eat more protein.');
    expect(global.__httpsCallable).toHaveBeenCalledWith({ fake: true }, 'postLLM');
    expect(call).toHaveBeenCalledWith({ messages: MESSAGES, kind: 'coach' });
  });

  it('is left out of the request, not sent empty, when the caller gives none', async () => {
    await chatAI(MESSAGES, undefined, '');
    expect(call.mock.calls[0][0]).toStrictEqual({ messages: MESSAGES });
  });

  it('is the one the caller names: the help chat says it is one of the helpers', async () => {
    await chatAI(MESSAGES, undefined, 'assist');
    expect(call).toHaveBeenCalledWith({ messages: MESSAGES, kind: 'assist' });
  });

  it('keeps the caller\'s timeout', async () => {
    await chatAI(MESSAGES, 45000, 'coach');
    expect(call).toHaveBeenCalledWith({ messages: MESSAGES, kind: 'coach' });
  });

  it('is the Health screen\'s own for the comment it asks for by itself', async () => {
    await generateTrainingLoadInsight({ trainingLoad: { zone: 'optimal', ratio: 1 } });
    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0][0].kind).toBe('insight');
  });
});

describe('a request the server turned away because of the plan', () => {
  it('is not asked a second time, and the error reaches the screen with its reason', async () => {
    const error = limitError();
    call.mockRejectedValue(error);
    const { e } = await finish(chatAI(MESSAGES));
    expect(e).toBe(error);
    expect(e.details.reason).toBe('ai_limit');
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('includes a feature that is on a higher plan', async () => {
    const error = Object.assign(new Error('plan'), { code: 'functions/permission-denied', details: { reason: 'plan_required', feature: 'bodyScan', needs: 'legend', tier: 'pro' } });
    call.mockRejectedValue(error);
    const { e } = await finish(chatAI(MESSAGES));
    expect(e).toBe(error);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('still tries again after an ordinary failure, as before', async () => {
    call.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ data: { completion: 'Second time lucky.' } });
    const { v } = await finish(chatAI(MESSAGES));
    expect(v).toBe('Second time lucky.');
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('gives up after the retry when the failure is ordinary and keeps happening', async () => {
    call.mockRejectedValue(new Error('network'));
    const { e } = await finish(chatAI(MESSAGES));
    expect(e.message).toBe('network');
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('is not retried by the Health comment either, which gives no comment', async () => {
    call.mockRejectedValue(limitError());
    const { v } = await finish(generateTrainingLoadInsight({ trainingLoad: { zone: 'optimal', ratio: 1 } }));
    expect(v).toBeNull();
    expect(call).toHaveBeenCalledTimes(1);
  });
});
