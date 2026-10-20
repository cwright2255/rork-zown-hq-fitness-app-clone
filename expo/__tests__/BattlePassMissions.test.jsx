// The battle pass's "Complete 1 workout" (today) and "Complete 5 workouts" (this week) missions count a run or a hike
// the same as a workout. "Run 10km this week" is still about runs only.
// jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });

const mockState = {
  workouts: [],
  runs: [],
  hikes: [],
  achievements: [],
  meals: [],
  steps: 0,
  stepsDate: null,
  loadHikes: jest.fn(),
};
const noop = () => {};
// The user record still carries the old streak counter, which nothing updates: the screen must not read it.
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1', streak: 9 } }) }));
jest.mock('@/store/expStore', () => ({
  useExpStore: () => ({
    getLevel: () => 1, getExpForLevel: (l) => l * 1000, getExpToNextLevel: () => 1000, getTotalExp: () => 0, loadXP: () => {},
  }),
}));
jest.mock('@/store/battlePassStore', () => ({ useBattlePassStore: () => ({ claimedTiers: [], claimTier: () => {}, loadBattlePass: () => {} }) }));
jest.mock('@/store/workoutStore', () => ({ useWorkoutStore: () => ({ completedWorkouts: mockState.workouts, loadWorkouts: () => {} }) }));
jest.mock('@/store/runningStore', () => ({ useRunningStore: () => ({ runs: mockState.runs, loadRuns: () => {} }) }));
jest.mock('@/store/hikingStore', () => ({ useHikingStore: () => ({ completedHikes: mockState.hikes, loadCompletedHikes: (...args) => mockState.loadHikes(...args) }) }));
// A function that stays the same between renders, like the real store's, so the missions only recalculate when their data changes.
const mockGetMealsByDate = (day) => mockState.meals.filter((m) => m.date === day);
jest.mock('@/store/nutritionStore', () => ({
  useNutritionStore: () => ({ getMealsByDate: mockGetMealsByDate, loadNutritionData: () => {}, meals: mockState.meals }),
}));
jest.mock('@/store/healthStore', () => ({
  useHealthStore: () => ({ steps: mockState.steps, stepsDate: mockState.stepsDate, loadAllHealth: () => {} }),
}));
jest.mock('@/store/achievementStore', () => ({
  useAchievementStore: () => ({
    achievements: mockState.achievements, getUnlockedAchievements: () => [], getLockedAchievements: () => mockState.achievements, loadAchievements: () => {},
  }),
}));

import BattlePassScreen from '../app/battlepass';

const NOW = new Date('2026-10-15T01:30:00Z'); // 9:30 PM on Wed 14 Oct in New Jersey
const workout = (completedAt) => ({ id: `w-${completedAt}`, completedAt });
const run = (at, distance = 5) => ({ id: `r-${at}`, startTime: at, endTime: at, distance });
const hike = (at) => ({ id: `h-${at}`, startTime: at, completedAt: at, distanceKm: 6 });
const meal = (foods = [{ name: 'Eggs' }]) => ({ id: `m-${Math.random()}`, date: '2026-10-14', foods });

beforeEach(() => {
  mockState.workouts = [];
  mockState.runs = [];
  mockState.hikes = [];
  mockState.achievements = [];
  mockState.meals = [];
  mockState.steps = 0;
  mockState.stepsDate = null;
  mockState.loadHikes.mockClear();
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
});
afterEach(() => { jest.useRealTimers(); });

// The "0/1" beside a mission's title: both are Text inside the same row.
const progressOf = (utils, title) => {
  let row = utils.getByText(title).parent;
  while (row && !row.findAll((n) => n.type === 'Text' && /^\d+(\.\d+)?(km)?\/\d+(km)?$/.test(String(n.props.children?.join ? n.props.children.join('') : n.props.children))).length) row = row.parent;
  const t = row.findAll((n) => n.type === 'Text' && /^\d+(\.\d+)?(km)?\/\d+(km)?$/.test(String(n.props.children?.join ? n.props.children.join('') : n.props.children)))[0];
  return String(t.props.children.join ? t.props.children.join('') : t.props.children);
};

