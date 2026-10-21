// The "What your Coach remembers" screen (app/profile/coach-memory.jsx): the list as it is saved, removing a note, forgetting everything,
// pausing, and what it says when a change could not be saved.
import React from 'react';
import { Alert, Switch, Text } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true), push: jest.fn() } }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/store/userStore', () => ({ useUserStore: (select) => select({ user: global.__user }) }));
jest.mock('@/services/coachMemoryService', () => ({
  loadCoachMemory: jest.fn(),
  removeCoachNote: jest.fn(),
  forgetCoachMemory: jest.fn(),
  setCoachMemoryPaused: jest.fn(),
}));

import { router } from 'expo-router';
import CoachMemoryScreen, { INTRO, PRIVACY_NOTE, EMPTY_TEXT, SAVE_ERROR } from '../app/profile/coach-memory';
import {
  loadCoachMemory, removeCoachNote, forgetCoachMemory, setCoachMemoryPaused,
} from '@/services/coachMemoryService';

const mem = (facts, over = {}) => ({ facts, paused: false, upTo: 1, updatedAt: 2, ...over });
const FACTS = ['Can train 3 days a week', 'Trains at home with dumbbells', 'Prefers short workouts'];
const flush = () => act(async () => {});
const show = async () => {
  const utils = render(<CoachMemoryScreen />);
  await flush();
  return utils;
};
const textOf = (utils) => utils.UNSAFE_getAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const press = async (node) => { fireEvent.press(node); await flush(); };

beforeEach(() => {
  jest.clearAllMocks();
  global.__user = { uid: 'u1' };
  loadCoachMemory.mockResolvedValue(mem(FACTS));
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); });

describe('the list', () => {
  it('shows what is saved, in order, with how many of the possible notes there are', async () => {
    const utils = await show();
    expect(loadCoachMemory).toHaveBeenCalledWith('u1');
    FACTS.forEach((fact, i) => {
      expect(within(utils.getByTestId(`memory-note-${i}`)).getByText(fact)).toBeTruthy();
    });
    expect(utils.queryByTestId('memory-note-3')).toBeNull();
    expect(utils.getByTestId('memory-count').props.children).toBe('3 of 20 notes');
    expect(utils.queryByTestId('memory-empty')).toBeNull();
  });

  it('says what the notes are for and where they go, always', async () => {
    const utils = await show();
    expect(utils.getByTestId('memory-intro').props.children).toBe(INTRO);
    expect(utils.getByTestId('memory-privacy').props.children).toBe(PRIVACY_NOTE);
    expect(PRIVACY_NOTE).toMatch(/saved to your account and sent to the AI/);
    expect(PRIVACY_NOTE).toMatch(/erased if you delete your account/);
    expect(INTRO).toMatch(/Today brief/);
  });

  it('shows a spinner until the list has been read, and no notes or buttons before that', async () => {
    loadCoachMemory.mockReturnValue(new Promise(() => {}));
    const utils = await show();
    expect(utils.getByTestId('memory-loading')).toBeTruthy();
    expect(utils.queryByTestId('memory-switch')).toBeNull();
    expect(utils.queryByTestId('memory-forget')).toBeNull();
    expect(utils.queryByTestId('memory-empty')).toBeNull();
    expect(utils.getByTestId('memory-privacy')).toBeTruthy();
  });

  it('says there is nothing yet, with no count and no forget button, when the list is empty', async () => {
    loadCoachMemory.mockResolvedValue(mem([]));
    const utils = await show();
    expect(utils.getByTestId('memory-empty').props.children).toBe(EMPTY_TEXT);
    expect(utils.queryByTestId('memory-count')).toBeNull();
    expect(utils.queryByTestId('memory-forget')).toBeNull();
    expect(utils.getByTestId('memory-switch')).toBeTruthy();
  });

  it('is empty, not stuck on a spinner, with nobody signed in', async () => {
    global.__user = null;
    const utils = await show();
    expect(loadCoachMemory).not.toHaveBeenCalled();
    expect(utils.getByTestId('memory-empty')).toBeTruthy();
    expect(utils.queryByTestId('memory-loading')).toBeNull();
  });

  it('does not show a list that arrives after the screen has gone', async () => {
    let finish;
    loadCoachMemory.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const utils = await show();
    utils.unmount();
    await act(async () => { finish(mem(FACTS)); });
    expect(error).not.toHaveBeenCalled();
  });
});

