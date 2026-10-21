// The Coach screen reads fasting for its snapshot when it opens (loadHabitSources), and sends the snapshot, built
// fresh from the stores, with every message.
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
jest.mock('@/services/aiService', () => ({ chatAI: jest.fn(async () => 'Sounds good.') }));
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
  buildSnapshotFromStores: jest.fn(() => ({ role: 'system', content: 'SNAPSHOT WITH TODAY\'S READINGS' })),
}));
jest.mock('@/services/coachMemoryService', () => ({
  refreshCoachMemory: jest.fn(async () => undefined),
  loadCoachMemory: jest.fn(async () => undefined),
  getCachedCoachMemory: jest.fn(() => ({ facts: [], paused: false, upTo: 0, updatedAt: 0 })),
}));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: global.__user }) }));
jest.mock('@/store/settingsStore', () => ({ useSettingsStore: { getState: () => ({ coachCanAddToCalendar: true }) } }));
jest.mock('@/store/workoutStore', () => ({
  useWorkoutStore: () => ({ completedWorkouts: [], loadWorkouts: async () => {}, getExerciseHistory: async () => [] }),
}));
jest.mock('@/store/runningStore', () => ({ useRunningStore: () => ({ runs: [], loadRuns: async () => {} }) }));
jest.mock('@/store/hikingStore', () => ({ useHikingStore: () => ({ completedHikes: [], loadCompletedHikes: async () => {} }) }));

import CoachScreen from '../app/coach';
import { chatAI } from '@/services/aiService';
import { loadHabitSources, loadSnapshotSources, buildSnapshotFromStores } from '@/services/coachSnapshotService';

const flush = () => act(async () => {});

beforeEach(() => {
  global.__user = { uid: 'u1', name: 'Cj' };
  jest.clearAllMocks();
});

describe('Coach screen: the day\'s readings', () => {
  it('reads fasting for the Coach when the screen opens', async () => {
    render(<CoachScreen />);
    await flush();
    expect(loadHabitSources).toHaveBeenCalledTimes(1);
    expect(loadHabitSources).toHaveBeenCalledWith('u1');
    expect(loadSnapshotSources).toHaveBeenCalledWith('u1');
  });

  it('does not read anything without a signed-in person', async () => {
    global.__user = null;
    render(<CoachScreen />);
    await flush();
    expect(loadHabitSources).not.toHaveBeenCalled();
  });

  it('sends the freshly built snapshot with the message', async () => {
    const utils = render(<CoachScreen />);
    await flush();
    fireEvent.changeText(utils.getByPlaceholderText('Ask your coach anything...'), 'How is my recovery looking?');
    fireEvent.press(utils.getByText('arrow-up'));
    await flush();
    expect(buildSnapshotFromStores).toHaveBeenCalledTimes(1);
    expect(buildSnapshotFromStores).toHaveBeenCalledWith({ uid: 'u1', name: 'Cj' });
    const sent = chatAI.mock.calls[0][0].map((m) => m.content);
    expect(sent).toEqual(['SYSTEM PROMPT', "SNAPSHOT WITH TODAY'S READINGS", 'DATA CONTEXT', 'How is my recovery looking?']);
  });
});
