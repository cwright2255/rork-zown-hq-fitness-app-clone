// Every workout and running preview screen shows the same "Muscles You'll Work" heat figure as the trail preview (components/PreviewMuscleHeat.jsx
// around components/MuscleHeatmapCard.jsx): the person's latest scan, painted by heat worked out from the workout itself. These open each
// screen and look at what the figure was given.
import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-router', () => {
  const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
  return { useRouter: () => mockRouter, router: mockRouter, useLocalSearchParams: () => global.__params };
}, { virtual: true });
jest.mock('@/components/ScreenHeader', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/PrimaryButton', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { __esModule: true, default: ({ title }) => mockReact.createElement(mockRn.Text, null, title) };
});
// The card itself (3D scan, 2D picture) is not what is looked at here, only what it is given.
jest.mock('@/components/MuscleHeatmapCard', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: (props) => {
      global.__heat.push(props);
      return mockReact.createElement(mockRn.View, { testID: 'heat-card' });
    },
  };
});
jest.mock('@/hooks/useLatestBodyScan', () => ({ useLatestBodyScan: () => ({ scan: global.__scan, retry: global.__retry }) }));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1' } }) }));
jest.mock('@/store/runningStore', () => ({
  useRunningStore: () => ({
    programProgress: {}, loadRuns: jest.fn(), programs: [], loadRunningPrograms: jest.fn(), favoriteProgramIds: [], toggleFavoriteProgram: jest.fn(),
  }),
}));
// The real store hands back the same objects until something changes; the screen's effects depend on that, so these must not be new each render.
jest.mock('@/store/workoutStore', () => {
  const mockNone = [];
  const mockNoProgress = {};
  const mockClear = () => {};
  return {
    useWorkoutStore: () => ({ workouts: global.__workouts, customWorkouts: mockNone, inProgress: mockNoProgress, clearWorkoutProgress: mockClear }),
  };
});

import StrengthDayPreview from '../app/workout/program/session/[id]';
import StrengthProgramOverview from '../app/workout/program/[id]';
import StrengthWeek from '../app/workout/program/week/[id]';
import WorkoutTemplatePreview from '../app/workout/[id]';
import RunningProgramPreview from '../app/running/[id]';
import RunningWeek from '../app/running/week/[id]';
import RunningSessionPreview from '../app/running/session/[id]';
import { WORKOUT_PROGRAMS, getProgramWeek } from '../data/workoutPrograms';
import { strengthMuscleHeat, runningMuscleHeat, weekExercises } from '../lib/workoutMuscleHeat';

const program = WORKOUT_PROGRAMS[0];
const scan = { id: 'scan-1' };

const open = (Screen, params) => {
  global.__params = params;
  global.__heat = [];
  return render(<Screen />);
};
const figure = () => global.__heat[global.__heat.length - 1];
const expectHeat = (heat) => {
  expect(global.__heat.length).toBeGreaterThan(0);
  expect(figure()).toMatchObject({
    mode: 'target',
    title: "Muscles You'll Work",
    targetMuscles: heat.targetMuscles,
    muscleIntensities: heat.muscleIntensities,
    scan,
    onRetryScan: global.__retry,
  });
};

beforeEach(() => {
  global.__scan = scan;
  global.__retry = jest.fn();
  global.__workouts = [];
});

describe('strength previews', () => {
  it('the day of a program: heat from that day, and the Exercise Plan and Start Session are still there', () => {
    const day = getProgramWeek(program.id, 1).days[0];
    const utils = open(StrengthDayPreview, { id: `${program.id}-w1-d0` });
    expectHeat(strengthMuscleHeat(day.exercises));
    expect(utils.getByText('Exercise Plan')).toBeTruthy();
    expect(utils.getByText('Start Session')).toBeTruthy();
    expect(utils.getAllByTestId('heat-card')).toHaveLength(1);
  });

  it('a different day of the same program gets its own heat', () => {
    const days = getProgramWeek(program.id, 1).days;
    open(StrengthDayPreview, { id: `${program.id}-w1-d0` });
    const first = figure().muscleIntensities;
    open(StrengthDayPreview, { id: `${program.id}-w1-d1` });
    expect(figure().muscleIntensities).toEqual(strengthMuscleHeat(days[1].exercises).muscleIntensities);
    expect(figure().muscleIntensities).not.toEqual(first);
  });

  it('the week of a program: heat from every day of that week', () => {
    open(StrengthWeek, { id: `${program.id}-w2` });
    expectHeat(strengthMuscleHeat(weekExercises(getProgramWeek(program.id, 2))));
  });

  it('the program itself: heat from its first week', () => {
    open(StrengthProgramOverview, { id: program.id });
    expectHeat(strengthMuscleHeat(weekExercises(getProgramWeek(program.id, 1))));
  });

  it('a saved workout: heat from its exercises, by library name and by the muscles written on it', () => {
    global.__workouts = [{
      id: 'w1', title: 'Mine', name: 'Mine',
      exercises: [
        { id: 'e1', name: 'Barbell Bench Press', sets: 3, reps: '8-10', muscleGroups: ['Chest'] },
        { id: 'e2', name: 'Mystery Move', sets: 3, reps: '10', muscleGroups: ['quads'] },
      ],
    }];
    open(WorkoutTemplatePreview, { id: 'w1' });
    expectHeat(strengthMuscleHeat(global.__workouts[0].exercises));
    expect(figure().targetMuscles).toEqual(expect.arrayContaining(['chest', 'quadriceps']));
  });

  it('a saved workout with nothing the app knows a muscle for shows no empty card', () => {
    global.__workouts = [{ id: 'w2', title: 'Odd', name: 'Odd', exercises: [{ id: 'e1', name: 'Mystery Move', sets: 3, reps: '10' }] }];
    const utils = open(WorkoutTemplatePreview, { id: 'w2' });
    expect(utils.queryByTestId('heat-card')).toBeNull();
  });

  it('shows the 3D figure its scan when there is one and none when there is not', () => {
    global.__scan = null;
    open(StrengthDayPreview, { id: `${program.id}-w1-d0` });
    expect(figure().scan).toBeNull();
  });
});

describe('running previews', () => {
  const running = runningMuscleHeat();

  it('the program', () => {
    open(RunningProgramPreview, { id: 'c25k' });
    expectHeat(running);
  });

  it('the week', () => {
    const utils = open(RunningWeek, { id: 'c25k-w1' });
    expectHeat(running);
    expect(utils.getAllByTestId('heat-card')).toHaveLength(1);
  });

  it('the session, with Start Session still there', () => {
    const utils = open(RunningSessionPreview, { programId: 'c25k', week: '1', sessionIndex: '0' });
    expectHeat(running);
    expect(utils.getByText('Start Session')).toBeTruthy();
  });

  it('a program that does not exist shows no figure', () => {
    const utils = open(RunningSessionPreview, { programId: 'nope', week: '1', sessionIndex: '0' });
    expect(utils.queryByTestId('heat-card')).toBeNull();
  });
});
