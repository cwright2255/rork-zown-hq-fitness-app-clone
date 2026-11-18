// The Workouts tab (app/workouts.jsx), six things that were wrong with it:
//   1. Quick Workout and Today's Session were at the very bottom; they are first on the page.
//   2. My Workouts came after Browse Exercises; it is above it.
//   3. "This Week" counted the last 7 days; it counts the week, Monday to now.
//   4. The recommended plan showed 3 of its days and none could be opened; all show on request, and a day opens as a workout.
//   5. The program's tile said nothing of where the person is in it; it says "Week 2 of 9".
//   6. Browse Exercises was always the same first ten; it has search, body-part choices and Recent.
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
let mockExercises = [];
let mockHasNextPage = false;
let mockIsLoadingExercises = false;
const mockLoadExercises = jest.fn();
jest.mock('@/store/exerciseStore', () => ({
  useExerciseStore: () => ({
    exercises: mockExercises, isLoading: mockIsLoadingExercises, hasNextPage: mockHasNextPage, loadExercises: mockLoadExercises,
  }),
}));
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
import { useRecentExercisesStore } from '../store/recentExercisesStore';

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

const PARTS = ['WAIST', 'CHEST', 'BACK', 'UPPER LEGS'];
const ex = (n, over = {}) => ({
  exerciseId: `e${n}`, name: `Move ${String(n).padStart(2, '0')}`, gifUrl: '', bodyParts: [PARTS[n % PARTS.length]], equipments: ['BODY WEIGHT'], ...over,
});
const library = (count) => Array.from({ length: count }, (_, i) => ex(i));

beforeEach(() => {
  mockUser = { uid: 'u1', fitnessLevel: 'beginner' };
  mockExercises = library(60);
  mockHasNextPage = false;
  mockIsLoadingExercises = false;
  mockWorkouts = [];
  mockCompleted = [];
  mockRecommendation = planFor();
  mockLoadExercises.mockReset();
  mockAddWorkout.mockReset();
  mockAddWorkout.mockImplementation(async (w) => ({ ...w, id: w.id ?? 'local-1' }));
  router.push.mockClear();
  useRecentExercisesStore.setState({ recent: [] });
});

