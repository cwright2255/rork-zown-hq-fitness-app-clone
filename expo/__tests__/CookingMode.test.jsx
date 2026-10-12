import React from 'react';
import { Modal, StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-haptics', () => ({
  notificationAsync: (...a) => global.__haptic(...a),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}), { virtual: true });
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 10, bottom: 5, left: 0, right: 0 }),
}), { virtual: true });
jest.mock('@/services/keepAwake', () => ({ keepScreenOn: (...a) => global.__keep(...a) }));
jest.mock('@/services/cookTimerAlert', () => ({
  scheduleTimerAlert: (...a) => global.__schedule(...a),
  cancelTimerAlert: (...a) => global.__cancel(...a),
}));

import CookingMode from '../components/CookingMode';

const STEPS = ['Chop the onion.', 'Simmer for 10 minutes.', 'Bake 20 minutes, then rest 5 minutes.', 'Serve.'];
const INGREDIENTS = ['1 onion', '2 cups stock'];

const open = (props = {}) => render(
  <CookingMode title="Chili" steps={STEPS} ingredients={INGREDIENTS} onClose={global.__close} {...props} />,
);
const flush = () => act(async () => {});
const tick = (ms) => act(() => { jest.advanceTimersByTime(ms); });
const press = (utils, id) => fireEvent.press(utils.getByTestId(id));
const stepText = (utils) => utils.getByTestId('cook-step-text').props.children;
const count = (utils) => utils.getByTestId('cook-step-count').props.children;
const goTo = (utils, step) => { for (let i = 1; i < step; i += 1) press(utils, 'cook-next'); };

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.setSystemTime(new Date('2026-10-08T12:00:00Z'));
  global.__close = jest.fn();
  global.__release = jest.fn();
  global.__keep = jest.fn(() => global.__release);
  global.__schedule = jest.fn(async () => 'alert-1');
  global.__cancel = jest.fn(async () => undefined);
  global.__haptic = jest.fn(async () => undefined);
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe('the steps', () => {
  it('starts on the first step', () => {
    const utils = open();
    expect(count(utils)).toBe('Step 1 of 4');
    expect(stepText(utils)).toBe('Chop the onion.');
    expect(utils.getByText('Chili')).toBeTruthy();
  });

  it('goes forward and back', () => {
    const utils = open();
    press(utils, 'cook-next');
    expect(count(utils)).toBe('Step 2 of 4');
    expect(stepText(utils)).toBe('Simmer for 10 minutes.');
    press(utils, 'cook-next');
    expect(count(utils)).toBe('Step 3 of 4');
    press(utils, 'cook-prev');
    expect(count(utils)).toBe('Step 2 of 4');
    press(utils, 'cook-prev');
    expect(count(utils)).toBe('Step 1 of 4');
  });

  it('can not go back from the first step', () => {
    const utils = open();
    expect(utils.getByTestId('cook-prev').props.accessibilityState).toEqual({ disabled: true });
    utils.UNSAFE_getAllByProps({ testID: 'cook-prev' }).find((n) => typeof n.props.onPress === 'function').props.onPress();
    expect(count(utils)).toBe('Step 1 of 4');
    press(utils, 'cook-next');
    expect(utils.getByTestId('cook-prev').props.accessibilityState).toEqual({ disabled: false });
  });

  it('shows how far along the recipe is', () => {
    const utils = open();
    const width = () => StyleSheet.flatten(utils.getByTestId('cook-progress').props.style).width;
    expect(width()).toBe('25%');
    press(utils, 'cook-next');
    expect(width()).toBe('50%');
    goTo(utils, 4);
    expect(width()).toBe('100%');
  });

  it('says Done on the last step, and closes when it is pressed', () => {
    const utils = open();
    expect(utils.getByText('Next')).toBeTruthy();
    goTo(utils, 4);
    expect(count(utils)).toBe('Step 4 of 4');
    expect(utils.getByText('Done')).toBeTruthy();
    expect(utils.queryByText('Next')).toBeNull();
    expect(global.__close).not.toHaveBeenCalled();
    press(utils, 'cook-next');
    expect(global.__close).toHaveBeenCalledTimes(1);
    expect(count(utils)).toBe('Step 4 of 4');
  });

  it('is one step that says Done', () => {
    const utils = open({ steps: ['Pour and drink.'] });
    expect(count(utils)).toBe('Step 1 of 1');
    expect(utils.getByText('Done')).toBeTruthy();
    press(utils, 'cook-next');
    expect(global.__close).toHaveBeenCalledTimes(1);
  });

  it('closes from the Close button and from the phone\'s back button', () => {
    const utils = open();
    press(utils, 'cook-close');
    expect(global.__close).toHaveBeenCalledTimes(1);
    utils.UNSAFE_getByType(Modal).props.onRequestClose();
    expect(global.__close).toHaveBeenCalledTimes(2);
  });

  it('does not fall over when nothing is listening for close', () => {
    const utils = open({ onClose: undefined });
    goTo(utils, 4);
    expect(() => press(utils, 'cook-next')).not.toThrow();
  });

  it('keeps clear of the notch and the home bar', () => {
    const utils = open();
    const style = StyleSheet.flatten(utils.getByTestId('cook-container').props.style);
    expect(style.paddingTop).toBe(18);
    expect(style.paddingBottom).toBe(17);
  });
});

