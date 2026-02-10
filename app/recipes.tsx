import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput, Dimensions, Modal } from 'react-native';
import { Stack, router } from 'expo-router';
import { Search, Filter, Clock, Soup, Bookmark, ChevronLeft, ChevronRight, Plus, ShoppingCart } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Badge from '@/components/Badge';
import BottomNavigation from '@/components/BottomNavigation';
import RecipeImportModal from '@/components/RecipeImportModal';
import GroceryList from '@/components/GroceryList';
import { Recipe } from '@/types';
import { useRecipeStore } from '@/store/recipeStore';

const { width } = Dimensions.get('window');

// Mock data for recipes
const recipesData: Recipe[] = [
  {
    id: '1',
    name: 'Whole-Grain Cinnamon-Apple Pancakes',
    title: 'Whole-Grain Cinnamon-Apple Pancakes',
    description: 'Delicious and nutritious pancakes made with whole grains and fresh apples.',
    prepTime: 20,
    cookTime: 15,
    servings: 4,
    difficulty: 'easy',
    category: 'breakfast',
    tags: ['breakfast', 'healthy', 'whole-grain'],
    dietaryTags: ['vegetarian', 'high-fiber'],
    imageUrl: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800',
    image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800',
    ingredients: [
      { id: '1', name: '2 medium gala or honeycrisp apples, peeled and cored', amount: 2, unit: 'medium' },
      { id: '2', name: '2 tablespoons unsalted butter', amount: 2, unit: 'tablespoons' },
      { id: '3', name: '2 tablespoons maple syrup', amount: 2, unit: 'tablespoons' },
      { id: '4', name: '1 1/4 teaspoons ground cinnamon', amount: 1.25, unit: 'teaspoons' },
      { id: '5', name: '2/3 cup quick-cooking oats', amount: 0.67, unit: 'cup' },
      { id: '6', name: '1/3 cup whole wheat flour', amount: 0.33, unit: 'cup' },
      { id: '7', name: '1 teaspoon baking powder', amount: 1, unit: 'teaspoon' },
      { id: '8', name: '1/4 teaspoon salt', amount: 0.25, unit: 'teaspoon' },
      { id: '9', name: '2 large eggs', amount: 2, unit: 'large' },
      { id: '10', name: '1 cup milk', amount: 1, unit: 'cup' },
      { id: '11', name: '1 teaspoon vanilla extract', amount: 1, unit: 'teaspoon' }
    ],
    instructions: [
      'Dice one apple and slice the other. Heat 1 tablespoon butter in a skillet over medium heat. Add diced apple, 1 tablespoon maple syrup, and 1/2 teaspoon cinnamon. Cook until softened, about 5 minutes. Set aside.',
      'In a large bowl, combine oats, flour, baking powder, remaining cinnamon, and salt.',
      'In another bowl, whisk eggs, milk, remaining maple syrup, and vanilla. Pour wet ingredients into dry and stir until just combined. Fold in cooked apple pieces.',
      'Heat remaining butter in a large nonstick skillet over medium heat. Pour 1/4 cup batter for each pancake. Cook until bubbles form on surface, about 2-3 minutes, then flip and cook another 1-2 minutes.',
      'Serve pancakes topped with apple slices and additional maple syrup if desired.'
    ],
    nutrition: {
      calories: 320,
      protein: 12.2,
      carbs: 48.8,
      fat: 8.2,
      fiber: 5.1
    },
    calories: 320,
    protein: 12.2,
    carbs: 48.8,
    fat: 8.2,
    rating: 4.8,
    reviewCount: 124
  },
  {
    id: '2',
    name: 'Grilled Chicken Salad',
    title: 'Grilled Chicken Salad',
    description: 'A refreshing salad with grilled chicken, mixed greens, and a light vinaigrette.',
    prepTime: 20,
    cookTime: 15,
    servings: 2,
    difficulty: 'easy',
    category: 'lunch',
    tags: ['lunch', 'healthy', 'protein'],
    dietaryTags: ['high-protein', 'low-carb'],
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
    ingredients: [
      { id: '1', name: '2 boneless, skinless chicken breasts', amount: 2, unit: 'pieces' },
      { id: '2', name: '4 cups mixed greens', amount: 4, unit: 'cups' },
      { id: '3', name: '1 cucumber, sliced', amount: 1, unit: 'medium' },
      { id: '4', name: '1 cup cherry tomatoes, halved', amount: 1, unit: 'cup' },
      { id: '5', name: '1/4 red onion, thinly sliced', amount: 0.25, unit: 'medium' },
      { id: '6', name: '2 tablespoons olive oil', amount: 2, unit: 'tablespoons' },
      { id: '7', name: '1 tablespoon balsamic vinegar', amount: 1, unit: 'tablespoon' },
      { id: '8', name: 'Salt and pepper to taste', amount: 1, unit: 'to taste' }
    ],
    instructions: [
      'Season chicken breasts with salt and pepper. Grill until cooked through, about 6-7 minutes per side.',
      'Let chicken rest for 5 minutes, then slice into strips.',
      'In a large bowl, combine mixed greens, cucumber, tomatoes, and red onion.',
      'Whisk together olive oil and balsamic vinegar. Season with salt and pepper.',
      'Toss salad with dressing, top with sliced chicken, and serve immediately.'
    ],
    nutrition: {
      calories: 350,
      protein: 30,
      carbs: 15,
      fat: 18,
      fiber: 4
    },
    calories: 350,
    protein: 30,
    carbs: 15,
    fat: 18,
    rating: 4.6,
    reviewCount: 89
  },
  {
    id: '3',
    name: 'Salmon with Roasted Vegetables',
    title: 'Salmon with Roasted Vegetables',
    description: 'Omega-3 rich salmon fillet with colorful roasted vegetables.',
    prepTime: 30,
    cookTime: 25,
    servings: 2,
    difficulty: 'medium',
    category: 'dinner',
    tags: ['dinner', 'healthy', 'omega-3'],
    dietaryTags: ['high-protein', 'omega-3'],
    imageUrl: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500',
    image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500',
    ingredients: [
      { id: '1', name: '2 salmon fillets (6 oz each)', amount: 2, unit: 'fillets' },
      { id: '2', name: '2 cups broccoli florets', amount: 2, unit: 'cups' },
      { id: '3', name: '1 red bell pepper, sliced', amount: 1, unit: 'medium' },
      { id: '4', name: '1 zucchini, sliced', amount: 1, unit: 'medium' },
      { id: '5', name: '1 red onion, cut into wedges', amount: 1, unit: 'medium' },
      { id: '6', name: '2 tablespoons olive oil', amount: 2, unit: 'tablespoons' },
      { id: '7', name: '2 cloves garlic, minced', amount: 2, unit: 'cloves' },
      { id: '8', name: '1 lemon, sliced', amount: 1, unit: 'medium' },
      { id: '9', name: 'Fresh herbs (dill, parsley)', amount: 1, unit: 'handful' },
      { id: '10', name: 'Salt and pepper to taste', amount: 1, unit: 'to taste' }
    ],
    instructions: [
      'Preheat oven to 425°F (220°C).',
      'Toss vegetables with 1 tablespoon olive oil, garlic, salt, and pepper. Spread on a baking sheet.',
      'Roast vegetables for 15 minutes.',
      'Season salmon with salt and pepper. Place on top of vegetables.',
      'Top salmon with lemon slices and herbs. Drizzle with remaining olive oil.',
      'Roast for another 12-15 minutes until salmon is cooked through.',
      'Serve immediately, garnished with additional fresh herbs if desired.'
    ],
    nutrition: {
      calories: 480,
      protein: 32,
      carbs: 25,
      fat: 28,
      fiber: 6
    },
    calories: 480,
    protein: 32,
    carbs: 25,
    fat: 28,
    rating: 4.9,
    reviewCount: 156
  },
  {
    id: '4',
    name: 'Protein-Pack Breakfast Bowl',
    title: 'Protein-Pack Breakfast Bowl',
    description: 'A hearty breakfast bowl with eggs, quinoa, avocado, and vegetables.',
    prepTime: 15,
    cookTime: 10,
    servings: 1,
    difficulty: 'easy',
    category: 'breakfast',
    tags: ['breakfast', 'protein', 'healthy'],
    dietaryTags: ['high-protein', 'vegetarian'],
    imageUrl: 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=500',
    image: 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=500',
    ingredients: [
      { id: '1', name: '1/2 cup cooked quinoa', amount: 0.5, unit: 'cup' },
      { id: '2', name: '2 large eggs', amount: 2, unit: 'large' },
      { id: '3', name: '1/2 avocado, sliced', amount: 0.5, unit: 'medium' },
      { id: '4', name: '1/2 cup cherry tomatoes, halved', amount: 0.5, unit: 'cup' },
      { id: '5', name: '1/4 cup black beans, rinsed and drained', amount: 0.25, unit: 'cup' },
      { id: '6', name: '1 tablespoon olive oil', amount: 1, unit: 'tablespoon' },
      { id: '7', name: '1 tablespoon fresh lime juice', amount: 1, unit: 'tablespoon' },
      { id: '8', name: '1/4 teaspoon cumin', amount: 0.25, unit: 'teaspoon' },
      { id: '9', name: 'Salt and pepper to taste', amount: 1, unit: 'to taste' },
      { id: '10', name: 'Fresh cilantro for garnish', amount: 1, unit: 'handful' }
    ],
    instructions: [
      'Cook quinoa according to package instructions and set aside.',
      'Heat a non-stick pan over medium heat. Crack eggs into the pan and cook to your preference (sunny-side up, over easy, or scrambled).',
      'In a bowl, arrange the cooked quinoa as the base.',
      'Top with cooked eggs, sliced avocado, cherry tomatoes, and black beans.',
      'In a small bowl, whisk together olive oil, lime juice, cumin, salt, and pepper.',
      'Drizzle the dressing over the bowl and garnish with fresh cilantro.',
      'Serve immediately while warm.'
    ],
    nutrition: {
      calories: 420,
      protein: 22,
      carbs: 35,
      fat: 24,
      fiber: 8
    },
    calories: 420,
    protein: 22,
    carbs: 35,
    fat: 24,
    rating: 4.7,
    reviewCount: 203
  },
  {
    id: '5',
    name: 'Quinoa Buddha Bowl',
    title: 'Quinoa Buddha Bowl',
    description: 'Nutrient-dense bowl with quinoa, roasted sweet potatoes, and chickpeas.',
    prepTime: 25,
    cookTime: 30,
    servings: 2,
    difficulty: 'easy',
    category: 'lunch',
    tags: ['lunch', 'vegan', 'healthy'],
    dietaryTags: ['vegan', 'high-fiber'],
    imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500',
    ingredients: [
      { id: '1', name: '1 cup quinoa, rinsed', amount: 1, unit: 'cup' },
      { id: '2', name: '2 cups water or vegetable broth', amount: 2, unit: 'cups' },
      { id: '3', name: '1 large sweet potato, diced', amount: 1, unit: 'large' },
      { id: '4', name: '1 can chickpeas, drained and rinsed', amount: 1, unit: 'can' },
      { id: '5', name: '1 tablespoon olive oil', amount: 1, unit: 'tablespoon' },
      { id: '6', name: '1 teaspoon cumin', amount: 1, unit: 'teaspoon' },
      { id: '7', name: '1 teaspoon paprika', amount: 1, unit: 'teaspoon' },
      { id: '8', name: '2 cups baby spinach', amount: 2, unit: 'cups' },
      { id: '9', name: '1 avocado, sliced', amount: 1, unit: 'medium' },
      { id: '10', name: '1/4 cup tahini', amount: 0.25, unit: 'cup' },
      { id: '11', name: '2 tablespoons lemon juice', amount: 2, unit: 'tablespoons' },
      { id: '12', name: 'Salt and pepper to taste', amount: 1, unit: 'to taste' }
    ],
    instructions: [
      'Preheat oven to 400°F (200°C).',
      'Cook quinoa according to package instructions using water or broth.',
      'Toss sweet potato and chickpeas with olive oil, cumin, paprika, salt, and pepper. Spread on a baking sheet.',
      'Roast for 20-25 minutes until sweet potatoes are tender.',
      'Whisk together tahini, lemon juice, and 2-3 tablespoons water to make dressing.',
      'Assemble bowls with quinoa, roasted vegetables, spinach, and avocado.',
      'Drizzle with tahini dressing and serve.'
    ],
    nutrition: {
      calories: 420,
      protein: 15,
      carbs: 65,
      fat: 12,
      fiber: 12
    },
    calories: 420,
    protein: 15,
    carbs: 65,
    fat: 12,
    rating: 4.5,
    reviewCount: 178
  },
  {
    id: '6',
    name: 'Turkey and Vegetable Stir Fry',
    title: 'Turkey and Vegetable Stir Fry',
    description: 'Quick and easy stir fry with lean turkey and colorful vegetables.',
    prepTime: 20,
    cookTime: 15,
    servings: 2,
    difficulty: 'easy',
    category: 'dinner',
    tags: ['dinner', 'quick', 'protein'],
    dietaryTags: ['high-protein', 'low-carb'],
    imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500',
    image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500',
    ingredients: [
      { id: '1', name: '1 lb ground turkey', amount: 1, unit: 'lb' },
      { id: '2', name: '2 cups mixed vegetables (bell peppers, broccoli, carrots)', amount: 2, unit: 'cups' },
      { id: '3', name: '2 cloves garlic, minced', amount: 2, unit: 'cloves' },
      { id: '4', name: '1 tablespoon ginger, grated', amount: 1, unit: 'tablespoon' },
      { id: '5', name: '2 tablespoons soy sauce (or tamari for gluten-free)', amount: 2, unit: 'tablespoons' },
      { id: '6', name: '1 tablespoon sesame oil', amount: 1, unit: 'tablespoon' },
      { id: '7', name: '1 tablespoon rice vinegar', amount: 1, unit: 'tablespoon' },
      { id: '8', name: '1 teaspoon honey', amount: 1, unit: 'teaspoon' },
      { id: '9', name: '1/4 teaspoon red pepper flakes', amount: 0.25, unit: 'teaspoon' },
      { id: '10', name: '2 green onions, sliced', amount: 2, unit: 'stalks' },
      { id: '11', name: '1 tablespoon sesame seeds', amount: 1, unit: 'tablespoon' }
    ],
    instructions: [
      'Heat a large skillet or wok over medium-high heat.',
      'Add ground turkey and cook until browned, about 5-7 minutes. Remove from pan.',
      'In the same pan, add a bit more oil if needed, then add vegetables, garlic, and ginger. Stir-fry for 3-4 minutes.',
      'In a small bowl, whisk together soy sauce, sesame oil, rice vinegar, honey, and red pepper flakes.',
      'Return turkey to the pan, add sauce, and toss to combine. Cook for another 2 minutes.',
      'Garnish with green onions and sesame seeds before serving.'
    ],
    nutrition: {
      calories: 380,
      protein: 28,
      carbs: 30,
      fat: 15,
      fiber: 5
    },
    calories: 380,
    protein: 28,
    carbs: 30,
    fat: 15,
    rating: 4.4,
    reviewCount: 92
  },
];

