jest.mock('firebase/functions', () => ({
  httpsCallable: (...a) => global.__httpsCallable(...a),
}), { virtual: true });
jest.mock('../src/config/firebase', () => ({ functions: { fake: true } }));

import { askLLM, parseJsonObject } from '../services/llmClient';

describe('askLLM', () => {
  it('calls the postLLM Cloud Function with the messages and returns the reply text', async () => {
    const call = jest.fn(async () => ({ data: { completion: 'hello' } }));
    global.__httpsCallable = jest.fn(() => call);
    const messages = [{ role: 'user', content: 'hi' }];
    await expect(askLLM(messages)).resolves.toBe('hello');
    expect(global.__httpsCallable).toHaveBeenCalledWith({ fake: true }, 'postLLM', { timeout: 60000 });
    expect(call).toHaveBeenCalledWith({ messages, kind: 'assist' });
  });

  it('says which daily AI allowance the request uses, that of the AI helpers unless told otherwise', async () => {
    const call = jest.fn(async () => ({ data: { completion: 'hi' } }));
    global.__httpsCallable = jest.fn(() => call);
    await askLLM([], { kind: 'coach' });
    expect(call).toHaveBeenLastCalledWith({ messages: [], kind: 'coach' });
    await askLLM([]);
    expect(call).toHaveBeenLastCalledWith({ messages: [], kind: 'assist' });
  });

  it('passes a daily-limit error on as it is, with its reason, so the screen can say why', async () => {
    const error = Object.assign(new Error('limit'), { code: 'functions/resource-exhausted', details: { reason: 'ai_limit', bucket: 'assist', limit: 5, tier: 'free' } });
    global.__httpsCallable = jest.fn(() => jest.fn(async () => { throw error; }));
    await expect(askLLM([])).rejects.toBe(error);
  });

  it('lets the caller choose how long to wait', async () => {
    global.__httpsCallable = jest.fn(() => jest.fn(async () => ({ data: { completion: 'ok' } })));
    await askLLM([], { timeoutMs: 15000 });
    expect(global.__httpsCallable).toHaveBeenCalledWith({ fake: true }, 'postLLM', { timeout: 15000 });
  });

  it('keeps an empty reply (the model may say nothing)', async () => {
    global.__httpsCallable = jest.fn(() => jest.fn(async () => ({ data: { completion: '' } })));
    await expect(askLLM([])).resolves.toBe('');
  });

  it('rejects when the function sends back no text', async () => {
    for (const result of [undefined, {}, { data: {} }, { data: { completion: 42 } }, { data: { completion: null } }]) {
      global.__httpsCallable = jest.fn(() => jest.fn(async () => result));
      await expect(askLLM([])).rejects.toThrow(/did not send back a reply/);
    }
  });

  it('passes a failed call on to the caller', async () => {
    global.__httpsCallable = jest.fn(() => jest.fn(async () => { throw new Error('functions/unavailable'); }));
    await expect(askLLM([])).rejects.toThrow('functions/unavailable');
  });
});

describe('parseJsonObject', () => {
  it('reads plain JSON', () => {
    expect(parseJsonObject('{"name":"Pasta","calories":158}')).toEqual({ name: 'Pasta', calories: 158 });
  });

  it('reads JSON in a code fence, with or without the word json', () => {
    expect(parseJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonObject('```\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonObject('  ```JSON\n{"a":1}```  ')).toEqual({ a: 1 });
  });

  it('finds the object inside a sentence around it', () => {
    expect(parseJsonObject('Here you go: {"a":{"b":2}} Hope that helps!')).toEqual({ a: { b: 2 } });
  });

  it('returns null for "null", arrays, numbers, text with no object and broken JSON', () => {
    for (const text of ['null', '[1,2]', '42', '"hi"', 'no food here', '{"a":', '', '   ']) {
      expect(parseJsonObject(text)).toBeNull();
    }
  });

  it('returns null for anything that is not text', () => {
    for (const value of [undefined, null, 5, {}, ['x']]) expect(parseJsonObject(value)).toBeNull();
  });
});
