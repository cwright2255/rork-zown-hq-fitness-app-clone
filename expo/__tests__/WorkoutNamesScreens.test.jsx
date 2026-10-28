// The made-up names (lib/workoutNames.js) on the Workouts tab: the 7-day plan and its days, and the three Training Programs (data/workoutPrograms.js).
// The Workouts screen is the real one; the workout store is stood in for with a plan that is already built.
import React from 'react';
import { render } from '@testing-library/react-native';

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
let mockUser = { uid: 'u1' };
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: mockUser }) }));
jest.mock('@/store/exerciseStore', () => ({
  useExerciseStore: () => ({ exercises: [], isLoading: false, loadExercises: jest.fn() }),
}));
jest.mock('@/services/coachSnapshotService', () => ({ getProfileFromStores: () => ({}) }));
let mockRecommendation = null;
jest.mock('@/store/workoutStore', () => {
  const actual = jest.requireActual('../store/workoutStore');
  const hook = (selector) => {
    const state = {
      ...actual.useWorkoutStore.getState(),
      workouts: [], loadWorkoutTemplates: jest.fn(), loadWorkoutRecommendation: jest.fn(), loadWorkouts: jest.fn(),
      getWorkoutStreak: () => ({ current: 0, longest: 0 }), workoutRecommendation: mockRecommendation, isLoadingRecommendation: false,
      generateNewWorkoutRecommendation: jest.fn(),
    };
    return selector ? selector(state) : state;
  };
  return { ...actual, useWorkoutStore: Object.assign(hook, actual.useWorkoutStore) };
});

import WorkoutsScreen from '../app/workouts';
import { NAME_POOLS, PLAN_POOLS, titlesForPlan, titleForPlan } from '../lib/workoutNames';
import { WORKOUT_PROGRAMS, getFeaturedProgram } from '../data/workoutPrograms';
import { LIBRARY, normalizeName } from '../lib/exerciseLibrary';

const DAYS = [
  { day: 'Monday', focus: 'Upper Body Push', exercises: [{ name: 'Bench Press' }, { name: 'Overhead Press' }] },
  { day: 'Tuesday', focus: 'Lower Body', exercises: [{ name: 'Trap Bar Deadlift' }, { name: 'Leg Press' }] },
  { day: 'Wednesday', focus: 'Rest and Recovery', exercises: [] },
  { day: 'Thursday', focus: 'Pull and Core', exercises: [{ name: 'Lat Pulldown' }, { name: 'Plank' }] },
];
const PROMPT = 'Create a 7-day plan for a beginner user with goals: Build Muscle, Strength. About the user: 30 years old.';
const planFor = (over = {}) => ({ id: 'rec-1', prompt: PROMPT, structuredData: { days: DAYS }, ...over });

beforeEach(() => {
  mockUser = { uid: 'u1' };
  mockRecommendation = planFor();
});

