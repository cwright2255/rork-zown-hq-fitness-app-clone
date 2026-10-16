// What the coach and the workout screen ask for when they want today's wearable readings (mood, energy, stress, sleep).
//
// Nothing in the app links a watch or band through this file: it does not pair one and it does not read one. So the answer
// to every question is "no data", and the callers already handle that (the coach is sent no recovery note, the workout
// screen keeps its normal prescription). It used to answer with heart rate, steps and sleep made up with Math.random() for
// any "connected" device, which would have reached the coach as if a watch had measured them. Readings that really are
// read come through appleHealthService.js and rookService.js; if one of them should feed the coach, it is wired in here,
// returning what the device says and nothing it does not.
class WearableService {
  getConnectedDevices() {
    return [];
  }

  async syncData() {
    return null;
  }

  async getMoodDataFromWearables() {
    return null;
  }
}

export const wearableService = new WearableService();

// Real, new: extracted from the exact readiness logic already proven
// in services/aiService.js's generateNutritionAdvice, so the workout
// progressive-overload engine can use the same "high/medium/low
// readiness from today's wearable recovery data" concept instead of a
// separate, potentially-inconsistent one. Pure function - given a mood
// object, no fetching - kept separate from getCurrentReadiness below so
// it's directly testable on its own.
//
// With no reading at all it answers 'medium', which the progressive-overload engine treats as "no change" (only 'low'
// holds a prescription back); it is not shown to the person as a measurement.
export function calculateReadinessFromMood(mood) {
  if (!mood) return 'medium';
  const high = mood.mood >= 4 && mood.energy >= 4 && mood.stress <= 2 && mood.sleep >= 4;
  const low = mood.mood <= 2 || mood.energy <= 2 || mood.sleep <= 2 || mood.stress >= 4;
  return high ? 'high' : low ? 'low' : 'medium';
}

export async function getCurrentReadiness() {
  try {
    const mood = await wearableService.getMoodDataFromWearables();
    return calculateReadinessFromMood(mood);
  } catch (e) {
    console.warn('[wearableService] getCurrentReadiness failed:', e?.message);
    return 'medium';
  }
}
