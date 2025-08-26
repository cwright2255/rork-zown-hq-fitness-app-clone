import { FoodItem } from '@/types';

// Mock API for Passio.ai service
const API_URL = 'https://api.passio.ai/v1';
const API_KEY = 'your_passio_api_key_here';

// Function to search for food items using Passio.ai
export async function searchFoods(query: string): Promise<FoodItem[]> {
  try {
    const response = await fetch(`${API_URL}/food/search?query=${encodeURIComponent(query)}&apiKey=${encodeURIComponent(API_KEY)}`);
    const data = await response.json();
    return data.results.map((item: any) => ({
      id: item.id,
      name: item.name,
      calories: item.nutrition.calories || 0,
      protein: item.nutrition.protein || 0,
      carbs: item.nutrition.carbs || 0,
      fat: item.nutrition.fat || 0,
      servingSize: item.servingSize || '1 serving',
    }));
  } catch (error) {
    console.error('Food search failed:', error);
    // Return fallback mock data on error
    return getMockFallback().filter(item => 
      item.name.toLowerCase().includes(query.toLowerCase())
    );
  }
}

// Mock fallback data
function getMockFallback(): FoodItem[] {
  return [
    { id: '1', name: 'Apple', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, servingSize: '1 medium' },
    { id: '2', name: 'Banana', calories: 105, protein: 1.3, carbs: 27, fat: 0.3, servingSize: '1 medium' },
    { id: '3', name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 3.6, servingSize: '100g' },
    { id: '4', name: 'Salmon', calories: 280, protein: 34, carbs: 0, fat: 13, servingSize: '100g' },
    { id: '5', name: 'Rice', calories: 205, protein: 4.3, carbs: 45, fat: 0.4, servingSize: '1 cup' },
  ];
}

// Function to get food details by ID
export async function getFoodDetails(id: string): Promise<FoodItem | null> {
  try {
    const response = await fetch(`${API_URL}/food/${id}?apiKey=${encodeURIComponent(API_KEY)}`);
    const item = await response.json();
    // Data is already extracted from response
    return {
      id: item.id,
      name: item.name,
      calories: item.nutrition.calories || 0,
      protein: item.nutrition.protein || 0,
      carbs: item.nutrition.carbs || 0,
      fat: item.nutrition.fat || 0,
      servingSize: item.servingSize || '1 serving',
    };
  } catch (error) {
    console.error('Failed to fetch food details:', error);
    return null;
  }
}
