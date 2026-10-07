import {
  extractCoachAction, normalizeActions, describeActions, buildQuestion, endsWithQuestion,
  classifyReply, parseLocalDateTime, findFoodConflict, buildActionInstructions, LIMITS,
} from '../lib/coachActions';

// Wed 2026-10-07 09:00 local time
const NOW = new Date(2026, 9, 7, 9, 0, 0);

const WORKOUT_REPLY = `Here's a two-day bench plan: Day 1 heavy bench, Day 2 supporting work.

Want me to save these to your workouts?
<zown_action>[{"type":"workout_plan","workouts":[{"name":"Bench Day","description":"Heavy bench","exercises":[{"name":"Bench Press","sets":3,"reps":"5-8","restSeconds":120},{"name":"Push-Ups","sets":3,"reps":12}]},{"name":"Support Day","exercises":[{"name":"Overhead Press","sets":3,"reps":10}]}]}]</zown_action>`;

describe('extractCoachAction', () => {
  it('returns plain replies untouched', () => {
    expect(extractCoachAction('Eat more protein.')).toEqual({ text: 'Eat more protein.', actions: null });
    expect(extractCoachAction(undefined)).toEqual({ text: '', actions: null });
  });

  it('hides the block from the visible text and parses it', () => {
    const { text, actions } = extractCoachAction(WORKOUT_REPLY);
    expect(text).toContain('Want me to save these to your workouts?');
    expect(text).not.toContain('zown_action');
    expect(text).not.toContain('{');
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('workout_plan');
  });

  it('tolerates code fences, a single object and a missing closing tag', () => {
    const fenced = 'Sure.\n<zown_action>```json\n{"type":"schedule","events":[]}\n```</zown_action>';
    expect(extractCoachAction(fenced).actions).toEqual([{ type: 'schedule', events: [] }]);
    const unclosed = 'Sure?\n<zown_action>[{"type":"schedule","events":[]}]';
    const r = extractCoachAction(unclosed);
    expect(r.text).toBe('Sure?');
    expect(r.actions).toHaveLength(1);
  });

  it('strips a broken block and reports no actions instead of showing JSON', () => {
    const r = extractCoachAction('Here you go?\n<zown_action>{"type": oops</zown_action>');
    expect(r.text).toBe('Here you go?');
    expect(r.actions).toBeNull();
  });

  it('accepts {"actions":[...]}', () => {
    const r = extractCoachAction('Ok?<zown_action>{"actions":[{"type":"schedule","events":[]}]}</zown_action>');
    expect(r.actions).toHaveLength(1);
  });
});

describe('classifyReply', () => {
  it('treats short yes / no answers as button taps', () => {
    ['yes', 'Yes!', 'yep', 'sure', 'Yes please', 'do it', 'go ahead', "let's do it"].forEach((t) => expect(classifyReply(t)).toBe('yes'));
    ['no', 'No thanks', 'nope', 'cancel', 'not now', "don't"].forEach((t) => expect(classifyReply(t)).toBe('no'));
  });

  it('leaves anything more specific to the model', () => {
    expect(classifyReply('yes but make it Tuesday')).toBeNull();
    expect(classifyReply('no, add more rows')).toBeNull();
    expect(classifyReply('what about legs?')).toBeNull();
    expect(classifyReply('')).toBeNull();
  });
});

describe('parseLocalDateTime', () => {
  it('parses 24h and am/pm times as local time', () => {
    const d = parseLocalDateTime('2026-10-08', '07:30');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 9, 8, 7, 30]);
    expect(parseLocalDateTime('2026-10-08', '7:30 PM').getHours()).toBe(19);
    expect(parseLocalDateTime('2026-10-08', '12:05 AM').getHours()).toBe(0);
  });

  it('rejects impossible dates and times', () => {
    expect(parseLocalDateTime('2026-02-31', '07:00')).toBeNull();
    expect(parseLocalDateTime('2026-10-08', '25:00')).toBeNull();
    expect(parseLocalDateTime('2026-10-08', '7pm')).toBeNull();
    expect(parseLocalDateTime(undefined, '07:00')).toBeNull();
  });
});

