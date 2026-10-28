// The Recommended Workouts row on Home (lib/homeRecommendations.js): real sessions from the Today's Session engine instead of four invented
// workouts. These use the real engine (lib/sessionPicker.js) and the real recovery model; only the cases that need the engine to answer a
// certain way (two ways giving the same exercises, a way that throws) stand it in with a spy.
import { buildHomeCards, homeVariants, startFromParams } from '../lib/homeRecommendations';
import * as picker from '../lib/sessionPicker';
import { pickSession, weeklyVolume, currentRungs, SESSION_RULES, EQUIPMENT_LABELS } from '../lib/sessionPicker';
import { calculateMuscleRecovery } from '../lib/muscleRecovery';
import { MUSCLES } from '../lib/muscleVocabulary';

const NOW = new Date('2026-10-23T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const ago = (days) => new Date(NOW.getTime() - days * DAY);
const lift = (name, n, rpe = 'hard') => ({ name, sets: n, done: true, performed: Array.from({ length: n }, () => ({ weight: 100, reps: 8, rpe })) });
const workout = (days, exercises) => ({ completedAt: ago(days).toISOString(), exercises });

// What readSessionInputs hands over, built from a list of finished workouts.
const inputsFor = (workouts = [], over = {}) => ({
  recovery: calculateMuscleRecovery({ completedWorkouts: workouts, runs: [], completedHikes: [], recovery: {}, now: NOW }),
  volume: weeklyVolume({ workouts, now: NOW }),
  ladderRungs: currentRungs(workouts),
  goal: 'muscle',
  level: 'intermediate',
  injuries: [],
  weights: {},
  excluded: [],
  ...over,
});

afterEach(() => { jest.restoreAllMocks(); });

describe('the ways to train offered on Home', () => {
  it('offers the usual time with a full gym, a quick one, and the usual time with dumbbells and with no equipment', () => {
    expect(homeVariants(30)).toEqual([
      { key: 'today', minutes: 30, equipment: 'gym' },
      { key: 'quick', minutes: 15, equipment: 'gym' },
      { key: 'dumbbells', minutes: 30, equipment: 'dumbbells' },
      { key: 'bodyweight', minutes: 30, equipment: 'bodyweight' },
    ]);
  });

  it('gives someone whose usual time is already the shortest a longer one instead of a repeat', () => {
    const v = homeVariants(15);
    expect(v[0].minutes).toBe(15);
    expect(v[1].minutes).toBe(30);
  });

  it('keeps a long usual time, and uses the default for a time the screen does not offer', () => {
    expect(homeVariants(60)[0].minutes).toBe(60);
    expect(homeVariants(60)[1].minutes).toBe(15);
    [20, 0, NaN, undefined, null, '30'].forEach((odd) => expect(homeVariants(odd)[0].minutes).toBe(SESSION_RULES.defaultMinutes));
  });
});

describe('the cards', () => {
  it('are sessions the engine really builds, named and counted the way the session screen will show them', () => {
    const inputs = inputsFor();
    const { cards, notice } = buildHomeCards({ inputs, preferredMinutes: 30 });
    expect(notice).toBeNull();
    expect(cards.length).toBeGreaterThanOrEqual(2);
    cards.forEach((card) => {
      const session = pickSession({ ...inputs, minutes: card.minutes, equipment: card.equipment });
      expect(session.status).toBe('ok');
      expect(card.title).toBe(session.name);
      expect(card.exercises).toBe(session.exercises.length);
      expect(card.sessionMinutes).toBe(session.minutes);
      expect(card.detail).toBe(`${session.minutes} min · ${session.exercises.length} exercises`);
      expect(card.preview).toBe(session.exercises.slice(0, 2).map((x) => x.name).join(', '));
      expect(card.equipmentLabel).toBe(EQUIPMENT_LABELS[card.equipment]);
    });
  });

  it('are none of the four invented workouts the row used to show', () => {
    const { cards } = buildHomeCards({ inputs: inputsFor(), preferredMinutes: 30 });
    const text = JSON.stringify(cards);
    ['HIIT Blast', 'Morning Yoga', 'Cardio Mix', 'Strength Core'].forEach((name) => expect(text).not.toContain(name));
  });

  it('mark only the usual-time full-gym session as today\'s, and put it first', () => {
    const { cards } = buildHomeCards({ inputs: inputsFor(), preferredMinutes: 45 });
    expect(cards[0]).toMatchObject({ key: 'today', today: true, minutes: 45, equipment: 'gym' });
    expect(cards.slice(1).every((c) => c.today === false)).toBe(true);
  });

  it('never show two cards with the same exercises', () => {
    [[], [workout(1, [lift('Bench Press', 4), lift('Overhead Press', 3)])], [workout(0.2, [lift('Back Squat', 5), lift('Deadlift', 4)])]].forEach((history) => {
      [15, 30, 45, 60].forEach((preferredMinutes) => {
        const { cards } = buildHomeCards({ inputs: inputsFor(history), preferredMinutes });
        const lists = cards.map((c) => pickSession({ ...inputsFor(history), minutes: c.minutes, equipment: c.equipment }).exercises.map((x) => x.id).join('|'));
        expect(new Set(lists).size).toBe(lists.length);
      });
    });
  });

  it('follow what the person did: the session after heavy leg work is not the one for a rested body', () => {
    const rested = buildHomeCards({ inputs: inputsFor(), preferredMinutes: 30 }).cards[0];
    const afterLegs = buildHomeCards({
      inputs: inputsFor([workout(0.2, [lift('Back Squat', 6), lift('Romanian Deadlift', 5), lift('Leg Press', 5)])]),
      preferredMinutes: 30,
    }).cards[0];
    expect(afterLegs.preview).not.toBe(rested.preview);
  });

  it('follow the injuries and the exercises the person excluded', () => {
    const inputs = inputsFor();
    const first = pickSession({ ...inputs, minutes: 30, equipment: 'gym' }).exercises[0];
    const { cards } = buildHomeCards({ inputs: { ...inputs, excluded: [first.id] }, preferredMinutes: 30 });
    const shown = cards.map((c) => c.preview).join(' | ');
    expect(shown).not.toContain(first.name);
  });

  it('are left out one at a time when the engine cannot build that way, without a notice while others remain', () => {
    const real = picker.pickSession;
    jest.spyOn(picker, 'pickSession').mockImplementation((o) => (o.equipment === 'bodyweight'
      ? { status: 'rest', message: 'bodyweight is resting', exercises: [] }
      : real(o)));
    const { cards, notice } = buildHomeCards({ inputs: inputsFor(), preferredMinutes: 30 });
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.some((c) => c.equipment === 'bodyweight')).toBe(false);
    expect(notice).toBeNull();
  });

  it('drop a way that gives the exercises of one already shown', () => {
    const real = picker.pickSession;
    jest.spyOn(picker, 'pickSession').mockImplementation((o) => (o.equipment === 'gym' ? real({ ...o, equipment: 'gym', minutes: 30 }) : real(o)));
    const { cards } = buildHomeCards({ inputs: inputsFor(), preferredMinutes: 30 });
    const gym = cards.filter((c) => c.equipment === 'gym');
    expect(gym).toHaveLength(1);
    expect(gym[0].key).toBe('today');
  });

  it('leave out a way that throws, and keep the rest', () => {
    const real = picker.pickSession;
    jest.spyOn(picker, 'pickSession').mockImplementation((o) => { if (o.equipment === 'dumbbells') throw new Error('boom'); return real(o); });
    const { cards } = buildHomeCards({ inputs: inputsFor(), preferredMinutes: 30 });
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.some((c) => c.equipment === 'dumbbells')).toBe(false);
  });

  it('say so, in the engine\'s words, when every muscle is still recovering', () => {
    const tired = Object.fromEntries(MUSCLES.map((m) => [m, 0]));
    const { cards, notice } = buildHomeCards({ inputs: inputsFor([], { recovery: tired }), preferredMinutes: 30 });
    expect(cards).toEqual([]);
    expect(notice).toBe(pickSession({ ...inputsFor([], { recovery: tired }), minutes: 30, equipment: 'gym' }).message);
    expect(notice).toMatch(/recovering/);
  });

  it('have no notice and no cards when the engine gives nothing to say', () => {
    jest.spyOn(picker, 'pickSession').mockImplementation(() => null);
    expect(buildHomeCards({ inputs: inputsFor(), preferredMinutes: 30 })).toEqual({ cards: [], notice: null });
  });

  it('do not break when given nothing', () => {
    expect(() => buildHomeCards()).not.toThrow();
    expect(() => buildHomeCards({ inputs: null, preferredMinutes: 30 })).not.toThrow();
    expect(buildHomeCards({ inputs: 'x', preferredMinutes: 30 }).cards.length).toBeGreaterThan(0);
  });

  it('count one exercise in the singular', () => {
    jest.spyOn(picker, 'pickSession').mockImplementation(() => ({
      status: 'ok', name: 'Chest', minutes: 12, exercises: [{ id: 'a', name: 'Push-up' }],
    }));
    const { cards } = buildHomeCards({ inputs: inputsFor(), preferredMinutes: 30 });
    expect(cards[0].detail).toBe('12 min · 1 exercise');
  });
});

