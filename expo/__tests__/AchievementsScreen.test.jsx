// The Achievements screen (app/profile/achievements.jsx), which Profile > Achievements > View All now opens. Before this build View All
// opened a different page, app/achievements.jsx, that was typed in ("12 / 20 Achievements Unlocked", "2,550 XP Earned") and was
// deleted. The real screen had problems of its own, found when it was first read end to end: it took its XP and level from user
// fields that nothing fills in (so it said 0 XP, level 1), its photo from a field that does not exist, showed only nine badges, and
// made up "Challenge 1" cards at 50%. These look at it with the real stores.
import React from 'react';
import fs from 'fs';
import path from 'path';
import { Image, StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => (name === '__esModule' ? false : name) }), { virtual: true });
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
}), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
const mockUser = { current: null };
jest.mock('@/store/userStore', () => ({ useUserStore: (sel) => sel({ user: mockUser.current }) }));
jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((db, ...p) => ({ path: p.join('/') })),
  getDoc: jest.fn(async () => ({ exists: () => false })),
  setDoc: jest.fn(async () => undefined),
}));

import { router as mockRouter } from 'expo-router';
import { useAchievementStore } from '../store/achievementStore';
import { useBadgeStore } from '../store/badgeStore';
import { useExpStore } from '../store/expStore';
import AchievementsScreen from '../app/profile/achievements';

const ROOT = path.join(__dirname, '..');
const BADGE_COUNT = 15;
const ACHIEVEMENT_COUNT = 15;

let loadXP;
let loadAchievements;
let loadBadges;
const withXp = (totalExp) => {
  const level = useExpStore.getState().calculateLevelFromExp(totalExp);
  const base = useExpStore.getState().expSystem;
  useExpStore.setState({ expSystem: { ...base, totalExp, level } });
  return level;
};
const signIn = (user) => { mockUser.current = user; };

beforeEach(() => {
  jest.clearAllMocks();
  loadXP = jest.fn();
  loadAchievements = jest.fn();
  loadBadges = jest.fn();
  useExpStore.setState({ loadXP });
  useAchievementStore.setState({ loadAchievements });
  useBadgeStore.setState({ loadBadges });
  useAchievementStore.getState().clearServerUnlocks();
  useBadgeStore.getState().initializeDefaultBadges();
  useBadgeStore.getState().clearServerUnlocks();
  withXp(0);
  signIn({ uid: 'u1', name: 'Cj', photoURL: '' });
});

describe('XP and level', () => {
  it('are the ones Profile shows (the XP store), not fields on the user that nothing fills in', () => {
    const level = withXp(2500);
    signIn({ uid: 'u1', name: 'Cj', xp: 27975, level: 12 });
    const utils = render(<AchievementsScreen />);
    expect(utils.getByText('2,500 XP')).toBeTruthy();
    expect(utils.getByText(`Level ${level}`)).toBeTruthy();
    expect(utils.queryByText(/27,975/)).toBeNull();
    expect(utils.queryByText('Level 12')).toBeNull();
  });

  it('start at 0 XP and Level 1 for a new account', () => {
    const utils = render(<AchievementsScreen />);
    expect(utils.getByText('0 XP')).toBeTruthy();
    expect(utils.getByText('Level 1')).toBeTruthy();
  });

  it('are rounded to whole XP', () => {
    withXp(1234.6);
    expect(render(<AchievementsScreen />).getByText('1,235 XP')).toBeTruthy();
  });
});

describe('the ring around the photo', () => {
  // The ring is drawn as two half circles that turn: the first up to 180 degrees, the second for what is past half way.
  const turns = (utils) => utils.UNSAFE_root
    .findAll((n) => typeof n.type === 'string' && StyleSheet.flatten(n.props.style)?.transform?.[0]?.rotate)
    .map((n) => StyleSheet.flatten(n.props.style).transform[0].rotate);
  const atShare = (share) => {
    const { getExpForLevel } = useExpStore.getState();
    const start = getExpForLevel(3);
    withXp(start + (getExpForLevel(4) - start) * share);
  };

  it('is empty at the start of a level', () => {
    atShare(0);
    expect(turns(render(<AchievementsScreen />))).toEqual(['0deg']);
  });

  it('is half full half way to the next level', () => {
    atShare(0.5);
    expect(turns(render(<AchievementsScreen />))).toEqual(['180deg']);
  });

  it('is three quarters full three quarters of the way', () => {
    atShare(0.75);
    expect(turns(render(<AchievementsScreen />))).toEqual(['180deg', '270deg']);
  });

  it('is a quarter full a quarter of the way', () => {
    atShare(0.25);
    expect(turns(render(<AchievementsScreen />))).toEqual(['90deg']);
  });
});

describe('the photo', () => {
  it('is the profile photo (photoURL), the one Profile shows', () => {
    signIn({ uid: 'u1', name: 'Cj', photoURL: 'https://img/cj.png' });
    const utils = render(<AchievementsScreen />);
    expect(utils.UNSAFE_getAllByType(Image).map((i) => i.props.source.uri)).toEqual(['https://img/cj.png']);
  });

  it('is not taken from an "avatar" field, which nothing fills in', () => {
    signIn({ uid: 'u1', name: 'Cj', avatar: 'https://img/not-this.png' });
    const utils = render(<AchievementsScreen />);
    expect(utils.UNSAFE_queryAllByType(Image)).toHaveLength(0);
    expect(utils.getByText('C')).toBeTruthy();
  });

  it('is the first letter of the name when there is none', () => {
    const utils = render(<AchievementsScreen />);
    expect(utils.UNSAFE_queryAllByType(Image)).toHaveLength(0);
    expect(utils.getByText('C')).toBeTruthy();
  });
});

