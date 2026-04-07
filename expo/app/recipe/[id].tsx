import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  Share,
  Alert,
  Dimensions,
  StatusBar
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { 
  ArrowLeft, 
  Heart, 
  Share2, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  Users,
  Check
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import ProgressBar from '@/components/ProgressBar';
import Card from '@/components/Card';
import { useNutritionStore } from '@/store/nutritionStore';
import { Recipe, FoodItem } from '@/types';

const { width } = Dimensions.get('window');

// Mock data for recipes (this would come from your data source)
const recipesData: Recipe[] = [
  {
    id: '1',
    title: 'Whole-Grain Cinnamon-Apple Pancakes',
    description: 'Delicious and nutritious pancakes made with whole grains and fresh apples.',
    prepTime: 20,
    calories: 320,
    protein: 12.2,
    carbs: 48.8,
    fat: 8.2,
    image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800',
    category: 'breakfast',
    dietaryTags: ['under-500-calories', 'immune-support', 'breakfast'],
    servings: 4,
    ingredients: [
      '2 medium gala or honeycrisp apples, peeled and cored',
      '2 tablespoons unsalted butter',
      '2 tablespoons maple syrup',
      '1 1/4 teaspoons ground cinnamon',
      '2/3 cup quick-cooking oats',
      '1/3 cup whole wheat flour',
      '1 teaspoon baking powder',
      '1/4 teaspoon salt',
      '2 large eggs',
      '1 cup milk',
      '1 teaspoon vanilla extract'
    ],
    instructions: [
      'Dice one apple and slice the other. Heat 1 tablespoon butter in a skillet over medium heat. Add diced apple, 1 tablespoon maple syrup, and 1/2 teaspoon cinnamon. Cook until softened, about 5 minutes. Set aside.',
      'In a large bowl, combine oats, flour, baking powder, remaining cinnamon, and salt.',
      'In another bowl, whisk eggs, milk, remaining maple syrup, and vanilla. Pour wet ingredients into dry and stir until just combined. Fold in cooked apple pieces.',
      'Heat remaining butter in a large nonstick skillet over medium heat. Pour 1/4 cup batter for each pancake. Cook until bubbles form on surface, about 2-3 minutes, then flip and cook another 1-2 minutes.',
      'Serve pancakes topped with apple slices and additional maple syrup if desired.'
    ]
  },
  {
    id: '2',
    title: 'Grilled Chicken Salad',
    description: 'A refreshing salad with grilled chicken, mixed greens, and a light vinaigrette.',
    prepTime: 20,
    calories: 350,
    protein: 30,
    carbs: 15,
    fat: 18,
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
    category: 'lunch',
    dietaryTags: ['high-protein', 'low-carb'],
    servings: 2,
    ingredients: [
      '2 boneless, skinless chicken breasts',
      '4 cups mixed greens',
      '1 cucumber, sliced',
      '1 cup cherry tomatoes, halved',
      '1/4 red onion, thinly sliced',
      '2 tablespoons olive oil',
      '1 tablespoon balsamic vinegar',
      'Salt and pepper to taste'
    ],
    instructions: [
      'Season chicken breasts with salt and pepper. Grill until cooked through, about 6-7 minutes per side.',
      'Let chicken rest for 5 minutes, then slice into strips.',
      'In a large bowl, combine mixed greens, cucumber, tomatoes, and red onion.',
      'Whisk together olive oil and balsamic vinegar. Season with salt and pepper.',
      'Toss salad with dressing, top with sliced chicken, and serve immediately.'
    ]
  },
  {
    id: '3',
    title: 'Salmon with Roasted Vegetables',
    description: 'Omega-3 rich salmon fillet with colorful roasted vegetables.',
    prepTime: 30,
    calories: 480,
    protein: 32,
    carbs: 25,
    fat: 28,
    image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500',
    category: 'dinner',
    dietaryTags: ['high-protein', 'gluten-free'],
    servings: 2,
    ingredients: [
      '2 salmon fillets (6 oz each)',
      '2 cups broccoli florets',
      '1 red bell pepper, sliced',
      '1 zucchini, sliced',
      '1 red onion, cut into wedges',
      '2 tablespoons olive oil',
      '2 cloves garlic, minced',
      '1 lemon, sliced',
      'Fresh herbs (dill, parsley)',
      'Salt and pepper to taste'
    ],
    instructions: [
      'Preheat oven to 425°F (220°C).',
      'Toss vegetables with 1 tablespoon olive oil, garlic, salt, and pepper. Spread on a baking sheet.',
      'Roast vegetables for 15 minutes.',
      'Season salmon with salt and pepper. Place on top of vegetables.',
      'Top salmon with lemon slices and herbs. Drizzle with remaining olive oil.',
      'Roast for another 12-15 minutes until salmon is cooked through.',
      'Serve immediately, garnished with additional fresh herbs if desired.'
    ]
  },
  {
    id: '4',
    title: 'Protein-Pack Breakfast Bowl',
    description: 'A hearty breakfast bowl with eggs, quinoa, avocado, and vegetables.',
    prepTime: 15,
    calories: 420,
    protein: 22,
    carbs: 35,
    fat: 24,
    image: 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=500',
    category: 'breakfast',
    dietaryTags: ['high-protein', 'gluten-free'],
    servings: 1,
    ingredients: [
      '1/2 cup cooked quinoa',
      '2 large eggs',
      '1/2 avocado, sliced',
      '1/2 cup cherry tomatoes, halved',
      '1/4 cup black beans, rinsed and drained',
      '1 tablespoon olive oil',
      '1 tablespoon fresh lime juice',
      '1/4 teaspoon cumin',
      'Salt and pepper to taste',
      'Fresh cilantro for garnish'
    ],
    instructions: [
      'Cook quinoa according to package instructions and set aside.',
      'Heat a non-stick pan over medium heat. Crack eggs into the pan and cook to your preference (sunny-side up, over easy, or scrambled).',
      'In a bowl, arrange the cooked quinoa as the base.',
      'Top with cooked eggs, sliced avocado, cherry tomatoes, and black beans.',
      'In a small bowl, whisk together olive oil, lime juice, cumin, salt, and pepper.',
      'Drizzle the dressing over the bowl and garnish with fresh cilantro.',
      'Serve immediately while warm.'
    ]
  }
];

export default function RecipeDetailScreen() {
  const params = useLocalSearchParams();
  const id = typeof params.id === 'string' ? params.id : '';
  
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showFullNutrition, setShowFullNutrition] = useState(false);
  const [loggedToMeal, setLoggedToMeal] = useState(false);
  
  const { favoriteFood, addToFavorites, removeFromFavorites, addFoodToMeal } = useNutritionStore() as {
    favoriteFood: FoodItem[];
    addToFavorites: (food: FoodItem) => void;
    removeFromFavorites: (id: string) => void;
    addFoodToMeal: (date: string, mealId: string, food: FoodItem) => void;
  };
  
  useEffect(() => {
    // In a real app, you would fetch the recipe from an API or database
    const foundRecipe = recipesData.find(r => r.id === id);
    if (foundRecipe) {
      setRecipe(foundRecipe);
      
      // Check if this recipe is in favorites
      const isInFavorites = favoriteFood.some((food: FoodItem) => 
        food.name === foundRecipe.title && food.calories === foundRecipe.calories
      );
      setIsFavorite(isInFavorites);
    }
  }, [id, favoriteFood]);
  
  if (!recipe) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading recipe...</Text>
      </View>
    );
  }
  
  const handleToggleFavorite = () => {
    if (isFavorite) {
      // Find the food item in favorites with this recipe name
      const foodItem = favoriteFood.find((food: FoodItem) => food.name === recipe.title);
      if (foodItem) {
        removeFromFavorites(foodItem.id);
      }
    } else {
      // Create a food item from this recipe
      const foodItem: FoodItem = {
        id: `recipe-${recipe.id}`,
        name: recipe.title,
        calories: recipe.calories,
        protein: recipe.protein,
        carbs: recipe.carbs,
        fat: recipe.fat,
        servingSize: `1/${recipe.servings || 1} recipe`,
        imageUrl: recipe.image
      };
      addToFavorites(foodItem);
    }
    setIsFavorite(!isFavorite);
  };
  
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this recipe: ${recipe.title}

