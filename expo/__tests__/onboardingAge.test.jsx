// Onboarding (app/onboarding.jsx) asks for a date of birth and keeps blanks blank.
//   - About You will not go on without a real date of birth, and the person must be 13 or older (lib/ageGate.js).
//   - Someone under 13 cannot continue: the account they just made is removed through the deleteMyAccount Cloud Function
//     (services/underageRemoval.js), they are signed out, and the date they typed is never saved.
//   - A height or weight left blank is saved as blank (null), not as 175 cm or 70 kg, and the age comes from the date typed, not a default.
//   - Finish stamps the profile with onboardedAt, which is how signing in again tells a finished setup from one quit part way.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ useRouter: () => global.__router }), { virtual: true });
jest.mock('lucide-react-native', () => ({ ChevronLeft: 'ChevronLeft' }), { virtual: true });
jest.mock('@/store/userStore', () => {
  const useUserStore = () => ({
    user: { uid: 'u1', name: 'Cj' },
    completeOnboarding: (...a) => global.__completeOnboarding(...a),
    saveProfile: (...a) => global.__saveProfile(...a),
    loadProfile: jest.fn(),
  });
  useUserStore.setState = (...a) => global.__setUserState(...a);
  return { useUserStore };
});
jest.mock('../src/services/analytics', () => ({
  ...jest.requireActual('../src/services/analytics'),
  logOnboardingCompleted: jest.fn(),
}));
jest.mock('firebase/functions', () => ({ httpsCallable: (...a) => global.__httpsCallable(...a) }));
jest.mock('../src/config/firebase', () => ({
  __esModule: true,
  get auth() { return global.__auth; },
  functions: { name: 'functions' },
}));
jest.mock('@/lib/logOut', () => ({ logOut: (...a) => global.__logOut(...a) }));

import OnboardingScreen from '../app/onboarding';

const NOW = new Date(2026, 10, 2, 12, 0, 0); // Monday 2 November 2026

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  global.__router = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
  global.__completeOnboarding = jest.fn();
  global.__saveProfile = jest.fn(async () => undefined);
  global.__setUserState = jest.fn();
  global.__auth = { currentUser: { uid: 'u1' } };
  global.__deleteMyAccount = jest.fn(async () => ({ data: {} }));
  global.__httpsCallable = jest.fn(() => (...a) => global.__deleteMyAccount(...a));
  global.__logOut = jest.fn(async () => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  ['__router', '__completeOnboarding', '__saveProfile', '__setUserState', '__auth', '__deleteMyAccount', '__httpsCallable', '__logOut']
    .forEach((k) => { delete global[k]; });
});

const settle = () => act(async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve(); });
const press = async (utils, text) => { await act(async () => { fireEvent.press(utils.getByText(text)); }); await settle(); };
const typeDob = (utils, text) => fireEvent.changeText(utils.getByTestId('dob-input'), text);

// Get Started, then About You with the date typed and Continue.
const throughAboutYou = async (utils, dob = '1995-04-12') => {
  fireEvent.press(utils.getByText('Get Started'));
  typeDob(utils, dob);
  await press(utils, 'Continue');
};

// From the body step on: Continue, a goal, Continue, Continue, Continue (to the last step).
const fromBodyStepToLast = (utils) => {
  fireEvent.press(utils.getByText('Continue'));
  fireEvent.press(utils.getByText('Build Muscle'));
  fireEvent.press(utils.getByText('Continue'));
  fireEvent.press(utils.getByText('Continue'));
  fireEvent.press(utils.getByText('Continue'));
  expect(utils.getByText('Create your Shadow')).toBeTruthy();
};

const finish = async (utils) => {
  fireEvent.press(utils.getByText('Skip for now'));
  await settle();
};
const savedUser = () => global.__setUserState.mock.calls[0][0].user;

