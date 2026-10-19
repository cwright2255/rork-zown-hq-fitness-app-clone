// services/calendarReminders.js
//
// Keeps the phone's reminders in step with the calendar. The calendar's events are the truth (store/scheduleStore.js); the
// reminders on the phone are rebuilt from them: every calendar reminder is cleared and the next ones are set again, so a
// reminder can never be left behind for an event that was removed, moved, ticked off or had its reminder changed.
//
// Only the next MAX_REMINDERS reminders are set (lib/calendarEvents.js reminderPlan), because iOS holds 64 pending reminders for
// the whole app and the calendar must leave room for the others. The rest are set the next time this runs, which is after every
// change to the calendar and each time the app opens.
import { notificationService } from './notificationService';
import { useScheduleStore } from '../store/scheduleStore';
import { reminderContent, reminderPlan } from '../lib/calendarEvents';

const TYPE = 'schedule-event';

let queue = Promise.resolve();

async function run(now) {
  const plan = reminderPlan(useScheduleStore.getState().events, now);
  await notificationService.cancelNotificationsByType(TYPE);
  if (plan.length === 0) return { scheduled: 0, blocked: false };
  if (!(await notificationService.hasPermission())) return { scheduled: 0, blocked: true };
  let scheduled = 0;
  for (const item of plan) {
    const id = await notificationService.scheduleCalendarReminder(reminderContent(item), item.fireAt, item.eventId);
    if (id) scheduled += 1;
  }
  return { scheduled, blocked: false };
}

/**
 * Rebuilds the reminders from the calendar as it is now. One run at a time, in order, so two quick changes cannot interleave.
 * Never throws.
 * @returns {Promise<{ scheduled: number, blocked: boolean }>} blocked: there are reminders to set but notifications are off
 */
export function reconcileReminders(now = new Date()) {
  const result = queue.then(() => run(now));
  queue = result.catch(() => undefined);
  return result.catch((e) => {
    console.warn('[calendarReminders] could not set reminders:', e?.message);
    return { scheduled: 0, blocked: false };
  });
}

/** Asks for notification permission (the phone shows its own prompt the first time), for when a reminder is first wanted. */
export async function askForReminderPermission() {
  try {
    return await notificationService.requestPermissions();
  } catch {
    return false;
  }
}
