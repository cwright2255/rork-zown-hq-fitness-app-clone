import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) } }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });

import PrivacyPolicy from '../app/profile/privacy-policy';
import TermsOfService from '../app/profile/terms';

const { router } = require('expo-router');

// All the words on a screen, in order.
const textOf = (node) => {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textOf).join('');
  return textOf(node.children);
};
const policy = () => textOf(render(<PrivacyPolicy />).toJSON());
const terms = () => textOf(render(<TermsOfService />).toJSON());

// Every outside service the app really talks to (see the services/ folder and the
// Cloud Functions). If one is added, the policy has to name it.
const SERVICES = ['Firebase', 'Crashlytics', 'OpenAI', 'Radar', 'Google Places', 'TrailAPI', 'OpenStreetMap', 'National Weather Service',
  'CalorieAPI', 'Spoonacular', 'Spotify', 'Apple Music', 'Apple Health', 'ROOK'];

describe('Privacy Policy', () => {
  it('is dated and shows the contact addresses', () => {
    const text = policy();
    expect(text).toContain('Last updated: October 2026');
    expect(text).toContain('privacy@zownhq.com');
    expect(text).toContain('support@zownhq.com');
  });

  it.each(SERVICES)('names %s', (service) => {
    expect(policy()).toContain(service);
  });

  it('says what is sent to OpenStreetMap: the trail\'s point, not the person\'s own location', () => {
    const text = policy();
    expect(text).toContain('OpenStreetMap (Overpass)');
    expect(text).toMatch(/the map point of a trail you open, to find its marked paths\. Not your own location\./);
  });

  it('does not name services the app no longer uses', () => {
    const text = policy();
    for (const gone of ['Passio', 'Open Food Facts', 'ExerciseDB', 'Meshy']) expect(text).not.toContain(gone);
  });

  it('says deleting an account erases the data and the sign-in, and names what stays outside our servers', () => {
    const text = policy();
    expect(text).toMatch(/Deleting it permanently erases your email address, profile, workouts/);
    expect(text).toMatch(/and then removes your sign-in/);
    expect(text).toMatch(/removed for them too/);
    expect(text).toMatch(/cannot be undone/);
    // what it cannot reach
    expect(text).toMatch(/Firebase keeps crash reports for a limited time/);
    expect(text).toMatch(/OpenAI may keep AI requests/);
    expect(text).toMatch(/Spotify, Apple Music, Apple Health or ROOK/);
  });

  it('does not make promises it cannot keep about deletion', () => {
    const text = policy();
    expect(text).not.toMatch(/30 days/);
    expect(text).not.toMatch(/[Ii]nstantly/);
    expect(text).not.toMatch(/expunged/);
    expect(text).not.toMatch(/not erased automatically/);
  });

  it('does not claim a data export or legal compliance the app does not have', () => {
    const text = policy();
    expect(text).not.toMatch(/GDPR|CCPA/);
    expect(text).not.toMatch(/Export/);
    expect(text).toMatch(/get a copy of your data before you delete it, email privacy@zownhq\.com/);
  });

  it('says photos are kept on the phone or not stored: body-scan photos and meal photos', () => {
    const text = policy();
    expect(text).toMatch(/Body-scan photos are analyzed on your device/);
    expect(text).toMatch(/not the photos/);
    expect(text).toMatch(/do not store meal photos/);
  });

  it('says what other people can see, and that the leaderboard can be hidden', () => {
    const text = policy();
    expect(text).toMatch(/Show in Leaderboards/);
    expect(text).toMatch(/private to your account/);
  });

  it('says what the virtual race boards show, that it is only a rough area, and that hiding removes it', () => {
    const text = policy();
    expect(text).toMatch(/virtual race results on the race boards: your name, avatar, finishing time and, for the Local 5K, the rough map square where you started/);
    expect(text).toMatch(/rough map square \(about 7 miles across\) for where your run started, and the squares around where you are when you look at its board; never your exact position/);
    expect(text).toMatch(/Turning off Show in Leaderboards takes them off the boards/);
  });

  it('says virtual journey progress, and the calendar, are private to the person', () => {
    expect(policy()).toMatch(/Your workouts, body metrics, nutrition logs, calendar and virtual journey progress are private to your account/);
  });

  it('says what is kept in the calendar, that it is saved to the account, and that deleting the account erases it', () => {
    const text = policy();
    expect(text).toMatch(/Calendar: the events you schedule \(title, day and time, notes, how often it repeats, and when to remind you\)/);
    expect(text).toMatch(/the workouts and meals the AI coach adds to it after you say yes/);
    expect(text).toMatch(/saved to your account so a new phone gets them back/);
    expect(text).toMatch(/workouts, nutrition, calendar and body-scan records/);
  });

  it('says deleting an account erases the virtual race times too', () => {
    expect(policy()).toMatch(/challenge entries, virtual race times, uploaded photos and videos/);
  });

  it('says it does not sell personal information', () => {
    expect(policy()).toMatch(/do not sell your personal information/);
  });

  it('numbers its sections 1, 2, 3 ... with none missing', () => {
    const numbers = [...policy().matchAll(/(?:^|[a-z.)])(\d{1,2})\. (?=[A-Z])/g)].map((m) => Number(m[1]));
    const headings = numbers.filter((n, i) => n === i + 1);
    expect(headings.length).toBeGreaterThanOrEqual(12);
  });

  it('goes back, or home when there is nothing to go back to', () => {
    router.back.mockClear(); router.replace.mockClear();
    const utils = render(<PrivacyPolicy />);
    fireEvent.press(utils.UNSAFE_getByProps({ name: 'arrow-back' }));
    expect(router.back).toHaveBeenCalledTimes(1);
    router.canGoBack.mockReturnValueOnce(false);
    fireEvent.press(utils.UNSAFE_getByProps({ name: 'arrow-back' }));
    expect(router.replace).toHaveBeenCalledWith('/profile');
  });
});

