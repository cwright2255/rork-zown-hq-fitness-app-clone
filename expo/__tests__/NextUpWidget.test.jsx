// Home > Next Up: the next workout or event on the calendar with its time, and a tap that opens the Calendar on that day.
// jest.global-setup.js pins the zone to America/New_York.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });

import { router } from 'expo-router';
import NextUpWidget from '../components/NextUpWidget';
import { useScheduleStore } from '../store/scheduleStore';
import { useCalendarInviteStore } from '../store/calendarInviteStore';

// Mon 19 Oct 2026, 8:00 AM in New York.
const NOW = new Date(2026, 9, 19, 8, 0);
const local = (y, m, d, h = 7, mi = 0) => new Date(y, m - 1, d, h, mi).toISOString();
const ev = (o = {}) => ({
  id: 'e1', title: 'Leg day', kind: 'workout', start: local(2026, 10, 19, 18, 30), notes: '', workoutId: null, repeat: null,
  remindMinutes: null, doneDates: [], skipDates: [], source: 'user', inviteId: null, host: null, updatedAt: '2026-10-01T00:00:00.000Z', ...o,
});
const setEvents = (events) => act(() => { useScheduleStore.setState({ events }); });

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  useScheduleStore.setState({ events: [] });
  useCalendarInviteStore.setState({ uid: null, invites: [] });
  router.push.mockClear();
});
afterEach(() => { jest.useRealTimers(); });

describe('Home > Next Up', () => {
  it('says nothing is planned, and opens the Calendar, when the calendar is empty', () => {
    const utils = render(<NextUpWidget />);
    expect(utils.getByText('Next Up')).toBeTruthy();
    expect(utils.getByTestId('home-nextup-title').props.children).toBe('Nothing planned');
    expect(utils.getByText('Open the calendar')).toBeTruthy();
    expect(utils.getByLabelText('Next up: nothing planned. Opens the calendar.')).toBeTruthy();
    fireEvent.press(utils.getByTestId('home-widget-nextup'));
    expect(router.push).toHaveBeenCalledWith('/calendar');
  });

  it('shows the next event with Today and its time', () => {
    useScheduleStore.setState({ events: [ev()] });
    const utils = render(<NextUpWidget />);
    expect(utils.getByTestId('home-nextup-title').props.children).toBe('Leg day');
    expect(utils.getByText('Today \u00B7 6:30 PM')).toBeTruthy();
    expect(utils.getByLabelText('Next up: Leg day, Today \u00B7 6:30 PM. Opens the calendar.')).toBeTruthy();
  });

  it('opens the Calendar on the day of that event', () => {
    useScheduleStore.setState({ events: [ev({ start: local(2026, 10, 22, 6, 0) })] });
    const utils = render(<NextUpWidget />);
    expect(utils.getByText('Thu, Oct 22 \u00B7 6:00 AM')).toBeTruthy();
    fireEvent.press(utils.getByTestId('home-widget-nextup'));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/calendar', params: { date: '2026-10-22' } });
  });

  it('is a button for a screen reader', () => {
    expect(render(<NextUpWidget />).getByTestId('home-widget-nextup').props.accessibilityRole).toBe('button');
  });

  it('shows an event the coach adds, as soon as it is on the calendar', () => {
    const utils = render(<NextUpWidget />);
    expect(utils.getByTestId('home-nextup-title').props.children).toBe('Nothing planned');
    setEvents([ev({ id: 'c1', title: 'Coach: tempo run', source: 'coach', start: local(2026, 10, 20, 6, 0) })]);
    expect(utils.getByTestId('home-nextup-title').props.children).toBe('Coach: tempo run');
    expect(utils.getByText('Tomorrow \u00B7 6:00 AM')).toBeTruthy();
  });

  it('moves on to the next one when the first has gone by, while the screen stays open', () => {
    useScheduleStore.setState({ events: [
      ev({ id: 'a', title: 'First', start: local(2026, 10, 19, 9, 0) }),
      ev({ id: 'b', title: 'Second', start: local(2026, 10, 19, 15, 0) }),
    ] });
    const utils = render(<NextUpWidget />);
    expect(utils.getByTestId('home-nextup-title').props.children).toBe('First');
    // 8:00 AM to 10:30 AM, a minute at a time as the screen checks the clock.
    act(() => { jest.setSystemTime(new Date(2026, 9, 19, 10, 30)); jest.advanceTimersByTime(60 * 1000); });
    expect(utils.getByTestId('home-nextup-title').props.children).toBe('Second');
    expect(utils.getByText('Today \u00B7 3:00 PM')).toBeTruthy();
  });

  it('goes back to nothing planned when the last event has gone by', () => {
    useScheduleStore.setState({ events: [ev({ start: local(2026, 10, 19, 9, 0) })] });
    const utils = render(<NextUpWidget />);
    expect(utils.getByTestId('home-nextup-title').props.children).toBe('Leg day');
    act(() => { jest.setSystemTime(new Date(2026, 9, 19, 12, 0)); jest.advanceTimersByTime(60 * 1000); });
    expect(utils.getByTestId('home-nextup-title').props.children).toBe('Nothing planned');
  });

  it('skips an event that is ticked off', () => {
    useScheduleStore.setState({ events: [
      ev({ id: 'a', title: 'Done', start: local(2026, 10, 19, 9, 0), doneDates: ['2026-10-19'] }),
      ev({ id: 'b', title: 'To do', start: local(2026, 10, 19, 17, 0) }),
    ] });
    expect(render(<NextUpWidget />).getByTestId('home-nextup-title').props.children).toBe('To do');
  });

  it('stops checking the clock when it leaves the screen', () => {
    const utils = render(<NextUpWidget />);
    expect(jest.getTimerCount()).toBe(1);
    utils.unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps a long title to two lines', () => {
    useScheduleStore.setState({ events: [ev({ title: 'Upper body strength with the long warm-up and the mobility finisher' })] });
    expect(render(<NextUpWidget />).getByTestId('home-nextup-title').props.numberOfLines).toBe(2);
  });
});

