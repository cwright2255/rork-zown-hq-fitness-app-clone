const mockSync = jest.fn();
jest.mock('../store/leaderboardStore', () => ({
  useLeaderboardStore: { getState: () => ({ _syncDistanceEntry: mockSync }) },
}));
jest.mock('../store/runningStore', () => ({
  useRunningStore: { getState: () => global.__running },
}));
jest.mock('../store/settingsStore', () => ({
  useSettingsStore: { getState: () => global.__settings },
}));

import { publishMyDistance } from '../services/distanceBoard';

const user = { uid: 'u1', name: 'Cj', profileImage: 'https://img/p.png' };
const runs = [{ id: 'a', distance: 5 }];

let warn;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockSync.mockReset();
  mockSync.mockResolvedValue(true);
  global.__running = { runs, loadRuns: jest.fn(async () => undefined) };
  global.__settings = { showInLeaderboards: true };
});
afterEach(() => warn.mockRestore());

describe('publishMyDistance', () => {
  it('puts the saved runs on the leaderboard under the person\'s name and picture', async () => {
    expect(await publishMyDistance({ user })).toBe(true);
    expect(mockSync).toHaveBeenCalledWith('u1', { name: 'Cj', avatar: 'https://img/p.png', runs, visible: true });
    expect(global.__running.loadRuns).not.toHaveBeenCalled();
  });

  it('does nothing with nobody signed in', async () => {
    expect(await publishMyDistance({ user: null })).toBe(false);
    expect(await publishMyDistance({ user: {} })).toBe(false);
    expect(await publishMyDistance()).toBe(false);
    expect(mockSync).not.toHaveBeenCalled();
  });

  it('loads the saved runs first when asked, and publishes what it loaded', async () => {
    const loaded = [{ id: 'b', distance: 7 }];
    global.__running = {
      runs: [],
      loadRuns: jest.fn(async () => { global.__running.runs = loaded; }),
    };
    await publishMyDistance({ user, loadFirst: true });
    expect(global.__running.loadRuns).toHaveBeenCalledWith('u1');
    expect(mockSync.mock.calls[0][1].runs).toBe(loaded);
  });

  it('is hidden from the boards when "Show me in leaderboards" is off', async () => {
    global.__settings = { showInLeaderboards: false };
    await publishMyDistance({ user });
    expect(mockSync.mock.calls[0][1].visible).toBe(false);
  });

  it('is shown when the setting is on or was never set', async () => {
    global.__settings = {};
    await publishMyDistance({ user });
    expect(mockSync.mock.calls[0][1].visible).toBe(true);
  });

  it('says whether the leaderboard is up to date', async () => {
    mockSync.mockResolvedValue(false);
    expect(await publishMyDistance({ user })).toBe(false);
  });

  it('never throws: a failed load or write just gives false', async () => {
    global.__running.loadRuns = jest.fn(async () => { throw new Error('offline'); });
    expect(await publishMyDistance({ user, loadFirst: true })).toBe(false);
    global.__running.loadRuns = jest.fn(async () => undefined);
    mockSync.mockRejectedValue(new Error('denied'));
    expect(await publishMyDistance({ user })).toBe(false);
  });
});