describe('Terms of Service', () => {
  it('lists virtual races among the social features', () => {
    expect(terms()).toMatch(/social features such as leaderboards, challenges, virtual races, groups and messaging/);
  });

  it('is dated and shows the contact address', () => {
    const text = terms();
    expect(text).toContain('Last updated: October 2026');
    expect(text).toContain('support@zownhq.com');
  });

  it('is governed by the laws of the State of New Jersey', () => {
    const text = terms();
    expect(text).toContain('12. Governing Law');
    expect(text).toContain('governed by the laws of the State of New Jersey.');
    expect(text).not.toContain('laws of the United States');
  });

  it('does not name services the app no longer uses', () => {
    const text = terms();
    for (const gone of ['Passio', 'Open Food Facts', 'ExerciseDB', 'Meshy']) expect(text).not.toContain(gone);
  });

  it('names the main outside services', () => {
    const text = terms();
    for (const service of ['Firebase', 'OpenAI', 'Spotify', 'Apple Music', 'Apple Health', 'ROOK', 'Radar', 'Google Places', 'TrailAPI', 'OpenStreetMap', 'CalorieAPI', 'Spoonacular']) {
      expect(text).toContain(service);
    }
  });

  it('warns that AI-generated plans can be wrong and that the app is not medical advice', () => {
    const text = terms();
    expect(text).toMatch(/NOT A MEDICAL DEVICE/);
    expect(text).toMatch(/generated by AI can be inaccurate/);
  });

  it('says it is an alpha, and points to the Privacy Policy and deleting an account', () => {
    const text = terms();
    expect(text).toMatch(/early \(alpha\) release/);
    expect(text).toMatch(/Privacy Policy/);
    expect(text).toMatch(/delete your account in Settings/);
  });

  it('goes back, or home when there is nothing to go back to', () => {
    router.back.mockClear(); router.replace.mockClear();
    const utils = render(<TermsOfService />);
    fireEvent.press(utils.UNSAFE_getByProps({ name: 'arrow-back' }));
    expect(router.back).toHaveBeenCalledTimes(1);
    router.canGoBack.mockReturnValueOnce(false);
    fireEvent.press(utils.UNSAFE_getByProps({ name: 'arrow-back' }));
    expect(router.replace).toHaveBeenCalledWith('/profile');
  });
});
