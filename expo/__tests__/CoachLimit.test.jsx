// When the Coach has no messages left for the day (functions/src/aiQuota.js refuses the request, lib/upgradePrompt.js words it): the
// chat says so in the coach's own bubble, and offers the plans when there is a higher one. Any other failure keeps the old apology.
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
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1', name: 'Cj' } }) }));
jest.mock('@/store/settingsStore', () => ({ useSettingsStore: { getState: () => ({ coachCanAddToCalendar: true }) } }));
jest.mock('@/store/workoutStore', () => ({
  useWorkoutStore: () => ({ completedWorkouts: [], loadWorkouts: async () => {}, getExerciseHistory: async () => [] }),
}));
jest.mock('@/store/runningStore', () => ({ useRunningStore: () => ({ runs: [], loadRuns: async () => {} }) }));
jest.mock('@/store/hikingStore', () => ({ useHikingStore: () => ({ completedHikes: [], loadCompletedHikes: async () => {} }) }));
jest.mock('@/src/services/analytics', () => ({ logAICoachUsed: jest.fn() }));

import CoachScreen from '../app/coach';
import { router } from 'expo-router';
import { chatAI } from '@/services/aiService';
import { saveCoachMessage } from '@/services/coachService';

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


const limit = (tier, n) => Object.assign(new Error('limit'), {
  code: 'functions/resource-exhausted', details: { reason: 'ai_limit', bucket: 'coach', limit: n, tier },
});

describe('the Coach when today\'s messages are used up', () => {
  it('asks chatAI with the messages and a timeout only, so the request is a Coach message (chatAI\'s default allowance)', async () => {
    chatAI.mockResolvedValue('Eat more protein.');
    await say('What should I eat?');
    expect(chatAI).toHaveBeenCalledTimes(1);
    expect(chatAI.mock.calls[0]).toHaveLength(2);
  });

  it('tells a free person how many they had and what Pro gives, instead of the apology', async () => {
    chatAI.mockRejectedValue(limit('free', 5));
    await say('One more question');
    expect(utils.getByText('You have used your 5 free Coach messages for today. Upgrade to Pro for 100 a day, or they come back at midnight Eastern.')).toBeTruthy();
    expect(utils.queryByText(/couldn't respond just now/)).toBeNull();
  });

  it('offers the plans, and opens them', async () => {
    chatAI.mockRejectedValue(limit('free', 5));
    await say('One more question');
    expect(utils.getByText('See plans')).toBeTruthy();
    fireEvent.press(utils.getByTestId('coach-see-plans'));
    expect(router.push).toHaveBeenCalledWith('/paywall');
  });

  it('offers Legend to a Pro person', async () => {
    chatAI.mockRejectedValue(limit('pro', 100));
    await say('One more question');
    expect(utils.getByText(/Upgrade to Legend for 300 a day/)).toBeTruthy();
    expect(utils.getByTestId('coach-see-plans')).toBeTruthy();
  });

  it('offers no plans to a Legend person, who has none higher to go to', async () => {
    chatAI.mockRejectedValue(limit('legend', 300));
    await say('One more question');
    expect(utils.getByText("You have used all 300 of today's Coach messages. They come back at midnight Eastern.")).toBeTruthy();
    expect(utils.queryByTestId('coach-see-plans')).toBeNull();
  });

  it('does not save the limit message as something the coach said', async () => {
    chatAI.mockRejectedValue(limit('free', 5));
    await say('One more question');
    expect(saveCoachMessage.mock.calls.filter(([, role]) => role === 'assistant')).toEqual([]);
  });

  it('keeps the old apology, and no button, for any other failure', async () => {
    chatAI.mockRejectedValue(new Error('network'));
    await say('Are you there?');
    expect(utils.getByText(/couldn't respond just now/)).toBeTruthy();
    expect(utils.queryByTestId('coach-see-plans')).toBeNull();
  });

  it('answers normally again once there are messages', async () => {
    chatAI.mockRejectedValueOnce(limit('free', 5)).mockResolvedValueOnce('Here is your answer.');
    await say('First');
    await say('Second');
    expect(utils.getByText('Here is your answer.')).toBeTruthy();
  });
});
