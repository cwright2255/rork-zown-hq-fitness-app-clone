import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-router', () => ({ useRouter: () => global.__router }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/components/ScreenHeader', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: ({ title, onBack }) => mockReact.createElement(
      mockRn.Pressable,
      { onPress: onBack, testID: 'header-back' },
      mockReact.createElement(mockRn.Text, null, title),
    ),
  };
});
jest.mock('@/components/PrimaryButton', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: ({ title, onPress }) => mockReact.createElement(
      mockRn.TouchableOpacity,
      { onPress, accessibilityRole: 'button' },
      mockReact.createElement(mockRn.Text, null, title),
    ),
  };
});
jest.mock('@/components/RunRouteMap', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: (props) => {
      global.__thumbs.push(props);
      return mockReact.createElement(mockRn.View, { testID: 'route-thumb' });
    },
  };
});
jest.mock('@/store/hikingStore', () => ({
  useHikingStore: (select) => select(global.__hiking),
}));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: global.__user }) }));

import HikeHistoryScreen from '../app/running/hiking/history';

const hike = (n, extra = {}) => ({
  id: `hike-${n}`,
  completedAt: new Date(2026, 9, n, 11, 0, 0).toISOString(),
  startTime: new Date(2026, 9, n, 7, 5, 0).toISOString(),
  trailName: `Trail ${n}`,
  distanceKm: 5 + n,
  durationSeconds: 3600 * n,
  elevationGainM: 100 * n,
  elevationLossM: 90 * n,
  difficultyTier: 'Moderate',
  track: [40, -74, 40.01, -74, 40.02, -74],
  ...extra,
});

const open = (hikes, { user = { uid: 'u1' } } = {}) => {
  global.__router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
  global.__user = user;
  global.__thumbs = [];
  global.__hiking = { completedHikes: hikes, loadCompletedHikes: jest.fn(async () => undefined) };
  return render(<HikeHistoryScreen />);
};

describe('HikeHistoryScreen', () => {
  it('lists the hikes newest first, with name, date and the headline numbers', () => {
    const utils = open([hike(1), hike(3), hike(2)]);
    const cards = utils.getAllByTestId(/^hike-card-hike-/);
    expect(cards.map((c) => c.props.testID)).toEqual(['hike-card-hike-3', 'hike-card-hike-2', 'hike-card-hike-1']);
    expect(utils.getByTestId('hike-card-title-hike-3').props.children).toBe('Trail 3');
    expect(utils.getByText('Sat, Oct 3 • 7:05 AM')).toBeTruthy();
    expect(utils.getByTestId('hike-card-distance-hike-3').props.children).toEqual(['8.00', expect.anything()]);
  });

  it('shows the totals across all the hikes at the top', () => {
    const utils = open([hike(1), hike(2), hike(3)]);
    expect(utils.getByTestId('hike-total-count').props.children).toEqual(['3', null]);
    expect(utils.getByTestId('hike-total-distance').props.children).toEqual(['21.0', expect.anything()]); // 6 + 7 + 8
    expect(utils.getByTestId('hike-total-time').props.children).toEqual(['6:00:00', null]);
    expect(utils.getByTestId('hike-total-climb').props.children).toEqual(['600', expect.anything()]);
  });

  it('says "Hike" for a single hike', () => {
    const utils = open([hike(1)]);
    expect(utils.getByText('Hike')).toBeTruthy();
    expect(utils.queryByText('Hikes')).toBeNull();
  });

  it('draws the route walked on each card that has one, as a flat sketch', () => {
    open([hike(1), hike(2, { track: [] })]);
    expect(global.__thumbs).toHaveLength(1);
    expect(global.__thumbs[0].sketch).toBe(true);
    expect(global.__thumbs[0].points).toHaveLength(3);
  });

  it('still lists an older hike that has no route, start time or descent', () => {
    const utils = open([{
      id: 'hike-old', completedAt: new Date(2026, 5, 1, 9, 0).toISOString(), trailName: 'Untitled hike',
      distanceKm: 3, durationSeconds: 3000, elevationGainM: 80, difficultyTier: 'Easy',
    }]);
    expect(utils.getByTestId('hike-card-title-hike-old').props.children).toBe('Morning Hike');
    expect(global.__thumbs).toHaveLength(0);
  });

  it('opens a hike when its card is tapped', () => {
    const utils = open([hike(1), hike(2)]);
    fireEvent.press(utils.getByTestId('hike-card-hike-2'));
    expect(global.__router.push).toHaveBeenCalledWith('/running/hiking/log/hike-2');
  });

  it('loads the saved hikes for the signed-in person', () => {
    open([hike(1)]);
    expect(global.__hiking.loadCompletedHikes).toHaveBeenCalledWith('u1');
  });

  it('does not try to load when nobody is signed in', () => {
    open([hike(1)], { user: null });
    expect(global.__hiking.loadCompletedHikes).not.toHaveBeenCalled();
  });

  it('shows an empty state with a way to find a trail, and no totals', () => {
    const utils = open([]);
    expect(utils.getByTestId('hike-history-empty')).toBeTruthy();
    expect(utils.getByText('No hikes yet')).toBeTruthy();
    expect(utils.queryByTestId('hike-history-summary')).toBeNull();
    fireEvent.press(utils.getByText('Find a trail'));
    expect(global.__router.replace).toHaveBeenCalledWith('/running/hiking');
  });

  it('goes back, or to the trail list when there is nowhere to go back to', () => {
    let utils = open([hike(1)]);
    fireEvent.press(utils.getByTestId('header-back'));
    expect(global.__router.back).toHaveBeenCalledTimes(1);
    utils.unmount();
    utils = open([hike(1)]);
    global.__router.canGoBack.mockReturnValue(false);
    fireEvent.press(utils.getByTestId('header-back'));
    expect(global.__router.replace).toHaveBeenCalledWith('/running/hiking');
  });
});
