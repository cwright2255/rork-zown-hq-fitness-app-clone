// The "Invite someone" sheet (components/InviteFriendSheet.jsx): the people the person follows, an Invite button for each, and what
// shows once somebody has been asked.
// jest.global-setup.js pins the time zone to America/New_York.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }), { virtual: true });
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }), { virtual: true });
jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('@/store/userStore', () => ({ useUserStore: (sel) => sel({ user: global.__user }) }));

import { router } from 'expo-router';
import InviteFriendSheet from '../components/InviteFriendSheet';
import { useCalendarInviteStore } from '../store/calendarInviteStore';
import { useSocialGraphStore } from '../store/socialGraphStore';

// Tue 20 Oct 2026, 10:00 AM in New Jersey
const NOW = new Date(2026, 9, 20, 10, 0);
const at = (d, h, m = 0) => new Date(2026, 9, d, h, m).toISOString();
const EVENT = {
  id: 'evt-1', title: 'Leg day', kind: 'workout', start: at(22, 7), notes: '', workoutId: null, repeat: null,
  remindMinutes: 0, doneDates: [], skipDates: [], source: 'user',
};
const PEOPLE = [
  { uid: 'zed', name: 'Zed', close: false },
  { uid: 'amy', name: 'Amy', close: false },
  { uid: 'cat', name: 'Cat', close: true },
  { uid: 'bo', name: 'Bo', close: true },
];
const sentInvite = (over = {}) => ({
  id: 'i1', fromUid: 'me', toUid: 'amy', fromName: 'Cj', toName: 'Amy', status: 'pending', eventId: 'evt-1', title: 'Leg day',
  kind: 'workout', start: at(22, 7), notes: '', repeat: null, createdAt: at(20, 9), respondedAt: null, ...over,
});
const settle = () => act(async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); });

let sendInvite;
let loadFollowing;
let onClose;
const show = ({ following = PEOPLE, isLoaded = true, isLoading = false, invites = [], event = EVENT } = {}) => {
  act(() => {
    useSocialGraphStore.setState({ following, isLoaded, isLoading, loadFollowing });
    useCalendarInviteStore.setState({ invites, sendInvite });
  });
  return render(<InviteFriendSheet event={event} onClose={onClose} />);
};

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  global.__user = { uid: 'me', name: 'Cj' };
  sendInvite = jest.fn(async () => ({ ok: true, id: 'new1' }));
  loadFollowing = jest.fn(async () => undefined);
  onClose = jest.fn();
  router.push.mockClear();
});
afterEach(() => { jest.useRealTimers(); });

