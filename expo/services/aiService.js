import { useExpStore } from '@/store/expStore';
import { wearableService } from '@/services/wearableService';
import { useUserStore } from '@/store/userStore';

const LLM_URL = 'https://toolkit.rork.com/text/llm/';

const withTimeout = async (p, ms, signal) => {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => {
      if (signal && 'aborted' in signal && signal.aborted) return;
      reject(new Error('Request timed out'));
    }, ms);
    p.then(v => {
      clearTimeout(id);
      resolve(v);
    }).catch(e => {
      clearTimeout(id);
      reject(e);
    });
  });
};

const postLLM = async (messages, timeoutMs = 30000, retries = 1) => {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const req = fetch(LLM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
        signal: controller.signal,
      });
      const res = await withTimeout(req, timeoutMs, controller.signal);
      const data = await res.json();
      if (!data || typeof data.completion !== 'string') throw new Error('Invalid LLM response');
      return data;
    } catch (e) {
      lastErr = e;
      if (attempt === retries) break;
      await new Promise(r => setTimeout(r, 400));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('LLM request failed');
};

const parseJSONSafe = (text) => {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
};

const normalizeExercise = (e, fallbackDifficulty, idx) => {
  const name = typeof e?.name === 'string' && e.name.trim().length > 0 ? e.name : `Exercise ${idx + 1}`;
  const sets = Number.isFinite(e?.sets) ? Number(e.sets) : 3;
  const reps = Number.isFinite(e?.reps) ? Number(e.reps) : 10;
  const restTime = Number.isFinite(e?.restTime) ? Number(e.restTime) : 60;
  const description = typeof e?.description === 'string' ? e.description : '';
  const muscleGroups = Array.isArray(e?.muscleGroups) ? e.muscleGroups.map((m) => String(m)) : [];
  const equipment = Array.isArray(e?.equipment) ? e.equipment.map((m) => String(m)) : [];
  const difficulty = ['beginner','intermediate','advanced'].includes(e?.difficulty) ? e.difficulty : fallbackDifficulty;
  const duration = Number.isFinite(e?.duration) ? Number(e.duration) : undefined;
  const imageUrl = typeof e?.imageUrl === 'string' && e.imageUrl ? e.imageUrl : 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=500';
  return {
    id: `ex-${Date.now()}-${idx}`,
    name,
    sets,
    reps,
    duration,
    restTime,
    description,
    imageUrl,
    difficulty,
    muscleGroups,
    equipment,
  };
};

const getWorkoutImage = (category) => {
  const images = {
    strength: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500',
    cardio: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=500',
    flexibility: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500',
    hiit: 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=500',
    yoga: 'https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?w=500',
    pilates: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=500',
    crossfit: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=500',
    bodyweight: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500',
  };
  const key = typeof category === 'string' ? category.toLowerCase() : '';
  return images[key] ?? 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=500';
};

const calculateXpReward = (difficulty, duration) => {
  const baseXp = 50;
  const mult = difficulty === 'beginner' ? 1 : difficulty === 'intermediate' ? 1.5 : difficulty === 'advanced' ? 2 : 1;
  const dur = Math.max(1, Math.ceil((Number.isFinite(duration) ? duration : 30) / 15));
  return Math.round(baseXp * mult * dur);
};

const getUserDietaryContext = () => {
  try {
    const user = typeof useUserStore !== 'undefined' ? useUserStore.getState().user : null;
    const goals = Array.isArray(user?.goals) && user?.goals.length ? user?.goals : [];
    const pref = user?.preferences?.dietaryPreference;
    const restrictions = [];
    if (typeof pref === 'string' && pref.trim().length > 0) {
      restrictions.push(pref.trim());
    }
    return { goals, restrictions };
  } catch (e) {
    console.warn('[AI] user dietary context unavailable', e);
    return { goals: [], restrictions: [] };
  }
};

export const chatAI = async (messages) => {
  const data = await postLLM(messages, 30000, 1);
  return data.completion;
};