describe('battle pass missions', () => {
  it('starts at nothing done', () => {
    const utils = render(<BattlePassScreen />);
    expect(progressOf(utils, 'Complete 1 workout')).toBe('0/1');
    expect(progressOf(utils, 'Complete 5 workouts')).toBe('0/5');
    expect(progressOf(utils, 'Run 10km this week')).toBe('0km/10km');
  });

  it('counts a run as today\'s workout, a 9 PM one too', () => {
    mockState.runs = [run('2026-10-15T01:00:00Z')]; // 9:00 PM on the 14th
    const utils = render(<BattlePassScreen />);
    expect(progressOf(utils, 'Complete 1 workout')).toBe('1/1');
    expect(progressOf(utils, 'Complete 5 workouts')).toBe('1/5');
  });

  it('counts a hike as today\'s workout', () => {
    mockState.hikes = [hike('2026-10-14T15:00:00Z')];
    const utils = render(<BattlePassScreen />);
    expect(progressOf(utils, 'Complete 1 workout')).toBe('1/1');
    expect(progressOf(utils, 'Complete 5 workouts')).toBe('1/5');
  });

  it('adds workouts, runs and hikes together over the week, from Monday', () => {
    mockState.workouts = [workout('2026-10-12T15:00:00Z'), workout('2026-10-11T15:00:00Z')]; // the 11th is last Sunday
    mockState.runs = [run('2026-10-13T15:00:00Z')];
    mockState.hikes = [hike('2026-10-14T15:00:00Z')];
    const utils = render(<BattlePassScreen />);
    expect(progressOf(utils, 'Complete 5 workouts')).toBe('3/5');
    expect(progressOf(utils, 'Complete 1 workout')).toBe('1/1'); // only the hike is today's
  });

  it('does not count yesterday\'s run toward today\'s mission', () => {
    mockState.runs = [run('2026-10-13T15:00:00Z')];
    const utils = render(<BattlePassScreen />);
    expect(progressOf(utils, 'Complete 1 workout')).toBe('0/1');
    expect(progressOf(utils, 'Complete 5 workouts')).toBe('1/5');
  });

  it('loads the hikes when it opens', () => {
    render(<BattlePassScreen />);
    expect(mockState.loadHikes).toHaveBeenCalledWith('u1');
  });

  it('updates the missions when a hike arrives while the screen is open', () => {
    const utils = render(<BattlePassScreen />);
    expect(progressOf(utils, 'Complete 1 workout')).toBe('0/1');
    mockState.hikes = [hike('2026-10-14T15:00:00Z')];
    utils.rerender(<BattlePassScreen />);
    expect(progressOf(utils, 'Complete 1 workout')).toBe('1/1');
    expect(progressOf(utils, 'Complete 5 workouts')).toBe('1/5');
  });

  it('counts the meals logged today, and not one with no foods in it', () => {
    mockState.meals = [meal(), meal(), meal([])];
    expect(progressOf(render(<BattlePassScreen />), 'Log 3 meals')).toBe('2/3');
  });

  it('moves the meals mission when a meal is logged while the screen is open', () => {
    mockState.meals = [meal()];
    const utils = render(<BattlePassScreen />);
    expect(progressOf(utils, 'Log 3 meals')).toBe('1/3');
    mockState.meals = [...mockState.meals, meal()];
    utils.rerender(<BattlePassScreen />);
    expect(progressOf(utils, 'Log 3 meals')).toBe('2/3');
  });

  it('counts the steps counted today, and not a count from another day', () => {
    mockState.steps = 3200;
    mockState.stepsDate = '2026-10-14';
    const today = render(<BattlePassScreen />);
    expect(progressOf(today, 'Walk 5,000 steps')).toBe('3200/5000');
    today.unmount();
    mockState.stepsDate = '2026-10-13';
    expect(progressOf(render(<BattlePassScreen />), 'Walk 5,000 steps')).toBe('0/5000');
  });

  it('moves the steps mission when the count comes in while the screen is open', () => {
    mockState.steps = 100;
    mockState.stepsDate = '2026-10-13'; // yesterday's, from before the sync
    const utils = render(<BattlePassScreen />);
    expect(progressOf(utils, 'Walk 5,000 steps')).toBe('0/5000');
    mockState.steps = 4200;
    mockState.stepsDate = '2026-10-14';
    utils.rerender(<BattlePassScreen />);
    expect(progressOf(utils, 'Walk 5,000 steps')).toBe('4200/5000');
  });

  it('moves the missions when a workout arrives while the screen is open', () => {
    const utils = render(<BattlePassScreen />);
    expect(progressOf(utils, 'Complete 1 workout')).toBe('0/1');
    mockState.workouts = [workout('2026-10-14T15:00:00Z')];
    utils.rerender(<BattlePassScreen />);
    expect(progressOf(utils, 'Complete 1 workout')).toBe('1/1');
    expect(progressOf(utils, 'Complete 5 workouts')).toBe('1/5');
  });

  it('moves the missions when a run arrives while the screen is open', () => {
    const utils = render(<BattlePassScreen />);
    expect(progressOf(utils, 'Run 10km this week')).toBe('0km/10km');
    mockState.runs = [run('2026-10-14T15:00:00Z', 5)];
    utils.rerender(<BattlePassScreen />);
    expect(progressOf(utils, 'Run 10km this week')).toBe('5km/10km');
    expect(progressOf(utils, 'Complete 1 workout')).toBe('1/1');
  });

  it('moves the steps mission when only the count changes, or only the day it was counted on', () => {
    mockState.steps = 100;
    mockState.stepsDate = '2026-10-14';
    const utils = render(<BattlePassScreen />);
    expect(progressOf(utils, 'Walk 5,000 steps')).toBe('100/5000');
    mockState.steps = 4200;
    utils.rerender(<BattlePassScreen />);
    expect(progressOf(utils, 'Walk 5,000 steps')).toBe('4200/5000');
    mockState.stepsDate = '2026-10-13';
    utils.rerender(<BattlePassScreen />);
    expect(progressOf(utils, 'Walk 5,000 steps')).toBe('0/5000');
    mockState.stepsDate = '2026-10-14';
    utils.rerender(<BattlePassScreen />);
    expect(progressOf(utils, 'Walk 5,000 steps')).toBe('4200/5000');
  });

  it('keeps the 10 km mission about runs: a hike does not add to it', () => {
    mockState.runs = [run('2026-10-13T15:00:00Z', 5)];
    mockState.hikes = [hike('2026-10-14T15:00:00Z')];
    const utils = render(<BattlePassScreen />);
    expect(progressOf(utils, 'Run 10km this week')).toBe('5km/10km');
  });
});

