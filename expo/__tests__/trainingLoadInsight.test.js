// The comment the Health screen shows under the training load (services/aiService.js generateTrainingLoadInsight). It used to read
// a reply shape that never arrives, so it was always empty.
jest.mock('@/store/expStore', () => ({ useExpStore: { getState: () => ({ addExpActivity: jest.fn() }) } }));
jest.mock('@/services/wearableService', () => ({ wearableService: { getMoodDataFromWearables: jest.fn(async () => null), getConnectedDevices: jest.fn(() => []) } }));
jest.mock('@/store/userStore', () => ({ useUserStore: { getState: () => ({ user: { uid: 'u1', name: 'Sam', fitnessMetrics: {} } }) } }));
jest.mock('firebase/functions', () => ({ httpsCallable: (...a) => global.__httpsCallable(...a) }), { virtual: true });
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), addDoc: jest.fn(), query: jest.fn(), where: jest.fn(), getDocs: jest.fn(), serverTimestamp: jest.fn(),
}), { virtual: true });
jest.mock('../src/config/firebase', () => ({ functions: { fake: true }, db: {} }));


import { generateTrainingLoadInsight } from '../services/aiService';

const LOAD = { acuteLoad: 900, chronicWeeklyAvg: 600, ratio: 1.5, zone: 'elevated', zoneLabel: 'Higher than usual' };

let call;
const reply = (data) => { call = jest.fn(async () => ({ data })); global.__httpsCallable = jest.fn(() => call); };
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  reply({ completion: JSON.stringify({ comment: 'Your week was heavier than usual, so keep the next one easy.' }) });
});
afterEach(() => { jest.restoreAllMocks(); });

describe('the comment on a training load', () => {
  it('is the "comment" of the reply postLLM sends back (a completion, not an OpenAI-shaped reply)', async () => {
    expect(await generateTrainingLoadInsight({ trainingLoad: LOAD })).toBe('Your week was heavier than usual, so keep the next one easy.');
  });

  it('is found when the reply comes wrapped in a code fence', async () => {
    reply({ completion: '```json\n{"comment":"Steady week."}\n```' });
    expect(await generateTrainingLoadInsight({ trainingLoad: LOAD })).toBe('Steady week.');
  });

  it('is found when the model adds a few words around the JSON', async () => {
    reply({ completion: 'Sure! {"comment":"Steady week."} Hope that helps.' });
    expect(await generateTrainingLoadInsight({ trainingLoad: LOAD })).toBe('Steady week.');
  });

  it('is found when the model adds words after the JSON only', async () => {
    reply({ completion: '{"comment":"Steady week."} Hope that helps.' });
    expect(await generateTrainingLoadInsight({ trainingLoad: LOAD })).toBe('Steady week.');
  });

  it('has its spaces trimmed', async () => {
    reply({ completion: '{"comment":"  Steady week.  "}' });
    expect(await generateTrainingLoadInsight({ trainingLoad: LOAD })).toBe('Steady week.');
  });

  it('is nothing when the scope check turned the request away: the refusal is not a comment on anyone\'s training', async () => {
    reply({ completion: '{"comment":"I can only help with fitness and health."}', refused: true });
    expect(await generateTrainingLoadInsight({ trainingLoad: LOAD })).toBeNull();
  });

  it('is nothing when the reply has no comment, an empty one, or one that is not text', async () => {
    for (const completion of ['{}', '{"comment":""}', '{"comment":"   "}', '{"comment":42}', '{"comment":null}', '[]']) {
      reply({ completion });
      expect({ completion, out: await generateTrainingLoadInsight({ trainingLoad: LOAD }) }).toEqual({ completion, out: null });
    }
  });

  it('is nothing when the reply is not JSON at all', async () => {
    reply({ completion: 'Looks like a heavy week.' });
    expect(await generateTrainingLoadInsight({ trainingLoad: LOAD })).toBeNull();
  });

  it('is nothing when the call fails', async () => {
    call = jest.fn(async () => { throw new Error('offline'); });
    global.__httpsCallable = jest.fn(() => call);
    jest.useFakeTimers();
    const pending = generateTrainingLoadInsight({ trainingLoad: LOAD });
    for (let i = 0; i < 6; i += 1) { await Promise.resolve(); jest.advanceTimersByTime(500); }
    expect(await pending).toBeNull();
    jest.useRealTimers();
  });

  it('is not asked for, and costs no request, when there is not enough history to comment on', async () => {
    expect(await generateTrainingLoadInsight({ trainingLoad: { zone: 'insufficient_data', ratio: null } })).toBeNull();
    expect(await generateTrainingLoadInsight({ trainingLoad: null })).toBeNull();
    expect(call).not.toHaveBeenCalled();
  });

  it('is asked about the real numbers, as JSON, under the Health screen\'s own allowance', async () => {
    await generateTrainingLoadInsight({ trainingLoad: LOAD });
    expect(call).toHaveBeenCalledTimes(1);
    const sent = call.mock.calls[0][0];
    expect(sent.kind).toBe('insight');
    expect(sent.messages[0].role).toBe('system');
    expect(sent.messages[1]).toEqual({ role: 'user', content: JSON.stringify(LOAD) });
  });
});
