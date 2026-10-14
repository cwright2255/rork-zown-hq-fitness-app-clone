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
jest.mock('../services/raceBoard', () => ({
  publishMyRaces: (...a) => global.__publishRaces(...a),
  withdrawMyRaces: (...a) => global.__withdrawRaces(...a),
}));

import {
  isShownOnLeaderboards, publishMyXp, setShowInLeaderboards,
} from '../services/leaderboardVisibility';

// Not a streak of its own: the streak is passed in (services/streakService.js), the user record's old counter was never updated.
const user = { uid: 'u1', name: 'Cj', profileImage: 'https://img/p.png', streak: 99 };

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

describe('publishMyXp', () => {
  it('puts the person\'s XP, level and streak on the board under their name and picture', async () => {
    expect(await publishMyXp({ user, streak: 6 })).toBe(true);
    expect(global.__syncXp).toHaveBeenCalledTimes(1);
    expect(global.__syncXp).toHaveBeenCalledWith('u1', {
      name: 'Cj', avatar: 'https://img/p.png', xp: 1200, level: 4, streak: 6, visible: true,
    });
  });

  it('takes the streak it is given, not the old counter on the user record', async () => {
    await publishMyXp({ user, streak: 3 });
    expect(global.__syncXp.mock.calls[0][1].streak).toBe(3);
  });

  it('puts 0 when no usable streak is given', async () => {
    for (const streak of [undefined, null, NaN, -2, 'six', Infinity]) {
      global.__syncXp.mockClear();
      await publishMyXp({ user, streak });
      expect(global.__syncXp.mock.calls[0][1].streak).toBe(0);
    }
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
    expect(await setShowInLeaderboards(true, user, 6)).toBe(true);
    expect(global.__settings.updateSetting).toHaveBeenCalledWith('showInLeaderboards', true, 'u1');
    expect(global.__syncXp).toHaveBeenCalledTimes(1);
    expect(global.__syncXp.mock.calls[0][1]).toMatchObject({ xp: 1200, level: 4, streak: 6, visible: true });
    expect(global.__publishDistance).toHaveBeenCalledWith({ user, loadFirst: true });
    expect(mockLog).toEqual(['xp', 'distance', 'races']);
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
    expect(global.__syncXp).not.toHaveBeenCalled();
    expect(global.__publishDistance).not.toHaveBeenCalled();
    expect(global.__publishRaces).not.toHaveBeenCalled();
    expect(global.__withdrawRaces).not.toHaveBeenCalled();
  });
});
