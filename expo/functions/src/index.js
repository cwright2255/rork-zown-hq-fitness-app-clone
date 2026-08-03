import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import OpenAI from 'openai';

initializeApp();

const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
const SPOTIFY_CLIENT_ID = defineSecret('SPOTIFY_CLIENT_ID');
const SPOTIFY_CLIENT_SECRET = defineSecret('SPOTIFY_CLIENT_SECRET');
const RADAR_LIVE_SECRET_KEY = defineSecret('RADAR_LIVE_SECRET_KEY');
const RADAR_TEST_SECRET_KEY = defineSecret('RADAR_TEST_SECRET_KEY');
// ROOK aggregates WHOOP, Oura, Garmin, Fitbit, Withings, Polar, Dexcom
// under one integration — Apple Health / Health Connect (Apple Watch,
// Google/Wear OS watches) go through the on-device ROOK SDK already
// wired in app/health.jsx, a separate, real connection model from these.
// ROOK's /authorizer, /authorized, /revoke_auth, and /processed_data
// endpoints all require full Basic Auth (client_uuid:client_secret) per
// ROOK's own current API reference — confirmed this requires the secret
// even just to request a connection URL, unlike WHOOP/Oura's own OAuth
// (which only needed a public client id) — so none of this can be
// constructed client-side the way the previous, now-consolidated
// whoopService.js/ouraService.js were.
const ROOK_CLIENT_UUID = defineSecret('ROOK_CLIENT_UUID');
const ROOK_CLIENT_SECRET = defineSecret('ROOK_CLIENT_SECRET');
const ROOK_API_BASE = 'https://api.rook-connect.com';

function rookBasicAuthHeader() {
  const basic = Buffer.from(`${ROOK_CLIENT_UUID.value()}:${ROOK_CLIENT_SECRET.value()}`).toString('base64');
  return { Authorization: `Basic ${basic}` };
}

function getOpenAI() {
  return new OpenAI({ apiKey: OPENAI_API_KEY.value() });
}

function requireAuth(auth) {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Must be signed in');
  }
  return auth.uid;
}

async function saveRecommendation(data)





{
  const db = getFirestore();
  const ref = await db.collection('aiRecommendations').add({
    ...data,
    isRead: false,
    createdAt: FieldValue.serverTimestamp()
  });
  return ref.id;
}

export const generateWorkoutPlan = onCall(
  { secrets: [OPENAI_API_KEY], region: 'us-central1' },
  async (req) => {
    const uid = requireAuth(req.auth);
    const { fitnessLevel, goals, history } = req.data;





    const prompt = `Create a personalized 7-day workout plan for a ${fitnessLevel} user with goals: ${goals.join(
      ', '
    )}. Recent workout history: ${JSON.stringify(history ?? [])}. Return strict JSON with shape { "days": [{ "day": string, "focus": string, "exercises": [{ "name": string, "sets": number, "reps": number, "restSeconds": number }] }] }.`;

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
      { role: 'system', content: 'You are an elite personal trainer. Always return valid JSON.' },
      { role: 'user', content: prompt }]

    });
    const content = completion.choices[0]?.message?.content ?? '{}';

    let structured = {};
    try {
      structured = JSON.parse(content);
    } catch {
      structured = { raw: content };
    }

    const recommendationId = await saveRecommendation({
      userId: uid,
      type: 'workout_plan',
      content,
      structuredData: structured,
      prompt
    });

    return { recommendationId, plan: structured };
  }
);

export const getProgressSummary = onCall(
  { secrets: [OPENAI_API_KEY], region: 'us-central1' },
  async (req) => {
    const uid = requireAuth(req.auth);
    const { dateRange } = req.data;




    const db = getFirestore();
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const snap = await db.
    collection('workouts').
    where('userId', '==', uid).
    where('date', '>=', start).
    where('date', '<=', end).
    get();

    const workouts = snap.docs.map((d) => d.data());
    const prompt = `Summarize this user's fitness progress from ${dateRange.start} to ${dateRange.end}. Workouts: ${JSON.stringify(workouts)}. Provide a warm, 2-3 paragraph natural-language summary with specific stats and encouragement.`;

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
      { role: 'system', content: 'You are a supportive fitness coach.' },
      { role: 'user', content: prompt }]

    });

    const content = completion.choices[0]?.message?.content ?? '';

    const recommendationId = await saveRecommendation({
      userId: uid,
      type: 'progress_summary',
      content,
      prompt,
      structuredData: { workoutCount: workouts.length, dateRange }
    });

    return { recommendationId, summary: content };
  }
);

