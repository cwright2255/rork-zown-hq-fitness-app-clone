// Quick Workout builds the workout with the AI, which is part of Pro (lib/entitlements.js). A person on Free is taken to the plans with
// the feature they wanted; any other failure keeps the old message and stays on the screen.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }), { virtual: true });
jest.mock('@/components/ScreenHeader', () => () => null);
jest.mock('@/components/PrimaryButton', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return ({ title, onPress, disabled }) => mockReact.createElement(mockRn.Pressable, { onPress, disabled, accessibilityLabel: title }, mockReact.createElement(mockRn.Text, null, title));
});
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1', fitnessLevel: 'beginner' } }) }));
const mockGenerate = jest.fn();
const mockAddWorkout = jest.fn();
jest.mock('@/store/workoutStore', () => ({ useWorkoutStore: { getState: () => ({ generateNewWorkoutRecommendation: mockGenerate, addWorkout: mockAddWorkout }) } }));
jest.mock('@/lib/userProfileData', () => ({ toQuickWorkoutGoals: () => ['strength'], profileForWorkouts: () => ({}) }));
jest.mock('@/services/coachSnapshotService', () => ({ getProfileFromStores: () => ({}) }));

import QuickWorkoutScreen from '../app/workout/quick';

const planError = (details = { feature: 'aiWorkoutPlan', needs: 'pro', tier: 'free' }) => Object.assign(new Error('needs pro'), {
  code: 'functions/permission-denied', details: { reason: 'plan_required', ...details },
});
const settle = () => act(async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); });
const generate = async (utils) => { fireEvent.press(utils.getByLabelText('Generate Workout')); await settle(); };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('Quick Workout on a plan without AI workouts', () => {
  it('opens the plans, with the feature the person wanted, instead of saying something went wrong', async () => {
    mockGenerate.mockRejectedValue(planError());
    const utils = render(<QuickWorkoutScreen />);
    await generate(utils);
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/paywall', params: { feature: 'aiWorkoutPlan' } });
    expect(utils.queryByText(/Couldn't generate a workout/)).toBeNull();
  });

  it('is ready to try again afterwards: the button is back', async () => {
    mockGenerate.mockRejectedValue(planError());
    const utils = render(<QuickWorkoutScreen />);
    await generate(utils);
    expect(utils.getByLabelText('Generate Workout')).toBeTruthy();
  });
});

describe('Quick Workout when something else goes wrong', () => {
  it('keeps the old message and stays here', async () => {
    mockGenerate.mockRejectedValue(new Error('network'));
    const utils = render(<QuickWorkoutScreen />);
    await generate(utils);
    expect(utils.getByText("Couldn't generate a workout right now. Please try again.")).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('still saves and opens the workout when it is built', async () => {
    mockGenerate.mockResolvedValue({ plan: { days: [{ focus: 'Push', exercises: [{ name: 'Press', sets: 3, reps: 8, restSeconds: 60 }] }] } });
    mockAddWorkout.mockResolvedValue({ id: 'w1' });
    const utils = render(<QuickWorkoutScreen />);
    await generate(utils);
    expect(mockAddWorkout).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/workout/w1');
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
