// services/fastingAlert.js
//
// The notification that tells a person their fast has reached its goal, so they
// hear about it with the phone locked or Zown closed. There is only ever one,
// under a fixed id: starting a fast, moving its start time, or opening the app
// on a fast that is already running all schedule it again and replace the old
// one, and ending the fast cancels it.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { formatHours, goalTime } from '../lib/fastingStats';
import { remindersAllowed } from '../lib/remindersAllowed';

export const FAST_ALERT_ID = 'zown-fasting-goal';

// 'granted', 'not-allowed' (not asked yet, or just turned down), or 'blocked'
// (the phone will not ask again, so only the Settings app can turn it on).
async function permission(ask) {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return 'granted';
  if (current.canAskAgain === false) return 'blocked';
  if (!ask) return 'not-allowed';
  const asked = await Notifications.requestPermissionsAsync();
  return asked.status === 'granted' ? 'granted' : 'not-allowed';
}

/** Cancels the goal alert (nothing happens if there is none). */
export async function cancelFastAlert() {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(FAST_ALERT_ID);
  } catch (e) {
    console.warn('[fastingAlert] could not cancel the alert:', e?.message);
  }
}

/**
 * Schedules the alert for the moment the fast reaches `targetHours`.
 * `ask: true` may show the phone's permission prompt, for when the person has just
 * tapped Start; leave it off to only use a permission already given.
 * Returns:
 *   'scheduled'       - it will ring
 *   'already-reached' - the goal time has passed, so there is nothing to ring for
 *   'not-allowed'     - notifications are not on for Zown yet (not asked, or turned down)
 *   'blocked'         - notifications are off for Zown and only the Settings app can change that
 *   'turned-off'      - the Notifications switch in Settings is off, so no alert is set (and any set earlier is cleared)
 *   'unavailable'     - not on this device (web), or the phone would not schedule it
 */
export async function scheduleFastAlert({ startedAt, targetHours }, { ask = false, now = new Date() } = {}) {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    const when = goalTime(startedAt, targetHours);
    // An alert left from an earlier start time must not ring for a fast that has moved.
    await cancelFastAlert();
    if (!remindersAllowed()) return 'turned-off';
    if (when.getTime() <= now.getTime()) return 'already-reached';
    const permitted = await permission(ask);
    if (permitted !== 'granted') return permitted;
    await Notifications.scheduleNotificationAsync({
      identifier: FAST_ALERT_ID,
      content: {
        title: 'You hit your fasting goal',
        body: `You've fasted ${formatHours(targetHours)}. Open Zown HQ to end your fast.`,
        sound: true,
        data: { type: 'fasting-goal' },
      },
      trigger: { type: 'date', date: when },
    });
    return 'scheduled';
  } catch (e) {
    console.warn('[fastingAlert] could not schedule the alert:', e?.message);
    return 'unavailable';
  }
}
