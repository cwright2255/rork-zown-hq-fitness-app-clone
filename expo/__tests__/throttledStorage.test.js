import { createThrottledStorage, SAVE_EVERY_MS } from '../lib/throttledStorage';

// A key/value storage that records what is done to it.
function fakeBase({ failWrites = false, throwWrites = false } = {}) {
  const data = {};
  return {
    data,
    setItem: jest.fn((name, text) => {
      if (throwWrites) throw new Error('disk full');
      if (failWrites) return Promise.reject(new Error('disk full'));
      data[name] = text;
      return Promise.resolve();
    }),
    getItem: jest.fn((name) => Promise.resolve(name in data ? data[name] : null)),
    removeItem: jest.fn((name) => {
      delete data[name];
      return Promise.resolve();
    }),
  };
}

// A clock and timers that only move when the test says so.
function fakeTime(start = 1_000_000) {
  const t = { now: start, timers: [] };
  t.clock = () => t.now;
  t.setTimer = jest.fn((fn, ms) => {
    const timer = { fn, ms, cleared: false };
    t.timers.push(timer);
    return timer;
  });
  t.clearTimer = jest.fn((timer) => { timer.cleared = true; });
  // Runs the timer that is waiting (as the phone would after its delay).
  t.fire = () => {
    const live = t.timers.filter((x) => !x.cleared && !x.fired);
    live.forEach((x) => { x.fired = true; x.fn(); });
    return live.length;
  };
  t.live = () => t.timers.filter((x) => !x.cleared && !x.fired);
  return t;
}