// Recipe collections
const recipeCollections = [
  {
    id: 'high-protein',
    title: 'High Protein',
    recipes: recipesData.filter(recipe => recipe.tags?.includes('protein')),
  },
  {
    id: 'breakfast',
    title: 'Breakfast Ideas',
    recipes: recipesData.filter(recipe => recipe.category === 'breakfast'),
  },
  {
    id: 'quick-meals',
    title: 'Quick Meals',
    recipes: recipesData.filter(recipe => recipe.prepTime <= 20),
  },
  {
    id: 'healthy',
    title: 'Healthy Options',
    recipes: recipesData.filter(recipe => recipe.tags?.includes('healthy')),
  },
];

type CategoryFilter = 'all' | 'breakfast' | 'lunch' | 'dinner' | 'snack';
type DietaryFilter = 'all' | 'high-protein' | 'low-carb' | 'vegan' | 'gluten-free' | 'dairy-free' | 'under-500-calories' | 'immune-support';

export default function RecipesScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [dietaryFilter, setDietaryFilter] = useState<DietaryFilter>('all');
  const [showCollections, setShowCollections] = useState(true);
  const [currentCollectionIndex, setCurrentCollectionIndex] = useState(0);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showGroceryList, setShowGroceryList] = useState(false);
  
  const { savedRecipes, loadData } = useRecipeStore() as {
    savedRecipes: Recipe[];
    loadData: () => Promise<void>;
  };
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  const categories: { label: string; value: CategoryFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Breakfast', value: 'breakfast' },
    { label: 'Lunch', value: 'lunch' },
    { label: 'Dinner', value: 'dinner' },
    { label: 'Snack', value: 'snack' },
  ];
  
  const dietaryOptions: { label: string; value: DietaryFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'High Protein', value: 'high-protein' },
    { label: 'Low Carb', value: 'low-carb' },
    { label: 'Vegan', value: 'vegan' },
    { label: 'Gluten Free', value: 'gluten-free' },
    { label: 'Dairy Free', value: 'dairy-free' },
    { label: 'Under 500 Cal', value: 'under-500-calories' },
    { label: 'Immune Support', value: 'immune-support' },
  ];
  
  // Combine saved recipes with mock data
  const allRecipes = [...recipesData, ...savedRecipes];
  
  const filteredRecipes = allRecipes.filter(recipe => {
    // Search filter
    const matchesSearch = 
      searchQuery === '' || 
      (recipe.name || recipe.title).toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Category filter
    const matchesCategory = 
      categoryFilter === 'all' || 
      recipe.category === categoryFilter;
    
    // Dietary filter
    const matchesDietary = 
      dietaryFilter === 'all' || 
      recipe.tags?.includes(dietaryFilter) ||
      recipe.dietaryTags.includes(dietaryFilter);
    
    return matchesSearch && matchesCategory && matchesDietary;
  });
  
  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text.length > 0) {
      setShowCollections(false);
    } else {
      setShowCollections(true);
    }
  };
  
  // Handle collection carousel scroll
  const handleCollectionScroll = useCallback((event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / (width * 0.85));
    setCurrentCollectionIndex(index);
  }, []);
  
  // Navigate collection carousel
  const navigateCollection = useCallback((direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentCollectionIndex((prev) => prev === 0 ? recipeCollections.length - 1 : prev - 1);
    } else {
      setCurrentCollectionIndex((prev) => (prev + 1) % recipeCollections.length);
    }
  }, []);
  
  const renderRecipeItem = ({ item }: { item: Recipe }) => (
    <TouchableOpacity 
      style={styles.recipeCard}
      onPress={() => router.push(`/recipe/${item.id}`)}
      activeOpacity={0.8}
    >
      <Image source={{ uri: item.imageUrl }} style={styles.recipeImage} />
      
      <TouchableOpacity 
        style={styles.bookmarkButton}
        onPress={() => alert('Recipe saved!')}
      >
        <Bookmark size={20} color={Colors.text.inverse} />
      </TouchableOpacity>
      
      <View style={styles.recipeContent}>
        <Text style={styles.recipeTitle}>{item.name}</Text>
        
        <View style={styles.recipeMetaContainer}>
          <View style={styles.recipeMeta}>
            <Clock size={14} color={Colors.text.secondary} />
            <Text style={styles.recipeMetaText}>{item.prepTime} min</Text>
          </View>
          
          <View style={styles.recipeMeta}>
            <Text style={styles.recipeMetaText}>{item.nutrition?.calories || item.calories} cal</Text>
          </View>
          
          <View style={styles.recipeMeta}>
            <Text style={styles.recipeMetaText}>{item.nutrition?.protein || item.protein}g protein</Text>
          </View>
        </View>
        
        <View style={styles.tagsContainer}>
          {item.dietaryTags.map((tag, index) => (
            <Badge 
              key={index} 
              variant="neutral"
              style={styles.tagBadge}
            >
              {tag.split('-').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </Badge>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
  
  const renderCollectionItem = ({ item }: { item: { id: string; title: string; recipes: Recipe[] } }) => (
    <View style={styles.collectionContainer}>
      <View style={styles.collectionHeader}>
        <Text style={styles.collectionTitle}>{item.title}</Text>
        <TouchableOpacity onPress={() => {
          setCategoryFilter('all');
          setDietaryFilter(item.id as DietaryFilter);
          setShowCollections(false);
        }}>
          <Text style={styles.viewMoreText}>View More</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={item.recipes}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(recipe) => recipe.id}
        renderItem={({ item: recipe }) => (
          <TouchableOpacity 
            style={styles.collectionRecipeCard}
            onPress={() => router.push(`/recipe/${recipe.id}`)}
          >
            <Image source={{ uri: recipe.imageUrl }} style={styles.collectionRecipeImage} />
            <View style={styles.collectionRecipeContent}>
              <Text style={styles.collectionRecipeTitle}>{recipe.name || recipe.title}</Text>
              <Text style={styles.collectionRecipeCalories}>{recipe.nutrition?.calories || recipe.calories} Cal</Text>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.collectionRecipesList}
      />
    </View>
  );
  
  return (
    <View style={styles.mainContainer}>
      <Stack.Screen 
        options={{ 
          title: 'Recipes',
          headerTitleStyle: {
            fontWeight: '700' as const,
          },
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity 
                onPress={() => setShowGroceryList(true)}
                style={styles.headerButton}
              >
                <ShoppingCart size={20} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setShowImportModal(true)}
                style={styles.headerButton}
              >
                <Plus size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          ),
        }} 
      />
      
      <View style={styles.container}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Search size={20} color={Colors.text.secondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search recipes"
              value={searchQuery}
              onChangeText={handleSearch}
              placeholderTextColor={Colors.text.tertiary}
            />
          </View>
          
          <TouchableOpacity style={styles.filterButton}>
            <Filter size={20} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>
        
        {/* Categories */}
        <View style={styles.filtersContainer}>
          <FlatList
            data={categories}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.categoryButton,
                  categoryFilter === item.value && styles.activeCategoryButton,
                ]}
                onPress={() => {
                  setCategoryFilter(item.value);
                  if (item.value !== 'all') {
                    setShowCollections(false);
                  } else if (searchQuery === '') {
                    setShowCollections(true);
                  }
                }}
              >
                <Text
                  style={[
                    styles.categoryText,
                    categoryFilter === item.value && styles.activeCategoryText,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.categoriesList}
          />
          
          <FlatList
            data={dietaryOptions}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.dietaryButton,
                  dietaryFilter === item.value && styles.activeDietaryButton,
                ]}
                onPress={() => {
                  setDietaryFilter(item.value);
                  if (item.value !== 'all') {
                    setShowCollections(false);
                  } else if (searchQuery === '' && categoryFilter === 'all') {
                    setShowCollections(true);
                  }
                }}
              >
                <Text
                  style={[
                    styles.dietaryText,
                    dietaryFilter === item.value && styles.activeDietaryText,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.dietaryList}
          />
        </View>
        
        {/* Recipe Collections or Filtered Recipes */}
        {showCollections ? (
          <View style={styles.collectionsWrapper}>
            <View style={styles.collectionsHeader}>
              <Text style={styles.collectionsTitle}>Recipe Collections</Text>
              <View style={styles.carouselControls}>
                <TouchableOpacity 
                  style={styles.carouselButton}
                  onPress={() => navigateCollection('prev')}
                >
                  <ChevronLeft size={16} color={Colors.text.primary} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.carouselButton}
                  onPress={() => navigateCollection('next')}
                >
                  <ChevronRight size={16} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.collectionsCarouselContainer}>
              <FlatList
                data={recipeCollections}
                horizontal
                pagingEnabled
                snapToInterval={width * 0.85 + 16}
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                renderItem={renderCollectionItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.collectionsContainer}
                onMomentumScrollEnd={handleCollectionScroll}
              />
              
              {/* Carousel Indicators */}
              <View style={styles.indicatorsContainer}>
                {recipeCollections.map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.indicator, 
                      currentCollectionIndex === index && styles.activeIndicator
                    ]}
                    onPress={() => setCurrentCollectionIndex(index)}
                  />
                ))}
              </View>
            </View>
          </View>
        ) : filteredRecipes.length > 0 ? (
          <FlatList
            data={filteredRecipes}
            renderItem={renderRecipeItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.recipesList}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Soup size={48} color={Colors.text.tertiary} />
            <Text style={styles.emptyTitle}>No recipes found</Text>
            <Text style={styles.emptyText}>
              Try adjusting your filters or search for different recipes.
            </Text>
          </View>
        )}
      </View>
      
      {/* Modals */}
      <RecipeImportModal 
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          // Refresh the recipes list
          loadData();
        }}
      />
      
      <Modal
        visible={showGroceryList}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowGroceryList(false)}
      >
        <GroceryList 
          visible={showGroceryList}
          onClose={() => setShowGroceryList(false)}
        />
      </Modal>
      
      {/* Bottom Navigation */}
      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingBottom: 60, // Add padding for bottom navigation
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: Colors.text.primary,
    fontSize: 16,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersContainer: {
    backgroundColor: Colors.card,
    paddingBottom: 12,
  },
  categoriesList: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
    backgroundColor: Colors.background,
  },
  activeCategoryButton: {
    backgroundColor: Colors.primary,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text.secondary,
  },
  activeCategoryText: {
    color: Colors.text.inverse,
  },
  dietaryList: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  dietaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 4,
    backgroundColor: Colors.background,
  },
  activeDietaryButton: {
    backgroundColor: `${Colors.primary}20`,
  },
  dietaryText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.text.secondary,
  },
  activeDietaryText: {
    color: Colors.primary,
  },
  collectionsWrapper: {
    flex: 1,
  },
  collectionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  collectionsTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text.primary,
  },
  carouselControls: {
    flexDirection: 'row',
    gap: 8,
  },
  carouselButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  collectionsCarouselContainer: {
    flex: 1,
  },
  collectionsContainer: {
    paddingLeft: 16,
    paddingRight: 16,
  },
  collectionContainer: {
    width: width * 0.85,
    marginRight: 16,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
  },
  collectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  collectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
  },
  viewMoreText: {
    fontSize: 14,
    color: Colors.primary,
  },
  collectionRecipesList: {
    paddingRight: 16,
  },
  collectionRecipeCard: {
    width: 140,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  collectionRecipeImage: {
    width: '100%',
    height: 100,
    resizeMode: 'cover',
  },
  collectionRecipeContent: {
    padding: 8,
  },
  collectionRecipeTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  collectionRecipeCalories: {
    fontSize: 10,
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
  recipesList: {
    padding: 16,
    paddingBottom: 80, // Extra padding for bottom navigation
  },
  recipeCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  recipeImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  bookmarkButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeContent: {
    padding: 16,
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginBottom: 8,
  },
  recipeMetaContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  recipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  recipeMetaText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: 4,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagBadge: {
    marginRight: 8,
    marginBottom: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.card,
  },
});