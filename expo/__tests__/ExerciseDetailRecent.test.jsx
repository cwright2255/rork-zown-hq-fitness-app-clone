// Opening an exercise (app/exercise/[id].jsx) puts it at the front of Recent under Browse Exercises on the Workouts tab.
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
let mockParams = { id: 'e1' };
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true }),
}), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
const mockFetchExerciseById = jest.fn();
jest.mock('@/services/exerciseDbService', () => ({ fetchExerciseById: (...args) => mockFetchExerciseById(...args) }));

import ExerciseDetailScreen from '../app/exercise/[id]';
import { useRecentExercisesStore } from '../store/recentExercisesStore';

const recent = () => useRecentExercisesStore.getState().recent;

beforeEach(() => {
  mockParams = { id: 'e1' };
  mockFetchExerciseById.mockReset();
  useRecentExercisesStore.setState({ recent: [] });
});

describe('opening an exercise', () => {
  it('puts it first in Recent, as a small summary that can draw its card', async () => {
    mockFetchExerciseById.mockResolvedValue({
      exerciseId: 'e1', name: 'Bench Press', gifUrl: 'https://img/e1.gif', bodyParts: ['CHEST'], equipments: ['BARBELL'], targetMuscles: ['PECTORALS'],
      instructions: ['Lie back.', 'Press up.'],
    });
    const utils = render(<ExerciseDetailScreen />);
    await waitFor(() => expect(recent()).toHaveLength(1));
    expect(recent()[0]).toEqual({
      exerciseId: 'e1', name: 'Bench Press', gifUrl: 'https://img/e1.gif', bodyParts: ['CHEST'], equipments: ['BARBELL'], targetMuscles: ['PECTORALS'],
    });
    await waitFor(() => expect(utils.getByText('Bench Press')).toBeTruthy());
  });

  it('puts the one opened last at the front, and an exercise opened twice is listed once', async () => {
    mockFetchExerciseById.mockResolvedValueOnce({ exerciseId: 'e1', name: 'Bench Press', bodyParts: [], equipments: [] });
    const first = render(<ExerciseDetailScreen />);
    await waitFor(() => expect(recent()).toHaveLength(1));
    first.unmount();

    mockParams = { id: 'e2' };
    mockFetchExerciseById.mockResolvedValueOnce({ exerciseId: 'e2', name: 'Squat', bodyParts: [], equipments: [] });
    const second = render(<ExerciseDetailScreen />);
    await waitFor(() => expect(recent()).toHaveLength(2));
    second.unmount();
    expect(recent().map((e) => e.name)).toEqual(['Squat', 'Bench Press']);

    mockParams = { id: 'e1' };
    mockFetchExerciseById.mockResolvedValueOnce({ exerciseId: 'e1', name: 'Bench Press', bodyParts: [], equipments: [] });
    render(<ExerciseDetailScreen />);
    await waitFor(() => expect(recent().map((e) => e.name)).toEqual(['Bench Press', 'Squat']));
  });

  it('uses the id in the address when the exercise it gets back has none of its own', async () => {
    mockFetchExerciseById.mockResolvedValue({ name: 'Plank', bodyParts: ['WAIST'], equipments: [] });
    render(<ExerciseDetailScreen />);
    await waitFor(() => expect(recent()).toHaveLength(1));
    expect(recent()[0]).toMatchObject({ exerciseId: 'e1', name: 'Plank' });
  });

  it('adds nothing when the exercise could not be loaded, or does not exist', async () => {
    mockFetchExerciseById.mockRejectedValueOnce(new Error('ExerciseDB fetch failed: 500'));
    const failed = render(<ExerciseDetailScreen />);
    await waitFor(() => expect(failed.getByText("Couldn't load this exercise.")).toBeTruthy());
    expect(recent()).toEqual([]);
    failed.unmount();

    mockFetchExerciseById.mockResolvedValueOnce(null);
    const missing = render(<ExerciseDetailScreen />);
    await waitFor(() => expect(missing.getByText('Exercise not found.')).toBeTruthy());
    expect(recent()).toEqual([]);
  });
});