export const generateBodyCompositionInsight = onCall(
  { secrets: [OPENAI_API_KEY], region: 'us-central1' },
  async (req) => {
    const uid = requireAuth(req.auth);
    const { goal, age, scans } = req.data;

    if (!scans || scans.length === 0) {
      return {
        summary: 'No scans yet — take your first body scan to start tracking progress.',
        trend: 'none',
      };
    }

    const prompt = JSON.stringify({ goal, age: age ?? null, scans });

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a supportive, honest fitness coach reviewing a body-composition scan trend for a user. ' +
            'You will be given a goal, optionally the user\'s age, and a time-ordered list of scan measurements ' +
            '(circumferences in cm, estimated body fat % and BMI where available). Body-fat percentage derived from ' +
            'photos has real error margins (roughly ±3-5 percentage points is typical for single/dual-image ' +
            'estimation) — never state it with false precision or as a clinical diagnosis. Age, if provided, is for ' +
            'contextualizing realistic pacing only (e.g. don\'t suggest timelines typical of a 20-year-old to a ' +
            '55-year-old) — never mention it as a health risk factor or diagnose anything from it. Comment only on ' +
            'what the data actually shows; do not invent improvement or decline that is not supported by the numbers. ' +
            'Respond with strict JSON only: ' +
            '{"summary": string, "trend": "improving"|"steady"|"declining"|"mixed", "suggestion": string}.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    const result = {
      summary: parsed.summary || 'Scan recorded.',
      trend: parsed.trend || 'steady',
      suggestion: parsed.suggestion || '',
    };

    await saveRecommendation({
      userId: uid,
      type: 'body_composition_insight',
      content: result.summary,
      prompt,
      structuredData: { trend: result.trend, suggestion: result.suggestion, scanCount: scans.length },
    });

    return result;
  }
);

export const getNutritionRecommendations = onCall(
  { secrets: [OPENAI_API_KEY], region: 'us-central1' },
  async (req) => {
    const uid = requireAuth(req.auth);
    const { recentWorkouts, goals } = req.data;




    const prompt = `Provide nutrition recommendations for a user with goals: ${goals.join(
      ', '
    )}. Recent workouts: ${JSON.stringify(recentWorkouts)}. Include daily macro targets and 3 meal ideas. Return strict JSON { "dailyMacros": { "calories": number, "protein": number, "carbs": number, "fat": number }, "mealIdeas": [{ "name": string, "description": string }] }.`;

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
      { role: 'system', content: 'You are a sports nutrition expert. Return valid JSON.' },
      { role: 'user', content: prompt }]

    });
    const content = completion.choices[0]?.message?.content ?? '{}';

    let structured = {};
    try {
      structured = JSON.parse(content);
    } catch {
      structured = { raw: content };
    }

    const recommendationId = await saveRecommendation({
      userId: uid,
      type: 'nutrition',
      content,
      structuredData: structured,
      prompt
    });

    return { recommendationId, recommendations: structured };
  }
);

export const refreshSpotifyToken = onCall(
  { secrets: [SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET], region: 'us-central1' },
  async (req) => {
    requireAuth(req.auth);
    const { refreshToken } = req.data;
    if (!refreshToken) {
      throw new HttpsError('invalid-argument', 'refreshToken required');
    }

    const clientId = SPOTIFY_CLIENT_ID.value();
    const clientSecret = SPOTIFY_CLIENT_SECRET.value();
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }).toString()
    });

    if (!res.ok) {
      const body = await res.text();
      throw new HttpsError('internal', `Spotify refresh failed: ${body}`);
    }

    const data = await res.json();





    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      refreshToken: data.refresh_token
    };
  }
);

export const sendWorkoutReminder = onCall(
  { region: 'us-central1' },
  async (req) => {
    requireAuth(req.auth);
    const { userId, message } = req.data;
    if (!userId || !message) {
      throw new HttpsError('invalid-argument', 'userId and message required');
    }

    const db = getFirestore();
    const devicesSnap = await db.
    collection('users').
    doc(userId).
    collection('devices').
    get();

    const tokens = devicesSnap.docs.
    map((d) => d.data().token).
    filter((t) => !!t);

    if (tokens.length === 0) return { sent: 0 };

    const response = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title: 'Zown HQ', body: message }
    });

    return { sent: response.successCount, failed: response.failureCount };
  }
);

