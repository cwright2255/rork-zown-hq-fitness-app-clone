// The plan for a screen (hooks/useEntitlement.js): the person's tier, whether the phone knows it yet, and what it includes.
import { act, renderHook } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));

import { useEntitlement, WAIT_FOR_PLAN_MS } from '../hooks/useEntitlement';
import { useEntitlementStore } from '../store/entitlementStore';

const plan = (over = {}) => ({ tier: 'pro', status: 'active', expiresAt: null, source: 'manual', ...over });
const setStore = (state) => act(() => { useEntitlementStore.setState({ plan: null, isLoaded: false, ...state }); });

beforeEach(() => {
  jest.useFakeTimers();
  setStore({});
});
afterEach(() => { jest.useRealTimers(); });

describe('the tier', () => {
  it('is Free with no plan, once the cloud has said so', () => {
    setStore({ isLoaded: true });
    const { result } = renderHook(() => useEntitlement());
    expect(result.current.tier).toBe('free');
    expect(result.current.ready).toBe(true);
  });

  it('is the plan in force: Pro, or Legend', () => {
    setStore({ plan: plan(), isLoaded: true });
    expect(renderHook(() => useEntitlement()).result.current.tier).toBe('pro');
    setStore({ plan: plan({ tier: 'legend' }), isLoaded: true });
    expect(renderHook(() => useEntitlement()).result.current.tier).toBe('legend');
  });

  it('is Free when the plan has ended or has run out', () => {
    setStore({ plan: plan({ status: 'expired' }), isLoaded: true });
    expect(renderHook(() => useEntitlement()).result.current.tier).toBe('free');
    setStore({ plan: plan({ expiresAt: '2020-01-01T00:00:00.000Z' }), isLoaded: true });
    expect(renderHook(() => useEntitlement()).result.current.tier).toBe('free');
  });

  it('follows the plan when it changes', () => {
    setStore({ plan: plan(), isLoaded: true });
    const { result } = renderHook(() => useEntitlement());
    expect(result.current.tier).toBe('pro');
    setStore({ plan: plan({ tier: 'legend' }), isLoaded: true });
    expect(result.current.tier).toBe('legend');
  });
});

describe('what the plan includes', () => {
  it('opens a feature to the plan that has it and the ones above', () => {
    setStore({ plan: plan(), isLoaded: true });
    const { can } = renderHook(() => useEntitlement()).result.current;
    expect(can('analytics')).toBe(true);
    expect(can('aiWorkoutPlan')).toBe(true);
    expect(can('bodyScan')).toBe(false);
    expect(can('somethingNotLocked')).toBe(true);
  });

  it('opens nothing locked to Free', () => {
    setStore({ isLoaded: true });
    const { can } = renderHook(() => useEntitlement()).result.current;
    expect(can('analytics')).toBe(false);
    expect(can('bodyScan')).toBe(false);
  });
});

describe('ready: whether the phone knows the plan yet', () => {
  it('is not ready while it waits for the cloud, with nothing kept', () => {
    const { result } = renderHook(() => useEntitlement());
    expect(result.current.ready).toBe(false);
  });

  it('is ready at once when the phone kept a plan, before the cloud answers', () => {
    setStore({ plan: plan(), isLoaded: false });
    expect(renderHook(() => useEntitlement()).result.current.ready).toBe(true);
  });

  it('becomes ready when the cloud answers', () => {
    const { result } = renderHook(() => useEntitlement());
    expect(result.current.ready).toBe(false);
    setStore({ isLoaded: true });
    expect(result.current.ready).toBe(true);
  });

  it('stops waiting after a few seconds, so a screen is not stuck for ever when offline', () => {
    const { result } = renderHook(() => useEntitlement());
    expect(WAIT_FOR_PLAN_MS).toBe(4000);
    act(() => { jest.advanceTimersByTime(3999); });
    expect(result.current.ready).toBe(false);
    act(() => { jest.advanceTimersByTime(1); });
    expect(result.current.ready).toBe(true);
    expect(result.current.tier).toBe('free');
  });

  it('starts waiting again, and stops again after the same few seconds, if the plan is forgotten while the screen is open', () => {
    setStore({ plan: plan(), isLoaded: true });
    const { result } = renderHook(() => useEntitlement());
    expect(result.current.ready).toBe(true);
    setStore({ plan: null, isLoaded: false });
    expect(result.current.ready).toBe(false);
    act(() => { jest.advanceTimersByTime(4000); });
    expect(result.current.ready).toBe(true);
    expect(result.current.tier).toBe('free');
  });

  it('sets no timer once the plan is known, and clears it when the screen goes away', () => {
    setStore({ plan: plan(), isLoaded: true });
    const known = renderHook(() => useEntitlement());
    expect(jest.getTimerCount()).toBe(0);
    known.unmount();
    setStore({ plan: null, isLoaded: false });
    const waiting = renderHook(() => useEntitlement());
    expect(jest.getTimerCount()).toBe(1);
    waiting.unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
