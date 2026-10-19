// How the phone follows the server's XP record (store/expStore.js): with a person signed in, what earns XP is filed as a claim, the
// XP on screen is the server's ledger with the claims still on their way added, and the ledger has the last word.
// jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
jest.mock('../src/config/firebase', () => ({ db: { stand: 'in' }, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useExpStore } from '../store/expStore';
import { applyClaim, emptyLedger, levelMultiplier } from '../lib/xpRules';

const NOW = new Date('2026-10-15T01:30:00Z').getTime();
const TODAY = '2026-10-14'; // the person's own day at NOW
const DAY = 86400000;
const INITIAL = useExpStore.getState();

const state = () => useExpStore.getState();
// Lets the sends that are started without being waited for finish.
const settle = async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); };

let sent;
let warn;
beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  useExpStore.setState(INITIAL, true);
  sent = [];
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  doc.mockReset();
  doc.mockImplementation((_db, ...parts) => ({ path: parts.join('/') }));
  setDoc.mockReset();
  setDoc.mockImplementation(async (ref, body) => { sent.push({ path: ref.path, body }); });
  getDoc.mockReset();
  getDoc.mockImplementation(async () => ({ exists: () => false }));
});
afterEach(() => { warn.mockRestore(); jest.useRealTimers(); });

const workout = (id = 'w1', baseExp = 400) => ({ id, type: 'workout', baseExp, multiplier: 1, date: TODAY });
const meal = (baseExp = 44) => ({ id: `m-${baseExp}`, type: 'meal', baseExp, multiplier: 1, date: TODAY });

// A ledger as the server would have kept it after these claims, so what the tests feed in is what the rules make, not a guess.
function ledgerOf(...claims) {
  let ledger = emptyLedger();
  claims.forEach(({ id, body }) => { ledger = applyClaim({ ledger, id, claim: body, now: NOW }).ledger; });
  return ledger;
}
const workoutClaim = (id, baseExp = 400) => ({ id, body: { kind: 'workout', day: TODAY, baseExp } });

// Signs in: the person's own XP is followed from here.
function signIn(uid = 'u1', { activeDays = [] } = {}) {
  state().beginXpSync(uid, { activeDays });
  return settle();
}

