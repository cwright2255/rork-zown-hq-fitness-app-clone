// What the Health screen shows for recovery readings and the Body Composition card (lib/healthDisplay.js).
import { NO_READING, recoveryTiles, recoveryCaption, bodyScanCard } from '../lib/healthDisplay';

const APPLE = { restingHeartRate: 58.4, hrv: 41.6, sleepEfficiency: null, sleepHours: null, source: 'Apple Health' };
const WHOOP = { restingHeartRate: 52, hrv: 88, sleepHours: 7.4, source: 'WHOOP' };

describe('NO_READING', () => {
  it('is a dash', () => {
    expect(NO_READING).toBe(String.fromCharCode(8212));
  });
});

describe('recoveryTiles', () => {
  it('gives the resting heart rate and the HRV, rounded, with their units', () => {
    expect(recoveryTiles(WHOOP)).toEqual([
      { key: 'restingHeartRate', icon: 'heart-outline', label: 'Resting HR', value: '52', unit: 'bpm' },
      { key: 'hrv', icon: 'pulse-outline', label: 'HRV (RMSSD)', value: '88', unit: 'ms' },
    ]);
    const apple = recoveryTiles(APPLE);
    expect(apple.map((t) => t.value)).toEqual(['58', '42']);
  });

  it('names the kind of HRV after where it came from: Apple Health measures SDNN, the wearables RMSSD', () => {
    expect(recoveryTiles(APPLE)[1].label).toBe('HRV (SDNN)');
    expect(recoveryTiles({ ...APPLE, source: 'apple health' })[1].label).toBe('HRV (SDNN)');
    expect(recoveryTiles(WHOOP)[1].label).toBe('HRV (RMSSD)');
    expect(recoveryTiles({ hrv: 60 })[1].label).toBe('HRV (RMSSD)');
    expect(recoveryTiles({ hrv: 60, source: '   ' })[1].label).toBe('HRV (RMSSD)');
    expect(recoveryTiles({ hrv: 60, source: 7 })[1].label).toBe('HRV (RMSSD)');
  });

  it('shows a dash, with no unit, for a reading that is not there', () => {
    const tiles = recoveryTiles({ restingHeartRate: 61, source: 'WHOOP' });
    expect(tiles[0]).toMatchObject({ value: '61', unit: 'bpm' });
    expect(tiles[1]).toMatchObject({ label: 'HRV', value: NO_READING, unit: '' });
  });

  it.each([
    ['nothing at all', null],
    ['nothing yet', undefined],
    ['a text', 'x'],
    ['an empty reading', {}],
    ['zeros', { restingHeartRate: 0, hrv: 0 }],
    ['negative numbers', { restingHeartRate: -3, hrv: -1 }],
    ['text that is not a number', { restingHeartRate: 'n/a', hrv: 'high' }],
    ['empty text', { restingHeartRate: '', hrv: '' }],
    ['nulls', { restingHeartRate: null, hrv: null }],
    ['true', { restingHeartRate: true, hrv: true }],
    ['numbers that are not finite', { restingHeartRate: NaN, hrv: Infinity }],
  ])('never makes a number up from %s', (_name, recovery) => {
    expect(recoveryTiles(recovery)).toEqual([
      { key: 'restingHeartRate', icon: 'heart-outline', label: 'Resting HR', value: NO_READING, unit: '' },
      { key: 'hrv', icon: 'pulse-outline', label: 'HRV', value: NO_READING, unit: '' },
    ]);
  });

  it('reads a number that came in as text', () => {
    expect(recoveryTiles({ restingHeartRate: '64', hrv: '45.4' }).map((t) => t.value)).toEqual(['64', '45']);
  });
});

describe('recoveryCaption', () => {
  it('says where the readings are from, and that they are the latest rather than today\'s', () => {
    expect(recoveryCaption(APPLE)).toBe('Latest readings from Apple Health');
    expect(recoveryCaption(WHOOP)).toBe('Latest readings from WHOOP');
  });

  it('trims the source and names a device when it has none', () => {
    expect(recoveryCaption({ ...WHOOP, source: '  Oura  ' })).toBe('Latest readings from Oura');
    expect(recoveryCaption({ restingHeartRate: 60 })).toBe('Latest readings from a connected device');
    expect(recoveryCaption({ restingHeartRate: 60, source: '' })).toBe('Latest readings from a connected device');
  });

  it('is the same with just one reading', () => {
    expect(recoveryCaption({ hrv: 50, source: 'Garmin' })).toBe('Latest readings from Garmin');
  });

  it('points to Wearable Sync when there is no reading at all', () => {
    const none = 'No readings yet. Connect a device under Wearable Sync below.';
    expect(recoveryCaption(null)).toBe(none);
    expect(recoveryCaption({})).toBe(none);
    expect(recoveryCaption({ restingHeartRate: 0, hrv: 0, source: 'Apple Health' })).toBe(none);
  });
});

describe('bodyScanCard', () => {
  const SCAN = { id: 's9', bodyFatPercent: 18.5 };
  const PLANS = { pathname: '/paywall', params: { feature: 'bodyScan' } };

  it('is the camera for someone whose plan includes it and who has not scanned yet', () => {
    expect(bodyScanCard({ latestScan: null, locked: false })).toEqual({
      pill: null,
      subtitle: 'AI-powered body analysis using your camera',
      primaryLabel: 'Scan now',
      primaryRoute: '/body-scan/capture',
      cardRoute: '/body-scan/capture',
      showViewProgress: false,
    });
  });

  it('shows the last scan and a new scan for someone whose plan includes it', () => {
    expect(bodyScanCard({ latestScan: SCAN, locked: false })).toEqual({
      pill: null,
      subtitle: 'Last scan: 18.5% body fat',
      primaryLabel: 'New scan',
      primaryRoute: '/body-scan/capture',
      cardRoute: '/body-scan/s9',
      showViewProgress: true,
    });
  });

  it('says a scan that was saved without a body fat figure is saved', () => {
    expect(bodyScanCard({ latestScan: { id: 's1' }, locked: false }).subtitle).toBe('Last scan: saved');
    expect(bodyScanCard({ latestScan: { id: 's1', bodyFatPercent: 0 }, locked: false }).subtitle).toBe('Last scan: 0% body fat');
  });

  it('is marked Legend, and goes to the plans, for someone whose plan does not include it', () => {
    expect(bodyScanCard({ latestScan: null, locked: true })).toEqual({
      pill: 'Legend',
      subtitle: 'Body scan is part of Legend',
      primaryLabel: 'See plans',
      primaryRoute: PLANS,
      cardRoute: PLANS,
      showViewProgress: false,
    });
  });

  it('still opens a scan that was taken, even when the plan does not include a new one', () => {
    expect(bodyScanCard({ latestScan: SCAN, locked: true })).toEqual({
      pill: 'Legend',
      subtitle: 'Last scan: 18.5% body fat',
      primaryLabel: 'See plans',
      primaryRoute: PLANS,
      cardRoute: '/body-scan/s9',
      showViewProgress: true,
    });
  });
});