describe('About You: the date of birth is required', () => {
  it('will not go on without one, and says so', async () => {
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils, '');
    expect(utils.getByText('About You')).toBeTruthy();
    expect(utils.queryByText('Body Metrics')).toBeNull();
    expect(utils.getByTestId('dob-error').props.children).toBe('Enter your date of birth to continue.');
  });

  it('will not go on with spaces only', async () => {
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils, '    ');
    expect(utils.queryByText('Body Metrics')).toBeNull();
    expect(utils.getByTestId('dob-error').props.children).toBe('Enter your date of birth to continue.');
  });

  it.each([
    ['12 April 1995', 'Enter your date of birth as YYYY-MM-DD, for example 1995-04-12.'],
    ['1995-02-30', 'That date does not exist. Check the month and the day.'],
    ['2027-01-01', 'That date has not happened yet. Check the year.'],
    ['1890-01-01', 'That year does not look right. Check it and try again.'],
  ])('refuses %p and says why', async (typed, message) => {
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils, typed);
    expect(utils.queryByText('Body Metrics')).toBeNull();
    expect(utils.getByTestId('dob-error').props.children).toBe(message);
    expect(global.__deleteMyAccount).not.toHaveBeenCalled(); // an unreadable date is not an under-age one
  });

  it('takes the message away as soon as the person starts typing again', async () => {
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils, 'nope');
    expect(utils.queryByTestId('dob-error')).toBeTruthy();
    typeDob(utils, '1995-04-1');
    expect(utils.queryByTestId('dob-error')).toBeNull();
  });

  it('goes on to Body Metrics with a real date', async () => {
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils, '1995-04-12');
    expect(utils.getByText('Body Metrics')).toBeTruthy();
    expect(utils.queryByTestId('dob-error')).toBeNull();
  });

  it('lets someone through on the day they turn 13', async () => {
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils, '2013-11-02');
    expect(utils.getByText('Body Metrics')).toBeTruthy();
    expect(global.__deleteMyAccount).not.toHaveBeenCalled();
  });
});

