// The Coach screen and the Coach's notes (services/coachMemoryService.js): when the screen opens the Coach looks at what was said since it last
// looked, and each message is sent with the notes it has now.
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
  buildSnapshotFromStores: jest.fn(() => ({ role: 'system', content: 'SNAPSHOT' })),
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
import { getCoachHistory, buildCoachSystemPrompt } from '@/services/coachService';
import { refreshCoachMemory, loadCoachMemory, getCachedCoachMemory } from '@/services/coachMemoryService';

const flush = () => act(async () => {});
const HISTORY = [
  { id: 'a', role: 'user', content: 'I train at home', createdAt: new Date(2026, 9, 19, 8) },
  { id: 'b', role: 'assistant', content: 'Nice.', createdAt: new Date(2026, 9, 19, 8, 1) },
];

beforeEach(() => {
  jest.clearAllMocks();
  global.__user = { uid: 'u1', name: 'Cj' };
  getCoachHistory.mockResolvedValue([]);
});

describe('Coach screen: the Coach\'s notes', () => {
  it('looks at the chat for this person when the screen opens, with the chat it loaded', async () => {
    getCoachHistory.mockResolvedValue(HISTORY);
    render(<CoachScreen />);
    await flush();
    expect(refreshCoachMemory).toHaveBeenCalledTimes(1);
    expect(refreshCoachMemory).toHaveBeenCalledWith({ uid: 'u1', history: HISTORY });
    expect(loadCoachMemory).not.toHaveBeenCalled();
  });

  it('looks even when the chat is empty, so the notes are read for the messages that follow', async () => {
    render(<CoachScreen />);
    await flush();
    expect(refreshCoachMemory).toHaveBeenCalledWith({ uid: 'u1', history: [] });
  });

  it('reads the notes anyway when the chat could not be loaded', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    getCoachHistory.mockRejectedValue(new Error('offline'));
    render(<CoachScreen />);
    await flush();
    expect(refreshCoachMemory).not.toHaveBeenCalled();
    expect(loadCoachMemory).toHaveBeenCalledWith('u1');
  });

  it('does nothing without a signed-in person', async () => {
    global.__user = null;
    render(<CoachScreen />);
    await flush();
    expect(refreshCoachMemory).not.toHaveBeenCalled();
    expect(loadCoachMemory).not.toHaveBeenCalled();
  });

  it('does not hold the chat up while the notes are being worked out', async () => {
    refreshCoachMemory.mockReturnValue(new Promise(() => {}));
    getCoachHistory.mockResolvedValue(HISTORY);
    const utils = render(<CoachScreen />);
    await flush();
    expect(utils.getByText('I train at home')).toBeTruthy();
  });

  it('sends each message with the notes it has at that moment', async () => {
    const memory = { facts: ['Can train 3 days a week'], paused: false, upTo: 1, updatedAt: 2 };
    getCachedCoachMemory.mockReturnValue(memory);
    const utils = render(<CoachScreen />);
    await flush();
    fireEvent.changeText(utils.getByPlaceholderText('Ask your coach anything...'), 'Plan my week');
    fireEvent.press(utils.getByText('arrow-up'));
    await flush();
    expect(getCachedCoachMemory).toHaveBeenCalledWith('u1');
    expect(buildCoachSystemPrompt).toHaveBeenCalledTimes(1);
    expect(buildCoachSystemPrompt).toHaveBeenCalledWith({ uid: 'u1', name: 'Cj' }, expect.any(Date), { calendar: true, memory });
  });
});
