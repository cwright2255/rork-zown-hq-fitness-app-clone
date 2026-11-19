// The Workouts tab (app/workouts.jsx), six things that were wrong with it:
//   1. Quick Workout and Today's Session were at the very bottom; they are first on the page.
//   2. My Workouts came after the exercise browser; it is above everything that follows it.
//   3. "This Week" counted the last 7 days; it counts the week, Monday to now.
//   4. The recommended plan showed 3 of its days and none could be opened; all show on request, and a day opens as a workout.
//   5. The program's tile said nothing of where the person is in it; it says "Week 2 of 9".
//   6. Browse Exercises showed the same first ten movements; the row under Recommended For You is now Community Workouts (ready-made
//      workouts that save and open like a plan day), and the movements are a small link at the bottom.
// The Workouts screen is the real one. The stores the screen reads are stood in for, so each test can set what they hold.
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/src/components/EmptyState', () => ({ __esModule: true, default: () => null }));
jest.mock('@/src/components/LoadingSkeleton', () => ({ __esModule: true, default: () => null }));
let mockUser = { uid: 'u1', fitnessLevel: 'beginner' };
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: mockUser }) }));
jest.mock('@/services/coachSnapshotService', () => ({ getProfileFromStores: () => ({}) }));
let mockWorkouts = [];
let mockCompleted = [];
let mockRecommendation = null;
const mockAddWorkout = jest.fn();
jest.mock('@/store/workoutStore', () => {
  const actual = jest.requireActual('../store/workoutStore');
  const hook = (selector) => {
    const state = {
      ...actual.useWorkoutStore.getState(),
      workouts: mockWorkouts, completedWorkouts: mockCompleted, addWorkout: mockAddWorkout,
      loadWorkoutTemplates: jest.fn(), loadWorkoutRecommendation: jest.fn(), loadWorkouts: jest.fn(),
      getWorkoutStreak: () => ({ current: 0, longest: 0 }), workoutRecommendation: mockRecommendation, isLoadingRecommendation: false,
      generateNewWorkoutRecommendation: jest.fn(),
    };
    return selector ? selector(state) : state;
  };
  return { ...actual, useWorkoutStore: Object.assign(hook, actual.useWorkoutStore) };
});

import { router } from 'expo-router';
import WorkoutsScreen from '../app/workouts';
import { getFeaturedProgram } from '../data/workoutPrograms';
import { COMMUNITY_WORKOUTS, COMMUNITY_CATEGORIES } from '../data/communityWorkouts';
import { communityWorkoutMinutes } from '../lib/communityWorkouts';

// Every piece of text on the screen, in the order it is drawn.
function textsOf(node, out = []) {
  if (node == null) return out;
  if (typeof node === 'string') { out.push(node); return out; }
  if (Array.isArray(node)) { node.forEach((n) => textsOf(n, out)); return out; }
  (node.children || []).forEach((c) => textsOf(c, out));
  return out;
}
const texts = (utils) => textsOf(utils.toJSON());

const DAYS = [
  { day: 'Monday', focus: 'Upper Body Push', exercises: [{ name: 'Bench Press', sets: 4, reps: '6-8', restSeconds: 90 }, { name: 'Overhead Press', sets: 3, reps: '8-10' }] },
  { day: 'Tuesday', focus: 'Lower Body', exercises: [{ name: 'Squat', sets: 4, reps: '5' }] },
  { day: 'Wednesday', focus: 'Rest and Recovery', exercises: [] },
  { day: 'Thursday', focus: 'Pull', exercises: [{ name: 'Lat Pulldown', sets: 3, reps: '10' }] },
  { day: 'Friday', focus: 'Legs', exercises: [{ name: 'Leg Press', sets: 3, reps: '12' }] },
  { day: 'Saturday', focus: 'Core', exercises: [{ name: 'Plank', sets: 3, reps: '45 sec' }] },
  { day: 'Sunday', focus: 'Rest', exercises: [] },
];
const PROMPT = 'Create a 7-day plan for a beginner user with goals: Build Muscle, Strength. About the user: 30 years old.';
const planFor = (days = DAYS, over = {}) => ({ id: 'rec-1', prompt: PROMPT, structuredData: { days }, ...over });

beforeEach(() => {
  mockUser = { uid: 'u1', fitnessLevel: 'beginner' };
  mockWorkouts = [];
  mockCompleted = [];
  mockRecommendation = planFor();
  mockAddWorkout.mockReset();
  mockAddWorkout.mockImplementation(async (w) => ({ ...w, id: w.id ?? 'local-1' }));
  router.push.mockClear();
});

