// lib/remindersAllowed.js
//
// Whether the reminders the app sets on this phone may be set: the "Notifications" switch in Settings (and on the Notifications screen),
// which is the `notifications` setting. It is on unless the person has turned it off. The three things that set a reminder (the
// calendar's, the fasting goal alert and the cooking timer) ask this before they schedule one; services/notificationStartup.js clears
// the ones already set when it is turned off and sets them again when it is turned back on.
//
// Not covered: the off-route warning on a hike (services/offRouteWatch.js). That is a safety alert for a hike the person has started,
// not a reminder.
import { useSettingsStore } from '@/store/settingsStore';

export function remindersAllowed() {
  return useSettingsStore.getState().notifications !== false;
}
