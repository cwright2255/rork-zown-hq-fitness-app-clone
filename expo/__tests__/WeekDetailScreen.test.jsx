import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useLocalSearchParams: () => global.__params,
}), { virtual: true });
jest.mock('@/components/ScreenHeader', () => ({ __esModule: true, default: () => null }));
jest.mock('@/store/runningStore', () => ({
  useRunningStore: () => ({ programProgress: global.__progress }),
}));

import WeekDetailScreen from '../app/running/week/[id]';

// A session that is not done shows its number in the circle; a done one shows a tick.
const open = (id, progress) => {
  global.__params = { id };
  global.__progress = progress;
  return render(<WeekDetailScreen />);
};
const numbers = (utils) => ['1', '2', '3'].filter((n) => utils.queryByText(n) !== null);

describe('WeekDetailScreen ticks', () => {
  it('shows nothing done before the program is started', () => {
    expect(numbers(open('c25k-w1', {}))).toEqual(['1', '2', '3']);
  });

  it('ticks the sessions done in the current week', () => {
    const utils = open('c25k-w2', { c25k: { currentWeek: 2, completedSessionIndexes: [0] } });
    expect(numbers(utils)).toEqual(['2', '3']);
  });

  it('keeps week 1 fully ticked once the program has moved on to week 2', () => {
    const utils = open('c25k-w1', { c25k: { currentWeek: 2, completedSessionIndexes: [] } });
    expect(numbers(utils)).toEqual([]);
  });

  it('keeps every earlier week ticked later on, and shows the current and later weeks as they are', () => {
    const progress = { c25k: { currentWeek: 4, completedSessionIndexes: [0, 1] } };
    expect(numbers(open('c25k-w1', progress))).toEqual([]);
    expect(numbers(open('c25k-w3', progress))).toEqual([]);
    expect(numbers(open('c25k-w4', progress))).toEqual(['3']);
    expect(numbers(open('c25k-w5', progress))).toEqual(['1', '2', '3']);
  });

  it('ignores progress that belongs to another program', () => {
    const utils = open('c25k-w1', { other: { currentWeek: 5, completedSessionIndexes: [] } });
    expect(numbers(utils)).toEqual(['1', '2', '3']);
  });
});