describe('1 and 2: the order of the page', () => {
  it('puts Quick Workout and Today\'s Session first, then Your Stats, the plan, Community Workouts, the program, My Workouts and the movements link', () => {
    mockWorkouts = [{ id: 'w1', name: 'Iron Hour', duration: 45, difficulty: 'Intermediate' }];
    const t = texts(render(<WorkoutsScreen />));
    const order = ['Workouts', 'Quick Workout', "Today's Session", 'Your Stats', 'Recommended For You', 'Community Workouts', 'Training Program', 'My Workouts', 'Browse all movements'];
    const places = order.map((label) => t.indexOf(label));
    expect(places.every((i) => i >= 0)).toBe(true);
    expect([...places].sort((a, b) => a - b)).toEqual(places);
  });

  it('has the two buttons once, at the top, and not again at the bottom', () => {
    const t = texts(render(<WorkoutsScreen />));
    expect(t.filter((x) => x === 'Quick Workout')).toHaveLength(1);
    expect(t.filter((x) => x === "Today's Session")).toHaveLength(1);
    expect(t.indexOf("Today's Session")).toBeLessThan(t.indexOf('Your Stats'));
  });

  it('still opens Quick Workout and Today\'s Session', () => {
    const utils = render(<WorkoutsScreen />);
    fireEvent.press(utils.getByText('Quick Workout'));
    expect(router.push).toHaveBeenLastCalledWith('/workout/quick');
    fireEvent.press(utils.getByText("Today's Session"));
    expect(router.push).toHaveBeenLastCalledWith('/workout/session');
  });

  it('puts Community Workouts straight under Recommended For You and above the program and My Workouts, with or without saved workouts', () => {
    [[], [{ id: 'w1', name: 'Iron Hour', duration: 45, difficulty: 'Intermediate' }]].forEach((saved) => {
      mockWorkouts = saved;
      const t = texts(render(<WorkoutsScreen />));
      const at = (label) => t.indexOf(label);
      expect(at('Recommended For You')).toBeLessThan(at('Community Workouts'));
      expect(at('Community Workouts')).toBeLessThan(at('Training Program'));
      expect(at('Community Workouts')).toBeLessThan(at('My Workouts'));
      // nothing but the plan card sits between the two headings
      const between = t.slice(at('Recommended For You') + 1, at('Community Workouts'));
      expect(between).toContain('Refresh Plan');
      expect(between).not.toContain('Training Program');
      expect(between).not.toContain('My Workouts');
    });
  });
});

describe('3: This Week is the week, Monday to now', () => {
  afterEach(() => jest.useRealTimers());
  const valueOf = (utils, label) => { const t = texts(utils); return t[t.indexOf(label) - 1]; };

  it('counts Monday onward and not the days before it that were inside the last seven', () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 18, 12, 0, 0) }); // Wednesday 18 November
    mockCompleted = [
      { completedAt: new Date(2026, 10, 16, 7, 0).toISOString() }, // Monday
      { completedAt: new Date(2026, 10, 17, 18, 0).toISOString() }, // Tuesday
      { completedAt: new Date(2026, 10, 12, 18, 0).toISOString() }, // last Thursday: inside seven days, in last week
      { completedAt: new Date(2026, 10, 15, 22, 0).toISOString() }, // last Sunday night
    ];
    expect(valueOf(render(<WorkoutsScreen />), 'This Week')).toBe('2');
  });

  it('is zero on a Monday morning before anything is done, whatever last week held', () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 23, 6, 30, 0) }); // Monday 23 November
    mockCompleted = [{ completedAt: new Date(2026, 10, 22, 20, 0).toISOString() }];
    expect(valueOf(render(<WorkoutsScreen />), 'This Week')).toBe('0');
  });
});