${recipe.description}`,
        title: recipe.title,
      });
    } catch (error) {
      Alert.alert('Error', 'Could not share recipe');
    }
  };
  
  const handleLogToMeal = () => {
    // Create a food item from this recipe
    const foodItem: FoodItem = {
      id: `recipe-${recipe.id}-${Date.now()}`,
      name: recipe.title,
      calories: recipe.calories,
      protein: recipe.protein,
      carbs: recipe.carbs,
      fat: recipe.fat,
      servingSize: `1/${recipe.servings || 1} recipe`,
      imageUrl: recipe.image
    };
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Create a meal ID based on the current time
    const mealId = `meal-${Date.now()}`;
    
    // Add the food to a new meal
    addFoodToMeal(today, mealId, foodItem);
    
    setLoggedToMeal(true);
    
    // Show confirmation
    Alert.alert(
      'Recipe Logged',
      'This recipe has been added to your nutrition diary.',
      [
        { 
          text: 'View Diary', 
          onPress: () => router.push('/nutrition' as any) 
        },
        { 
          text: 'OK', 
          style: 'cancel' 
        },
      ]
    );
  };
  
  // Calculate macronutrient percentages
  const totalCals = recipe.calories;
  const proteinCals = recipe.protein * 4; // 4 calories per gram of protein
  const carbsCals = recipe.carbs * 4; // 4 calories per gram of carbs
  const fatCals = recipe.fat * 9; // 9 calories per gram of fat
  
  const proteinPercentage = Math.round((proteinCals / totalCals) * 100);
  const carbsPercentage = Math.round((carbsCals / totalCals) * 100);
  const fatPercentage = Math.round((fatCals / totalCals) * 100);
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Recipe Image */}
        <Image 
          source={{ uri: recipe.image }} 
          style={styles.recipeImage}
          resizeMode="cover"
        />
        
        {/* Custom Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={handleToggleFavorite}
            >
              <Heart 
                size={24} 
                color="white"
                fill={isFavorite ? "white" : 'none'}
              />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={handleShare}
            >
              <Share2 size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Recipe Info */}
        <View style={styles.recipeInfo}>
          <Text style={styles.recipeTitle}>{recipe.title}</Text>
          
          <Text style={styles.servesText}>Serves {recipe.servings}</Text>
          
          <View style={styles.tagsContainer}>
            {recipe.dietaryTags.map((tag: string, index: number) => (
              <View key={index} style={styles.tagPill}>
                <Text style={styles.tagText}>
                  {tag.split('-').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </Text>
              </View>
            ))}
          </View>
          
          {/* Nutrition Section */}
          <View style={styles.nutritionSection}>
            <Text style={styles.sectionTitle}>Nutrition Per Serving</Text>
            
            <View style={styles.nutritionContainer}>
              {/* Calories Circle */}
              <View style={styles.caloriesCircle}>
                <Text style={styles.caloriesValue}>{recipe.calories}</Text>
                <Text style={styles.caloriesLabel}>cal</Text>
              </View>
              
              {/* Macros */}
              <View style={styles.macrosContainer}>
                <View style={styles.macroItem}>
                  <Text style={styles.macroPercentage}>{carbsPercentage}%</Text>
                  <Text style={styles.macroValue}>{recipe.carbs.toFixed(1)}g</Text>
                  <Text style={styles.macroLabel}>Carbs</Text>
                </View>
                
                <View style={styles.macroItem}>
                  <Text style={styles.macroPercentage}>{fatPercentage}%</Text>
                  <Text style={styles.macroValue}>{recipe.fat.toFixed(1)}g</Text>
                  <Text style={styles.macroLabel}>Fat</Text>
                </View>
                
                <View style={styles.macroItem}>
                  <Text style={styles.macroPercentage}>{proteinPercentage}%</Text>
                  <Text style={styles.macroValue}>{recipe.protein.toFixed(1)}g</Text>
                  <Text style={styles.macroLabel}>Protein</Text>
                </View>
              </View>
            </View>
            
            {/* Full Nutrition Toggle */}
            <TouchableOpacity 
              style={styles.nutritionToggle}
              onPress={() => setShowFullNutrition(!showFullNutrition)}
            >
              <Text style={styles.nutritionToggleText}>
                {showFullNutrition ? 'HIDE NUTRITION' : 'SHOW NUTRITION'}
              </Text>
              {showFullNutrition ? (
                <ChevronUp size={20} color={Colors.primary} />
              ) : (
                <ChevronDown size={20} color={Colors.primary} />
              )}
            </TouchableOpacity>
            
            {/* Full Nutrition Details */}
            {showFullNutrition && (
              <Card style={styles.fullNutritionCard}>
                <View style={styles.nutritionRow}>
                  <Text style={styles.nutritionLabel}>Calories</Text>
                  <Text style={styles.nutritionValue}>{recipe.calories}</Text>
                </View>
                
                <View style={styles.nutritionRow}>
                  <Text style={styles.nutritionLabel}>Total Fat</Text>
                  <Text style={styles.nutritionValue}>{recipe.fat.toFixed(1)}g</Text>
                </View>
                
                <View style={styles.nutritionRow}>
                  <Text style={styles.nutritionLabel}>Total Carbohydrates</Text>
                  <Text style={styles.nutritionValue}>{recipe.carbs.toFixed(1)}g</Text>
                </View>
                
                <View style={styles.nutritionRow}>
                  <Text style={styles.nutritionLabel}>Protein</Text>
                  <Text style={styles.nutritionValue}>{recipe.protein.toFixed(1)}g</Text>
                </View>
                
                {/* Additional nutrition info could be added here */}
              </Card>
            )}
          </View>
          
          {/* Ingredients Section */}
          <View style={styles.ingredientsSection}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            
            {recipe.ingredients && recipe.ingredients.length > 0 ? (
              (recipe.ingredients as string[]).map((ingredient: string, index: number) => (
                <View key={index} style={styles.ingredientItem}>
                  <Text style={styles.ingredientText}>{ingredient}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noDataText}>No ingredients available</Text>
            )}
          </View>
          
          {/* Instructions Section */}
          <View style={styles.instructionsSection}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            
            {recipe.instructions && recipe.instructions.length > 0 ? (
              recipe.instructions.map((instruction: string, index: number) => (
                <View key={index} style={styles.instructionItem}>
                  <View style={styles.instructionNumber}>
                    <Text style={styles.instructionNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.instructionText}>{instruction}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noDataText}>No instructions available</Text>
            )}
          </View>
          
          {/* Spacing for the bottom button */}
          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>
      
      {/* Log to Diary Button */}
      <View style={styles.bottomButtonContainer}>
        <Button
          title={loggedToMeal ? "LOGGED TO DIARY" : "LOG TO DIARY"}
          onPress={handleLogToMeal}
          style={styles.logButton}
          leftIcon={loggedToMeal ? <Check size={20} color="white" /> : undefined}
          disabled={loggedToMeal}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  recipeImage: {
    width: '100%',
    height: 350,
  },
  recipeInfo: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 100, // Extra padding for bottom button
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
  },
  recipeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  servesText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: `${Colors.primary}15`,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  nutritionSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  nutritionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  caloriesCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 8,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 24,
  },
  caloriesValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  caloriesLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  macrosContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroItem: {
    alignItems: 'center',
  },
  macroPercentage: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  macroValue: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
    marginVertical: 4,
  },
  macroLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  nutritionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  nutritionToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginRight: 4,
  },
  fullNutritionCard: {
    marginTop: 16,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  nutritionLabel: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  nutritionValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  ingredientsSection: {
    marginBottom: 32,
  },
  ingredientItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  ingredientText: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  instructionsSection: {
    marginBottom: 32,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  instructionNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.inverse,
  },
  instructionText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text.primary,
    lineHeight: 24,
  },
  bottomSpacer: {
    height: 80,
  },
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  logButton: {
    width: '100%',
  },
  noDataText: {
    fontSize: 16,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    paddingVertical: 12,
  },
});