// Water: a glass added by mistake can be taken off again. The count never goes below 0, it only ever concerns today's glasses,
// and taking one off leaves the XP alone (a reached tier was paid by its own claim; adding the glass again cannot pay it twice).
jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((...args) => ({ path: args.slice(1).join('/') })),
  getDoc: jest.fn(),
  setDoc: jest.fn(async () => undefined),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('../services/rookService', () => ({ rookService: {} }));
jest.mock('../services/appleHealthService', () => ({ appleHealthService: {} }));
const mockAward = jest.fn();
jest.mock('../store/expStore', () => ({
  useExpStore: { getState: () => ({ awardHydrationXp: (...a) => mockAward(...a), awardStepsXp: jest.fn() }) },
}));

import { setDoc } from 'firebase/firestore';
import { useHealthStore } from '../store/healthStore';

const at = (date) => { jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }).setSystemTime(date); };
const store = () => useHealthStore.getState();
const NOON_14 = new Date('2026-10-14T16:00:00Z');

beforeAll(() => new Promise((resolve) => setTimeout(resolve, 20)));
beforeEach(() => {
  at(NOON_14);
  useHealthStore.setState({ hydration: { glasses: 3, target: 8, date: '2026-10-14' } });
  setDoc.mockClear();
  mockAward.mockClear();
});
afterEach(() => { jest.useRealTimers(); });

describe('removeGlass', () => {
  it('takes one glass off today\'s count', () => {
    store().removeGlass('u1');
    expect(store().hydration).toEqual({ glasses: 2, target: 8, date: '2026-10-14' });
  });

  it('can be done again and again, down to 0, and no further', () => {
    for (let i = 0; i < 5; i += 1) store().removeGlass('u1');
    expect(store().hydration.glasses).toBe(0);
    store().removeGlass('u1');
    expect(store().hydration.glasses).toBe(0);
  });

  it('keeps the target', () => {
    useHealthStore.setState({ hydration: { glasses: 3, target: 10, date: '2026-10-14' } });
    store().removeGlass('u1');
    expect(store().hydration.target).toBe(10);
  });

  it('saves the new count for the signed-in person', () => {
    store().removeGlass('u1');
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][0]).toEqual({ path: 'users/u1/data/health' });
    expect(setDoc.mock.calls[0][1].hydration).toEqual({ glasses: 2, target: 8, date: '2026-10-14' });
  });

  it('changes the count on the phone, and saves nothing, with nobody signed in', () => {
    store().removeGlass();
    expect(store().hydration.glasses).toBe(2);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('does not touch the XP', () => {
    store().removeGlass('u1');
    expect(mockAward).not.toHaveBeenCalled();
  });

  it('starts from 0 on a new day: yesterday\'s glasses are not today\'s to take off', () => {
    at(new Date('2026-10-15T16:00:00Z'));
    store().removeGlass('u1');
    expect(store().hydration).toEqual({ glasses: 0, target: 8, date: '2026-10-15' });
  });

  it('counts the person\'s own day: 9:30 PM on the 14th is still the 14th', () => {
    at(new Date('2026-10-15T01:30:00Z'));
    store().removeGlass('u1');
    expect(store().hydration).toEqual({ glasses: 2, target: 8, date: '2026-10-14' });
  });
});

describe('addGlass and removeGlass together', () => {
  it('add then remove leaves the count where it was', () => {
    store().addGlass('u1');
    store().removeGlass('u1');
    expect(store().hydration.glasses).toBe(3);
  });

  it('only adding asks for XP, and it asks with the count at that moment', () => {
    store().addGlass('u1');
    store().removeGlass('u1');
    store().addGlass('u1');
    expect(mockAward).toHaveBeenCalledTimes(2);
    expect(mockAward).toHaveBeenNthCalledWith(1, 4, 8, 'u1');
    expect(mockAward).toHaveBeenNthCalledWith(2, 4, 8, 'u1');
  });
});
