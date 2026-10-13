import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((db, ...path) => ({ path: path.join('/') })),
  getDoc: jest.fn(async () => ({ exists: () => false })),
  setDoc: jest.fn(async () => undefined),
}));
jest.mock('../services/journeyRewards', () => ({ rewardJourney: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-router', () => {
  const mockRouter = { push: (...args) => global.__router.push(...args) };
  return { router: mockRouter, useRouter: () => mockRouter };
}, { virtual: true });
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: global.__user }) }));

import JourneyCard from '../components/JourneyCard';
import { useVirtualChallengeStore } from '../store/virtualChallengeStore';
import { useSettingsStore } from '../store/settingsStore';
import { journeyById } from '../lib/virtualJourneys';

const canyon = journeyById('grand-canyon-rim'); // 34 km
const textOf = (node) => [].concat(node.props.children).join('');
const card = () => render(<JourneyCard journey={canyon} />);
const set = (byUser) => useVirtualChallengeStore.setState({ byUser, loadedFor: 'u1' });
const record = (distanceKm, completedAt = null) => ({ startedAt: '2026-10-01T00:00:00Z', distanceKm, completedAt });

beforeEach(() => {
  global.__router = { push: jest.fn() };
  global.__user = { uid: 'u1' };
  useSettingsStore.setState({ units: 'metric' });
  useVirtualChallengeStore.setState({ byUser: {}, loadedFor: null });
});

describe('JourneyCard', () => {
  it('names the route and gives its length, in the person\'s units', async () => {
    const utils = card();
    expect(utils.getByText('Grand Canyon Rim Trail')).toBeTruthy();
    expect(utils.getByText('34 km · 4 milestones')).toBeTruthy();
    await act(async () => { useSettingsStore.setState({ units: 'imperial' }); });
    expect(utils.getByText('21.1 mi · 4 milestones')).toBeTruthy();
  });

  it('opens the journey when tapped', () => {
    fireEvent.press(card().getByTestId('journey-card-grand-canyon-rim'));
    expect(global.__router.push).toHaveBeenCalledWith('/running/journeys/grand-canyon-rim');
  });

  describe('before joining', () => {
    it('has no label and no bar, a map icon, and says only the route and length to a screen reader', () => {
      const utils = card();
      expect(utils.queryByTestId('journey-card-grand-canyon-rim-label')).toBeNull();
      expect(utils.queryByTestId('journey-card-grand-canyon-rim-fill')).toBeNull();
      expect(utils.UNSAFE_getByType('Ionicons').props.name).toBe('map-outline');
      expect(utils.getByTestId('journey-card-grand-canyon-rim').props.accessibilityLabel).toBe('Grand Canyon Rim Trail. 34 km · 4 milestones.');
    });
  });

  describe('once joined', () => {
    it('shows how far along, as a label and a bar, with a map icon', () => {
      set({ u1: { 'grand-canyon-rim': record(17) } });
      const utils = card();
      expect(textOf(utils.getByTestId('journey-card-grand-canyon-rim-label'))).toBe('50%');
      expect(StyleSheet.flatten(utils.getByTestId('journey-card-grand-canyon-rim-fill').props.style).width).toBe('50%');
      expect(utils.UNSAFE_getByType('Ionicons').props.name).toBe('map-outline');
      expect(utils.getByTestId('journey-card-grand-canyon-rim').props.accessibilityLabel).toBe('Grand Canyon Rim Trail. 34 km · 4 milestones. 50%');
    });

    it('has an empty bar and 0% right after joining', () => {
      set({ u1: { 'grand-canyon-rim': record(0) } });
      const utils = card();
      expect(textOf(utils.getByTestId('journey-card-grand-canyon-rim-label'))).toBe('0%');
      expect(StyleSheet.flatten(utils.getByTestId('journey-card-grand-canyon-rim-fill').props.style).width).toBe('0%');
    });

    it('follows the journey as runs are added', () => {
      set({ u1: { 'grand-canyon-rim': record(0) } });
      const utils = card();
      act(() => { useVirtualChallengeStore.getState().creditDistance(8.5, 'u1'); });
      expect(textOf(utils.getByTestId('journey-card-grand-canyon-rim-label'))).toBe('25%');
    });
  });

  describe('once finished', () => {
    it('says Completed, with a full bar and a tick', () => {
      set({ u1: { 'grand-canyon-rim': record(34, '2026-10-09T00:00:00Z') } });
      const utils = card();
      expect(textOf(utils.getByTestId('journey-card-grand-canyon-rim-label'))).toBe('Completed');
      expect(StyleSheet.flatten(utils.getByTestId('journey-card-grand-canyon-rim-fill').props.style).width).toBe('100%');
      expect(utils.UNSAFE_getByType('Ionicons').props.name).toBe('checkmark-circle-outline');
      expect(utils.getByTestId('journey-card-grand-canyon-rim').props.accessibilityLabel).toBe('Grand Canyon Rim Trail. 34 km · 4 milestones. Completed');
    });
  });

  describe('whose progress it is', () => {
    it('shows only the signed-in person\'s own', () => {
      set({ u2: { 'grand-canyon-rim': record(17) } });
      expect(card().queryByTestId('journey-card-grand-canyon-rim-label')).toBeNull();
    });

    it('shows no progress to nobody, whoever else has some', () => {
      global.__user = null;
      set({ u1: { 'grand-canyon-rim': record(17) } });
      expect(card().queryByTestId('journey-card-grand-canyon-rim-label')).toBeNull();
    });

    it('takes the width it is given', () => {
      const utils = render(<JourneyCard journey={canyon} width={171} />);
      expect(StyleSheet.flatten(utils.getByTestId('journey-card-grand-canyon-rim').props.style).width).toBe(171);
    });
  });
});
