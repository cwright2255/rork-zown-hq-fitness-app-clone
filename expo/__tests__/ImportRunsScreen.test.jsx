import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-router', () => ({
  useRouter: () => global.__router,
}), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: global.__user }) }));
jest.mock('@/store/runningStore', () => ({
  useRunningStore: { getState: () => global.__runningStore },
}));
jest.mock('@/services/healthImport', () => ({ importWorkouts: (...args) => global.__importWorkouts(...args) }));

import ImportRunsScreen from '../app/running/import';

const success = (over = {}) => ({
  ok: true, found: 3, added: [{ id: 'hk-a' }, { id: 'hk-b' }], headline: 'Imported 2 runs', lines: ['1 already in Zown'], ...over,
});

const open = (importWorkouts, { user = { uid: 'u1' }, canGoBack = true } = {}) => {
  global.__user = user;
  global.__runningStore = { runs: [{ id: 'saved-1' }], loadRuns: jest.fn(), importRuns: jest.fn() };
  global.__router = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => canGoBack) };
  global.__importWorkouts = importWorkouts || jest.fn(async () => success());
  return render(<ImportRunsScreen />);
};

// A promise the test settles by hand, to look at the screen while it is working.
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};

const tapImport = async (utils) => {
  await act(async () => { fireEvent.press(utils.getByTestId('import-start')); });
};

