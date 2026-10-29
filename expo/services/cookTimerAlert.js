// services/cookTimerAlert.js
//
// A notification for a cooking timer, so it still rings when the phone is locked
// or another app is open. Only if notifications are already allowed; nothing
// here asks for permission in the middle of cooking.

import * as Notifications from 'expo-notifications';
import { remindersAllowed } from '../lib/remindersAllowed';

/** Schedules the alert for `seconds` from now. Returns its id, or null if it was not scheduled (including when the Notifications switch in Settings is off). */
export async function scheduleTimerAlert(seconds, { title, body } = {}) {
  if (!remindersAllowed()) return null;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return null;
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true, data: { type: 'cooking-timer' } },
      trigger: { type: 'timeInterval', seconds: Math.max(1, Math.round(seconds)), repeats: false },
    });
  } catch (e) {
    console.warn('[cookTimer] could not schedule the alert:', e?.message);
    return null;
  }
}

/** Cancels an alert from scheduleTimerAlert (a null id does nothing). */
export async function cancelTimerAlert(id) {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (e) {
    console.warn('[cookTimer] could not cancel the alert:', e?.message);
  }
}