describe('what is shown', () => {
  it('names the event and when it is, and says what the person invited gets', () => {
    const utils = show();
    expect(utils.getByText('Invite someone to Leg day')).toBeTruthy();
    expect(utils.getByText('Thu, Oct 22 at 7:00 AM')).toBeTruthy();
    expect(utils.getByText(/They get a copy of this event to accept or decline/)).toBeTruthy();
  });

  it('says how often a repeating event repeats', () => {
    const utils = show({ event: { ...EVENT, repeat: { every: 'week', days: [2, 4], until: null } } });
    expect(utils.getByText('Thu, Oct 22 at 7:00 AM. Every week on Tue, Thu')).toBeTruthy();
  });

  it('lists the people followed, close friends first and then by name', () => {
    const utils = show();
    const order = utils.getAllByTestId(/^invite-person-/).map((n) => n.props.testID);
    expect(order).toEqual(['invite-person-bo', 'invite-person-cat', 'invite-person-amy', 'invite-person-zed']);
    expect(utils.getAllByText('Close friend')).toHaveLength(2);
  });

  it('gives each person an Invite button a screen reader can tell apart', () => {
    const utils = show();
    expect(utils.getByLabelText('Invite Amy')).toBeTruthy();
    expect(utils.getByLabelText('Invite Zed')).toBeTruthy();
    expect(utils.getAllByText('Invite')).toHaveLength(4);
  });

  it('is open with a Done button that closes it', () => {
    const utils = show();
    fireEvent.press(utils.getByTestId('invite-done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('loading the people followed', () => {
  it('asks for them when they have not been loaded', () => {
    show({ following: [], isLoaded: false });
    expect(loadFollowing).toHaveBeenCalledTimes(1);
    expect(loadFollowing).toHaveBeenCalledWith('me');
  });

  it('does not ask again when they are already there', () => {
    show();
    expect(loadFollowing).not.toHaveBeenCalled();
  });

  it('does not ask when nobody is signed in', () => {
    global.__user = null;
    show({ following: [], isLoaded: false });
    expect(loadFollowing).not.toHaveBeenCalled();
  });

  it('asks once the person is signed in, when they were not at first', () => {
    global.__user = null;
    const utils = show({ following: [], isLoaded: false });
    expect(loadFollowing).not.toHaveBeenCalled();
    global.__user = { uid: 'me', name: 'Cj' };
    utils.rerender(<InviteFriendSheet event={EVENT} onClose={onClose} />);
    expect(loadFollowing).toHaveBeenCalledTimes(1);
    expect(loadFollowing).toHaveBeenCalledWith('me');
  });

  it('shows a spinner, not the empty message, while it loads', () => {
    const utils = show({ following: [], isLoaded: false, isLoading: true });
    expect(utils.queryByTestId('invite-empty')).toBeNull();
    expect(utils.UNSAFE_queryAllByType(require('react-native').ActivityIndicator)).toHaveLength(1);
  });

  it('says so, and points to Find friends, when the person follows nobody', () => {
    const utils = show({ following: [] });
    expect(utils.getByTestId('invite-empty')).toBeTruthy();
    expect(utils.getByText(/You are not following anyone yet/)).toBeTruthy();
    fireEvent.press(utils.getByTestId('invite-find-friends'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/friends');
  });

  it('does not show the empty message when there are people', () => {
    expect(show().queryByTestId('invite-empty')).toBeNull();
  });
});

describe('sending an invite', () => {
  it('sends the event, who it is from and who it is to, then shows Waiting in place of the button', async () => {
    const utils = show();
    fireEvent.press(utils.getByTestId('invite-send-amy'));
    await settle();
    expect(sendInvite).toHaveBeenCalledTimes(1);
    expect(sendInvite).toHaveBeenCalledWith({ event: EVENT, from: { uid: 'me', name: 'Cj' }, to: { uid: 'amy', name: 'Amy' } });
    expect(utils.getByTestId('invite-status-amy').props.children).toBe('Waiting');
    expect(utils.queryByTestId('invite-send-amy')).toBeNull();
    expect(utils.getByTestId('invite-send-zed')).toBeTruthy();
    expect(utils.queryByTestId('invite-error')).toBeNull();
  });

  it('shows Sending... while it works, and only lets one go at a time', async () => {
    let finish;
    sendInvite.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const utils = show();
    fireEvent.press(utils.getByTestId('invite-send-amy'));
    fireEvent.press(utils.getByTestId('invite-send-amy'));
    fireEvent.press(utils.getByTestId('invite-send-zed'));
    expect(sendInvite).toHaveBeenCalledTimes(1);
    expect(utils.getByText('Sending...')).toBeTruthy();
    expect(utils.getByTestId('invite-send-zed').props.accessibilityState.disabled).toBe(true);
    await act(async () => { finish({ ok: true, id: 'new1' }); });
    expect(utils.queryByText('Sending...')).toBeNull();
    expect(utils.getByTestId('invite-send-zed').props.accessibilityState.disabled).toBe(false);
  });

  it('says what went wrong, keeps the button, and clears the message on the next try', async () => {
    sendInvite.mockResolvedValueOnce({ ok: false, error: 'That did not go through. Check your connection and try again.' });
    const utils = show();
    fireEvent.press(utils.getByTestId('invite-send-amy'));
    await settle();
    expect(utils.getByTestId('invite-error').props.children).toBe('That did not go through. Check your connection and try again.');
    expect(utils.getByTestId('invite-send-amy')).toBeTruthy();
    expect(utils.queryByTestId('invite-status-amy')).toBeNull();
    fireEvent.press(utils.getByTestId('invite-send-amy'));
    await settle();
    expect(utils.queryByTestId('invite-error')).toBeNull();
    expect(utils.getByTestId('invite-status-amy')).toBeTruthy();
  });

  it('gives a plain message when the store gives no reason', async () => {
    sendInvite.mockResolvedValueOnce({ ok: false });
    const utils = show();
    fireEvent.press(utils.getByTestId('invite-send-amy'));
    await settle();
    expect(utils.getByTestId('invite-error').props.children).toBe('That did not go through.');
  });

  it('says so, and lets the person try again, when the send itself fails', async () => {
    sendInvite.mockRejectedValueOnce(new Error('boom'));
    const utils = show();
    fireEvent.press(utils.getByTestId('invite-send-amy'));
    await settle();
    expect(utils.getByTestId('invite-error').props.children).toBe('That did not go through.');
    expect(utils.queryByText('Sending...')).toBeNull();
    expect(utils.getByTestId('invite-send-amy').props.accessibilityState.disabled).toBe(false);
  });
});

describe('people who were already asked', () => {
  it('shows Waiting for one who has not answered, with no button', () => {
    const utils = show({ invites: [sentInvite()] });
    expect(utils.getByTestId('invite-status-amy').props.children).toBe('Waiting');
    expect(utils.queryByTestId('invite-send-amy')).toBeNull();
    expect(utils.getByTestId('invite-send-zed')).toBeTruthy();
  });

  it('shows Going for one who accepted', () => {
    const utils = show({ invites: [sentInvite({ status: 'accepted' })] });
    expect(utils.getByTestId('invite-status-amy').props.children).toBe('Going');
    expect(utils.queryByTestId('invite-send-amy')).toBeNull();
  });

  it('lets the person ask again after a decline, or a cancel', () => {
    const utils = show({ invites: [sentInvite({ status: 'declined' }), sentInvite({ id: 'i2', toUid: 'zed', toName: 'Zed', status: 'cancelled' })] });
    expect(utils.getByTestId('invite-send-amy')).toBeTruthy();
    expect(utils.getByTestId('invite-send-zed')).toBeTruthy();
    expect(utils.queryByTestId('invite-status-amy')).toBeNull();
  });

  it('ignores invites for other events and invites other people sent', () => {
    const utils = show({ invites: [sentInvite({ eventId: 'evt-9' }), sentInvite({ id: 'i3', fromUid: 'cat', toUid: 'amy' })] });
    expect(utils.getByTestId('invite-send-amy')).toBeTruthy();
  });
});

describe('an event that cannot be shared', () => {
  it('says so and turns every Invite button off when the event is over', () => {
    const utils = show({ event: { ...EVENT, start: at(10, 7) } });
    expect(utils.getByTestId('invite-blocked').props.children).toBe('That event is already over.');
    const button = utils.getByTestId('invite-send-amy');
    expect(button.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(button);
    expect(sendInvite).not.toHaveBeenCalled();
  });

  it('shows no such message for an event that can be shared', () => {
    expect(show().queryByTestId('invite-blocked')).toBeNull();
  });
});