export const generateWorkoutPlan = async (request) => {
  try {
    console.log('[AI] generateWorkoutPlan request', request);
    let recoveryNote = '';
    try {
      const mood = await wearableService.getMoodDataFromWearables();
      if (mood) {
        const readinessLabel = mood.confidence >= 70 ? 'high-confidence' : mood.confidence >= 40 ? 'medium-confidence' : 'low-confidence';
        recoveryNote = `TodayRecovery(mood:${mood.mood}/5, energy:${mood.energy}/5, stress:${mood.stress}/5, sleep:${mood.sleep}/5, confidence:${mood.confidence} ${readinessLabel}).`;
      } else {
        recoveryNote = '';
      }
    } catch (e) {
      console.warn('[AI] wearable recovery fetch failed', e);
      recoveryNote = '';
    }

    const userCtx = getUserDietaryContext();
    const sys = {
      role: 'system',
      content:
        'You are a professional fitness trainer. Respond with ONLY valid minified JSON matching the schema {"name":string,"description":string,"difficulty":"beginner"|"intermediate"|"advanced","duration":number,"category":string,"exercises":[{"name":string,"description":string,"muscleGroups":string[],"sets":number,"reps":number,"duration"?:number,"restTime":number,"equipment":string[],"difficulty"?:"beginner"|"intermediate"|"advanced"}]}. No markdown, no code fences. If TodayRecovery indicates low recovery (mood<=2 or energy<=2 or stress>=4 or sleep<=2), favor deload, technique, mobility, zone2 and reduce volume/intensity by 20-40% with longer rests. If high recovery (mood>=4 and energy>=4 and stress<=2 and sleep>=4), you may increase intensity/volume modestly (10-20%) while staying safe. Respect user dietary restrictions for intra/post-workout fueling suggestions if any are implied.',
    };
    const combinedGoals = (request.goals && request.goals.length > 0 ? request.goals : userCtx.goals) ?? [];
    const usr = {
      role: 'user',
      content:
        `Create a workout plan. Level: ${request.fitnessLevel}. Goals: ${combinedGoals.join(', ')}. Duration: ${request.duration} minutes. Equipment: ${request.equipment.length>0?request.equipment.join(', '):'none'}. PreferredGoalDefaults: ${userCtx.goals.join(', ')}. ${userCtx.restrictions.length>0?`DietaryRestrictions:${userCtx.restrictions.join(', ')}.`:''} Include 4-8 exercises and ensure realistic rest times and reps. ${recoveryNote}`,
    };

    const data = await postLLM([sys, usr], 35000, 1);
    const raw = typeof data.completion === 'string' ? data.completion.trim() : '';
    const parsed = parseJSONSafe(raw);
    const name = typeof parsed?.name === 'string' && parsed.name ? parsed.name : 'Personalized Workout';
    const description = typeof parsed?.description === 'string' ? parsed.description : '';
    const difficulty = ['beginner','intermediate','advanced'].includes(parsed?.difficulty) ? parsed.difficulty : request.fitnessLevel;
    const duration = Number.isFinite(parsed?.duration) ? Number(parsed.duration) : request.duration;
    const category = typeof parsed?.category === 'string' && parsed.category ? parsed.category : 'strength';
    const exercisesSource = Array.isArray(parsed?.exercises) ? parsed.exercises : [];
    const exercises = exercisesSource.slice(0, 12).map((e, i) => normalizeExercise(e, difficulty, i));
    const equipment = Array.isArray(parsed?.equipment) ? parsed.equipment.map((x) => String(x)) : request.equipment;
    const muscleGroups = Array.from(new Set(exercises.flatMap(e => e.muscleGroups))).slice(0, 8);
    const calories = Math.max(50, Math.round((duration || 30) * (difficulty === 'advanced' ? 9 : difficulty === 'intermediate' ? 7 : 5)));

    const workout = {
      id: `ai-${Date.now()}`,
      name,
      description,
      duration,
      difficulty,
      category,
      exercises,
      imageUrl: getWorkoutImage(category),
      equipment,
      muscleGroups,
      calories,
      xpReward: calculateXpReward(difficulty, duration),
      isCustom: false,
    };

    try {
      if (typeof useExpStore !== 'undefined') {
        const addExpActivity = useExpStore.getState().addExpActivity;
        addExpActivity({
          id: Date.now().toString(),
          type: 'mainMission',
          baseExp: 1125,
          multiplier: 1.0,
          date: new Date().toISOString().split('T')[0],
          description: `Created ${workout.name} workout plan`,
          completed: true,
        });
      }
    } catch (e) {
      console.error('EXP add error', e);
    }

    return workout;
  } catch (error) {
    console.error('Error generating workout plan', error);
    throw new Error('Failed to generate workout plan. Please try again.');
  }
};

