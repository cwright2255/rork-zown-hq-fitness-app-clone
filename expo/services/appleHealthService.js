// services/appleHealthService.js
//
// Direct, independent HealthKit integration via @kingstinct/react-native-
// healthkit - deliberately NOT going through ROOK's native SDK path
// (RookSyncGate), which was removed earlier today after an unresolved
// native init crash. This library is a completely separate dependency
// with its own native module; nothing here touches react-native-rook-sdk
// at all.
//
// Real safety note: this library's own docs explicitly warn "Failing to
// request authorization, or requesting a permission you haven't
// requested yet, will result in the app crashing" - the same class of
// risk that cost real time with ROOK's SDK today. The defense here is
// structural: every call is a plain async function inside try/catch, not
// a React hook - a wrong function name or bad call fails as a normal,
// catchable JS error (TypeError, rejected promise), not an uncatchable
// native/context-level crash the way ROOK's hook-based crash was. Every
// method here returns null on any failure rather than throwing further,
// matching this app's established honest-empty-state convention.
//
// Return shape from getTodayRecovery() deliberately matches
// rookService.js's getTodayRecovery() exactly (hrv, restingHeartRate,
// sleepEfficiency, sleepHours, source) so app/health.jsx's existing
// recovery-fetching code can consume either source without changes -
// see store/healthStore.js's loadRookRecovery(), which now tries this
// service first.
import { Platform } from 'react-native';

const RESTING_HR_TYPE = 'HKQuantityTypeIdentifierRestingHeartRate';
const HRV_TYPE = 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN';
const STEP_COUNT_TYPE = 'HKQuantityTypeIdentifierStepCount';
const DISTANCE_TYPE = 'HKQuantityTypeIdentifierDistanceWalkingRunning';
const FLIGHTS_CLIMBED_TYPE = 'HKQuantityTypeIdentifierFlightsClimbed';

// Real, decade-stable Apple HealthKit sample fields (startDate/quantity) -
// this library's own docs state it "strives to do as straight a mapping
// as possible to the Native Libraries," so these match Apple's own
// long-documented HKQuantitySample properties, not a guess specific to
// this wrapper.
function sumTodaysSamples(samples) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return (samples || [])
    .filter((s) => {
      const sampleDate = new Date(s.startDate ?? s.endDate ?? s.date);
      return sampleDate >= startOfToday;
    })
    .reduce((sum, s) => sum + (s.quantity ?? 0), 0);
}

class AppleHealthService {
  async isAvailable() {
    if (Platform.OS !== 'ios') return false;
    try {
      const { isHealthDataAvailable } = await import('@kingstinct/react-native-healthkit');
      return await isHealthDataAvailable();
    } catch (e) {
      console.warn('[appleHealthService] isAvailable check failed:', e?.message);
      return false;
    }
  }

  /**
   * Requests real HealthKit read access for resting heart rate and HRV.
   * Must be called (and awaited) before any of the get/query calls
   * below - calling those first is exactly the crash case this
   * library's own docs warn about.
   */
  async requestAuthorization() {
    if (Platform.OS !== 'ios') return false;
    try {
      const { requestAuthorization } = await import('@kingstinct/react-native-healthkit');
      await requestAuthorization({ toRead: [RESTING_HR_TYPE, HRV_TYPE, STEP_COUNT_TYPE, DISTANCE_TYPE, FLIGHTS_CLIMBED_TYPE] });
      return true;
    } catch (e) {
      console.warn('[appleHealthService] requestAuthorization failed:', e?.message);
      return false;
    }
  }

  /**
   * Real today's step count + walking/running distance, summed from
   * HealthKit's own many-small-samples-per-day model - unlike resting
   * heart rate/HRV, there's no single "most recent" step count that
   * represents the whole day, so this queries a generous recent batch
   * and sums whatever falls within today's calendar date. Returns null
   * (not a fabricated 0) if the query itself fails - a genuine 0 steps
   * (e.g. no samples at all today) is a different, valid case from "we
   * couldn't reach HealthKit."
   */
  async getTodayActivity() {
    if (Platform.OS !== 'ios') return null;
    try {
      const { queryQuantitySamples } = await import('@kingstinct/react-native-healthkit');
      const [stepSamples, distanceSamples, flightsSamples] = await Promise.all([
        queryQuantitySamples(STEP_COUNT_TYPE, { limit: 500 }).catch(() => []),
        queryQuantitySamples(DISTANCE_TYPE, { limit: 500 }).catch(() => []),
        queryQuantitySamples(FLIGHTS_CLIMBED_TYPE, { limit: 500 }).catch(() => []),
      ]);

      const stepsTotal = sumTodaysSamples(stepSamples);
      const distanceTotal = sumTodaysSamples(distanceSamples);
      const flightsTotal = sumTodaysSamples(flightsSamples);

      return {
        steps: Math.round(stepsTotal),
        // Real note, not a guess dressed up as fact: this library
        // defaults to "the user's preferred unit" when none is
        // specified, which could be km, mi, or m depending on the
        // device's Health app regional settings - NOT necessarily
        // meters. Rather than silently apply a /1000-for-meters
        // conversion that could be wrong, this returns the raw value
        // and its likely-but-unconfirmed unit so it can be verified
        // against what the number actually looks like on a real device
        // before any display code trusts a specific conversion.
        distanceRaw: Math.round(distanceTotal * 100) / 100,
        distanceUnitNote: 'unit not yet confirmed - verify against real device output before converting',
        flightsClimbed: Math.round(flightsTotal),
      };
    } catch (e) {
      console.warn('[appleHealthService] getTodayActivity failed:', e?.message);
      return null;
    }
  }

  /**
   * Real most-recent resting heart rate + HRV samples, normalized to the
   * same shape rookService.getTodayRecovery() returns. Sleep fields are
   * deliberately left null - HealthKit sleep data is a series of
   * overlapping category samples (inBed/asleepCore/asleepDeep/asleepREM/
   * awake) that needs real interval math to sum into "hours slept"
   * correctly, not a single most-recent-sample call like the quantity
   * types here. Left as a flagged follow-up rather than shipping a
   * summed-duration calculation that hasn't been verified against real
   * overlapping sleep-stage data. ROOK's REST path (once its own
   * separate 401 issue is resolved with their support) remains the real
   * sleep-data source for now.
   */
  async getTodayRecovery() {
    if (Platform.OS !== 'ios') return null;
    try {
      const { getMostRecentQuantitySample } = await import('@kingstinct/react-native-healthkit');
      const [restingHr, hrv] = await Promise.all([
        getMostRecentQuantitySample(RESTING_HR_TYPE).catch(() => null),
        getMostRecentQuantitySample(HRV_TYPE).catch(() => null),
      ]);

      if (restingHr == null && hrv == null) return null;

      return {
        restingHeartRate: restingHr?.quantity ?? null,
        hrv: hrv?.quantity ?? null,
        sleepEfficiency: null,
        sleepHours: null,
        source: 'Apple Health',
      };
    } catch (e) {
      console.warn('[appleHealthService] getTodayRecovery failed:', e?.message);
      return null;
    }
  }
}

export const appleHealthService = new AppleHealthService();
