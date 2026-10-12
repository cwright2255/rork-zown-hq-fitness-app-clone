// lib/throttledStorage.js
//
// A zustand `persist` storage that does not write on every change. A hike in
// progress changes every second, and writing the whole route to the phone that
// often would be wasteful, so changes are held and the latest one is written at
// most once every SAVE_EVERY_MS. flush() writes whatever is waiting right away
// (call it when something important happens, or when the app leaves the screen).
//
// `getBase` returns the underlying key/value storage (AsyncStorage: getItem,
// setItem and removeItem returning promises of text), or null when there is none.
// With none, nothing is saved or loaded and nothing is thrown. Time and timers
// can be passed in so the waiting can be tested without waiting.

export const SAVE_EVERY_MS = 5000;

const parse = (text) => {
  if (typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
};

export function createThrottledStorage(getBase, {
  intervalMs = SAVE_EVERY_MS,
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  warn = (message) => console.warn(message),
} = {}) {
  const pending = new Map(); // name -> the newest value, not written yet
  const written = new Map(); // name -> the text last written, so an unchanged value is not written again
  let lastWrite = -Infinity;
  let timer = null;

  const writeOne = (name, value) => {
    let text;
    try {
      text = JSON.stringify(value);
    } catch (e) {
      warn(`[throttledStorage] could not save ${name}: ${e && e.message}`);
      return;
    }
    if (text === written.get(name)) return;
    const base = getBase();
    if (!base) return;
    written.set(name, text);
    const failed = (e) => {
      written.delete(name); // try again with the next change
      warn(`[throttledStorage] could not save ${name}: ${e && e.message}`);
    };
    try {
      const result = base.setItem(name, text);
      if (result && typeof result.catch === 'function') result.catch(failed);
    } catch (e) {
      failed(e);
    }
  };

  /** Writes everything waiting, now. */
  const flush = () => {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
    if (pending.size === 0) return;
    const waiting = [...pending];
    pending.clear();
    lastWrite = now();
    waiting.forEach(([name, value]) => writeOne(name, value));
  };

  return {
    flush,

    getItem(name) {
      // A change still waiting is newer than anything stored.
      if (pending.has(name)) return pending.get(name);
      const base = getBase();
      if (!base) return null;
      try {
        return Promise.resolve(base.getItem(name)).then(parse, () => null);
      } catch (e) {
        return null;
      }
    },

    setItem(name, value) {
      if (!getBase()) return; // nowhere to save to
      pending.set(name, value);
      const wait = lastWrite + intervalMs - now();
      if (wait <= 0) {
        flush();
      } else if (timer === null) {
        timer = setTimer(flush, wait);
        // A save still waiting must not keep a process alive (tests, scripts).
        if (timer && typeof timer.unref === 'function') timer.unref();
      }
    },

    removeItem(name) {
      pending.delete(name);
      written.delete(name);
      const base = getBase();
      if (!base) return;
      try {
        const result = base.removeItem(name);
        if (result && typeof result.catch === 'function') result.catch(() => {});
      } catch (e) {
        /* nothing to remove */
      }
    },
  };
}