describe('battle pass streak achievements', () => {
  const STREAK = { id: 'streak-7', name: 'On a Roll', icon: 'R', category: 'streak', description: 'Seven days in a row', xpReward: 50, condition: { type: 'streak', target: 7 } };
  const progress = (utils) => utils.getByText(/^\d+\/7$/).props.children.join('');

  it('counts days in a row from workouts, runs and hikes together', () => {
    mockState.achievements = [STREAK];
    mockState.workouts = [workout('2026-10-14T15:00:00Z')];
    mockState.runs = [run('2026-10-13T15:00:00Z')];
    mockState.hikes = [hike('2026-10-12T15:00:00Z')];
    expect(progress(render(<BattlePassScreen />))).toBe('3/7');
  });

  it('does not read the old counter on the user record', () => {
    mockState.achievements = [STREAK];
    expect(progress(render(<BattlePassScreen />))).toBe('0/7');
  });

  it('keeps yesterday\'s run in the streak on the evening of a day with nothing yet', () => {
    mockState.achievements = [STREAK];
    mockState.runs = [run('2026-10-13T15:00:00Z'), run('2026-10-12T15:00:00Z')];
    expect(progress(render(<BattlePassScreen />))).toBe('2/7');
  });

  it('drops the streak when the screen stays open into a day with nothing done', () => {
    mockState.achievements = [STREAK];
    mockState.workouts = [workout('2026-10-14T15:00:00Z')];
    const utils = render(<BattlePassScreen />);
    expect(progress(utils)).toBe('1/7');
    jest.setSystemTime(new Date('2026-10-16T14:00:00Z')); // two days on: the 14th is no longer yesterday
    utils.rerender(<BattlePassScreen />);
    expect(progress(utils)).toBe('0/7');
  });

  it('moves on when a run arrives while the screen is open', () => {
    mockState.achievements = [STREAK];
    mockState.hikes = [hike('2026-10-13T15:00:00Z')];
    const utils = render(<BattlePassScreen />);
    expect(progress(utils)).toBe('1/7');
    mockState.runs = [run('2026-10-14T15:00:00Z')];
    utils.rerender(<BattlePassScreen />);
    expect(progress(utils)).toBe('2/7');
  });

  it('moves on when a workout arrives while the screen is open', () => {
    mockState.achievements = [STREAK];
    mockState.runs = [run('2026-10-13T15:00:00Z')];
    const utils = render(<BattlePassScreen />);
    expect(progress(utils)).toBe('1/7');
    mockState.workouts = [workout('2026-10-14T15:00:00Z')];
    utils.rerender(<BattlePassScreen />);
    expect(progress(utils)).toBe('2/7');
  });

  it('moves on when a hike arrives while the screen is open', () => {
    mockState.achievements = [STREAK];
    mockState.workouts = [workout('2026-10-13T15:00:00Z')];
    const utils = render(<BattlePassScreen />);
    expect(progress(utils)).toBe('1/7');
    mockState.hikes = [hike('2026-10-14T15:00:00Z')];
    utils.rerender(<BattlePassScreen />);
    expect(progress(utils)).toBe('2/7');
  });
});
