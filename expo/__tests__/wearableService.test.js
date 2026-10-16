// services/wearableService.js used to invent heart rate, steps and sleep with Math.random() for any "connected" device, and
// the coach was handed those numbers as if a watch had measured them. Nothing in the app links a watch through this file, so
// the only honest answer to every question it gets is "no data". These tests hold it to that.
import { wearableService, getCurrentReadiness, calculateReadinessFromMood } from '../services/wearableService';

afterEach(() => jest.restoreAllMocks());

describe('with no wearable linked', () => {
  it('has no devices', () => {
    expect(wearableService.getConnectedDevices()).toEqual([]);
  });

  it('gives no data when asked to sync, with or without a device id', async () => {
    expect(await wearableService.syncData('fitbit_1')).toBeNull();
    expect(await wearableService.syncData('apple_watch_1')).toBeNull();
    expect(await wearableService.syncData()).toBeNull();
  });

  it('gives no mood, energy, stress or sleep reading', async () => {
    expect(await wearableService.getMoodDataFromWearables()).toBeNull();
  });

  // The fake version listed four devices (Fitbit, Apple Watch, Garmin, ROOK) and "connected" any of them after a pause.
  it('has no list of devices to connect and no way to connect one', () => {
    expect(wearableService.getAvailableDevices).toBeUndefined();
    expect(wearableService.connectDevice).toBeUndefined();
  });

  it('does not make up a number, whatever it is asked', async () => {
    const random = jest.spyOn(Math, 'random');
    await wearableService.syncData('fitbit_1');
    await wearableService.getMoodDataFromWearables();
    await getCurrentReadiness();
    expect(random).not.toHaveBeenCalled();
  });

  it('does not wait around pretending to read a device', async () => {
    jest.useFakeTimers();
    try {
      const done = jest.fn();
      wearableService.syncData('fitbit_1').then(done);
      await Promise.resolve();
      await Promise.resolve();
      expect(done).toHaveBeenCalledWith(null);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('readiness for the workout screen', () => {
  it('is "medium" (no change to the prescription) when there is no data', async () => {
    expect(await getCurrentReadiness()).toBe('medium');
    expect(calculateReadinessFromMood(null)).toBe('medium');
  });

  it('follows a real reading when there is one', async () => {
    jest.spyOn(wearableService, 'getMoodDataFromWearables').mockResolvedValue({ mood: 5, energy: 5, stress: 1, sleep: 5, confidence: 90 });
    expect(await getCurrentReadiness()).toBe('high');
    wearableService.getMoodDataFromWearables.mockResolvedValue({ mood: 2, energy: 3, stress: 3, sleep: 3, confidence: 90 });
    expect(await getCurrentReadiness()).toBe('low');
    wearableService.getMoodDataFromWearables.mockResolvedValue({ mood: 3, energy: 3, stress: 3, sleep: 3, confidence: 90 });
    expect(await getCurrentReadiness()).toBe('medium');
  });

  it('stays "medium" if reading the wearable fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(wearableService, 'getMoodDataFromWearables').mockRejectedValue(new Error('boom'));
    expect(await getCurrentReadiness()).toBe('medium');
  });
});
