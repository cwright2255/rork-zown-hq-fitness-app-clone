const mockLog = [];
jest.mock('../store/expStore', () => ({
  useExpStore: { getState: () => global.__exp },
}));
jest.mock('../store/leaderboardStore', () => ({
  useLeaderboardStore: { getState: () => ({ _syncLeaderboardEntry: (...a) => global.__syncXp(...a) }) },
}));
jest.mock('../store/settingsStore', () => ({
  useSettingsStore: { getState: () => global.__settings },
}));
jest.mock('../services/distanceBoard', () => ({
  publishMyDistance: (...a) => global.__publishDistance(...a),
}));

import {
  isShownOnLeaderboards, publishMyXp, setShowInLeaderboards,
} from '../services/leaderboardVisibility';

const user = { uid: 'u1', name: 'Cj', profileImage: 'https://img/p.png', streak: 6 };

let warn;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockLog.length = 0;
  global.__exp = { expSystem: { totalExp: 1200, level: 4 } };
  global.__settings = {
    showInLeaderboards: true,
    updateSetting: jest.fn((key, value) => { global.__settings[key] = value; }),
  };
  global.__syncXp = jest.fn(async () => { mockLog.push('xp'); return true; });
  global.__publishDistance = jest.fn(async () => { mockLog.push('distance'); return true; });
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

describe('publishMyXp', () => {
  it('puts the person\'s XP, level and streak on the board under their name and picture', async () => {
    expect(await publishMyXp({ user })).toBe(true);
    expect(global.__syncXp).toHaveBeenCalledTimes(1);
    expect(global.__syncXp).toHaveBeenCalledWith('u1', {
      name: 'Cj', avatar: 'https://img/p.png', xp: 1200, level: 4, streak: 6, visible: true,
    });
  });

  it('uses the XP as it is now, not as it was when the screen opened', async () => {
    await publishMyXp({ user });
    global.__exp = { expSystem: { totalExp: 1350, level: 5 } };
    await publishMyXp({ user });
    expect(global.__syncXp.mock.calls[1][1]).toMatchObject({ xp: 1350, level: 5 });
  });

  it('says the person is hidden when "Show in Leaderboards" is off', async () => {
    global.__settings = { showInLeaderboards: false };
    global.__syncXp = jest.fn(async () => false);
    expect(await publishMyXp({ user })).toBe(false);
    expect(global.__syncXp.mock.calls[0][1].visible).toBe(false);
  });

  it('says the person is shown when the setting was never set', async () => {
    global.__settings = {};
    await publishMyXp({ user });
    expect(global.__syncXp.mock.calls[0][1].visible).toBe(true);
  });

  it('says whether the entry was written', async () => {
    global.__syncXp = jest.fn(async () => false);
    expect(await publishMyXp({ user })).toBe(false);
  });

  it('does nothing with nobody signed in', async () => {
    expect(await publishMyXp({ user: null })).toBe(false);
    expect(await publishMyXp({ user: {} })).toBe(false);
    expect(await publishMyXp()).toBe(false);
    expect(global.__syncXp).not.toHaveBeenCalled();
  });

  it('never throws: a failed write just gives false', async () => {
    global.__syncXp = jest.fn(async () => { throw new Error('offline'); });
    expect(await publishMyXp({ user })).toBe(false);
    expect(warn).toHaveBeenCalledWith('[leaderboardVisibility] publish failed:', 'offline');
  });
});

describe('setShowInLeaderboards', () => {
  it('turning it off saves the setting and takes the person off the boards, publishing no XP', async () => {
    expect(await setShowInLeaderboards(false, user)).toBe(true);
    expect(global.__settings.updateSetting).toHaveBeenCalledWith('showInLeaderboards', false, 'u1');
    expect(global.__syncXp).not.toHaveBeenCalled();
    expect(global.__publishDistance).toHaveBeenCalledTimes(1);
    expect(global.__publishDistance).toHaveBeenCalledWith({ user, loadFirst: false });
  });

  it('saves the setting before it publishes, so the publish sees the new setting', async () => {
    let seen;
    global.__publishDistance = jest.fn(async () => { seen = global.__settings.showInLeaderboards; return true; });
    await setShowInLeaderboards(false, user);
    expect(seen).toBe(false);
  });

  it('turning it on saves the setting and puts the XP and then the distance back', async () => {
    global.__settings.showInLeaderboards = false;
    expect(await setShowInLeaderboards(true, user)).toBe(true);
    expect(global.__settings.updateSetting).toHaveBeenCalledWith('showInLeaderboards', true, 'u1');
    expect(global.__syncXp).toHaveBeenCalledTimes(1);
    expect(global.__syncXp.mock.calls[0][1]).toMatchObject({ xp: 1200, level: 4, streak: 6, visible: true });
    expect(global.__publishDistance).toHaveBeenCalledWith({ user, loadFirst: true });
    expect(mockLog).toEqual(['xp', 'distance']);
  });

  it('treats anything that is not a yes as off', async () => {
    await setShowInLeaderboards(0, user);
    expect(global.__settings.updateSetting).toHaveBeenCalledWith('showInLeaderboards', false, 'u1');
    expect(global.__syncXp).not.toHaveBeenCalled();
    await setShowInLeaderboards(1, user);
    expect(global.__settings.updateSetting).toHaveBeenLastCalledWith('showInLeaderboards', true, 'u1');
    expect(global.__publishDistance).toHaveBeenLastCalledWith({ user, loadFirst: true });
  });

  it('says the board does not match yet when the removal fails', async () => {
    global.__publishDistance = jest.fn(async () => false);
    expect(await setShowInLeaderboards(false, user)).toBe(false);
  });

  it('says the board does not match yet when the XP could not be put back', async () => {
    global.__syncXp = jest.fn(async () => false);
    expect(await setShowInLeaderboards(true, user)).toBe(false);
    expect(global.__publishDistance).toHaveBeenCalledTimes(1);
  });

  it('says the board does not match yet when the distance could not be put back', async () => {
    global.__publishDistance = jest.fn(async () => false);
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
    expect(global.__syncXp).not.toHaveBeenCalled();
    expect(global.__publishDistance).not.toHaveBeenCalled();
  });
});