describe('4: the recommended plan', () => {
  const dayText = (utils, i) => utils.queryByTestId(`plan-day-name-${i}`);

  it('shows three days and a way to show all of them, and a way back', () => {
    const utils = render(<WorkoutsScreen />);
    expect(dayText(utils, 2)).toBeTruthy();
    expect(dayText(utils, 3)).toBeNull();
    fireEvent.press(utils.getByText('Show all 7 days'));
    [3, 4, 5, 6].forEach((i) => expect(dayText(utils, i)).toBeTruthy());
    fireEvent.press(utils.getByText('Show fewer days'));
    expect(dayText(utils, 3)).toBeNull();
    expect(utils.getByText('Show all 7 days')).toBeTruthy();
  });

  it('has nothing to expand when the plan is three days or fewer', () => {
    mockRecommendation = planFor(DAYS.slice(0, 3));
    expect(render(<WorkoutsScreen />).queryByTestId('plan-toggle')).toBeNull();
  });

  it('saves a day as a workout under the name shown, and opens it', async () => {
    const utils = render(<WorkoutsScreen />);
    const shownName = dayText(utils, 0).props.children;
    await act(async () => { fireEvent.press(utils.getByTestId('plan-day-0')); });
    expect(mockAddWorkout).toHaveBeenCalledTimes(1);
    const [workout, uid] = mockAddWorkout.mock.calls[0];
    expect(uid).toBe('u1');
    expect(workout).toMatchObject({
      id: 'plan-rec-1-d0', name: shownName, difficulty: 'beginner', category: 'Build Muscle', source: 'ai_plan_day', duration: 13, // 4 x (30 + 90) + 3 x (30 + 60) = 750 s = 12.5 min, rounded
    });
    expect(workout.exercises).toEqual([
      { name: 'Bench Press', sets: 4, reps: '6-8', restSeconds: 90 },
      { name: 'Overhead Press', sets: 3, reps: '8-10' },
    ]);
    expect(router.push).toHaveBeenCalledWith('/workout/plan-rec-1-d0');
  });

  it('opens a day it has already saved, without saving a second copy', async () => {
    mockWorkouts = [{ id: 'plan-rec-1-d1', name: 'Already here' }];
    const utils = render(<WorkoutsScreen />);
    await act(async () => { fireEvent.press(utils.getByTestId('plan-day-1')); });
    expect(mockAddWorkout).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/workout/plan-rec-1-d1');
  });

  it('opens a day that is only on the second look, with that day\'s own exercises', async () => {
    const utils = render(<WorkoutsScreen />);
    fireEvent.press(utils.getByText('Show all 7 days'));
    await act(async () => { fireEvent.press(utils.getByTestId('plan-day-5')); });
    expect(mockAddWorkout.mock.calls[0][0]).toMatchObject({ id: 'plan-rec-1-d5', exercises: [{ name: 'Plank', sets: 3, reps: '45 sec' }] });
    expect(router.push).toHaveBeenCalledWith('/workout/plan-rec-1-d5');
  });

  it('does not save the day twice when it is tapped again while it is still saving', async () => {
    let finish;
    mockAddWorkout.mockImplementation((w) => new Promise((resolve) => { finish = () => resolve({ ...w }); }));
    const utils = render(<WorkoutsScreen />);
    await act(async () => { fireEvent.press(utils.getByTestId('plan-day-0')); });
    await act(async () => { fireEvent.press(utils.getByTestId('plan-day-0')); });
    await act(async () => { fireEvent.press(utils.getByTestId('plan-day-1')); });
    expect(mockAddWorkout).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); });
    expect(router.push).toHaveBeenCalledTimes(1);
    // and it can be tapped again afterwards
    await act(async () => { fireEvent.press(utils.getByTestId('plan-day-1')); });
    expect(mockAddWorkout).toHaveBeenCalledTimes(2);
  });

  it('does nothing for a rest day, which has no exercises to open', async () => {
    const utils = render(<WorkoutsScreen />);
    await act(async () => { fireEvent.press(utils.getByTestId('plan-day-2')); });
    expect(mockAddWorkout).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(dayText(utils, 2)).toBeTruthy(); // it is still listed, with its name
  });

  it('opens the day even when the plan has no id (the store gives it one)', async () => {
    mockRecommendation = planFor(DAYS, { id: undefined });
    const utils = render(<WorkoutsScreen />);
    await act(async () => { fireEvent.press(utils.getByTestId('plan-day-0')); });
    expect('id' in mockAddWorkout.mock.calls[0][0]).toBe(false);
    expect(router.push).toHaveBeenCalledWith('/workout/local-1');
  });

  it('keeps Refresh Plan, and the plan\'s name and the days\' made-up names', () => {
    const utils = render(<WorkoutsScreen />);
    expect(utils.getByText('Refresh Plan')).toBeTruthy();
    expect(utils.getByTestId('plan-name')).toBeTruthy();
    expect(dayText(utils, 0).props.children).toBeTruthy();
  });
});

