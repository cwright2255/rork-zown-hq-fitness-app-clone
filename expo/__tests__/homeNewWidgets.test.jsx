// The Home screen shows the newer widgets (Workout Streak, Next Up) with the others, and the layout switches them on and off.
// jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('../services/rookService', () => ({ rookService: {} }));
jest.mock('../services/appleHealthService', () => ({ appleHealthService: {} }));
jest.mock('expo-location', () => ({}), { virtual: true }); // the hiking store imports it; no GPS is used here
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Circle: 'Circle' }), { virtual: true });
jest.mock('react-native-chart-kit', () => ({ LineChart: 'LineChart', BarChart: 'BarChart' }), { virtual: true });
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => 'Icon' }), { virtual: true });
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: jest.fn() }),
  router: { push: jest.fn() },
}), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/src/components/LoadingSkeleton', () => () => null);
jest.mock('@/components/StrengthScoreWidget', () => () => null);
jest.mock('@/components/FastingWidget', () => () => null);
jest.mock('@/components/MusicWidget', () => () => null);
jest.mock('@/components/WidgetEditorModal', () => () => null);

import { router } from 'expo-router';
import Hq from '../app/hq';
import { useUserStore } from '../store/userStore';
import { useWorkoutStore } from '../store/workoutStore';
import { useScheduleStore } from '../store/scheduleStore';
import { useHomeWidgetsStore } from '../store/homeWidgetsStore';
import { getDefaultWidgetLayout } from '../lib/homeWidgets';

const EVENING = new Date('2026-10-15T01:30:00Z'); // 9:30 PM on Wed 14 Oct in New Jersey
const local = (y, m, d, h = 7, mi = 0) => new Date(y, m - 1, d, h, mi).toISOString();
const NEXT = {
  id: 'e1', title: 'Leg day', kind: 'workout', start: local(2026, 10, 15, 7, 0), notes: '', workoutId: null, repeat: null,
  remindMinutes: null, doneDates: [], skipDates: [], source: 'user', inviteId: null, host: null, updatedAt: '2026-10-01T00:00:00.000Z',
};

// The user store finishes loading on a timer once it is imported; let that happen before the clock is moved.
beforeAll(() => new Promise((resolve) => setTimeout(resolve, 20)));
afterEach(() => { jest.useRealTimers(); });

const openHome = async ({ layout = getDefaultWidgetLayout() } = {}) => {
  useUserStore.setState({ user: { uid: 'u1', name: 'Cj' } });
  useWorkoutStore.setState({ completedWorkouts: [{ id: 'w1', completedAt: local(2026, 10, 14, 12, 0) }] });
  useScheduleStore.setState({ events: [NEXT] });
  useHomeWidgetsStore.setState({ layout });
  router.push.mockClear();
  jest.useFakeTimers({ now: EVENING, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  const utils = render(<Hq />);
  await act(async () => {});
  return utils;
};

describe('home screen: newer widgets', () => {
  it('shows Workout Streak and Next Up with the others on the default layout', async () => {
    const utils = await openHome();
    expect(utils.getByText('Workout Streak')).toBeTruthy();
    expect(utils.getByText('Next Up')).toBeTruthy();
    expect(utils.getByText('Calories')).toBeTruthy(); // the older cards are still there
    expect(utils.getByTestId('home-nextup-title').props.children).toBe('Leg day');
    expect(utils.getByText('Tomorrow \u00B7 7:00 AM')).toBeTruthy();
    expect(utils.getByText('day in a row')).toBeTruthy(); // the 14th had a workout, and the 14th is today here
  });

  it('opens the Streak Calendar from the Workout Streak card', async () => {
    const utils = await openHome();
    fireEvent.press(utils.getByTestId('home-widget-streak'));
    expect(router.push).toHaveBeenCalledWith('/profile/streak');
  });

  it('opens the Calendar from the Next Up card', async () => {
    const utils = await openHome();
    fireEvent.press(utils.getByTestId('home-widget-nextup'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/calendar', params: { date: '2026-10-15' } });
  });

  it('shows them to someone who saved a layout before they existed, switched on, after the ones they had', async () => {
    const saved = getDefaultWidgetLayout().filter((w) => w.id !== 'streak' && w.id !== 'nextUp');
    const utils = await openHome({ layout: saved });
    expect(utils.getByText('Workout Streak')).toBeTruthy();
    expect(utils.getByText('Next Up')).toBeTruthy();
  });

  it('hides one that is switched off, and only that one', async () => {
    const layout = getDefaultWidgetLayout().map((w) => (w.id === 'streak' ? { ...w, enabled: false } : w));
    const utils = await openHome({ layout });
    expect(utils.queryByText('Workout Streak')).toBeNull();
    expect(utils.getByText('Next Up')).toBeTruthy();
    const both = getDefaultWidgetLayout().map((w) => (w.id === 'streak' || w.id === 'nextUp' ? { ...w, enabled: false } : w));
    await act(async () => { useHomeWidgetsStore.setState({ layout: both }); });
    expect(utils.queryByText('Next Up')).toBeNull();
  });
});
