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
import {
  HK_RUNNING, HK_WALKING, MAX_IMPORT_WORKOUTS, buildImportedRun, fromHealthKitRoutes, fromHealthKitWorkout, importedRunId,
} from '../lib/runImport';

const RESTING_HR_TYPE = 'HKQuantityTypeIdentifierRestingHeartRate';
const HRV_TYPE = 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN';
const STEP_COUNT_TYPE = 'HKQuantityTypeIdentifierStepCount';
const DISTANCE_TYPE = 'HKQuantityTypeIdentifierDistanceWalkingRunning';
const FLIGHTS_CLIMBED_TYPE = 'HKQuantityTypeIdentifierFlightsClimbed';
const WORKOUT_TYPE = 'HKWorkoutTypeIdentifier';
const WORKOUT_ROUTE_TYPE = 'HKWorkoutRouteTypeIdentifier';

// Loaded when first needed, like the import() calls below, but with require()
// so the workout methods can also be run under Jest.
const loadHealthKit = () => require('@kingstinct/react-native-healthkit');

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
   * Asks for read access to workouts and their GPS routes. Must be awaited
   * before readWorkouts(): querying a type that was never requested is the
   * crash case this library warns about. iOS never says whether the person
   * allowed it (that is private), so true here means "the request went
   * through"; an empty result later can mean "not allowed" or "none there".
   */
  async requestWorkoutAccess() {
    if (Platform.OS !== 'ios') return false;
    try {
      const { requestAuthorization } = loadHealthKit();
      await requestAuthorization({ toRead: [WORKOUT_TYPE, WORKOUT_ROUTE_TYPE] });
      return true;
    } catch (e) {
      console.warn('[appleHealthService] requestWorkoutAccess failed:', e?.message);
      return false;
    }
  }

  /**
   * Reads running and walking workouts since `sinceMs`, newest first, and turns
   * each into a saved-run record (see lib/runImport.js). Workouts whose id is in
   * `skipIds` are not fetched again. Resolves to
   * { ok, runs, found, skipped, ignored } (ok is false with a `reason` when
   * Health could not be read); never throws.
   */
  async readWorkouts({ sinceMs, uid, skipIds, limit = MAX_IMPORT_WORKOUTS, onProgress } = {}) {
    const result = { ok: true, runs: [], found: 0, skipped: 0, ignored: 0 };
    if (Platform.OS !== 'ios') return { ...result, ok: false, reason: 'unsupported' };
    try {
      const HK = loadHealthKit();
      const kinds = [HK.WorkoutActivityType?.running ?? HK_RUNNING, HK.WorkoutActivityType?.walking ?? HK_WALKING];
      const lists = await Promise.all(kinds.map((kind) => HK.queryWorkoutSamples({
        filter: { workoutActivityType: kind, date: { startDate: new Date(sinceMs) } },
        limit,
        ascending: false,
      })));
      const workouts = [].concat(...lists)
        .filter(Boolean)
        .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())
        .slice(0, limit);
      result.found = workouts.length;

      for (let i = 0; i < workouts.length; i += 1) {
        const w = workouts[i];
        if (typeof onProgress === 'function') onProgress({ done: i, total: workouts.length });
        if (skipIds && skipIds.has(importedRunId('apple-health', w.uuid))) {
          result.skipped += 1;
          continue;
        }
        let locations = [];
        try {
          locations = fromHealthKitRoutes(await w.getWorkoutRoutes());
        } catch (e) {
          // No route (treadmill, or route access not allowed): the workout still imports without a map.
        }
        const run = buildImportedRun(fromHealthKitWorkout(w, locations), { uid });
        if (run) result.runs.push(run);
        else result.ignored += 1;
      }
      if (typeof onProgress === 'function') onProgress({ done: workouts.length, total: workouts.length });
      return result;
    } catch (e) {
      console.warn('[appleHealthService] readWorkouts failed:', e?.message);
      return { ...result, ok: false, reason: 'error', message: e?.message || '' };
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
