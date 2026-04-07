import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Heart, Plus, Minus, Award } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import Card from '@/components/Card';
import ProgressBar from '@/components/ProgressBar';
import { useNutritionStore } from '@/store/nutritionStore';
import { getFoodById } from '@/services/passioService';
import { FoodItem } from '@/types';

interface NutritionStore {
  favoriteFood: FoodItem[];
  addToFavorites: (food: FoodItem) => void;
  removeFromFavorites: (foodId: string) => void;
  addFoodToMeal: (date: string, mealId: string, food: FoodItem) => void;
  dailyGoals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export default function FoodDetailScreen() {
  const params = useLocalSearchParams();
  const id = typeof params.id === 'string' ? params.id : '';
  
  const { favoriteFood, addToFavorites, removeFromFavorites, addFoodToMeal, dailyGoals } = useNutritionStore() as NutritionStore;
  
  const [food, setFood] = useState<FoodItem | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedMealId, setSelectedMealId] = useState('breakfast');
  
  const meals = [
    { id: 'breakfast', name: 'Breakfast' },
    { id: 'lunch', name: 'Lunch' },
    { id: 'dinner', name: 'Dinner' },
    { id: 'snack', name: 'Snack' },
  ];
  
  useEffect(() => {
    const loadFoodDetails = async () => {
      if (id) {
        const foodDetails = await getFoodById(id);
        setFood(foodDetails);
      }
    };
    
    loadFoodDetails();
  }, [id]);
  
  useEffect(() => {
    // Check if food is in favorites
    if (food) {
      const isFav = favoriteFood.some((f: FoodItem) => f.id === food.id);
      setIsFavorite(isFav);
    }
  }, [food, favoriteFood]);
  
  const handleToggleFavorite = () => {
    if (!food) return;
    
    if (isFavorite) {
      removeFromFavorites(food.id);
    } else {
      addToFavorites(food);
    }
    
    setIsFavorite(!isFavorite);
  };
  
  const handleAddToMeal = () => {
    if (!food) return;
    
    // Create a new food item with adjusted quantities
    const adjustedFood: FoodItem = {
      ...food,
      calories: Math.round(food.calories * quantity),
      protein: Math.round(food.protein * quantity * 10) / 10,
      carbs: Math.round(food.carbs * quantity * 10) / 10,
      fat: Math.round(food.fat * quantity * 10) / 10,
    };
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Add food to the selected meal
    addFoodToMeal(today, selectedMealId, adjustedFood);
    
    // Navigate back to nutrition screen
    router.replace('/nutrition' as any);
  };
  
  const increaseQuantity = () => {
    setQuantity(prev => prev + 1);
  };
  
