import React from 'react';
import { RefreshControl, StyleSheet } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => (name === '__esModule' ? false : name) }), { virtual: true });
jest.mock('expo-router', () => ({
  router: { push: (...a) => global.__router.push(...a), back: (...a) => global.__router.back(...a) },
}), { virtual: true });
jest.mock('@/components/ScreenHeader', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { __esModule: true, default: ({ title }) => mockReact.createElement(mockRn.Text, null, title) };
});
jest.mock('@/store/nutritionStore', () => ({ useNutritionStore: () => global.__nutrition }));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: global.__user }) }));

import IntakeHistoryScreen from '../app/nutrition/history';

const f = (calories, protein = 0, carbs = 0, fat = 0, extra = {}) => ({ id: 'x', name: 'X', calories, protein, carbs, fat, ...extra });
const meal = (id, date, foods) => ({ id, date, name: id, foods });

const MEALS = [
  meal('lunch', '2026-10-08', [f(1800, 100, 200, 60, { fiber: 20, sodium: 2000 })]),
  meal('lunch', '2026-10-06', [f(2200, 140, 260, 80, { fiber: 30, sodium: 3000 })]),
  meal('dinner', '2026-10-06', [f(0, 0, 0, 0)]),
  meal('lunch', '2026-09-20', [f(1000, 50, 100, 30)]),
];

const open = ({ meals = MEALS, goals = { calories: 2000 }, user = { uid: 'u1' } } = {}) => {
  global.__router = { push: jest.fn(), back: jest.fn() };
  global.__user = user;
  global.__nutrition = { meals, dailyGoals: goals, loadNutritionData: jest.fn(async () => {}) };
  return render(<IntakeHistoryScreen />);
};
const text = (node) => [].concat(node.props.children).join('');
const barHeight = (utils, date) => StyleSheet.flatten(utils.getByTestId(`history-bar-${date}`).props.style).height;

const original = process.env.TZ;
beforeAll(() => { process.env.TZ = 'America/New_York'; });
afterAll(() => { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; });
beforeEach(() => { jest.useFakeTimers({ now: new Date(2026, 9, 8, 21, 30), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }); });
afterEach(() => { jest.useRealTimers(); });

