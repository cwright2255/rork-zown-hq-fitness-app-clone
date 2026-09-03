import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
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
const ROOK_API_BASE = 'https://api.rook-connect.review'; // sandbox host - see comment above for why

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
    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
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
    } catch (err) {
      console.error('[generateBodyCompositionInsight] OpenAI call failed:', err?.message || err);
      throw err;
    }

    const text = completion.choices[0]?.message?.content ?? '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.error('[generateBodyCompositionInsight] Failed to parse model output as JSON. Raw text:', text);
      throw err;
    }
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
    const { recentWorkouts, goals, profile } = req.data;

    // Real profile data, when available, grounds this in an actual BMR
    // calculation instead of a generic estimate - previously this was
    // never called with anything but goals/workouts (in fact never
    // called at all before this), so there was no real personalization
    // possible. Each line is only included if the real value is
    // present, rather than padding the prompt with unknowns.
    const p = profile || {};
    const profileLines = [];
    if (p.weightKg) profileLines.push(`Current weight: ${p.weightKg} kg`);
    if (p.targetWeightKg) profileLines.push(`Target weight: ${p.targetWeightKg} kg`);
    if (p.heightCm) profileLines.push(`Height: ${p.heightCm} cm`);
    if (p.age) profileLines.push(`Age: ${p.age}`);
    if (p.gender) profileLines.push(`Gender: ${p.gender}`);
    if (p.activityLevel) profileLines.push(`Activity level: ${p.activityLevel}`);
    if (p.nutritionPreference && p.nutritionPreference !== 'no_preference') {
      profileLines.push(`Dietary preference: ${p.nutritionPreference}`);
    }

    const prompt = `Calculate a personalized daily calorie and macro target for this user, and suggest 3 meal ideas that genuinely fit their real dietary preference.

Real profile data:
${profileLines.length ? profileLines.join('\n') : 'No profile data provided - use general population defaults and say so honestly in the summary rather than presenting the estimate as personalized.'}

Stated goals: ${(goals || []).join(', ') || 'none stated'}
Recent workouts (last 30 days): ${JSON.stringify(recentWorkouts ?? [])}

Base the calorie target on a real, honest calculation: derive BMR using the Mifflin-St Jeor equation from the real weight/height/age/gender given (if gender is not Male or Female, average the male and female formula results rather than guessing which applies), multiply by a realistic activity factor for the stated activity level, then adjust for the goal - a real, moderate deficit of roughly 300-500 kcal/day if target weight is below current weight, a moderate surplus of roughly 200-300 kcal/day if above, maintenance if equal or no target weight was given. Never recommend a deficit below 1200 kcal/day for any adult regardless of the numbers. If a real dietary preference was given, make all 3 meal ideas genuinely fit it, not generic meals with a note bolted on.

Return strict JSON { "dailyMacros": { "calories": number, "protein": number, "carbs": number, "fat": number }, "mealIdeas": [{ "name": string, "description": string }], "summary": string }. "summary" is one honest sentence naming what actually shaped this number (e.g. "Based on your BMR, moderately active level, and a goal to lose 10 lbs, this targets a 400 kcal/day deficit.") - if profile data was missing, say that honestly instead.`;

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
      { role: 'system', content: 'You are a sports nutrition expert calculating real, personalized calorie and macro targets from real body metrics using established formulas (Mifflin-St Jeor for BMR). Always return valid JSON. Never invent a number you have not actually derived from the given data, and never state an estimate with false precision or as personalized when the real inputs to personalize it were not provided.' },
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
      // Real diagnostic, not decoration: surfacing only res.status (no
      // body) on the first 401 hid the actual reason ROOK's server
      // rejected the request, which is why the sandbox-host fix alone
      // wasn't enough to resolve this - we were guessing at a second
      // cause with no real evidence. This exposes exactly what ROOK's
      // API itself says is wrong.
      const bodyText = await res.text().catch(() => '');
      console.error('[ROOK] authorizer request failed', { status: res.status, body: bodyText });
      throw new HttpsError('internal', `ROOK authorizer request failed: ${res.status} - ${bodyText}`);
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

// Real calendar boundaries for each cadence — not arbitrary day counts.
// periodKey is a stable identifier for "which day/week/month/season this
// is", used below to check whether a current challenge already exists
// for a cadence before generating a new one, and by the client to know
// which loaded challenge is the CURRENT one for each cadence. All in
// UTC for server/client consistency; not user-timezone-aware, which
// only matters right at a boundary edge and isn't worth the added
// complexity here.
function getDayBounds(now) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCHours(23, 59, 59, 999);
  return { periodKey: `day-${start.toISOString().slice(0, 10)}`, start, end };
}