describe('whose list it is', () => {
  it('does not show the list of the person before when it arrives after the next person\'s', async () => {
    let finishFirst;
    loadCoachMemory.mockImplementation((uid) => (uid === 'u1'
      ? new Promise((resolve) => { finishFirst = resolve; })
      : Promise.resolve(mem(['Second person\'s note']))));
    const utils = await show();
    global.__user = { uid: 'u2' };
    utils.rerender(<CoachMemoryScreen />);
    await flush();
    await act(async () => { finishFirst(mem(['First person\'s note'])); });
    expect(textOf(utils)).toContain('Second person\'s note');
    expect(textOf(utils)).not.toContain('First person\'s note');
  });

  it('changes nothing, and asks the service nothing, with nobody signed in', async () => {
    global.__user = null;
    const utils = await show();
    await act(async () => { fireEvent(utils.getByTestId('memory-switch'), 'valueChange', false); });
    expect(setCoachMemoryPaused).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});

describe('removing a note', () => {
  it('removes that note, shows the list that is saved afterwards, and asks nothing first', async () => {
    removeCoachNote.mockResolvedValue(mem([FACTS[0], FACTS[2]]));
    const utils = await show();
    await press(utils.getByTestId('memory-remove-1'));
    expect(removeCoachNote).toHaveBeenCalledWith('u1', 1);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(textOf(utils)).not.toContain(FACTS[1]);
    expect(textOf(utils)).toContain(FACTS[2]);
    expect(utils.getByTestId('memory-count').props.children).toBe('2 of 20 notes');
  });

  it('has a button for each note that says which note it removes', async () => {
    const utils = await show();
    FACTS.forEach((fact, i) => {
      const button = utils.getByTestId(`memory-remove-${i}`);
      expect(button.props.accessibilityRole).toBe('button');
      expect(button.props.accessibilityLabel).toBe(`Remove note: ${fact}`);
    });
  });

  it('shows the empty message when the last note goes', async () => {
    loadCoachMemory.mockResolvedValue(mem(['Only']));
    removeCoachNote.mockResolvedValue(mem([]));
    const utils = await show();
    await press(utils.getByTestId('memory-remove-0'));
    expect(utils.getByTestId('memory-empty')).toBeTruthy();
  });

  it('says so, and reads the list again, when the change could not be saved', async () => {
    removeCoachNote.mockRejectedValue(new Error('denied'));
    const utils = await show();
    loadCoachMemory.mockClear();
    loadCoachMemory.mockResolvedValue(mem(FACTS));
    await press(utils.getByTestId('memory-remove-0'));
    expect(Alert.alert).toHaveBeenCalledWith('Not saved', SAVE_ERROR);
    expect(loadCoachMemory).toHaveBeenCalledWith('u1');
    expect(textOf(utils)).toContain(FACTS[0]);
  });

  it('can make another change once the first is saved', async () => {
    removeCoachNote.mockResolvedValueOnce(mem(FACTS.slice(1))).mockResolvedValueOnce(mem(FACTS.slice(2)));
    const utils = await show();
    await press(utils.getByTestId('memory-remove-0'));
    await press(utils.getByTestId('memory-remove-0'));
    expect(removeCoachNote).toHaveBeenCalledTimes(2);
    expect(removeCoachNote).toHaveBeenLastCalledWith('u1', 0);
    expect(utils.getByTestId('memory-count').props.children).toBe('1 of 20 notes');
  });

  it('can try again after a change that could not be saved', async () => {
    removeCoachNote.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(mem(FACTS.slice(1)));
    const utils = await show();
    await press(utils.getByTestId('memory-remove-0'));
    await press(utils.getByTestId('memory-remove-0'));
    expect(removeCoachNote).toHaveBeenCalledTimes(2);
    expect(textOf(utils)).not.toContain(FACTS[0]);
  });

  it('turns the buttons and the switch off while a change is being saved, and back on after', async () => {
    let finish;
    removeCoachNote.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const utils = await show();
    const disabled = (id) => Boolean(utils.getByTestId(id).props.accessibilityState?.disabled || utils.getByTestId(id).props.disabled);
    expect(disabled('memory-remove-1')).toBe(false);
    await press(utils.getByTestId('memory-remove-0'));
    expect(disabled('memory-remove-1')).toBe(true);
    expect(disabled('memory-forget')).toBe(true);
    expect(utils.getByTestId('memory-switch').props.disabled).toBe(true);
    await act(async () => { finish(mem(FACTS.slice(1))); });
    expect(disabled('memory-remove-0')).toBe(false);
    expect(utils.getByTestId('memory-switch').props.disabled).toBe(false);
  });

  it('does not start a second change while one is being saved', async () => {
    let finish;
    removeCoachNote.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const utils = await show();
    await press(utils.getByTestId('memory-remove-0'));
    fireEvent.press(utils.getByTestId('memory-remove-1'));
    await flush();
    expect(removeCoachNote).toHaveBeenCalledTimes(1);
    await act(async () => { finish(mem(FACTS.slice(1))); });
    expect(removeCoachNote).toHaveBeenCalledTimes(1);
  });
});

describe('forgetting everything', () => {
  const confirmButton = () => Alert.alert.mock.calls[0][2].find((b) => b.style === 'destructive');

  it('asks first, says what it does, and does nothing until the person confirms', async () => {
    const utils = await show();
    await press(utils.getByTestId('memory-forget'));
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = Alert.alert.mock.calls[0];
    expect(title).toBe('Forget everything?');
    expect(message).toMatch(/will not read your earlier chats again/);
    expect(message).toMatch(/chats themselves stay as they are/);
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Forget everything']);
    expect(buttons[0].style).toBe('cancel');
    expect(forgetCoachMemory).not.toHaveBeenCalled();
  });

  it('forgets, and shows the empty list, once confirmed', async () => {
    forgetCoachMemory.mockResolvedValue(mem([], { upTo: 99 }));
    const utils = await show();
    await press(utils.getByTestId('memory-forget'));
    await act(async () => { confirmButton().onPress(); });
    expect(forgetCoachMemory).toHaveBeenCalledWith('u1');
    expect(utils.getByTestId('memory-empty')).toBeTruthy();
    expect(utils.queryByTestId('memory-note-0')).toBeNull();
  });

  it('says so, and reads the list again, when it could not be saved', async () => {
    forgetCoachMemory.mockRejectedValue(new Error('offline'));
    const utils = await show();
    await press(utils.getByTestId('memory-forget'));
    await act(async () => { confirmButton().onPress(); });
    expect(Alert.alert).toHaveBeenLastCalledWith('Not saved', SAVE_ERROR);
    expect(textOf(utils)).toContain(FACTS[0]);
  });
});

describe('pausing', () => {
  it('is on when the Coach is remembering, and says what it does', async () => {
    const utils = await show();
    const sw = utils.UNSAFE_getAllByType(Switch).find((n) => n.props.accessibilityLabel === 'Remember things from our chats');
    expect(sw.props.value).toBe(true);
    expect(textOf(utils)).toContain('When this is off, your Coach stops adding to the list and does not use it.');
    expect(utils.queryByTestId('memory-paused')).toBeNull();
  });

  it('pauses the memory when switched off, and says it is paused', async () => {
    setCoachMemoryPaused.mockResolvedValue(mem(FACTS, { paused: true }));
    const utils = await show();
    await act(async () => { fireEvent(utils.getByTestId('memory-switch'), 'valueChange', false); });
    expect(setCoachMemoryPaused).toHaveBeenCalledWith('u1', true);
    expect(utils.getByTestId('memory-switch').props.value).toBe(false);
    expect(utils.getByTestId('memory-paused').props.children).toBe('Paused. Your Coach is not adding to this list or using it.');
    expect(textOf(utils)).toContain(FACTS[0]);
  });

  it('resumes the memory when switched back on', async () => {
    loadCoachMemory.mockResolvedValue(mem(FACTS, { paused: true }));
    setCoachMemoryPaused.mockResolvedValue(mem(FACTS));
    const utils = await show();
    expect(utils.getByTestId('memory-switch').props.value).toBe(false);
    expect(utils.getByTestId('memory-paused')).toBeTruthy();
    await act(async () => { fireEvent(utils.getByTestId('memory-switch'), 'valueChange', true); });
    expect(setCoachMemoryPaused).toHaveBeenCalledWith('u1', false);
    expect(utils.getByTestId('memory-switch').props.value).toBe(true);
    expect(utils.queryByTestId('memory-paused')).toBeNull();
  });

  it('says so, and reads the state again, when the change could not be saved', async () => {
    setCoachMemoryPaused.mockRejectedValue(new Error('offline'));
    const utils = await show();
    await act(async () => { fireEvent(utils.getByTestId('memory-switch'), 'valueChange', false); });
    expect(Alert.alert).toHaveBeenCalledWith('Not saved', SAVE_ERROR);
    expect(utils.getByTestId('memory-switch').props.value).toBe(true);
  });
});

describe('going back', () => {
  it('goes back when it can, and to Settings when there is nothing to go back to', async () => {
    const utils = await show();
    expect(utils.getByTestId('memory-back').props.accessibilityLabel).toBe('Go back');
    await press(utils.getByTestId('memory-back'));
    expect(router.back).toHaveBeenCalledTimes(1);
    router.canGoBack.mockReturnValue(false);
    await press(utils.getByTestId('memory-back'));
    expect(router.replace).toHaveBeenCalledWith('/profile/settings');
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