describe('the ingredients', () => {
  it('are one tap away, in place of the step', () => {
    const utils = open();
    expect(utils.getByText('Ingredients')).toBeTruthy();
    expect(utils.queryByTestId('cook-ingredients-list')).toBeNull();
    press(utils, 'cook-ingredients-toggle');
    expect(utils.getByText('1 onion')).toBeTruthy();
    expect(utils.getByText('2 cups stock')).toBeTruthy();
    expect(utils.queryByTestId('cook-step-text')).toBeNull();
    expect(utils.getByText('Steps')).toBeTruthy();
    expect(utils.queryByText('Ingredients')).toBeNull();
    press(utils, 'cook-ingredients-toggle');
    expect(stepText(utils)).toBe('Chop the onion.');
    expect(utils.queryByTestId('cook-ingredients-list')).toBeNull();
  });

  it('give way to the next step, and to the one before', () => {
    const utils = open();
    press(utils, 'cook-ingredients-toggle');
    press(utils, 'cook-next');
    expect(stepText(utils)).toBe('Simmer for 10 minutes.');
    press(utils, 'cook-ingredients-toggle');
    press(utils, 'cook-prev');
    expect(stepText(utils)).toBe('Chop the onion.');
  });

  it('work with no ingredients', () => {
    const utils = open({ ingredients: undefined });
    press(utils, 'cook-ingredients-toggle');
    expect(utils.getByTestId('cook-ingredients-list')).toBeTruthy();
  });
});

describe('a recipe with no steps', () => {
  it('says so and offers only Close', () => {
    const utils = open({ steps: [] });
    expect(utils.getByTestId('cook-empty')).toBeTruthy();
    expect(utils.queryByTestId('cook-next')).toBeNull();
    expect(utils.queryByTestId('cook-prev')).toBeNull();
    expect(utils.queryByTestId('cook-ingredients-toggle')).toBeNull();
    expect(utils.queryByTestId('cook-step-count')).toBeNull();
    press(utils, 'cook-close');
    expect(global.__close).toHaveBeenCalledTimes(1);
  });

  it('is the same with no list given', () => {
    const utils = render(<CookingMode title="Chili" />);
    expect(utils.getByTestId('cook-empty')).toBeTruthy();
  });
});

describe('keeping the screen awake', () => {
  it('asks once while cooking mode is open and lets go when it closes', () => {
    const utils = open();
    expect(global.__keep).toHaveBeenCalledTimes(1);
    expect(global.__keep).toHaveBeenCalledWith('cooking');
    press(utils, 'cook-next');
    press(utils, 'cook-ingredients-toggle');
    expect(global.__keep).toHaveBeenCalledTimes(1);
    expect(global.__release).not.toHaveBeenCalled();
    utils.unmount();
    expect(global.__release).toHaveBeenCalledTimes(1);
  });

  it('also does it for a recipe with no steps', () => {
    open({ steps: [] });
    expect(global.__keep).toHaveBeenCalledTimes(1);
  });
});

