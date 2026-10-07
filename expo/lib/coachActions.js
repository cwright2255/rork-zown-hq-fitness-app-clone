// lib/coachActions.js
//
// Lets the AI coach propose real changes (a workout plan, calendar events,
// a nutrition plan) without ever making them on its own.
//
// How it works:
//   1. The coach's system prompt (buildActionInstructions) tells the model
//      to describe what it would create, end with a yes/no question, and
//      append one machine-readable <zown_action>JSON</zown_action> block.
//   2. extractCoachAction pulls that block out of the reply so the user
//      never sees raw JSON, and parses it.
//   3. normalizeActions validates and clamps everything the model wrote -
//      model output is never trusted as-is - and drops meals that mention
//      a food the user is allergic to or avoids.
//   4. The screen shows the plan with Yes / No buttons. Only "Yes" calls
//      services/coachActionService.js, which writes to the real stores.
//
// Pure functions only (no React Native, Firebase or store imports) so the
// whole thing is unit tested.

import { getDietProfile } from './dietProfile';

export const ACTION_TAG = 'zown_action';

export const LIMITS = {
  workouts: 7,
  exercisesPerWorkout: 12,
  events: 30,
  meals: 28,
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EVENT_KINDS = ['workout', 'run', 'nutrition', 'other'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const DEFAULT_MEAL_TIME = { breakfast: '08:00', lunch: '12:30', dinner: '18:30', snack: '15:30' };

const pad2 = (n) => String(n).padStart(2, '0');

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export function formatDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function buildActionInstructions(now = new Date()) {
  const today = `${WEEKDAYS[now.getDay()]} ${formatDateKey(now)}`;
  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  return [
    'You can create things inside the user\'s ZOWN app, but only after they say yes.',
    `Today is ${today} and the local time is ${time}; use that to turn "tomorrow" or "Monday" into real dates.`,
    'When the user asks you to build or save a workout plan, schedule something or put it on their calendar, or make a nutrition or meal plan:',
    '(1) Reply in plain text with a short summary of what you would create.',
    '(2) End that text with one yes/no question such as "Want me to add this to your workouts?". Never say it has already been created.',
    `(3) On a new line after the question, add exactly one block: <${ACTION_TAG}>JSON</${ACTION_TAG}>. The app hides this block and shows Yes and No buttons, and nothing is created unless they tap Yes.`,
    'Only add the block when they actually asked you to create, schedule or plan something. For ordinary questions and advice, answer normally with no block. If you are missing something essential (for example which days they can train), ask one short question first instead of guessing; otherwise pick sensible defaults and mention them in your summary.',
    'The JSON is an array of actions, each one of these shapes:',
    '{"type":"workout_plan","workouts":[{"name":string,"description":string,"exercises":[{"name":string,"sets":number,"reps":number or a range string like "8-12","restSeconds":number}]}]} - one workout per training day, at most 7 workouts and 12 exercises each.',
    '{"type":"schedule","events":[{"title":string,"kind":"workout"|"run"|"nutrition"|"other","date":"YYYY-MM-DD","time":"HH:mm" in 24-hour time,"notes":string,"workout":the name of a workout from the same block, optional}]} - at most 30 events; write every repeat out as its own event.',
    '{"type":"nutrition_plan","dailyGoals":{"calories":number,"protein":number,"carbs":number,"fat":number},"meals":[{"date":"YYYY-MM-DD","time":"HH:mm","mealType":"breakfast"|"lunch"|"dinner"|"snack","name":string,"description":string}]} - macros in grams, at most 28 meals, and dailyGoals and meals are each optional.',
    'To save a workout and also put it on the calendar, send a workout_plan and a schedule action together in the same block.',
    'When the plan is meant to improve a specific lift or skill (for example "improve my bench press"), never fill it with only that lift. Build a complete program: the main lift once or twice a week (a heavy day and a lighter or variation day), plus supporting work for the muscles and weak points that drive it. For bench press that means overhead press or incline dumbbell press, triceps work (close-grip bench, dips, extensions), upper back and rear delts (rows, face pulls, pull-ups) for stability, and core. Spread the work across training days, keep each workout to 5-8 exercises, say in each workout description how to progress (for example add weight once every set reaches the top of the rep range), and respect the injuries listed above. Use the same approach for squat, deadlift, running and any other goal.',
    'Every meal in a nutrition plan must follow the diet, allergy and avoid-food rules above, with no exceptions.',
    'Write all replies as plain text: do not use markdown symbols such as # or **.',
  ].join(' ');
}

// ---------------------------------------------------------------------------
// Reading the model's reply
// ---------------------------------------------------------------------------

const BLOCK_RE = new RegExp(`<${ACTION_TAG}>([\\s\\S]*?)(?:</${ACTION_TAG}>|$)`, 'i');

function parseJsonLoose(text) {
  const cleaned = String(text || '')
    .replace(/```(?:json)?/gi, '')
    .trim();
  if (!cleaned) return null;
  try {
    return JSON.parse(cleaned);
  } catch {
    // fall through to trimming stray text around the JSON
  }
  const starts = [cleaned.indexOf('['), cleaned.indexOf('{')].filter((i) => i >= 0);
  if (starts.length === 0) return null;
  const start = Math.min(...starts);
  const end = Math.max(cleaned.lastIndexOf(']'), cleaned.lastIndexOf('}'));
  if (end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Splits a coach reply into the text the user should see and the raw
 * actions it proposed. The block is always removed from the text - even
 * when its JSON is broken - so raw JSON never shows up in the chat.
 * @returns {{ text: string, actions: object[] | null }}
 */
export function extractCoachAction(reply) {
  const raw = typeof reply === 'string' ? reply : '';
  const match = raw.match(BLOCK_RE);
  if (!match) return { text: raw.trim(), actions: null };

  const before = raw.slice(0, match.index).trimEnd();
  const after = raw.slice(match.index + match[0].length).trim();
  const text = after ? `${before}\n\n${after}`.trim() : before.trim();

  const parsed = parseJsonLoose(match[1]);
  let list = null;
  if (Array.isArray(parsed)) list = parsed;
  else if (parsed && Array.isArray(parsed.actions)) list = parsed.actions;
  else if (parsed && typeof parsed === 'object') list = [parsed];
  list = list ? list.filter((a) => a && typeof a === 'object') : null;
  return { text, actions: list && list.length > 0 ? list : null };
}

// A short typed answer to a proposal ("yes", "no thanks") counts as tapping
// the button. Anything longer or more specific ("yes but make it Tuesday")
// is left for the model to handle as a normal message.
const YES_RE = /^(yes|yeah|yep|yup|y|sure|ok|okay|please do|do it|go ahead|sounds good|looks good|create it|add it|save it|let'?s do it|let'?s go)(\s+(please|thanks|thank you))?$/;
const NO_RE = /^(no|nope|nah|n|no thanks|no thank you|cancel|not now|don'?t|never mind|nevermind|skip it|stop)$/;

export function classifyReply(text) {
  const t = String(text || '')
    .toLowerCase()
    .replace(/[.!?,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t || t.length > 30) return null;
  if (YES_RE.test(t)) return 'yes';
  if (NO_RE.test(t)) return 'no';
  return null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const clampInt = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

const cleanString = (value, max) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/**
 * "2026-10-08" + "07:30" (or "7:30 AM") -> local Date, or null when either
 * part is missing, malformed or not a real calendar date (e.g. Feb 31).
 */
export function parseLocalDateTime(date, time) {
  const d = String(date || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const t = String(time || '').trim().match(/^(\d{1,2}):(\d{2})\s*([ap]m)?$/i);
  if (!d || !t) return null;
  const year = Number(d[1]);
  const month = Number(d[2]);
  const day = Number(d[3]);
  let hour = Number(t[1]);
  const minute = Number(t[2]);
  const meridiem = t[3] ? t[3].toLowerCase() : null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
  }
  if (hour > 23 || minute > 59) return null;
  const result = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day
  ) {
    return null;
  }
  return result;
}

function normalizeReps(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return clampInt(value, 1, 100, 10);
  if (typeof value === 'string') {
    const range = value.trim().match(/^(\d{1,3})\s*[-–]\s*(\d{1,3})$/);
    if (range) return `${clampInt(range[1], 1, 100, 8)}-${clampInt(range[2], 1, 100, 12)}`;
    const single = value.trim().match(/^\d{1,3}$/);
    if (single) return clampInt(single[0], 1, 100, 10);
  }
  return 10;
}

// Same estimate and XP formula app/workout/quick.jsx uses, so a coach-built
// workout earns the same XP as a Quick Workout of the same size.
const WORK_SECONDS_PER_SET = 30;
export function estimateDurationMinutes(exercises) {
  const totalSeconds = exercises.reduce(
    (sum, ex) => sum + (ex.sets || 1) * (WORK_SECONDS_PER_SET + (ex.restSeconds ?? 60)),
    0
  );
  return Math.max(5, Math.round(totalSeconds / 60));
}

export function calculateXpReward(difficulty, durationMinutes) {
  const mult = difficulty === 'beginner' ? 1 : difficulty === 'intermediate' ? 1.5 : difficulty === 'advanced' ? 2 : 1;
  return Math.round(50 * mult * Math.ceil(durationMinutes / 15));
}

function normalizeWorkout(raw, index, difficulty) {
  if (!raw || typeof raw !== 'object') return null;
  const exercises = (Array.isArray(raw.exercises) ? raw.exercises : [])
    .map((ex) => {
      const name = cleanString(ex?.name, 60);
      if (!name) return null;
      return {
        name,
        sets: clampInt(ex.sets, 1, 10, 3),
        reps: normalizeReps(ex.reps),
        restSeconds: clampInt(ex.restSeconds ?? ex.restTime, 0, 600, 60),
      };
    })
    .filter(Boolean)
    .slice(0, LIMITS.exercisesPerWorkout);
  if (exercises.length === 0) return null;

  const duration = estimateDurationMinutes(exercises);
  const name = cleanString(raw.name, 60) || `Coach Workout ${index + 1}`;
  return {
    name,
    description: cleanString(raw.description, 200) || `Workout built by your ZOWN coach.`,
    category: 'Coach Plan',
    difficulty,
    duration,
    xpReward: calculateXpReward(difficulty, duration),
    exercises,
    source: 'ai_coach',
  };
}

function normalizeEvent(raw, now) {
  if (!raw || typeof raw !== 'object') return { event: null, reason: 'invalid' };
  const title = cleanString(raw.title, 80);
  const start = parseLocalDateTime(raw.date, raw.time);
  if (!title || !start) return { event: null, reason: 'invalid' };
  if (start.getTime() < now.getTime() - 60 * 60 * 1000) return { event: null, reason: 'past' };
  return {
    event: {
      title,
      kind: EVENT_KINDS.includes(raw.kind) ? raw.kind : 'other',
      start: start.toISOString(),
      notes: cleanString(raw.notes, 200),
      workoutName: cleanString(raw.workout, 60),
    },
    reason: null,
  };
}

// ---- Food safety net -------------------------------------------------------
// The prompt tells the model to respect allergies, but a model can slip, and
// for an allergy a slip matters. Every meal the model proposes is checked
// against these words, and a meal that matches is left out rather than
// added. Deliberately broad (it would rather drop a safe meal than keep an
// unsafe one) and still best-effort, not a medical guarantee.
const ALLERGEN_WORDS = {
  dairy: ['milk', 'cheese', 'yogurt', 'yoghurt', 'butter', 'cream', 'whey', 'casein', 'ghee', 'kefir', 'paneer', 'mozzarella', 'parmesan', 'feta', 'ricotta', 'custard', 'latte'],
  egg: ['egg', 'eggs', 'omelet', 'omelette', 'frittata', 'mayonnaise', 'mayo', 'meringue'],
  gluten: ['wheat', 'barley', 'rye', 'bread', 'toast', 'pasta', 'noodle', 'couscous', 'seitan', 'bagel', 'tortilla', 'wrap', 'flour', 'cracker', 'cereal', 'granola', 'orzo', 'pancake', 'waffle', 'muffin', 'pita'],
  wheat: ['wheat', 'bread', 'toast', 'pasta', 'noodle', 'couscous', 'bagel', 'tortilla', 'wrap', 'flour', 'cracker', 'cereal', 'granola', 'orzo', 'pancake', 'waffle', 'muffin', 'pita'],
  peanut: ['peanut', 'peanuts'],
  tree_nut: ['almond', 'walnut', 'cashew', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'pine nut', 'brazil nut', 'nuts', 'nut butter', 'praline'],
  soy: ['soy', 'soya', 'tofu', 'tempeh', 'edamame', 'miso', 'tamari'],
  fish: ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'trout', 'halibut', 'sardine', 'anchovy', 'anchovies', 'mackerel', 'sea bass', 'snapper'],
  shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'clam', 'mussel', 'oyster', 'crawfish', 'crayfish', 'shellfish'],
  sesame: ['sesame', 'tahini', 'hummus'],
  sulfite: ['wine', 'dried fruit', 'raisin', 'dried apricot'],
  grain: ['wheat', 'oat', 'oats', 'oatmeal', 'rice', 'quinoa', 'barley', 'rye', 'corn', 'bread', 'toast', 'pasta', 'noodle', 'cereal', 'granola', 'couscous', 'tortilla', 'wrap', 'flour', 'cracker', 'pancake', 'waffle', 'muffin', 'pita', 'millet'],
};

const AVOID_WORDS = {
  pork: ['pork', 'bacon', 'ham', 'sausage', 'prosciutto', 'pancetta'],
  beef: ['beef', 'steak', 'burger', 'brisket', 'veal'],
  chicken: ['chicken'],
  lamb: ['lamb', 'mutton'],
  fish: ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'trout', 'halibut', 'sardine', 'anchovy', 'mackerel'],
  mushrooms: ['mushroom', 'mushrooms'],
  onions: ['onion', 'onions', 'shallot', 'scallion'],
  cilantro: ['cilantro', 'coriander'],
  alcohol: ['wine', 'beer', 'rum', 'vodka', 'whiskey', 'bourbon', 'liquor', 'cocktail'],
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRegex = (words) => new RegExp(`\\b(?:${words.map(escapeRegex).join('|')})(?:s|es)?\\b`, 'i');

/**
 * Returns the reason a meal must not be added for this user ("dairy",
 * "avoided: pork") or null when it looks fine.
 */
export function findFoodConflict(text, user) {
  const profile = getDietProfile(user);
  const haystack = String(text || '');
  for (const id of profile.allergies) {
    const words = ALLERGEN_WORDS[id];
    if (words && wordRegex(words).test(haystack)) return `allergy: ${id.replace('_', ' ')}`;
  }
  for (const id of profile.avoid) {
    const words = AVOID_WORDS[id];
    if (words && wordRegex(words).test(haystack)) return `avoids: ${id}`;
  }
  return null;
}

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function normalizeNutritionPlan(raw, now, user) {
  const goals = raw.dailyGoals && typeof raw.dailyGoals === 'object' ? raw.dailyGoals : {};
  const ranges = { calories: [800, 6000], protein: [20, 400], carbs: [0, 800], fat: [10, 300] };
  const dailyGoals = {};
  Object.entries(ranges).forEach(([key, [min, max]]) => {
    const n = Number(goals[key]);
    if (Number.isFinite(n) && n > 0) dailyGoals[key] = clampInt(n, min, max, undefined);
  });

  const meals = [];
  const blocked = [];
  let dropped = 0;
  (Array.isArray(raw.meals) ? raw.meals : []).slice(0, LIMITS.meals).forEach((m) => {
    const name = cleanString(m?.name, 80);
    if (!name) {
      dropped += 1;
      return;
    }
    const mealType = MEAL_TYPES.includes(m.mealType) ? m.mealType : 'snack';
    const description = cleanString(m.description, 200);
    const conflict = findFoodConflict(`${name} ${description}`, user);
    if (conflict) {
      blocked.push({ name, reason: conflict });
      return;
    }
    const start = parseLocalDateTime(m.date, m.time || DEFAULT_MEAL_TIME[mealType]);
    if (!start || start.getTime() < now.getTime() - 60 * 60 * 1000) {
      dropped += 1;
      return;
    }
    meals.push({
      title: `${capitalize(mealType)}: ${name}`,
      kind: 'nutrition',
      start: start.toISOString(),
      notes: description,
      workoutName: '',
    });
  });

  if (Object.keys(dailyGoals).length === 0 && meals.length === 0) return { action: null, dropped, blocked };
  return { action: { type: 'nutrition_plan', dailyGoals, meals, blocked }, dropped, blocked };
}

/**
 * Validates and cleans the raw actions from extractCoachAction.
 * @returns {{ actions: object[], dropped: number, blocked: object[] }}
 *   actions  only well-formed, bounded actions the app knows how to run
 *   dropped  items discarded (malformed, or dated in the past)
 *   blocked  meals left out because of the user's allergies / avoid list
 */
export function normalizeActions(rawActions, { now = new Date(), user = null } = {}) {
  const actions = [];
  const blocked = [];
  let dropped = 0;
  const difficulty = ['beginner', 'intermediate', 'advanced'].includes(user?.fitnessLevel) ? user.fitnessLevel : 'intermediate';

  (Array.isArray(rawActions) ? rawActions : []).forEach((raw) => {
    if (!raw || typeof raw !== 'object') return;

    if (raw.type === 'workout_plan') {
      const workouts = (Array.isArray(raw.workouts) ? raw.workouts : [])
        .slice(0, LIMITS.workouts)
        .map((w, i) => normalizeWorkout(w, i, difficulty));
      const valid = workouts.filter(Boolean);
      dropped += workouts.length - valid.length;
      if (valid.length > 0) actions.push({ type: 'workout_plan', workouts: valid });
      return;
    }

    if (raw.type === 'schedule') {
      const events = [];
      (Array.isArray(raw.events) ? raw.events : []).slice(0, LIMITS.events).forEach((e) => {
        const { event } = normalizeEvent(e, now);
        if (event) events.push(event);
        else dropped += 1;
      });
      if (events.length > 0) actions.push({ type: 'schedule', events });
      return;
    }

    if (raw.type === 'nutrition_plan') {
      const result = normalizeNutritionPlan(raw, now, user);
      dropped += result.dropped;
      blocked.push(...result.blocked);
      if (result.action) actions.push(result.action);
    }
  });

  return { actions, dropped, blocked };
}

// ---------------------------------------------------------------------------
// Wording for the confirmation card and chat
// ---------------------------------------------------------------------------

export function formatEventWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${WEEKDAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}, ${hour12}:${pad2(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One line per thing that will be created, for the Yes / No card. */
export function describeActions(actions) {
  const lines = [];
  (actions || []).forEach((a) => {
    if (a.type === 'workout_plan') {
      const names = a.workouts.map((w) => `${w.name} (${plural(w.exercises.length, 'exercise')})`).join(', ');
      lines.push(`Save ${plural(a.workouts.length, 'workout')} to My Workouts: ${names}`);
    } else if (a.type === 'schedule') {
      const shown = a.events.slice(0, 3).map((e) => `${e.title}, ${formatEventWhen(e.start)}`).join('; ');
      const more = a.events.length > 3 ? `; +${a.events.length - 3} more` : '';
      lines.push(`Add ${plural(a.events.length, 'event')} to your calendar: ${shown}${more}`);
    } else if (a.type === 'nutrition_plan') {
      const g = a.dailyGoals || {};
      const parts = [];
      if (g.calories) parts.push(`${g.calories.toLocaleString('en-US')} kcal`);
      if (g.protein) parts.push(`${g.protein}g protein`);
      if (g.carbs) parts.push(`${g.carbs}g carbs`);
      if (g.fat) parts.push(`${g.fat}g fat`);
      if (parts.length) lines.push(`Replace your daily targets with ${parts.join(' · ')}`);
      if (a.meals.length) lines.push(`Add ${plural(a.meals.length, 'meal')} to your calendar`);
      if (a.blocked && a.blocked.length) {
        lines.push(`Left out ${plural(a.blocked.length, 'meal')} that conflicted with your food settings: ${a.blocked.map((b) => b.name).join(', ')}`);
      }
    }
  });
  return lines;
}

/** Yes/no question appended when the model forgot to ask one. */
export function buildQuestion(actions) {
  const types = new Set((actions || []).map((a) => a.type));
  if (types.size > 1) return 'Want me to go ahead and create this?';
  if (types.has('workout_plan')) return 'Want me to save this to your workouts?';
  if (types.has('schedule')) return 'Want me to add this to your calendar?';
  if (types.has('nutrition_plan')) return 'Want me to set up this nutrition plan?';
  return 'Want me to go ahead and create this?';
}

/** True when the visible reply already ends in a question. */
export function endsWithQuestion(text) {
  return /\?\s*$/.test(String(text || '').trim());
}
