import {
  getGoalIds, toQuickWorkoutGoals, getGoalLabels, latestWeight, weightTrend, buildProfile,
  nutritionPreferenceText, profileForNutrition, profileForWorkouts, dayTotals, buildSnapshotMessage,
} from '../lib/userProfileData';
import { normalizeActions, describeActions, buildQuestion, buildActionInstructions } from '../lib/coachActions';

const user = {
  fitnessLevel: 'intermediate', heightCm: 180, weightKg: 90, age: 30, gender: 'Male', targetWeightKg: 82,
  fitnessMetrics: {
    targetGoals: ['lose_weight', 'train_for_race', 'build_muscle'], injuries: ['knee', 'lower_back'],
    activityLevel: 'moderately_active', nutritionPreference: 'keto', foodAllergies: ['peanut'], avoidFoods: [],
  },
  preferences: { workoutDaysPerWeek: 4, preferredDuration: '45min', preferredTimeOfDay: 'Morning' },
};
const NOW = new Date(2026, 9, 7, 12, 0);
const iso = (d) => new Date(2026, 9, d, 8).toISOString();

describe('goals', () => {
  it('reads goals from fitnessMetrics.targetGoals', () => {
    expect(getGoalIds(user)).toEqual(['lose_weight', 'train_for_race', 'build_muscle']);
    expect(getGoalLabels(user)).toEqual(['Lose Weight', 'Train for a Race', 'Build Muscle']);
  });
  it('maps them to quick workout goals without repeats', () => {
    expect(toQuickWorkoutGoals(user)).toEqual(['weight_loss', 'improve_endurance', 'build_muscle']);
  });
  it('handles a user with nothing', () => {
    expect(getGoalIds({})).toEqual([]);
    expect(toQuickWorkoutGoals(null)).toEqual([]);
  });
});

describe('weight', () => {
  it('uses the newest of logs and scans, else the profile', () => {
    const logs = [{ weightKg: 88, createdAtLocal: iso(1) }, { weightKg: 86.5, createdAtLocal: iso(5) }];
    const scans = [{ weightKg: 87, createdAtLocal: iso(3) }];
    expect(latestWeight({ weightLogs: logs, scans, user })).toEqual({ kg: 86.5, source: 'weight log' });
    expect(latestWeight({ weightLogs: [{ weightKg: 88, createdAtLocal: iso(1) }], scans, user })).toEqual({ kg: 87, source: 'body scan' });
    expect(latestWeight({ user })).toEqual({ kg: 90, source: 'profile' });
    expect(latestWeight({})).toEqual({ kg: null, source: null });
  });
  it('ignores junk entries', () => {
    expect(latestWeight({ weightLogs: [{ weightKg: 'x', createdAtLocal: 'nope' }], user }).source).toBe('profile');
  });
  it('computes a trend only with two or more recent logs', () => {
    const logs = [{ weightKg: 90, createdAtLocal: iso(1) }, { weightKg: 88.5, createdAtLocal: iso(6) }];
    expect(weightTrend(logs, { now: NOW })).toEqual({ changeKg: -1.5, days: 5, entries: 2 });
    expect(weightTrend([logs[0]], { now: NOW })).toBeNull();
  });
});

describe('profile', () => {
  const profile = buildProfile({ user, weightLogs: [{ weightKg: 88, createdAtLocal: iso(5) }], scans: [{ bodyFatPercent: 21, createdAtLocal: iso(2) }] });
  it('collects the facts', () => {
    expect(profile).toMatchObject({ weightKg: 88, heightCm: 180, age: 30, daysPerWeek: 4, bodyFatPercent: 21, injuries: ['knee', 'lower_back'] });
  });
  it('builds the nutrition input with real values and the diet text', () => {
    const n = profileForNutrition(profile);
    expect(n).toMatchObject({ weightKg: 88, targetWeightKg: 82, heightCm: 180, age: 30, gender: 'Male', activityLevel: 'moderately active' });
    expect(n.nutritionPreference).toContain('keto');
    expect(n.nutritionPreference).toContain('allergies (strict)');
  });
  it('builds the workout input with injuries as words and no undefined fields', () => {
    const w = profileForWorkouts(profile);
    expect(w.injuries).toEqual(['Knee', 'Lower Back']);
    expect(w.daysPerWeek).toBe(4);
    expect(Object.values(w).every((v) => v !== undefined)).toBe(true);
    expect(profileForWorkouts(buildProfile({ user: {} }))).toEqual({});
  });
  it('says no_preference when no diet is set', () => {
    expect(nutritionPreferenceText(null)).toBe('no_preference');
  });
});

