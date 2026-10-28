// The Invite your friends screen (app/invite.jsx): the person's own code and how their invites are going, a share sheet with the App Store link
// and the code, and a box for a friend's code. The server's answers (services/inviteService.js) are stood in for; the screen and its words
// (lib/invite.js) are the real ones.
import React from 'react';
import { Share } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@/components/ScreenHeader', () => ({ __esModule: true, default: ({ title }) => { const { Text: T } = require('react-native'); return <T>{title}</T>; } }));
jest.mock('@/components/PrimaryButton', () => ({
  __esModule: true,
  default: ({ title, onPress, disabled, loading }) => {
    const { Pressable: P, Text: T } = require('react-native');
    return <P accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: !!(disabled || loading) }} onPress={disabled || loading ? undefined : onPress}><T>{title}</T></P>;
  },
}));
jest.mock('expo-router', () => {
  const push = jest.fn();
  const router = { push };
  return { useRouter: () => router, router };
}, { virtual: true });
jest.mock('@/services/inviteService', () => ({ fetchInviteStatus: jest.fn(), redeemInviteCode: jest.fn() }));

import { router } from 'expo-router';
import InviteScreen from '../app/invite';
import { fetchInviteStatus, redeemInviteCode } from '@/services/inviteService';
import { APP_STORE_LINK } from '../lib/invite';

const rules = { friendDays: 7, inviterDays: 7, maxRewardedInvites: 5, accountWindowDays: 14 };
const status = (over = {}) => ({
  code: 'K7P2QX4M', display: 'K7P2-QX4M', joined: 0, rewarded: 0, daysEarned: 0, redeemed: false, friendDaysGiven: 0, rules, ...over,
});

const flush = async () => { for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); }); };
const show = async () => {
  const utils = render(<InviteScreen />);
  await flush();
  return utils;
};
const type = (utils, text) => fireEvent.changeText(utils.getByTestId('invite-code-input'), text);
const press = async (utils, label) => {
  await act(async () => { fireEvent.press(utils.getByLabelText(label)); });
  await flush();
};

let shareSpy;
beforeEach(() => {
  jest.clearAllMocks();
  fetchInviteStatus.mockResolvedValue(status());
  redeemInviteCode.mockResolvedValue({ ok: true, friendDays: 7, inviterDays: 7 });
  shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
});
afterEach(() => { jest.restoreAllMocks(); });

describe('the person\'s own code', () => {
  it('is shown, with what a friend gets and the limits, in the numbers the server gave', async () => {
    const utils = await show();
    expect(utils.getByText('Invite your friends')).toBeTruthy();
    expect(utils.getByTestId('invite-code').props.children).toBe('K7P2-QX4M');
    expect(utils.getByText(
      'When a friend joins with your code, you both get 7 days of Pro free. It works for up to 5 friends, and for accounts made in the last 14 days.',
    )).toBeTruthy();
  });

  it('says how many friends joined and how many Pro days that earned', async () => {
    fetchInviteStatus.mockResolvedValue(status({ joined: 2, rewarded: 2, daysEarned: 14 }));
    const utils = await show();
    expect(utils.getByText('2')).toBeTruthy();
    expect(utils.getByText('Friends joined')).toBeTruthy();
    expect(utils.getByText('14')).toBeTruthy();
    expect(utils.getByText('Pro days earned')).toBeTruthy();
  });

  it('counts one friend in the singular', async () => {
    fetchInviteStatus.mockResolvedValue(status({ joined: 1, rewarded: 1, daysEarned: 7 }));
    expect((await show()).getByText('Friend joined')).toBeTruthy();
  });

  it('is made by asking the server once when the screen opens', async () => {
    await show();
    expect(fetchInviteStatus).toHaveBeenCalledTimes(1);
  });

  it('says so, and still offers the share sheet, once the code has paid for all the friends it can', async () => {
    fetchInviteStatus.mockResolvedValue(status({ joined: 5, rewarded: 5, daysEarned: 35 }));
    const utils = await show();
    expect(utils.getByText(/has paid out for all the friends it can/)).toBeTruthy();
    await press(utils, 'Share invite');
    expect(shareSpy).toHaveBeenCalledWith({ message: `Train with me on ZOWN HQ: ${APP_STORE_LINK}` });
  });

  it('shows no promise of a free exercise, which nothing ever gave', async () => {
    const utils = await show();
    expect(JSON.stringify(utils.toJSON())).not.toMatch(/free exercise/i);
  });
});

