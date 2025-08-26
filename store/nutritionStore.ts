import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FoodItem, Meal, NutritionInfo } from '@/types';
import { useExpStore } from './expStore';
import { optimizeArrayForPerformance, memoizeWithTTL } from '@/utils/storeOptimizations';

interface NutritionState {
  meals: Meal[];
  waterIntake: { [date: string]: number }; // Track water intake by date
  dailyGoals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    water: number;
  };
  isLoading: boolean;
  recentFoods: FoodItem[]; // Add recentFoods array
  favoriteFood: FoodItem[]; // Add favoriteFood array
  
  // Actions
  addMeal: (meal: Meal) => void;
  updateMeal: (id: string, meal: Partial<Meal>) => void;
  deleteMeal: (id: string) => void;
  addFoodToMeal: (date: string, mealId: string, food: FoodItem) => void;
  removeFoodFromMeal: (mealId: string, foodId: string) => void;
  getMealsByDate: (date: string) => Meal[];
  getDailyNutrition: (date: string) => NutritionInfo;
  updateWaterIntake: (date: string, amount: number) => void;
  getWaterIntake: (date: string) => number;
  updateDailyGoals: (goals: Partial<NutritionState['dailyGoals']>) => void;
  addToFavorites: (food: FoodItem) => void;
  removeFromFavorites: (foodId: string) => void;
}

// Default recent foods for initialization
const defaultRecentFoods: FoodItem[] = [
  {
    id: '1',
    name: 'Chicken Breast',
    servingSize: '100g',
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6
  },
  {
    id: '2',
    name: 'Brown Rice',
    servingSize: '100g cooked',
    calories: 112,
    protein: 2.6,
    carbs: 23,
    fat: 0.9
  }
];

// Default favorite foods for initialization
const defaultFavoriteFoods: FoodItem[] = [
  {
    id: '3',
    name: 'Avocado',
    servingSize: '1 medium',
    calories: 240,
    protein: 3,
    carbs: 12,
    fat: 22
  }
];

export const useNutritionStore = create<NutritionState>()(
  persist(
    (set, get) => ({
      meals: [],
      waterIntake: {},
      dailyGoals: {
        calories: 2000,
        protein: 150,
        carbs: 200,
        fat: 65,
        water: 2000, // 2 liters (2000ml)
      },
      isLoading: false,
      recentFoods: defaultRecentFoods, // Initialize with default foods
      favoriteFood: defaultFavoriteFoods, // Initialize with default foods
      
      addMeal: (meal) => {
        set((state) => ({
          meals: [...state.meals, meal]
        }));
      },
      
      updateMeal: (id, updatedMeal) => {
        set((state) => ({
          meals: state.meals.map(meal => 
            meal.id === id ? { ...meal, ...updatedMeal } : meal
          )
        }));
      },
      
      deleteMeal: (id) => {
        set((state) => ({
          meals: state.meals.filter(meal => meal.id !== id)
        }));
      },
      
      addFoodToMeal: (date, mealId, food) => {
        set((state) => {
          // Add to recent foods list
          const existingFoodIndex = state.recentFoods.findIndex(f => f.id === food.id);
          let updatedRecentFoods = [...state.recentFoods];
          
          if (existingFoodIndex >= 0) {
            // Move to the top if already exists
            updatedRecentFoods = [
              state.recentFoods[existingFoodIndex],
              ...state.recentFoods.filter(f => f.id !== food.id)
            ];
          } else {
            // Add to the beginning, limit to 10 items
            updatedRecentFoods = [food, ...state.recentFoods].slice(0, 10);
          }
          
          // Find the meal to update
          const mealToUpdate = state.meals.find(meal => meal.id === mealId && meal.date === date);
          
          // If meal doesn't exist, create a new one
          if (!mealToUpdate) {
            const newMeal: Meal = {
              id: mealId,
              name: mealId.charAt(0).toUpperCase() + mealId.slice(1), // Capitalize first letter
              foods: [food],
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
            meals: state.meals.map(meal => {
              if (meal.id === mealId && meal.date === date) {
                return {
                  ...meal,
                  foods: [...meal.foods, food]
                };
              }
              return meal;
            }),
            recentFoods: updatedRecentFoods
          };
        });
        
        // Add EXP for logging food - optimized with requestAnimationFrame
        requestAnimationFrame(() => {
          try {
            const addExpActivity = useExpStore.getState().addExpActivity;
            
            // Determine nutritional quality for EXP calculation
            let foodQuality: 'fiveStar' | 'fourStar' | 'threeStar' = 'threeStar';
            const proteinPerCalorie = food.protein / (food.calories || 1);
            
            if (proteinPerCalorie > 0.15 && food.calories < 400) {
              foodQuality = 'fiveStar';
            } else if (proteinPerCalorie > 0.1 || food.calories < 300) {
              foodQuality = 'fourStar';
            }
            
            // Add the meal activity to the EXP system
            addExpActivity({
              id: Date.now().toString(),
              type: 'meal',
              subtype: foodQuality,
              baseExp: foodQuality === 'fiveStar' ? 55 : foodQuality === 'fourStar' ? 44 : 33,
              multiplier: 1.0,
              date: new Date().toISOString().split('T')[0],
              description: `Logged ${food.name}`,
              completed: true
            });
          } catch (error) {
            console.error('Failed to add EXP for meal:', error);
          }
        });
      },
      
      removeFoodFromMeal: (mealId, foodId) => {
        set((state) => ({
          meals: state.meals.map(meal => {
            if (meal.id === mealId) {
              return {
                ...meal,
                foods: meal.foods.filter(food => food.id !== foodId)
              };
            }
            return meal;
          })
        }));
      },
      
      getMealsByDate: (date) => {
        return get().meals.filter(meal => meal.date === date);
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
              sodium: (mealTotal.sodium || 0) + (food.sodium || 0),
            };
          }, {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
            sugar: 0,
            sodium: 0,
          });
          
          return {
            calories: total.calories + mealNutrition.calories,
            protein: total.protein + mealNutrition.protein,
            carbs: total.carbs + mealNutrition.carbs,
            fat: total.fat + mealNutrition.fat,
            fiber: (total.fiber || 0) + (mealNutrition.fiber || 0),
            sugar: (total.sugar || 0) + (mealNutrition.sugar || 0),
            sodium: (total.sodium || 0) + (mealNutrition.sodium || 0),
          };
        }, {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          sugar: 0,
          sodium: 0,
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
      
      addToFavorites: (food) => {
        set((state) => ({
          favoriteFood: [...state.favoriteFood, food]
        }));
      },
      
      removeFromFavorites: (foodId) => {
        set((state) => ({
          favoriteFood: state.favoriteFood.filter(f => f.id !== foodId)
        }));
      },
    }),
    {
      name: 'zown-nutrition-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        meals: state.meals.slice(-30), // Keep only last 30 meals for performance
        waterIntake: Object.fromEntries(
          Object.entries(state.waterIntake).slice(-7) // Keep only last 7 days of water intake
        ),
        dailyGoals: state.dailyGoals,
        recentFoods: state.recentFoods.slice(0, 10), // Limit recent foods
        favoriteFood: state.favoriteFood.slice(0, 20), // Limit favorite foods
      }),
    }
  )
);