// The Notifications screen (the bell on the home screen) used to open on four notifications that were typed into the file
// ("Badge Earned", "Sarah started following you", ...) and were never sent to anyone. Nothing in the app puts notifications
// on this screen yet, so it says so.
import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => (name === '__esModule' ? false : name) }), { virtual: true });
jest.mock('@/components/ScreenHeader', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { __esModule: true, default: ({ title }) => mockReact.createElement(mockRn.Text, { testID: 'header-title' }, title) };
});

import NotificationsScreen from '../app/notifications';

describe('Notifications', () => {
  it('says there are none yet', () => {
    const utils = render(<NotificationsScreen />);
    expect(utils.getByTestId('header-title').props.children).toBe('Notifications');
    expect(utils.getByText('No notifications yet')).toBeTruthy();
  });

  it('shows none of the notifications that used to be typed in', () => {
    const utils = render(<NotificationsScreen />);
    for (const text of ['Badge Earned', 'New Follower', 'Hydration Reminder', 'Workout Reminder', /Sarah/, /7-Day Streak/, /push session/]) {
      expect(utils.queryByText(text)).toBeNull();
    }
  });
});