describe('the last 7 days', () => {
  it('averages the days that have food, not all seven', () => {
    const utils = open();
    expect(utils.getByText('Intake History')).toBeTruthy();
    expect(text(utils.getByTestId('history-avg-calories'))).toBe('2,000');
    expect(text(utils.getByTestId('history-days-logged'))).toBe('2 of 7 days logged');
    const summary = within(utils.getByTestId('history-summary'));
    expect(summary.getByText('120g')).toBeTruthy();
    expect(summary.getByText('230g')).toBeTruthy();
    expect(summary.getByText('70g')).toBeTruthy();
  });

  it('compares the average with the calorie goal', () => {
    expect(text(open().getByTestId('history-vs-goal'))).toBe('Right on your 2,000 kcal goal');
    expect(text(open({ goals: { calories: 1800 } }).getByTestId('history-vs-goal'))).toBe('200 kcal over your 1,800 kcal goal');
    expect(text(open({ goals: { calories: 2500 } }).getByTestId('history-vs-goal'))).toBe('500 kcal under your 2,500 kcal goal');
    expect(open({ goals: {} }).queryByTestId('history-vs-goal')).toBeNull();
  });

  it('shows fiber and sodium averages, and a dash for sugar nobody listed', () => {
    const utils = open();
    expect(text(utils.getByTestId('history-avg-fiber'))).toBe('25g');
    expect(text(utils.getByTestId('history-avg-sodium'))).toBe('2,500mg');
    expect(text(utils.getByTestId('history-avg-sugar'))).toBe('—');
  });

  it('keeps a small day visible as a bar, not a hairline or nothing', () => {
    const utils = open({ meals: [
      meal('lunch', '2026-10-08', [f(10, 1, 1, 1)]),
      meal('lunch', '2026-10-06', [f(2200, 140, 260, 80)]),
    ] });
    expect(Math.round((10 / 2200) * 120)).toBe(1);
    expect(barHeight(utils, '2026-10-08')).toBe(3);
    expect(barHeight(utils, '2026-10-07')).toBe(2);
  });

  it('has a bar for every day, tallest for the biggest day, with the goal line', () => {
    const utils = open();
    expect(barHeight(utils, '2026-10-06')).toBe(120);
    expect(barHeight(utils, '2026-10-08')).toBe(Math.round((1800 / 2200) * 120));
    expect(barHeight(utils, '2026-10-07')).toBe(2);
    expect(utils.getAllByTestId(/^history-bar-/)).toHaveLength(7);
    expect(StyleSheet.flatten(utils.getByTestId('history-goal-line').props.style).bottom).toBe(Math.round((2000 / 2200) * 120));
  });

  it('keeps the goal line on the chart when the goal is above every bar', () => {
    const utils = open({ goals: { calories: 3000 } });
    expect(StyleSheet.flatten(utils.getByTestId('history-goal-line').props.style).bottom).toBe(120);
    expect(barHeight(utils, '2026-10-06')).toBe(Math.round((2200 / 3000) * 120));
  });

  it('draws no goal line without a goal', () => {
    expect(open({ goals: {} }).queryByTestId('history-goal-line')).toBeNull();
  });

  it('lists the days with food, newest first, with Today and Yesterday named', () => {
    const utils = open();
    const rows = utils.getAllByTestId(/^history-day-/).map((n) => n.props.testID);
    expect(rows).toEqual(['history-day-2026-10-08', 'history-day-2026-10-06']);
    const today = within(utils.getByTestId('history-day-2026-10-08'));
    expect(today.getByText('Today')).toBeTruthy();
    expect(today.getByText('1,800 kcal')).toBeTruthy();
    expect(today.getByText('P 100g · C 200g · F 60g')).toBeTruthy();
    expect(within(utils.getByTestId('history-day-2026-10-06')).getByText('Tue, Oct 6')).toBeTruthy();
  });

  it('opens a day in the diary', () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('history-day-2026-10-06'));
    expect(global.__router.push).toHaveBeenCalledWith({ pathname: '/nutrition', params: { date: '2026-10-06' } });
  });
});

describe('longer ranges', () => {
  it('30 days brings in older days', () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('history-range-30'));
    expect(text(utils.getByTestId('history-days-logged'))).toBe('3 of 30 days logged');
    expect(utils.getByTestId('history-day-2026-09-20')).toBeTruthy();
    expect(utils.getAllByTestId(/^history-bar-/)).toHaveLength(30);
    expect(text(utils.getByTestId('history-avg-calories'))).toBe('1,667');
  });

  it('90 days has a bar for each day', () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('history-range-90'));
    expect(utils.getAllByTestId(/^history-bar-/)).toHaveLength(90);
  });

  it('goes back to 7 days', () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('history-range-30'));
    fireEvent.press(utils.getByTestId('history-range-7'));
    expect(text(utils.getByTestId('history-days-logged'))).toBe('2 of 7 days logged');
    expect(utils.queryByTestId('history-day-2026-09-20')).toBeNull();
  });
});

describe('with nothing logged', () => {
  it('says so, with no chart or list', () => {
    const utils = open({ meals: [meal('lunch', '2026-01-01', [f(500)])] });
    expect(text(utils.getByTestId('history-empty'))).toBe('No food logged in the last 7 days.');
    expect(utils.queryByTestId('history-chart')).toBeNull();
    expect(utils.queryByText('Days')).toBeNull();
    fireEvent.press(utils.getByTestId('history-range-90'));
    expect(text(utils.getByTestId('history-empty'))).toBe('No food logged in the last 90 days.');
  });
});

describe('pull to refresh', () => {
  it('reloads the diary from the cloud for the signed-in user', async () => {
    const utils = open();
    await act(async () => { await utils.UNSAFE_getByType(RefreshControl).props.onRefresh(); });
    expect(global.__nutrition.loadNutritionData).toHaveBeenCalledWith('u1');
  });

  it('does nothing without a signed-in user, and does not stick', async () => {
    const utils = open({ user: null });
    await act(async () => { await utils.UNSAFE_getByType(RefreshControl).props.onRefresh(); });
    expect(global.__nutrition.loadNutritionData).not.toHaveBeenCalled();
    expect(utils.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
  });
});
