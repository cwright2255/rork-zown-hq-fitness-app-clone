// lib/fastingPlans.js
//
// The fasting lengths the Fasting widget offers, and the rules for a length the
// person types in themselves. Pure, so the widget, the saved history and the
// tests all read the same list.

/** The longest fast the widget will start, in hours. */
export const MAX_FAST_HOURS = 72;
/** Above this many hours the widget shows a short "check with your doctor" note. */
export const LONG_FAST_NOTE_HOURS = 24;

/** The plan ids saved with a fast. 'custom' is a length the person typed. */
export const CUSTOM_PLAN_ID = 'custom';

// In order of length, so the pills read 13, 16, 18, 20, OMAD, 24, 36.
export const FASTING_PLANS = [
  { id: '13', label: '13h', hours: 13, name: 'Circadian' },
  { id: '16', label: '16h', hours: 16, name: '16:8' },
  { id: '18', label: '18h', hours: 18, name: '18:6' },
  { id: '20', label: '20h', hours: 20, name: '20:4' },
  { id: 'omad', label: 'OMAD', hours: 23, name: 'One meal a day' },
  { id: '24', label: '24h', hours: 24, name: 'A full day' },
  { id: '36', label: '36h', hours: 36, name: 'Extended' },
];

export const DEFAULT_PLAN_ID = '16';

export function planById(id) {
  return FASTING_PLANS.find((p) => p.id === id) || null;
}

/**
 * The Custom length moves with − and + buttons (a number pad would cover the Start
 * button on the Home screen). Whole hours from MIN_CUSTOM_HOURS to MAX_FAST_HOURS.
 */
export const MIN_CUSTOM_HOURS = 1;
export const DEFAULT_CUSTOM_HOURS = 16;

/** `current` hours moved by `delta`, kept between 1 and MAX_FAST_HOURS (a bad `current` starts from 16). */
export function stepCustomHours(current, delta) {
  const base = typeof current === 'number' && Number.isFinite(current) ? Math.round(current) : DEFAULT_CUSTOM_HOURS;
  const move = typeof delta === 'number' && Number.isFinite(delta) ? Math.round(delta) : 0;
  return Math.min(MAX_FAST_HOURS, Math.max(MIN_CUSTOM_HOURS, base + move));
}

/**
 * What to call a fast: its plan's label (13h, OMAD), or just "{hours}h" for a
 * custom length or a fast saved before plans were kept.
 */
export function fastLabel(targetHours, planId) {
  const plan = planById(planId);
  return plan && plan.hours === targetHours ? plan.label : `${targetHours}h`;
}

/** The plan to remember for a start: the picked plan's id, or 'custom'. */
export function planIdFor(selectedId) {
  return planById(selectedId) ? selectedId : CUSTOM_PLAN_ID;
}