describe('dayTotals', () => {
  it('adds up foods for the matching date keys only', () => {
    const meals = [
      { date: '2026-10-07', foods: [{ calories: 300, protein: 20, carbs: 30, fat: 10 }, { calories: 100 }] },
      { date: '2026-10-06', foods: [{ calories: 999 }] },
    ];
    expect(dayTotals(meals, ['2026-10-07'])).toEqual({ calories: 400, protein: 20, carbs: 30, fat: 10, foods: 2 });
  });
});

describe('snapshot message', () => {
  it('is null with nothing to say and rich with data', () => {
    expect(buildSnapshotMessage({ profile: buildProfile({ user: {} }) })).toBeNull();
    const logs = [{ weightKg: 90, createdAtLocal: iso(1) }, { weightKg: 88, createdAtLocal: iso(6) }];
    const msg = buildSnapshotMessage({
      profile: buildProfile({ user, weightLogs: logs }), weightLogs: logs, now: NOW,
      goals: [{ title: 'Bench 225', current: 185, target: 225, unit: 'lb' }, { title: 'Done', completed: true }],
      nutrition: { dailyGoals: { calories: 2200, protein: 180, carbs: 200, fat: 70 }, today: { calories: 800, protein: 50, carbs: 70, fat: 20, foods: 3 } },
      upcoming: [{ title: 'Leg Day', when: 'Thu Oct 8, 7:00 AM' }],
    });
    expect(msg.role).toBe('system');
    expect(msg.content).toContain('weight 194 lb');
    expect(msg.content).toContain('down 4.4 lb');
    expect(msg.content).toContain('Bench 225 (185/225 lb)');
    expect(msg.content).not.toContain('Done');
    expect(msg.content).toContain('wants to train 4 days a week');
    expect(msg.content).toContain('2200 kcal');
    expect(msg.content).toContain('Eaten so far today: 800 kcal');
    expect(msg.content).toContain('Leg Day');
  });
});

describe('coach goal action', () => {
  it('validates goals and tells the model about them', () => {
    expect(buildActionInstructions(NOW)).toContain('"type":"goal"');
    const { actions, dropped } = normalizeActions([{ type: 'goal', goals: [
      { title: ' Bench press 225 lb ', target: 225, unit: 'lb', current: 185, deadline: '2026-12-31' },
      { title: 'Past', target: 5, deadline: '2020-01-01' },
      { title: 'No target' },
      { target: 10 },
      'junk',
    ] }], { now: NOW, user });
    expect(dropped).toBe(3);
    expect(actions).toHaveLength(1);
    expect(actions[0].goals[0]).toEqual({ title: 'Bench press 225 lb', target: 225, unit: 'lb', current: 185, deadline: '2026-12-31' });
    expect(actions[0].goals[1]).toEqual({ title: 'Past', target: 5, unit: '', current: 0, deadline: null });
    expect(Object.values(actions[0].goals[1]).every((v) => v !== undefined)).toBe(true);
    expect(describeActions(actions)[0]).toContain('Add 2 goals to Progress');
    expect(buildQuestion(actions)).toContain('goal');
  });
  it('caps at five goals', () => {
    const goals = Array.from({ length: 9 }, (_, i) => ({ title: `G${i}`, target: 10 }));
    expect(normalizeActions([{ type: 'goal', goals }], { now: NOW }).actions[0].goals).toHaveLength(5);
  });
});
