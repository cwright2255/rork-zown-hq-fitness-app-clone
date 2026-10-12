import React from 'react';
import { Modal, StyleSheet } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 10, bottom: 30, left: 0, right: 0 }),
}), { virtual: true });

import PlanTargetSheet, { TARGET_DAYS } from '../components/PlanTargetSheet';

const original = process.env.TZ;
beforeAll(() => { process.env.TZ = 'America/New_York'; });
afterAll(() => { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; });

// Friday Oct 9, 2026, 12:00 in New Jersey (so 4 PM in UTC, 12 noon local).
const NOON = new Date('2026-10-09T16:00:00Z');
beforeEach(() => { jest.useFakeTimers({ now: NOON, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }); });
afterEach(() => { jest.useRealTimers(); });

const open = (props = {}) => {
  const onConfirm = jest.fn();
  const onClose = jest.fn();
  const utils = render(<PlanTargetSheet title="Move Chili" onConfirm={onConfirm} onClose={onClose} {...props} />);
  return { ...utils, onConfirm, onClose };
};
const selected = (utils, id) => utils.getByTestId(id).props.accessibilityState.selected;

describe('what it shows', () => {
  it('shows the title and a confirm button that says Add unless told otherwise', () => {
    const utils = open();
    expect(utils.getByText('Move Chili')).toBeTruthy();
    expect(utils.getByText('Add')).toBeTruthy();
    expect(utils.getByText('Cancel')).toBeTruthy();
  });

  it('uses the confirm label it is given', () => {
    const utils = open({ confirmLabel: 'Copy' });
    expect(utils.getByText('Copy')).toBeTruthy();
    expect(utils.queryByText('Add')).toBeNull();
  });

  it('offers today and the 13 days after it, in order', () => {
    const utils = open();
    expect(TARGET_DAYS).toBe(14);
    const ids = utils.UNSAFE_getAllByProps({ accessibilityRole: 'button' })
      .map((n) => n.props.testID)
      .filter((id, i, all) => id && id.startsWith('plan-target-day-') && all.indexOf(id) === i);
    expect(ids).toHaveLength(14);
    expect(ids[0]).toBe('plan-target-day-2026-10-09');
    expect(ids[1]).toBe('plan-target-day-2026-10-10');
    expect(ids[13]).toBe('plan-target-day-2026-10-22');
    expect(utils.queryByTestId('plan-target-day-2026-10-08')).toBeNull();
    expect(utils.queryByTestId('plan-target-day-2026-10-23')).toBeNull();
  });

  it('calls today Today and the other days by their weekday and date', () => {
    const utils = open();
    expect(utils.getAllByText('Today')).toHaveLength(1);
    expect(within(utils.getByTestId('plan-target-day-2026-10-09')).getByText('Today')).toBeTruthy();
    expect(within(utils.getByTestId('plan-target-day-2026-10-09')).getByText('9')).toBeTruthy();
    const sat = within(utils.getByTestId('plan-target-day-2026-10-10'));
    expect(sat.getByText('Sat')).toBeTruthy();
    expect(sat.getByText('10')).toBeTruthy();
    const thu = within(utils.getByTestId('plan-target-day-2026-10-22'));
    expect(thu.getByText('Thu')).toBeTruthy();
    expect(thu.getByText('22')).toBeTruthy();
  });

  it('offers the four meals', () => {
    const utils = open();
    ['Breakfast', 'Lunch', 'Dinner', 'Snack'].forEach((name) => expect(utils.getByText(name)).toBeTruthy());
  });

  it('keeps clear of the home indicator', () => {
    const utils = open();
    const sheet = StyleSheet.flatten(utils.getByTestId('plan-target-sheet').props.style);
    expect(sheet.paddingBottom).toBe(46);
  });
});

