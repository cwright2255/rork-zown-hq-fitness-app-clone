// The sheet for adding or changing a calendar event (components/CalendarEventSheet.jsx).
// jest.global-setup.js pins the time zone to America/New_York.
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 10, bottom: 5, left: 0, right: 0 }),
}), { virtual: true });

import CalendarEventSheet from '../components/CalendarEventSheet';

// Mon 19 Oct 2026, noon in New York.
const NOON = new Date(2026, 9, 19, 12, 0);
const at = (d, h = 7, mi = 0) => new Date(2026, 9, d, h, mi).toISOString();
const event = (o = {}) => ({
  id: 'e1', title: 'Leg day', kind: 'workout', start: at(20), notes: 'Heavy', workoutId: null, repeat: null, remindMinutes: 30,
  doneDates: [], skipDates: [], source: 'user', inviteId: null, host: null, updatedAt: '2026-10-01T00:00:00.000Z', ...o,
});
const workouts = [{ id: 'w1', name: 'Push Day' }, { id: 'w2', name: 'Pull Day' }];

let onSave;
let onClose;
let onOpenWorkout;
const open = (props = {}) => render(
  <CalendarEventSheet initialDate="2026-10-22" workouts={workouts} onSave={onSave} onClose={onClose} onOpenWorkout={onOpenWorkout} {...props} />
);
const selected = (utils, testID) => utils.getByTestId(testID).props.accessibilityState.selected;
const saved = () => onSave.mock.calls[onSave.mock.calls.length - 1][0];
const press = (utils, testID) => fireEvent.press(utils.getByTestId(testID));