function make({ base = fakeBase(), time = fakeTime(), intervalMs = 5000, getBase } = {}) {
  const warn = jest.fn();
  const storage = createThrottledStorage(getBase || (() => base), {
    intervalMs, now: time.clock, setTimer: time.setTimer, clearTimer: time.clearTimer, warn,
  });
  return { storage, base, time, warn };
}

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('lib/throttledStorage', () => {
  it('saves at most every five seconds', () => {
    expect(SAVE_EVERY_MS).toBe(5000);
  });

  describe('setItem', () => {
    it('writes the first change at once, as text', () => {
      const { storage, base } = make();
      storage.setItem('hike', { state: { a: 1 }, version: 1 });
      expect(base.setItem).toHaveBeenCalledTimes(1);
      expect(base.setItem).toHaveBeenCalledWith('hike', JSON.stringify({ state: { a: 1 }, version: 1 }));
    });

    it('holds a change made within the interval and writes it when the interval is up', () => {
      const { storage, base, time } = make();
      storage.setItem('hike', { n: 1 });
      time.now += 1000;
      storage.setItem('hike', { n: 2 });
      expect(base.setItem).toHaveBeenCalledTimes(1);
      expect(time.setTimer).toHaveBeenCalledTimes(1);
      expect(time.setTimer.mock.calls[0][1]).toBe(4000); // what is left of the five seconds
      time.now += 4000;
      expect(time.fire()).toBe(1);
      expect(base.setItem).toHaveBeenCalledTimes(2);
      expect(base.setItem).toHaveBeenLastCalledWith('hike', JSON.stringify({ n: 2 }));
    });

    it('writes only the newest of several changes, and sets one timer for them', () => {
      const { storage, base, time } = make();
      storage.setItem('hike', { n: 1 });
      time.now += 500;
      storage.setItem('hike', { n: 2 });
      time.now += 500;
      storage.setItem('hike', { n: 3 });
      time.now += 500;
      storage.setItem('hike', { n: 4 });
      expect(time.setTimer).toHaveBeenCalledTimes(1);
      time.now += 3500;
      time.fire();
      expect(base.setItem).toHaveBeenCalledTimes(2);
      expect(base.setItem.mock.calls.map((c) => c[1])).toEqual([JSON.stringify({ n: 1 }), JSON.stringify({ n: 4 })]);
    });

    it('writes at once when the interval is up exactly', () => {
      const { storage, base, time } = make();
      storage.setItem('hike', { n: 1 });
      time.now += 5000;
      storage.setItem('hike', { n: 2 });
      expect(base.setItem).toHaveBeenCalledTimes(2);
      expect(time.setTimer).not.toHaveBeenCalled();
    });

    it('holds a change made one millisecond early', () => {
      const { storage, base, time } = make();
      storage.setItem('hike', { n: 1 });
      time.now += 4999;
      storage.setItem('hike', { n: 2 });
      expect(base.setItem).toHaveBeenCalledTimes(1);
      expect(time.setTimer.mock.calls[0][1]).toBe(1);
    });

    it('waits the interval it was given', () => {
      const { storage, base, time } = make({ intervalMs: 200 });
      storage.setItem('hike', { n: 1 });
      time.now += 50;
      storage.setItem('hike', { n: 2 });
      expect(time.setTimer.mock.calls[0][1]).toBe(150);
      time.now += 150;
      time.fire();
      expect(base.setItem).toHaveBeenCalledTimes(2);
    });

    it('sets a new timer for a change made after the last timer has run', () => {
      const { storage, base, time } = make();
      storage.setItem('hike', { n: 1 });
      time.now += 1000;
      storage.setItem('hike', { n: 2 });
      time.now += 4000;
      time.fire();
      time.now += 1000;
      storage.setItem('hike', { n: 3 });
      expect(time.setTimer).toHaveBeenCalledTimes(2);
      expect(time.setTimer.mock.calls[1][1]).toBe(4000);
      time.now += 4000;
      time.fire();
      expect(base.setItem).toHaveBeenCalledTimes(3);
      expect(base.setItem).toHaveBeenLastCalledWith('hike', JSON.stringify({ n: 3 }));
    });

    it('does not write a value that is the same as the last one written', () => {
      const { storage, base, time } = make();
      storage.setItem('hike', { n: 1 });
      time.now += 6000;
      storage.setItem('hike', { n: 1 });
      expect(base.setItem).toHaveBeenCalledTimes(1);
      time.now += 6000;
      storage.setItem('hike', { n: 2 });
      expect(base.setItem).toHaveBeenCalledTimes(2);
    });

    it('keeps each name apart', () => {
      const { storage, base, time } = make();
      storage.setItem('a', { n: 1 });
      time.now += 6000;
      storage.setItem('b', { n: 1 });
      expect(base.setItem).toHaveBeenCalledTimes(2);
      expect(base.setItem.mock.calls.map((c) => c[0])).toEqual(['a', 'b']);
    });

    it('writes every name that is waiting', () => {
      const { storage, base, time } = make();
      storage.setItem('x', { n: 0 });
      time.now += 100;
      storage.setItem('a', { n: 1 });
      storage.setItem('b', { n: 2 });
      time.now += 4900;
      time.fire();
      expect(base.setItem.mock.calls.map((c) => c[0])).toEqual(['x', 'a', 'b']);
    });

    it('does not keep the app awake for a save that is waiting', () => {
      const { storage, time } = make();
      time.setTimer.mockImplementation((fn, ms) => {
        const timer = { fn, ms, cleared: false, unref: jest.fn() };
        time.timers.push(timer);
        return timer;
      });
      storage.setItem('hike', { n: 1 });
      time.now += 1000;
      storage.setItem('hike', { n: 2 });
      expect(time.timers[0].unref).toHaveBeenCalledTimes(1);
    });

    it('copes with a timer that cannot be unreferenced', () => {
      const { storage, time } = make();
      time.setTimer.mockImplementation(() => 7);
      storage.setItem('hike', { n: 1 });
      time.now += 1000;
      expect(() => storage.setItem('hike', { n: 2 })).not.toThrow();
      expect(time.setTimer).toHaveBeenCalledTimes(1);
    });

    it('does nothing when there is no storage', () => {
      const { storage, time } = make({ getBase: () => null });
      storage.setItem('hike', { n: 1 });
      time.now += 1000;
      storage.setItem('hike', { n: 2 });
      expect(time.setTimer).not.toHaveBeenCalled();
      expect(storage.getItem('hike')).toBeNull();
    });

    it('does not remember what it could not write when there was no storage', () => {
      let base = null;
      const real = fakeBase();
      const { storage } = make({ getBase: () => base });
      storage.setItem('hike', { n: 1 });
      base = real;
      storage.setItem('hike', { n: 1 });
      expect(real.setItem).toHaveBeenCalledTimes(1);
    });

    it('looks for the storage each time, not just once', () => {
      let base = null;
      const real = fakeBase();
      const { storage } = make({ getBase: () => base });
      storage.setItem('hike', { n: 1 });
      expect(real.setItem).not.toHaveBeenCalled();
      base = real;
      storage.setItem('hike', { n: 2 });
      expect(real.setItem).toHaveBeenCalledTimes(1);
    });

    it('does not write when the storage goes away before a waiting save is made', () => {
      let base = fakeBase();
      const first = base;
      const { storage, time, warn } = make({ getBase: () => base });
      storage.setItem('hike', { n: 1 });
      time.now += 1000;
      storage.setItem('hike', { n: 2 });
      base = null;
      time.now += 4000;
      expect(() => time.fire()).not.toThrow();
      expect(first.setItem).toHaveBeenCalledTimes(1);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('flush', () => {
    it('writes the waiting change now and cancels the timer', () => {
      const { storage, base, time } = make();
      storage.setItem('hike', { n: 1 });
      time.now += 1000;
      storage.setItem('hike', { n: 2 });
      const timer = time.live()[0];
      storage.flush();
      expect(base.setItem).toHaveBeenCalledTimes(2);
      expect(base.setItem).toHaveBeenLastCalledWith('hike', JSON.stringify({ n: 2 }));
      expect(time.clearTimer).toHaveBeenCalledWith(timer);
      expect(time.live()).toHaveLength(0);
    });

    it('does nothing when nothing is waiting', () => {
      const { storage, base } = make();
      storage.flush();
      expect(base.setItem).not.toHaveBeenCalled();
    });

    it('does not write the same thing twice', () => {
      const { storage, base, time } = make();
      storage.setItem('hike', { n: 1 });
      time.now += 1000;
      storage.setItem('hike', { n: 2 });
      storage.flush();
      storage.flush();
      expect(base.setItem).toHaveBeenCalledTimes(2);
    });

    it('does not start the interval when nothing was written', () => {
      const { storage, base, time } = make();
      storage.flush();
      storage.setItem('hike', { n: 1 });
      expect(base.setItem).toHaveBeenCalledTimes(1);
      expect(time.setTimer).not.toHaveBeenCalled();
    });

    it('starts the interval again, so a change right after is held', () => {
      const { storage, base, time } = make();
      storage.setItem('hike', { n: 1 });
      time.now += 1000;
      storage.setItem('hike', { n: 2 });
      time.now += 1000;
      storage.flush();
      storage.setItem('hike', { n: 3 });
      expect(base.setItem).toHaveBeenCalledTimes(2);
      expect(time.setTimer).toHaveBeenCalledTimes(2);
      expect(time.setTimer.mock.calls[1][1]).toBe(5000);
    });

    it('leaves a timer that has already run alone', () => {
      const { storage, time } = make();
      storage.setItem('hike', { n: 1 });
      time.now += 1000;
      storage.setItem('hike', { n: 2 });
      time.now += 4000;
      time.fire();
      time.clearTimer.mockClear();
      storage.flush();
      expect(time.clearTimer).not.toHaveBeenCalled();
    });

    it('does not hold the next change back when the timer ran and nothing was waiting', () => {
      const { storage, base, time } = make();
      storage.setItem('hike', { n: 1 });
      time.now += 20_000;
      storage.flush();
      storage.setItem('hike', { n: 2 });
      expect(base.setItem).toHaveBeenCalledTimes(2);
    });
  });

  describe('getItem', () => {
    it('gives back the change that is still waiting, not what was stored', () => {
      const { storage, time } = make();
      storage.setItem('hike', { n: 1 });
      time.now += 1000;
      storage.setItem('hike', { n: 2 });
      expect(storage.getItem('hike')).toEqual({ n: 2 });
    });

    it('reads and parses what is stored', async () => {
      const base = fakeBase();
      base.data.hike = JSON.stringify({ state: { a: 1 }, version: 1 });
      const { storage } = make({ base });
      await expect(storage.getItem('hike')).resolves.toEqual({ state: { a: 1 }, version: 1 });
      expect(base.getItem).toHaveBeenCalledWith('hike');
    });

    it('gives null when nothing is stored', async () => {
      const { storage } = make();
      await expect(storage.getItem('hike')).resolves.toBeNull();
    });

    it('gives null for text that is not JSON', async () => {
      const base = fakeBase();
      base.data.hike = '{"state": {';
      const { storage } = make({ base });
      await expect(storage.getItem('hike')).resolves.toBeNull();
    });

    it('gives null for empty text', async () => {
      const base = fakeBase();
      base.data.hike = '';
      const { storage } = make({ base });
      await expect(storage.getItem('hike')).resolves.toBeNull();
    });

    it.each([[{ state: 1 }], [42], [true], [['a']]])('gives null for something that is not text: %p', async (value) => {
      const base = fakeBase();
      base.getItem = jest.fn(() => Promise.resolve(value));
      const { storage } = make({ base });
      await expect(storage.getItem('hike')).resolves.toBeNull();
    });

    it('gives null when reading fails', async () => {
      const base = fakeBase();
      base.getItem = jest.fn(() => Promise.reject(new Error('unreadable')));
      const { storage } = make({ base });
      await expect(storage.getItem('hike')).resolves.toBeNull();
    });

    it('gives null when reading throws', () => {
      const base = fakeBase();
      base.getItem = jest.fn(() => { throw new Error('unreadable'); });
      const { storage } = make({ base });
      expect(storage.getItem('hike')).toBeNull();
    });

    it('copes with storage that answers at once, not with a promise', async () => {
      const base = fakeBase();
      base.getItem = jest.fn(() => JSON.stringify({ n: 5 }));
      const { storage } = make({ base });
      await expect(storage.getItem('hike')).resolves.toEqual({ n: 5 });
    });

    it('gives null when there is no storage', () => {
      const { storage } = make({ getBase: () => null });
      expect(storage.getItem('hike')).toBeNull();
    });

    it('reads what an earlier write stored', async () => {
      const { storage, time } = make();
      storage.setItem('hike', { n: 1 });
      time.now += 1000;
      await expect(storage.getItem('hike')).resolves.toEqual({ n: 1 });
    });
  });

  describe('removeItem', () => {
    it('removes it from the storage', async () => {
      const { storage, base } = make();
      storage.setItem('hike', { n: 1 });
      storage.removeItem('hike');
      expect(base.removeItem).toHaveBeenCalledWith('hike');
      expect(base.data.hike).toBeUndefined();
    });

    it('drops a change that was waiting', async () => {
      const { storage, base, time } = make();
      storage.setItem('hike', { n: 1 });
      time.now += 1000;
      storage.setItem('hike', { n: 2 });
      storage.removeItem('hike');
      time.now += 4000;
      time.fire();
      expect(base.setItem).toHaveBeenCalledTimes(1);
      await expect(storage.getItem('hike')).resolves.toBeNull();
    });

    it('lets the same value be saved again afterwards', () => {
      const { storage, base, time } = make();
      storage.setItem('hike', { n: 1 });
      storage.removeItem('hike');
      time.now += 6000;
      storage.setItem('hike', { n: 1 });
      expect(base.setItem).toHaveBeenCalledTimes(2);
    });

    it('does nothing when there is no storage', () => {
      const { storage } = make({ getBase: () => null });
      expect(() => storage.removeItem('hike')).not.toThrow();
    });

    it('survives storage that throws', () => {
      const base = fakeBase();
      base.removeItem = jest.fn(() => { throw new Error('nope'); });
      const { storage } = make({ base });
      expect(() => storage.removeItem('hike')).not.toThrow();
    });

    it('survives storage that fails', async () => {
      const base = fakeBase();
      base.removeItem = jest.fn(() => Promise.reject(new Error('nope')));
      const { storage } = make({ base });
      storage.removeItem('hike');
      await flushPromises(); // an unhandled rejection would fail the test run
    });

    it('survives storage that answers at once', () => {
      const base = fakeBase();
      base.removeItem = jest.fn(() => undefined);
      const { storage } = make({ base });
      expect(() => storage.removeItem('hike')).not.toThrow();
    });
  });

  describe('when saving fails', () => {
    it('says so, with the name and the reason, and carries on', async () => {
      const { storage, warn } = make({ base: fakeBase({ failWrites: true }) });
      expect(() => storage.setItem('hike', { n: 1 })).not.toThrow();
      await flushPromises();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('hike');
      expect(warn.mock.calls[0][0]).toContain('disk full');
    });

    it('tries the same value again next time', async () => {
      const base = fakeBase({ failWrites: true });
      const { storage, time } = make({ base });
      storage.setItem('hike', { n: 1 });
      await flushPromises();
      time.now += 6000;
      storage.setItem('hike', { n: 1 });
      expect(base.setItem).toHaveBeenCalledTimes(2);
    });

    it('says so when writing throws', () => {
      const { storage, warn } = make({ base: fakeBase({ throwWrites: true }) });
      expect(() => storage.setItem('hike', { n: 1 })).not.toThrow();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('disk full');
    });

    it('tries the same value again after a write that threw', () => {
      const base = fakeBase({ throwWrites: true });
      const { storage, time } = make({ base });
      storage.setItem('hike', { n: 1 });
      time.now += 6000;
      storage.setItem('hike', { n: 1 });
      expect(base.setItem).toHaveBeenCalledTimes(2);
    });

    it('does not break when the failure has no message', async () => {
      const base = fakeBase();
      base.setItem = jest.fn(() => Promise.reject(undefined));
      const { storage, warn } = make({ base });
      storage.setItem('hike', { n: 1 });
      await flushPromises();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('hike');
    });

    it('does not break when storage answers at once', () => {
      const base = fakeBase();
      base.setItem = jest.fn(() => undefined);
      const { storage, warn } = make({ base });
      expect(() => storage.setItem('hike', { n: 1 })).not.toThrow();
      expect(warn).not.toHaveBeenCalled();
    });

    it('says so for something that cannot be turned into text, and writes nothing', () => {
      const loop = {};
      loop.self = loop;
      const { storage, base, warn } = make();
      expect(() => storage.setItem('hike', loop)).not.toThrow();
      expect(base.setItem).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('hike');
    });

    it('still saves the next good change after one it could not turn into text', () => {
      const loop = {};
      loop.self = loop;
      const { storage, base, time } = make();
      storage.setItem('hike', loop);
      time.now += 6000;
      storage.setItem('hike', { n: 2 });
      expect(base.setItem).toHaveBeenCalledTimes(1);
      expect(base.setItem).toHaveBeenCalledWith('hike', JSON.stringify({ n: 2 }));
    });
  });

  describe('with the real clock and timers', () => {
    beforeEach(() => jest.useFakeTimers({ now: 5_000_000, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }));
    afterEach(() => jest.useRealTimers());

    it('writes the first change at once and a later one after five seconds', () => {
      const base = fakeBase();
      const storage = createThrottledStorage(() => base);
      storage.setItem('hike', { n: 1 });
      expect(base.setItem).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(2000);
      storage.setItem('hike', { n: 2 });
      expect(base.setItem).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(2999);
      expect(base.setItem).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(1);
      expect(base.setItem).toHaveBeenCalledTimes(2);
      expect(base.setItem).toHaveBeenLastCalledWith('hike', JSON.stringify({ n: 2 }));
    });

    it('does not write after a flush has already written it', () => {
      const base = fakeBase();
      const storage = createThrottledStorage(() => base);
      storage.setItem('hike', { n: 1 });
      jest.advanceTimersByTime(1000);
      storage.setItem('hike', { n: 2 });
      storage.flush();
      jest.advanceTimersByTime(10_000);
      expect(base.setItem).toHaveBeenCalledTimes(2);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('warns on the console when saving fails', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const base = fakeBase({ throwWrites: true });
      createThrottledStorage(() => base).setItem('hike', { n: 1 });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('throttledStorage');
      warn.mockRestore();
    });
  });
});
