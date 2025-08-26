import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Plus, Search, ChevronRight, Utensils, Coffee, Apple, Egg, Camera, ScanLine, Flame } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import BottomNavigation from '@/components/BottomNavigation';
import NutritionSummary from '@/components/NutritionSummary';
import { useNutritionStore } from '@/store/nutritionStore';
import HydrationTracker from '@/components/HydrationTracker';
import { getAIDailyTargets, getAIMacroSplitForPreset } from '@/services/aiService';

const { width } = Dimensions.get('window');

export default function NutritionScreen() {
  const { addMeal, getMealsByDate, getWaterIntake, updateWaterIntake, dailyGoals, updateDailyGoals } = useNutritionStore();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [waterAmount, setWaterAmount] = useState(0);
  const [currentRecipeIndex, setCurrentRecipeIndex] = useState(0);
  const [preset, setPreset] = useState<'balanced' | 'highProtein' | 'lowCarb' | 'keto' | 'carbLoad' | 'recovery'>('balanced');
  const [targetPreset, setTargetPreset] = useState<'fatLoss' | 'maintenance' | 'muscleGain' | 'enduranceDay' | 'recoveryDay' | 'custom'>('maintenance');
  const [aiLoadingTargets, setAiLoadingTargets] = useState<boolean>(false);
  const [aiLoadingMacros, setAiLoadingMacros] = useState<boolean>(false);
  const [aiNote, setAiNote] = useState<string | undefined>(undefined);

  // Mock recipes data for carousel
  const recipes = [
    {
      id: '1',
      title: 'Healthy Breakfast Bowl',
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
      calories: 320,
      prepTime: 15,
    },
    {
      id: '2',
      title: 'Vegetable Stir Fry',
      image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500',
      calories: 420,
      prepTime: 25,
    },
    {
      id: '3',
      title: 'Grilled Salmon Salad',
      image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=500',
      calories: 380,
      prepTime: 20,
    },
    {
      id: '4',
      title: 'Quinoa Power Bowl',
      image: 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=500',
      calories: 450,
      prepTime: 30,
    },
  ];
  
  // Get today's meals
  const todayMeals = getMealsByDate(selectedDate.toISOString().split('T')[0]);
  
  // Load water intake
  useEffect(() => {
    const dateString = selectedDate.toISOString().split('T')[0];
    const intake = getWaterIntake(dateString);
    setWaterAmount(intake || 0);
  }, [selectedDate, getWaterIntake]);

  // On first mount, fetch AI daily targets based on default targetPreset
  useEffect(() => {
    const run = async () => {
      try {
        setAiLoadingTargets(true);
        setAiNote(undefined);
        const goalsMap: Record<typeof targetPreset, string[]> = {
          fatLoss: ['fat loss'],
          maintenance: ['maintenance'],
          muscleGain: ['muscle gain'],
          enduranceDay: ['endurance', 'training day'],
          recoveryDay: ['recovery', 'rest day'],
          custom: ['balanced']
        };
        const result = await getAIDailyTargets({
          goals: goalsMap[targetPreset],
          activityLevel: targetPreset === 'enduranceDay' ? 'high' : targetPreset === 'recoveryDay' ? 'low' : 'moderate',
          dietaryRestrictions: [],
        });
        updateDailyGoals({
          calories: result.calories,
          protein: result.protein,
          carbs: result.carbs,
          fat: result.fat,
          water: result.water,
        });
        setAiNote(result.rationale);
        setWaterAmount(result.water);
      } catch (e) {
        console.error('[Nutrition] AI targets init failed', e);
      } finally {
        setAiLoadingTargets(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Auto-scroll recipes carousel with performance optimization
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentRecipeIndex((prevIndex) => (prevIndex + 1) % recipes.length);
    }, 5000); // Increased interval to reduce CPU usage
    
    return () => clearInterval(interval);
  }, [recipes.length]);
  
  // Handle water intake updates - using useCallback to prevent recreation on each render
  const handleWaterUpdate = useCallback((amount: number) => {
    const dateString = selectedDate.toISOString().split('T')[0];
    setWaterAmount(amount);
    updateWaterIntake(dateString, amount);
  }, [selectedDate, updateWaterIntake]);
  
  // Handle recipe scroll
  const handleRecipeScroll = useCallback((event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / (width * 0.8));
    setCurrentRecipeIndex(index);
  }, []);
  
  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };
  
  // Navigate to previous day
  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };
  
  // Navigate to next day
  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };
  
  // Check if selected date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };
  
  // Meal type icons
  const getMealIcon = (mealType: string) => {
    switch (mealType.toLowerCase()) {
      case 'breakfast':
        return <Coffee size={20} color={Colors.warning} />;
      case 'lunch':
        return <Utensils size={20} color={Colors.primary} />;
      case 'dinner':
        return <Utensils size={20} color={Colors.secondary} />;
      case 'snack':
        return <Apple size={20} color={Colors.success} />;
      default:
        return <Egg size={20} color={Colors.text.secondary} />;
    }
  };
  
  return (
    <View style={styles.container}>
      {/* Date Navigation */}
      <View style={styles.dateNavigation}>
        <TouchableOpacity onPress={goToPreviousDay} style={styles.dateButton}>
          <Text style={styles.dateButtonText}>←</Text>
        </TouchableOpacity>
        
        <Text style={styles.dateText}>
          {isToday(selectedDate) ? 'Today' : formatDate(selectedDate)}
        </Text>
        
        <TouchableOpacity 
          onPress={goToNextDay} 
          style={[
            styles.dateButton,
            isToday(selectedDate) && styles.disabledDateButton
          ]}
          disabled={isToday(selectedDate)}
        >
          <Text 
            style={[
              styles.dateButtonText,
              isToday(selectedDate) && styles.disabledDateButtonText
            ]}
          >
            →
          </Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
      >
        {/* Target Presets */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Daily Targets</Text>
        </View>
        <View style={styles.targetToggles} testID="targetToggles">
          {(
            [
              { key: 'fatLoss', label: 'Fat Loss', cal: 1800, water: 2500 },
              { key: 'maintenance', label: 'Maintain', cal: 2000, water: 2200 },
              { key: 'muscleGain', label: 'Muscle', cal: 2400, water: 2400 },
              { key: 'enduranceDay', label: 'Endurance', cal: 2600, water: 2800 },
              { key: 'recoveryDay', label: 'Recovery', cal: 2000, water: 2600 },
            ] as const
          ).map(({ key, label, cal, water }) => {
            const isActive = targetPreset === (key as typeof targetPreset);
            return (
              <TouchableOpacity
                key={key}
                testID={`targetPreset-${key}`}
                style={[styles.macroButton, isActive && styles.macroButtonActive]}
                disabled={aiLoadingTargets}
                onPress={async () => {
                  try {
                    console.log('[TargetPreset] pressed', key, cal, water);
                    setTargetPreset(key as typeof targetPreset);
                    setAiLoadingTargets(true);
                    setAiNote(undefined);
                    const goalsMap: Record<typeof targetPreset, string[]> = {
                      fatLoss: ['fat loss'],
                      maintenance: ['maintenance'],
                      muscleGain: ['muscle gain'],
                      enduranceDay: ['endurance', 'training day'],
                      recoveryDay: ['recovery', 'rest day'],
                      custom: ['balanced']
                    };
                    const result = await getAIDailyTargets({
                      goals: goalsMap[key as typeof targetPreset],
                      activityLevel: key === 'enduranceDay' ? 'high' : key === 'recoveryDay' ? 'low' : 'moderate',
                      dietaryRestrictions: [],
                    });
                    updateDailyGoals({
                      calories: result.calories,
                      protein: result.protein,
                      carbs: result.carbs,
                      fat: result.fat,
                      water: result.water,
                    });
                    setWaterAmount(result.water);
                    setAiNote(result.rationale);
                  } catch (e) {
                    console.error('Failed to set target preset via AI, falling back', e);
                    const newGoals = { calories: cal, water };
                    updateDailyGoals(newGoals);
                  } finally {
                    setAiLoadingTargets(false);
                  }
                }}
              >
                {aiLoadingTargets && isActive ? (
                  <ActivityIndicator size="small" color={Colors.text.inverse} />
                ) : (
                  <Flame size={14} color={isActive ? Colors.text.inverse : Colors.primary} />
                )}
                <Text style={[styles.macroButtonText, isActive && styles.macroButtonTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Nutrition Summary */}
        <NutritionSummary date={selectedDate.toISOString().split('T')[0]} />

        {/* Quick Macro Tweaks */}
        <View style={styles.macroToggles} testID="macroToggles">
          {(
            [
              { key: 'balanced', label: 'Balanced', icon: <Apple size={14} color={Colors.primary} /> },
              { key: 'highProtein', label: 'High P', icon: <Egg size={14} color={Colors.success} /> },
              { key: 'lowCarb', label: 'Low C', icon: <Utensils size={14} color={Colors.warning} /> },
              { key: 'keto', label: 'Keto', icon: <Flame size={14} color={Colors.secondary} /> },
              { key: 'carbLoad', label: 'Carb+', icon: <Flame size={14} color={Colors.primary} /> },
              { key: 'recovery', label: 'Recovery', icon: <Apple size={14} color={Colors.success} /> },
            ] as const
          ).map(({ key, label, icon }) => {
            const isActive = preset === (key as typeof preset);
            return (
              <TouchableOpacity
                key={key}
                testID={`macroPreset-${key}`}
                style={[styles.macroButton, isActive && styles.macroButtonActive]}
                disabled={aiLoadingMacros}
                onPress={async () => {
                  try {
                    console.log('[MacroPreset] pressed', key);
                    setPreset(key as typeof preset);
                    setAiLoadingMacros(true);
                    setAiNote(undefined);
                    const cal = dailyGoals?.calories ?? 2000;
                    const result = await getAIMacroSplitForPreset({ preset: key as any, calories: cal });
                    updateDailyGoals({ protein: result.protein, carbs: result.carbs, fat: result.fat });
                    setAiNote(result.note);
                  } catch (e) {
                    console.error('Failed to set macro preset via AI, fallback to local', e);
                    const cal = dailyGoals?.calories ?? 2000;
                    const ratios = {
                      balanced: { p: 0.30, c: 0.40, f: 0.30 },
                      highProtein: { p: 0.40, c: 0.35, f: 0.25 },
                      lowCarb: { p: 0.35, c: 0.25, f: 0.40 },
                      keto: { p: 0.25, c: 0.05, f: 0.70 },
                      carbLoad: { p: 0.25, c: 0.60, f: 0.15 },
                      recovery: { p: 0.30, c: 0.50, f: 0.20 },
                    } as const;
                    const r = ratios[key as keyof typeof ratios];
                    updateDailyGoals({
                      protein: Math.round((cal * r.p) / 4),
                      carbs: Math.round((cal * r.c) / 4),
                      fat: Math.round((cal * r.f) / 9),
                    });
                  } finally {
                    setAiLoadingMacros(false);
                  }
                }}
              >
                {aiLoadingMacros && isActive ? (
                  <ActivityIndicator size="small" color={isActive ? Colors.text.inverse : Colors.primary} />
                ) : (
                  React.cloneElement(icon, {
                    size: 14,
                    color: isActive
                      ? Colors.text.inverse
                      : ((icon as React.ReactElement<any>).props?.color ?? Colors.primary),
                  })
                )}
                <Text style={[styles.macroButtonText, isActive && styles.macroButtonTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        
        {/* AI note / rationale */}
        {aiNote ? (
          <Text style={styles.aiNote} numberOfLines={3} testID="aiRationale">{aiNote}</Text>
        ) : null}

        {/* Hydration Tracker */}
        <HydrationTracker 
          onUpdate={handleWaterUpdate} 
          initialAmount={waterAmount}
        />
        
        {/* Meals Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Meals</Text>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push('/nutrition/search')}
          >
            <Plus size={16} color={Colors.text.inverse} />
            <Text style={styles.addButtonText}>Add Food</Text>
          </TouchableOpacity>
        </View>
        
        {/* Meal Cards */}
        {todayMeals.length > 0 ? (
          todayMeals.map((meal) => (
            <Card key={meal.id} variant="elevated" style={styles.mealCard}>
              <View style={styles.mealHeader}>
                <View style={styles.mealTitleContainer}>
                  {getMealIcon(meal.name)}
                  <Text style={styles.mealTitle}>{meal.name}</Text>
                </View>
                <Text style={styles.mealTime}>{meal.time}</Text>
              </View>
              
              <View style={styles.mealDivider} />
              
              {meal.foods.map((food: any) => (
                <TouchableOpacity 
                  key={food.id}
                  style={styles.foodItem}
                  onPress={() => router.push(`/nutrition/food/${food.id}`)}
                >
                  {food.imageUrl ? (
                    <Image 
                      source={{ uri: food.imageUrl }} 
                      style={styles.foodImage}
                    />
                  ) : (
                    <View style={styles.foodImagePlaceholder}>
                      <Utensils size={16} color={Colors.text.tertiary} />
                    </View>
                  )}
                  
                  <View style={styles.foodInfo}>
                    <Text style={styles.foodName}>{food.name}</Text>
                    <Text style={styles.foodServing}>{food.servingSize}</Text>
                  </View>
                  
                  <View style={styles.foodNutrition}>
                    <Text style={styles.caloriesText}>{food.calories} cal</Text>
                    <View style={styles.macrosContainer}>
                      <Text style={styles.macroText}>P: {food.protein}g</Text>
                      <Text style={styles.macroText}>C: {food.carbs}g</Text>
                      <Text style={styles.macroText}>F: {food.fat}g</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
              
              <TouchableOpacity 
                style={styles.addFoodButton}
                onPress={() => router.push({
                  pathname: '/nutrition/search',
                  params: { mealId: meal.id }
                })}
              >
                <Plus size={16} color={Colors.primary} />
                <Text style={styles.addFoodText}>Add Food to {meal.name}</Text>
              </TouchableOpacity>
            </Card>
          ))
        ) : (
          <Card variant="outlined" style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No meals recorded for this day. Add your first meal to start tracking your nutrition.
            </Text>
            <TouchableOpacity 
              style={styles.addMealButton}
              onPress={() => router.push('/nutrition/search')}
            >
              <Plus size={16} color={Colors.text.inverse} />
              <Text style={styles.addMealButtonText}>Add First Meal</Text>
            </TouchableOpacity>
          </Card>
        )}
        
        {/* Quick Add Meal Buttons */}
        <View style={styles.quickAddContainer}>
          <TouchableOpacity 
            style={styles.quickAddButton}
            onPress={() => {
              const newMeal = {
                id: Date.now().toString(),
                name: 'Breakfast',
                foods: [],
                time: '08:00',
                date: selectedDate.toISOString().split('T')[0]
              };
              addMeal(newMeal);
            }}
          >
            <Coffee size={20} color={Colors.warning} />
            <Text style={styles.quickAddText}>Breakfast</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickAddButton}
            onPress={() => {
              const newMeal = {
                id: Date.now().toString(),
                name: 'Lunch',
                foods: [],
                time: '13:00',
                date: selectedDate.toISOString().split('T')[0]
              };
              addMeal(newMeal);
            }}
          >
            <Utensils size={20} color={Colors.primary} />
            <Text style={styles.quickAddText}>Lunch</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickAddButton}
            onPress={() => {
              const newMeal = {
                id: Date.now().toString(),
                name: 'Dinner',
                foods: [],
                time: '19:00',
                date: selectedDate.toISOString().split('T')[0]
              };
              addMeal(newMeal);
            }}
          >
            <Utensils size={20} color={Colors.secondary} />
            <Text style={styles.quickAddText}>Dinner</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickAddButton}
            onPress={() => {
              const newMeal = {
                id: Date.now().toString(),
                name: 'Snack',
                foods: [],
                time: '16:00',
                date: selectedDate.toISOString().split('T')[0]
              };
              addMeal(newMeal);
            }}
          >
            <Apple size={20} color={Colors.success} />
            <Text style={styles.quickAddText}>Snack</Text>
          </TouchableOpacity>
        </View>
        
        {/* Recipes Carousel Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recommended Recipes</Text>
          <TouchableOpacity 
            style={styles.seeAllButton}
            onPress={() => router.push('/recipes')}
          >
            <Text style={styles.seeAllText}>See All</Text>
            <ChevronRight size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.carouselContainer}>
          <ScrollView 
            horizontal 
            pagingEnabled
            snapToInterval={width * 0.8 + 16}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recipesContainer}
            onMomentumScrollEnd={handleRecipeScroll}
            removeClippedSubviews={true}
          >
            {recipes.map((recipe, index) => (
              <TouchableOpacity 
                key={recipe.id}
                style={styles.recipeCard}
                onPress={() => router.push(`/recipe/${recipe.id}`)}
              >
                <Image 
                  source={{ uri: recipe.image }} 
                  style={styles.recipeImage}
                />
                <View style={styles.recipeInfo}>
                  <Text style={styles.recipeTitle}>{recipe.title}</Text>
                  <View style={styles.recipeDetails}>
                    <Text style={styles.recipeCalories}>{recipe.calories} cal</Text>
                    <Text style={styles.recipePrepTime}>{recipe.prepTime} min</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {/* Carousel Indicators */}
          <View style={styles.indicatorsContainer}>
            {recipes.map((_, index) => (
              <View 
                key={index} 
                style={[
                  styles.indicator, 
                  currentRecipeIndex === index && styles.activeIndicator
                ]} 
              />
            ))}
          </View>
        </View>
        
        {/* Extra space for bottom navigation */}
        <View style={{ height: 80 }} />
      </ScrollView>
      
      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.scanButton}
          onPress={() => router.push('/nutrition/scan')}
        >
          <Camera size={24} color={Colors.text.inverse} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.barcodeButton}
          onPress={() => router.push('/nutrition/barcode-scan')}
        >
          <ScanLine size={24} color={Colors.text.inverse} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.searchButton}
          onPress={() => router.push('/nutrition/search')}
        >
          <Search size={24} color={Colors.text.inverse} />
        </TouchableOpacity>
      </View>
      
      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  dateNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dateButton: {
    width: 40,
    height: 40,
    borderRadius: Colors.radius.xlarge,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
  },
  disabledDateButton: {
    backgroundColor: Colors.inactive,
  },
  disabledDateButtonText: {
    color: Colors.text.tertiary,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text.primary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Colors.spacing.md,
    paddingVertical: Colors.spacing.xs + 2,
    borderRadius: Colors.radius.large,
  },
  addButtonText: {
    color: Colors.text.inverse,
    fontWeight: '600' as const,
    marginLeft: 4,
  },
  mealCard: {
    marginBottom: 16,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  mealTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginLeft: 8,
  },
  mealTime: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  mealDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  foodImage: {
    width: 40,
    height: 40,
    borderRadius: Colors.radius.small,
  },
  foodImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: Colors.radius.small,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  foodInfo: {
    flex: 1,
    marginLeft: 12,
  },
  foodName: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  foodServing: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  foodNutrition: {
    alignItems: 'flex-end',
  },
  caloriesText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  macrosContainer: {
    flexDirection: 'row',
  },
  macroText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginLeft: 8,
  },
  addFoodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  addFoodText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500' as const,
    marginLeft: 4,
  },
  emptyCard: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  addMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Colors.spacing.lg,
    paddingVertical: Colors.spacing.sm,
    borderRadius: Colors.radius.medium,
  },
  addMealButtonText: {
    color: Colors.text.inverse,
    fontWeight: '600' as const,
    marginLeft: 4,
  },
  quickAddContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quickAddButton: {
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingVertical: Colors.spacing.md,
    paddingHorizontal: Colors.spacing.sm,
    borderRadius: Colors.radius.medium,
    width: '23%',
  },
  quickAddText: {
    fontSize: 12,
    color: Colors.text.primary,
    marginTop: 4,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: 14,
    color: Colors.primary,
    marginRight: 4,
  },
  carouselContainer: {
    marginBottom: 16,
  },
  recipesContainer: {
    paddingLeft: 16,
    paddingRight: 16,
  },
  recipeCard: {
    width: width * 0.8,
    marginRight: 16,
    borderRadius: Colors.radius.medium,
    overflow: 'hidden',
    backgroundColor: Colors.card,
  },
  recipeImage: {
    width: '100%',
    height: 120,
  },
  recipeInfo: {
    padding: 12,
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginBottom: 8,
  },
  recipeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recipeCalories: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  recipePrepTime: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  indicatorsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.inactive,
    marginHorizontal: 4,
  },
  activeIndicator: {
    backgroundColor: Colors.primary,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  targetToggles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  macroToggles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  macroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: Colors.radius.large,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  macroButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  macroButtonText: {
    marginLeft: 6,
    fontSize: 12,
    color: Colors.text.primary,
    fontWeight: '600' as const,
  },
  macroButtonTextActive: {
    color: Colors.text.inverse,
  },
  aiNote: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 12,
  },
  actionButtons: {
    position: 'absolute',
    right: Colors.spacing.lg,
    bottom: 120,
    flexDirection: 'column',
    gap: 12,
  },
  scanButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    ...Colors.shadow.large,
  },
  barcodeButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.warning,
    justifyContent: 'center',
    alignItems: 'center',
    ...Colors.shadow.large,
  },
  searchButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Colors.shadow.large,
  },
});