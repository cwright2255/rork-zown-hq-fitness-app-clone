// services/appUpdates.js
//
// New versions of the app's code reach a phone as updates (EAS Update). This looks for one while the app is open and, if there is
// one, downloads it in the background. A downloaded update takes effect the next time the app is opened from scratch: it is never
// applied by restarting the app that is open, because a restart in the middle of a workout, a meal being logged or a run being
// recorded throws away what the person was doing.
//
// (The one place that does restart the app for an update is the "Check for updates" row in Settings, which the person taps.)
//
// Called once when the app starts (app/_layout.jsx). It never throws, and it does nothing in development, in Expo Go and on a
// build that has updates switched off, where checking fails and the app just carries on with what it has.
import * as Updates from 'expo-updates';

/** Resolves 'skipped' (development), 'none' (nothing new), 'downloaded' (it will be used next launch) or 'failed'. */
export async function fetchUpdateForNextLaunch() {
  if (__DEV__) return 'skipped';
  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result || !result.isAvailable) return 'none';
    await Updates.fetchUpdateAsync();
    return 'downloaded';
  } catch (e) {
    console.log('[Updates] could not fetch an update, carrying on with the current version:', e?.message);
    return 'failed';
  }
}
