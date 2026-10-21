// The achievements and badges are decided on the server (functions/src/unlockRules.js), and the phone shows them from its own catalogs
// (store/achievementStore.js, store/badgeStore.js) and its own Battle Pass screen (app/battlepass.jsx). These check the two sides agree: the
// same achievements with the same kind of progress and target, badges the phone has, and as many Battle Pass tiers as the server will claim.
const fs = require('fs');
const path = require('path');

jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));

import { useAchievementStore } from '../store/achievementStore';
import { useBadgeStore } from '../store/badgeStore';
import { ACHIEVEMENTS, BADGES, FACT_FOR_TYPE } from '../functions/src/unlockRules';
import { BATTLE_PASS_TIERS } from '../functions/src/unlocks';

describe('achievements', () => {
  const phone = useAchievementStore.getState().achievements;

  it('are the same list on the phone and on the server, in the same order, with the same kind and target', () => {
    expect(phone.map((a) => ({ id: a.id, type: a.condition.type, target: a.condition.target }))).toEqual(ACHIEVEMENTS);
  });

  it('are given a fact on the server for every kind the phone shows progress for', () => {
    // The Battle Pass screen draws a progress bar for these kinds (app/battlepass.jsx); the server must be able to unlock each of them.
    ['workout_count', 'streak', 'level', 'xp', 'calories_burned'].forEach((type) => expect(FACT_FOR_TYPE[type]).toBeDefined());
  });
});

describe('badges', () => {
  it('the server earns only badges the phone has in its catalog', () => {
    const store = useBadgeStore.getState();
    store.initializeDefaultBadges();
    const known = useBadgeStore.getState().badges.map((b) => b.id);
    BADGES.forEach((b) => expect(known).toContain(b.id));
  });
});

describe('the Battle Pass', () => {
  it('has as many tiers on the screen as the server will let a person claim', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'battlepass.jsx'), 'utf8');
    const rewards = source.slice(source.indexOf('const TIER_REWARDS = ['), source.indexOf('];', source.indexOf('const TIER_REWARDS = [')));
    const tiers = (rewards.match(/\{t:\d+,/g) || []).map((m) => Number(m.match(/\d+/)[0]));
    expect(tiers).toEqual(Array.from({ length: BATTLE_PASS_TIERS }, (_, i) => i + 1));
  });
});