describe('normalizeActions - workouts', () => {
  const run = (reply, user) => normalizeActions(extractCoachAction(reply).actions, { now: NOW, user });

  it('builds workout records the workout store can save', () => {
    const { actions } = run(WORKOUT_REPLY, { fitnessLevel: 'beginner' });
    expect(actions).toHaveLength(1);
    const [bench, support] = actions[0].workouts;
    expect(bench).toMatchObject({ name: 'Bench Day', difficulty: 'beginner', source: 'ai_coach', category: 'Coach Plan' });
    expect(bench.exercises[0]).toEqual({ name: 'Bench Press', sets: 3, reps: '5-8', restSeconds: 120 });
    expect(bench.exercises[1].reps).toBe(12);
    expect(bench.duration).toBeGreaterThanOrEqual(5);
    expect(bench.xpReward).toBeGreaterThan(0);
    expect(support.description).toBeTruthy();
    // Firestore rejects undefined, so nothing in a saved workout may be undefined.
    expect(JSON.stringify(bench)).not.toContain('undefined');
    Object.values(bench).forEach((v) => expect(v).not.toBeUndefined());
  });

  it('clamps nonsense and drops workouts with no exercises', () => {
    const { actions, dropped } = normalizeActions([
      { type: 'workout_plan', workouts: [
        { name: 'X', exercises: [{ name: 'Squat', sets: 999, reps: -5, restSeconds: 99999 }] },
        { name: 'Empty', exercises: [] },
      ] },
    ], { now: NOW });
    const ex = actions[0].workouts[0].exercises[0];
    expect(ex.sets).toBe(10);
    expect(ex.reps).toBe(1);
    expect(ex.restSeconds).toBe(600);
    expect(actions[0].workouts).toHaveLength(1);
    expect(dropped).toBe(1);
  });

  it('caps counts', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ name: `W${i}`, exercises: Array.from({ length: 30 }, (_, j) => ({ name: `E${j}` })) }));
    const { actions } = normalizeActions([{ type: 'workout_plan', workouts: many }], { now: NOW });
    expect(actions[0].workouts).toHaveLength(LIMITS.workouts);
    expect(actions[0].workouts[0].exercises).toHaveLength(LIMITS.exercisesPerWorkout);
  });

  it('ignores unknown action types and junk', () => {
    expect(normalizeActions([{ type: 'delete_everything' }, null, 'x', { type: 'workout_plan' }], { now: NOW }).actions).toEqual([]);
    expect(normalizeActions(null, { now: NOW }).actions).toEqual([]);
  });
});

describe('normalizeActions - schedule', () => {
  it('keeps valid future events and drops invalid or past ones', () => {
    const { actions, dropped } = normalizeActions([{
      type: 'schedule',
      events: [
        { title: 'Bench Day', kind: 'workout', date: '2026-10-08', time: '07:00', workout: 'Bench Day' },
        { title: 'Long run', kind: 'weird', date: '2026-10-10', time: '06:30', notes: 'Easy pace' },
        { title: 'Yesterday', kind: 'workout', date: '2026-10-06', time: '07:00' },
        { title: 'No time', kind: 'workout', date: '2026-10-09' },
        { kind: 'workout', date: '2026-10-09', time: '07:00' },
      ],
    }], { now: NOW });
    expect(actions[0].events.map((e) => e.title)).toEqual(['Bench Day', 'Long run']);
    expect(actions[0].events[1].kind).toBe('other');
    expect(actions[0].events[0].workoutName).toBe('Bench Day');
    expect(dropped).toBe(3);
    expect(new Date(actions[0].events[0].start).getHours()).toBe(7);
  });

  it('returns no action when nothing valid is left', () => {
    expect(normalizeActions([{ type: 'schedule', events: [{ title: 'x', date: 'bad', time: 'bad' }] }], { now: NOW }).actions).toEqual([]);
  });
});

