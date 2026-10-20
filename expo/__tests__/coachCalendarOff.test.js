// What the coach is told, and what it may propose, when Settings > AI Coach > "Let the coach add to my calendar" is off
// (lib/coachActions.js and services/coachService.js). The pieces that run the actions are in coachCalendarOffRun.test.js.
jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), addDoc: jest.fn(), query: jest.fn(), where: jest.fn(), getDocs: jest.fn(), orderBy: jest.fn(), limit: jest.fn(),
  serverTimestamp: jest.fn(), doc: jest.fn(), setDoc: jest.fn(), getDoc: jest.fn(),
}), { virtual: true });

import {
  buildActionInstructions, normalizeActions, describeActions, extractCoachAction, CALENDAR_OFF_NOTE, LIMITS,
} from '../lib/coachActions';
import { buildCoachSystemPrompt } from '../services/coachService';

// Wed 2026-10-07 09:00 local time
const NOW = new Date(2026, 9, 7, 9, 0, 0);
const OFF = 'The user has turned off "Let the coach add to my calendar" in Settings';

const workout = { type: 'workout_plan', workouts: [{ name: 'Leg day', exercises: [{ name: 'Squat', sets: 4, reps: 5 }] }] };
const event = (o = {}) => ({ title: 'Leg day', kind: 'workout', date: '2026-10-08', time: '07:00', ...o });
const schedule = (events) => ({ type: 'schedule', events });
const meal = (o = {}) => ({ date: '2026-10-08', time: '08:00', mealType: 'breakfast', name: 'Oats', description: 'Oats and berries', ...o });
const nutrition = (meals, dailyGoals) => ({ type: 'nutrition_plan', meals, ...(dailyGoals ? { dailyGoals } : {}) });
const GOALS = { calories: 2400, protein: 180, carbs: 250, fat: 70 };
const run = (raw, options = {}) => normalizeActions(raw, { now: NOW, ...options });
const types = (result) => result.actions.map((a) => a.type);

describe('buildActionInstructions', () => {
  it('is the calendar-on text when no option is given', () => {
    expect(buildActionInstructions(NOW)).toBe(buildActionInstructions(NOW, { calendar: true }));
    expect(buildActionInstructions(NOW, {})).toBe(buildActionInstructions(NOW, { calendar: true }));
  });

  describe('with the calendar on', () => {
    const text = buildActionInstructions(NOW, { calendar: true });

    it('lets the coach schedule things and plan meals', () => {
      expect(text).toContain('schedule something or put it on their calendar');
      expect(text).toContain('{"type":"schedule","events":[');
      expect(text).toContain('"meals":[{"date":"YYYY-MM-DD"');
      expect(text).toContain('send a workout_plan and a schedule action together');
    });

    it('does not mention the switch', () => {
      expect(text).not.toContain('Let the coach add to my calendar');
    });
  });

  describe('with the calendar off', () => {
    const text = buildActionInstructions(NOW, { calendar: false });

    it('tells the coach it cannot use the calendar, and why', () => {
      expect(text).toContain(OFF);
      expect(text).toContain('never send a "schedule" action and never put meals in a nutrition_plan');
      expect(text).toContain('turn it on in Settings');
    });

    it('takes the schedule action out of what the coach may send', () => {
      expect(text).not.toContain('{"type":"schedule"');
      expect(text).not.toContain('send a workout_plan and a schedule action together');
      expect(text).not.toContain('schedule something or put it on their calendar');
    });

    it('takes the meals out of the nutrition plan and keeps the daily targets', () => {
      expect(text).not.toContain('"meals":[{');
      expect(text).toContain('{"type":"nutrition_plan","dailyGoals":{"calories":number,"protein":number,"carbs":number,"fat":number}}');
      expect(text).toContain('Do not add a "meals" list');
    });

    it('still lets the coach save workouts and goals', () => {
      expect(text).toContain('{"type":"workout_plan"');
      expect(text).toContain('{"type":"goal"');
      expect(text).toContain('build or save a workout plan, or make a nutrition or meal plan');
    });

    it('still ends with the rule about plain text', () => {
      expect(text.endsWith('Write all replies as plain text: do not use markdown symbols such as # or **.')).toBe(true);
    });

    it('is the same date line and block format as the calendar-on text', () => {
      const on = buildActionInstructions(NOW, { calendar: true });
      expect(text.slice(0, 120)).toBe(on.slice(0, 120));
      expect(text).toContain('<zown_action>JSON</zown_action>');
    });
  });
});

describe('buildCoachSystemPrompt', () => {
  const user = { name: 'Sam', fitnessMetrics: {} };

  it('carries the calendar-on instructions by default, and with calendar: true', () => {
    const byDefault = buildCoachSystemPrompt(user, NOW).content;
    expect(byDefault).toContain('{"type":"schedule"');
    expect(byDefault).not.toContain(OFF);
    expect(buildCoachSystemPrompt(user, NOW, { calendar: true }).content).toBe(byDefault);
  });

  it('carries the calendar-off instructions with calendar: false', () => {
    const off = buildCoachSystemPrompt(user, NOW, { calendar: false }).content;
    expect(off).toContain(OFF);
    expect(off).not.toContain('{"type":"schedule"');
  });

  it('keeps the rest of the prompt the same', () => {
    const on = buildCoachSystemPrompt(user, NOW, { calendar: true }).content;
    const off = buildCoachSystemPrompt(user, NOW, { calendar: false }).content;
    expect(off.startsWith(on.slice(0, on.indexOf('You can create things inside')))).toBe(true);
    expect(buildCoachSystemPrompt(user, NOW, { calendar: false }).role).toBe('system');
  });
});