  const decreaseQuantity = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };
  
  // Get color for Nutri-Score
  const getNutriScoreColor = (score: string) => {
    switch (score) {
      case 'A': return '#1E8F4E'; // Dark green
      case 'B': return '#4CAF50'; // Green
      case 'C': return '#FFEB3B'; // Yellow
      case 'D': return '#FF9800'; // Orange
      case 'E': return '#F44336'; // Red
      default: return '#757575'; // Grey
    }
  };
  
  if (!food) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading food details...</Text>
      </View>
    );
  }
  
  // Calculate percentages of daily goals
  const caloriesPercent = (food.calories * quantity) / dailyGoals.calories;
  const proteinPercent = (food.protein * quantity) / dailyGoals.protein;
  const carbsPercent = (food.carbs * quantity) / dailyGoals.carbs;
  const fatPercent = (food.fat * quantity) / dailyGoals.fat;
  
  // Default image if none provided
  const defaultImage = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=500';
  
  return (
    <>
      <Stack.Screen 
        options={{
          title: food.name,
          headerRight: () => (
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={handleToggleFavorite}
            >
              <Heart 
                size={24} 
                color={isFavorite ? Colors.secondary : Colors.text.primary} 
                fill={isFavorite ? Colors.secondary : 'none'}
              />
            </TouchableOpacity>
          ),
        }} 
      />
      
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Food Image */}
        <Image
          source={{ uri: food.imageUrl || defaultImage }}
          style={styles.image}
          resizeMode="cover"
        />
        
        {/* Food Info */}
        <Card variant="elevated" style={styles.infoCard}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.foodName}>{food.name}</Text>
              <Text style={styles.servingSize}>{food.servingSize}</Text>
            </View>
            
            {food.nutritionalScore && (
              <View style={[styles.nutriScoreBadge, { backgroundColor: getNutriScoreColor(food.nutritionalScore.score) }]}>
                <Text style={styles.nutriScoreText}>
                  {food.nutritionalScore.score}
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.quantityContainer}>
            <Text style={styles.quantityLabel}>Quantity:</Text>
            <View style={styles.quantityControls}>
              <TouchableOpacity 
                style={styles.quantityButton}
                onPress={decreaseQuantity}
                disabled={quantity <= 1}
              >
                <Minus size={16} color={quantity <= 1 ? Colors.text.tertiary : Colors.text.primary} />
              </TouchableOpacity>
              
              <Text style={styles.quantityValue}>{quantity}</Text>
              
              <TouchableOpacity 
                style={styles.quantityButton}
                onPress={increaseQuantity}
              >
                <Plus size={16} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.nutritionContainer}>
            <View style={styles.nutritionHeader}>
              <Text style={styles.nutritionTitle}>Nutrition Facts</Text>
              <Text style={styles.nutritionSubtitle}>
                Per {quantity > 1 ? `${quantity} × ` : ''}serving
              </Text>
            </View>
            
            <View style={styles.nutritionItem}>
              <View style={styles.nutritionItemHeader}>
                <Text style={styles.nutritionItemName}>Calories</Text>
                <Text style={styles.nutritionItemValue}>
                  {Math.round(food.calories * quantity)}
                </Text>
              </View>
              <ProgressBar 
                progress={caloriesPercent}
                height={6}
                progressColor={Colors.primary}
              />
              <Text style={styles.nutritionItemPercent}>
                {Math.round(caloriesPercent * 100)}% of daily goal
              </Text>
            </View>
            
            <View style={styles.nutritionItem}>
              <View style={styles.nutritionItemHeader}>
                <Text style={styles.nutritionItemName}>Protein</Text>
                <Text style={styles.nutritionItemValue}>
                  {(food.protein * quantity).toFixed(1)}g
                </Text>
              </View>
              <ProgressBar 
                progress={proteinPercent}
                height={6}
                progressColor="#4CAF50"
              />
              <Text style={styles.nutritionItemPercent}>
                {Math.round(proteinPercent * 100)}% of daily goal
              </Text>
            </View>
            
            <View style={styles.nutritionItem}>
              <View style={styles.nutritionItemHeader}>
                <Text style={styles.nutritionItemName}>Carbs</Text>
                <Text style={styles.nutritionItemValue}>
                  {(food.carbs * quantity).toFixed(1)}g
                </Text>
              </View>
              <ProgressBar 
                progress={carbsPercent}
                height={6}
                progressColor="#2196F3"
              />
              <Text style={styles.nutritionItemPercent}>
                {Math.round(carbsPercent * 100)}% of daily goal
              </Text>
            </View>
            
            <View style={styles.nutritionItem}>
              <View style={styles.nutritionItemHeader}>
                <Text style={styles.nutritionItemName}>Fat</Text>
                <Text style={styles.nutritionItemValue}>
                  {(food.fat * quantity).toFixed(1)}g
                </Text>
              </View>
              <ProgressBar 
                progress={fatPercent}
                height={6}
                progressColor="#FF9800"
              />
              <Text style={styles.nutritionItemPercent}>
                {Math.round(fatPercent * 100)}% of daily goal
              </Text>
            </View>
            
            {food.nutritionalDetails && (
              <>
                <View style={styles.nutritionDivider} />
                
                <View style={styles.detailedNutrition}>
                  <View style={styles.detailedNutritionItem}>
                    <Text style={styles.detailedNutritionLabel}>Saturated Fat</Text>
                    <Text style={styles.detailedNutritionValue}>
                      {(food.nutritionalDetails.saturatedFat * quantity).toFixed(1)}g
                    </Text>
                  </View>
                  
                  <View style={styles.detailedNutritionItem}>
                    <Text style={styles.detailedNutritionLabel}>Sugar</Text>
                    <Text style={styles.detailedNutritionValue}>
                      {(food.nutritionalDetails.sugar * quantity).toFixed(1)}g
                    </Text>
                  </View>
                  
                  <View style={styles.detailedNutritionItem}>
                    <Text style={styles.detailedNutritionLabel}>Fiber</Text>
                    <Text style={styles.detailedNutritionValue}>
                      {(food.nutritionalDetails.fiber * quantity).toFixed(1)}g
                    </Text>
                  </View>
                  
                  <View style={styles.detailedNutritionItem}>
                    <Text style={styles.detailedNutritionLabel}>Sodium</Text>
                    <Text style={styles.detailedNutritionValue}>
                      {Math.round(food.nutritionalDetails.sodium * quantity)}mg
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
          
          {food.nutritionalScore && (
            <View style={styles.nutriScoreContainer}>
              <View style={styles.nutriScoreHeader}>
                <Award size={20} color={getNutriScoreColor(food.nutritionalScore.score)} />
                <Text style={styles.nutriScoreTitle}>Nutritional Score</Text>
              </View>
              
              <View style={styles.nutriScoreGrades}>
                {['A', 'B', 'C', 'D', 'E'].map((grade) => (
                  <View 
                    key={grade}
                    style={[
                      styles.nutriScoreGrade,
                      { 
                        backgroundColor: getNutriScoreColor(grade),
                        opacity: food.nutritionalScore?.score === grade ? 1 : 0.3
                      }
                    ]}
                  >
                    <Text style={styles.nutriScoreGradeText}>{grade}</Text>
                  </View>
                ))}
              </View>
              
              <Text style={styles.nutriScoreDescription}>
                {food.nutritionalScore.score === 'A' && "Excellent nutritional quality"}
                {food.nutritionalScore.score === 'B' && "Good nutritional quality"}
                {food.nutritionalScore.score === 'C' && "Average nutritional quality"}
                {food.nutritionalScore.score === 'D' && "Poor nutritional quality"}
                {food.nutritionalScore.score === 'E' && "Unhealthy nutritional quality"}
              </Text>
            </View>
          )}
        </Card>
        
        {/* Meal Selection */}
        <Card variant="elevated" style={styles.mealCard}>
          <Text style={styles.mealTitle}>Add to Meal</Text>
          
          <View style={styles.mealButtons}>
            {meals.map(meal => (
              <TouchableOpacity
                key={meal.id}
                style={[
                  styles.mealButton,
                  selectedMealId === meal.id && styles.selectedMealButton
                ]}
                onPress={() => setSelectedMealId(meal.id)}
              >
                <Text
                  style={[
                    styles.mealButtonText,
                    selectedMealId === meal.id && styles.selectedMealButtonText
                  ]}
                >
                  {meal.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <Button
            title="Add to Log"
            onPress={handleAddToMeal}
            style={styles.addButton}
          />
        </Card>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
  },
  image: {
    width: '100%',
    height: 200,
  },
  infoCard: {
    margin: 16,
    marginTop: -40,
    borderRadius: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  foodName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  servingSize: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  nutriScoreBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nutriScoreText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: 'white',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text.primary,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginHorizontal: 16,
    minWidth: 24,
    textAlign: 'center',
  },
  nutritionContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 16,
  },
  nutritionHeader: {
    marginBottom: 16,
  },
  nutritionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  nutritionSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  nutritionItem: {
    marginBottom: 16,
  },
  nutritionItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  nutritionItemName: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  nutritionItemValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text.primary,
  },
  nutritionItemPercent: {
    fontSize: 12,
    color: Colors.text.tertiary,
    marginTop: 4,
    textAlign: 'right',
  },
  nutritionDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },
  detailedNutrition: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailedNutritionItem: {
    width: '48%',
    marginBottom: 12,
  },
  detailedNutritionLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  detailedNutritionValue: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text.primary,
  },
  nutriScoreContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  nutriScoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  nutriScoreTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginLeft: 8,
  },
  nutriScoreGrades: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  nutriScoreGrade: {
    width: '18%',
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  nutriScoreGradeText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: 'white',
  },
  nutriScoreDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  mealCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  mealTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginBottom: 16,
  },
  mealButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  mealButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedMealButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  mealButtonText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  selectedMealButtonText: {
    color: Colors.text.inverse,
  },
  addButton: {
    width: '100%',
  },
});