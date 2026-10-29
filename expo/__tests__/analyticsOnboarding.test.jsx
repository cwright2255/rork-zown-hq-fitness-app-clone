// The onboarding_completed analytics event, sent by app/onboarding.jsx. It is the count of people who got through the setup, so it
// is sent once when they finish (by either button on the last step), including when saving the profile fails and the screen
// moves on anyway, and never before they finish.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ useRouter: () => global.__router }), { virtual: true });
jest.mock('lucide-react-native', () => ({ ChevronLeft: 'ChevronLeft' }), { virtual: true });
jest.mock('@/store/userStore', () => {
  const useUserStore = () => ({
    user: { uid: 'u1' },
    completeOnboarding: (...a) => global.__completeOnboarding(...a),
    saveProfile: (...a) => global.__saveProfile(...a),
    loadProfile: jest.fn(),
  });
  useUserStore.setState = (...a) => global.__setUserState(...a);
  return { useUserStore };
});
jest.mock('../src/services/analytics', () => ({
  ...jest.requireActual('../src/services/analytics'),
  logOnboardingCompleted: (...a) => global.__logOnboardingCompleted(...a),
}));

import OnboardingScreen from '../app/onboarding';

beforeEach(() => {
  global.__router = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
  global.__completeOnboarding = jest.fn();
  global.__saveProfile = jest.fn(async () => undefined);
  global.__setUserState = jest.fn();
  global.__logOnboardingCompleted = jest.fn();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  ['__router', '__completeOnboarding', '__saveProfile', '__setUserState', '__logOnboardingCompleted'].forEach((k) => { delete global[k]; });
});

const settle = () => act(async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); });

// Gets to the last step: Get Started, then Continue through About You and the body step, pick a goal, and Continue through the rest.
const toLastStep = (utils) => {
  fireEvent.press(utils.getByText('Get Started'));
  fireEvent.press(utils.getByText('Continue'));
  fireEvent.press(utils.getByText('Continue'));
  fireEvent.press(utils.getByText('Build Muscle'));
  fireEvent.press(utils.getByText('Continue'));
  fireEvent.press(utils.getByText('Continue'));
  fireEvent.press(utils.getByText('Continue'));
  expect(utils.getByText('Create your Shadow')).toBeTruthy();
};

describe('the onboarding_completed analytics event', () => {
  it('is not sent while the person is still going through the steps', () => {
    const utils = render(<OnboardingScreen />);
    toLastStep(utils);
    expect(global.__logOnboardingCompleted).not.toHaveBeenCalled();
  });

  it('is sent once when they skip the body scan and finish', async () => {
    const utils = render(<OnboardingScreen />);
    toLastStep(utils);
    fireEvent.press(utils.getByText('Skip for now'));
    await settle();
    expect(global.__completeOnboarding).toHaveBeenCalledTimes(1);
    expect(global.__logOnboardingCompleted).toHaveBeenCalledTimes(1);
    expect(global.__router.replace).toHaveBeenCalledWith('/hq');
  });

  it('is sent once when they finish by going on to the body scan', async () => {
    const utils = render(<OnboardingScreen />);
    toLastStep(utils);
    fireEvent.press(utils.getByText('Scan Now'));
    await settle();
    expect(global.__logOnboardingCompleted).toHaveBeenCalledTimes(1);
    expect(global.__router.replace).toHaveBeenCalledWith('/body-scan/capture');
  });

  it('is sent once, not twice, when saving the profile fails and the screen moves on anyway', async () => {
    global.__saveProfile = jest.fn(async () => { throw new Error('offline'); });
    const utils = render(<OnboardingScreen />);
    toLastStep(utils);
    fireEvent.press(utils.getByText('Skip for now'));
    await settle();
    // the screen marks onboarding done twice on this path (before the save, and in the fallback); the event is still one
    expect(global.__completeOnboarding).toHaveBeenCalledTimes(2);
    expect(global.__logOnboardingCompleted).toHaveBeenCalledTimes(1);
    expect(global.__router.replace).toHaveBeenCalledWith('/hq');
  });

  it('is sent once if Finish is tapped twice', async () => {
    const utils = render(<OnboardingScreen />);
    toLastStep(utils);
    const skip = utils.getByText('Skip for now');
    act(() => {
      fireEvent.press(skip);
      fireEvent.press(skip);
    });
    await settle();
    expect(global.__logOnboardingCompleted).toHaveBeenCalledTimes(1);
  });

  it('carries nothing about the person: no answers from the steps', async () => {
    const utils = render(<OnboardingScreen />);
    toLastStep(utils);
    fireEvent.press(utils.getByText('Skip for now'));
    await settle();
    expect(global.__logOnboardingCompleted.mock.calls[0]).toEqual([]);
  });
});
