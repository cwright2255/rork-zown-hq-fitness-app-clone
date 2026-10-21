// The Coach screen sends one analytics event (ai_coach_used) for each answer the coach gives: 'chat' for a plain reply,
// 'proposal' when the reply comes with something to add that the person is asked to say yes or no to. Nothing is sent when the
// coach could not answer, or when what was typed was only a yes or a no to an open proposal (no answer was asked for).
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { Ionicons: ({ name }) => mockReact.createElement(mockRn.Text, null, name) };
}, { virtual: true });
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
}, { virtual: true });
jest.mock('@/services/aiService', () => ({ chatAI: jest.fn() }));
jest.mock('@/services/coachActionService', () => ({ executeCoachActions: jest.fn() }));
jest.mock('@/services/coachService', () => ({
  buildCoachSystemPrompt: jest.fn(() => ({ role: 'system', content: 'SYSTEM PROMPT' })),
  buildUserDataContext: jest.fn(() => ({ role: 'system', content: 'DATA CONTEXT' })),
  getCoachHistory: jest.fn(async () => []),
  saveCoachMessage: jest.fn(async () => undefined),
  summarizeLiftPRs: jest.fn(() => []),
  summarizeCardioVolume: jest.fn(() => null),
}));
jest.mock('@/services/coachSnapshotService', () => ({
  loadSnapshotSources: jest.fn(async () => []),
  loadHabitSources: jest.fn(async () => undefined),
  buildSnapshotFromStores: jest.fn(() => ({ role: 'system', content: 'SNAPSHOT' })),
}));
jest.mock('@/services/coachMemoryService', () => ({
  refreshCoachMemory: jest.fn(async () => undefined),
  loadCoachMemory: jest.fn(async () => undefined),
  getCachedCoachMemory: jest.fn(() => ({ facts: [], paused: false, upTo: 0, updatedAt: 0 })),
}));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1', name: 'Cj' } }) }));
jest.mock('@/store/settingsStore', () => ({ useSettingsStore: { getState: () => ({ coachCanAddToCalendar: true }) } }));
jest.mock('@/store/workoutStore', () => ({
  useWorkoutStore: () => ({ completedWorkouts: [], loadWorkouts: async () => {}, getExerciseHistory: async () => [] }),
}));
jest.mock('@/store/runningStore', () => ({ useRunningStore: () => ({ runs: [], loadRuns: async () => {} }) }));
jest.mock('@/store/hikingStore', () => ({ useHikingStore: () => ({ completedHikes: [], loadCompletedHikes: async () => {} }) }));
jest.mock('@/src/services/analytics', () => ({ logAICoachUsed: jest.fn() }));

import CoachScreen from '../app/coach';
import { chatAI } from '@/services/aiService';
import { logAICoachUsed } from '@/src/services/analytics';

const flush = () => act(async () => {});
const GOAL = '<zown_action>{"type":"goal","goals":[{"title":"Run 5k","target":5,"unit":"km"}]}</zown_action>';

let utils;
let error;
beforeEach(async () => {
  jest.clearAllMocks();
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
  utils = render(<CoachScreen />);
  await flush();
});
afterEach(() => error.mockRestore());

const say = async (text) => {
  fireEvent.changeText(utils.getByPlaceholderText('Ask your coach anything...'), text);
  fireEvent.press(utils.getByText('arrow-up'));
  await flush();
};

describe('ai_coach_used', () => {
  it('is "chat" for a plain answer, once', async () => {
    chatAI.mockResolvedValue('Eat more protein.');
    await say('What should I eat?');
    expect(logAICoachUsed).toHaveBeenCalledTimes(1);
    expect(logAICoachUsed).toHaveBeenCalledWith('chat');
  });

  it('is "proposal" when the answer comes with something to add', async () => {
    chatAI.mockResolvedValue(`Here is a goal for you.\n${GOAL}`);
    await say('Set me a 5k goal');
    expect(logAICoachUsed).toHaveBeenCalledTimes(1);
    expect(logAICoachUsed).toHaveBeenCalledWith('proposal');
  });

  it('is "chat" when the block the coach sent had nothing valid in it', async () => {
    chatAI.mockResolvedValue('Sure.\n<zown_action>{"type":"goal","goals":[{"title":"","target":0}]}</zown_action>');
    await say('Set me a goal');
    expect(logAICoachUsed).toHaveBeenCalledWith('chat');
  });

  it('counts each answer: two messages, two events', async () => {
    chatAI.mockResolvedValue('Okay.');
    await say('First question');
    await say('Second question');
    expect(logAICoachUsed).toHaveBeenCalledTimes(2);
  });

  it('is not sent when the coach could not answer', async () => {
    chatAI.mockRejectedValue(new Error('network'));
    await say('Are you there?');
    expect(utils.getByText(/couldn't respond just now/)).toBeTruthy();
    expect(logAICoachUsed).not.toHaveBeenCalled();
  });

  it('is not sent for a no to an open proposal, which asks the coach for nothing', async () => {
    chatAI.mockResolvedValue(`Here is a goal for you.\n${GOAL}`);
    await say('Set me a 5k goal');
    logAICoachUsed.mockClear();
    chatAI.mockClear();
    await say('no');
    expect(chatAI).not.toHaveBeenCalled();
    expect(logAICoachUsed).not.toHaveBeenCalled();
  });

  it('is not sent for an empty message', async () => {
    await say('   ');
    expect(chatAI).not.toHaveBeenCalled();
    expect(logAICoachUsed).not.toHaveBeenCalled();
  });
});
