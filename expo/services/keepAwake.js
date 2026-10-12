// services/keepAwake.js
//
// Stops the screen from going dark while a screen needs it on (cooking mode, with
// floury hands). expo-keep-awake comes with Expo; it is loaded only when needed,
// and can be passed in, so a phone without it just lets the screen sleep.

// require() inside a function so a test can stand in for the module.
function loadModule() {
  try {
    return require('expo-keep-awake');
  } catch (e) {
    return null;
  }
}

/**
 * Keeps the screen on until the returned function is called.
 * @param tag   names the request, so two screens can ask at once
 * @param deps  { module } to use instead of expo-keep-awake (tests)
 * @returns {() => void}
 */
export function keepScreenOn(tag = 'cooking', deps = {}) {
  const mod = deps.module !== undefined ? deps.module : loadModule();
  if (!mod || typeof mod.activateKeepAwakeAsync !== 'function' || typeof mod.deactivateKeepAwake !== 'function') {
    return () => {};
  }
  const quiet = (run) => {
    try {
      Promise.resolve(run()).catch(() => {});
    } catch (e) {
      // The screen may sleep; nothing else depends on it.
    }
  };
  quiet(() => mod.activateKeepAwakeAsync(tag));
  return () => quiet(() => mod.deactivateKeepAwake(tag));
}