beforeEach(() => {
  jest.useFakeTimers({ now: NOON, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  onSave = jest.fn(() => ({ ok: true }));
  onClose = jest.fn();
  onOpenWorkout = jest.fn();
});
afterEach(() => jest.useRealTimers());

describe('a new event', () => {
  it('starts as a workout on the day given, at 7:00 AM, with no repeat and a reminder at its time', () => {
    const utils = open();
    expect(utils.getByText('New event')).toBeTruthy();
    expect(utils.getByTestId('event-date-label').props.children).toBe('Thu, Oct 22');
    expect(utils.getByTestId('event-time-label').props.children).toBe('7:00 AM');
    expect(selected(utils, 'event-kind-workout')).toBe(true);
    expect(selected(utils, 'event-repeat-none')).toBe(true);
    expect(selected(utils, 'event-remind-0')).toBe(true);
    expect(utils.getByTestId('event-save')).toBeTruthy();
    expect(utils.getByText('Add')).toBeTruthy();
    expect(utils.queryByTestId('event-weekday-1')).toBeNull();
    expect(utils.queryByTestId('event-ends-4')).toBeNull();
  });

  it('starts on today when the day given is not a day', () => {
    expect(open({ initialDate: 'later' }).getByTestId('event-date-label').props.children).toBe('Mon, Oct 19');
  });

  it('hands the form to the screen on Add, and closes when it was accepted', () => {
    const utils = open();
    fireEvent.changeText(utils.getByTestId('event-title'), 'Lift');
    fireEvent.changeText(utils.getByTestId('event-notes'), 'Heavy');
    press(utils, 'event-save');
    expect(saved()).toEqual({ title: 'Lift', kind: 'workout', date: '2026-10-22', time: '07:00', notes: 'Heavy', workoutId: null, repeat: null, remindMinutes: 0 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open and says what the screen said was wrong, and forgets it once something is changed', () => {
    onSave.mockReturnValue({ ok: false, error: 'Give it a title.' });
    const utils = open();
    press(utils, 'event-save');
    expect(utils.getByTestId('event-error').props.children).toBe('Give it a title.');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.changeText(utils.getByTestId('event-title'), 'x');
    expect(utils.queryByTestId('event-error')).toBeNull();
  });

  it('closes without saving on Cancel', () => {
    const utils = open();
    press(utils, 'event-cancel');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('limits the title and the notes', () => {
    const utils = open();
    expect(utils.getByTestId('event-title').props.maxLength).toBe(80);
    expect(utils.getByTestId('event-notes').props.maxLength).toBe(500);
  });
});

describe('the day and the time', () => {
  it('moves the day by a day or a week, either way', () => {
    const utils = open();
    press(utils, 'event-date-next-day');
    expect(utils.getByTestId('event-date-label').props.children).toBe('Fri, Oct 23');
    press(utils, 'event-date-next-week');
    expect(utils.getByTestId('event-date-label').props.children).toBe('Fri, Oct 30');
    press(utils, 'event-date-prev-week');
    press(utils, 'event-date-prev-day');
    press(utils, 'event-date-prev-day');
    expect(utils.getByTestId('event-date-label').props.children).toBe('Wed, Oct 21');
    press(utils, 'event-save');
    expect(saved().date).toBe('2026-10-21');
  });

  it('moves the time by 15 minutes or an hour, round midnight', () => {
    const utils = open();
    press(utils, 'event-time-plus-15');
    expect(utils.getByTestId('event-time-label').props.children).toBe('7:15 AM');
    press(utils, 'event-time-plus-60');
    expect(utils.getByTestId('event-time-label').props.children).toBe('8:15 AM');
    press(utils, 'event-time-minus-60');
    press(utils, 'event-time-minus-60');
    press(utils, 'event-time-minus-60');
    press(utils, 'event-time-minus-60');
    press(utils, 'event-time-minus-60');
    press(utils, 'event-time-minus-60');
    press(utils, 'event-time-minus-60');
    press(utils, 'event-time-minus-60');
    expect(utils.getByTestId('event-time-label').props.children).toBe('12:15 AM');
    press(utils, 'event-time-minus-15');
    press(utils, 'event-time-minus-15');
    expect(utils.getByTestId('event-time-label').props.children).toBe('11:45 PM');
    press(utils, 'event-save');
    expect(saved().time).toBe('23:45');
  });
});

describe('the kind and the reminder', () => {
  it('has no reminder for a meal and a reminder at the time for anything else, until the person picks one', () => {
    const utils = open();
    press(utils, 'event-kind-nutrition');
    expect(selected(utils, 'event-remind-none')).toBe(true);
    press(utils, 'event-kind-run');
    expect(selected(utils, 'event-remind-0')).toBe(true);
    press(utils, 'event-kind-other');
    expect(selected(utils, 'event-remind-0')).toBe(true);
  });

  it('keeps a reminder the person picked when the kind changes', () => {
    const utils = open();
    press(utils, 'event-remind-60');
    press(utils, 'event-kind-nutrition');
    expect(selected(utils, 'event-remind-60')).toBe(true);
    press(utils, 'event-save');
    expect(saved()).toMatchObject({ kind: 'nutrition', remindMinutes: 60 });
  });

  it('offers every reminder time, and one is picked at a time', () => {
    const utils = open();
    ['none', '0', '10', '30', '60', '1440'].forEach((m) => expect(utils.getByTestId(`event-remind-${m}`)).toBeTruthy());
    press(utils, 'event-remind-10');
    expect(selected(utils, 'event-remind-10')).toBe(true);
    expect(selected(utils, 'event-remind-0')).toBe(false);
    press(utils, 'event-remind-none');
    press(utils, 'event-save');
    expect(saved().remindMinutes).toBeNull();
  });
});

describe('linking a workout', () => {
  it('lists the person\'s workouts for a workout only, and picking one names the event when it has no name yet', () => {
    const utils = open();
    expect(utils.getByTestId('event-workout-w1')).toBeTruthy();
    press(utils, 'event-workout-w1');
    expect(utils.getByTestId('event-title').props.value).toBe('Push Day');
    press(utils, 'event-save');
    expect(saved()).toMatchObject({ title: 'Push Day', workoutId: 'w1' });
    press(utils, 'event-kind-run');
    expect(utils.queryByTestId('event-workout-w1')).toBeNull();
  });

  it('keeps a name the person typed', () => {
    const utils = open();
    fireEvent.changeText(utils.getByTestId('event-title'), 'My own name');
    press(utils, 'event-workout-w2');
    expect(utils.getByTestId('event-title').props.value).toBe('My own name');
    expect(selected(utils, 'event-workout-w2')).toBe(true);
    press(utils, 'event-workout-none');
    expect(selected(utils, 'event-workout-none')).toBe(true);
    press(utils, 'event-save');
    expect(saved().workoutId).toBeNull();
  });

  it('drops the link when the kind is no longer a workout', () => {
    const utils = open();
    press(utils, 'event-workout-w1');
    press(utils, 'event-kind-run');
    press(utils, 'event-save');
    expect(saved().workoutId).toBeNull();
  });

  it('leaves the row out when there are no saved workouts, and lists at most 20', () => {
    expect(open({ workouts: [] }).queryByTestId('event-workout-none')).toBeNull();
    const many = Array.from({ length: 25 }, (_, i) => ({ id: `w${i}`, name: `Workout ${i}` }));
    const utils = open({ workouts: many });
    expect(utils.getByTestId('event-workout-w19')).toBeTruthy();
    expect(utils.queryByTestId('event-workout-w20')).toBeNull();
  });
});

describe('repeating', () => {
  it('repeats every day, optionally until a number of weeks from the first day', () => {
    const utils = open();
    press(utils, 'event-repeat-day');
    expect(selected(utils, 'event-repeat-day')).toBe(true);
    expect(selected(utils, 'event-ends-never')).toBe(true);
    press(utils, 'event-ends-8');
    press(utils, 'event-save');
    expect(saved().repeat).toEqual({ every: 'day', until: '2026-12-16' });
  });

  it('repeats on chosen weekdays, starting with the weekday of the first day', () => {
    const utils = open();
    press(utils, 'event-repeat-week');
    expect(selected(utils, 'event-weekday-4')).toBe(true); // Thursday
    expect(selected(utils, 'event-weekday-1')).toBe(false);
    press(utils, 'event-weekday-1');
    press(utils, 'event-weekday-6');
    press(utils, 'event-save');
    expect(saved().repeat).toEqual({ every: 'week', days: [1, 4, 6], until: null });
  });

  it('keeps at least one weekday', () => {
    const utils = open();
    press(utils, 'event-repeat-week');
    press(utils, 'event-weekday-4');
    expect(selected(utils, 'event-weekday-4')).toBe(true);
    press(utils, 'event-weekday-1');
    press(utils, 'event-weekday-4');
    press(utils, 'event-weekday-1');
    expect(selected(utils, 'event-weekday-1')).toBe(true);
  });

  it('keeps the end when the repeat changes between daily and weekly, and drops the repeat on Never', () => {
    const utils = open();
    press(utils, 'event-repeat-day');
    press(utils, 'event-ends-4');
    press(utils, 'event-repeat-week');
    expect(selected(utils, 'event-ends-4')).toBe(true);
    press(utils, 'event-repeat-none');
    expect(utils.queryByTestId('event-ends-4')).toBeNull();
    press(utils, 'event-save');
    expect(saved().repeat).toBeNull();
  });

  it('moves the end, and the weekday, with the first day when they were set from it', () => {
    const utils = open();
    press(utils, 'event-repeat-week');
    press(utils, 'event-ends-4');
    press(utils, 'event-date-next-day'); // Friday 23
    expect(selected(utils, 'event-weekday-5')).toBe(true);
    expect(selected(utils, 'event-weekday-4')).toBe(false);
    expect(selected(utils, 'event-ends-4')).toBe(true);
    press(utils, 'event-save');
    expect(saved().repeat).toEqual({ every: 'week', days: [5], until: '2026-11-19' });
  });

  it('shows an end that is none of the choices', () => {
    const utils = open({ event: event({ repeat: { every: 'day', until: '2026-12-25' } }) });
    expect(selected(utils, 'event-ends-custom')).toBe(true);
    expect(utils.getByText('Until Fri, Dec 25')).toBeTruthy();
    expect(selected(utils, 'event-ends-never')).toBe(false);
  });
});

describe('changing an event', () => {
  it('starts with what the event holds, and says Save', () => {
    const utils = open({ event: event({ workoutId: 'w1' }) });
    expect(utils.getByText('Edit event')).toBeTruthy();
    expect(utils.getByText('Save')).toBeTruthy();
    expect(utils.getByTestId('event-title').props.value).toBe('Leg day');
    expect(utils.getByTestId('event-notes').props.value).toBe('Heavy');
    expect(utils.getByTestId('event-date-label').props.children).toBe('Tue, Oct 20');
    expect(selected(utils, 'event-workout-w1')).toBe(true);
    expect(selected(utils, 'event-remind-30')).toBe(true);
  });

  it('keeps the reminder it has when the kind is changed', () => {
    const utils = open({ event: event({ remindMinutes: null }) });
    press(utils, 'event-kind-run');
    expect(selected(utils, 'event-remind-none')).toBe(true);
  });

  it('lets the day of a single event be changed, but not the first day of a repeat', () => {
    expect(open({ event: event() }).queryByTestId('event-date-next-day')).toBeTruthy();
    const utils = open({ event: event({ repeat: { every: 'week', days: [2], until: null } }) });
    expect(utils.queryByTestId('event-date-next-day')).toBeNull();
    expect(utils.queryByTestId('event-date-prev-week')).toBeNull();
    expect(utils.getByText('Starts')).toBeTruthy();
    expect(utils.getByTestId('event-date-label').props.children).toBe('Tue, Oct 20');
  });

  it('opens the linked workout', () => {
    const utils = open({ event: event({ workoutId: 'w2' }) });
    fireEvent.press(utils.getByText('Open Pull Day'));
    expect(onOpenWorkout).toHaveBeenCalledWith('w2');
  });

  it('has no button for a workout that was deleted, or when opening is not offered', () => {
    expect(open({ event: event({ workoutId: 'gone' }) }).queryByTestId('event-open-workout')).toBeNull();
    expect(open({ event: event({ workoutId: 'w1' }), onOpenWorkout: undefined }).queryByTestId('event-open-workout')).toBeNull();
  });
});
