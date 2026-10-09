import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useExpStore } from './expStore';
import { useUserStore } from './userStore';
import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { gradeToMealStars } from '@/services/calorieApiService';
import { foodBase, foodKey, newLogId, appendToMeals } from '@/lib/foodLog';
import { buildCustomFood, MAX_CUSTOM_FOODS } from '@/lib/customFood';
import { copyFoodEntries } from '@/lib/mealCopy';
import { keepRecentMeals } from '@/lib/nutritionHistory';
import { localDateKey } from '@/lib/localDate';

// XP for logging a food: once per food name per day (expStore.awardMealXp),
// graded by the food's nutritional score or, without one, how much of its
// nutrition is filled in. A quick add has no real food behind it, so it earns
// nothing.
function awardFoodXp(food) {
  try {
    const hasCalories = food.calories != null && food.calories > 0;
    if (!hasCalories || food.quickAdd) return;
    let stars;
    if (food.nutritionalScore?.score) {
      stars = gradeToMealStars(food.nutritionalScore.score);
    } else {
      const macroCount = [food.protein, food.carbs, food.fat].filter((v) => v != null && v > 0).length;
      stars = macroCount >= 3 ? 5 : macroCount >= 1 ? 4 : 3;
    }
    const baseExp = stars === 5 ? 55 : stars === 4 ? 44 : 33;
    const xpKey = (food.name || '').trim().toLowerCase();
    useExpStore.getState().awardMealXp(xpKey, {
      id: Date.now().toString(),
      type: 'meal',
      baseExp,
      multiplier: 1.0,
      date: new Date().toISOString().split('T')[0],
      description: `Logged ${food.name} (${stars}-star)`,
      completed: true
    }, useUserStore.getState().user?.uid);
  } catch (error) {
    console.error('Failed to add EXP for meal:', error);
  }
}

