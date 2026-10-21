// The Battle Pass screen: a tier is claimed through the server, and says so when it cannot be; the achievements show what the server
// unlocked, with progress counted over every finished workout (the server's count), not just the newest 240 the phone holds.
// jest.global-setup.js pins the zone to America/New_York.
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });

jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1' } }) }));
jest.mock('@/store/expStore', () => ({
  useExpStore: () => ({
    getLevel: () => global.__level, getExpForLevel: (l) => l * 1000, getExpToNextLevel: () => 1000, getTotalExp: () => global.__level * 1000, loadXP: () => {},
  }),
}));
jest.mock('@/store/battlePassStore', () => ({
  useBattlePassStore: () => ({ claimedTiers: global.__claimed, claimTier: (...a) => global.__claim(...a), claiming: global.__claiming, loadBattlePass: () => {} }),
}));
jest.mock('@/store/workoutStore', () => ({ useWorkoutStore: () => ({ completedWorkouts: global.__held, loadWorkouts: () => {} }) }));
jest.mock('@/store/runningStore', () => ({ useRunningStore: () => ({ runs: [], loadRuns: () => {} }) }));
jest.mock('@/store/hikingStore', () => ({ useHikingStore: () => ({ completedHikes: [], loadCompletedHikes: () => {} }) }));
jest.mock('@/store/nutritionStore', () => ({
  useNutritionStore: () => ({ getMealsByDate: () => [], loadNutritionData: () => {}, meals: [] }),
}));
jest.mock('@/store/healthStore', () => ({ useHealthStore: () => ({ steps: 0, stepsDate: null, loadAllHealth: () => {} }) }));
jest.mock('@/store/achievementStore', () => ({
  useAchievementStore: () => ({
    achievements: global.__achievements,
    getUnlockedAchievements: () => global.__achievements.filter((a) => a.unlockedAt),
    getLockedAchievements: () => global.__achievements.filter((a) => !a.unlockedAt),
    loadAchievements: () => {},
  }),
}));

import BattlePassScreen from '../app/battlepass';
import { useLifetimeStore } from '../store/lifetimeStore';

const ach = (id, type, target, over = {}) => ({ id, name: id, icon: 'x', category: 'workout', xpReward: 10, condition: { type, target }, description: 'd', ...over });
const press = async (utils, text) => { await act(async () => { fireEvent.press(utils.getAllByText(text)[0]); }); };

let alert;
beforeEach(() => {
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  global.__level = 3;
  global.__claimed = [];
  global.__claiming = null;
  global.__held = [];
  global.__achievements = [];
  global.__claim = jest.fn(async () => 'claimed');
  useLifetimeStore.setState({ totals: null });
});
afterEach(() => alert.mockRestore());

describe('claiming a tier', () => {
  it('asks the store to claim the tier the person pressed CLAIM on, and says nothing when it is claimed', async () => {
    const utils = render(<BattlePassScreen />);
    await press(utils, 'CLAIM');
    expect(global.__claim).toHaveBeenCalledTimes(1);
    expect(global.__claim).toHaveBeenCalledWith(1);
    expect(alert).not.toHaveBeenCalled();
  });

  it('says so when the level has not reached the tier', async () => {
    global.__claim = jest.fn(async () => 'locked');
    const utils = render(<BattlePassScreen />);
    await press(utils, 'CLAIM');
    expect(alert).toHaveBeenCalledWith('Not Yet', 'Your level has not reached this tier yet.');
  });

  it('says so when the tier could not be claimed', async () => {
    global.__claim = jest.fn(async () => 'failed');
    const utils = render(<BattlePassScreen />);
    await press(utils, 'CLAIM');
    expect(alert).toHaveBeenCalledWith('Could Not Claim', 'The tier could not be claimed. Check your connection and try again.');
  });

  it('says nothing when the tier turns out to be claimed already, or a second tap waits for the first', async () => {
    for (const status of ['already', 'busy']) {
      global.__claim = jest.fn(async () => status);
      const utils = render(<BattlePassScreen />);
      // eslint-disable-next-line no-await-in-loop
      await press(utils, 'CLAIM');
      expect(alert).not.toHaveBeenCalled();
    }
  });

  it('shows the tiers the server says are claimed, and offers the next one to claim', () => {
    global.__claimed = [1];
    const utils = render(<BattlePassScreen />);
    expect(utils.getAllByText('CLAIMED')).toHaveLength(1);
    expect(utils.getAllByText('CLAIM')).toHaveLength(1);
  });

  it('offers no claim for a tier the level has not reached', () => {
    global.__level = 1;
    global.__claimed = [1];
    const utils = render(<BattlePassScreen />);
    expect(utils.queryByText('CLAIM')).toBeNull();
  });

  it('turns the button off while a claim is on its way to the server', () => {
    global.__claiming = 1;
    const utils = render(<BattlePassScreen />);
    const button = utils.getByText('CLAIM').parent;
    let node = button;
    while (node && node.props.disabled === undefined) node = node.parent;
    expect(node.props.disabled).toBe(true);
  });
});

describe('achievements', () => {
  it('count progress over every finished workout the server has counted, not just those the phone holds', () => {
    global.__achievements = [ach('workouts-1000', 'workout_count', 1000)];
    global.__held = Array.from({ length: 240 }, (_, i) => ({ id: `w${i}`, caloriesBurned: 100 }));
    useLifetimeStore.setState({ totals: { totalWorkouts: 520, finishedWorkouts: 480, totalSeconds: 1, totalCalories: 1, bestCalories: 100 } });
    expect(render(<BattlePassScreen />).getByText('480/1000')).toBeTruthy();
  });

  it('count progress over the workouts the phone holds before the server has counted', () => {
    global.__achievements = [ach('workouts-50', 'workout_count', 50)];
    global.__held = Array.from({ length: 7 }, (_, i) => ({ id: `w${i}`, caloriesBurned: 100 }));
    expect(render(<BattlePassScreen />).getByText('7/50')).toBeTruthy();
  });

  it('count a workout saved part way as not finished', () => {
    global.__achievements = [ach('workouts-50', 'workout_count', 50)];
    global.__held = [{ id: 'a', completed: true }, { id: 'b', completed: false }, { id: 'c' }];
    expect(render(<BattlePassScreen />).getByText('2/50')).toBeTruthy();
  });

  it('show the best workout\'s calories from the server\'s count when it is more than the phone holds', () => {
    global.__achievements = [ach('calories-1000', 'calories_burned', 1000, { category: 'calories' })];
    global.__held = [{ id: 'a', caloriesBurned: 300 }];
    useLifetimeStore.setState({ totals: { totalWorkouts: 9, finishedWorkouts: 9, totalSeconds: 1, totalCalories: 1, bestCalories: 640 } });
    expect(render(<BattlePassScreen />).getByText('640/1000')).toBeTruthy();
  });

  it('show an unlocked one as earned, with its reward, and a locked one with its progress', () => {
    global.__achievements = [
      ach('first-workout', 'workout_count', 1, { unlockedAt: '2026-10-01T00:00:00Z', xpReward: 50 }),
      ach('workouts-10', 'workout_count', 10),
    ];
    global.__held = [{ id: 'a' }];
    const utils = render(<BattlePassScreen />);
    expect(utils.getByText('+50 XP')).toBeTruthy();
    expect(utils.getByText('1/10')).toBeTruthy();
  });
});
