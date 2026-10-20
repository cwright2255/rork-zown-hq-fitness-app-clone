// The home screen's Calories card is about calories BURNED (its goal is a burn goal). Beside it the screen shows
// what was EATEN today and the eat goal, read from the food diary on the person's own calendar day.
import React from 'react';
import { RefreshControl } from 'react-native';
import { act, render, fireEvent } from '@testing-library/react-native';

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

import Hq from '../app/hq';
import { useNutritionStore } from '../store/nutritionStore';
import { useUserStore } from '../store/userStore';
import { useHikingStore } from '../store/hikingStore';

const EVENING = new Date('2026-10-15T01:30:00Z'); // 9:30 PM on Wed 14 Oct in New Jersey, already the 15th in UTC

// The user store finishes loading on a timer once it is imported; let that happen before the clock is moved.
beforeAll(() => new Promise((resolve) => setTimeout(resolve, 20)));
afterEach(() => { jest.useRealTimers(); });

const openCaloriesCard = async (user, nutrition) => {
  useUserStore.setState({ user: { uid: 'u1', name: 'Cj', ...user } });
  useNutritionStore.setState({
    meals: [],
    dailyGoals: { calories: 2000, protein: 150, carbs: 200, fat: 65, water: 2000 },
    dailyGoalsUpdatedAt: null,
    ...nutrition,
  });
  jest.useFakeTimers({ now: EVENING, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  const utils = render(<Hq />);
  await act(async () => {});
  fireEvent.press(utils.getByText('Calories'));
  await act(async () => {});
  return utils;
};

const realLoadCompletedHikes = useHikingStore.getState().loadCompletedHikes;
afterEach(() => { useHikingStore.setState({ completedHikes: [], loadCompletedHikes: realLoadCompletedHikes }); });

describe('home screen: Calories card', () => {
  it('shows what was eaten today next to the eat goal, counting a 9 PM meal as today\'s', async () => {
    const utils = await openCaloriesCard(
      { dailyCalorieGoal: 500 },
      {
        meals: [
          { id: 'dinner', date: '2026-10-14', foods: [{ calories: 700 }, { calories: 150 }] },
          { id: 'dinner', date: '2026-10-13', foods: [{ calories: 999 }] },
        ],
        dailyGoals: { calories: 2400, protein: 150, carbs: 200, fat: 65, water: 2000 },
        dailyGoalsUpdatedAt: '2026-10-14T12:00:00.000Z',
      },
    );
    expect(utils.getByText('Eaten today')).toBeTruthy();
    expect(utils.getByText('850 of 2,400 kcal')).toBeTruthy();
    expect(utils.getByText('Burn goal')).toBeTruthy();
    expect(utils.getByText('Calories burned today')).toBeTruthy();
  });

  it('shows only what was eaten when no eat goal exists yet, never the 2000 placeholder', async () => {
    const utils = await openCaloriesCard({ dailyCalorieGoal: 500 }, { meals: [{ id: 'lunch', date: '2026-10-14', foods: [{ calories: 640 }] }] });
    expect(utils.getByText('640 kcal')).toBeTruthy();
    expect(utils.queryByText(/of 2,000/)).toBeNull();
  });

  it('asks for a burn goal, not just "a calorie goal", when none is set', async () => {
    const utils = await openCaloriesCard({}, {});
    expect(utils.getByText('Set a daily burn goal')).toBeTruthy();
    expect(utils.getByText('0 kcal')).toBeTruthy();
  });
});

describe('home screen: Calories card with a hike', () => {
  const HIKE = { id: 'hike-1', startTime: '2026-10-14T15:00:00.000Z', completedAt: '2026-10-14T17:00:00.000Z', calories: 777, durationSeconds: 7200, distanceKm: 8 };

  // The Texts that share a View with a label, in order.
  const textsBeside = (utils, label) => {
    let cell = utils.getByText(label).parent;
    while (cell && cell.type !== 'View') cell = cell.parent;
    return cell.findAll((n) => n.type === 'Text').map((n) => n.props.children);
  };
  // The big number sits just above the "Calories burned today" label.
  const burnedToday = (utils) => {
    const texts = textsBeside(utils, 'Calories burned today');
    return texts[texts.indexOf('Calories burned today') - 1];
  };
  // The value on the same row as a label, e.g. "Total sessions".
  const rowValue = (utils, label) => {
    const texts = textsBeside(utils, label);
    return texts[texts.indexOf(label) + 1];
  };

  it('counts the hike in the calories burned today, the sessions and the breakdown', async () => {
    useHikingStore.setState({ completedHikes: [HIKE] });
    const utils = await openCaloriesCard({ dailyCalorieGoal: 500 }, {});
    expect(burnedToday(utils)).toBe(777);
    expect(rowValue(utils, 'Total sessions')).toBe(1);
    expect(utils.getByText('Hiking')).toBeTruthy();
    expect(utils.getAllByText('777 cal').length).toBeGreaterThan(0); // the breakdown row (and the trends page)
  });

  it('meets the burn goal for the day with a hike alone', async () => {
    useHikingStore.setState({ completedHikes: [HIKE] });
    const utils = await openCaloriesCard({ dailyCalorieGoal: 500 }, {});
    expect(utils.getByText('500 cal (100%)')).toBeTruthy();
    expect(utils.getByText('1 day')).toBeTruthy(); // the streak
  });

  it('adds a hike to the card when it arrives while the screen is open', async () => {
    const utils = await openCaloriesCard({ dailyCalorieGoal: 500 }, {});
    expect(burnedToday(utils)).toBe(0);
    await act(async () => { useHikingStore.setState({ completedHikes: [HIKE] }); });
    expect(burnedToday(utils)).toBe(777);
  });

  it('does not count a hike from another day as today\'s', async () => {
    useHikingStore.setState({ completedHikes: [{ ...HIKE, startTime: '2026-10-10T15:00:00.000Z', completedAt: '2026-10-10T17:00:00.000Z' }] });
    const utils = await openCaloriesCard({ dailyCalorieGoal: 500 }, {});
    expect(burnedToday(utils)).toBe(0);
    expect(rowValue(utils, 'Total sessions')).toBe(1); // it is still one of the sessions on record
  });

  it('pulling down to refresh also loads the hikes again', async () => {
    const loadCompletedHikes = jest.fn(async () => {});
    useHikingStore.setState({ loadCompletedHikes });
    const utils = await openCaloriesCard({ dailyCalorieGoal: 500 }, {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => { await utils.UNSAFE_getByType(RefreshControl).props.onRefresh(); });
    expect(loadCompletedHikes).toHaveBeenCalledWith('u1');
    console.error.mockRestore();
  });
});