describe('normalizeActions with the calendar off', () => {
  it('leaves a schedule out, and counts the events it left out', () => {
    const result = run([schedule([event(), event({ title: 'Easy run', kind: 'run', time: '18:00' })])], { calendar: false });
    expect(result.actions).toEqual([]);
    expect(result.calendarBlocked).toBe(2);
  });

  it('keeps the workouts and goals that came with it', () => {
    const goal = { type: 'goal', goals: [{ title: 'Squat 300', target: 300, unit: 'lb' }] };
    const result = run([workout, schedule([event()]), goal], { calendar: false });
    expect(types(result)).toEqual(['workout_plan', 'goal']);
    expect(result.calendarBlocked).toBe(1);
  });

  it('keeps the daily targets of a nutrition plan, with no meals', () => {
    const result = run([nutrition([meal(), meal({ name: 'Rice bowl', mealType: 'lunch', time: '12:30' })], GOALS)], { calendar: false });
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({ type: 'nutrition_plan', dailyGoals: GOALS, meals: [] });
    expect(result.calendarBlocked).toBe(2);
  });

  it('drops a nutrition plan that was only meals', () => {
    const result = run([nutrition([meal(), meal({ name: 'Rice bowl' })])], { calendar: false });
    expect(result.actions).toEqual([]);
    expect(result.calendarBlocked).toBe(2);
  });

  it('describes what is left without any calendar line', () => {
    const result = run([workout, schedule([event()]), nutrition([meal()], GOALS)], { calendar: false });
    const lines = describeActions(result.actions);
    expect(lines).toHaveLength(2);
    expect(lines.join(' ')).not.toMatch(/calendar/i);
  });

  it('counts the events the coach sent that are objects, and the meals that have a name', () => {
    const result = run([schedule([event(), null, 'x', 5, event({ title: '' })]), nutrition([meal(), null, meal({ name: '' }), meal({ name: 'Rice' })])], { calendar: false });
    expect(result.calendarBlocked).toBe(2 + 2);
  });

  it('counts no more than the coach is allowed to send', () => {
    const many = Array.from({ length: LIMITS.events + 10 }, (_, i) => event({ title: `Event ${i}` }));
    expect(run([schedule(many)], { calendar: false }).calendarBlocked).toBe(LIMITS.events);
    const meals = Array.from({ length: LIMITS.meals + 10 }, (_, i) => meal({ name: `Meal ${i}` }));
    expect(run([nutrition(meals)], { calendar: false }).calendarBlocked).toBe(LIMITS.meals);
  });

  it('counts an event that would have been dropped anyway, since the switch left it out too', () => {
    const result = run([schedule([event({ date: '2020-01-01' })])], { calendar: false });
    expect(result.actions).toEqual([]);
    expect(result.calendarBlocked).toBe(1);
  });

  it('does not check left-out meals against the food rules, since none are kept', () => {
    const user = { fitnessMetrics: { foodAllergies: ['dairy'] } };
    const result = run([nutrition([meal({ name: 'Greek yogurt bowl', description: 'yogurt, berries, honey' })], GOALS)], { calendar: false, user });
    expect(result.blocked).toEqual([]);
    expect(result.actions[0].blocked).toEqual([]);
  });

  it('reads the same from a raw coach reply', () => {
    const reply = `Booked.\n<zown_action>${JSON.stringify([schedule([event()])])}</zown_action>`;
    const result = run(extractCoachAction(reply).actions, { calendar: false });
    expect(result.actions).toEqual([]);
    expect(result.calendarBlocked).toBe(1);
  });
});

describe('normalizeActions with the calendar on', () => {
  const all = [workout, schedule([event()]), nutrition([meal()], GOALS)];

  it('is the same with the option left out, set to true, or undefined', () => {
    const base = run(all);
    expect(run(all, { calendar: true })).toEqual(base);
    expect(run(all, { calendar: undefined })).toEqual(base);
  });

  it('keeps the schedule and the meals, and counts none as left out', () => {
    const result = run(all);
    expect(types(result)).toEqual(['workout_plan', 'schedule', 'nutrition_plan']);
    expect(result.actions[2].meals).toHaveLength(1);
    expect(result.calendarBlocked).toBe(0);
  });

  it('keeps a nutrition plan that is only meals, which the switch off drops', () => {
    const result = run([nutrition([meal(), meal({ name: 'Rice bowl', mealType: 'lunch' })])]);
    expect(types(result)).toEqual(['nutrition_plan']);
    expect(result.actions[0].meals).toHaveLength(2);
    expect(result.actions[0].dailyGoals).toEqual({});
  });

  it('still checks meals against the food rules', () => {
    const user = { fitnessMetrics: { foodAllergies: ['dairy'] } };
    const meals = [meal({ name: 'Greek yogurt bowl', description: 'yogurt, berries, honey' }), meal({ name: 'Chicken rice bowl', mealType: 'lunch', description: 'grilled chicken, rice' })];
    const result = run([nutrition(meals, GOALS)], { user });
    expect(result.blocked.map((b) => b.name)).toEqual(['Greek yogurt bowl']);
    expect(result.actions[0].meals).toHaveLength(1);
  });
});

describe('CALENDAR_OFF_NOTE', () => {
  it('names the setting the way Settings does, and where to find it', () => {
    expect(CALENDAR_OFF_NOTE).toBe('I can\'t add things to your calendar while "Let the coach add to my calendar" is off. You can turn it on in Settings.');
  });
});