describe('someone under 13 cannot continue', () => {
  it('removes the account through deleteMyAccount, signs them out, and says so', async () => {
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils, '2013-11-03'); // turns 13 tomorrow
    expect(global.__httpsCallable).toHaveBeenCalledWith({ name: 'functions' }, 'deleteMyAccount', { timeout: 540000 });
    expect(global.__deleteMyAccount).toHaveBeenCalledWith({});
    expect(global.__logOut).toHaveBeenCalledTimes(1);
    expect(utils.getByTestId('underage-screen')).toBeTruthy();
    expect(utils.getByText('ZOWN HQ is for ages 13 and up')).toBeTruthy();
    expect(utils.getByText(/We have removed the account you just made and nothing from it was kept/)).toBeTruthy();
    expect(utils.queryByText('Body Metrics')).toBeNull();
    expect(utils.queryByText('About You')).toBeNull();
  });

  it('shows no way forward in onboarding, only a way out to the login screen', async () => {
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils, '2020-05-05');
    expect(utils.queryByText('Continue')).toBeNull();
    await press(utils, 'OK');
    expect(global.__router.replace).toHaveBeenCalledWith('/auth/login');
    expect(global.__completeOnboarding).not.toHaveBeenCalled();
  });

  it('says the account is still there, and who to email, if it could not be removed; they are still signed out', async () => {
    global.__deleteMyAccount = jest.fn(async () => { throw new Error('recent-login-required'); });
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils, '2015-06-01');
    expect(utils.getByText(/could not remove the account you just made/)).toBeTruthy();
    expect(utils.getByText(/privacy@zownhq\.com/)).toBeTruthy();
    expect(global.__logOut).toHaveBeenCalledTimes(1);
    expect(utils.queryByText('Body Metrics')).toBeNull();
  });

  it('shows that it is working while the account is being removed, with nothing to tap', async () => {
    global.__deleteMyAccount = jest.fn(() => new Promise(() => {}));
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils, '2015-06-01');
    expect(utils.getByText('Removing the account you just made...')).toBeTruthy();
    expect(utils.queryByText('OK')).toBeNull();
    expect(global.__logOut).not.toHaveBeenCalled(); // the phone is cleaned after the account is gone
  });

  it('removes the account once, however many times Continue is tapped', async () => {
    global.__deleteMyAccount = jest.fn(() => new Promise(() => {}));
    const utils = render(<OnboardingScreen />);
    fireEvent.press(utils.getByText('Get Started'));
    typeDob(utils, '2015-06-01');
    const continueButton = utils.getByText('Continue');
    await act(async () => {
      fireEvent.press(continueButton);
      fireEvent.press(continueButton);
    });
    await settle();
    expect(global.__deleteMyAccount).toHaveBeenCalledTimes(1);
  });

  it('saves nothing about them: no profile, no onboarding flag, no date', async () => {
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils, '2015-06-01');
    expect(global.__saveProfile).not.toHaveBeenCalled();
    expect(global.__setUserState).not.toHaveBeenCalled();
    expect(global.__completeOnboarding).not.toHaveBeenCalled();
  });

  it('counts a build with nobody signed in to Firebase as removed', async () => {
    global.__auth = { currentUser: null };
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils, '2015-06-01');
    expect(global.__deleteMyAccount).not.toHaveBeenCalled();
    expect(utils.getByText(/We have removed the account you just made/)).toBeTruthy();
  });

  it('is checked again at Finish: a phone clock moved to a date that makes them under 13 does not get through', async () => {
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils, '2013-11-02'); // exactly 13 today
    fromBodyStepToLast(utils);
    jest.setSystemTime(new Date(2026, 10, 1)); // the day before their 13th birthday
    await finish(utils);
    expect(global.__deleteMyAccount).toHaveBeenCalledTimes(1);
    expect(utils.getByTestId('underage-screen')).toBeTruthy();
    expect(global.__saveProfile).not.toHaveBeenCalled();
    expect(global.__completeOnboarding).not.toHaveBeenCalled();
  });

  it('is checked again at Finish: a date that stops making sense sends them back to About You with the reason', async () => {
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils, '1995-04-12');
    fromBodyStepToLast(utils);
    jest.setSystemTime(new Date(1990, 0, 1)); // a phone clock set before their birth
    await finish(utils);
    expect(utils.getByText('About You')).toBeTruthy();
    expect(utils.getByTestId('dob-error').props.children).toBe('That date has not happened yet. Check the year.');
    expect(global.__saveProfile).not.toHaveBeenCalled();
    expect(global.__completeOnboarding).not.toHaveBeenCalled();
    expect(global.__deleteMyAccount).not.toHaveBeenCalled();
  });
});

