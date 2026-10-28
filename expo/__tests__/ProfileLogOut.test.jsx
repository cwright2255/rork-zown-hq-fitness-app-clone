// The Log Out row on the Profile page. It used to only open the login screen, without signing anyone out: the sign-in this phone kept
// stayed, so closing the app and opening it again went straight back to Home. Now it signs out first, then opens the login screen.
// The real authService and user store are used, with a phone's storage held in memory.
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

const mockStorage = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k) => (k in mockStorage ? mockStorage[k] : null)),
    setItem: jest.fn(async (k, v) => { mockStorage[k] = String(v); }),
    removeItem: jest.fn(async (k) => { delete mockStorage[k]; }),
    getAllKeys: jest.fn(async () => Object.keys(mockStorage)),
    multiRemove: jest.fn(async (keys) => { keys.forEach((k) => { delete mockStorage[k]; }); }),
  },
}));
jest.mock('../src/config/firebase', () => ({
  __esModule: true,
  auth: { currentUser: { uid: 'u1' } },
  db: {},
  storage: {},
  functions: {},
  isFirebaseConfigured: true,
  default: {},
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }), { virtual: true });
jest.mock('expo-image-picker', () => ({}), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/src/components/LoadingSkeleton', () => ({ __esModule: true, default: () => null }));
jest.mock('@/store/expStore', () => ({
  useExpStore: () => ({
    loadXP: () => {}, getLevel: () => 1, getExpForLevel: (l) => l * 1000, getExpToNextLevel: () => 1000, getTotalExp: () => 0,
  }),
}));
jest.mock('@/store/achievementStore', () => ({
  useAchievementStore: () => ({
    achievements: [], getUnlockedAchievements: () => [], getLockedAchievements: () => [], loadAchievements: () => {},
  }),
}));
jest.mock('@/store/workoutStore', () => {
  const { create } = require('zustand');
  return { useWorkoutStore: create(() => ({ completedWorkouts: [], loadWorkouts: () => {} })) };
});
jest.mock('@/store/runningStore', () => {
  const { create } = require('zustand');
  return { useRunningStore: create(() => ({ runs: [] })) };
});
jest.mock('@/store/hikingStore', () => {
  const { create } = require('zustand');
  return { useHikingStore: create(() => ({ completedHikes: [] })) };
});

import { router as mockRouter } from 'expo-router';
import { auth as mockAuth } from '../src/config/firebase';
import ProfileScreen from '../app/profile';
import { useUserStore } from '@/store/userStore';
import { authService } from '@/services/authService';
import { signOut } from 'firebase/auth';

let alertSpy;
const confirmButton = () => alertSpy.mock.calls[alertSpy.mock.calls.length - 1][2].find((b) => b.text === 'Log Out');
const cancelButton = () => alertSpy.mock.calls[alertSpy.mock.calls.length - 1][2].find((b) => b.text === 'Cancel');

const pressLogOutRow = (utils) => {
  fireEvent.press(utils.getByText('Log Out'));
};

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  jest.clearAllMocks();
  signOut.mockResolvedValue(undefined);
  mockStorage.auth_token = 'id-token';
  mockStorage.auth_token_issued_at = '2026-10-28T10:00:00.000Z';
  useUserStore.setState({ user: { uid: 'u1', name: 'Cj' }, isOnboarded: true });
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => { alertSpy.mockRestore(); });

describe('Log Out on the Profile page', () => {
  it('asks first, and nothing changes until it is confirmed', async () => {
    const utils = render(<ProfileScreen />);
    await act(async () => {});
    pressLogOutRow(utils);
    expect(alertSpy).toHaveBeenCalledWith('Log Out', 'Are you sure you want to log out?', expect.any(Array));
    expect(mockStorage.auth_token).toBe('id-token');
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('Cancel leaves the person signed in', async () => {
    const utils = render(<ProfileScreen />);
    await act(async () => {});
    pressLogOutRow(utils);
    expect(cancelButton().onPress).toBeUndefined();
    expect(mockStorage.auth_token).toBe('id-token');
    expect(await authService.isAuthenticated()).toBe(true);
  });

  it('signs out of Firebase and removes the saved sign-in, so reopening the app does not go to Home', async () => {
    const utils = render(<ProfileScreen />);
    await act(async () => {});
    pressLogOutRow(utils);
    await act(async () => { await confirmButton().onPress(); });
    expect(signOut).toHaveBeenCalledWith(mockAuth);
    expect(mockStorage.auth_token).toBeUndefined();
    expect(mockStorage.auth_token_issued_at).toBeUndefined();
    expect(await authService.isAuthenticated()).toBe(false);
  });

  it('forgets the saved profile and the set-up flag', async () => {
    const utils = render(<ProfileScreen />);
    await act(async () => {});
    pressLogOutRow(utils);
    await act(async () => { await confirmButton().onPress(); });
    expect(useUserStore.getState().user).toBeNull();
    expect(useUserStore.getState().isOnboarded).toBe(false);
  });

  it('opens the login screen, and only after the saved sign-in is gone', async () => {
    let tokenWhenScreenChanged = 'not called';
    let signedOutWhenScreenChanged = false;
    mockRouter.replace.mockImplementation(() => {
      tokenWhenScreenChanged = mockStorage.auth_token;
      signedOutWhenScreenChanged = signOut.mock.calls.length > 0;
    });
    const utils = render(<ProfileScreen />);
    await act(async () => {});
    pressLogOutRow(utils);
    await act(async () => { await confirmButton().onPress(); });
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/auth/login');
    expect(tokenWhenScreenChanged).toBeUndefined();
    expect(signedOutWhenScreenChanged).toBe(true);
  });

  it('opens the login screen even if the log out step itself fails to finish', async () => {
    const logOutModule = require('../lib/logOut');
    const spy = jest.spyOn(logOutModule, 'logOut').mockRejectedValue(new Error('unexpected'));
    try {
      const utils = render(<ProfileScreen />);
      await act(async () => {});
      pressLogOutRow(utils);
      await act(async () => { await confirmButton().onPress(); });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(mockRouter.replace).toHaveBeenCalledWith('/auth/login');
    } finally {
      spy.mockRestore();
    }
  });

  it('still opens the login screen if signing out fails', async () => {
    signOut.mockRejectedValue(new Error('offline'));
    const utils = render(<ProfileScreen />);
    await act(async () => {});
    pressLogOutRow(utils);
    await act(async () => { await confirmButton().onPress(); });
    expect(mockRouter.replace).toHaveBeenCalledWith('/auth/login');
    expect(mockStorage.auth_token).toBeUndefined();
  });
});