export const useNutritionStore = create(
  persist(
    (set, get) => ({
      meals: [],
      waterIntake: {},
      dailyGoals: {
        calories: 2000,
        protein: 150,
        carbs: 200,
        fat: 65,
        water: 2000 // 2 liters (2000ml)
      },
      // Real timestamp for the AI-personalized target below, not the
      // fallback default above - lets the client tell "never calculated
      // yet" apart from "calculated a while ago, worth refreshing"
      // without guessing.
      dailyGoalsUpdatedAt: null,
      nutritionSummary: null,
      isLoading: false,
      // Was seeded with fake "Chicken Breast" / "Brown Rice" / "Avocado"
      // entries for every user, regardless of what they'd actually logged.
      // Real entries accumulate here as the user actually logs meals (see
      // addMeal/addFoodToMeal below), starting genuinely empty.
      recentFoods: [],
      favoriteFood: [],
      // Foods the person made up themselves ("My Foods"), see lib/customFood.js.
      customFoods: [],
      syncUid: null, // set once via setSyncUid(uid) — drives the auto-sync subscription below
      setSyncUid: (uid) => set({ syncUid: uid }),

      loadNutritionData: async (uid) => {
        if (!uid) return;
        set({ isLoading: true });
        try {
          const snap = await getDoc(doc(db, 'users', uid, 'data', 'nutrition'));
          if (snap.exists()) {
            const data = snap.data();
            set({
              meals: data.meals || [],
              waterIntake: data.waterIntake || {},
              dailyGoals: data.dailyGoals || get().dailyGoals,
              dailyGoalsUpdatedAt: data.dailyGoalsUpdatedAt || null,
              nutritionSummary: data.nutritionSummary || null,
              recentFoods: data.recentFoods || [],
              favoriteFood: data.favoriteFood || [],
              // A cloud copy saved before custom foods existed has no list: keep the phone's.
              customFoods: Array.isArray(data.customFoods) ? data.customFoods : get().customFoods,
            });
          }
        } catch (e) {
          console.warn('[nutritionStore] loadNutritionData error:', e?.message);
        } finally {
          set({ isLoading: false });
        }
      },

      _syncToFirestore: async (uid) => {
        if (!uid) return;
        const s = get();
        try {
          // Firestore refuses a document with `undefined` anywhere in it, and a
          // logged food can carry some (no brand, no fiber), so the copy that is
          // sent has those left out.
          const payload = JSON.parse(JSON.stringify({
            meals: s.meals,
            waterIntake: s.waterIntake,
            dailyGoals: s.dailyGoals,
            dailyGoalsUpdatedAt: s.dailyGoalsUpdatedAt,
            nutritionSummary: s.nutritionSummary,
            recentFoods: s.recentFoods,
            favoriteFood: s.favoriteFood,
            customFoods: s.customFoods,
          }));
          await setDoc(doc(db, 'users', uid, 'data', 'nutrition'), {
            ...payload,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (e) {
          console.warn('[nutritionStore] sync error:', e?.message);
        }
      },

      addMeal: (meal) => {
        set((state) => ({
          meals: [...state.meals, meal]
        }));
      },

      updateMeal: (id, updatedMeal) => {
        set((state) => ({
          meals: state.meals.map((meal) =>
          meal.id === id ? { ...meal, ...updatedMeal } : meal
          )
        }));
      },

      deleteMeal: (id) => {
        set((state) => ({
          meals: state.meals.filter((meal) => meal.id !== id)
        }));
      },

      addFoodToMeal: (date, mealId, food) => {
        // Each log gets its own id (the same food can be logged many times), and
        // keeps the values for ONE serving so the entry can be changed later.
        const logged = {
          ...food,
          logId: newLogId(food),
          base: foodBase(food),
          quantity: food.quantity > 0 ? food.quantity : 1
        };
        set((state) => {
          // Add to recent foods list (a quick add is not a food worth coming back to)
          const existingFoodIndex = state.recentFoods.findIndex((f) => f.id === food.id);
          let updatedRecentFoods = [...state.recentFoods];

          if (food.quickAdd) {
            // leave the recent list as it is
          } else if (existingFoodIndex >= 0) {
            // Move to the top if already exists
            updatedRecentFoods = [
            state.recentFoods[existingFoodIndex],
            ...state.recentFoods.filter((f) => f.id !== food.id)];

          } else {
            // Add to the beginning, limit to 10 items
            updatedRecentFoods = [food, ...state.recentFoods].slice(0, 10);
          }

          // Find the meal to update
          const mealToUpdate = state.meals.find((meal) => meal.id === mealId && meal.date === date);

          // If meal doesn't exist, create a new one
          if (!mealToUpdate) {
            const newMeal = {
              id: mealId,
              name: mealId.charAt(0).toUpperCase() + mealId.slice(1), // Capitalize first letter
              foods: [logged],
              time: new Date().toTimeString().split(' ')[0],
              date: date
            };

            return {
              meals: [...state.meals, newMeal],
              recentFoods: updatedRecentFoods
            };
          }

          // Otherwise update existing meal
          return {
            meals: state.meals.map((meal) => {
              if (meal.id === mealId && meal.date === date) {
                return {
                  ...meal,
                  foods: [...meal.foods, logged]
                };
              }
              return meal;
            }),
            recentFoods: updatedRecentFoods
          };
        });

        // Real XP award for logging food (see awardFoodXp above): synchronous, once
        // per food name per day, graded by the food's real nutrition data.
        awardFoodXp(food);
      },

      // Removes ONE logged entry. `key` is the entry's log id (or, for entries
      // saved before log ids existed, its food id) and `date` the day it was
      // logged on. Meal slots like 'breakfast' repeat on every day, so without
      // the date a food logged on several days would be wiped from all of them.
      removeFoodFromMeal: (mealId, key, date) => {
        set((state) => {
          let done = false;
          return {
            meals: state.meals.map((meal) => {
              if (done || meal.id !== mealId || (date && meal.date !== date)) return meal;
              const idx = (meal.foods || []).findIndex((f) => foodKey(f) === key);
              if (idx < 0) return meal;
              done = true;
              return { ...meal, foods: meal.foods.filter((_, i) => i !== idx) };
            })
          };
        });
      },

      // Changes ONE logged entry (for example its serving count and the numbers that follow from it).
      updateFoodInMeal: (mealId, key, changes, date) => {
        set((state) => {
          let done = false;
          return {
            meals: state.meals.map((meal) => {
              if (done || meal.id !== mealId || (date && meal.date !== date)) return meal;
              const idx = (meal.foods || []).findIndex((f) => foodKey(f) === key);
              if (idx < 0) return meal;
              done = true;
              return { ...meal, foods: meal.foods.map((f, i) => (i === idx ? { ...f, ...changes } : f)) };
            })
          };
        });
      },

      // The logged entry (and the meal it sits in) for a log id or old food id, or null.
      findLoggedFood: (key) => {
        if (!key) return null;
        const meals = get().meals || [];
        for (let i = meals.length - 1; i >= 0; i--) {
          const food = (meals[i].foods || []).find((f) => foodKey(f) === key);
          if (food) return { meal: meals[i], food };
        }
        return null;
      },

      getMealsByDate: (date) => {
        return get().meals.filter((meal) => meal.date === date);
      },

      getDailyNutrition: (date) => {
        const meals = get().getMealsByDate(date);

        // Calculate total nutrition for the day
        return meals.reduce((total, meal) => {
          const mealNutrition = meal.foods.reduce((mealTotal, food) => {
            return {
              calories: mealTotal.calories + food.calories,
              protein: mealTotal.protein + food.protein,
              carbs: mealTotal.carbs + food.carbs,
              fat: mealTotal.fat + food.fat,
              fiber: (mealTotal.fiber || 0) + (food.fiber || 0),
              sugar: (mealTotal.sugar || 0) + (food.sugar || 0),
              sodium: (mealTotal.sodium || 0) + (food.sodium || 0)
            };
          }, {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
            sugar: 0,
            sodium: 0
          });

          return {
            calories: total.calories + mealNutrition.calories,
            protein: total.protein + mealNutrition.protein,
            carbs: total.carbs + mealNutrition.carbs,
            fat: total.fat + mealNutrition.fat,
            fiber: (total.fiber || 0) + (mealNutrition.fiber || 0),
            sugar: (total.sugar || 0) + (mealNutrition.sugar || 0),
            sodium: (total.sodium || 0) + (mealNutrition.sodium || 0)
          };
        }, {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          sugar: 0,
          sodium: 0
        });
      },

      updateWaterIntake: (date, amount) => {
        // Fix: Check if we're trying to update with the same value to prevent infinite loops
        const currentAmount = get().waterIntake[date] || 0;
        if (currentAmount === amount) return;

        set((state) => ({
          waterIntake: {
            ...state.waterIntake,
            [date]: amount
          }
        }));
      },

      getWaterIntake: (date) => {
        return get().waterIntake[date] || 0;
      },

      updateDailyGoals: (goals) => {
        set((state) => ({
          dailyGoals: {
            ...state.dailyGoals,
            ...goals
          }
        }));
      },

      // Real AI-personalized calorie/macro target, calling the Cloud
      // Function proxy (functions/src/index.js's
      // getNutritionRecommendations) rather than the flat 2000/150/200/65
      // default every user previously got regardless of their actual
      // body metrics or goals. Takes the real profile/workout data as
      // arguments rather than reaching into other stores itself, so this
      // store doesn't need to know about userStore/workoutStore's shapes.
      refreshDailyGoals: async ({ recentWorkouts, goals, profile } = {}) => {
        try {
          const { httpsCallable } = await import('firebase/functions');
          const { functions } = await import('../src/config/firebase');
          const fn = httpsCallable(functions, 'getNutritionRecommendations');
          const result = await fn({ recentWorkouts: recentWorkouts || [], goals: goals || [], profile: profile || {} });
          const rec = result.data?.recommendations;
          if (rec?.dailyMacros) {
            set((state) => ({
              dailyGoals: {
                ...state.dailyGoals,
                calories: rec.dailyMacros.calories || state.dailyGoals.calories,
                protein: rec.dailyMacros.protein || state.dailyGoals.protein,
                carbs: rec.dailyMacros.carbs || state.dailyGoals.carbs,
                fat: rec.dailyMacros.fat || state.dailyGoals.fat,
              },
              dailyGoalsUpdatedAt: new Date().toISOString(),
              nutritionSummary: rec.summary || null,
            }));
            return true;
          }
          return false;
        } catch (e) {
          console.warn('[nutritionStore] refreshDailyGoals error:', e?.message);
          return false;
        }
      },

      // Real staleness check - 14 days is a reasonable interval for a
      // target to meaningfully drift as weight/activity actually change,
      // without recalculating (and spending an OpenAI call) on every
      // single screen visit.
      shouldRefreshDailyGoals: () => {
        const updatedAt = get().dailyGoalsUpdatedAt;
        if (!updatedAt) return true;
        const daysSince = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
        return daysSince >= 14;
      },

      addToFavorites: (food) => {
        set((state) => ({
          favoriteFood: [...state.favoriteFood, food]
        }));
      },

      removeFromFavorites: (foodId) => {
        set((state) => ({
          favoriteFood: state.favoriteFood.filter((f) => f.id !== foodId)
        }));
      },

      // ── My Foods (custom foods) ──
      // Each returns { ok: true, food } or { ok: false, errors } so the form can
      // show what is wrong. Foods already logged keep their own numbers, so
      // changing or deleting a custom food never rewrites the diary.
      addCustomFood: (fields) => {
        if ((get().customFoods || []).length >= MAX_CUSTOM_FOODS) {
          return { ok: false, errors: { name: `You have ${MAX_CUSTOM_FOODS} custom foods. Delete one to add another.` } };
        }
        const result = buildCustomFood(fields);
        if (!result.ok) return result;
        set((state) => ({ customFoods: [result.food, ...(state.customFoods || [])] }));
        return result;
      },

      updateCustomFood: (id, fields) => {
        if (!(get().customFoods || []).some((f) => f.id === id)) {
          return { ok: false, errors: { name: 'This food no longer exists.' } };
        }
        const result = buildCustomFood(fields, { id });
        if (!result.ok) return result;
        set((state) => ({
          customFoods: state.customFoods.map((f) => (f.id === id ? result.food : f))
        }));
        return result;
      },

      removeCustomFood: (id) => {
        set((state) => ({ customFoods: (state.customFoods || []).filter((f) => f.id !== id) }));
      },

      // Copies the foods of one meal slot on one day into another slot (on the
      // same or another day) as new entries, in one update. Returns how many
      // were copied. XP is only given when copying into today, and only the
      // usual once per food per day; the recent-foods list is left alone.
      copyMealFoods: ({ fromDate, fromMealId, toDate, toMealId }) => {
        const source = get().meals.find((m) => m.date === fromDate && m.id === fromMealId);
        const entries = copyFoodEntries(source?.foods || []);
        if (!entries.length) return 0;
        set((state) => ({
          meals: appendToMeals(state.meals, toDate, toMealId, entries, new Date().toTimeString().split(' ')[0])
        }));
        if (toDate === localDateKey()) entries.forEach(awardFoodXp);
        return entries.length;
      }
    }),
    {
      name: 'zown-nutrition-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        meals: keepRecentMeals(state.meals), // the last 30 days (at most 250 slots); the cloud copy keeps everything
        waterIntake: Object.fromEntries(
          Object.entries(state.waterIntake).slice(-7) // Keep only last 7 days of water intake
        ),
        dailyGoals: state.dailyGoals,
        dailyGoalsUpdatedAt: state.dailyGoalsUpdatedAt,
        nutritionSummary: state.nutritionSummary,
        recentFoods: state.recentFoods.slice(0, 10), // Limit recent foods
        favoriteFood: state.favoriteFood.slice(0, 20), // Limit favorite foods
        customFoods: (state.customFoods || []).slice(0, MAX_CUSTOM_FOODS)
      })
    }
  )
);

// Auto-sync to Firestore whenever the synced fields actually change, rather
// than threading a `uid` parameter through every one of the ten-plus
// mutation functions above (addMeal, addFoodToMeal, updateWaterIntake,
// addToFavorites, ...). Call useNutritionStore.getState().setSyncUid(uid)
// once (e.g. on auth state resolving) and every subsequent meal/water/
// favorite change syncs automatically.
let lastSyncedSnapshot = null;
useNutritionStore.subscribe((state) => {
  if (!state.syncUid) return;
  const snapshot = JSON.stringify({
    meals: state.meals, waterIntake: state.waterIntake, dailyGoals: state.dailyGoals,
    recentFoods: state.recentFoods, favoriteFood: state.favoriteFood,
    customFoods: state.customFoods,
  });
  if (snapshot === lastSyncedSnapshot) return;
  lastSyncedSnapshot = snapshot;
  state._syncToFirestore(state.syncUid);
});
