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

function getOpenAI() {
  return new OpenAI({ apiKey: OPENAI_API_KEY.value() });
}

function requireAuth(auth: { uid?: string } | undefined) {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Must be signed in');
  }
  return auth.uid;
}

async function saveRecommendation(data: {
  userId: string;
  type: 'workout_plan' | 'nutrition' | 'progress_summary' | 'form_tip';
  content: string;
  structuredData?: Record<string, unknown>;
  prompt: string;
}) {
  const db = getFirestore();
  const ref = await db.collection('aiRecommendations').add({
    ...data,
    isRead: false,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export const generateWorkoutPlan = onCall(
  { secrets: [OPENAI_API_KEY], region: 'us-central1' },
  async (req) => {
    const uid = requireAuth(req.auth);
    const { fitnessLevel, goals, history } = req.data as {
      fitnessLevel: string;
      goals: string[];
      history?: Array<{ name: string; date: string; duration: number }>;
    };

    const prompt = `Create a personalized 7-day workout plan for a ${fitnessLevel} user with goals: ${goals.join(
      ', ',
    )}. Recent workout history: ${JSON.stringify(history ?? [])}. Return strict JSON with shape { "days": [{ "day": string, "focus": string, "exercises": [{ "name": string, "sets": number, "reps": number, "restSeconds": number }] }] }.`;

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are an elite personal trainer. Always return valid JSON.' },
        { role: 'user', content: prompt },
      ],
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
      prompt,
    });

    return { recommendationId, plan: structured };
  },
);

export const getProgressSummary = onCall(
  { secrets: [OPENAI_API_KEY], region: 'us-central1' },
  async (req) => {
    const uid = requireAuth(req.auth);
    const { dateRange } = req.data as {
      userId: string;
      dateRange: { start: string; end: string };
    };

    const db = getFirestore();
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const snap = await db
      .collection('workouts')
      .where('userId', '==', uid)
      .where('date', '>=', start)
      .where('date', '<=', end)
      .get();

    const workouts = snap.docs.map((d) => d.data());
    const prompt = `Summarize this user's fitness progress from ${dateRange.start} to ${dateRange.end}. Workouts: ${JSON.stringify(workouts)}. Provide a warm, 2-3 paragraph natural-language summary with specific stats and encouragement.`;

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a supportive fitness coach.' },
        { role: 'user', content: prompt },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? '';

    const recommendationId = await saveRecommendation({
      userId: uid,
      type: 'progress_summary',
      content,
      prompt,
      structuredData: { workoutCount: workouts.length, dateRange },
    });

    return { recommendationId, summary: content };
  },
);

export const getNutritionRecommendations = onCall(
  { secrets: [OPENAI_API_KEY], region: 'us-central1' },
  async (req) => {
    const uid = requireAuth(req.auth);
    const { recentWorkouts, goals } = req.data as {
      recentWorkouts: Array<{ name: string; calories?: number; duration: number }>;
      goals: string[];
    };

    const prompt = `Provide nutrition recommendations for a user with goals: ${goals.join(
      ', ',
    )}. Recent workouts: ${JSON.stringify(recentWorkouts)}. Include daily macro targets and 3 meal ideas. Return strict JSON { "dailyMacros": { "calories": number, "protein": number, "carbs": number, "fat": number }, "mealIdeas": [{ "name": string, "description": string }] }.`;

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a sports nutrition expert. Return valid JSON.' },
        { role: 'user', content: prompt },
      ],
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
      prompt,
    });

    return { recommendationId, recommendations: structured };
  },
);

export const refreshSpotifyToken = onCall(
  { secrets: [SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET], region: 'us-central1' },
  async (req) => {
    requireAuth(req.auth);
    const { refreshToken } = req.data as { refreshToken: string };
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
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new HttpsError('internal', `Spotify refresh failed: ${body}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      refreshToken: data.refresh_token,
    };
  },
);

export const sendWorkoutReminder = onCall(
  { region: 'us-central1' },
  async (req) => {
    requireAuth(req.auth);
    const { userId, message } = req.data as { userId: string; message: string };
    if (!userId || !message) {
      throw new HttpsError('invalid-argument', 'userId and message required');
    }

    const db = getFirestore();
    const devicesSnap = await db
      .collection('users')
      .doc(userId)
      .collection('devices')
      .get();

    const tokens = devicesSnap.docs
      .map((d) => d.data().token | undefined)
      .filter((t): t is string => !!t);

    if (tokens.length === 0) return { sent: 0 };

    const response = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title: 'Zown HQ', body: message },
    });

    return { sent: response.successCount, failed: response.failureCount };
  },
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
        totalMinutes: FieldValue.increment((data.duration) ?? 0),
        lastWorkoutAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const goalsSnap = await db
      .collection('goals')
      .where('userId', '==', userId)
      .where('completed', '==', false)
      .get();

    const batch = db.batch();
    for (const doc of goalsSnap.docs) {
      const g = doc.data();
      if (g.type === 'general_fitness' || g.type === 'endurance') {
        const next = (g.current) + 1;
        batch.update(doc.ref, {
          current: next,
          completed: next >= (g.target),
        });
      }
    }
    await batch.commit();

    const devicesSnap = await db
      .collection('users')
      .doc(userId)
      .collection('devices')
      .get();
    const tokens = devicesSnap.docs
      .map((d) => d.data().token | undefined)
      .filter((t): t is string => !!t);

    if (tokens.length > 0) {
      await getMessaging().sendEachForMulticast({
        tokens,
        notification: {
          title: 'Workout complete 💪',
          body: 'Great work! Your stats have been updated.',
        },
      });
    }
  },
);
