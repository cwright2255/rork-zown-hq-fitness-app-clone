jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn(), setDoc: jest.fn(async () => undefined) }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('@/store/nutritionStore', () => ({
  useNutritionStore: { getState: () => ({ addFoodToMeal: (...a) => global.__addFood(...a) }) },
}));

import { useMealPlanStore } from '../store/mealPlanStore';
import { logPlannedEntry, logPlannedDay } from '../services/mealPlanLog';

const TODAY = '2026-10-09';
const chili = { id: 'r1', title: 'Chili', servings: 4, calories: 400, protein: 30, carbs: 40, fat: 12 };
const oats = { id: 'f1', name: 'Oats', servingSize: '40g', calories: 150, protein: 5, carbs: 27, fat: 3 };

const plan = () => useMealPlanStore.getState();
const add = (kind, options) => (kind === 'recipe' ? plan().addRecipe(chili, options) : plan().addFood(oats, options)).entry;
const find = (id) => plan().entries.find((e) => e.id === id);

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-09T12:00:00Z'), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  global.__addFood = jest.fn();
  useMealPlanStore.setState({ entries: [], syncUid: null });
});
afterEach(() => { jest.useRealTimers(); });

describe('logPlannedEntry', () => {
  it('puts a recipe in the diary on its day and meal at the servings planned, and marks it logged', () => {
    const e = add('recipe', { date: TODAY, slot: 'dinner', servings: 2 });
    expect(logPlannedEntry(e.id, { todayKey: TODAY })).toEqual({ ok: true });
    expect(global.__addFood).toHaveBeenCalledTimes(1);
    expect(global.__addFood).toHaveBeenCalledWith(TODAY, 'dinner', expect.objectContaining({
      id: 'recipe-r1', name: 'Chili', calories: 800, protein: 60, quantity: 2, servingSize: '2x 1 serving',
    }));
    expect(find(e.id).loggedAt).toBe('2026-10-09T12:00:00.000Z');
  });

  it('puts a food in the diary with its own details', () => {
    const e = add('food', { date: TODAY, slot: 'breakfast', servings: 1.5 });
    expect(logPlannedEntry(e.id, { todayKey: TODAY }).ok).toBe(true);
    expect(global.__addFood).toHaveBeenCalledWith(TODAY, 'breakfast', expect.objectContaining({ id: 'f1', name: 'Oats', calories: 225, quantity: 1.5 }));
  });

  it('logs a missed day on that day, not today', () => {
    const e = add('recipe', { date: '2026-10-07', slot: 'lunch' });
    expect(logPlannedEntry(e.id, { todayKey: TODAY }).ok).toBe(true);
    expect(global.__addFood).toHaveBeenCalledWith('2026-10-07', 'lunch', expect.any(Object));
  });

  it('will not log a day that has not come', () => {
    const e = add('recipe', { date: '2026-10-10', slot: 'dinner' });
    expect(logPlannedEntry(e.id, { todayKey: TODAY })).toEqual({ ok: false, error: 'You can log this on its day.' });
    expect(global.__addFood).not.toHaveBeenCalled();
    expect(find(e.id).loggedAt).toBeUndefined();
  });

  it('will not log the same item twice', () => {
    const e = add('recipe', { date: TODAY, slot: 'dinner' });
    logPlannedEntry(e.id, { todayKey: TODAY });
    expect(logPlannedEntry(e.id, { todayKey: TODAY })).toEqual({ ok: false, error: 'This one is already logged.' });
    expect(global.__addFood).toHaveBeenCalledTimes(1);
  });

  it('says so for an item that is not on the plan', () => {
    expect(logPlannedEntry('nope', { todayKey: TODAY })).toEqual({ ok: false, error: 'This item is no longer in your plan.' });
    expect(global.__addFood).not.toHaveBeenCalled();
  });

  it('does not mark it logged when the diary could not take it', () => {
    const e = add('recipe', { date: TODAY, slot: 'dinner' });
    global.__addFood.mockImplementation(() => { throw new Error('storage full'); });
    expect(() => logPlannedEntry(e.id, { todayKey: TODAY })).toThrow('storage full');
    expect(find(e.id).loggedAt).toBeUndefined();
  });

  it('goes by the day it is told is today, not the clock', () => {
    const later = add('recipe', { date: '2026-10-12', slot: 'dinner' });
    expect(logPlannedEntry(later.id).ok).toBe(false);
    expect(logPlannedEntry(later.id, { todayKey: '2026-10-12' })).toEqual({ ok: true });
    expect(global.__addFood).toHaveBeenCalledWith('2026-10-12', 'dinner', expect.any(Object));
    const earlier = add('recipe', { date: TODAY, slot: 'lunch' });
    expect(logPlannedEntry(earlier.id, { todayKey: '2026-10-08' }).ok).toBe(false);
  });

  it('uses the real today by default', () => {
    const e = add('recipe', { date: TODAY, slot: 'dinner' });
    expect(logPlannedEntry(e.id).ok).toBe(true);
    const later = add('recipe', { date: '2026-10-10', slot: 'dinner' });
    expect(logPlannedEntry(later.id).ok).toBe(false);
  });
});

describe('logPlannedDay', () => {
  it('logs everything on the day that can be, and says how many', () => {
    add('recipe', { date: TODAY, slot: 'dinner' });
    add('food', { date: TODAY, slot: 'breakfast' });
    const other = add('recipe', { date: '2026-10-08', slot: 'dinner' });
    expect(logPlannedDay(TODAY, { todayKey: TODAY })).toBe(2);
    expect(global.__addFood).toHaveBeenCalledTimes(2);
    expect(find(other.id).loggedAt).toBeUndefined();
  });

  it('skips what is already logged, and logs nothing for a future day', () => {
    const a = add('recipe', { date: TODAY, slot: 'dinner' });
    add('food', { date: TODAY, slot: 'breakfast' });
    logPlannedEntry(a.id, { todayKey: TODAY });
    global.__addFood.mockClear();
    expect(logPlannedDay(TODAY, { todayKey: TODAY })).toBe(1);
    add('recipe', { date: '2026-10-12', slot: 'dinner' });
    expect(logPlannedDay('2026-10-12', { todayKey: TODAY })).toBe(0);
  });

  it('goes by the day it is told is today, not the clock', () => {
    add('recipe', { date: '2026-10-12', slot: 'dinner' });
    add('food', { date: '2026-10-12', slot: 'snack' });
    expect(logPlannedDay('2026-10-12')).toBe(0);
    expect(logPlannedDay('2026-10-12', { todayKey: '2026-10-12' })).toBe(2);
    expect(global.__addFood).toHaveBeenCalledTimes(2);
  });

  it('is zero for an empty day', () => {
    expect(logPlannedDay(TODAY, { todayKey: TODAY })).toBe(0);
  });

  it('uses the real today by default', () => {
    add('recipe', { date: TODAY, slot: 'dinner' });
    expect(logPlannedDay(TODAY)).toBe(1);
  });
});
