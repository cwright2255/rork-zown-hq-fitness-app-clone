// How often the active workout screen (app/workout/active.jsx) draws itself again. It read three stores whole, and the music player hook
// it uses read the Spotify and Apple Music stores whole, so a change anywhere in them drew the whole screen again: a set landing in the
// workout history, XP being added, and above all the music poll, which writes the track and the position in it to the Spotify store every few
// seconds while music plays. It now asks each store for just what it shows, so only a change in something it shows draws it again. The
// exercises still to come are a list that draws the cards near the screen instead of all of them.
//
// Nothing here moves the clock: the screen's own one-second timer is what redraws it during a real workout, and is not what is measured.
import React, { Profiler } from 'react';
import { FlatList, ScrollView } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {}, auth: {}, storage: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('expo-location', () => ({}), { virtual: true });

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ id: 'w1' }),
}), { virtual: true });
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: () => <Text>icon</Text> };
}, { virtual: true });

// The services that reach out to the network, to a wearable or to a music app. The music services only have to exist: the stores import them.
jest.mock('@/services/exerciseDbService', () => ({
  searchAscendExercise: jest.fn(async () => null),
  extractExerciseMediaUrl: jest.fn(() => null),
  isBodyweightExercise: jest.fn(() => false),
}));
jest.mock('@/services/wearableService', () => ({ getCurrentReadiness: jest.fn(async () => null) }));
jest.mock('@/src/services/analytics', () => ({
  logWorkoutStarted: jest.fn(),
  logWorkoutCompleted: jest.fn(),
  logFirstWorkoutCompleted: jest.fn(),
}));
jest.mock('@/services/spotifyService', () => ({ spotifyService: {} }));
jest.mock('@/services/appleMusicService', () => ({ appleMusicService: {} }));

import ActiveWorkoutScreen from '../app/workout/active';
import { useWorkoutStore } from '../store/workoutStore';
import { useExpStore } from '../store/expStore';
import { useUserStore } from '../store/userStore';
import { useSettingsStore } from '../store/settingsStore';
import { useSpotifyStore } from '../store/spotifyStore';
import { useAppleMusicStore } from '../store/appleMusicStore';

const exercise = (n) => ({ id: `e${n}`, name: `Move ${n}`, sets: 3, reps: 10, muscleGroups: ['chest'] });
const TWELVE_MOVES = Array.from({ length: 12 }, (_, i) => exercise(i + 1));

let commits;
const onRender = () => { commits += 1; };

/** Draws the screen on a workout of twelve exercises, lets whatever it starts settle, then starts counting. */
async function drawWorkout() {
  commits = 0;
  render(
    <Profiler id="active" onRender={onRender}>
      <ActiveWorkoutScreen />
    </Profiler>
  );
  await settle();
  commits = 0;
}

/** The screen looks up a demo video and the exercise's history when it opens or moves to another exercise, each a few promises deep: let them all land. */
async function settle() {
  await act(async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); });
}

/** How many times the screen is drawn again by this change. */
async function drawsFrom(change) {
  const before = commits;
  await act(async () => { change(); });
  return commits - before;
}

const track = (name) => ({ name, artists: [{ name: 'Some Artist' }], album: { images: [{ url: 'https://example.com/a.jpg' }] } });

// Every test starts from the stores as they were when the file loaded, so one test's changes are not there for the next.
const STORES = [useWorkoutStore, useExpStore, useUserStore, useSettingsStore, useSpotifyStore, useAppleMusicStore];
const INITIAL = STORES.map((store) => store.getState());

beforeEach(() => {
  jest.useFakeTimers();
  STORES.forEach((store, i) => store.setState(INITIAL[i], true));
  // Nobody is signed in, and the workout store's loading and saving are stand-ins: nothing here reaches for the network.
  useUserStore.setState({ user: null });
  useSettingsStore.setState({ weightUnits: 'lb' });
  useWorkoutStore.setState({
    workouts: [{ id: 'w1', name: 'Push Day', category: 'strength', difficulty: 'intermediate', exercises: TWELVE_MOVES }],
    customWorkouts: [],
    completedWorkouts: [],
    inProgress: {},
    getExerciseHistory: jest.fn(async () => []),
    logSet: jest.fn(async () => undefined),
    addCompletedWorkout: jest.fn(async () => undefined),
  });
  useSpotifyStore.setState({ isConnected: false, currentTrack: null, isPlaying: false, queue: [] });
  useAppleMusicStore.setState({ isConnected: false, currentTrack: null, isPlaying: false, queue: [] });
});
afterEach(() => { jest.useRealTimers(); });

describe('the active workout does not draw again for a change it does not show', () => {
  it.each([
    ['the workout store (the history of finished workouts)', () => useWorkoutStore.setState({ completedWorkouts: [{ id: 'old', completedAt: '2026-11-03T12:00:00Z' }] })],
    ['the workout store (loading)', () => useWorkoutStore.setState({ isLoading: true })],
    ['the workout store (a run in progress)', () => useWorkoutStore.setState({ currentRun: { id: 'r1' } })],
    ['the XP store (a field the screen does not use)', () => useExpStore.setState({ mealXpDate: '2026-11-04' })],
    ['the user store (loading)', () => useUserStore.setState({ isLoading: true })],
  ])('after a change in %s', async (_name, change) => {
    await drawWorkout();
    expect(await drawsFrom(change)).toBe(0);
  });
});