describe('normalizeActions - nutrition plans and food safety', () => {
  const plan = (meals, dailyGoals = { calories: 2300, protein: 180, carbs: 220, fat: 70 }) => [{
    type: 'nutrition_plan', dailyGoals, meals,
  }];
  const meals = [
    { date: '2026-10-08', time: '08:00', mealType: 'breakfast', name: 'Greek yogurt bowl', description: 'yogurt, berries, honey' },
    { date: '2026-10-08', mealType: 'lunch', name: 'Chicken rice bowl', description: 'grilled chicken, rice, broccoli' },
    { date: '2026-10-08', time: '19:00', mealType: 'dinner', name: 'Salmon and quinoa', description: 'baked salmon, quinoa' },
  ];

  it('turns meals into calendar events and clamps targets', () => {
    const { actions } = normalizeActions(plan(meals, { calories: 99999, protein: 180, carbs: -5, fat: 'x' }), { now: NOW });
    const a = actions[0];
    expect(a.dailyGoals).toEqual({ calories: 6000, protein: 180 });
    expect(a.meals).toHaveLength(3);
    expect(a.meals[0]).toMatchObject({ title: 'Breakfast: Greek yogurt bowl', kind: 'nutrition' });
    expect(new Date(a.meals[1].start).getHours()).toBe(12); // default lunch time
  });

  it('leaves out meals that contain a food the user is allergic to', () => {
    const user = { fitnessMetrics: { foodAllergies: ['dairy', 'fish'] } };
    const { actions, blocked } = normalizeActions(plan(meals), { now: NOW, user });
    expect(actions[0].meals.map((m) => m.title)).toEqual(['Lunch: Chicken rice bowl']);
    expect(blocked.map((b) => b.name)).toEqual(['Greek yogurt bowl', 'Salmon and quinoa']);
    expect(actions[0].blocked).toHaveLength(2);
  });

  it('leaves out foods the user avoids', () => {
    const user = { fitnessMetrics: { avoidFoods: ['chicken'] } };
    const { actions } = normalizeActions(plan(meals), { now: NOW, user });
    expect(actions[0].meals.map((m) => m.title)).not.toContain('Lunch: Chicken rice bowl');
  });

  it('describes what was left out on the confirmation card', () => {
    const user = { fitnessMetrics: { foodAllergies: ['dairy'] } };
    const { actions } = normalizeActions(plan(meals), { now: NOW, user });
    const lines = describeActions(actions).join(' | ');
    expect(lines).toContain('Left out 1 meal');
    expect(lines).toContain('Greek yogurt bowl');
  });

  it('drops the whole action when every meal is blocked and there are no targets', () => {
    const user = { fitnessMetrics: { foodAllergies: ['dairy'] } };
    const { actions, blocked } = normalizeActions(plan([meals[0]], {}), { now: NOW, user });
    expect(actions).toEqual([]);
    expect(blocked).toHaveLength(1);
  });
});

describe('findFoodConflict', () => {
  it('matches whole words, including plurals, and ignores unrelated text', () => {
    const dairy = { fitnessMetrics: { foodAllergies: ['dairy'] } };
    expect(findFoodConflict('Cheese omelet', dairy)).toMatch(/dairy/);
    expect(findFoodConflict('Cheeses and crackers', dairy)).toMatch(/dairy/);
    expect(findFoodConflict('Chicken and rice', dairy)).toBeNull();
    const nuts = { fitnessMetrics: { foodAllergies: ['tree_nut'] } };
    expect(findFoodConflict('Almond butter toast', nuts)).toMatch(/tree nut/);
    expect(findFoodConflict('Pineapple smoothie', nuts)).toBeNull();
    expect(findFoodConflict('anything', null)).toBeNull();
  });
});

describe('wording', () => {
  const { actions } = normalizeActions(extractCoachAction(WORKOUT_REPLY).actions, { now: NOW });

  it('describes workouts on the card', () => {
    expect(describeActions(actions)[0]).toBe('Save 2 workouts to My Workouts: Bench Day (2 exercises), Support Day (1 exercise)');
  });

  it('asks a yes/no question that fits what is proposed', () => {
    expect(buildQuestion(actions)).toBe('Want me to save this to your workouts?');
    expect(buildQuestion([{ type: 'schedule' }, { type: 'workout_plan' }])).toBe('Want me to go ahead and create this?');
    expect(endsWithQuestion('Want me to?  ')).toBe(true);
    expect(endsWithQuestion('Here it is.')).toBe(false);
  });
});

describe('buildActionInstructions', () => {
  it('tells the model today\'s date and that it must ask first', () => {
    const text = buildActionInstructions(NOW);
    expect(text).toContain('Wed 2026-10-07');
    expect(text).toContain('09:00');
    expect(text).toContain('<zown_action>');
    expect(text).toMatch(/only after they say yes/);
  });
});
