import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import recipeExtractionService from '@/services/recipeExtractionService';

const STORAGE_KEYS = {
  RECIPES: '@recipes_saved',
  GROCERY_LIST: '@grocery_list'
};

export const useRecipeStore = create((set, get) => ({
  savedRecipes: [],
  groceryList: [],
  isLoading: false,
  error: null,

  addRecipe: async (recipeData) => {
    try {
      set({ isLoading: true, error: null });
      
      const newRecipe = {
        id: Date.now().toString(),
        name: recipeData.name,
        title: recipeData.name,
        description: recipeData.description,
        prepTime: recipeData.prepTime || 30,
        cookTime: recipeData.cookTime || 30,
        servings: recipeData.servings || 4,
        difficulty: recipeData.difficulty || 'medium',
        category: recipeData.category || 'dinner',
        tags: recipeData.tags || [],
        dietaryTags: recipeData.dietaryTags || [],
        imageUrl: recipeData.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
        image: recipeData.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
        ingredients: recipeData.ingredients,
        instructions: recipeData.instructions,
        nutrition: {
          calories: 400,
          protein: 25,
          carbs: 30,
          fat: 15,
          fiber: 5
        },
        calories: 400,
        protein: 25,
        carbs: 30,
        fat: 15,
        rating: 4.5,
        reviewCount: 0,
        dateAdded: new Date().toISOString(),
        sourceUrl: recipeData.sourceUrl,
        sourcePlatform: recipeData.sourcePlatform,
        author: recipeData.author,
        isFavorite: false,
        addedToGroceryList: false
      };

      const { savedRecipes } = get();
      const updatedRecipes = [...savedRecipes, newRecipe];
      
      set({ savedRecipes: updatedRecipes, isLoading: false });
      await get().saveData();
      
      console.log('Recipe added successfully:', newRecipe.name);
    } catch (error) {
      console.error('Error adding recipe:', error);
      set({ error: 'Failed to add recipe', isLoading: false });
    }
  },

  removeRecipe: (recipeId) => {
    const { savedRecipes } = get();
    const updatedRecipes = savedRecipes.filter(recipe => recipe.id !== recipeId);
    set({ savedRecipes: updatedRecipes });
    get().saveData();
  },

  toggleFavorite: (recipeId) => {
    const { savedRecipes } = get();
    const updatedRecipes = savedRecipes.map(recipe =>
      recipe.id === recipeId ? { ...recipe, isFavorite: !recipe.isFavorite } : recipe
    );
    set({ savedRecipes: updatedRecipes });
    get().saveData();
  },

  updateRecipe: (recipeId, updates) => {
    const { savedRecipes } = get();
    const updatedRecipes = savedRecipes.map(recipe =>
      recipe.id === recipeId ? { ...recipe, ...updates } : recipe
    );
    set({ savedRecipes: updatedRecipes });
    get().saveData();
  },

  generateGroceryList: (recipeIds) => {
    const { savedRecipes } = get();
    const selectedRecipes = savedRecipes.filter(recipe => recipeIds.includes(recipe.id));
    
    const groceryItems = recipeExtractionService.generateGroceryList(selectedRecipes);
    
    const groceryList = groceryItems.map((item, index) => ({
      id: `grocery_${index}_${Date.now()}`,
      ingredient: item.ingredient,
      amount: item.amount,
      unit: item.unit,
      recipes: item.recipes,
      checked: false,
      category: categorizeIngredient(item.ingredient)
    }));

    set({ groceryList });
    get().saveData();
  },

  addToGroceryList: (recipeId) => {
    const { savedRecipes } = get();
    get().generateGroceryList([recipeId]);
    
    // Mark recipe as added to grocery list
    const updatedRecipes = savedRecipes.map(recipe =>
      recipe.id === recipeId ? { ...recipe, addedToGroceryList: true } : recipe
    );
    set({ savedRecipes: updatedRecipes });
    get().saveData();
  },

  removeFromGroceryList: (recipeId) => {
    const { groceryList, savedRecipes } = get();
    const recipe = savedRecipes.find(r => r.id === recipeId);
    
    if (recipe) {
      // Remove items that only belong to this recipe
      const updatedGroceryList = groceryList.filter(item => 
        !item.recipes.includes(recipe.name) || item.recipes.length > 1
      ).map(item => ({
        ...item,
        recipes: item.recipes.filter(recipeName => recipeName !== recipe.name)
      }));

      // Mark recipe as removed from grocery list
      const updatedRecipes = savedRecipes.map(r =>
        r.id === recipeId ? { ...r, addedToGroceryList: false } : r
      );

      set({ groceryList: updatedGroceryList, savedRecipes: updatedRecipes });
      get().saveData();
    }
  },

  toggleGroceryItem: (itemId) => {
    const { groceryList } = get();
    const updatedList = groceryList.map(item =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    set({ groceryList: updatedList });
    get().saveData();
  },

  clearGroceryList: () => {
    const { savedRecipes } = get();
    const updatedRecipes = savedRecipes.map(recipe => ({
      ...recipe,
      addedToGroceryList: false
    }));
    
    set({ groceryList: [], savedRecipes: updatedRecipes });
    get().saveData();
  },

  removeGroceryItem: (itemId) => {
    const { groceryList } = get();
    const updatedList = groceryList.filter(item => item.id !== itemId);
    set({ groceryList: updatedList });
    get().saveData();
  },

  loadData: async () => {
    try {
      set({ isLoading: true });
      
      const [recipesData, groceryData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.RECIPES),
        AsyncStorage.getItem(STORAGE_KEYS.GROCERY_LIST)
      ]);

      const savedRecipes = recipesData ? JSON.parse(recipesData) : [];
      const groceryList = groceryData ? JSON.parse(groceryData) : [];

      set({ savedRecipes, groceryList, isLoading: false });
    } catch (error) {
      console.error('Error loading recipe data:', error);
      set({ error: 'Failed to load data', isLoading: false });
    }
  },

  saveData: async () => {
    try {
      const { savedRecipes, groceryList } = get();
      
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.RECIPES, JSON.stringify(savedRecipes)),
        AsyncStorage.setItem(STORAGE_KEYS.GROCERY_LIST, JSON.stringify(groceryList))
      ]);
    } catch (error) {
      console.error('Error saving recipe data:', error);
    }
  }
}));

