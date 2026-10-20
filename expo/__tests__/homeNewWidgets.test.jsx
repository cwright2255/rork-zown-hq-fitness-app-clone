// The Home screen shows the newer widgets (Workout Streak, Next Up, Battle Pass, Training Load, Muscles, Workout History, Running Log,
// Challenges & Rank, Macros, Weight) with the others, and the layout switches them on and off.
// jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
import React from 'react';
import { RefreshControl } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  collection: jest.fn((db, ...path) => ({ path: path.join('/') })),
  doc: jest.fn((db, ...path) => ({ path: path.join('/') })),
  query: jest.fn((...parts) => ({ query: parts })),
  orderBy: jest.fn((field, dir) => ({ orderBy: field, dir })),
  limit: jest.fn((n) => ({ limit: n })),
  where: jest.fn((field, op, value) => ({ where: field, op, value })),
  documentId: jest.fn(() => '__name__'),
  getDocs: jest.fn(),
}));
jest.mock('../services/rookService', () => ({ rookService: {} }));
jest.mock('../services/appleHealthService', () => ({ appleHealthService: {} }));
jest.mock('expo-location', () => ({}), { virtual: true }); // the hiking store imports it; no GPS is used here
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Circle: 'Circle' }), { virtual: true });
jest.mock('react-native-chart-kit', () => ({ LineChart: 'LineChart', BarChart: 'BarChart' }), { virtual: true });
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => 'Icon' }), { virtual: true });
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: jest.fn() }),
  router: { push: jest.fn() },
}), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/src/components/LoadingSkeleton', () => () => null);
jest.mock('@/components/StrengthScoreWidget', () => () => null);
jest.mock('@/components/FastingWidget', () => () => null);
jest.mock('@/components/MusicWidget', () => () => null);
jest.mock('@/components/WidgetEditorModal', () => () => null);

import { router } from 'expo-router';
import { getDocs } from 'firebase/firestore';
import Hq from '../app/hq';
import { useUserStore } from '../store/userStore';
import { useWorkoutStore } from '../store/workoutStore';
import { useRunningStore } from '../store/runningStore';
import { useScheduleStore } from '../store/scheduleStore';
import { useHomeWidgetsStore } from '../store/homeWidgetsStore';
import { useSocialGraphStore } from '../store/socialGraphStore';
import { useChallengeStore } from '../store/challengeStore';
import { useNutritionStore } from '../store/nutritionStore';
import { useWeightLogStore } from '../store/weightLogStore';
import { useBodyCompositionStore } from '../store/bodyCompositionStore';
import { useSettingsStore } from '../store/settingsStore';
import { getDefaultWidgetLayout } from '../lib/homeWidgets';

const EVENING = new Date('2026-10-15T01:30:00Z'); // 9:30 PM on Wed 14 Oct in New Jersey
const local = (y, m, d, h = 7, mi = 0) => new Date(y, m - 1, d, h, mi).toISOString();
const NEXT = {
  id: 'e1', title: 'Leg day', kind: 'workout', start: local(2026, 10, 15, 7, 0), notes: '', workoutId: null, repeat: null,
  remindMinutes: null, doneDates: [], skipDates: [], source: 'user', inviteId: null, host: null, updatedAt: '2026-10-01T00:00:00.000Z',
};

// What the "server" holds for the Challenges & Rank card, which reads who you follow, their leaderboard entries and the challenges.
const docs = (list) => ({ docs: list.map(({ id, ...data }) => ({ id, data: () => data })) });
let server;
const answer = async (q) => {
  if (q.path === 'users/u1/following') return docs(server.following);
  if (q.query && q.query[0].path === 'users/u1/weightLogs') return docs(server.weightLogs);
  if (q.query && q.query[0].path === 'users/u1/bodyScans') return docs(server.scans);
  if (q.query && q.query[0].path === 'leaderboard') return docs(server.leaderboard.filter((e) => q.query[1].value.includes(e.id)));
  return docs([]); // challenges, challenge joins and anything else: nothing
};
const readsOf = (path) => getDocs.mock.calls.filter(([q]) => (q.query ? q.query[0].path : q.path) === path);