describe('the active workout does not draw again for the music poll', () => {
  beforeEach(() => {
    useSpotifyStore.setState({ isConnected: true, currentTrack: track('Song One'), isPlaying: true, progressMs: 1000, durationMs: 200000, queue: [] });
  });

  it('when the position in the song moves on', async () => {
    await drawWorkout();
    expect(await drawsFrom(() => useSpotifyStore.setState({ progressMs: 6000 }))).toBe(0);
  });

  it('when the poll hands back a fresh copy of the same song', async () => {
    await drawWorkout();
    // Every poll replaces currentTrack with a new object from Spotify's answer, even when it is the same song.
    expect(await drawsFrom(() => useSpotifyStore.setState({ currentTrack: track('Song One'), progressMs: 11000 }))).toBe(0);
  });

  it('through twenty polls in a row', async () => {
    await drawWorkout();
    let draws = 0;
    for (let i = 1; i <= 20; i += 1) {
      draws += await drawsFrom(() => useSpotifyStore.setState({ currentTrack: track('Song One'), progressMs: i * 5000, durationMs: 200000 }));
    }
    expect(draws).toBe(0);
  });

  it('when either music store changes in a way the screen does not show (a loading flag)', async () => {
    await drawWorkout();
    expect(await drawsFrom(() => useSpotifyStore.setState({ isLoading: true }))).toBe(0);
    expect(await drawsFrom(() => useAppleMusicStore.setState({ isLoading: true }))).toBe(0);
  });
});

describe('the active workout still updates for a change it does show', () => {
  it('draws again when a different song starts, and when playing is paused', async () => {
    useSpotifyStore.setState({ isConnected: true, currentTrack: track('Song One'), isPlaying: true });
    await drawWorkout();
    expect(await drawsFrom(() => useSpotifyStore.setState({ currentTrack: track('Song Two') }))).toBeGreaterThan(0);
    expect(await drawsFrom(() => useSpotifyStore.setState({ isPlaying: false }))).toBeGreaterThan(0);
  });

  it('draws again when a music app is connected, and for Apple Music\'s own song', async () => {
    await drawWorkout();
    expect(await drawsFrom(() => useAppleMusicStore.setState({ isConnected: true, currentTrack: { title: 'Mine', artistName: 'Them' }, isPlaying: true }))).toBeGreaterThan(0);
    expect(await drawsFrom(() => useAppleMusicStore.setState({ currentTrack: { title: 'Next', artistName: 'Them' } }))).toBeGreaterThan(0);
  });

  it('draws again when the person is signed in, and when the saved workouts change', async () => {
    await drawWorkout();
    expect(await drawsFrom(() => useUserStore.setState({ user: { uid: 'u1', name: 'Cj' } }))).toBeGreaterThan(0);
    expect(await drawsFrom(() => useWorkoutStore.setState({ workouts: [{ id: 'w1', name: 'Renamed', exercises: TWELVE_MOVES }] }))).toBeGreaterThan(0);
  });

  it('shows the first exercise and its set rows', async () => {
    await drawWorkout();
    expect(screen.getByText('Move 1')).toBeTruthy();
    expect(screen.getByText('Log Your Sets')).toBeTruthy();
    expect(screen.getByText('Set 3')).toBeTruthy();
  });
});

describe('the exercises still to come are a list that draws what is near', () => {
  it('draws the first few cards when the workout opens, and the rest once the list knows its size', async () => {
    await drawWorkout();
    // Eleven exercises are still to come after the first.
    expect(screen.getByText('Move 2')).toBeTruthy();
    expect(screen.getByText('Move 4')).toBeTruthy();
    expect(screen.queryByText('Move 8')).toBeNull();
    expect(screen.queryByText('Move 12')).toBeNull();

    const row = screen.UNSAFE_getByType(FlatList).findByType(ScrollView);
    await act(async () => {
      fireEvent(row, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 200 } } });
      fireEvent(row, 'contentSizeChange', 3000, 200);
    });
    // The list fills in a few cards at a time, a moment apart (less than the second the workout's own timer ticks on).
    for (let i = 0; i < 9; i += 1) await act(async () => { jest.advanceTimersByTime(100); });
    expect(screen.getByText('Move 12')).toBeTruthy();
  });

  it('jumps to the exercise whose card is tapped', async () => {
    await drawWorkout();
    expect(screen.getByText('Move 2')).toBeTruthy();
    // The cards are the exercises after the first, so the second card, Move 3, is the third exercise.
    fireEvent.press(screen.getByText('Move 3'));
    await settle();
    expect(screen.queryByText('Move 2')).toBeNull(); // skipped over: not the one on screen, and not one still to come
    expect(screen.getAllByText('Move 3')).toHaveLength(1); // the title now, no longer a card
    expect(screen.getByText('Move 4')).toBeTruthy(); // the first card is the one after it
  });

  it('says so when there is nothing left to come', async () => {
    useWorkoutStore.setState({ workouts: [{ id: 'w1', name: 'Short', exercises: [exercise(1)] }] });
    await drawWorkout();
    expect(screen.getByText('Last exercise!')).toBeTruthy();
    expect(screen.UNSAFE_queryByType(FlatList)).toBeNull();
  });
});