describe('sharing', () => {
  it('opens the share sheet with the App Store link and the code', async () => {
    const utils = await show();
    await press(utils, 'Share invite');
    expect(shareSpy).toHaveBeenCalledTimes(1);
    const { message } = shareSpy.mock.calls[0][0];
    expect(message).toContain(APP_STORE_LINK);
    expect(message).toContain('K7P2-QX4M');
    expect(message).toContain('We both get 7 days of Pro free.');
  });

  it('does not break when the share sheet cannot open', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    shareSpy.mockRejectedValue(new Error('no sheet'));
    const utils = await show();
    await press(utils, 'Share invite');
    expect(utils.getByTestId('invite-code').props.children).toBe('K7P2-QX4M');
  });
});

describe('when the code cannot be loaded', () => {
  it('says so and offers to try again, with no code and no share button to send a message without one', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    fetchInviteStatus.mockRejectedValueOnce(new Error('unavailable'));
    const utils = await show();
    expect(utils.getByText("Couldn't load your invite code. Check your connection and try again.")).toBeTruthy();
    expect(utils.queryByTestId('invite-code')).toBeNull();
    expect(utils.queryByLabelText('Share invite')).toBeNull();
    expect(utils.queryByTestId('invite-code-input')).toBeNull();
    await press(utils, 'Try again');
    expect(fetchInviteStatus).toHaveBeenCalledTimes(2);
    expect(utils.getByTestId('invite-code').props.children).toBe('K7P2-QX4M');
    expect(utils.queryByText(/Couldn't load/)).toBeNull();
  });

  it('treats an answer that is not a status the same way', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    fetchInviteStatus.mockResolvedValueOnce(null);
    expect((await show()).getByText(/Couldn't load your invite code/)).toBeTruthy();
  });
});

describe('a friend\'s code', () => {
  it('is typed with capitals and a dash, and Use code waits for all eight letters', async () => {
    const utils = await show();
    type(utils, 'k7p2');
    expect(utils.getByTestId('invite-code-input').props.value).toBe('K7P2');
    expect(utils.getByLabelText('Use code').props.accessibilityState.disabled).toBe(true);
    type(utils, 'k7p2qx4');
    expect(utils.getByTestId('invite-code-input').props.value).toBe('K7P2-QX4');
    expect(utils.getByLabelText('Use code').props.accessibilityState.disabled).toBe(true);
    type(utils, 'k7p2qx4m');
    expect(utils.getByTestId('invite-code-input').props.value).toBe('K7P2-QX4M');
    expect(utils.getByLabelText('Use code').props.accessibilityState.disabled).toBe(false);
  });

  it('is sent to the server as typed, and the person is told the days they got', async () => {
    const utils = await show();
    type(utils, 'h3wz9n5r');
    await press(utils, 'Use code');
    expect(redeemInviteCode).toHaveBeenCalledWith('H3WZ-9N5R');
    expect(utils.getByTestId('invite-result').props.children).toBe("You're in! You now have 7 days of Pro. Your friend got days too.");
    expect(utils.getByTestId('invite-code-input').props.value).toBe('');
  });

  it('brings the status up to date after it works, and shows the person has joined instead of the box', async () => {
    fetchInviteStatus
      .mockResolvedValueOnce(status())
      .mockResolvedValueOnce(status({ redeemed: true, friendDaysGiven: 7 }));
    const utils = await show();
    type(utils, 'h3wz9n5r');
    await press(utils, 'Use code');
    expect(fetchInviteStatus).toHaveBeenCalledTimes(2);
    expect(utils.queryByTestId('invite-code-input')).toBeNull();
    expect(utils.getByText("You joined with a friend's code and got 7 days of Pro.")).toBeTruthy();
    expect(utils.getByTestId('invite-result').props.children).toMatch(/You're in!/);
  });

  it('shows no box to a person who already joined with one, and says so without days if they got none', async () => {
    fetchInviteStatus.mockResolvedValue(status({ redeemed: true, friendDaysGiven: 0 }));
    const utils = await show();
    expect(utils.queryByTestId('invite-code-input')).toBeNull();
    expect(utils.getByText("You joined with a friend's code.")).toBeTruthy();
  });

  it.each([
    ['invalid-code', "That code isn't right. Check it and try again."],
    ['own-code', "That's your own code. Send it to a friend instead."],
    ['already-redeemed', "You've already joined with a friend's code."],
    ['too-old', 'Codes only work for accounts made in the last 14 days.'],
    ['code-full', 'That code has already reached its limit of 5 friends.'],
    ['too-many-tries', "Too many codes that didn't work. If you think this is a mistake, contact support."],
  ])('says what is wrong when the server turns a code away (%s), and keeps what was typed', async (reason, text) => {
    redeemInviteCode.mockResolvedValue({ ok: false, reason });
    const utils = await show();
    type(utils, 'h3wz9n5r');
    await press(utils, 'Use code');
    expect(utils.getByTestId('invite-result').props.children).toBe(text);
    expect(utils.getByTestId('invite-code-input').props.value).toBe('H3WZ-9N5R');
    expect(fetchInviteStatus).toHaveBeenCalledTimes(1);
  });

  it('says the server could not be reached when the request fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    redeemInviteCode.mockRejectedValue(new Error('offline'));
    const utils = await show();
    type(utils, 'h3wz9n5r');
    await press(utils, 'Use code');
    expect(utils.getByTestId('invite-result').props.children).toBe("Couldn't reach the server. Check your connection and try again.");
  });

  it('clears the last answer when the person starts typing again', async () => {
    redeemInviteCode.mockResolvedValue({ ok: false, reason: 'invalid-code' });
    const utils = await show();
    type(utils, 'h3wz9n5r');
    await press(utils, 'Use code');
    expect(utils.queryByTestId('invite-result')).toBeTruthy();
    type(utils, 'h3wz9n5');
    expect(utils.queryByTestId('invite-result')).toBeNull();
  });

  it('is sent once when pressed twice before the answer comes', async () => {
    let answer;
    redeemInviteCode.mockImplementation(() => new Promise((resolve) => { answer = resolve; }));
    const utils = await show();
    type(utils, 'h3wz9n5r');
    await act(async () => { fireEvent.press(utils.getByLabelText('Use code')); });
    await act(async () => { fireEvent.press(utils.getByLabelText('Use code')); });
    expect(redeemInviteCode).toHaveBeenCalledTimes(1);
    await act(async () => { answer({ ok: false, reason: 'invalid-code' }); });
    await flush();
    expect(utils.getByTestId('invite-result')).toBeTruthy();
  });

  it('does not ask the server about a code that is not all there', async () => {
    const utils = await show();
    type(utils, 'h3wz9');
    await act(async () => { fireEvent.press(utils.getByLabelText('Use code')); });
    expect(redeemInviteCode).not.toHaveBeenCalled();
  });
});

describe('the Community', () => {
  it('is one tap away, because the Home banner that used to open it now opens this screen', async () => {
    const utils = await show();
    await press(utils, 'Open the Community');
    expect(router.push).toHaveBeenCalledWith('/community');
  });

  it('is there even when the invite code could not be loaded', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    fetchInviteStatus.mockRejectedValue(new Error('unavailable'));
    const utils = await show();
    await press(utils, 'Open the Community');
    expect(router.push).toHaveBeenCalledWith('/community');
  });
});