describe('the 7-day plan on the Workouts tab', () => {
  it('has a made-up name for the plan, taken from the goals it was asked for', () => {
    const utils = render(<WorkoutsScreen />);
    const name = utils.getByTestId('plan-name').props.children;
    expect(name).toBe(titleForPlan({ seed: 'rec-1', goals: ['Build Muscle', 'Strength'] }));
    expect(PLAN_POOLS.muscle).toContain(name);
  });

  it('gives each day a made-up name, with what the day trains below it', () => {
    const utils = render(<WorkoutsScreen />);
    const expected = titlesForPlan(DAYS, { seed: 'rec-1' });
    [0, 1, 2].forEach((i) => {
      const shown = utils.getByTestId(`plan-day-name-${i}`).props.children;
      expect(shown).toBe(expected[i]);
      expect(Object.values(NAME_POOLS).flat()).toContain(shown);
      expect(utils.getByText(DAYS[i].day)).toBeTruthy();
      expect(utils.getByText(DAYS[i].focus)).toBeTruthy();
    });
    // the fourth day is not on this card
    expect(utils.queryByTestId('plan-day-name-3')).toBeNull();
    expect(new Set(expected).size).toBe(expected.length);
  });

  it('never shows an exercise\'s name as the name of a day', () => {
    const utils = render(<WorkoutsScreen />);
    const exercises = new Set(LIBRARY.map((e) => normalizeName(e.name)));
    [0, 1, 2].forEach((i) => {
      const shown = utils.getByTestId(`plan-day-name-${i}`).props.children;
      expect(exercises.has(normalizeName(shown))).toBe(false);
      expect(normalizeName(shown)).not.toContain('trap bar');
    });
  });

  it('shows the same names every time the screen opens', () => {
    const first = render(<WorkoutsScreen />);
    const names = [first.getByTestId('plan-name').props.children, ...[0, 1, 2].map((i) => first.getByTestId(`plan-day-name-${i}`).props.children)];
    first.unmount();
    const second = render(<WorkoutsScreen />);
    expect([second.getByTestId('plan-name').props.children, ...[0, 1, 2].map((i) => second.getByTestId(`plan-day-name-${i}`).props.children)]).toEqual(names);
  });

  it('keeps its name when the goals on the profile change later: it was made for the goals in its request', () => {
    mockUser = { uid: 'u1', goals: ['lose_weight'] };
    const utils = render(<WorkoutsScreen />);
    expect(utils.getByTestId('plan-name').props.children).toBe(titleForPlan({ seed: 'rec-1', goals: ['Build Muscle', 'Strength'] }));
  });

  it('falls back to the goals on the profile for a plan whose request does not say', () => {
    mockRecommendation = planFor({ prompt: undefined });
    mockUser = { uid: 'u1', goals: ['lose_weight'] };
    const utils = render(<WorkoutsScreen />);
    const name = utils.getByTestId('plan-name').props.children;
    expect(PLAN_POOLS.lose).toContain(name);
    expect(name).toBe(titleForPlan({ seed: 'rec-1', goals: ['lose weight'] }));
  });

  it('uses the general list when nothing says what the goals are', () => {
    mockRecommendation = planFor({ prompt: 'Create a 7-day plan.' });
    const utils = render(<WorkoutsScreen />);
    expect(PLAN_POOLS.general).toContain(utils.getByTestId('plan-name').props.children);
  });

  it('shows no names, and no error, while there is no plan', () => {
    mockRecommendation = null;
    const utils = render(<WorkoutsScreen />);
    expect(utils.queryByTestId('plan-name')).toBeNull();
    expect(utils.queryByTestId('plan-day-name-0')).toBeNull();
    expect(utils.getByText('Get Recommendation')).toBeTruthy();
  });

  it('copes with a plan whose days have no exercises or no focus', () => {
    mockRecommendation = planFor({ structuredData: { days: [{ day: 'Monday' }, { day: 'Tuesday', exercises: null }] } });
    const utils = render(<WorkoutsScreen />);
    expect(Object.values(NAME_POOLS).flat()).toContain(utils.getByTestId('plan-day-name-0').props.children);
    expect(Object.values(NAME_POOLS).flat()).toContain(utils.getByTestId('plan-day-name-1').props.children);
  });
});

describe('the Training Programs', () => {
  const exercises = new Set(LIBRARY.map((e) => normalizeName(e.name)));
  const pooled = new Set(Object.values(NAME_POOLS).flat().concat(Object.values(PLAN_POOLS).flat()));

  it('are called Sweat Symphony, Split Decision and Push Pull Powerhouse', () => {
    expect(WORKOUT_PROGRAMS.map((p) => p.title)).toEqual(['Sweat Symphony', 'Split Decision', 'Push Pull Powerhouse']);
  });

  it('no longer carry the plain names they had', () => {
    const titles = WORKOUT_PROGRAMS.map((p) => p.title);
    ['Full Body Foundations', 'Upper/Lower Strength', 'Push Pull Legs'].forEach((old) => expect(titles).not.toContain(old));
  });

  it('keep what they are in the line under the name, so nobody has to guess', () => {
    expect(WORKOUT_PROGRAMS.map((p) => p.subtitle)).toEqual(['9 weeks • 3x/week', '9 weeks • 4x/week', '9 weeks • 6x/week']);
    expect(WORKOUT_PROGRAMS[0].description).toMatch(/full body/i);
    expect(WORKOUT_PROGRAMS[1].description).toMatch(/upper\/lower/i);
    expect(WORKOUT_PROGRAMS[2].description).toMatch(/push\/pull\/legs/i);
  });

  it('keep their ids, so progress people have already made stays with them', () => {
    expect(WORKOUT_PROGRAMS.map((p) => p.id)).toEqual(['full-body-foundations', 'upper-lower-strength', 'push-pull-legs']);
  });

  it('follow the same rules as the other names: short, no digits, not an exercise, and not a name another list already uses', () => {
    const titles = WORKOUT_PROGRAMS.map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
    titles.forEach((t) => {
      expect(t.length).toBeLessThanOrEqual(30);
      expect(t.split(/\s+/).length).toBeGreaterThanOrEqual(1);
      expect(t.split(/\s+/).length).toBeLessThanOrEqual(5);
      expect(t).not.toMatch(/\d/);
      expect(exercises.has(normalizeName(t))).toBe(false);
      expect(pooled.has(t)).toBe(false);
    });
  });

  it('show the featured program\'s new name on the Workouts tab', () => {
    const utils = render(<WorkoutsScreen />);
    const featured = getFeaturedProgram();
    expect(utils.getAllByText(featured.title).length).toBeGreaterThan(0);
    ['Full Body Foundations', 'Upper/Lower Strength', 'Push Pull Legs'].forEach((old) => expect(utils.queryByText(old)).toBeNull());
  });
});