export const generateNutritionAdvice = async (
  goals,
  currentWeight,
  targetWeight,
  dietaryRestrictions
) => {
  try {
    let recoveryNote = '';
    let readiness = 'medium';
    try {
      const mood = await wearableService.getMoodDataFromWearables();
      if (mood) {
        const high = mood.mood >= 4 && mood.energy >= 4 && mood.stress <= 2 && mood.sleep >= 4;
        const low = mood.mood <= 2 || mood.energy <= 2 || mood.sleep <= 2 || mood.stress >= 4;
        readiness = high ? 'high' : low ? 'low' : 'medium';
        const readinessLabel = mood.confidence >= 70 ? 'high-confidence' : mood.confidence >= 40 ? 'medium-confidence' : 'low-confidence';
        recoveryNote = `TodayRecovery(mood:${mood.mood}/5, energy:${mood.energy}/5, stress:${mood.stress}/5, sleep:${mood.sleep}/5, readiness:${readiness}, confidence:${mood.confidence} ${readinessLabel}).`;
      }
    } catch (e) {
      console.warn('[AI] wearable recovery fetch failed', e);
    }

    const userCtx = getUserDietaryContext();
    const finalGoals = goals && goals.length > 0 ? goals : userCtx.goals;
    const finalRestrictions = (dietaryRestrictions && dietaryRestrictions.length > 0 ? dietaryRestrictions : userCtx.restrictions) ?? [];
    const sys = {
      role: 'system',
      content:
        'You are a certified nutritionist. Use TodayRecovery if provided to autoregulate nutrition. Rules: High readiness -> raise carbs by 10-20% (focus starches around training), modestly lower fats, keep protein ~1.6-2.2 g/kg. Low readiness -> emphasize recovery foods (omega-3, berries, leafy greens, turmeric/ginger), keep protein ~1.8-2.2 g/kg, shift carbs to lower-GI and earlier in day, add electrolytes and fluids, limit caffeine late. Medium -> balanced split. Respect restrictions. Output 120-180 words, terse bullet-like lines. Include: daily calories, macro split with gram targets, fueling timing, 3-5 food ideas, 2 tips adapted to readiness. No preamble.',
    };
    const usr = {
      role: 'user',
      content:
        `Goals: ${finalGoals.join(', ')}. PreferredGoalDefaults: ${userCtx.goals.join(', ')}. ${currentWeight?`Current: ${currentWeight}kg. `:''}${targetWeight?`Target: ${targetWeight}kg. `:''}${finalRestrictions.length>0?`Restrictions: ${finalRestrictions.join(', ')}. `:''}${recoveryNote} Provide precise, safe, practical guidance for today.`,
    };

    const data = await postLLM([sys, usr], 28000, 1);
    try {
      if (typeof useExpStore !== 'undefined') {
        const addExpActivity = useExpStore.getState().addExpActivity;
        addExpActivity({
          id: Date.now().toString(),
          type: 'sideMission',
          baseExp: 375,
          multiplier: 1.0,
          date: new Date().toISOString().split('T')[0],
          description: `Received nutrition advice (${readiness} readiness)`,
          completed: true,
        });
      }
    } catch (e) {
      console.error('EXP add error', e);
    }
    return data.completion;
  } catch (error) {
    console.error('Error generating nutrition advice', error);
    throw new Error('Failed to generate nutrition advice. Please try again.');
  }
};

export const getAIDailyTargets = async (params) => {
  try {
    let readiness = 'medium';
    let recoveryNote = '';
    try {
      const mood = await wearableService.getMoodDataFromWearables();
      if (mood) {
        const high = mood.mood >= 4 && mood.energy >= 4 && mood.stress <= 2 && mood.sleep >= 4;
        const low = mood.mood <= 2 || mood.energy <= 2 || mood.sleep <= 2 || mood.stress >= 4;
        readiness = high ? 'high' : low ? 'low' : 'medium';
        const readinessLabel = mood.confidence >= 70 ? 'high-confidence' : mood.confidence >= 40 ? 'medium-confidence' : 'low-confidence';
        recoveryNote = `TodayRecovery(mood:${mood.mood}/5, energy:${mood.energy}/5, stress:${mood.stress}/5, sleep:${mood.sleep}/5, readiness:${readiness}, confidence:${mood.confidence} ${readinessLabel}).`;
      }
    } catch (e) {
      console.warn('[AI] wearable readiness unavailable', e);
    }

    const userCtx = getUserDietaryContext();
    const finalGoals = params.goals && params.goals.length > 0 ? params.goals : userCtx.goals;
    const finalRestrictions = (params.dietaryRestrictions && params.dietaryRestrictions.length > 0 ? params.dietaryRestrictions : userCtx.restrictions) ?? [];
    const sys = {
      role: 'system',
      content:
        'You are a sports nutrition coach. Return ONLY minified JSON matching {"calories":number,"protein":number,"carbs":number,"fat":number,"water":number,"rationale"?:string}. Use readiness to auto-regulate: high -> +10-20% carbs and calories, slight fat down; low -> carbs -10-20% (prefer low-GI), increase water/electrolytes by 250-500ml, keep protein 1.8-2.2 g/kg; medium -> balanced. Respect dietary restrictions. No text outside JSON.'
    };

    const usr = {
      role: 'user',
      content: `Goals: ${finalGoals.join(', ')}. PreferredGoalDefaults: ${userCtx.goals.join(', ')}. ${params.currentWeightKg ? `Weight:${params.currentWeightKg}kg. ` : ''}Activity:${params.activityLevel ?? 'moderate'}. ${finalRestrictions.length > 0 ? `Restrictions:${finalRestrictions.join(', ')}. ` : ''}${recoveryNote}`
    };


    const data = await postLLM([sys, usr], 22000, 1);
    const raw = typeof data.completion === 'string' ? data.completion.trim() : '';
    const parsed = parseJSONSafe(raw);
    if (parsed && Number.isFinite(parsed.calories) && Number.isFinite(parsed.protein) && Number.isFinite(parsed.carbs) && Number.isFinite(parsed.fat)) {
      return {
        calories: Math.max(1000, Math.round(parsed.calories)),
        protein: Math.max(0, Math.round(parsed.protein)),
        carbs: Math.max(0, Math.round(parsed.carbs)),
        fat: Math.max(0, Math.round(parsed.fat)),
        water: Math.max(1500, Math.round(parsed.water ?? 2000)),
        rationale: typeof parsed.rationale === 'string' ? parsed.rationale : undefined,
      };
    }
    throw new Error('Invalid AI targets');
  } catch (e) {
    console.error('AI daily targets failed', e);
    // Sensible fallback derived from goals
    const baseCalories = params.goals.includes('fat loss') ? 1900 : params.goals.includes('muscle gain') ? 2400 : 2100;
    return {
      calories: baseCalories,
      protein: 150,
      carbs: 220,
      fat: 65,
      water: 2200,
      rationale: 'Fallback defaults',
    };
  }
};