describe('5: where the person is in the program', () => {
  const featured = getFeaturedProgram();
  const done = (week, day, over = {}) => ({
    name: `${featured.title} - ${featured.weeks[0].days[day].day}`, completedAt: '2026-11-17T10:00:00Z',
    programId: featured.id, programWeek: week, programDay: day, ...over,
  });
  const dayCount = featured.weeks[0].days.length;

  it('says nothing before a day is finished', () => {
    const t = texts(render(<WorkoutsScreen />));
    expect(t.some((x) => /^Week \d+ of \d+$|^Completed$/.test(x))).toBe(false);
  });

  it('says the week after a day is finished, on its own line under the level', () => {
    mockCompleted = [done(1, 0)];
    const t = texts(render(<WorkoutsScreen />));
    const i = t.indexOf(featured.title);
    expect(t.slice(i, i + 4)).toEqual([featured.title, featured.subtitle, featured.level, `Week 1 of ${featured.weeks.length}`]);
  });

  it('moves to the next week when a week is done in full', () => {
    mockCompleted = Array.from({ length: dayCount }, (_, d) => done(1, d));
    expect(render(<WorkoutsScreen />).getByText(`Week 2 of ${featured.weeks.length}`)).toBeTruthy();
  });

  it('does not count a day saved part-way, or a day of a different program', () => {
    mockCompleted = [done(1, 0, { partial: true, completed: false }), done(1, 1, { programId: 'something-else' })];
    expect(render(<WorkoutsScreen />).queryByText(/^Week \d+ of/)).toBeNull();
  });

  it('still opens the program when the tile is tapped', () => {
    mockCompleted = [done(1, 0)];
    const utils = render(<WorkoutsScreen />);
    fireEvent.press(utils.getByTestId('program-card'));
    expect(router.push).toHaveBeenCalledWith(`/workout/program/${featured.id}`);
  });
});

