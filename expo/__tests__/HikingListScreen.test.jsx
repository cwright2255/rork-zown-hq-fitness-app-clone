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
    default: ({ title, rightAction }) => mockReact.createElement(
      mockRn.View,
      null,
      mockReact.createElement(mockRn.Text, null, title),
      rightAction,
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
jest.mock('@/store/hikingStore', () => ({ useHikingStore: () => global.__hiking }));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1' } }) }));
jest.mock('@/services/hikingService', () => ({ getPhotoUrl: jest.fn(() => null) }));

import HikingListScreen from '../app/running/hiking/index';

const open = (hiking = {}) => {
  global.__router = { push: jest.fn(), back: jest.fn() };
  global.__hiking = {
    trails: [], isLoading: false, error: null, savedTrailIds: [],
    loadNearbyTrails: jest.fn(), loadSavedTrails: jest.fn(),
    ...hiking,
  };
  return render(<HikingListScreen />);
};

describe('HikingListScreen header', () => {
  it('has a button that opens the hike history', () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('hiking-history-button'));
    expect(global.__router.push).toHaveBeenCalledWith('/running/hiking/history');
  });

  it('keeps the saved-trails button, beside the history one', () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('hiking-saved-button'));
    expect(global.__router.push).toHaveBeenCalledWith('/running/hiking/saved');
    expect(utils.UNSAFE_getAllByType('Ionicons').map((i) => i.props.name)).toEqual(
      expect.arrayContaining(['time-outline', 'bookmark-outline']),
    );
  });

  it('offers the history even when no trails were found or location is off', () => {
    expect(open({ trails: [] }).getByTestId('hiking-history-button')).toBeTruthy();
    expect(open({ error: 'location_permission_denied' }).getByTestId('hiking-history-button')).toBeTruthy();
    expect(open({ isLoading: true }).getByTestId('hiking-history-button')).toBeTruthy();
  });

  it('still looks for trails and opens one when it is tapped', () => {
    const utils = open({
      trails: [{ id: 'osm-5', name: 'Bear Rock', address: 'Here', distanceKm: 3 }],
    });
    expect(global.__hiking.loadNearbyTrails).toHaveBeenCalled();
    fireEvent.press(utils.getByText('Bear Rock'));
    expect(global.__router.push).toHaveBeenCalledWith('/running/hiking/osm-5');
  });
});

describe('HikingListScreen when the nearby trails cannot be loaded', () => {
  it('offers the saved trails, which are kept on the phone', () => {
    const utils = open({ error: 'Network request failed', savedTrailIds: ['trailapi-1'] });
    expect(utils.getByText("Couldn't load nearby trails.")).toBeTruthy();
    fireEvent.press(utils.getByText('Open saved trails'));
    expect(global.__router.push).toHaveBeenCalledWith('/running/hiking/saved');
  });

  it('still lets the person try again', () => {
    const utils = open({ error: 'Network request failed', savedTrailIds: ['trailapi-1'] });
    global.__hiking.loadNearbyTrails.mockClear();
    fireEvent.press(utils.getByText('Try Again'));
    expect(global.__hiking.loadNearbyTrails).toHaveBeenCalledTimes(1);
  });

  it('does not offer saved trails when none are saved', () => {
    const utils = open({ error: 'Network request failed', savedTrailIds: [] });
    expect(utils.queryByText('Open saved trails')).toBeNull();
  });

  it('does not offer them while the trails are loading, or when they loaded', () => {
    expect(open({ isLoading: true, savedTrailIds: ['trailapi-1'] }).queryByText('Open saved trails')).toBeNull();
    expect(open({ trails: [{ id: 'osm-5', name: 'Bear Rock', address: 'Here' }], savedTrailIds: ['trailapi-1'] }).queryByText('Open saved trails')).toBeNull();
  });
});
