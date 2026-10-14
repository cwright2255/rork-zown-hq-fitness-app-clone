// The app asks the cloud for recovery data for the person's own calendar day, not the server's UTC day
// (functions/src/recoveryDay.js): from about 8 PM in New Jersey the UTC date is already tomorrow.
const mockCallable = jest.fn();

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }), { virtual: true });
jest.mock('firebase/functions', () => ({ getFunctions: jest.fn(), httpsCallable: jest.fn(() => mockCallable) }));

import { rookService } from '../services/rookService';
import { httpsCallable } from 'firebase/functions';

afterEach(() => { jest.useRealTimers(); mockCallable.mockReset(); });

describe('rookService.getTodayRecovery', () => {
  it('sends the person\'s own day: 9:30 PM on the 14th in New Jersey is the 14th, not the 15th', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-15T01:30:00Z'), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    mockCallable.mockResolvedValue({ data: { restingHeartRate: 54, hrv: 61, sleepHours: 7.5, sleepEfficiency: 91, source: 'Oura' } });
    const out = await rookService.getTodayRecovery();
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'getRookRecoveryData');
    expect(mockCallable).toHaveBeenCalledWith({ date: '2026-10-14' });
    expect(out).toEqual({ restingHeartRate: 54, hrv: 61, sleepHours: 7.5, sleepEfficiency: 91, source: 'Oura' });
  });

  it('sends the next morning\'s day once it is the 15th locally', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-15T12:00:00Z'), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    mockCallable.mockResolvedValue({ data: null });
    expect(await rookService.getTodayRecovery()).toBeNull();
    expect(mockCallable).toHaveBeenCalledWith({ date: '2026-10-15' });
  });

  it('gives null, not an error, when the cloud call fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockCallable.mockRejectedValue(new Error('offline'));
    expect(await rookService.getTodayRecovery()).toBeNull();
    warn.mockRestore();
  });
});