describe('6: Community Workouts', () => {
  const cardIds = (utils) => utils.queryAllByTestId(/^community-card-/).map((n) => n.props.testID.replace('community-card-', ''));
  const slugsIn = (category) => COMMUNITY_WORKOUTS.filter((w) => category === 'All' || w.category === category).map((w) => w.slug);
  const sample = COMMUNITY_WORKOUTS.find((w) => w.slug === 'goblet-gang');

  it('shows every ready-made workout under All, in the order they are written, with a choice for each category', () => {
    const utils = render(<WorkoutsScreen />);
    expect(cardIds(utils)).toEqual(slugsIn('All'));
    expect(cardIds(utils).length).toBeGreaterThanOrEqual(28);
    ['All', ...COMMUNITY_CATEGORIES].forEach((label) => expect(utils.getByTestId(`chip-${label}`)).toBeTruthy());
  });

  it('puts the length and level on the line under the name, then the number of exercises and what it needs', () => {
    const t = texts(render(<WorkoutsScreen />));
    const i = t.indexOf('Goblet Gang');
    expect(i).toBeGreaterThan(-1);
    expect(t.slice(i, i + 4)).toEqual(['Goblet Gang', `${communityWorkoutMinutes(sample)} min · Beginner`, '6 exercises', 'Dumbbells and a bench']);
    const j = t.indexOf('Living Room Reset');
    expect(t.slice(j, j + 4)).toEqual(['Living Room Reset', '17 min · Beginner', '5 exercises', 'No equipment']);
  });

  it('shows only that category when it is chosen, every category has something, and All brings the rest back', () => {
    const utils = render(<WorkoutsScreen />);
    COMMUNITY_CATEGORIES.forEach((category) => {
      fireEvent.press(utils.getByTestId(`chip-${category}`));
      expect(cardIds(utils)).toEqual(slugsIn(category));
      expect(cardIds(utils).length).toBeGreaterThan(0);
    });
    fireEvent.press(utils.getByTestId('chip-All'));
    expect(cardIds(utils)).toEqual(slugsIn('All'));
  });

  it('saves a tapped workout to My Workouts under one fixed id, as a plan day is saved, and opens it', async () => {
    const utils = render(<WorkoutsScreen />);
    await act(async () => { fireEvent.press(utils.getByTestId('community-card-goblet-gang')); });
    expect(mockAddWorkout).toHaveBeenCalledTimes(1);
    const [workout, uid] = mockAddWorkout.mock.calls[0];
    expect(uid).toBe('u1');
    expect(workout).toMatchObject({
      id: 'community-goblet-gang', name: 'Goblet Gang', category: 'Lower Body', difficulty: 'beginner', source: 'community', duration: 25, xpReward: 100,
    });
    expect(workout.exercises).toEqual(sample.exercises);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/workout/community-goblet-gang');
  });

  it('opens the workout under the id the store gives it back', async () => {
    mockAddWorkout.mockImplementation(async (w) => ({ ...w, id: 'from-the-store' }));
    const utils = render(<WorkoutsScreen />);
    await act(async () => { fireEvent.press(utils.getByTestId('community-card-core-in-ten')); });
    expect(router.push).toHaveBeenCalledWith('/workout/from-the-store');
  });

  it('opens one it has already saved, without saving a second copy', async () => {
    mockWorkouts = [{ id: 'community-goblet-gang', name: 'Goblet Gang' }];
    const utils = render(<WorkoutsScreen />);
    await act(async () => { fireEvent.press(utils.getByTestId('community-card-goblet-gang')); });
    expect(mockAddWorkout).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/workout/community-goblet-gang');
  });

  it('saves a workout it has not saved yet even when others are saved', async () => {
    mockWorkouts = [{ id: 'community-goblet-gang', name: 'Goblet Gang' }, { id: 'w1', name: 'Mine' }];
    const utils = render(<WorkoutsScreen />);
    await act(async () => { fireEvent.press(utils.getByTestId('community-card-core-in-ten')); });
    expect(mockAddWorkout).toHaveBeenCalledTimes(1);
    expect(mockAddWorkout.mock.calls[0][0].id).toBe('community-core-in-ten');
  });

  it('works from a category the person has chosen', async () => {
    const utils = render(<WorkoutsScreen />);
    fireEvent.press(utils.getByTestId('chip-Core'));
    await act(async () => { fireEvent.press(utils.getByTestId('community-card-midsection-mission')); });
    expect(router.push).toHaveBeenCalledWith('/workout/community-midsection-mission');
  });

  it('does not save the workout twice when it is tapped again while it is still saving, and can be tapped again afterwards', async () => {
    let finish;
    mockAddWorkout.mockImplementation((w) => new Promise((resolve) => { finish = () => resolve({ ...w }); }));
    const utils = render(<WorkoutsScreen />);
    await act(async () => { fireEvent.press(utils.getByTestId('community-card-goblet-gang')); });
    await act(async () => { fireEvent.press(utils.getByTestId('community-card-goblet-gang')); });
    await act(async () => { fireEvent.press(utils.getByTestId('community-card-core-in-ten')); });
    expect(mockAddWorkout).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); });
    expect(router.push).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.press(utils.getByTestId('community-card-core-in-ten')); });
    expect(mockAddWorkout).toHaveBeenCalledTimes(2);
  });

  it('works for a person with no account id yet: the store keeps it on the phone, and it still opens', async () => {
    mockUser = { fitnessLevel: 'beginner' };
    const utils = render(<WorkoutsScreen />);
    await act(async () => { fireEvent.press(utils.getByTestId('community-card-goblet-gang')); });
    expect(mockAddWorkout.mock.calls[0][1]).toBeUndefined();
    expect(router.push).toHaveBeenCalledWith('/workout/community-goblet-gang');
  });

  it('no longer shows the movement browser: no Browse Exercises, no search, no body-part choices, no Recent, no View All', () => {
    const utils = render(<WorkoutsScreen />);
    const t = texts(utils);
    expect(t).not.toContain('Browse Exercises');
    expect(t).not.toContain('View All');
    expect(t).not.toContain('Recent');
    expect(utils.queryByTestId('exercise-search')).toBeNull();
    expect(utils.queryByTestId('chip-Recent')).toBeNull();
    expect(utils.queryByTestId('chip-Chest')).toBeNull();
  });

  it('ends with a small Browse all movements link that opens the exercise library', () => {
    const utils = render(<WorkoutsScreen />);
    const t = texts(utils);
    expect(t[t.length - 1]).toBe('Browse all movements');
    fireEvent.press(utils.getByTestId('browse-movements'));
    expect(router.push).toHaveBeenLastCalledWith('/exercise');
  });

  it('keeps the program and My Workouts as they were', () => {
    mockWorkouts = [{ id: 'w1', name: 'Iron Hour', duration: 45, difficulty: 'Intermediate' }];
    const utils = render(<WorkoutsScreen />);
    fireEvent.press(utils.getByTestId('program-card'));
    expect(router.push).toHaveBeenLastCalledWith(`/workout/program/${getFeaturedProgram().id}`);
    fireEvent.press(utils.getByTestId('workout-card-w1'));
    expect(router.push).toHaveBeenLastCalledWith('/workout/w1');
  });
});
