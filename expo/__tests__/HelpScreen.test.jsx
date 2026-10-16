import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true } }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('../services/aiService', () => ({ chatAI: jest.fn() }));

import HelpScreen from '../app/profile/help';

const CATEGORIES = ['Getting Started', 'Workouts & Running', 'Nutrition & Health', 'Social & Gamification', 'Account & Settings', 'Troubleshooting'];
const search = (utils, text) => fireEvent.changeText(utils.getByPlaceholderText('Search frequently asked questions...'), text);

describe('Help & FAQ', () => {
  it('lists the questions by category', () => {
    const utils = render(<HelpScreen />);
    expect(utils.getByText('Getting Started')).toBeTruthy();
    expect(utils.getByText('Workouts & Running')).toBeTruthy();
    expect(utils.getByText('Nutrition & Health')).toBeTruthy();
  });

  it('answers "Can I create custom workouts?" with Quick Workout, not "coming soon"', () => {
    const utils = render(<HelpScreen />);
    fireEvent.press(utils.getByText('Can I create custom workouts?'));
    expect(utils.getByText(/tap 'Quick Workout'/)).toBeTruthy();
    expect(utils.queryByText(/coming soon/i)).toBeNull();
  });

  it('tells people to tap "Log Food" to log a meal, and does not name a food service the app does not use', () => {
    const utils = render(<HelpScreen />);
    fireEvent.press(utils.getByText('How do I log meals?'));
    expect(utils.getByText(/tap 'Log Food'/)).toBeTruthy();
    expect(utils.getByText(/search for foods, use the barcode scanner, or snap a photo/)).toBeTruthy();
  });

  it('points to the barcode icon on the screen that has it', () => {
    const utils = render(<HelpScreen />);
    fireEvent.press(utils.getByText('How does the barcode scanner work?'));
    expect(utils.getByText(/barcode icon on the Search Food screen/)).toBeTruthy();
  });

  it.each(['passio', 'coming soon', "'log meal'", 'log meal screen'])('has no question or answer that mentions %s', (word) => {
    const utils = render(<HelpScreen />);
    search(utils, word);
    CATEGORIES.forEach((name) => expect(utils.queryByText(name)).toBeNull());
  });

  it('finds the workout answer by searching for Quick Workout', () => {
    const utils = render(<HelpScreen />);
    search(utils, 'quick workout');
    expect(utils.getByText('Workouts & Running')).toBeTruthy();
    expect(utils.getByText('Can I create custom workouts?')).toBeTruthy();
  });
  it('does not promise an in-app data export that does not exist, and says how to get a copy', () => {
    const utils = render(<HelpScreen />);
    expect(utils.queryByText('How do I export my data?')).toBeNull();
    fireEvent.press(utils.getByText('How do I get a copy of my data?'));
    expect(utils.getByText(/no in-app export yet/)).toBeTruthy();
    expect(utils.getByText(/Before you delete your account/)).toBeTruthy();
    expect(utils.getByText(/privacy@zownhq\.com/)).toBeTruthy();
    expect(utils.queryByText(/CSV ZIP/)).toBeNull();
  });

  it('says what deleting an account really does: everything is erased and the sign-in removed', () => {
    const utils = render(<HelpScreen />);
    fireEvent.press(utils.getByText('How do I delete my account?'));
    expect(utils.getByText(/permanently erases your email, profile, workouts/)).toBeTruthy();
    expect(utils.getByText(/removes your sign-in/)).toBeTruthy();
    expect(utils.getByText(/log out and back in/)).toBeTruthy();
    expect(utils.queryByText(/not erased automatically/)).toBeNull();
  });
});

describe('Help & FAQ, AI Assistant tab', () => {
  // The banner at the top of this tab used a style object called `s`, which the file never defined, so opening the tab
  // threw "s is not defined" and took the screen down. ESLint's no-undef found it; this keeps it from coming back.
  it('opens, and its banner leads to the AI Coach screen', () => {
    const { router } = require('expo-router');
    const utils = render(<HelpScreen />);
    fireEvent.press(utils.getByText('AI Assistant'));
    expect(utils.getByText('Talk to your AI Coach')).toBeTruthy();
    expect(utils.getByText(/remembers your goals and history/)).toBeTruthy();
    fireEvent.press(utils.getByText('Talk to your AI Coach'));
    expect(router.push).toHaveBeenCalledWith('/coach');
  });

  it('goes back to the questions when FAQ is tapped again', () => {
    const utils = render(<HelpScreen />);
    fireEvent.press(utils.getByText('AI Assistant'));
    fireEvent.press(utils.getByText('FAQ'));
    expect(utils.getByText('Getting Started')).toBeTruthy();
    expect(utils.queryByText('Talk to your AI Coach')).toBeNull();
  });
});