export const getAIMacroSplitForPreset = async (params) => {
  try {
    const sys = {
      role: 'system',
      content:
        'Return ONLY minified JSON {"protein":number,"carbs":number,"fat":number,"note"?:string}. Compute grams for the given calories and named preset: balanced, highProtein, lowCarb, keto, carbLoad, recovery. Typical ratios: balanced 30/40/30, highProtein 40/35/25, lowCarb 35/25/40, keto 25/5/70, carbLoad 25/60/15, recovery 30/50/20. No text outside JSON.'
    };
    const usr = {
      role: 'user',
      content: `Preset:${params.preset}. Calories:${params.calories}.`
    };
    const data = await postLLM([sys, usr], 16000, 0);
    const raw = typeof data.completion === 'string' ? data.completion.trim() : '';
    const parsed = parseJSONSafe(raw);
    if (parsed && Number.isFinite(parsed.protein) && Number.isFinite(parsed.carbs) && Number.isFinite(parsed.fat)) {
      return {
        protein: Math.max(0, Math.round(parsed.protein)),
        carbs: Math.max(0, Math.round(parsed.carbs)),
        fat: Math.max(0, Math.round(parsed.fat)),
        note: typeof parsed.note === 'string' ? parsed.note : undefined,
      };
    }
    throw new Error('Invalid macro JSON');
  } catch (e) {
    console.warn('AI macro split failed, using local ratios', e);
    const cal = Math.max(1200, Math.round(params.calories));
    const ratios = {
      balanced: { p: 0.30, c: 0.40, f: 0.30 },
      highProtein: { p: 0.40, c: 0.35, f: 0.25 },
      lowCarb: { p: 0.35, c: 0.25, f: 0.40 },
      keto: { p: 0.25, c: 0.05, f: 0.70 },
      carbLoad: { p: 0.25, c: 0.60, f: 0.15 },
      recovery: { p: 0.30, c: 0.50, f: 0.20 },
    };
    const r = ratios[params.preset];
    return {
      protein: Math.round((cal * r.p) / 4),
      carbs: Math.round((cal * r.c) / 4),
      fat: Math.round((cal * r.f) / 9),
      note: 'Local fallback',
    };
  }
};

export const getAIWorkoutPlan = async (
  fitnessLevel,
  goal,
  duration,
  equipment
) => {
  try {
    const workout = await generateWorkoutPlan({
      fitnessLevel: ['beginner','intermediate','advanced'].includes(fitnessLevel) ? fitnessLevel : 'beginner',
      goals: [goal],
      duration,
      equipment,
    });
    return workout;
  } catch (error) {
    console.error('Error getting AI workout plan', error);
    throw new Error('Failed to generate workout plan. Please try again.');
  }
};

export const getFitnessMetrics = async (_userId) => {
  try {
    return {
      steps: { daily: 8500, weekly: 52000, monthly: 220000 },
      sleep: { duration: 7.5, quality: 'good', deepSleep: 2.3, remSleep: 1.8 },
      activity: { activeMinutes: 45, caloriesBurned: 350, standingHours: 8 },
      heartRate: { resting: 65, average: 72, max: 145 },
    };
  } catch (error) {
    console.error('Error getting fitness metrics', error);
    throw new Error('Failed to retrieve fitness metrics. Please try again.');
  }
};