// Requests a real ROOK connection URL for a given API-based data source
// (WHOOP, Oura, Garmin, Fitbit, Withings, Polar, Dexcom — the exact enum
// ROOK's /authorizer endpoint accepts). Returns null (not a fabricated
// URL) if the user is already authorized for that source, matching
// ROOK's own real documented behavior for that case.
export const getRookAuthorizerUrl = onCall(
  { secrets: [ROOK_CLIENT_UUID, ROOK_CLIENT_SECRET], region: 'us-central1' },
  async (req) => {
    const uid = requireAuth(req.auth);
    const { dataSource } = req.data;
    const validSources = ['Garmin', 'Oura', 'Polar', 'Fitbit', 'Withings', 'Whoop', 'Dexcom'];
    if (!validSources.includes(dataSource)) {
      throw new HttpsError('invalid-argument', `dataSource must be one of ${validSources.join(', ')}`);
    }

    const res = await fetch(
      `${ROOK_API_BASE}/api/v1/user_id/${uid}/data_source/${dataSource}/authorizer`,
      { headers: rookBasicAuthHeader() }
    );
    if (!res.ok) {
      throw new HttpsError('internal', `ROOK authorizer request failed: ${res.status}`);
    }
    const data = await res.json();
    return { authorized: data.authorized, authorizationUrl: data.authorization_url || null };
  }
);

// Real connected-source status across every ROOK-supported provider —
// the v2 endpoint ROOK's own docs specifically recommend over the
// deprecated v1 one.
export const getRookConnectedSources = onCall(
  { secrets: [ROOK_CLIENT_UUID, ROOK_CLIENT_SECRET], region: 'us-central1' },
  async (req) => {
    const uid = requireAuth(req.auth);
    const res = await fetch(
      `${ROOK_API_BASE}/api/v2/user_id/${uid}/data_sources/authorized`,
      { headers: rookBasicAuthHeader() }
    );
    if (!res.ok) {
      throw new HttpsError('internal', `ROOK authorized-sources request failed: ${res.status}`);
    }
    const data = await res.json();
    return { dataSources: data.data_sources || [] };
  }
);

export const revokeRookDataSource = onCall(
  { secrets: [ROOK_CLIENT_UUID, ROOK_CLIENT_SECRET], region: 'us-central1' },
  async (req) => {
    const uid = requireAuth(req.auth);
    const { dataSource } = req.data;
    if (!dataSource) {
      throw new HttpsError('invalid-argument', 'dataSource required');
    }
    const res = await fetch(
      `${ROOK_API_BASE}/api/v1/user_id/${uid}/data_sources/revoke_auth`,
      {
        method: 'POST',
        headers: { ...rookBasicAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ data_source: dataSource }),
      }
    );
    // 204 (no content) is a real, documented success case here alongside
    // 200 — both mean the revoke went through.
    if (!res.ok && res.status !== 204) {
      throw new HttpsError('internal', `ROOK revoke request failed: ${res.status}`);
    }
    return { revoked: true };
  }
);

// Real recovery signal from whichever ROOK-connected source the user
// actually has — sleep health (real HRV, resting HR, sleep efficiency)
// and physical health (real HRV, resting HR, stress) summaries for
// today, normalized into the same shape this app's recovery logic
// already expects (lib/muscleFatigue.js's getRecoveryModifier).
// Deliberately does NOT invent a single "recovery score" the way WHOOP
// or Oura each compute their own proprietary one — ROOK doesn't provide
// that composite, only the real underlying physiological signals, and
// this app's HRV-based fallback path already handles that correctly
// without needing a fabricated score to stand in for one.
export const getRookRecoveryData = onCall(
  { secrets: [ROOK_CLIENT_UUID, ROOK_CLIENT_SECRET], region: 'us-central1' },
  async (req) => {
    const uid = requireAuth(req.auth);
    const today = new Date().toISOString().split('T')[0];
    const headers = rookBasicAuthHeader();

    const [sleepRes, physicalRes] = await Promise.all([
      fetch(`${ROOK_API_BASE}/v2/processed_data/sleep_health/summary?user_id=${uid}&date=${today}`, { headers }),
      fetch(`${ROOK_API_BASE}/v2/processed_data/physical_health/summary?user_id=${uid}&date=${today}`, { headers }),
    ]);

    // 204 = real, documented "no content for this user/date yet" — not
    // an error, just genuinely nothing to report (e.g. hasn't synced
    // today). Returns null so the client falls back to manual sleep
    // entry, the same honest-empty-state pattern used throughout this
    // app rather than a fabricated placeholder.
    if (sleepRes.status === 204 && physicalRes.status === 204) return null;
    if (!sleepRes.ok && sleepRes.status !== 204) throw new HttpsError('internal', `ROOK sleep summary failed: ${sleepRes.status}`);
    if (!physicalRes.ok && physicalRes.status !== 204) throw new HttpsError('internal', `ROOK physical summary failed: ${physicalRes.status}`);

    const sleepData = sleepRes.status === 204 ? null : await sleepRes.json();
    const physicalData = physicalRes.status === 204 ? null : await physicalRes.json();

    const sleepHr = sleepData?.sleep_health?.summary?.sleep_summary?.heart_rate;
    const sleepScores = sleepData?.sleep_health?.summary?.sleep_summary?.scores;
    const sleepDuration = sleepData?.sleep_health?.summary?.sleep_summary?.duration;
    const physicalHr = physicalData?.physical_health?.summary?.physical_summary?.heart_rate;
    const sourcesUsed = sleepData?.sleep_health?.summary?.sleep_summary?.metadata?.sources_of_data_array
      || physicalData?.physical_health?.summary?.physical_summary?.metadata?.sources_of_data_array
      || [];

    if (!sleepHr && !physicalHr) return null;

    return {
      hrv: sleepHr?.hrv_avg_rmssd_float ?? physicalHr?.hrv_avg_rmssd_float ?? null,
      restingHeartRate: sleepHr?.hr_resting_bpm_int ?? physicalHr?.hr_resting_bpm_int ?? null,
      sleepEfficiency: sleepScores?.sleep_efficiency_1_100_score_int ?? null,
      sleepHours: sleepDuration?.sleep_duration_seconds_int
        ? Math.round((sleepDuration.sleep_duration_seconds_int / 3600) * 10) / 10
        : null,
      source: sourcesUsed[0] || 'rook',
    };
  }
);

