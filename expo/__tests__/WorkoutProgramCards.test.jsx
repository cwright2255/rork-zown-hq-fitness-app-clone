// The Training Program card on the Workouts tab is the same card as the My Workouts cards.
// The Workouts screen is the real one; the workout store is stood in for with two saved workouts.
import React from 'react';
import fs from 'fs';
import path from 'path';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

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
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1' } }) }));
jest.mock('@/store/exerciseStore', () => ({
  useExerciseStore: () => ({ exercises: [], isLoading: false, loadExercises: jest.fn() }),
}));
jest.mock('@/services/coachSnapshotService', () => ({ getProfileFromStores: () => ({}) }));
let mockWorkouts = [];
jest.mock('@/store/workoutStore', () => {
  const actual = jest.requireActual('../store/workoutStore');
  const hook = (selector) => {
    const state = {
      ...actual.useWorkoutStore.getState(),
      workouts: mockWorkouts, loadWorkoutTemplates: jest.fn(), loadWorkoutRecommendation: jest.fn(), loadWorkouts: jest.fn(),
      getWorkoutStreak: () => ({ current: 0, longest: 0 }), workoutRecommendation: null, isLoadingRecommendation: false,
      generateNewWorkoutRecommendation: jest.fn(),
    };
    return selector ? selector(state) : state;
  };
  return { ...actual, useWorkoutStore: Object.assign(hook, actual.useWorkoutStore) };
});

import { router } from 'expo-router';
import WorkoutsScreen from '../app/workouts';
import { getFeaturedProgram } from '../data/workoutPrograms';

const WORKOUTS = [
  { id: 'w1', name: 'Iron Hour', duration: 45, difficulty: 'Intermediate' },
  { id: 'w2', name: 'Quick Burn', duration: 20, difficulty: 'Beginner' },
];

beforeEach(() => {
  mockWorkouts = WORKOUTS;
  router.push.mockClear();
});

// What a card is made of, without the words: each element's type, its flattened style, and what is inside it.
function shape(node) {
  if (typeof node === 'string') return 'text';
  if (!node) return null;
  return {
    type: node.type,
    style: StyleSheet.flatten(node.props.style) || null,
    children: (node.children || []).map(shape),
  };
}

describe('the Training Program card', () => {
  it('is built the same way as a My Workouts card: the same picture box, the same title and the same line under it', () => {
    const utils = render(<WorkoutsScreen />);
    const workout = shape(utils.getByTestId('workout-card-w1'));
    const program = shape(utils.getByTestId('program-card'));
    expect(program.style).toEqual(workout.style);
    // picture box, title, line under the title (the program has one more line after these, see below)
    expect(program.children.slice(0, 3)).toEqual(workout.children.slice(0, 3));
  });

  it('is the same size as a My Workouts card, not a full-width box', () => {
    const utils = render(<WorkoutsScreen />);
    const style = StyleSheet.flatten(utils.getByTestId('program-card').props.style);
    expect(style.width).toBe(160);
    expect(style.marginHorizontal).toBeUndefined();
    expect(style.backgroundColor).toBeUndefined();
  });

  it('shows the featured program\'s name, its own line (weeks and days a week) and its level', () => {
    const utils = render(<WorkoutsScreen />);
    const featured = getFeaturedProgram();
    expect(utils.getByText(featured.title)).toBeTruthy();
    expect(utils.getByText(featured.subtitle)).toBeTruthy();
    expect(utils.getByText(featured.level)).toBeTruthy();
  });

  it('keeps the level on its own line in the same small grey text, so the weeks line is never cut off', () => {
    const utils = render(<WorkoutsScreen />);
    const featured = getFeaturedProgram();
    const subtitle = StyleSheet.flatten(utils.getByText(featured.subtitle).props.style);
    const level = StyleSheet.flatten(utils.getByText(featured.level).props.style);
    expect(level).toEqual(subtitle);
    expect(utils.getByText(featured.subtitle).props.numberOfLines).toBe(1);
  });

  it('opens that program\'s overview when tapped, as before', () => {
    const utils = render(<WorkoutsScreen />);
    fireEvent.press(utils.getByTestId('program-card'));
    expect(router.push).toHaveBeenCalledWith(`/workout/program/${getFeaturedProgram().id}`);
  });

  it('no longer has the big grey box, its badge, its description or its View Program row', () => {
    const utils = render(<WorkoutsScreen />);
    const featured = getFeaturedProgram();
    expect(utils.queryByText('View Program')).toBeNull();
    expect(utils.queryByText(featured.description)).toBeNull();
    expect(utils.queryAllByText(featured.level)).toHaveLength(1); // the old badge repeated it
  });

  it('shows on the tab when someone has no saved workouts too', () => {
    mockWorkouts = [];
    const utils = render(<WorkoutsScreen />);
    expect(utils.getByTestId('program-card')).toBeTruthy();
  });
});

describe('the My Workouts cards', () => {
  it('still show the name, "N min · level", and open the workout when tapped', () => {
    const utils = render(<WorkoutsScreen />);
    expect(utils.getByText('Iron Hour')).toBeTruthy();
    expect(utils.getByText('45 min · Intermediate')).toBeTruthy();
    expect(utils.getByText('20 min · Beginner')).toBeTruthy();
    fireEvent.press(utils.getByTestId('workout-card-w2'));
    expect(router.push).toHaveBeenCalledWith('/workout/w2');
  });
});

describe('one card for both rows', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'workouts.jsx'), 'utf8');

  it('is written once: both cards are made by WorkoutTile, and the card styles are used nowhere else', () => {
    expect((source.match(/<WorkoutTile\b/g) || []).length).toBe(2);
    expect((source.match(/styles\.programCard\b/g) || []).length).toBe(1);
    expect((source.match(/styles\.programImage\b/g) || []).length).toBe(1);
  });

  it('leaves none of the old big card\'s styles behind', () => {
    expect(source).not.toMatch(/programFeatured|programLevelBadge|programToggle/);
  });
});
