import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Search, X, Clock } from 'lucide-react-native';
import Colors from '@/constants/colors';
import FoodItem from '@/components/FoodItem';
import { useNutritionStore } from '@/store/nutritionStore';
import { searchFoods, testPassioConnection, getAvailableTools } from '@/services/passioService';
import { FoodItem as FoodItemType } from '@/types';

export default function SearchFoodScreen() {
  const { mealId, scannedFood } = useLocalSearchParams();
  const { addFoodToMeal, recentFoods: storeRecentFoods } = useNutritionStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItemType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMealId, setSelectedMealId] = useState(mealId?.toString() || 'breakfast');
  const [scannedFoodData, setScannedFoodData] = useState<FoodItemType | null>(null);
  
  // Default mock data for recent and common foods if store doesn't have any
  const defaultRecentFoods: FoodItemType[] = [
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
  
  const favoriteFood: FoodItemType[] = [
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
  
  const meals = [
    { id: 'breakfast', name: 'Breakfast' },
    { id: 'lunch', name: 'Lunch' },
    { id: 'dinner', name: 'Dinner' },
    { id: 'snack', name: 'Snack' },
  ];
  
  useEffect(() => {
    // Handle scanned food data
    if (scannedFood) {
      try {
        const foodData = JSON.parse(scannedFood as string);
        const formattedFood: FoodItemType = {
          id: `scanned-${Date.now()}`,
          name: foodData.name,
          servingSize: foodData.servingSize || '100g',
          calories: foodData.calories,
          protein: foodData.protein,
          carbs: foodData.carbs,
          fat: foodData.fat,
          imageUrl: foodData.imageUrl
        };
        setScannedFoodData(formattedFood);
      } catch (error) {
        console.error('Failed to parse scanned food data:', error);
      }
    }
    
    // Test Passio connection on component mount
    testPassioConnection().then(result => {
      console.log('Passio API Test:', result);
    });
    
    // Debounced search
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length > 2) {
        handleSearch();
      }
    }, 500);
    
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, scannedFood]);
  
  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) return;
    
    setIsLoading(true);
    try {
      const results = await searchFoods(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching foods:', error);
      // Provide mock results if API fails
      setSearchResults([
        {
          id: `search-${Date.now()}-1`,
          name: `${searchQuery} (mock)`,
          servingSize: '100g',
          calories: 150,
          protein: 10,
          carbs: 15,
          fat: 5
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAddFood = (food: FoodItemType) => {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Add food to the selected meal
    addFoodToMeal(today, selectedMealId, food);
    
    // Navigate back to nutrition screen
    router.back();
  };
  
  const testPassioAPI = async () => {
    console.log('Testing Passio API...');
    const connectionTest = await testPassioConnection();
    console.log('Connection test:', connectionTest);
    
    const tools = await getAvailableTools();
    console.log('Available tools:', tools);
    
    // Test search
    const searchTest = await searchFoods('apple');
    console.log('Search test results:', searchTest);
  };
  
  const renderFoodItem = ({ item }: { item: FoodItemType }) => (
    <FoodItem
      food={item}
      onPress={() => router.push(`/nutrition/food/${item.id}`)}
      onAdd={() => handleAddFood(item)}
    />
  );
  
  // Use recent foods from store or default if empty
  const recentFoods = storeRecentFoods && storeRecentFoods.length > 0 
    ? storeRecentFoods 
    : defaultRecentFoods;
  
  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Search Foods',
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => router.back()}
              style={styles.closeButton}
            >
              <X size={24} color={Colors.text.primary} />
            </TouchableOpacity>
          ),
        }} 
      />
      
      <View style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={20} color={Colors.text.secondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for foods..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={Colors.text.tertiary}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <X size={16} color={Colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Meal Selector */}
        <View style={styles.mealSelectorContainer}>
          <Text style={styles.mealSelectorLabel}>Add to:</Text>
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
        </View>
        
        {/* Scanned Food Result */}
        {scannedFoodData && (
          <View style={styles.scannedContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Scanned Food</Text>
            </View>
            <FoodItem
              food={scannedFoodData}
              onPress={() => router.push(`/nutrition/food/${scannedFoodData.id}`)}
              onAdd={() => handleAddFood(scannedFoodData)}
              showAddButton={true}
            />
            <TouchableOpacity 
              style={styles.dismissButton}
              onPress={() => setScannedFoodData(null)}
            >
              <Text style={styles.dismissButtonText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Search Results or Recent Foods */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        ) : searchQuery.length > 0 ? (
          <FlatList
            data={searchResults}
            renderItem={renderFoodItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <Text style={styles.resultsHeader}>
                {searchResults.length} results for &quot;{searchQuery}&quot;
              </Text>
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No results found. Try a different search term.
                </Text>
              </View>
            }
          />
        ) : (
          <>
            {/* Recent Foods - Fixed null check */}
            {recentFoods && recentFoods.length > 0 ? (
              <View style={styles.recentContainer}>
                <View style={styles.sectionHeader}>
                  <Clock size={16} color={Colors.text.secondary} />
                  <Text style={styles.sectionTitle}>Recent Foods</Text>
                </View>
                
                <FlatList
                  data={recentFoods.slice(0, 5)}
                  renderItem={renderFoodItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              </View>
            ) : null}
            
            {/* Favorite Foods */}
            {favoriteFood && favoriteFood.length > 0 ? (
              <View style={styles.favoritesContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Favorites</Text>
                </View>
                
                <FlatList
                  data={favoriteFood}
                  renderItem={renderFoodItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              </View>
            ) : null}
            
            {/* Common Foods */}
            <View style={styles.commonContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Common Foods</Text>
              </View>
              
              <View style={styles.commonFoods}>
                {['Apple', 'Banana', 'Chicken', 'Egg', 'Rice', 'Broccoli', 'Salmon', 'Oatmeal'].map(food => (
                  <TouchableOpacity
                    key={food}
                    style={styles.commonFoodButton}
                    onPress={() => setSearchQuery(food)}
                  >
                    <Text style={styles.commonFoodText}>{food}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              {/* Debug button for testing Passio API */}
              <TouchableOpacity
                style={[styles.commonFoodButton, { backgroundColor: Colors.primary }]}
                onPress={testPassioAPI}
              >
                <Text style={[styles.commonFoodText, { color: 'white' }]}>Test Passio API</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  closeButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: Colors.text.primary,
  },
  clearButton: {
    padding: 8,
  },
  mealSelectorContainer: {
    backgroundColor: Colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  mealSelectorLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  mealButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text.secondary,
  },
  listContent: {
    padding: 16,
  },
  resultsHeader: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 16,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  recentContainer: {
    padding: 16,
  },
  favoritesContainer: {
    padding: 16,
    paddingTop: 0,
  },
  commonContainer: {
    padding: 16,
    paddingTop: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 8,
  },
  commonFoods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  commonFoodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  commonFoodText: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  scannedContainer: {
    backgroundColor: Colors.success + '10',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dismissButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  dismissButtonText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textDecorationLine: 'underline',
  },
});