describe('timers', () => {
  it('offers one for a waiting time in the step, and none otherwise', () => {
    const utils = open();
    expect(utils.queryByTestId('cook-timer-start-0')).toBeNull();
    press(utils, 'cook-next');
    expect(utils.getByText('Start 10 min timer')).toBeTruthy();
    press(utils, 'cook-next');
    expect(utils.getByText('Start 20 min timer')).toBeTruthy();
    expect(utils.getByText('Start 5 min timer')).toBeTruthy();
    press(utils, 'cook-next');
    expect(utils.queryByTestId('cook-timer-start-0')).toBeNull();
  });

  it('counts down once it is started', () => {
    const utils = open();
    goTo(utils, 2);
    press(utils, 'cook-timer-start-0');
    expect(utils.queryByTestId('cook-timer-start-0')).toBeNull();
    expect(utils.getByTestId('cook-timer-clock-0').props.children).toBe('10:00');
    tick(1000);
    expect(utils.getByTestId('cook-timer-clock-0').props.children).toBe('9:59');
    tick(59000);
    expect(utils.getByTestId('cook-timer-clock-0').props.children).toBe('9:00');
    tick(8 * 60 * 1000 + 59000);
    expect(utils.getByTestId('cook-timer-clock-0').props.children).toBe('0:01');
    expect(global.__haptic).not.toHaveBeenCalled();
  });

  it('rings a notification for the time it was set for', async () => {
    const utils = open();
    goTo(utils, 2);
    press(utils, 'cook-timer-start-0');
    expect(global.__schedule).toHaveBeenCalledTimes(1);
    expect(global.__schedule).toHaveBeenCalledWith(600, { title: 'Timer done', body: 'Chili, step 2' });
    await flush();
  });

  it('names the notification after the recipe, or just "Recipe"', async () => {
    const utils = open({ title: undefined });
    goTo(utils, 2);
    press(utils, 'cook-timer-start-0');
    expect(global.__schedule.mock.calls[0][1].body).toBe('Recipe, step 2');
    await flush();
  });

  it('says the time is up, buzzes once, and stops counting', () => {
    const utils = open();
    goTo(utils, 2);
    press(utils, 'cook-timer-start-0');
    tick(599000);
    expect(global.__haptic).not.toHaveBeenCalled();
    tick(1000);
    expect(utils.getByTestId('cook-timer-done-0').props.children).toBe('Time is up');
    expect(utils.queryByTestId('cook-timer-clock-0')).toBeNull();
    expect(global.__haptic).toHaveBeenCalledTimes(1);
    expect(global.__haptic).toHaveBeenCalledWith('success');
    expect(utils.getByText('Dismiss')).toBeTruthy();
    tick(5000);
    expect(global.__haptic).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('is still up in the app when the buzz does not work', () => {
    global.__haptic = jest.fn(() => { throw new Error('no buzz'); });
    const utils = open();
    goTo(utils, 2);
    press(utils, 'cook-timer-start-0');
    tick(600000);
    expect(utils.getByTestId('cook-timer-done-0')).toBeTruthy();
    global.__haptic = jest.fn(() => Promise.reject(new Error('no buzz')));
    const again = open();
    goTo(again, 2);
    press(again, 'cook-timer-start-0');
    tick(600000);
    expect(again.getByTestId('cook-timer-done-0')).toBeTruthy();
  });

  it('can be stopped, and started again', async () => {
    const utils = open();
    goTo(utils, 2);
    press(utils, 'cook-timer-start-0');
    await flush();
    tick(30000);
    expect(utils.getByText('Stop')).toBeTruthy();
    press(utils, 'cook-timer-stop-0');
    expect(utils.queryByTestId('cook-timer-clock-0')).toBeNull();
    expect(utils.getByTestId('cook-timer-start-0')).toBeTruthy();
    await flush();
    expect(global.__cancel).toHaveBeenCalledTimes(1);
    expect(global.__cancel).toHaveBeenCalledWith('alert-1');
    expect(jest.getTimerCount()).toBe(0);
    press(utils, 'cook-timer-start-0');
    expect(utils.getByTestId('cook-timer-clock-0').props.children).toBe('10:00');
  });

  it('can be dismissed once it is up', async () => {
    const utils = open();
    goTo(utils, 2);
    press(utils, 'cook-timer-start-0');
    await flush();
    tick(600000);
    press(utils, 'cook-timer-stop-0');
    expect(utils.queryByTestId('cook-timer-done-0')).toBeNull();
    expect(utils.getByTestId('cook-timer-start-0')).toBeTruthy();
    await flush();
    expect(global.__cancel).toHaveBeenCalledWith('alert-1');
  });

  it('does nothing when the same timer is stopped twice in a row', async () => {
    const utils = open();
    goTo(utils, 2);
    press(utils, 'cook-timer-start-0');
    await flush();
    const stop = utils.UNSAFE_getAllByProps({ testID: 'cook-timer-stop-0' }).find((n) => typeof n.props.onPress === 'function').props.onPress;
    await act(async () => { stop(); stop(); });
    expect(utils.getByTestId('cook-timer-start-0')).toBeTruthy();
    expect(global.__cancel).toHaveBeenCalledTimes(1);
  });

  it('cancels the notification even if it was stopped before it was scheduled', async () => {
    let resolve;
    global.__schedule = jest.fn(() => new Promise((r) => { resolve = r; }));
    const utils = open();
    goTo(utils, 2);
    press(utils, 'cook-timer-start-0');
    press(utils, 'cook-timer-stop-0');
    expect(global.__cancel).not.toHaveBeenCalled();
    await act(async () => { resolve('late-alert'); });
    expect(global.__cancel).toHaveBeenCalledWith('late-alert');
  });

  it('starts at the full time even when no clock has been running for a while', () => {
    const utils = open();
    goTo(utils, 2);
    act(() => { jest.setSystemTime(new Date('2026-10-08T12:00:30Z')); });
    press(utils, 'cook-timer-start-0');
    expect(utils.getByTestId('cook-timer-clock-0').props.children).toBe('10:00');
  });

  it('runs several in one step on their own', () => {
    const utils = open();
    goTo(utils, 3);
    press(utils, 'cook-timer-start-1');
    expect(utils.getByTestId('cook-timer-clock-1').props.children).toBe('5:00');
    expect(utils.getByTestId('cook-timer-start-0')).toBeTruthy();
    tick(60000);
    press(utils, 'cook-timer-start-0');
    expect(utils.getByTestId('cook-timer-clock-0').props.children).toBe('20:00');
    expect(utils.getByTestId('cook-timer-clock-1').props.children).toBe('4:00');
    press(utils, 'cook-timer-stop-1');
    expect(utils.getByTestId('cook-timer-start-1')).toBeTruthy();
    expect(utils.getByTestId('cook-timer-clock-0').props.children).toBe('20:00');
  });

  it('keeps running on another step and shows up above it', () => {
    const utils = open();
    goTo(utils, 2);
    press(utils, 'cook-timer-start-0');
    expect(utils.queryByTestId('cook-timer-chip-1-0')).toBeNull();
    press(utils, 'cook-next');
    tick(30000);
    expect(utils.getByText('Step 2: 9:30')).toBeTruthy();
    press(utils, 'cook-next');
    tick(30000);
    expect(utils.getByText('Step 2: 9:00')).toBeTruthy();
    press(utils, 'cook-prev');
    press(utils, 'cook-prev');
    expect(utils.queryByTestId('cook-timer-chip-1-0')).toBeNull();
    expect(utils.getByTestId('cook-timer-clock-0').props.children).toBe('9:00');
  });

  it('shows the row of timers from other steps only while there is one', () => {
    const utils = open();
    goTo(utils, 2);
    expect(utils.queryByTestId('cook-timer-chips')).toBeNull();
    press(utils, 'cook-timer-start-0');
    expect(utils.queryByTestId('cook-timer-chips')).toBeNull();
    press(utils, 'cook-next');
    expect(utils.getByTestId('cook-timer-chips')).toBeTruthy();
    press(utils, 'cook-prev');
    expect(utils.queryByTestId('cook-timer-chips')).toBeNull();
  });

  it('can be jumped back to from its chip', () => {
    const utils = open();
    goTo(utils, 2);
    press(utils, 'cook-timer-start-0');
    goTo(utils, 2);
    press(utils, 'cook-next');
    press(utils, 'cook-next');
    expect(count(utils)).toBe('Step 4 of 4');
    press(utils, 'cook-timer-chip-1-0');
    expect(count(utils)).toBe('Step 2 of 4');
    expect(utils.getByTestId('cook-timer-clock-0')).toBeTruthy();
  });

  it('jumping from a chip leaves the ingredient list', () => {
    const utils = open();
    goTo(utils, 2);
    press(utils, 'cook-timer-start-0');
    press(utils, 'cook-next');
    press(utils, 'cook-ingredients-toggle');
    press(utils, 'cook-timer-chip-1-0');
    expect(stepText(utils)).toBe('Simmer for 10 minutes.');
  });

  it('shows on another step as up when it ends there', () => {
    const utils = open();
    goTo(utils, 2);
    press(utils, 'cook-timer-start-0');
    press(utils, 'cook-next');
    tick(600000);
    expect(utils.getByText('Step 2: time is up')).toBeTruthy();
    expect(global.__haptic).toHaveBeenCalledTimes(1);
    press(utils, 'cook-prev');
    expect(utils.getByTestId('cook-timer-done-0')).toBeTruthy();
  });

  it('keeps the timers of different steps apart, even with the same place in the step', () => {
    const utils = open({ steps: ['Boil 3 minutes.', 'Rest 4 minutes.'] });
    press(utils, 'cook-timer-start-0');
    press(utils, 'cook-next');
    expect(utils.getByTestId('cook-timer-start-0')).toBeTruthy();
    press(utils, 'cook-timer-start-0');
    tick(1000);
    expect(utils.getByTestId('cook-timer-clock-0').props.children).toBe('3:59');
    expect(utils.getByText('Step 1: 2:59')).toBeTruthy();
  });

  it('stops everything and cancels the notifications when cooking mode closes', async () => {
    const utils = open();
    goTo(utils, 3);
    press(utils, 'cook-timer-start-0');
    press(utils, 'cook-timer-start-1');
    await flush();
    global.__cancel.mockClear();
    utils.unmount();
    await flush();
    expect(global.__cancel).toHaveBeenCalledTimes(2);
    expect(global.__cancel).toHaveBeenCalledWith('alert-1');
    tick(1000); // lets the button fade finish; a clock that was left running would still be here
    expect(jest.getTimerCount()).toBe(0);
  });

  it('has nothing to cancel when none were started', async () => {
    const utils = open();
    utils.unmount();
    await flush();
    expect(global.__cancel).not.toHaveBeenCalled();
  });

  it('cancels only once for a timer that was already stopped', async () => {
    const utils = open();
    goTo(utils, 2);
    press(utils, 'cook-timer-start-0');
    await flush();
    press(utils, 'cook-timer-stop-0');
    await flush();
    utils.unmount();
    await flush();
    expect(global.__cancel).toHaveBeenCalledTimes(1);
  });

  it('counts by the clock, so time in the background still counts', () => {
    const utils = open();
    goTo(utils, 2);
    press(utils, 'cook-timer-start-0');
    act(() => {
      jest.setSystemTime(new Date('2026-10-08T12:03:00Z'));
      jest.advanceTimersByTime(1000);
    });
    expect(utils.getByTestId('cook-timer-clock-0').props.children).toBe('6:59');
  });
});
