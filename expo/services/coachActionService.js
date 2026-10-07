// services/coachActionService.js
//
// Runs the actions the AI coach proposed AFTER the user tapped Yes in the
// chat (app/coach.jsx). The actions have already been validated and cleaned
// by lib/coachActions.js normalizeActions - this file only writes them to
// the app's real stores:
//   workout_plan   -> store/workoutStore.js addWorkout (shows in My Workouts)
//   schedule       -> store/scheduleStore.js (shows on the Calendar) plus a
//                     reminder notification for each future event
//   nutrition_plan -> store/nutritionStore.js daily targets, and each meal
//                     as a Calendar event
// Each action runs on its own, so one failing does not undo or block the
// others, and the result reports exactly what did and did not happen.
import { useWorkoutStore } from '../store/workoutStore';
import { useNutritionStore } from '../store/nutritionStore';
import { useScheduleStore } from '../store/scheduleStore';
import { notificationService } from './notificationService';
import { buildEventRecords } from '../lib/scheduleUtils';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

async function saveWorkouts(action, user, created) {
  const baseId = Date.now();
  for (let i = 0; i < action.workouts.length; i += 1) {
    const workout = action.workouts[i];
    // Unique ids: addWorkout falls back to a millisecond timestamp, which
    // would collide when several workouts are saved in one go.
    const saved = await useWorkoutStore.getState().addWorkout({ ...workout, id: `coach-${baseId}-${i}` }, user?.uid);
    created.push({ id: saved.id, name: workout.name });
  }
  return `saved ${plural(action.workouts.length, 'workout')} to My Workouts`;
}

async function addToCalendar(events, workoutIdsByName) {
  const records = buildEventRecords(events, workoutIdsByName);
  let reminders = 0;
  let remindersBlocked = false;

  const wantsReminder = records.some((r) => r.kind !== 'nutrition' && new Date(r.start).getTime() > Date.now());
  if (wantsReminder) {
    try {
      // Asked now, right after the user said yes, so the prompt makes sense.
      await notificationService.requestPermissions();
    } catch {
      // handled below: no reminder will come back as scheduled
    }
  }

  for (const record of records) {
    // Meals show on the calendar but do not buzz the phone; a plan can hold
    // 20+ meals and iOS only keeps 64 pending notifications in total.
    if (record.kind === 'nutrition') continue;
    const id = await notificationService.scheduleEventReminder(record.title, record.kind, new Date(record.start));
    if (id) {
      record.notificationId = id;
      reminders += 1;
    } else if (new Date(record.start).getTime() > Date.now()) {
      remindersBlocked = true;
    }
  }

  useScheduleStore.getState().addEvents(records);
  return { count: records.length, reminders, remindersBlocked };
}

/**
 * @param {object[]} actions  output of normalizeActions().actions
 * @param {object} user       the signed-in user (uses user.uid)
 * @returns {Promise<{ message: string, links: {label:string, route:string}[], failures: string[] }>}
 */
export async function executeCoachActions(actions, user) {
  const done = [];
  const links = [];
  const failures = [];
  const created = [];
  let remindersBlocked = false;

  // Workouts first so calendar events in the same plan can link to them.
  const ordered = [...actions].sort((a, b) => (a.type === 'workout_plan' ? -1 : 0) - (b.type === 'workout_plan' ? -1 : 0));

  for (const action of ordered) {
    try {
      if (action.type === 'workout_plan') {
        done.push(await saveWorkouts(action, user, created));
        links.push({ label: 'Open My Workouts', route: '/workouts' });
      } else if (action.type === 'schedule') {
        const byName = Object.fromEntries(created.map((c) => [c.name.toLowerCase(), c.id]));
        const result = await addToCalendar(action.events, byName);
        remindersBlocked = remindersBlocked || result.remindersBlocked;
        done.push(`added ${plural(result.count, 'event')} to your calendar`);
        links.push({ label: 'Open Calendar', route: '/calendar' });
      } else if (action.type === 'nutrition_plan') {
        if (action.dailyGoals && Object.keys(action.dailyGoals).length > 0) {
          useNutritionStore.getState().updateDailyGoals(action.dailyGoals);
          // Marks the targets as freshly set so the automatic 14-day
          // recalculation does not immediately overwrite them.
          useNutritionStore.setState({ dailyGoalsUpdatedAt: new Date().toISOString() });
          done.push('updated your daily nutrition targets');
          links.push({ label: 'Open Nutrition', route: '/nutrition' });
        }
        if (action.meals && action.meals.length > 0) {
          const byName = {};
          const result = await addToCalendar(action.meals, byName);
          done.push(`added ${plural(result.count, 'meal')} to your calendar`);
          if (!links.some((l) => l.route === '/calendar')) links.push({ label: 'Open Calendar', route: '/calendar' });
        }
      }
    } catch (e) {
      console.warn('[coachActions] action failed:', action.type, e?.message);
      failures.push(action.type);
    }
  }

  let message;
  if (done.length > 0) {
    const joined = done.length > 1 ? `${done.slice(0, -1).join(', ')} and ${done[done.length - 1]}` : done[0];
    message = `Done - I ${joined}.`;
    if (remindersBlocked) {
      message += ' Notifications are off for ZOWN, so there will be no reminder pings; turn them on in your phone settings if you want them.';
    }
    if (failures.length > 0) {
      message += ` Something went wrong with ${failures.length === 1 ? 'one part' : 'some parts'}, so that part was not saved.`;
    }
  } else {
    message = "Sorry, I couldn't save that. Nothing was changed - please try again.";
  }
  return { message, links, failures };
}