// Helper function to categorize ingredients
function categorizeIngredient(ingredient) {
  const lowerIngredient = ingredient.toLowerCase();
  
  if (lowerIngredient.includes('milk') || lowerIngredient.includes('cheese') || 
      lowerIngredient.includes('yogurt') || lowerIngredient.includes('butter') ||
      lowerIngredient.includes('cream')) {
    return 'Dairy';
  }
  
  if (lowerIngredient.includes('chicken') || lowerIngredient.includes('beef') || 
      lowerIngredient.includes('pork') || lowerIngredient.includes('fish') ||
      lowerIngredient.includes('salmon') || lowerIngredient.includes('turkey')) {
    return 'Meat & Seafood';
  }
  
  if (lowerIngredient.includes('apple') || lowerIngredient.includes('banana') || 
      lowerIngredient.includes('orange') || lowerIngredient.includes('berry') ||
      lowerIngredient.includes('lemon') || lowerIngredient.includes('lime')) {
    return 'Fruits';
  }
  
  if (lowerIngredient.includes('lettuce') || lowerIngredient.includes('spinach') || 
      lowerIngredient.includes('broccoli') || lowerIngredient.includes('carrot') ||
      lowerIngredient.includes('onion') || lowerIngredient.includes('tomato')) {
    return 'Vegetables';
  }
  
  if (lowerIngredient.includes('bread') || lowerIngredient.includes('rice') || 
      lowerIngredient.includes('pasta') || lowerIngredient.includes('flour') ||
      lowerIngredient.includes('oats') || lowerIngredient.includes('quinoa')) {
    return 'Grains & Bread';
  }
  
  if (lowerIngredient.includes('beans') || lowerIngredient.includes('lentils') || 
      lowerIngredient.includes('chickpeas') || lowerIngredient.includes('nuts') ||
      lowerIngredient.includes('seeds')) {
    return 'Pantry';
  }
  
  return 'Other';
}