function getWeekBounds(now) {
  const dayNum = (now.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayNum));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  return { periodKey: `week-${monday.toISOString().slice(0, 10)}`, start: monday, end: sunday };
}

function getMonthBounds(now) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  const periodKey = `month-${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return { periodKey, start, end };
}

// Real meteorological seasons (Northern Hemisphere convention — a known
// simplification; Southern Hemisphere users get labels six months out
// of sync with their actual weather, worth revisiting if that matters
// for this app's real user base): Winter=Dec-Feb, Spring=Mar-May,
// Summer=Jun-Aug, Fall=Sep-Nov.
function getSeasonBounds(now) {
  const month = now.getUTCMonth(); // 0-11
  const year = now.getUTCFullYear();
  let seasonName, startYear, startMonth, endYear, endMonthExclusive;

  if (month === 11) {
    seasonName = 'winter'; startYear = year; startMonth = 11; endYear = year + 1; endMonthExclusive = 2;
  } else if (month <= 1) {
    seasonName = 'winter'; startYear = year - 1; startMonth = 11; endYear = year; endMonthExclusive = 2;
  } else if (month <= 4) {
    seasonName = 'spring'; startYear = year; startMonth = 2; endYear = year; endMonthExclusive = 5;
  } else if (month <= 7) {
    seasonName = 'summer'; startYear = year; startMonth = 5; endYear = year; endMonthExclusive = 8;
  } else {
    seasonName = 'fall'; startYear = year; startMonth = 8; endYear = year; endMonthExclusive = 11;
  }

  const start = new Date(Date.UTC(startYear, startMonth, 1));
  const end = new Date(Date.UTC(endYear, endMonthExclusive, 0, 23, 59, 59, 999));
  const periodKey = `season-${seasonName}-${startYear}`;
  return { periodKey, start, end, seasonName };
}

const CADENCE_GUIDANCE = {
  daily: 'achievable within a single day — a concrete, specific target like a rep count, a single workout, or minutes of activity today',
  weekly: 'achievable within 7 days — typically 3-5 workouts or a multi-day streak within the week',
  monthly: 'achievable within about 30 days — a larger cumulative goal, e.g. 12-16 workouts, or trying multiple categories for variety',
};

// Real per-user opt-in for AI-generated community challenges (see
// generateChallenges below). Challenges themselves live in the shared
// /challenges collection, not here — this just tracks which ones this
// user has joined. Nothing to update: leaving and rejoining is a
// delete + recreate, not an edit, so there's no partial-state case to
// handle.
export const generateChallenges = onCall(
  { secrets: [OPENAI_API_KEY], region: 'us-central1' },
  async (req) => {
    const uid = requireAuth(req.auth);
    const db = getFirestore();
    const now = new Date();

    const periods = {
      daily: getDayBounds(now),
      weekly: getWeekBounds(now),
      monthly: getMonthBounds(now),
      seasonal: getSeasonBounds(now),
    };

    // Only generate cadences that don't already have a current challenge
    // — repeat visits within the same day/week/month/season should never
    // create duplicates.
    const existingChecks = await Promise.all(
      Object.entries(periods).map(([cadence, period]) =>
        db.collection('challenges')
          .where('cadence', '==', cadence)
          .where('periodKey', '==', period.periodKey)
          .limit(1)
          .get()
      )
    );

    const cadenceNames = Object.keys(periods);
    const needed = cadenceNames.filter((_, i) => existingChecks[i].empty);

    if (needed.length === 0) {
      return { generated: [], communityStats: null };
    }

    // Real community stats, computed fresh on every call rather than
    // cached on a schedule — current real usage (see /workouts
    // collection size today) is small enough that this is cheap. Worth
    // moving to a scheduled daily aggregate instead of computing this
    // inline once usage grows enough to make that cost noticeable.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const workoutsSnap = await db.collection('workouts')
      .where('completed', '==', true)
      .where('date', '>=', thirtyDaysAgo)
      .limit(500)
      .get();

    const categoryCounts = {};
    const difficultyCounts = {};
    const activeUserIds = new Set();
    workoutsSnap.docs.forEach((doc) => {
      const w = doc.data();
      if (w.category) categoryCounts[w.category] = (categoryCounts[w.category] || 0) + 1;
      if (w.difficulty) difficultyCounts[w.difficulty] = (difficultyCounts[w.difficulty] || 0) + 1;
      if (w.userId) activeUserIds.add(w.userId);
    });

    // Real leaderboard/streak/level distribution — the other half of
    // "community data" (see store/leaderboardStore.js), already
    // client-readable but not previously used to inform anything.
    const leaderboardSnap = await db.collection('leaderboard').limit(200).get();
    let totalStreak = 0;
    let totalLevel = 0;
    let lbCount = 0;
    leaderboardSnap.docs.forEach((doc) => {
      const l = doc.data();
      if (typeof l.streak === 'number') totalStreak += l.streak;
      if (typeof l.level === 'number') totalLevel += l.level;
      lbCount += 1;
    });

    const communityStats = {
      activeUsersLast30Days: activeUserIds.size,
      totalCompletedWorkoutsLast30Days: workoutsSnap.size,
      topCategories: Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count })),
      difficultyBreakdown: difficultyCounts,
      avgStreakDays: lbCount > 0 ? Math.round((totalStreak / lbCount) * 10) / 10 : null,
      avgLevel: lbCount > 0 ? Math.round((totalLevel / lbCount) * 10) / 10 : null,
      leaderboardSampleSize: lbCount,
    };

    const guidanceLines = needed.map((c) => {
      if (c === 'seasonal') {
        return `- seasonal: tied to the current ${periods.seasonal.seasonName} season — an ambitious, multi-week cumulative goal or long streak, scaled to however many days remain in the season (${Math.max(1, Math.round((periods.seasonal.end - now) / (24 * 60 * 60 * 1000)))} days left)`;
      }
      return `- ${c}: ${CADENCE_GUIDANCE[c]}`;
    });

    const prompt = `Generate exactly one fitness challenge for each of these cadences: ${needed.join(', ')}.

