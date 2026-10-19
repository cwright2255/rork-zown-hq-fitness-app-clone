const mockLog = [];
jest.mock('../store/leaderboardStore', () => ({
  useLeaderboardStore: { getState: () => ({ _syncProfile: (...a) => global.__syncProfile(...a) }) },
}));
jest.mock('../store/settingsStore', () => ({
  useSettingsStore: { getState: () => global.__settings },
}));
jest.mock('../services/raceBoard', () => ({
  publishMyRaces: (...a) => global.__publishRaces(...a),
  withdrawMyRaces: (...a) => global.__withdrawRaces(...a),
}));

import {
  isShownOnLeaderboards, publishMyProfile, setShowInLeaderboards,
} from '../services/leaderboardVisibility';

// The app writes only who the person is on the board (name and picture). XP, level, streak and distance are the server's
// (functions/src/xpLedger.js), so nothing here takes a score.
const user = { uid: 'u1', name: 'Cj', profileImage: 'https://img/p.png', streak: 99 };

let warn;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockLog.length = 0;
  global.__settings = {
    showInLeaderboards: true,
    updateSetting: jest.fn((key, value) => { global.__settings[key] = value; }),
  };
  global.__syncProfile = jest.fn(async () => { mockLog.push('profile'); return true; });
  global.__publishRaces = jest.fn(async () => { mockLog.push('races'); return true; });
  global.__withdrawRaces = jest.fn(async () => { mockLog.push('withdrawRaces'); return true; });
});
afterEach(() => warn.mockRestore());

describe('isShownOnLeaderboards', () => {
  it('is true when the setting is on, and when it was never set', () => {
    expect(isShownOnLeaderboards()).toBe(true);
    global.__settings = {};
    expect(isShownOnLeaderboards()).toBe(true);
    global.__settings = { showInLeaderboards: undefined };
    expect(isShownOnLeaderboards()).toBe(true);
  });

  it('is false only when the person turned it off', () => {
    global.__settings = { showInLeaderboards: false };
    expect(isShownOnLeaderboards()).toBe(false);
  });
});

describe('publishMyProfile', () => {
  it('puts the person\'s name and picture on their entry, and nothing else about them', async () => {
    expect(await publishMyProfile({ user })).toBe(true);
    expect(global.__syncProfile).toHaveBeenCalledTimes(1);
    expect(global.__syncProfile).toHaveBeenCalledWith('u1', { name: 'Cj', avatar: 'https://img/p.png', visible: true });
  });

  it('does not hand over a score, whatever the user record holds', async () => {
    await publishMyProfile({ user: { ...user, xp: 99999, level: 100, exp: 99999 } });
    expect(Object.keys(global.__syncProfile.mock.calls[0][1]).sort()).toEqual(['avatar', 'name', 'visible']);
  });

  it('says the person is hidden when "Show in Leaderboards" is off', async () => {
    global.__settings = { showInLeaderboards: false };
    await publishMyProfile({ user });
    expect(global.__syncProfile.mock.calls[0][1].visible).toBe(false);
  });

  it('says the person is shown when the setting was never set', async () => {
    global.__settings = {};
    await publishMyProfile({ user });
    expect(global.__syncProfile.mock.calls[0][1].visible).toBe(true);
  });

  it('says whether the entry is as it should be', async () => {
    global.__syncProfile = jest.fn(async () => false);
    expect(await publishMyProfile({ user })).toBe(false);
  });

  it('does nothing with nobody signed in', async () => {
    expect(await publishMyProfile({ user: null })).toBe(false);
    expect(await publishMyProfile({ user: {} })).toBe(false);
    expect(await publishMyProfile()).toBe(false);
    expect(global.__syncProfile).not.toHaveBeenCalled();
  });

  it('never throws: a failed write just gives false', async () => {
    global.__syncProfile = jest.fn(async () => { throw new Error('offline'); });
    expect(await publishMyProfile({ user })).toBe(false);
    expect(warn).toHaveBeenCalledWith('[leaderboardVisibility] publish failed:', 'offline');
  });
});