// The user store finishes loading on a timer once it is imported; let that happen before the clock is moved.
beforeAll(() => new Promise((resolve) => setTimeout(resolve, 20)));
beforeEach(() => {
  server = { following: [], leaderboard: [], weightLogs: [], scans: [] };
  getDocs.mockReset();
  getDocs.mockImplementation(answer);
  useSocialGraphStore.setState({ following: [], isLoaded: false, isLoading: false });
  useChallengeStore.setState({ challenges: [], joinedChallengeIds: new Set() });
  useSettingsStore.setState({ showInLeaderboards: true, weightUnits: 'imperial' });
  useNutritionStore.setState({ meals: [], dailyGoals: { calories: 2000, protein: 150, carbs: 200, fat: 65, water: 2000 } });
  useWeightLogStore.setState({ logs: [], isLoading: false, error: null });
  useBodyCompositionStore.setState({ scans: [], isLoading: false, error: null });
});
afterEach(() => { jest.useRealTimers(); });

const openHome = async ({ layout = getDefaultWidgetLayout() } = {}) => {
  useUserStore.setState({ user: { uid: 'u1', name: 'Cj' } });
  useWorkoutStore.setState({ completedWorkouts: [{ id: 'w1', completedAt: local(2026, 10, 14, 12, 0) }] });
  useScheduleStore.setState({ events: [NEXT] });
  useHomeWidgetsStore.setState({ layout });
  router.push.mockClear();
  jest.useFakeTimers({ now: EVENING, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  const utils = render(<Hq />);
  await act(async () => {});
  return utils;
};

describe('home screen: newer widgets', () => {
  it('shows Workout Streak and Next Up with the others on the default layout', async () => {
    const utils = await openHome();
    expect(utils.getByText('Workout Streak')).toBeTruthy();
    expect(utils.getByText('Next Up')).toBeTruthy();
    expect(utils.getByText('Heart')).toBeTruthy(); // the older cards are still there
    expect(utils.getByTestId('home-nextup-title').props.children).toBe('Leg day');
    expect(utils.getByText('Tomorrow \u00B7 7:00 AM')).toBeTruthy();
    expect(utils.getByText('day in a row')).toBeTruthy(); // the 14th had a workout, and the 14th is today here
  });

  it('opens the Streak Calendar from the Workout Streak card', async () => {
    const utils = await openHome();
    fireEvent.press(utils.getByTestId('home-widget-streak'));
    expect(router.push).toHaveBeenCalledWith('/profile/streak');
  });

  it('opens the Calendar from the Next Up card', async () => {
    const utils = await openHome();
    fireEvent.press(utils.getByTestId('home-widget-nextup'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/calendar', params: { date: '2026-10-15' } });
  });

  it('shows them to someone who saved a layout before they existed, switched on, after the ones they had', async () => {
    const saved = getDefaultWidgetLayout().filter((w) => w.id !== 'streak' && w.id !== 'nextUp');
    const utils = await openHome({ layout: saved });
    expect(utils.getByText('Workout Streak')).toBeTruthy();
    expect(utils.getByText('Next Up')).toBeTruthy();
  });

  it('hides one that is switched off, and only that one', async () => {
    const layout = getDefaultWidgetLayout().map((w) => (w.id === 'streak' ? { ...w, enabled: false } : w));
    const utils = await openHome({ layout });
    expect(utils.queryByText('Workout Streak')).toBeNull();
    expect(utils.getByText('Next Up')).toBeTruthy();
    const both = getDefaultWidgetLayout().map((w) => (w.id === 'streak' || w.id === 'nextUp' ? { ...w, enabled: false } : w));
    await act(async () => { useHomeWidgetsStore.setState({ layout: both }); });
    expect(utils.queryByText('Next Up')).toBeNull();
  });
});

describe('home screen: Battle Pass, Training Load and Muscles', () => {
  const NEW_IDS = ['battlePass', 'trainingLoad', 'muscles'];
  const TEST_IDS = ['home-widget-battlepass', 'home-widget-trainingload', 'home-widget-muscles'];

  it('shows all three with the others on the default layout', async () => {
    const utils = await openHome();
    TEST_IDS.forEach((id) => expect(utils.getByTestId(id)).toBeTruthy());
    expect(utils.getByText('Lv 1')).toBeTruthy();
    expect(utils.getByText('Needs more history')).toBeTruthy(); // one workout is not enough history for a training load
    expect(utils.getByText('Last 5 days')).toBeTruthy();
    expect(utils.getByText('Heart')).toBeTruthy(); // the older cards are still there
    expect(utils.getByText('Workout Streak')).toBeTruthy(); // and the ones from before
  });

  it('opens the Battle Pass from the Battle Pass card', async () => {
    const utils = await openHome();
    fireEvent.press(utils.getByTestId('home-widget-battlepass'));
    expect(router.push).toHaveBeenCalledWith('/battlepass');
  });

  it('opens Health from the Training Load card and from the Muscles card', async () => {
    const utils = await openHome();
    fireEvent.press(utils.getByTestId('home-widget-trainingload'));
    expect(router.push).toHaveBeenLastCalledWith('/health');
    fireEvent.press(utils.getByTestId('home-widget-muscles'));
    expect(router.push).toHaveBeenLastCalledWith('/health');
    expect(router.push).toHaveBeenCalledTimes(2);
  });

  it('counts today\'s workout toward the missions on the Battle Pass card', async () => {
    const utils = await openHome(); // the 14th had a workout, and the 14th is today here
    expect(utils.getByText('1/3 missions today')).toBeTruthy();
  });

  it('shows them to someone who saved a layout before they existed, switched on', async () => {
    const saved = getDefaultWidgetLayout().filter((w) => !NEW_IDS.includes(w.id));
    const utils = await openHome({ layout: saved });
    TEST_IDS.forEach((id) => expect(utils.getByTestId(id)).toBeTruthy());
  });

  it.each([
    ['battlePass', 'home-widget-battlepass'],
    ['trainingLoad', 'home-widget-trainingload'],
    ['muscles', 'home-widget-muscles'],
  ])('hides %s when it is switched off, and only that one', async (offId, offTestId) => {
    const layout = getDefaultWidgetLayout().map((w) => (w.id === offId ? { ...w, enabled: false } : w));
    const utils = await openHome({ layout });
    expect(utils.queryByTestId(offTestId)).toBeNull();
    TEST_IDS.filter((id) => id !== offTestId).forEach((id) => expect(utils.getByTestId(id)).toBeTruthy());
    expect(utils.getByTestId('home-widget-streak')).toBeTruthy();
    expect(utils.getByTestId('home-widget-nextup')).toBeTruthy();
  });

  it('hides all three together, and leaves the others', async () => {
    const utils = await openHome();
    const all = getDefaultWidgetLayout().map((w) => (NEW_IDS.includes(w.id) ? { ...w, enabled: false } : w));
    await act(async () => { useHomeWidgetsStore.setState({ layout: all }); });
    TEST_IDS.forEach((id) => expect(utils.queryByTestId(id)).toBeNull());
    expect(utils.getByTestId('home-widget-streak')).toBeTruthy();
    expect(utils.getByTestId('home-widget-nextup')).toBeTruthy();
  });

  it('lets them be moved: a layout with Muscles first draws it before Battle Pass', async () => {
    const rest = getDefaultWidgetLayout().filter((w) => w.id !== 'muscles');
    const utils = await openHome({ layout: [{ id: 'muscles', enabled: true }, ...rest] });
    const order = utils.UNSAFE_root
      .findAll((n) => n.type === 'View' && TEST_IDS.includes(n.props?.testID))
      .map((n) => n.props.testID)
      .filter((t, i, all) => all.indexOf(t) === i);
    expect(order[0]).toBe('home-widget-muscles');
    expect(order.indexOf('home-widget-muscles')).toBeLessThan(order.indexOf('home-widget-battlepass'));
  });
});


describe('home screen: Workout History and Running Log', () => {
  const SECTION_IDS = ['workoutHistory', 'runningLog'];
  const TEST_IDS = ['home-widget-workouthistory', 'home-widget-runninglog'];
  const treeOrder = (utils, ids) => utils.UNSAFE_root
    .findAll((n) => n.type === 'View' && ids.includes(n.props?.testID))
    .map((n) => n.props.testID)
    .filter((t, i, all) => all.indexOf(t) === i);
  const open = async (opts) => {
    useRunningStore.setState({ runs: [] });
    return openHome(opts);
  };

  it('shows both with the others on the default layout', async () => {
    const utils = await open();
    TEST_IDS.forEach((id) => expect(utils.getByTestId(id)).toBeTruthy());
    expect(utils.getByText('Workout History')).toBeTruthy();
    expect(utils.getByText('Running Log')).toBeTruthy();
    expect(utils.getByText('Heart')).toBeTruthy(); // the older cards are still there
    expect(utils.getByTestId('home-widget-muscles')).toBeTruthy(); // and the newer ones
  });

  it('draws them full width after the grid of cards, Workout History first', async () => {
    const utils = await open();
    expect(treeOrder(utils, ['home-widget-muscles', 'home-widget-streak', ...TEST_IDS])).toEqual([
      'home-widget-streak', 'home-widget-muscles', 'home-widget-workouthistory', 'home-widget-runninglog',
    ]);
  });

  it('shows the workout the person did today, and says there is no run yet', async () => {
    const utils = await open();
    expect(utils.getByTestId('home-widget-workouthistory-latest').props.children).toBe('Latest: Workout \u00B7 Today');
    expect(utils.getByTestId('home-widget-runninglog-empty')).toBeTruthy();
    expect(utils.queryByTestId('home-widget-workouthistory-empty')).toBeNull();
  });

  it('opens Workout History and the Running Log from their buttons', async () => {
    const utils = await open();
    fireEvent.press(utils.getByTestId('home-widget-workouthistory-open'));
    expect(router.push).toHaveBeenLastCalledWith('/profile/workout-history');
    fireEvent.press(utils.getByTestId('home-widget-runninglog-open'));
    expect(router.push).toHaveBeenLastCalledWith('/profile/running-log');
  });

  it('shows them to someone who saved a layout before they existed, switched on', async () => {
    const saved = getDefaultWidgetLayout().filter((w) => !SECTION_IDS.includes(w.id));
    const utils = await open({ layout: saved });
    TEST_IDS.forEach((id) => expect(utils.getByTestId(id)).toBeTruthy());
  });

  it.each([
    ['workoutHistory', 'home-widget-workouthistory', 'home-widget-runninglog'],
    ['runningLog', 'home-widget-runninglog', 'home-widget-workouthistory'],
  ])('hides %s when it is switched off, and only that one', async (offId, offTestId, stillTestId) => {
    const layout = getDefaultWidgetLayout().map((w) => (w.id === offId ? { ...w, enabled: false } : w));
    const utils = await open({ layout });
    expect(utils.queryByTestId(offTestId)).toBeNull();
    expect(utils.getByTestId(stillTestId)).toBeTruthy();
    expect(utils.getByTestId('home-widget-streak')).toBeTruthy();
  });

  it('hides both together, and leaves the cards', async () => {
    const utils = await open();
    const off = getDefaultWidgetLayout().map((w) => (SECTION_IDS.includes(w.id) ? { ...w, enabled: false } : w));
    await act(async () => { useHomeWidgetsStore.setState({ layout: off }); });
    TEST_IDS.forEach((id) => expect(utils.queryByTestId(id)).toBeNull());
    expect(utils.getByTestId('home-widget-streak')).toBeTruthy();
    expect(utils.getByText('Heart')).toBeTruthy();
  });

  it('lets them be moved: a layout with Running Log first draws it before Workout History', async () => {
    const rest = getDefaultWidgetLayout().filter((w) => w.id !== 'runningLog');
    const utils = await open({ layout: [{ id: 'runningLog', enabled: true }, ...rest] });
    expect(treeOrder(utils, TEST_IDS)).toEqual(['home-widget-runninglog', 'home-widget-workouthistory']);
  });
});


describe('home screen: Challenges & Rank', () => {
  const CARD = 'home-widget-rankchallenge';
  const treeOrder = (utils, ids) => utils.UNSAFE_root
    .findAll((n) => n.type === 'View' && ids.includes(n.props?.testID))
    .map((n) => n.props.testID)
    .filter((t, i, all) => all.indexOf(t) === i);
  const open = async (opts) => {
    useRunningStore.setState({ runs: [] });
    return openHome(opts);
  };
  const followTwo = () => {
    server.following = [{ id: 'ana', name: 'Ana' }, { id: 'ben', name: 'Ben' }];
    server.leaderboard = [{ id: 'ana', name: 'Ana', xp: 100 }, { id: 'ben', name: 'Ben', xp: 900 }, { id: 'u1', name: 'Cj', xp: 500 }];
  };

  it('shows with the others on the default layout, and says to follow friends when you follow nobody', async () => {
    const utils = await open();
    expect(utils.getByTestId(CARD)).toBeTruthy();
    expect(utils.getByText('Friends rank')).toBeTruthy();
    expect(utils.getByText('Follow friends to compare')).toBeTruthy();
    expect(utils.getByText('Heart')).toBeTruthy(); // the older cards are still there
    expect(utils.getByTestId('home-widget-muscles')).toBeTruthy(); // and the newer ones
  });

  it('shows your place among the people you follow, by XP', async () => {
    followTwo();
    const utils = await open();
    expect(utils.getByTestId('home-rank-value').props.children).toBe('#2');
    expect(utils.getByText('of 3 by XP')).toBeTruthy();
  });

  it('draws it full width after the grid of cards and after Workout History and Running Log', async () => {
    const utils = await open();
    expect(treeOrder(utils, ['home-widget-muscles', 'home-widget-workouthistory', 'home-widget-runninglog', CARD])).toEqual([
      'home-widget-muscles', 'home-widget-workouthistory', 'home-widget-runninglog', CARD,
    ]);
  });

  it('opens Friends from the left half when you follow nobody, and the Leaderboard once you follow someone', async () => {
    const utils = await open();
    fireEvent.press(utils.getByTestId(`${CARD}-friends`));
    expect(router.push).toHaveBeenLastCalledWith('/friends');
    utils.unmount();
    followTwo();
    const again = await open();
    fireEvent.press(again.getByTestId(`${CARD}-friends`));
    expect(router.push).toHaveBeenLastCalledWith('/leaderboard');
  });

  it('opens Challenges from the right half', async () => {
    const utils = await open();
    fireEvent.press(utils.getByTestId(`${CARD}-challenge`));
    expect(router.push).toHaveBeenLastCalledWith('/challenges');
  });

  it('shows it to someone who saved a layout before it existed, switched on', async () => {
    const saved = getDefaultWidgetLayout().filter((w) => w.id !== 'rankChallenge');
    const utils = await open({ layout: saved });
    expect(utils.getByTestId(CARD)).toBeTruthy();
  });

  it('hides it when it is switched off, and leaves the rest', async () => {
    const layout = getDefaultWidgetLayout().map((w) => (w.id === 'rankChallenge' ? { ...w, enabled: false } : w));
    const utils = await open({ layout });
    expect(utils.queryByTestId(CARD)).toBeNull();
    expect(utils.getByTestId('home-widget-runninglog')).toBeTruthy();
    expect(utils.getByTestId('home-widget-streak')).toBeTruthy();
  });

  it('does not look anything up for the card while it is switched off', async () => {
    const layout = getDefaultWidgetLayout().map((w) => (w.id === 'rankChallenge' ? { ...w, enabled: false } : w));
    await open({ layout });
    expect(readsOf('users/u1/following')).toHaveLength(0);
    expect(readsOf('leaderboard')).toHaveLength(0);
  });

  it('starts looking things up when it is switched on, and hides when it is switched off again', async () => {
    const off = getDefaultWidgetLayout().map((w) => (w.id === 'rankChallenge' ? { ...w, enabled: false } : w));
    const utils = await open({ layout: off });
    followTwo();
    await act(async () => { useHomeWidgetsStore.setState({ layout: getDefaultWidgetLayout() }); });
    expect(utils.getByTestId('home-rank-value').props.children).toBe('#2');
    await act(async () => { useHomeWidgetsStore.setState({ layout: off }); });
    expect(utils.queryByTestId(CARD)).toBeNull();
  });

  it('lets it be moved: a layout with it first draws it before Workout History', async () => {
    const rest = getDefaultWidgetLayout().filter((w) => w.id !== 'rankChallenge');
    const utils = await open({ layout: [{ id: 'rankChallenge', enabled: true }, ...rest] });
    expect(treeOrder(utils, [CARD, 'home-widget-workouthistory', 'home-widget-runninglog'])).toEqual([
      CARD, 'home-widget-workouthistory', 'home-widget-runninglog',
    ]);
  });

  it('looks again when Home is pulled down to refresh', async () => {
    const utils = await open();
    expect(utils.getByText('Follow friends to compare')).toBeTruthy();
    expect(readsOf('users/u1/following')).toHaveLength(1);
    followTwo(); // they followed two people on another phone since
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await act(async () => { await utils.UNSAFE_getByType(RefreshControl).props.onRefresh(); });
    console.error.mockRestore();
    console.warn.mockRestore();
    expect(readsOf('users/u1/following')).toHaveLength(2);
    expect(utils.getByTestId('home-rank-value').props.children).toBe('#2');
  });

  it('shows no place while "Show in Leaderboards" is off, and does not read the leaderboard', async () => {
    followTwo();
    useSettingsStore.setState({ showInLeaderboards: false });
    const utils = await open();
    expect(utils.getByText('Hidden from leaderboards')).toBeTruthy();
    expect(readsOf('leaderboard')).toHaveLength(0);
  });
});


describe('home screen: Macros and Weight', () => {
  const GRID_IDS = ['home-widget-macros', 'home-widget-weight'];
  const treeOrder = (utils, ids) => utils.UNSAFE_root
    .findAll((n) => n.type === 'View' && ids.includes(n.props?.testID))
    .map((n) => n.props.testID)
    .filter((t, i, all) => all.indexOf(t) === i);
  const open = async (opts) => {
    useRunningStore.setState({ runs: [] });
    return openHome(opts);
  };
  const lbsToKg = (n) => n / 2.20462;
  const eatSomething = () => useNutritionStore.setState({
    meals: [{ id: 'b', date: '2026-10-14', foods: [{ name: 'Eggs', calories: 300, protein: 75, carbs: 50, fat: 13 }] }],
  });
  const logWeights = () => {
    server.weightLogs = [{ id: 'b', weightKg: lbsToKg(172) }, { id: 'a', weightKg: lbsToKg(176) }];
  };

  it('shows both with the others on the default layout', async () => {
    const utils = await open();
    GRID_IDS.forEach((id) => expect(utils.getByTestId(id)).toBeTruthy());
    expect(utils.getByText('Macros')).toBeTruthy();
    expect(utils.getByText('Weight')).toBeTruthy();
    expect(utils.getByText('Heart')).toBeTruthy(); // the older cards are still there
    expect(utils.getByTestId('home-widget-rankchallenge')).toBeTruthy(); // and the newer ones
  });

  it('draws them in the grid, after Muscles and before the wide cards', async () => {
    const utils = await open();
    expect(treeOrder(utils, ['home-widget-muscles', ...GRID_IDS, 'home-widget-workouthistory', 'home-widget-rankchallenge'])).toEqual([
      'home-widget-muscles', 'home-widget-macros', 'home-widget-weight', 'home-widget-workouthistory', 'home-widget-rankchallenge',
    ]);
  });

  it('shows what was eaten today against the goals', async () => {
    eatSomething();
    const utils = await open();
    expect(utils.getByTestId('home-macro-protein-text').props.children).toBe('75/150g');
    expect(utils.getByTestId('home-macro-carbs-text').props.children).toBe('50/200g');
    expect(utils.getByTestId('home-macro-fat-text').props.children).toBe('13/65g');
  });

  it('shows the latest weight and how far it has moved', async () => {
    logWeights();
    const utils = await open();
    expect(utils.getByText('172 lbs')).toBeTruthy();
    expect(utils.getByTestId('home-weight-change').props.children).toBe('\u2193 4 lbs from start');
  });

  it('shows the weight in kilograms when Weight Units is kg', async () => {
    logWeights();
    useSettingsStore.setState({ weightUnits: 'metric' });
    const utils = await open();
    expect(utils.getByText('78 kg')).toBeTruthy();
  });

  it('opens Nutrition from Macros and Progress from Weight', async () => {
    const utils = await open();
    fireEvent.press(utils.getByTestId('home-widget-macros'));
    expect(router.push).toHaveBeenLastCalledWith('/nutrition');
    fireEvent.press(utils.getByTestId('home-widget-weight'));
    expect(router.push).toHaveBeenLastCalledWith('/progress');
    expect(router.push).toHaveBeenCalledTimes(2);
  });

  it('shows them to someone who saved a layout before they existed, switched on', async () => {
    const saved = getDefaultWidgetLayout().filter((w) => !['macros', 'weight'].includes(w.id));
    const utils = await open({ layout: saved });
    GRID_IDS.forEach((id) => expect(utils.getByTestId(id)).toBeTruthy());
    // still in the grid, ahead of the wide cards, though they were added after them
    expect(treeOrder(utils, ['home-widget-macros', 'home-widget-workouthistory'])).toEqual(['home-widget-macros', 'home-widget-workouthistory']);
  });

  it.each([
    ['macros', 'home-widget-macros', 'home-widget-weight'],
    ['weight', 'home-widget-weight', 'home-widget-macros'],
  ])('hides %s when it is switched off, and only that one', async (offId, offTestId, stillTestId) => {
    const layout = getDefaultWidgetLayout().map((w) => (w.id === offId ? { ...w, enabled: false } : w));
    const utils = await open({ layout });
    expect(utils.queryByTestId(offTestId)).toBeNull();
    expect(utils.getByTestId(stillTestId)).toBeTruthy();
    expect(utils.getByTestId('home-widget-muscles')).toBeTruthy();
  });

  it('does not read the weight log or the scans while Weight is switched off', async () => {
    const layout = getDefaultWidgetLayout().map((w) => (w.id === 'weight' ? { ...w, enabled: false } : w));
    await open({ layout });
    expect(readsOf('users/u1/weightLogs')).toHaveLength(0);
    expect(readsOf('users/u1/bodyScans')).toHaveLength(0);
  });

  it('lets them be moved: a layout with Weight first draws it before Macros', async () => {
    const rest = getDefaultWidgetLayout().filter((w) => w.id !== 'weight');
    const utils = await open({ layout: [{ id: 'weight', enabled: true }, ...rest] });
    expect(treeOrder(utils, GRID_IDS)).toEqual(['home-widget-weight', 'home-widget-macros']);
  });

  it('reads the weight log and the scans again when Home is pulled down to refresh', async () => {
    const utils = await open();
    expect(utils.getByText('Log your weight')).toBeTruthy();
    expect(readsOf('users/u1/weightLogs')).toHaveLength(1);
    expect(readsOf('users/u1/bodyScans')).toHaveLength(1);
    logWeights(); // logged on another phone since
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await act(async () => { await utils.UNSAFE_getByType(RefreshControl).props.onRefresh(); });
    console.error.mockRestore();
    console.warn.mockRestore();
    expect(readsOf('users/u1/weightLogs')).toHaveLength(2);
    expect(readsOf('users/u1/bodyScans')).toHaveLength(2);
    expect(utils.getByText('172 lbs')).toBeTruthy();
  });
});