describe('where it starts', () => {
  it('starts on today and the meal that fits the time of day', () => {
    const utils = open();
    expect(selected(utils, 'plan-target-day-2026-10-09')).toBe(true);
    expect(selected(utils, 'plan-target-day-2026-10-10')).toBe(false);
    // Noon: lunch.
    expect(selected(utils, 'plan-target-slot-lunch')).toBe(true);
    expect(selected(utils, 'plan-target-slot-breakfast')).toBe(false);
  });

  it('starts on the day and meal it is given', () => {
    const utils = open({ initialDate: '2026-10-14', initialSlot: 'snack' });
    expect(selected(utils, 'plan-target-day-2026-10-14')).toBe(true);
    expect(selected(utils, 'plan-target-day-2026-10-09')).toBe(false);
    expect(selected(utils, 'plan-target-slot-snack')).toBe(true);
    expect(selected(utils, 'plan-target-slot-lunch')).toBe(false);
  });

  it('starts on today when the day it is given is in the past or too far ahead', () => {
    expect(selected(open({ initialDate: '2026-10-08' }), 'plan-target-day-2026-10-09')).toBe(true);
    expect(selected(open({ initialDate: '2026-10-23' }), 'plan-target-day-2026-10-09')).toBe(true);
    expect(selected(open({ initialDate: 'tomorrow' }), 'plan-target-day-2026-10-09')).toBe(true);
  });

  it('starts on the meal for the time of day when the meal it is given is not real', () => {
    expect(selected(open({ initialSlot: 'brunch' }), 'plan-target-slot-lunch')).toBe(true);
  });

  it('starts on breakfast in the morning and dinner in the evening', () => {
    jest.setSystemTime(new Date('2026-10-09T12:00:00Z')); // 8 AM
    expect(selected(open(), 'plan-target-slot-breakfast')).toBe(true);
    jest.setSystemTime(new Date('2026-10-10T00:30:00Z')); // 8:30 PM on the 9th
    const evening = open();
    expect(selected(evening, 'plan-target-slot-dinner')).toBe(true);
    expect(selected(evening, 'plan-target-day-2026-10-09')).toBe(true);
  });
});

describe('choosing', () => {
  it('moves the highlight to the day and meal pressed, one of each at a time', () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('plan-target-day-2026-10-12'));
    fireEvent.press(utils.getByTestId('plan-target-slot-dinner'));
    expect(selected(utils, 'plan-target-day-2026-10-12')).toBe(true);
    expect(selected(utils, 'plan-target-day-2026-10-09')).toBe(false);
    expect(selected(utils, 'plan-target-slot-dinner')).toBe(true);
    expect(selected(utils, 'plan-target-slot-lunch')).toBe(false);
  });

  it('hands back the day and meal chosen when confirmed', () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('plan-target-day-2026-10-12'));
    fireEvent.press(utils.getByTestId('plan-target-slot-dinner'));
    fireEvent.press(utils.getByTestId('plan-target-confirm'));
    expect(utils.onConfirm).toHaveBeenCalledTimes(1);
    expect(utils.onConfirm).toHaveBeenCalledWith({ date: '2026-10-12', slot: 'dinner' });
    expect(utils.onClose).not.toHaveBeenCalled();
  });

  it('hands back where it started when nothing was changed', () => {
    const utils = open({ initialDate: '2026-10-11', initialSlot: 'breakfast' });
    fireEvent.press(utils.getByTestId('plan-target-confirm'));
    expect(utils.onConfirm).toHaveBeenCalledWith({ date: '2026-10-11', slot: 'breakfast' });
  });

  it('closes without confirming on Cancel', () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('plan-target-cancel'));
    expect(utils.onClose).toHaveBeenCalledTimes(1);
    expect(utils.onConfirm).not.toHaveBeenCalled();
  });

  it('closes when the system asks it to (the Android back button)', () => {
    const utils = open();
    act(() => { utils.UNSAFE_getByType(Modal).props.onRequestClose(); });
    expect(utils.onClose).toHaveBeenCalledTimes(1);
    expect(utils.onConfirm).not.toHaveBeenCalled();
  });

  it('is a visible modal', () => {
    const utils = open();
    expect(utils.UNSAFE_getByType(Modal).props.visible).toBe(true);
  });
});