describe('Finish: blanks stay blank', () => {
  it('saves a blank height and weight as blank, not as 175 cm and 70 kg', async () => {
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils);
    fromBodyStepToLast(utils);
    await finish(utils);
    const user = savedUser();
    expect(user.heightCm).toBeNull();
    expect(user.weightKg).toBeNull();
    expect(user.fitnessMetrics.height).toBeNull();
    expect(user.fitnessMetrics.weight).toBeNull();
    expect(global.__saveProfile).toHaveBeenCalledWith('u1');
    expect(global.__router.replace).toHaveBeenCalledWith('/hq');
  });

  it('saves a blank in imperial units as blank, not as 5 ft 7 in and 150 lb', async () => {
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils);
    fireEvent.press(utils.getByText('Imperial (ft/lbs)'));
    fromBodyStepToLast(utils);
    await finish(utils);
    const user = savedUser();
    expect(user.heightCm).toBeNull();
    expect(user.weightKg).toBeNull();
    expect(user.preferences.units).toBe('imperial');
  });

  it('keeps what was typed: metric', async () => {
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils);
    fireEvent.changeText(utils.getByPlaceholderText('175'), '182.5');
    fireEvent.changeText(utils.getByPlaceholderText('70'), '81');
    fromBodyStepToLast(utils);
    await finish(utils);
    expect(savedUser().heightCm).toBe(182.5);
    expect(savedUser().weightKg).toBe(81);
    expect(savedUser().fitnessMetrics.height).toBe(182.5);
    expect(savedUser().fitnessMetrics.weight).toBe(81);
  });

  it('keeps what was typed: feet, inches and pounds, in cm and kg', async () => {
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils);
    fireEvent.press(utils.getByText('Imperial (ft/lbs)'));
    fireEvent.changeText(utils.getByPlaceholderText('5'), '5');
    fireEvent.changeText(utils.getByPlaceholderText('7'), '11');
    fireEvent.changeText(utils.getByPlaceholderText('150'), '180');
    fromBodyStepToLast(utils);
    await finish(utils);
    expect(savedUser().heightCm).toBe(180); // 71 in
    expect(savedUser().weightKg).toBe(82);
  });

  it('takes feet alone as a height (6 ft is 6 ft 0 in), not as 6 ft 7 in', async () => {
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils);
    fireEvent.press(utils.getByText('Imperial (ft/lbs)'));
    fireEvent.changeText(utils.getByPlaceholderText('5'), '6');
    fromBodyStepToLast(utils);
    await finish(utils);
    expect(savedUser().heightCm).toBe(183); // 72 in
    expect(savedUser().weightKg).toBeNull();
  });

  it('does not take inches alone as a height', async () => {
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils);
    fireEvent.press(utils.getByText('Imperial (ft/lbs)'));
    fireEvent.changeText(utils.getByPlaceholderText('7'), '9');
    fromBodyStepToLast(utils);
    await finish(utils);
    expect(savedUser().heightCm).toBeNull();
  });

  it('keeps a height when the weight is blank, and the other way round', async () => {
    const heightOnly = render(<OnboardingScreen />);
    await throughAboutYou(heightOnly);
    fireEvent.changeText(heightOnly.getByPlaceholderText('175'), '170');
    fromBodyStepToLast(heightOnly);
    await finish(heightOnly);
    expect(savedUser().heightCm).toBe(170);
    expect(savedUser().weightKg).toBeNull();
    heightOnly.unmount();

    global.__setUserState.mockClear();
    const weightOnly = render(<OnboardingScreen />);
    await throughAboutYou(weightOnly);
    fireEvent.changeText(weightOnly.getByPlaceholderText('70'), '65');
    fromBodyStepToLast(weightOnly);
    await finish(weightOnly);
    expect(savedUser().heightCm).toBeNull();
    expect(savedUser().weightKg).toBe(65);
  });

  it.each([['0'], ['-5'], ['abc'], ['  ']])('treats %p as blank', async (typed) => {
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils);
    fireEvent.changeText(utils.getByPlaceholderText('175'), typed);
    fireEvent.changeText(utils.getByPlaceholderText('70'), typed);
    fromBodyStepToLast(utils);
    await finish(utils);
    expect(savedUser().heightCm).toBeNull();
    expect(savedUser().weightKg).toBeNull();
  });
});

describe('Finish: what is saved about the date and the setup', () => {
  it('saves the date typed, in the one format, and the age worked out from it', async () => {
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils, '1995/4/12');
    fromBodyStepToLast(utils);
    await finish(utils);
    expect(savedUser().dob).toBe('1995-04-12');
    expect(savedUser().age).toBe(31);
  });

  it('stamps the profile with when it was finished, and marks onboarding done', async () => {
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils);
    fromBodyStepToLast(utils);
    await finish(utils);
    expect(savedUser().onboardedAt).toBe(NOW.toISOString());
    expect(global.__completeOnboarding).toHaveBeenCalledTimes(1);
  });

  it('does not stamp the profile before Finish', async () => {
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils);
    fromBodyStepToLast(utils);
    expect(global.__setUserState).not.toHaveBeenCalled();
    expect(global.__saveProfile).not.toHaveBeenCalled();
  });

  it('keeps the rest of the profile as before', async () => {
    const utils = render(<OnboardingScreen />);
    await throughAboutYou(utils);
    fromBodyStepToLast(utils);
    await finish(utils);
    const user = savedUser();
    expect(user.uid).toBe('u1');
    expect(user.fitnessMetrics.activityLevel).toBe('moderately_active');
    expect(user.fitnessMetrics.targetGoals).toEqual(['build_muscle']);
    expect(user.preferences.units).toBe('metric');
    expect(user.gender).toBe('Prefer not to say');
  });
});