describe('nobody signed in: XP is counted on the phone alone, as it always was', () => {
  it('adds the activity\'s base, multiplied for the level, to the total and to today', () => {
    state().addExpActivity({ type: 'workout', baseExp: 200, multiplier: 1.5 });
    expect(state().expSystem.totalExp).toBe(Math.round(200 * levelMultiplier(1) * 1.5));
    expect(state().getDailyExp()).toBe(300);
    expect(state().expSystem.expSources.workouts).toBe(300);
  });

  it('files no claim and sends nothing', async () => {
    state().addExpActivity({ type: 'workout', baseExp: 200, multiplier: 1 });
    state().awardHydrationXp(8, 8);
    state().awardStepsXp(5000);
    state().awardMealXp('egg', meal(33));
    await settle();
    expect(state().pendingClaims).toEqual([]);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('pays hydration tiers and steps once each, the old way', () => {
    state().awardHydrationXp(4, 8);
    expect(state().expSystem.totalExp).toBe(11 + 22);
    state().awardHydrationXp(4, 8);
    expect(state().expSystem.totalExp).toBe(33);
    state().awardStepsXp(1000);
    expect(state().expSystem.totalExp).toBe(133);
    state().awardStepsXp(1000);
    expect(state().expSystem.totalExp).toBe(133);
  });

  it('pays a food once a day', () => {
    expect(state().awardMealXp('egg', meal(33))).toBe(true);
    expect(state().awardMealXp('egg', meal(33))).toBe(false);
    expect(state().awardMealXp('toast', meal(44))).toBe(true);
    expect(state().expSystem.totalExp).toBe(33 + 44);
  });
});

describe('signed in, not yet following the ledger', () => {
  it('files a claim for an activity and does not touch the total itself', async () => {
    state().addExpActivity(workout('w1', 450), 'u1');
    await settle();
    expect(state().expSystem.totalExp).toBe(0);
    expect(state().pendingClaims).toHaveLength(1);
    expect(state().pendingClaims[0]).toMatchObject({ id: 'workout-w1', uid: 'u1', body: { kind: 'workout', day: TODAY, baseExp: 450 } });
  });

  it('sends the claim to the person\'s own claims, with only what the rules allow in it', async () => {
    state().addExpActivity(workout('w1', 450), 'u1');
    await settle();
    expect(sent).toEqual([{ path: 'users/u1/xpClaims/workout-w1', body: { kind: 'workout', day: TODAY, baseExp: 450 } }]);
    expect(state().pendingClaims[0].sent).toBe(true);
  });

  it('files hydration and steps the same way, and nothing below the first tier or the first chunk of steps', async () => {
    state().awardHydrationXp(0, 8, 'u1');
    state().awardHydrationXp(1, 8, 'u1');
    state().awardStepsXp(499, 'u1');
    await settle();
    expect(state().pendingClaims).toEqual([]);
    state().awardHydrationXp(4, 8, 'u1');
    state().awardStepsXp(800, 'u1');
    await settle();
    expect(sent.map((s) => s.path)).toEqual([`users/u1/xpClaims/hydration-${TODAY}-2`, `users/u1/xpClaims/steps-${TODAY}-800`]);
  });

  it('files nothing for an activity that earns no XP on the server', async () => {
    state().addExpActivity({ type: 'event', baseExp: 500, multiplier: 1 }, 'u1');
    state().addExpActivity(null, 'u1');
    await settle();
    expect(state().pendingClaims).toEqual([]);
    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe('beginXpSync', () => {
  it('does nothing without a person', () => {
    state().beginXpSync(null);
    state().beginXpSync(undefined);
    expect(state().syncUid).toBeNull();
    expect(state().ownerUid).toBeNull();
    expect(state().importQueued).toBe(false);
  });

  it('starts following that person and remembers whose XP this phone holds', async () => {
    await signIn('u1');
    expect(state().syncUid).toBe('u1');
    expect(state().ownerUid).toBe('u1');
  });

  it('brings in the XP the phone had before, once, with the days that carry the streak over', async () => {
    state().addExp(2500);
    await signIn('u1', { activeDays: ['2026-10-12', '2026-10-13'] });
    expect(sent).toEqual([{
      path: 'users/u1/xpClaims/import-v1',
      body: { kind: 'import', day: TODAY, total: 2500, activeDays: ['2026-10-12', '2026-10-13'] },
    }]);
    expect(state().importQueued).toBe(true);
  });

  it('does not bring it in a second time, however often the app opens', async () => {
    state().addExp(2500);
    await signIn('u1');
    await signIn('u1');
    state().endXpSync();
    await signIn('u1');
    expect(sent.filter((s) => s.path.endsWith('import-v1'))).toHaveLength(1);
  });

  it('has nothing to bring in for a phone with no XP, and does not look again later', async () => {
    await signIn('u1');
    expect(sent).toEqual([]);
    expect(state().importQueued).toBe(true);
    state().addExp(900);
    await signIn('u1');
    expect(sent).toEqual([]);
  });

  it('shows the XP it brought in straight away, before the server has answered', async () => {
    state().addExp(2500);
    await signIn('u1');
    expect(state().expSystem.totalExp).toBe(2500);
    expect(state().expSystem.level).toBe(state().calculateLevelFromExp(2500));
  });

  it('shows all of the XP it brought in, however much it is: the server is the one that decides how much of it to keep', async () => {
    state().addExp(200000);
    await signIn('u1');
    expect(state().expSystem.totalExp).toBe(200000);
  });

  it('starts another person signing in on the same phone from nothing, not from the last person\'s XP', async () => {
    await signIn('u1');
    state().applyLedger('u1', ledgerOf(workoutClaim('workout-a', 1000)));
    expect(state().expSystem.totalExp).toBe(1000);
    state().endXpSync();
    sent.length = 0;

    await signIn('u2');
    expect(state().ownerUid).toBe('u2');
    expect(state().expSystem.totalExp).toBe(0);
    expect(state().serverLedger).toBeNull();
    expect(state().getDailyExp()).toBe(0);
    expect(state().xpHistory).toEqual({});
    expect(sent).toEqual([]);
  });

  it('shows another person\'s waiting claims to nobody, and sends them only when that person is back', async () => {
    state().addExpActivity(workout('w1', 450), 'u1');
    await settle();
    // The send did not get through (the app was closed first).
    useExpStore.setState({ pendingClaims: state().pendingClaims.map((c) => ({ ...c, sent: false })) });
    sent.length = 0;

    await signIn('u2');
    expect(state().expSystem.totalExp).toBe(0);
    expect(sent).toEqual([]);
    expect(state().pendingClaims).toHaveLength(1);

    state().endXpSync();
    await signIn('u1');
    expect(sent.map((s) => s.path)).toEqual(['users/u1/xpClaims/workout-w1']);
  });

  it('keeps a person\'s own XP when they are the one who signs in again', async () => {
    await signIn('u1');
    state().applyLedger('u1', ledgerOf(workoutClaim('workout-a', 1000)));
    state().endXpSync();
    await signIn('u1');
    expect(state().expSystem.totalExp).toBe(1000);
    expect(state().serverLedger.total).toBe(1000);
  });

  it('sends the claims that were waiting when the app was closed', async () => {
    useExpStore.setState({
      ownerUid: 'u1',
      importQueued: true,
      pendingClaims: [{ id: 'workout-old', uid: 'u1', body: { kind: 'workout', day: TODAY, baseExp: 300 }, at: NOW - 1000, sent: false }],
    });
    await signIn('u1');
    expect(sent).toEqual([{ path: 'users/u1/xpClaims/workout-old', body: { kind: 'workout', day: TODAY, baseExp: 300 } }]);
    expect(state().expSystem.totalExp).toBe(300);
  });
});

describe('what is on screen: the ledger with the claims on their way added', () => {
  beforeEach(() => signIn('u1'));

  it('counts a workout up the moment it is done, before anything is sent', async () => {
    let answer;
    setDoc.mockImplementation(() => new Promise((resolve) => { answer = resolve; })); // the network has not answered yet
    state().addExpActivity(workout('w1', 400), 'u1');
    expect(state().expSystem.totalExp).toBe(400);
    expect(state().getDailyExp()).toBe(400);
    expect(state().xpHistory[TODAY]).toBe(400);
    expect(state().pendingClaims[0].sent).toBe(false);
    answer();
    await settle();
    expect(state().pendingClaims[0].sent).toBe(true);
  });

  it('keeps the level and the XP to the next level in step with the total', () => {
    state().addExpActivity(workout('w1', 1000), 'u1');
    state().addExpActivity(workout('w2', 1000), 'u1');
    const { totalExp, level, expToNextLevel } = state().expSystem;
    // The first workout takes the person to level 2, so the second is worth 3.6% more.
    expect(totalExp).toBe(1000 + Math.round(1000 * levelMultiplier(2)));
    expect(level).toBe(state().calculateLevelFromExp(totalExp));
    expect(totalExp + expToNextLevel).toBe(state().getExpForLevel(level + 1));
  });

  it('scales the next claim by the level the ledger says the person is at', () => {
    useExpStore.setState({ serverLedger: { ...ledgerOf(), total: 30000, level: 20 } });
    state()._show();
    const before = state().expSystem.totalExp;
    state().addExpActivity(workout('w1', 1000), 'u1');
    expect(state().expSystem.totalExp - before).toBe(Math.round(1000 * levelMultiplier(state().calculateLevelFromExp(before))));
  });

  it('shows the ledger when nothing is waiting', () => {
    state().applyLedger('u1', ledgerOf(workoutClaim('workout-a', 700)));
    expect(state().expSystem.totalExp).toBe(700);
    expect(state().getDailyExp()).toBe(700);
  });

  it('does not change what the old per-source totals say', () => {
    state().addExpActivity(workout('w1', 400), 'u1');
    expect(state().expSystem.expSources).toEqual({ workouts: 0, nutrition: 0, social: 0 });
  });

  it('puts every day the ledger holds into the history', () => {
    const older = { id: 'workout-old', body: { kind: 'workout', day: '2026-10-10', baseExp: 200 } };
    state().applyLedger('u1', ledgerOf(older, workoutClaim('workout-a', 700)));
    expect(state().xpHistory['2026-10-10']).toBe(200);
    expect(state().xpHistory[TODAY]).toBe(700);
  });
});

describe('_file', () => {
  beforeEach(() => signIn('u1'));

  it('says what a claim will be worth, and that it was kept', () => {
    expect(state()._file('u1', workoutClaim('workout-a', 500))).toEqual({ queued: true, amount: 500 });
  });

  it('keeps one claim once: the same id again is not filed again', async () => {
    state().addExpActivity(workout('w1', 400), 'u1');
    state().addExpActivity(workout('w1', 400), 'u1');
    await settle();
    expect(state().pendingClaims).toHaveLength(1);
    expect(sent).toHaveLength(1);
    expect(state().expSystem.totalExp).toBe(400);
  });

  it('does not file a claim the ledger already has', async () => {
    state().applyLedger('u1', ledgerOf(workoutClaim('workout-w1', 400)));
    state().addExpActivity(workout('w1', 400), 'u1');
    await settle();
    expect(state().pendingClaims).toEqual([]);
    expect(sent).toEqual([]);
    expect(state().expSystem.totalExp).toBe(400);
  });

  it('does not file a claim the server would turn away, and shows nothing for it', async () => {
    // Plans are worth 1125 and no more than twice a day.
    state().addExpActivity({ id: 'p1', type: 'mainMission', baseExp: 1125, multiplier: 1, date: TODAY }, 'u1');
    state().addExpActivity({ id: 'p2', type: 'mainMission', baseExp: 1125, multiplier: 1, date: TODAY }, 'u1');
    state().addExpActivity({ id: 'p3', type: 'mainMission', baseExp: 1125, multiplier: 1, date: TODAY }, 'u1');
    await settle();
    expect(state().pendingClaims).toHaveLength(2);
    expect(state().expSystem.totalExp).toBe(1125 + Math.round(1125 * levelMultiplier(2))); // the first takes the person to level 2
    expect(sent).toHaveLength(2);
  });

  it('files nothing for nobody, or for nothing', () => {
    expect(state()._file(null, workoutClaim('workout-a'))).toEqual({ queued: false, amount: 0 });
    expect(state()._file('u1', null)).toEqual({ queued: false, amount: 0 });
    expect(state().pendingClaims).toEqual([]);
  });
});

describe('meals', () => {
  beforeEach(() => signIn('u1'));

  it('pays a food once a day: the second time is not filed, and says so', async () => {
    expect(state().awardMealXp('egg', meal(33), 'u1')).toBe(true);
    expect(state().awardMealXp('egg', { ...meal(33), id: 'another-log' }, 'u1')).toBe(false);
    await settle();
    expect(state().pendingClaims).toHaveLength(1);
    expect(sent[0].body).toEqual({ kind: 'meal', day: TODAY, baseExp: 33, foodKey: 'egg' });
    expect(state().expSystem.totalExp).toBe(33);
  });

  it('pays every different food', () => {
    expect(state().awardMealXp('egg', { ...meal(33), id: 'a' }, 'u1')).toBe(true);
    expect(state().awardMealXp('toast', { ...meal(44), id: 'b' }, 'u1')).toBe(true);
    expect(state().awardMealXp('rice', { ...meal(55), id: 'c' }, 'u1')).toBe(true);
    expect(state().expSystem.totalExp).toBe(33 + 44 + 55);
  });

  it('treats a food the same however it is capitalised or spaced', () => {
    expect(state().awardMealXp('Egg ', { ...meal(33), id: 'a' }, 'u1')).toBe(true);
    expect(state().awardMealXp(' egg', { ...meal(33), id: 'b' }, 'u1')).toBe(false);
  });

  it('says nothing was kept for a meal worth a base the rules do not know', () => {
    expect(state().awardMealXp('egg', { ...meal(40), id: 'a' }, 'u1')).toBe(false);
    expect(state().pendingClaims).toEqual([]);
  });
});

describe('hydration', () => {
  beforeEach(() => signIn('u1'));

  it('files the tier reached, and pays for each tier below it that was not paid', async () => {
    state().awardHydrationXp(4, 8, 'u1'); // half the target is tier 2
    await settle();
    expect(sent).toEqual([{ path: `users/u1/xpClaims/hydration-${TODAY}-2`, body: { kind: 'hydration', day: TODAY, tier: 2 } }]);
    expect(state().expSystem.totalExp).toBe(11 + 22);
  });

  it('pays only for the new tier when more is drunk, and nothing for a tier already paid', async () => {
    state().awardHydrationXp(4, 8, 'u1');
    state().awardHydrationXp(4, 8, 'u1');
    state().awardHydrationXp(2, 8, 'u1');
    expect(state().pendingClaims).toHaveLength(1);
    state().awardHydrationXp(6, 8, 'u1'); // tier 3
    expect(state().pendingClaims).toHaveLength(2);
    expect(state().expSystem.totalExp).toBe(11 + 22 + 33);
  });

  it('stops at the fifth tier however much more is drunk', () => {
    state().awardHydrationXp(40, 8, 'u1');
    expect(state().pendingClaims[0].body.tier).toBe(5);
    expect(state().expSystem.totalExp).toBe(11 + 22 + 33 + 44 + 55);
  });

  it('files nothing below the first tier or with no target', () => {
    state().awardHydrationXp(0, 8, 'u1');
    state().awardHydrationXp(1, 8, 'u1');
    state().awardHydrationXp(5, 0, 'u1');
    state().awardHydrationXp(5, undefined, 'u1');
    expect(state().pendingClaims).toEqual([]);
  });
});

describe('steps', () => {
  beforeEach(() => signIn('u1'));

  it('files nothing until the steps have gone up by a chunk of 500', () => {
    state().awardStepsXp(300, 'u1');
    state().awardStepsXp(499, 'u1');
    expect(state().pendingClaims).toEqual([]);
    state().awardStepsXp(500, 'u1');
    expect(state().pendingClaims).toHaveLength(1);
    expect(state().pendingClaims[0].body).toEqual({ kind: 'steps', day: TODAY, steps: 500 });
    expect(state().expSystem.totalExp).toBe(50);
  });

  it('claims the steps counted so far, and the server pays only the new ones', () => {
    state().awardStepsXp(1000, 'u1');
    state().awardStepsXp(1200, 'u1'); // 200 on: not yet worth a claim
    expect(state().pendingClaims).toHaveLength(1);
    state().awardStepsXp(1600, 'u1');
    expect(state().pendingClaims).toHaveLength(2);
    expect(state().pendingClaims[1].body.steps).toBe(1600);
    expect(state().expSystem.totalExp).toBe(160);
  });

  it('counts the chunk from what the server has paid, not from what was last asked', async () => {
    state().applyLedger('u1', ledgerOf({ id: 'steps-a', body: { kind: 'steps', day: TODAY, steps: 3000 } }));
    state().awardStepsXp(3400, 'u1');
    expect(state().pendingClaims).toEqual([]);
    state().awardStepsXp(3500, 'u1');
    expect(state().pendingClaims).toHaveLength(1);
  });

  it('claims no more than the steps a day can hold', () => {
    state().awardStepsXp(250000, 'u1');
    expect(state().pendingClaims[0].body.steps).toBe(60000);
  });

  it('files nothing for steps that are not a number, or none', () => {
    state().awardStepsXp(0, 'u1');
    state().awardStepsXp(-20, 'u1');
    state().awardStepsXp(NaN, 'u1');
    state().awardStepsXp(undefined, 'u1');
    expect(state().pendingClaims).toEqual([]);
  });
});

describe('flushClaims', () => {
  beforeEach(() => signIn('u1'));

  it('sends each claim once, even when asked again while it is on its way', async () => {
    let release;
    setDoc.mockImplementation((ref, body) => new Promise((resolve) => { release = () => { sent.push({ path: ref.path, body }); resolve(); }; }));
    state().addExpActivity(workout('w1', 400), 'u1');
    const second = state().flushClaims('u1');
    const third = state().flushClaims('u1');
    await settle();
    release();
    await Promise.all([second, third]);
    await settle();
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(state().pendingClaims[0].sent).toBe(true);
  });

  it('does not send a claim again once it has been sent', async () => {
    state().addExpActivity(workout('w1', 400), 'u1');
    await settle();
    await state().flushClaims('u1');
    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  it('sends only the signed-in person\'s claims', async () => {
    useExpStore.setState({ pendingClaims: [
      { id: 'workout-x', uid: 'u2', body: { kind: 'workout', day: TODAY, baseExp: 300 }, at: NOW, sent: false },
    ] });
    await state().flushClaims('u1');
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('does nothing without a person', async () => {
    state().addExpActivity(workout('w1', 400), 'u1');
    setDoc.mockClear();
    useExpStore.setState({ pendingClaims: state().pendingClaims.map((c) => ({ ...c, sent: false })) });
    await state().flushClaims(null);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('keeps a claim that could not be sent, shows its XP anyway, and tries again at the next chance', async () => {
    setDoc.mockImplementationOnce(async () => { throw new Error('offline'); });
    state().addExpActivity(workout('w1', 400), 'u1');
    await settle();
    expect(state().pendingClaims).toHaveLength(1);
    expect(state().pendingClaims[0].sent).toBe(false);
    expect(state().expSystem.totalExp).toBe(400);
    expect(warn).toHaveBeenCalledWith('[expStore] claim not sent yet:', 'offline');

    await state().flushClaims('u1');
    expect(sent).toEqual([{ path: 'users/u1/xpClaims/workout-w1', body: { kind: 'workout', day: TODAY, baseExp: 400 } }]);
    expect(state().pendingClaims[0].sent).toBe(true);
  });

  it('sends the rest when one cannot be sent', async () => {
    setDoc.mockImplementationOnce(async () => { throw new Error('offline'); });
    state().addExpActivity(workout('w1', 400), 'u1');
    state().addExpActivity(workout('w2', 300), 'u1');
    await settle();
    expect(sent.map((s) => s.path)).toEqual(['users/u1/xpClaims/workout-w2']);
  });

  it('finds that a claim is already there (sent before, and the answer was lost) and does not send it again', async () => {
    setDoc.mockImplementationOnce(async () => { throw new Error('permission-denied'); });
    getDoc.mockImplementation(async () => ({ exists: () => true, data: () => ({ kind: 'workout' }) }));
    state().addExpActivity(workout('w1', 400), 'u1');
    await settle();
    expect(state().pendingClaims).toHaveLength(1);
    expect(state().pendingClaims[0].sent).toBe(true);
    expect(getDoc).toHaveBeenCalledWith({ path: 'users/u1/xpClaims/workout-w1' });
    await state().flushClaims('u1');
    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  it('stops waiting for a claim the server has already counted', async () => {
    setDoc.mockImplementationOnce(async () => { throw new Error('permission-denied'); });
    getDoc.mockImplementation(async () => ({ exists: () => true, data: () => ({ kind: 'workout', processedAt: '2026-10-14T20:00:00Z' }) }));
    state().applyLedger('u1', ledgerOf(workoutClaim('workout-other', 100)));
    state().addExpActivity(workout('w1', 400), 'u1');
    await settle();
    expect(state().pendingClaims).toEqual([]);
    // The ledger will bring its XP; until it does the screen shows the ledger as it stands.
    expect(state().expSystem.totalExp).toBe(100);
  });
});

describe('applyLedger', () => {
  beforeEach(() => signIn('u1'));

  it('follows only the person being followed', () => {
    state().applyLedger('u2', ledgerOf(workoutClaim('workout-a', 700)));
    expect(state().serverLedger).toBeNull();
    expect(state().expSystem.totalExp).toBe(0);
    state().applyLedger(null, ledgerOf(workoutClaim('workout-a', 700)));
    expect(state().serverLedger).toBeNull();
  });

  it('follows nobody once following has stopped', () => {
    state().endXpSync();
    state().applyLedger('u1', ledgerOf(workoutClaim('workout-a', 700)));
    expect(state().serverLedger).toBeNull();
  });

  it('stops waiting for the claims the ledger has dealt with, and keeps the rest', async () => {
    setDoc.mockImplementation(async () => undefined);
    state().addExpActivity(workout('w1', 400), 'u1');
    state().addExpActivity(workout('w2', 300), 'u1');
    await settle();
    state().applyLedger('u1', ledgerOf(workoutClaim('workout-w1', 400)));
    expect(state().pendingClaims.map((c) => c.id)).toEqual(['workout-w2']);
    expect(state().expSystem.totalExp).toBe(700); // the ledger's 400 and the claim still on its way
  });

  it('settles on the server\'s number when it is not the one the phone worked out', () => {
    state().addExpActivity(workout('w1', 400), 'u1');
    expect(state().expSystem.totalExp).toBe(400);
    // The server counted it for less (the phone's reckoning was off): the screen follows the server.
    const ledger = ledgerOf(workoutClaim('workout-w1', 250));
    state().applyLedger('u1', ledger);
    expect(state().pendingClaims).toEqual([]);
    expect(state().expSystem.totalExp).toBe(250);
  });

  it('shows what the server has when it has nothing for the person yet, and keeps waiting claims', () => {
    state().addExpActivity(workout('w1', 400), 'u1');
    state().applyLedger('u1', null);
    expect(state().serverLedger).toBeNull();
    expect(state().pendingClaims).toHaveLength(1);
    expect(state().expSystem.totalExp).toBe(400);
  });

  it('gives up on a claim the server has not dealt with in two weeks, once it has heard from the server', () => {
    useExpStore.setState({ pendingClaims: [
      { id: 'workout-stale', uid: 'u1', body: { kind: 'workout', day: TODAY, baseExp: 300 }, at: NOW - 15 * DAY, sent: true },
      { id: 'workout-fresh', uid: 'u1', body: { kind: 'workout', day: TODAY, baseExp: 200 }, at: NOW - 13 * DAY, sent: true },
    ] });
    state().applyLedger('u1', ledgerOf(workoutClaim('workout-a', 100)));
    expect(state().pendingClaims.map((c) => c.id)).toEqual(['workout-fresh']);
  });

  it('does not give up on any claim while the server has said nothing', () => {
    useExpStore.setState({ pendingClaims: [
      { id: 'workout-stale', uid: 'u1', body: { kind: 'workout', day: TODAY, baseExp: 300 }, at: NOW - 30 * DAY, sent: false },
    ] });
    state().applyLedger('u1', null);
    expect(state().pendingClaims).toHaveLength(1);
  });

  it('leaves another person\'s waiting claims alone', () => {
    useExpStore.setState({ pendingClaims: [
      { id: 'workout-theirs', uid: 'u2', body: { kind: 'workout', day: TODAY, baseExp: 300 }, at: NOW - 30 * DAY, sent: false },
    ] });
    state().applyLedger('u1', ledgerOf(workoutClaim('workout-theirs', 100)));
    expect(state().pendingClaims).toHaveLength(1);
  });

  it('sends what is still unsent', async () => {
    setDoc.mockImplementationOnce(async () => { throw new Error('offline'); });
    state().addExpActivity(workout('w1', 400), 'u1');
    await settle();
    expect(sent).toEqual([]);
    state().applyLedger('u1', ledgerOf());
    await settle();
    expect(sent.map((s) => s.path)).toEqual(['users/u1/xpClaims/workout-w1']);
  });

  it('copes with a ledger that is missing parts', () => {
    state().applyLedger('u1', { total: 500 });
    expect(state().expSystem.totalExp).toBe(500);
    state().applyLedger('u1', {});
    expect(state().expSystem.totalExp).toBe(0);
  });
});

describe('endXpSync', () => {
  it('stops following, and the screen stops being driven by the ledger', async () => {
    await signIn('u1');
    state().applyLedger('u1', ledgerOf(workoutClaim('workout-a', 700)));
    state().endXpSync();
    expect(state().syncUid).toBeNull();
    state()._show();
    expect(state().expSystem.totalExp).toBe(700);
    useExpStore.setState({ serverLedger: { ...ledgerOf(), total: 9999 } });
    state()._show();
    expect(state().expSystem.totalExp).toBe(700);
  });

  it('can be called with nothing started', () => {
    expect(() => state().endXpSync()).not.toThrow();
  });
});

describe('loadXP', () => {
  it('is left to the ledger once the ledger is being followed', async () => {
    await signIn('u1');
    await state().loadXP('u1');
    expect(getDoc).not.toHaveBeenCalled();
  });

  it('still reads the old saved record when the ledger is not being followed', async () => {
    getDoc.mockImplementation(async () => ({ exists: () => true, data: () => ({ totalExp: 800 }) }));
    await state().loadXP('u1');
    expect(getDoc).toHaveBeenCalledWith({ path: 'users/u1/data/xp' });
    expect(state().expSystem.totalExp).toBe(800);
  });

  it('reads the old record for a person the ledger is not following', async () => {
    await signIn('u1');
    getDoc.mockImplementation(async () => ({ exists: () => true, data: () => ({ totalExp: 800 }) }));
    await state().loadXP('u2');
    expect(getDoc).toHaveBeenCalledWith({ path: 'users/u2/data/xp' });
  });

  it('does nothing without a person', async () => {
    await state().loadXP(null);
    expect(getDoc).not.toHaveBeenCalled();
  });
});

describe('what is kept on the phone', () => {
  const kept = () => useExpStore.persist.getOptions().partialize(state());

  it('keeps the ledger, the waiting claims, whose XP it is, and whether it was brought in', async () => {
    await signIn('u1');
    state().addExpActivity(workout('w1', 400), 'u1');
    await settle();
    const saved = kept();
    expect(saved.pendingClaims).toHaveLength(1);
    expect(saved.ownerUid).toBe('u1');
    expect(saved.importQueued).toBe(true);
    expect(saved).toHaveProperty('serverLedger');
  });

  it('does not keep who is being followed: following starts again each time the app opens', async () => {
    await signIn('u1');
    expect(kept()).not.toHaveProperty('syncUid');
  });
});