What "achievable" means for each requested cadence:
${guidanceLines.join('\n')}

Real community activity data from the last 30 days (${communityStats.totalCompletedWorkoutsLast30Days} completed workouts from ${communityStats.activeUsersLast30Days} active users):
${JSON.stringify(communityStats, null, 2)}

Base these on established fitness industry guidelines (e.g. ACSM/CDC recommend 150+ minutes/week of moderate cardio or 75+ minutes/week vigorous, plus 2+ strength sessions/week) and well-known real challenge formats. Use the community data to calibrate difficulty and focus: if average streak is low, lean beginner-friendly; if one category dominates activity, favor a different, underrepresented category to encourage variety. Do not invent statistics beyond what's given above.

Return strict JSON: { "challenges": [{ "cadence": string, "title": string, "description": string, "category": string, "difficulty": "beginner"|"intermediate"|"advanced", "goalType": "workout_count"|"streak_days", "goalTarget": number, "basedOn": string }] }. Return exactly one object per requested cadence, with "cadence" set to exactly one of: ${needed.join(', ')}. "basedOn" is one honest sentence naming the specific guideline or community stat that shaped this challenge.`;

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a fitness program designer creating realistic, achievable community challenges grounded in real activity data and established exercise science guidelines. Always return valid JSON. Never invent statistics beyond what you are given.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? '{}';
    let structured = {};
    try {
      structured = JSON.parse(content);
    } catch {
      structured = { challenges: [] };
    }

    const rawChallenges = Array.isArray(structured.challenges) ? structured.challenges : [];
    const batch = db.batch();
    const created = [];
    const usedCadences = new Set();

    rawChallenges.forEach((c) => {
      // Defensive: only accept a cadence we actually asked for, and only
      // once each — an LLM occasionally returning a duplicate or
      // unexpected cadence shouldn't silently overwrite another one.
      if (!needed.includes(c.cadence) || usedCadences.has(c.cadence)) return;
      usedCadences.add(c.cadence);

      const cadence = c.cadence;
      const period = periods[cadence];
      const ref = db.collection('challenges').doc();
      const goalType = c.goalType === 'streak_days' ? 'streak_days' : 'workout_count';
      const doc = {
        title: c.title || 'Fitness Challenge',
        description: c.description || '',
        category: c.category || 'General',
        difficulty: ['beginner', 'intermediate', 'advanced'].includes(c.difficulty) ? c.difficulty : 'beginner',
        cadence,
        periodKey: period.periodKey,
        goalType,
        goalTarget: typeof c.goalTarget === 'number' && c.goalTarget > 0 ? Math.round(c.goalTarget) : 1,
        basedOn: c.basedOn || '',
        startDate: period.start,
        endDate: period.end,
        communityStatsSnapshot: communityStats,
        createdBy: uid,
        source: 'ai_generated',
        createdAt: FieldValue.serverTimestamp(),
      };
      batch.set(ref, doc);
      created.push({
        id: ref.id,
        ...doc,
        startDate: period.start.toISOString(),
        endDate: period.end.toISOString(),
      });
    });

    if (created.length > 0) {
      await batch.commit();
    }

    return { generated: created, communityStats };
  }
);

// Real proxy for Calorie API's food search - kept server-side rather
// than called directly from the app because Calorie API's own React
// Native integration guide explicitly recommends against embedding this
// key in a mobile client (a compiled binary can be decompiled and the
// key extracted). The real key lives only in CALORIE_API_KEY below,
// never in the app bundle. Returns the raw Calorie API response
// verbatim - services/calorieApiService.js on the client already has
// the field-mapping logic for the real per-100g response shape, no
// need to duplicate that here.
const CALORIE_API_KEY = defineSecret('CALORIE_API_KEY');
const CALORIE_API_BASE_URL = 'https://calorieapiadmin.com/api/v1'; // real base URL confirmed from https://calorieapi.com/docs - NOT api.calorieapi.com, which their own blog content inconsistently uses

export const searchCalorieApiFoods = onCall(
  { secrets: [CALORIE_API_KEY], region: 'us-central1' },
  async (req) => {
    requireAuth(req.auth);
    const { query } = req.data;
    if (!query || !query.trim()) {
      throw new HttpsError('invalid-argument', 'query required');
    }

    const res = await fetch(
      `${CALORIE_API_BASE_URL}/search/foods?q=${encodeURIComponent(query)}`,
      { headers: { 'X-API-Key': CALORIE_API_KEY.value() } }
    );

    if (!res.ok) {
      // Real diagnostic on failure, matching the same pattern already
      // proven useful for ROOK above - the previous direct-from-client
      // 401 gave no visibility into Calorie API's own stated reason.
      const bodyText = await res.text().catch(() => '');
      console.error('[searchCalorieApiFoods] request failed', { status: res.status, body: bodyText });
      throw new HttpsError('internal', `Calorie API search failed: ${res.status} - ${bodyText}`);
    }

    return await res.json();
  }
);

export const getCalorieApiFoodById = onCall(
  { secrets: [CALORIE_API_KEY], region: 'us-central1' },
  async (req) => {
    requireAuth(req.auth);
    const { id } = req.data;
    if (!id) {
      throw new HttpsError('invalid-argument', 'id required');
    }

    const res = await fetch(`${CALORIE_API_BASE_URL}/foods/${id}`, {
      headers: { 'X-API-Key': CALORIE_API_KEY.value() }
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      console.error('[getCalorieApiFoodById] request failed', { status: res.status, body: bodyText });
      throw new HttpsError('internal', `Calorie API food detail failed: ${res.status} - ${bodyText}`);
    }

    return await res.json();
  }
);

// Real barcode lookup - replaces the previous approach in
// app/nutrition/barcode-scan.jsx, which sent the barcode number to an
// LLM and explicitly asked it to "create a plausible food product" when
// the barcode wasn't recognized, fabricating data rather than reporting
// an honest miss. Calorie API's real barcode endpoint checks its own
// catalog first, falls back to Open Food Facts, and returns a genuine
// 404 ("Food not found for barcode") when neither has it - that 404 is
// a real, expected outcome here, not an error condition, so it's
// returned as { found: false } rather than thrown, letting the client
// route to manual search exactly as Calorie API's own docs recommend,
// instead of inventing a product that doesn't exist.
export const lookupCalorieApiBarcode = onCall(
  { secrets: [CALORIE_API_KEY], region: 'us-central1' },
  async (req) => {
    requireAuth(req.auth);
    const { barcode } = req.data;
    if (!barcode) {
      throw new HttpsError('invalid-argument', 'barcode required');
    }

    const res = await fetch(`${CALORIE_API_BASE_URL}/search/barcode/${encodeURIComponent(barcode)}`, {
      headers: { 'X-API-Key': CALORIE_API_KEY.value() }
    });

    if (res.status === 404) {
      return { found: false };
    }

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      console.error('[lookupCalorieApiBarcode] request failed', { status: res.status, body: bodyText });
      throw new HttpsError('internal', `Calorie API barcode lookup failed: ${res.status} - ${bodyText}`);
    }

    const data = await res.json();
    return { found: true, ...data };
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

    // Real duel progress, computed and written server-side because
    // neither participant's device can read the other's private workout
    // history directly (see firestore.rules: workouts/{id} is
    // owner-only read) - this is the only place duel progress is ever
    // written, clients only ever read it. workout_count duels get +1
    // per completed workout; calories/duration duels get the real value
    // straight off this completion event, never estimated.
    // first_to_target duels settle the instant someone reaches the
    // target, right here. most_by_deadline duels are deliberately NOT
    // settled here - "most by a date" has no single completion event to
    // hook, so that mode is settled by real deadline comparison
    // client-side instead (see app/social.jsx).
    const duelsSnap = await db.collection('duels')
      .where('participantIds', 'array-contains', userId)
      .where('status', '==', 'active')
      .get();

    duelsSnap.docs.forEach((docSnap) => {
      const duel = docSnap.data();
      let delta = 0;
      if (duel.type === 'workout_count') delta = 1;
      else if (duel.type === 'calories') delta = data.caloriesBurned || 0;
      else if (duel.type === 'duration') delta = data.duration || 0;
      if (delta <= 0) return;

      const currentProgress = duel.progress?.[userId] || 0;
      const newProgress = currentProgress + delta;
      const update = { [`progress.${userId}`]: newProgress };

      if (duel.mode === 'first_to_target' && newProgress >= duel.goalTarget) {
        update.status = 'completed';
        update.winnerId = userId;
        update.completedAt = FieldValue.serverTimestamp();
      }
      batch.update(docSnap.ref, update);
    });

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

// Real fix for Instagram recipe import: confirmed directly, in-app
// requests to Instagram from the user's phone get served a generic
// blocked/login-wall page (HTTP 200, title="Instagram", login/error
// markers present) even though the exact same request via curl from a
// dev/datacenter environment succeeds and returns the real post
// content, including the caption, unchanged. This runs the fetch
// server-side instead, from Google Cloud's own network - matching the
// network profile that has been confirmed to work - rather than from
// the device directly. Uses the same, already-verified extraction
// pattern as the app's own recipeExtractionService.js.
export const instagramEmbed = onRequest(
  { region: 'us-central1', cors: true },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'Missing "url" in request body' });
      return;
    }

    try {
      const parsed = new URL(url);
      let path = parsed.pathname;
      if (!path.endsWith('/')) path += '/';
      const embedUrl = `${parsed.origin}${path}embed/captioned/`;

      const response = await fetch(embedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)' }
      });

      if (!response.ok) {
        res.status(502).json({ error: `Instagram embed page returned HTTP ${response.status}` });
        return;
      }

      const html = await response.text();

      const captionMatch = html.match(/"edge_media_to_caption":\{"edges":\[\{"node":\{"text":"((?:[^"\\]|\\.)*)"/);
      if (!captionMatch) {
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        const hasPartialMarker = html.includes('edge_media_to_caption');
        const hasLoginMarker = /log ?in|Log In|challenge|rate.?limit|Sorry, this page/i.test(html);
        res.status(404).json({
          error: `No caption pattern found (server-side fetch): HTTP ${response.status}, ${html.length} chars, title="${titleMatch?.[1] || 'none'}", contains "edge_media_to_caption" substring: ${hasPartialMarker}, login/error markers present: ${hasLoginMarker}`
        });
        return;
      }

      let caption;
      try {
        caption = JSON.parse(`"${captionMatch[1]}"`);
      } catch (e) {
        res.status(500).json({ error: `Caption pattern matched but failed to JSON-decode: ${e?.message}` });
        return;
      }
      if (!caption) {
        res.status(404).json({ error: 'Caption pattern matched but decoded to empty string' });
        return;
      }

      const usernameMatch = html.match(/"owner":\{"id":"[^"]*","username":"((?:[^"\\]|\\.)*)"/);
      const thumbnailMatch = html.match(/"thumbnail_src":"((?:[^"\\]|\\.)*)"/);
      let username = null;
      let thumbnail = null;
      try {
        if (usernameMatch) username = JSON.parse(`"${usernameMatch[1]}"`);
        if (thumbnailMatch) thumbnail = JSON.parse(`"${thumbnailMatch[1]}"`);
      } catch {
        // caption is the essential piece here, keep it regardless
      }

      res.status(200).json({ caption, username, thumbnail });
    } catch (error) {
      res.status(500).json({ error: `Server error: ${error?.message}` });
    }
  }
);