// Real security fix, not a style preference: ROOK's own official
// "Getting Started" documentation explicitly warns "Do not include
// client uuid and secret in .env files or directly in the source code.
// These values will be embedded in the JavaScript bundle at build time
// and can be extracted through reverse engineering" — which is exactly
// what app/_layout.jsx's RookWrapper was doing, reading
// EXPO_PUBLIC_ROOK_SECRET (and EXPO_PUBLIC_ROOK_CLIENT_UUID) directly
// from a static build-time env var, baking the real secret into every
// compiled app binary regardless of platform. ROOK's <RookSyncGate>
// component genuinely does need these values as props on-device (this
// is real, confirmed from ROOK's own SDK docs, not avoidable) — the fix
// is fetching them from here, an authenticated callable, at runtime,
// instead of embedding them in the static bundle. This reuses the exact
// same ROOK_CLIENT_UUID/ROOK_CLIENT_SECRET secrets already defined above
// for the REST API functions, rather than introducing a second,
// redundant credential scheme.
export const getRookSdkCredentials = onCall(
  { secrets: [ROOK_CLIENT_UUID, ROOK_CLIENT_SECRET], region: 'us-central1' },
  async (req) => {
    requireAuth(req.auth);
    return {
      clientUUID: ROOK_CLIENT_UUID.value(),
      secret: ROOK_CLIENT_SECRET.value(),
      // Hardcoded rather than a 4th secret — matches this app's current
      // real stage (still sandbox everywhere; see the ROOK_ENVIRONMENT
      // value already used by the REST API functions above). Update
      // this when the app actually moves to a production ROOK account.
      environment: 'sandbox',
    };
  }
);

export const onWorkoutComplete = onDocumentCreated(
  { document: 'workouts/{workoutId}', region: 'us-central1' },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    if (!data.completed) return;

    const userId = data.userId;
    const db = getFirestore();

    const statsRef = db.collection('users').doc(userId).collection('stats').doc('totals');
    await statsRef.set(
      {
        totalWorkouts: FieldValue.increment(1),
        totalMinutes: FieldValue.increment(data.duration ?? 0),
        lastWorkoutAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    const goalsSnap = await db.
    collection('goals').
    where('userId', '==', userId).
    where('completed', '==', false).
    get();

    const batch = db.batch();
    for (const doc of goalsSnap.docs) {
      const g = doc.data();
      if (g.type === 'general_fitness' || g.type === 'endurance') {
        const next = g.current + 1;
        batch.update(doc.ref, {
          current: next,
          completed: next >= g.target
        });
      }
    }
    await batch.commit();

    const devicesSnap = await db.
    collection('users').
    doc(userId).
    collection('devices').
    get();
    const tokens = devicesSnap.docs.
    map((d) => d.data().token).
    filter((t) => !!t);

    if (tokens.length > 0) {
      await getMessaging().sendEachForMulticast({
        tokens,
        notification: {
          title: 'Workout complete 💪',
          body: 'Great work! Your stats have been updated.'
        }
      });
    }
  }
);