describe('the badges', () => {
  it('shows every badge, not only the first nine', () => {
    const utils = render(<AchievementsScreen />);
    const names = useBadgeStore.getState().badges.map((b) => b.name);
    expect(names).toHaveLength(BADGE_COUNT);
    // "Fitness Legend" and "Trailblazer" are later than the ninth.
    for (const name of names) expect(utils.getAllByText(name).length).toBeGreaterThan(0);
    expect(utils.getByText('Trailblazer')).toBeTruthy();
  });

  it('shows the ones the server has unlocked in full and the rest faded', () => {
    const faded = (utils) => utils.UNSAFE_root.findAll((n) => typeof n.type === 'string' && StyleSheet.flatten(n.props.style)?.opacity === 0.4);
    const first = render(<AchievementsScreen />);
    expect(faded(first)).toHaveLength(BADGE_COUNT);
    first.unmount();
    useBadgeStore.getState().applyServerUnlocks({ 'badge-1': '2026-10-01T00:00:00Z', 'badge-2': '2026-10-02T00:00:00Z' });
    expect(faded(render(<AchievementsScreen />))).toHaveLength(BADGE_COUNT - 2);
  });
});

describe('the achievements', () => {
  it('lists every one in the catalog with what it asks for, and none that were made up', () => {
    const utils = render(<AchievementsScreen />);
    const { achievements } = useAchievementStore.getState();
    expect(achievements).toHaveLength(ACHIEVEMENT_COUNT);
    // A name can also be a badge's ("Fitness Legend" is both), so each is found by what it asks for, which is its own.
    for (const a of achievements) {
      expect(utils.getByText(a.description)).toBeTruthy();
      expect(utils.getAllByText(a.name).length).toBeGreaterThan(0);
    }
    for (const made of [/Challenge \d/, /Season \d/i, /^\d+%$/, /12 \/ 20/, /Achievements Unlocked/, /2,550/]) {
      expect(utils.queryByText(made)).toBeNull();
    }
  });

  it('counts the ones the server has unlocked, and says which', () => {
    useAchievementStore.getState().applyServerUnlocks({ 'first-workout': '2026-09-01T00:00:00Z', 'level-5': '2026-10-14T10:00:00Z' });
    const utils = render(<AchievementsScreen />);
    expect(utils.getByText(`2 OF ${ACHIEVEMENT_COUNT} UNLOCKED`)).toBeTruthy();
    expect(utils.getAllByText('Unlocked')).toHaveLength(2);
    expect(utils.getAllByText('Locked')).toHaveLength(ACHIEVEMENT_COUNT - 2);
  });

  it('puts the unlocked ones first', () => {
    useAchievementStore.getState().applyServerUnlocks({ 'xp-5000': '2026-10-01T00:00:00Z' });
    const utils = render(<AchievementsScreen />);
    const { achievements } = useAchievementStore.getState();
    const descriptions = achievements.map((a) => a.description);
    const order = utils.UNSAFE_root.findAll((n) => n.type === 'Text' && descriptions.includes(n.props.children)).map((n) => n.props.children);
    expect(order).toHaveLength(ACHIEVEMENT_COUNT);
    expect(order[0]).toBe(achievements.find((a) => a.id === 'xp-5000').description);
    // The rest stay in the catalog's order.
    expect(order.slice(1)).toEqual(achievements.filter((a) => a.id !== 'xp-5000').map((a) => a.description));
  });

  it('says 0 unlocked, with everything locked, for someone who has unlocked nothing', () => {
    const utils = render(<AchievementsScreen />);
    expect(utils.getByText(`0 OF ${ACHIEVEMENT_COUNT} UNLOCKED`)).toBeTruthy();
    expect(utils.queryAllByText('Unlocked')).toHaveLength(0);
  });
});

describe('opening the screen', () => {
  it('asks for this person\'s XP, achievements and badges', () => {
    render(<AchievementsScreen />);
    expect(loadXP).toHaveBeenCalledWith('u1');
    expect(loadAchievements).toHaveBeenCalledWith('u1');
    expect(loadBadges).toHaveBeenCalledWith('u1');
  });

  it('asks for nothing when nobody is signed in', () => {
    signIn(null);
    render(<AchievementsScreen />);
    expect(loadXP).not.toHaveBeenCalled();
    expect(loadAchievements).not.toHaveBeenCalled();
    expect(loadBadges).not.toHaveBeenCalled();
  });

  it('goes back with the arrow', () => {
    const utils = render(<AchievementsScreen />);
    fireEvent.press(utils.getByLabelText('Back'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });
});

describe('getting to it', () => {
  const profile = fs.readFileSync(path.join(ROOT, 'app', 'profile.jsx'), 'utf8');

  it('is where View All on Profile goes', () => {
    expect(profile).toContain("router.push('/profile/achievements')");
  });

  it('is the only Achievements page: the typed-in one is gone and nothing sends anyone to it', () => {
    expect(fs.existsSync(path.join(ROOT, 'app', 'achievements.jsx'))).toBe(false);
    expect(profile).not.toMatch(/router\.(push|replace)\(['"]\/achievements['"]\)/);
  });
});