describe('ImportRunsScreen', () => {
  it('offers 30 days, 90 days and a year, and an Import button', () => {
    const utils = open();
    expect(utils.getByTestId('import-range-30d')).toBeTruthy();
    expect(utils.getByTestId('import-range-90d')).toBeTruthy();
    expect(utils.getByTestId('import-range-1y')).toBeTruthy();
    expect(utils.getByText('Import from Apple Health')).toBeTruthy();
    expect(utils.queryByTestId('import-result')).toBeNull();
  });

  it('imports the last 90 days by default, handing the import the real store and the signed-in user', async () => {
    const importWorkouts = jest.fn(async () => success());
    const utils = open(importWorkouts);
    await tapImport(utils);
    expect(importWorkouts).toHaveBeenCalledTimes(1);
    const args = importWorkouts.mock.calls[0][0];
    expect(args.uid).toBe('u1');
    expect(args.rangeId).toBe('90d');
    expect(args.loadRuns).toBe(global.__runningStore.loadRuns);
    expect(args.saveRuns).toBe(global.__runningStore.importRuns);
    expect(args.getRuns()).toEqual([{ id: 'saved-1' }]);
    expect(typeof args.onProgress).toBe('function');
  });

  it('imports the range that was picked', async () => {
    const importWorkouts = jest.fn(async () => success());
    const utils = open(importWorkouts);
    fireEvent.press(utils.getByTestId('import-range-30d'));
    await tapImport(utils);
    expect(importWorkouts.mock.calls[0][0].rangeId).toBe('30d');
  });

  it('shows what is happening while it works, then how far along it is', async () => {
    const wait = deferred();
    const importWorkouts = jest.fn((args) => { global.__onProgress = args.onProgress; return wait.promise; });
    const utils = open(importWorkouts);
    await tapImport(utils);
    expect(utils.getByTestId('import-progress').props.children).toBe('Reading Apple Health...');
    act(() => { global.__onProgress({ done: 1, total: 4 }); });
    expect(utils.getByTestId('import-progress').props.children).toBe('Reading workout 2 of 4');
    act(() => { global.__onProgress({ done: 4, total: 4 }); });
    expect(utils.getByTestId('import-progress').props.children).toBe('Reading workout 4 of 4');
    await act(async () => { wait.resolve(success()); });
    expect(utils.queryByTestId('import-progress')).toBeNull();
  });

  it('does not import twice when the button is pressed again while working', async () => {
    const wait = deferred();
    const importWorkouts = jest.fn(() => wait.promise);
    const utils = open(importWorkouts);
    await tapImport(utils);
    await act(async () => { fireEvent.press(utils.getByTestId('import-start')); });
    expect(importWorkouts).toHaveBeenCalledTimes(1);
    await act(async () => { wait.resolve(success()); });
  });

  it('keeps the chosen range while working', async () => {
    const wait = deferred();
    const importWorkouts = jest.fn(() => wait.promise);
    const utils = open(importWorkouts);
    await tapImport(utils);
    fireEvent.press(utils.getByTestId('import-range-1y'));
    await act(async () => { wait.resolve(success()); });
    await tapImport(utils);
    expect(importWorkouts.mock.calls[1][0].rangeId).toBe('90d');
  });

  it('shows the headline and the details of what came in', async () => {
    const utils = open();
    await tapImport(utils);
    expect(utils.getByTestId('import-headline').props.children).toBe('Imported 2 runs');
    expect(utils.getByText('1 already in Zown')).toBeTruthy();
    expect(utils.getByText('Import again')).toBeTruthy();
    expect(utils.queryByTestId('import-hint')).toBeNull();
    expect(utils.queryByTestId('import-error')).toBeNull();
  });

  it('can import again, and the second result replaces the first', async () => {
    const importWorkouts = jest.fn()
      .mockResolvedValueOnce(success())
      .mockResolvedValueOnce(success({ added: [], headline: 'Nothing new to import', lines: ['2 already in Zown'] }));
    const utils = open(importWorkouts);
    await tapImport(utils);
    await tapImport(utils);
    expect(importWorkouts).toHaveBeenCalledTimes(2);
    expect(utils.getByTestId('import-headline').props.children).toBe('Nothing new to import');
    expect(utils.queryByText('Imported 2 runs')).toBeNull();
    expect(utils.queryByTestId('import-view-log')).toBeNull();
  });

  it('points to the Health settings when nothing at all was found', async () => {
    const utils = open(jest.fn(async () => success({ found: 0, added: [], headline: 'No runs or walks found', lines: [] })));
    await tapImport(utils);
    expect(utils.getByTestId('import-headline').props.children).toBe('No runs or walks found');
    expect(utils.getByTestId('import-hint').props.children.join('')).toMatch(/Workout Routes/);
    expect(utils.queryByTestId('import-view-log')).toBeNull();
  });

  it('goes back to the Running Log from "See them"', async () => {
    const utils = open();
    await tapImport(utils);
    fireEvent.press(utils.getByTestId('import-view-log'));
    expect(global.__router.back).toHaveBeenCalledTimes(1);
  });

  it('goes to the Running Log when there is nothing to go back to', async () => {
    const utils = open(undefined, { canGoBack: false });
    fireEvent.press(utils.getByTestId('import-back'));
    expect(global.__router.back).not.toHaveBeenCalled();
    expect(global.__router.replace).toHaveBeenCalledWith('/profile/running-log');
  });

  it('goes back from the back arrow', () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('import-back'));
    expect(global.__router.back).toHaveBeenCalledTimes(1);
  });

  describe.each([
    ['signed-out', /Sign in/],
    ['unavailable', /not available/],
    ['denied', /Workout Routes/],
    ['error', /Something went wrong/],
    ['something-new', /Something went wrong/],
  ])('when the import fails with "%s"', (reason, text) => {
    it('says what happened, with no result and no spinner left behind', async () => {
      const utils = open(jest.fn(async () => ({ ok: false, reason })));
      await tapImport(utils);
      expect(utils.getByText('Could not import')).toBeTruthy();
      expect(utils.getByTestId('import-error')).toBeTruthy();
      expect(utils.getAllByText(text).length).toBeGreaterThan(0);
      expect(utils.queryByTestId('import-result')).toBeNull();
      expect(utils.queryByTestId('import-progress')).toBeNull();
      expect(utils.getByText('Import from Apple Health')).toBeTruthy();
    });
  });

  it('can try again after a failure', async () => {
    const importWorkouts = jest.fn()
      .mockResolvedValueOnce({ ok: false, reason: 'denied' })
      .mockResolvedValueOnce(success());
    const utils = open(importWorkouts);
    await tapImport(utils);
    expect(utils.getByTestId('import-error')).toBeTruthy();
    await tapImport(utils);
    expect(utils.queryByTestId('import-error')).toBeNull();
    expect(utils.getByTestId('import-headline')).toBeTruthy();
  });

  it('does not sit on the spinner if the import itself throws', async () => {
    const utils = open(jest.fn(async () => { throw new Error('unexpected'); }));
    await tapImport(utils);
    expect(utils.getByTestId('import-error')).toBeTruthy();
    expect(utils.queryByTestId('import-progress')).toBeNull();
    await tapImport(utils);
    expect(global.__importWorkouts).toHaveBeenCalledTimes(2);
  });

  it('asks the import to run signed out, so it can say to sign in', async () => {
    const importWorkouts = jest.fn(async () => ({ ok: false, reason: 'signed-out' }));
    const utils = open(importWorkouts, { user: null });
    await tapImport(utils);
    expect(importWorkouts.mock.calls[0][0].uid).toBeUndefined();
    expect(utils.getByText('Sign in to import your runs.')).toBeTruthy();
  });

  it('says importing earns no XP and that doing it twice is safe', () => {
    const utils = open();
    expect(utils.getByText(/do not earn XP/)).toBeTruthy();
    expect(utils.getByText(/importing twice is safe/)).toBeTruthy();
  });

  describe('on Android', () => {
    afterEach(() => jest.restoreAllMocks());

    it('says importing works on iPhone only, and offers nothing to press', () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      const utils = open();
      expect(utils.getByTestId('import-unsupported')).toBeTruthy();
      expect(utils.queryByTestId('import-start')).toBeNull();
      expect(utils.queryByTestId('import-range-30d')).toBeNull();
      expect(utils.getByTestId('import-back')).toBeTruthy();
    });
  });
});