describe('Home > Next Up > invitations waiting', () => {
  const invite = (o = {}) => ({
    id: 'i1', fromUid: 'amy', toUid: 'me', fromName: 'Amy', toName: 'Cj', status: 'pending', eventId: 'x1', title: 'Park run', kind: 'run',
    start: local(2026, 10, 21, 7, 0), notes: '', repeat: null, createdAt: local(2026, 10, 19, 7, 0), respondedAt: null, ...o,
  });
  const setInvites = (invites, uid = 'me') => act(() => { useCalendarInviteStore.setState({ uid, invites }); });

  it('says nothing when none are waiting', () => {
    const utils = render(<NextUpWidget />);
    expect(utils.queryByTestId('home-nextup-invites')).toBeNull();
    expect(utils.getByLabelText('Next up: nothing planned. Opens the calendar.')).toBeTruthy();
  });

  it('says one invite is waiting, under the next event, and in what a screen reader hears', () => {
    useScheduleStore.setState({ events: [ev()] });
    setInvites([invite()]);
    const utils = render(<NextUpWidget />);
    expect(utils.getByTestId('home-nextup-invites').props.children).toBe('1 invite waiting');
    expect(utils.getByTestId('home-nextup-title').props.children).toBe('Leg day');
    expect(utils.getByLabelText('Next up: Leg day, Today \u00B7 6:30 PM. 1 invite waiting. Opens the calendar.')).toBeTruthy();
  });

  it('says how many when there are several, also with nothing else planned', () => {
    setInvites([invite(), invite({ id: 'i2', title: 'Lift' }), invite({ id: 'i3', title: 'Swim' })]);
    const utils = render(<NextUpWidget />);
    expect(utils.getByTestId('home-nextup-invites').props.children).toBe('3 invites waiting');
    expect(utils.getByLabelText('Next up: nothing planned. 3 invites waiting. Opens the calendar.')).toBeTruthy();
  });

  it('does not count ones sent by the person, answered ones, ones for somebody else, or ones for events that are over', () => {
    setInvites([
      invite({ id: 'a', fromUid: 'me', toUid: 'amy' }),
      invite({ id: 'b', status: 'accepted' }),
      invite({ id: 'c', status: 'declined' }),
      invite({ id: 'd', status: 'cancelled' }),
      invite({ id: 'e', toUid: 'bo' }),
      invite({ id: 'f', start: local(2026, 10, 18, 7, 0) }),
    ]);
    expect(render(<NextUpWidget />).queryByTestId('home-nextup-invites')).toBeNull();
  });

  it('says nothing when nobody is signed in to the invites', () => {
    setInvites([invite()], null);
    expect(render(<NextUpWidget />).queryByTestId('home-nextup-invites')).toBeNull();
  });

  it('follows the invites as they arrive and are answered', () => {
    const utils = render(<NextUpWidget />);
    expect(utils.queryByTestId('home-nextup-invites')).toBeNull();
    setInvites([invite()]);
    expect(utils.getByTestId('home-nextup-invites').props.children).toBe('1 invite waiting');
    setInvites([invite({ status: 'accepted' })]);
    expect(utils.queryByTestId('home-nextup-invites')).toBeNull();
  });

  it('drops one once its event is over, while the screen stays open', () => {
    setInvites([invite({ start: local(2026, 10, 19, 9, 0) })]);
    const utils = render(<NextUpWidget />);
    expect(utils.getByTestId('home-nextup-invites')).toBeTruthy();
    act(() => { jest.setSystemTime(new Date(2026, 9, 19, 10, 30)); jest.advanceTimersByTime(60 * 1000); });
    expect(utils.queryByTestId('home-nextup-invites')).toBeNull();
  });

  it('still opens the Calendar the same way', () => {
    setInvites([invite()]);
    const utils = render(<NextUpWidget />);
    fireEvent.press(utils.getByTestId('home-widget-nextup'));
    expect(router.push).toHaveBeenCalledWith('/calendar');
  });
});
