import { db } from '../src/config/firebase';
import {
  collection, addDoc, query, where, getDocs, serverTimestamp,
} from 'firebase/firestore';

// Real, new: readable labels for the raw ids app/profile/edit.jsx's
// GOALS/INJURIES constants store on the user, so the system prompt below
// can reference them in plain English rather than raw snake_case ids.
// Kept local rather than importing from edit.jsx, since that file doesn't
// currently export these lists.
const GOAL_LABELS = {
  lose_weight: 'Lose Weight',
  build_muscle: 'Build Muscle',
  improve_endurance: 'Improve Endurance',
  stay_active: 'Stay Active',
  train_for_race: 'Train for a Race',
  eat_healthier: 'Eat Healthier',
  reduce_stress: 'Reduce Stress',
};

const INJURY_LABELS = {
  knee: 'Knee',
  shoulder: 'Shoulder',
  lower_back: 'Lower Back',
  hip: 'Hip',
  ankle: 'Ankle',
  wrist: 'Wrist',
  elbow: 'Elbow',
  neck: 'Neck',
};

// Real, new: this is what actually makes this a "coach" rather than a
// generic chatbot - injects the user's real, stored goals, injuries,
// fitness level, and nutrition preference (app/profile/edit.jsx's
// fitnessMetrics fields) as a system message, so the AI can reference
// real specifics rather than only what the user happens to type in a
// given message. Every field degrades gracefully when unset - a brand
// new profile with nothing filled in still produces a clean, sensible
// prompt, not an awkward "Goals: ." fragment.
export function buildCoachSystemPrompt(user) {
  const name = user?.name?.trim() || 'there';
  const goals = (user?.fitnessMetrics?.targetGoals || []).map((id) => GOAL_LABELS[id] || id);
  const injuries = (user?.fitnessMetrics?.injuries || []).map((id) => INJURY_LABELS[id] || id);
  const level = user?.fitnessLevel || 'unspecified';
  const nutritionPref = user?.fitnessMetrics?.nutritionPreference;

  const lines = [
    `You are ZOWN's AI fitness coach, in an ongoing coaching conversation with ${name}.`,
    `Fitness level: ${level}.`,
    goals.length ? `Goals: ${goals.join(', ')}.` : null,
    injuries.length
      ? `Reported injuries/areas to be careful with: ${injuries.join(', ')}. Take these seriously when suggesting exercises.`
      : null,
    nutritionPref && nutritionPref !== 'no_preference'
      ? `Nutrition preference: ${nutritionPref.replace(/_/g, ' ')}.`
      : null,
    'Be encouraging, specific, and concise. Reference their real goals and injuries naturally when relevant, not every message.',
  ].filter(Boolean);

  return { role: 'system', content: lines.join(' ') };
}

// Real, new: persistent coaching history, distinct from
// app/profile/help.jsx's chat (which is local component state only and
// resets on navigation). Equality-only where clause, matching
// store/workoutStore.js's getExerciseHistory - avoids needing a
// composite index; sorted chronologically client-side instead.
export async function getCoachHistory(uid) {
  if (!uid) return [];
  const q = query(collection(db, 'coachMessages'), where('userId', '==', uid));
  const snap = await getDocs(q);
  const messages = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      role: data.role,
      content: data.content,
      createdAt: data.createdAt?.toDate?.() ?? new Date(0),
    };
  });
  messages.sort((a, b) => a.createdAt - b.createdAt);
  return messages;
}

export async function saveCoachMessage(uid, role, content) {
  if (!uid) return;
  await addDoc(collection(db, 'coachMessages'), {
    userId: uid,
    role,
    content,
    createdAt: serverTimestamp(),
  });
}