describe('setShowInLeaderboards', () => {
  it('turning it off saves the setting and takes the person off the boards', async () => {
    expect(await setShowInLeaderboards(false, user)).toBe(true);
    expect(global.__settings.updateSetting).toHaveBeenCalledWith('showInLeaderboards', false, 'u1');
    expect(global.__syncProfile).toHaveBeenCalledTimes(1);
    expect(global.__syncProfile).toHaveBeenCalledWith('u1', { name: 'Cj', avatar: 'https://img/p.png', visible: false });
  });

  it('saves the setting before it publishes, so the publish sees the new setting', async () => {
    let seen;
    global.__syncProfile = jest.fn(async () => { seen = global.__settings.showInLeaderboards; return true; });
    await setShowInLeaderboards(false, user);
    expect(seen).toBe(false);
  });

  it('turning it on saves the setting and puts the person\'s entry back, then their race times', async () => {
    global.__settings.showInLeaderboards = false;
    expect(await setShowInLeaderboards(true, user)).toBe(true);
    expect(global.__settings.updateSetting).toHaveBeenCalledWith('showInLeaderboards', true, 'u1');
    expect(global.__syncProfile).toHaveBeenCalledWith('u1', { name: 'Cj', avatar: 'https://img/p.png', visible: true });
    expect(mockLog).toEqual(['profile', 'races']);
  });

  it('treats anything that is not a yes as off', async () => {
    await setShowInLeaderboards(0, user);
    expect(global.__settings.updateSetting).toHaveBeenCalledWith('showInLeaderboards', false, 'u1');
    expect(global.__syncProfile.mock.calls[0][1].visible).toBe(false);
    expect(global.__withdrawRaces).toHaveBeenCalledTimes(1);
    await setShowInLeaderboards(1, user);
    expect(global.__settings.updateSetting).toHaveBeenLastCalledWith('showInLeaderboards', true, 'u1');
    expect(global.__syncProfile.mock.calls[1][1].visible).toBe(true);
  });

  it('says the board does not match yet when the entry could not be removed or put back', async () => {
    global.__syncProfile = jest.fn(async () => false);
    expect(await setShowInLeaderboards(false, user)).toBe(false);
    expect(await setShowInLeaderboards(true, user)).toBe(false);
  });

  it('turning it off also takes the virtual race times off the boards', async () => {
    expect(await setShowInLeaderboards(false, user)).toBe(true);
    expect(global.__withdrawRaces).toHaveBeenCalledTimes(1);
    expect(global.__withdrawRaces).toHaveBeenCalledWith({ user });
    expect(global.__publishRaces).not.toHaveBeenCalled();
  });

  it('turning it on puts the virtual race times back, after the setting is saved', async () => {
    let seen;
    global.__publishRaces = jest.fn(async () => { seen = global.__settings.showInLeaderboards; return true; });
    global.__settings.showInLeaderboards = false;
    expect(await setShowInLeaderboards(true, user)).toBe(true);
    expect(global.__publishRaces).toHaveBeenCalledWith({ user });
    expect(global.__withdrawRaces).not.toHaveBeenCalled();
    expect(seen).toBe(true);
  });

  it('says the board does not match yet when the race times could not be taken off', async () => {
    global.__withdrawRaces = jest.fn(async () => false);
    expect(await setShowInLeaderboards(false, user)).toBe(false);
  });

  it('says the board does not match yet when the race times could not be put back', async () => {
    global.__publishRaces = jest.fn(async () => false);
    expect(await setShowInLeaderboards(true, user)).toBe(false);
  });

  it('still saves the setting with nobody signed in, and publishes nothing', async () => {
    expect(await setShowInLeaderboards(false, null)).toBe(false);
    expect(await setShowInLeaderboards(true, {})).toBe(false);
    const { calls } = global.__settings.updateSetting.mock;
    expect(calls).toHaveLength(2);
    expect(calls[0].slice(0, 2)).toEqual(['showInLeaderboards', false]);
    expect(calls[1].slice(0, 2)).toEqual(['showInLeaderboards', true]);
    expect(calls[0][2]).toBeFalsy();
    expect(calls[1][2]).toBeFalsy();
    expect(global.__syncProfile).not.toHaveBeenCalled();
    expect(global.__publishRaces).not.toHaveBeenCalled();
    expect(global.__withdrawRaces).not.toHaveBeenCalled();
  });
});