describe('opening the session screen from a card', () => {
  it('starts with the time and equipment the card was for', () => {
    expect(startFromParams({ minutes: '45', equipment: 'dumbbells' }, 30)).toEqual({ minutes: 45, equipment: 'dumbbells' });
    expect(startFromParams({ minutes: 15, equipment: 'bodyweight' }, 30)).toEqual({ minutes: 15, equipment: 'bodyweight' });
  });

  it('starts with the person\'s own time and a full gym when opened any other way', () => {
    expect(startFromParams({}, 45)).toEqual({ minutes: 45, equipment: 'gym' });
    expect(startFromParams(undefined, 60)).toEqual({ minutes: 60, equipment: 'gym' });
    expect(startFromParams(null, 30)).toEqual({ minutes: 30, equipment: 'gym' });
  });

  it('takes only the times and the equipment the screen offers', () => {
    expect(startFromParams({ minutes: '20', equipment: 'pool' }, 30)).toEqual({ minutes: 30, equipment: 'gym' });
    expect(startFromParams({ minutes: 'abc', equipment: '' }, 45)).toEqual({ minutes: 45, equipment: 'gym' });
    expect(startFromParams({ minutes: '9999', equipment: '__proto__' }, 15)).toEqual({ minutes: 15, equipment: 'gym' });
    expect(startFromParams({ equipment: 'toString' }, 15).equipment).toBe('gym');
  });

  it('reads the first of a list, as the router can give one', () => {
    expect(startFromParams({ minutes: ['60', '15'], equipment: ['dumbbells', 'gym'] }, 30)).toEqual({ minutes: 60, equipment: 'dumbbells' });
  });
});
