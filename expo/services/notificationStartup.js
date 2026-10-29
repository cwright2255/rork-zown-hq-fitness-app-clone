// services/notificationStartup.js
//
// What the app does with notifications from the moment it starts (called once from app/_layout.jsx):
//
//   1. Registers the handler that shows a notification while the app is open. Without it, iOS drops a reminder that arrives while
//      the app is in front, so a cooking timer or a calendar reminder that fires during use is never seen.
//   2. Follows the Notifications switch (Settings, and the Notifications screen). The calendar's reminders, the fasting goal alert
//      and the cooking timers check it before they set one (lib/remindersAllowed.js); this clears the ones already set when it is
//      turned off, and sets the calendar's again when it is turned back on. (The fasting card sets its own alert again, because
//      only it knows the fast that is running.)
//
// startNotifications() can be called any number of times: it does its work once.
import { notificationService } from './notificationService';
import { reconcileReminders } from './calendarReminders';
import { cancelFastAlert } from './fastingAlert';
import { useSettingsStore } from '@/store/settingsStore';

const COOKING_TIMER = 'cooking-timer';

let started = false;

// Each step on its own, so one that fails cannot stop the others (a cooking timer that would not cancel must not leave the calendar's
// reminders set).
async function attempt(what, step) {
  try {
    await step();
  } catch (e) {
    console.warn(`[notificationStartup] could not ${what}:`, e?.message);
  }
}

async function whenSwitched(on) {
  if (!on) {
    // Anything set earlier must not ring: the fasting goal alert and any cooking timer that is running.
    await attempt('clear the fasting alert', cancelFastAlert);
    await attempt('clear the cooking timers', () => notificationService.cancelNotificationsByType(COOKING_TIMER));
  }
  // Clears the calendar's reminders when off (reconcileReminders sets none), and sets the next ones again when on.
  await attempt('update the calendar reminders', () => reconcileReminders());
}

export function startNotifications() {
  if (started) return;
  started = true;
  notificationService.setupNotificationHandler();

  let was = useSettingsStore.getState().notifications !== false;
  useSettingsStore.subscribe((state) => {
    const is = state.notifications !== false;
    if (is === was) return;
    was = is;
    void whenSwitched(is);
  });
}
