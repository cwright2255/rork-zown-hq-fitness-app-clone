import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-router', () => ({ useRouter: () => global.__router }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/components/ScreenHeader', () => ({ __esModule: true, default: () => null }));
jest.mock('@/store/hikingStore', () => ({ useHikingStore: () => global.__hiking }));
jest.mock('@/store/offlineTrailStore', () => ({ useOfflineTrailStore: () => global.__offline }));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: global.__user }) }));
jest.mock('@/services/hikingService', () => ({ getPhotoUrl: jest.fn((name) => `https://photo/${name}`) }));

import SavedTrailsScreen from '../app/running/hiking/saved';

const trail = (n, extra = {}) => ({
  id: `trailapi-${n}`, source: 'trailapi', name: `Trail ${n}`, address: `Town ${n}`, latitude: 38, longitude: -78, ...extra,
});
const kept = (n, routes = {}, extra = {}) => ({
  id: `trailapi-${n}`, savedAt: 1, pinned: true, trail: trail(n), maps: [], routes, ...extra,
});
const ROUTE = { coordinates: [{ latitude: 38, longitude: -78 }, { latitude: 38.1, longitude: -78 }], distanceKm: 11 };

const show = ({ trails = [], saved = [], offline = [], isLoading = false, user = { uid: 'u1' } } = {}) => {
  global.__router = { push: jest.fn() };
  global.__user = user;
  global.__hiking = { trails, savedTrailIds: saved, loadSavedTrails: jest.fn(), isLoading };
  global.__offline = { trails: Object.fromEntries(offline.map((r) => [r.id, r])), keepTrail: jest.fn(), removeTrail: jest.fn() };
  return render(<SavedTrailsScreen />);
};

describe('SavedTrailsScreen', () => {
  it('loads the list for the signed-in person', () => {
    show();
    expect(global.__hiking.loadSavedTrails).toHaveBeenCalledWith('u1');
  });

  it('does not load a list when nobody is signed in', () => {
    show({ user: null });
    expect(global.__hiking.loadSavedTrails).not.toHaveBeenCalled();
  });

  it('says how to start when nothing is saved', () => {
    const utils = show({ trails: [trail(1)] });
    expect(utils.getByText(/No saved trails yet/)).toBeTruthy();
  });

  it('lists the saved trails that are in the last search', () => {
    const utils = show({ trails: [trail(1), trail(2), trail(3)], saved: ['trailapi-3', 'trailapi-1'] });
    expect(utils.getByText('Trail 1')).toBeTruthy();
    expect(utils.getByText('Trail 3')).toBeTruthy();
    expect(utils.queryByText('Trail 2')).toBeNull();
    expect(utils.getByText('Town 1')).toBeTruthy();
  });

  it('lists them in the order they were saved', () => {
    const utils = show({ trails: [trail(1), trail(2), trail(3)], saved: ['trailapi-3', 'trailapi-1', 'trailapi-2'] });
    const names = utils.getAllByText(/^Trail \d$/).map((n) => n.props.children);
    expect(names).toEqual(['Trail 3', 'Trail 1', 'Trail 2']);
  });

  it('lists a saved trail from the copy on the phone when the last search does not have it', () => {
    const utils = show({ trails: [], saved: ['trailapi-5'], offline: [kept(5)] });
    expect(utils.getByText('Trail 5')).toBeTruthy();
    expect(utils.getByText('Town 5')).toBeTruthy();
    expect(utils.queryByText(/No saved trails yet/)).toBeNull();
  });

  it('prefers the trail from the last search to the copy on the phone', () => {
    const utils = show({
      trails: [trail(5, { name: 'Fresh name' })], saved: ['trailapi-5'], offline: [kept(5, {}, { trail: trail(5, { name: 'Old name' }) })],
    });
    expect(utils.getByText('Fresh name')).toBeTruthy();
    expect(utils.queryByText('Old name')).toBeNull();
  });

  it('leaves out a saved trail it knows nothing about', () => {
    const utils = show({ trails: [trail(1)], saved: ['trailapi-1', 'trailapi-404'] });
    expect(utils.getAllByText(/^Trail \d+$/)).toHaveLength(1);
  });

  it('leaves out a trail that is kept on the phone but not saved', () => {
    const utils = show({ saved: [], offline: [kept(5)] });
    expect(utils.queryByText('Trail 5')).toBeNull();
    expect(utils.getByText(/No saved trails yet/)).toBeTruthy();
  });

  it('marks the trails that work without a signal, not the ones with no line kept', () => {
    const utils = show({
      saved: ['trailapi-1', 'trailapi-2', 'trailapi-3'],
      trails: [trail(1), trail(2), trail(3)],
      offline: [kept(1, { 11: ROUTE }), kept(2, {})],
    });
    expect(utils.getByTestId('saved-offline-trailapi-1')).toBeTruthy();
    expect(utils.queryByTestId('saved-offline-trailapi-2')).toBeNull();
    expect(utils.queryByTestId('saved-offline-trailapi-3')).toBeNull();
    expect(utils.getByTestId('saved-offline-trailapi-1').props.accessibilityLabel).toBe('Works without a signal');
  });

  it('keeps the saved trails in view that were saved before trails were kept on the phone', () => {
    show({ trails: [trail(1), trail(2), trail(3)], saved: ['trailapi-1', 'trailapi-2'], offline: [kept(2)] });
    expect(global.__offline.keepTrail).toHaveBeenCalledTimes(1);
    expect(global.__offline.keepTrail).toHaveBeenCalledWith({ trail: trail(1), pinned: true });
  });

  it('keeps nothing for a saved trail that is not in view', () => {
    show({ trails: [], saved: ['trailapi-9'] });
    expect(global.__offline.keepTrail).not.toHaveBeenCalled();
  });

  it('opens a trail when it is pressed', () => {
    const utils = show({ trails: [trail(1)], saved: ['trailapi-1'] });
    fireEvent.press(utils.getByText('Trail 1'));
    expect(global.__router.push).toHaveBeenCalledWith('/running/hiking/trailapi-1');
  });

  it('shows a trail photo from the trail itself, or one worked out from its photo name', () => {
    const utils = show({
      trails: [trail(1, { photoUrl: 'https://img/1.jpg' }), trail(2, { photoName: 'places/2/photos/x' })],
      saved: ['trailapi-1', 'trailapi-2'],
    });
    const uris = utils.UNSAFE_getAllByType(require('react-native').Image).map((i) => i.props.source.uri);
    expect(uris).toEqual(['https://img/1.jpg', 'https://photo/places/2/photos/x']);
  });

  it('shows a spinner while the first search is still loading', () => {
    const utils = show({ isLoading: true });
    expect(utils.UNSAFE_getAllByType(require('react-native').ActivityIndicator)).toHaveLength(1);
    expect(utils.queryByText(/No saved trails yet/)).toBeNull();
  });

  it('shows the saved trails, not a spinner, while a search is loading', () => {
    const utils = show({ isLoading: true, trails: [trail(1)], saved: ['trailapi-1'] });
    expect(utils.getByText('Trail 1')).toBeTruthy();
    expect(utils.UNSAFE_queryAllByType(require('react-native').ActivityIndicator)).toHaveLength(0);
  });
});
