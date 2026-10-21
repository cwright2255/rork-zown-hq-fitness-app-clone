// The daily Today brief on the Home screen: the card sits under the greeting and above "Today's Information", once, and is not one of the
// widgets that can be switched on and off. What the card shows is tested in TodayBriefCard.test.jsx.
import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';

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
jest.mock('@/components/StreakWidget', () => () => null);
jest.mock('@/components/NextUpWidget', () => () => null);
jest.mock('@/components/BattlePassWidget', () => () => null);
jest.mock('@/components/TrainingLoadWidget', () => () => null);
jest.mock('@/components/MusclesWidget', () => () => null);
jest.mock('@/components/WorkoutHistoryWidget', () => () => null);
jest.mock('@/components/RunningLogWidget', () => () => null);
jest.mock('@/components/RankChallengeWidget', () => () => null);
jest.mock('@/components/MacrosWidget', () => () => null);
jest.mock('@/components/WeightWidget', () => () => null);
jest.mock('@/components/WidgetEditorModal', () => () => null);
jest.mock('@/components/TodayBriefCard', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return () => mockReact.createElement(mockRn.Text, { testID: 'brief-card' }, 'THE BRIEF CARD');
});

import Hq from '../app/hq';
import { useUserStore } from '../store/userStore';
import { WIDGET_REGISTRY } from '../lib/homeWidgets';

// The user store finishes loading on a timer once it is imported; let that happen before the clock is moved.
beforeAll(() => new Promise((resolve) => setTimeout(resolve, 20)));
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

const open = async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  useUserStore.setState({ user: { uid: 'u1', name: 'Cj' } });
  jest.useFakeTimers({ now: new Date('2026-10-14T16:00:00Z'), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  const utils = render(<Hq />);
  await act(async () => {});
  return utils;
};
const lines = (utils) => utils.UNSAFE_getAllByType(Text).map((n) => [].concat(n.props.children).join(''));

describe('home screen: Today brief', () => {
  it('shows the brief card once, under the greeting and above "Today\'s Information"', async () => {
    const order = lines(await open());
    expect(order.filter((l) => l === 'THE BRIEF CARD')).toHaveLength(1);
    const brief = order.indexOf('THE BRIEF CARD');
    expect(order.indexOf('Hello Cj!')).toBeGreaterThanOrEqual(0);
    expect(brief).toBeGreaterThan(order.indexOf('Hello Cj!'));
    expect(brief).toBeLessThan(order.indexOf("Today's Information"));
  });

  it('is not one of the widgets that can be switched on and off, so it cannot be lost from the layout', () => {
    expect(WIDGET_REGISTRY.map((w) => w.id).join(' ')).not.toMatch(/brief/i);
  });
});
