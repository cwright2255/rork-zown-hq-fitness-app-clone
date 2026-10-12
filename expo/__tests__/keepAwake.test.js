// What the code gets when it loads expo-keep-awake itself.
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: (...a) => global.__realActivate(...a),
  deactivateKeepAwake: (...a) => global.__realDeactivate(...a),
}), { virtual: true });

import { keepScreenOn } from '../services/keepAwake';

beforeEach(() => {
  global.__realActivate = jest.fn(async () => undefined);
  global.__realDeactivate = jest.fn(async () => undefined);
});

const fake = (extra = {}) => ({
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
  ...extra,
});

describe('keepScreenOn', () => {
  it('keeps the screen on until the person is done', () => {
    const mod = fake();
    const release = keepScreenOn('cooking', { module: mod });
    expect(mod.activateKeepAwakeAsync).toHaveBeenCalledTimes(1);
    expect(mod.activateKeepAwakeAsync).toHaveBeenCalledWith('cooking');
    expect(mod.deactivateKeepAwake).not.toHaveBeenCalled();
    release();
    expect(mod.deactivateKeepAwake).toHaveBeenCalledTimes(1);
    expect(mod.deactivateKeepAwake).toHaveBeenCalledWith('cooking');
  });

  it('names the request "cooking" unless told otherwise', () => {
    const mod = fake();
    keepScreenOn(undefined, { module: mod })();
    expect(mod.activateKeepAwakeAsync).toHaveBeenCalledWith('cooking');
    expect(mod.deactivateKeepAwake).toHaveBeenCalledWith('cooking');
    const other = fake();
    keepScreenOn('timer', { module: other })();
    expect(other.activateKeepAwakeAsync).toHaveBeenCalledWith('timer');
    expect(other.deactivateKeepAwake).toHaveBeenCalledWith('timer');
  });

  it('does nothing, without an error, when the module is not there', () => {
    expect(() => keepScreenOn('cooking', { module: null })()).not.toThrow();
    expect(() => keepScreenOn('cooking', { module: {} })()).not.toThrow();
    expect(global.__realActivate).not.toHaveBeenCalled();
    expect(global.__realDeactivate).not.toHaveBeenCalled();
  });

  it('needs both halves of the module', () => {
    const onlyOn = fake({ deactivateKeepAwake: undefined });
    expect(() => keepScreenOn('cooking', { module: onlyOn })()).not.toThrow();
    expect(onlyOn.activateKeepAwakeAsync).not.toHaveBeenCalled();
    const onlyOff = fake({ activateKeepAwakeAsync: undefined });
    expect(() => keepScreenOn('cooking', { module: onlyOff })()).not.toThrow();
    expect(onlyOff.deactivateKeepAwake).not.toHaveBeenCalled();
  });

  it('survives the phone refusing, whether it fails at once or later', async () => {
    const later = fake({
      activateKeepAwakeAsync: jest.fn(() => Promise.reject(new Error('no'))),
      deactivateKeepAwake: jest.fn(() => Promise.reject(new Error('no'))),
    });
    const release = keepScreenOn('cooking', { module: later });
    expect(() => release()).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
    const now = fake({
      activateKeepAwakeAsync: jest.fn(() => { throw new Error('no'); }),
      deactivateKeepAwake: jest.fn(() => { throw new Error('no'); }),
    });
    expect(() => keepScreenOn('cooking', { module: now })()).not.toThrow();
  });

  it('works with a module that does not return promises', () => {
    const plain = { activateKeepAwakeAsync: jest.fn(), deactivateKeepAwake: jest.fn() };
    keepScreenOn('cooking', { module: plain })();
    expect(plain.activateKeepAwakeAsync).toHaveBeenCalledTimes(1);
    expect(plain.deactivateKeepAwake).toHaveBeenCalledTimes(1);
  });

  describe('loading expo-keep-awake itself', () => {
    it('uses the real module when none is passed in', () => {
      const release = keepScreenOn('cooking');
      expect(global.__realActivate).toHaveBeenCalledTimes(1);
      expect(global.__realActivate).toHaveBeenCalledWith('cooking');
      release();
      expect(global.__realDeactivate).toHaveBeenCalledWith('cooking');
    });

    it('carries on without it when the module will not load', () => {
      jest.resetModules();
      jest.doMock('expo-keep-awake', () => { throw new Error('no native module'); }, { virtual: true });
      const fresh = require('../services/keepAwake').keepScreenOn;
      expect(() => fresh('cooking')()).not.toThrow();
      expect(global.__realActivate).not.toHaveBeenCalled();
    });
  });
});