describe('1 and 2: the order of the page', () => {
  it('puts Quick Workout and Today\'s Session first, then Your Stats, the plan, the program, My Workouts and Browse Exercises', () => {
    mockWorkouts = [{ id: 'w1', name: 'Iron Hour', duration: 45, difficulty: 'Intermediate' }];
    const t = texts(render(<WorkoutsScreen />));
    const order = ['Workouts', 'Quick Workout', "Today's Session", 'Your Stats', 'Recommended For You', 'Training Program', 'My Workouts', 'Browse Exercises'];
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

  it('puts My Workouts above Browse Exercises when there are no workouts yet, too', () => {
    const t = texts(render(<WorkoutsScreen />));
    expect(t.indexOf('My Workouts')).toBeLessThan(t.indexOf('Browse Exercises'));
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

describe('6: Browse Exercises', () => {
  const cards = (utils) => texts(utils).filter((x) => /^Move \d\d$/.test(x));

  it('shows the first ten as it always did, with nothing typed and nothing chosen', () => {
    const utils = render(<WorkoutsScreen />);
    expect(cards(utils)).toEqual(Array.from({ length: 10 }, (_, i) => `Move ${String(i).padStart(2, '0')}`));
  });

  it('finds an exercise past the first ten by typing part of its name, and goes back when the box is cleared', () => {
    const utils = render(<WorkoutsScreen />);
    fireEvent.changeText(utils.getByTestId('exercise-search'), 'move 47');
    expect(cards(utils)).toEqual(['Move 47']);
    fireEvent.press(utils.getByTestId('exercise-search-clear'));
    expect(cards(utils)).toHaveLength(10);
    expect(utils.queryByTestId('exercise-search-clear')).toBeNull();
  });

  it('offers the body parts the phone holds as choices, and shows one body part when it is chosen', () => {
    const utils = render(<WorkoutsScreen />);
    ['All', 'Waist', 'Chest', 'Back', 'Upper Legs'].forEach((label) => expect(utils.getByTestId(`chip-${label}`)).toBeTruthy());
    fireEvent.press(utils.getByTestId('chip-Chest'));
    const shown = cards(utils);
    expect(shown.length).toBe(15);
    expect(shown.length).toBeLessThanOrEqual(20);
    expect(shown.every((name) => PARTS[Number(name.slice(5)) % 4] === 'CHEST')).toBe(true);
    fireEvent.press(utils.getByTestId('chip-Chest')); // tapping it again clears it
    expect(cards(utils)).toHaveLength(10);
  });

  it('puts a body part and a search together, and All clears both choices', () => {
    const utils = render(<WorkoutsScreen />);
    fireEvent.press(utils.getByTestId('chip-Waist'));
    fireEvent.changeText(utils.getByTestId('exercise-search'), 'move 1');
    expect(cards(utils)).toEqual(['Move 12', 'Move 16']);
    fireEvent.press(utils.getByTestId('chip-All'));
    expect(cards(utils).length).toBeGreaterThan(2);
  });

  it('has no Recent choice until an exercise has been opened, then lists what was opened, newest first', () => {
    const utils = render(<WorkoutsScreen />);
    expect(utils.queryByTestId('chip-Recent')).toBeNull();
    act(() => {
      useRecentExercisesStore.getState().addRecent(ex(30));
      useRecentExercisesStore.getState().addRecent({ exerciseId: 'far', name: 'Far Away Lift', bodyParts: ['BACK'], equipments: [] });
    });
    fireEvent.press(utils.getByTestId('chip-Recent'));
    const t = texts(utils);
    const first = t.indexOf('Far Away Lift');
    expect(first).toBeGreaterThan(-1);
    expect(t.indexOf('Move 30')).toBeGreaterThan(first);
    expect(cards(utils)).toEqual(['Move 30']); // nothing else of the library is mixed in
  });

  it('opens an exercise from Recent as it does from the row', () => {
    const utils = render(<WorkoutsScreen />);
    act(() => { useRecentExercisesStore.getState().addRecent({ exerciseId: 'far', name: 'Far Away Lift', bodyParts: [], equipments: [] }); });
    fireEvent.press(utils.getByTestId('chip-Recent'));
    fireEvent.press(utils.getByText('Far Away Lift'));
    expect(router.push).toHaveBeenLastCalledWith('/exercise/far');
  });

  it('drops back to All when Log Out empties Recent while it is chosen', () => {
    const utils = render(<WorkoutsScreen />);
    act(() => { useRecentExercisesStore.getState().addRecent(ex(30)); });
    fireEvent.press(utils.getByTestId('chip-Recent'));
    act(() => { useRecentExercisesStore.setState({ recent: [] }); });
    expect(utils.queryByTestId('chip-Recent')).toBeNull();
    expect(cards(utils)).toHaveLength(10);
  });

  it('says so when nothing matches, and does not ask for more exercises when the whole library is already held', () => {
    const utils = render(<WorkoutsScreen />);
    fireEvent.changeText(utils.getByTestId('exercise-search'), 'zzzz');
    expect(utils.getByTestId('exercise-no-results')).toBeTruthy();
    expect(utils.getByText(/No exercises match/)).toBeTruthy();
    expect(mockLoadExercises).not.toHaveBeenCalled();
  });

  describe('searching past what the phone holds', () => {
    it('asks for the next page of exercises while a search finds too few, and stops after five', () => {
      mockHasNextPage = true;
      const utils = render(<WorkoutsScreen />);
      expect(mockLoadExercises).not.toHaveBeenCalled(); // nothing typed: no extra loading
      fireEvent.changeText(utils.getByTestId('exercise-search'), 'zzzz');
      expect(mockLoadExercises).toHaveBeenCalledTimes(5);
      mockLoadExercises.mock.calls.forEach((args) => expect(args).toEqual([false]));
      fireEvent.changeText(utils.getByTestId('exercise-search'), 'zzzzz');
      expect(mockLoadExercises).toHaveBeenCalledTimes(5); // a search that matches nothing does not walk the whole library
    });

    it('does not ask for more when the search already fills the row', () => {
      mockHasNextPage = true;
      const utils = render(<WorkoutsScreen />);
      fireEvent.changeText(utils.getByTestId('exercise-search'), 'move');
      expect(mockLoadExercises).not.toHaveBeenCalled();
    });

    it('does not ask for more inside Recent, which is only what was opened', () => {
      mockHasNextPage = true;
      const utils = render(<WorkoutsScreen />);
      act(() => { useRecentExercisesStore.getState().addRecent(ex(30)); });
      fireEvent.press(utils.getByTestId('chip-Recent'));
      fireEvent.changeText(utils.getByTestId('exercise-search'), 'zzzz');
      expect(mockLoadExercises).not.toHaveBeenCalled();
    });

    it('says it is searching while a page is on its way, instead of saying nothing matches', () => {
      mockHasNextPage = true;
      mockIsLoadingExercises = true;
      const utils = render(<WorkoutsScreen />);
      fireEvent.changeText(utils.getByTestId('exercise-search'), 'zzzz');
      expect(utils.getByText('Searching more exercises…')).toBeTruthy();
      expect(utils.queryByText(/No exercises match/)).toBeNull();
    });
  });

  it('keeps the retry state when no exercises have loaded at all', () => {
    mockExercises = [];
    const utils = render(<WorkoutsScreen />);
    expect(utils.queryByTestId('exercise-no-results')).toBeNull();
    expect(cards(utils)).toEqual([]);
  });
});
