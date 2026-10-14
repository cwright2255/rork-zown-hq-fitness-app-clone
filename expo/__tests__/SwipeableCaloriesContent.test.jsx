import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }), { virtual: true });

import SwipeableCaloriesContent from '../components/SwipeableCaloriesContent';
import { computeCalorieMetrics } from '../lib/calorieMetrics';

const metricsWith = (goal) => computeCalorieMetrics([], [], goal, 0);
const texts = (utils) => utils.toJSON && JSON.stringify(utils.toJSON());

describe('the home Calories card (burned) with the eaten figure beside it', () => {
  it('shows what was eaten today against the eat goal', () => {
    const utils = render(<SwipeableCaloriesContent metrics={metricsWith(500)} onSetGoal={() => {}} eatenToday={1250} eatTarget={2400} />);
    expect(utils.getByText('Eaten today')).toBeTruthy();
    expect(utils.getByText('1,250 of 2,400 kcal')).toBeTruthy();
  });

  it('shows just what was eaten while no eat goal has been set', () => {
    const utils = render(<SwipeableCaloriesContent metrics={metricsWith(500)} onSetGoal={() => {}} eatenToday={820} eatTarget={null} />);
    expect(utils.getByText('820 kcal')).toBeTruthy();
    expect(texts(utils)).not.toContain(' of ');
  });

  it('shows 0 eaten when nothing is logged yet, since that is a real answer', () => {
    const utils = render(<SwipeableCaloriesContent metrics={metricsWith(500)} onSetGoal={() => {}} eatenToday={0} eatTarget={2400} />);
    expect(utils.getByText('0 of 2,400 kcal')).toBeTruthy();
  });

  it('draws no eaten row when no figure is given', () => {
    const utils = render(<SwipeableCaloriesContent metrics={metricsWith(500)} onSetGoal={() => {}} />);
    expect(utils.queryByText('Eaten today')).toBeNull();
  });

  it('calls the goal a burn goal, and keeps the burned number as the headline', () => {
    const utils = render(<SwipeableCaloriesContent metrics={metricsWith(500)} onSetGoal={() => {}} eatenToday={100} eatTarget={2000} />);
    expect(utils.getByText('Burn goal')).toBeTruthy();
    expect(utils.queryByText('Goal')).toBeNull();
    expect(utils.getByText('Calories burned today')).toBeTruthy();
  });

  it('asks for a burn goal when there is none, and opens the prompt', () => {
    const onSetGoal = jest.fn();
    const utils = render(<SwipeableCaloriesContent metrics={metricsWith(null)} onSetGoal={onSetGoal} eatenToday={100} eatTarget={2000} />);
    expect(utils.queryByText('Burn goal')).toBeNull();
    fireEvent.press(utils.getByText('Set a daily burn goal'));
    expect(onSetGoal).toHaveBeenCalledTimes(1);
  });
});
