// Passio.ai API Configuration
const PASSIO_API_KEY = '9zR4qIXKlWdjb3PXfRjFFkCBJrNNoHGHb69MNcI5';
const PASSIO_BASE_URL = 'https://api.passiolife.com/v2';

// Token management
let accessToken = null;
let customerId = null;
let tokenExpiry = 0;

// Cache for API responses
let searchCache = new Map();
let foodCache = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
let lastCacheTime = 0;

// Get or refresh access token
const getAccessToken = async () => {
  // Return cached token if still valid
  if (accessToken && customerId && Date.now() < tokenExpiry) {
    return { token: accessToken, customerId: customerId };
  }

  try {
    const response = await fetch(`${PASSIO_BASE_URL}/token-cache/napi/oauth/token/${PASSIO_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Token request failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.access_token || !data.customer_id) {
      throw new Error('Failed to obtain access token or customer ID from response');
    }
    
    accessToken = data.access_token;
    customerId = data.customer_id;
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 minute early
    
    return { token: accessToken, customerId: customerId };
  } catch (error) {
    console.error('Failed to get access token:', error);
    // Return mock data on token failure
    throw error;
  }
};

// Convert Passio API response to FoodItem format
const convertPassioToFoodItem = (passioFood) => {
  const nutrition = passioFood.nutrition || passioFood.nutritionPer100g || {};
  const servingSize = passioFood.servingSize || passioFood.serving_size || '100g';
  
  return {
    id: passioFood.passioID || passioFood.refCode || passioFood.id || Math.random().toString(),
    name: passioFood.name || passioFood.foodName || passioFood.displayName || 'Unknown Food',
    servingSize: typeof servingSize === 'string' ? servingSize : `${servingSize.quantity || 100}${servingSize.unit || 'g'}`,
    calories: Math.round(nutrition.calories || nutrition.energy || nutrition.kcal || 0),
    protein: Math.round((nutrition.protein || nutrition.proteins || 0) * 10) / 10,
    carbs: Math.round((nutrition.carbs || nutrition.carbohydrates || nutrition.carbohydrate || 0) * 10) / 10,
    fat: Math.round((nutrition.fat || nutrition.totalFat || nutrition.fats || 0) * 10) / 10,
    fiber: Math.round((nutrition.fiber || nutrition.dietaryFiber || nutrition.fibre || 0) * 10) / 10,
    sugar: Math.round((nutrition.sugar || nutrition.sugars || nutrition.totalSugars || 0) * 10) / 10,
    sodium: Math.round((nutrition.sodium || 0) * 10) / 10,
    imageUrl: passioFood.imageUrl || passioFood.image || passioFood.iconUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
    nutritionalScore: {
      score: calculateNutritionalScore(nutrition)
    },
    nutritionalDetails: {
      saturatedFat: Math.round((nutrition.saturatedFat || nutrition.saturatedFats || 0) * 10) / 10,
      sugar: Math.round((nutrition.sugar || nutrition.sugars || nutrition.totalSugars || 0) * 10) / 10,
      fiber: Math.round((nutrition.fiber || nutrition.dietaryFiber || nutrition.fibre || 0) * 10) / 10,
      sodium: Math.round((nutrition.sodium || 0) * 10) / 10
    }
  };
};

// Calculate nutritional score based on nutrition data
const calculateNutritionalScore = (nutrition) => {
  const calories = nutrition.calories || 0;
  const protein = nutrition.protein || 0;
  const fiber = nutrition.fiber || nutrition.dietaryFiber || 0;
  const saturatedFat = nutrition.saturatedFat || 0;
  const sugar = nutrition.sugar || nutrition.sugars || 0;
  const sodium = nutrition.sodium || 0;

  let score = 0;
  
  // Positive factors
  if (protein > 10) score += 2;
  else if (protein > 5) score += 1;
  
  if (fiber > 5) score += 2;
  else if (fiber > 2) score += 1;
  
  // Negative factors
  if (saturatedFat > 5) score -= 2;
  else if (saturatedFat > 2) score -= 1;
  
  if (sugar > 15) score -= 2;
  else if (sugar > 8) score -= 1;
  
  if (sodium > 400) score -= 2;
  else if (sodium > 200) score -= 1;
  
  if (calories > 300) score -= 1;
  
  if (score >= 2) return 'A';
  if (score >= 0) return 'B';
  if (score >= -2) return 'C';
  if (score >= -4) return 'D';
  return 'E';
};

// Search foods using Passio API
export const searchFoods = async (query) => {
  if (!query.trim()) return [];
  
  // Clear cache if expired
  if (Date.now() - lastCacheTime > CACHE_EXPIRY) {
    searchCache.clear();
    lastCacheTime = Date.now();
  }
  
  // Check cache first
  const cacheKey = query.toLowerCase().trim();
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey);
  }
  
  try {
    const { token, customerId: customerIdValue } = await getAccessToken();
    
    // Start a conversation thread with the nutrition advisor
    const threadResponse = await fetch(`${PASSIO_BASE_URL}/products/nutrition-advisor/threads?plainText=true`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Passio-ID': customerIdValue,
        'Content-Type': 'application/json',
      },
    });

    if (!threadResponse.ok) {
      throw new Error(`Thread creation failed: ${threadResponse.status}`);
    }

    const threadData = await threadResponse.json();
    const threadId = threadData.threadId;

    // Send a message to search for food with content tool hints
    const messageResponse = await fetch(`${PASSIO_BASE_URL}/products/nutrition-advisor/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Passio-ID': customerIdValue,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Find nutritional information for: ${query}`,
        inputSensors: []
      })
    });

    if (!messageResponse.ok) {
      throw new Error(`Search request failed: ${messageResponse.status}`);
    }

    const data = await messageResponse.json();
    
    // Handle the advisor response
    let results = [];
    
    // Check if we should run SearchIngredientMatches tool
    if (data.content && data.contentToolHints && data.contentToolHints.includes('SearchIngredientMatches')) {
      // Run the SearchIngredientMatches tool
      const toolResponse = await fetch(`${PASSIO_BASE_URL}/products/nutrition-advisor/threads/${threadId}/messages/tools/target/SearchIngredientMatches`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Passio-ID': customerIdValue,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId: data.messageId
        })
      });
      
      if (toolResponse.ok) {
        const toolData = await toolResponse.json();
        if (toolData.actionResponse && toolData.actionResponse.data) {
          const ingredientData = JSON.parse(toolData.actionResponse.data);
          results = ingredientData.map(convertPassioToFoodItem);
        }
      }
    }
    
    // If no results from API, use fallback
    if (results.length === 0) {
      results = getMockFallback().filter(food => 
        food.name.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    // Cache results
    searchCache.set(cacheKey, results);
    
    return results;
  } catch (error) {
    console.error('Food search failed:', error);
    
    // Return fallback mock data on error
    const mockResults = getMockFallback().filter(food => 
      food.name.toLowerCase().includes(cacheKey)
    );
    
    searchCache.set(cacheKey, mockResults);
    return mockResults;
  }
};

// Get food by ID using Passio API
export const getFoodById = async (id) => {
  // Check cache first
  if (foodCache.has(id)) {
    return foodCache.get(id);
  }
  
  try {
    // For reference codes, we would need a specific endpoint
    // For now, fallback to mock data since we don't have a direct food-by-id endpoint
    const mockFood = getMockFallback().find(food => food.id === id);
    if (mockFood) {
      foodCache.set(id, mockFood);
      return mockFood;
    }
    
    return null;
  } catch (error) {
    console.error('Get food by ID failed:', error);
    
    // Return fallback mock data on error
    const mockFood = getMockFallback().find(food => food.id === id);
    if (mockFood) {
      foodCache.set(id, mockFood);
      return mockFood;
    }
    
    return null;
  }
};

// Get available tools from Passio API
export const getAvailableTools = async () => {
  try {
    const { token, customerId: customerIdValue } = await getAccessToken();
    
    const response = await fetch(`${PASSIO_BASE_URL}/products/nutrition-advisor/tools`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Passio-ID': customerIdValue,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Tools request failed: ${response.status}`);
    }

    const tools = await response.json();
    console.log('Available Passio tools:', tools);
    return tools;
  } catch (error) {
    console.error('Failed to get available tools:', error);
    return [];
  }
};

// Test Passio API connection
export const testPassioConnection = async () => {
  try {
    const { token, customerId: customerIdValue } = await getAccessToken();
    
    // Test by getting available tools
    const tools = await getAvailableTools();
    
    if (tools && tools.length > 0) {
      return {
        success: true,
        message: `Successfully connected to Passio API. Found ${tools.length} available tools.`
      };
    } else {
      return {
        success: false,
        message: 'Connected to Passio API but no tools found.'
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to connect to Passio API: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

// Enhanced mock data with more variety for better fallback experience
const getMockFallback = () => [
  {
    id: '1',
    name: 'Chicken Breast',
    servingSize: '100g',
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    fiber: 0,
    sugar: 0,
    sodium: 74,
    imageUrl: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=500',
    nutritionalScore: { score: 'A' },
    nutritionalDetails: { saturatedFat: 1, sugar: 0, fiber: 0, sodium: 74 }
  },
  {
    id: '2',
    name: 'Brown Rice',
    servingSize: '100g cooked',
    calories: 112,
    protein: 2.6,
    carbs: 23,
    fat: 0.9,
    fiber: 1.8,
    sugar: 0.4,
    sodium: 5,
    imageUrl: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=500',
    nutritionalScore: { score: 'B' },
    nutritionalDetails: { saturatedFat: 0.2, sugar: 0.4, fiber: 1.8, sodium: 5 }
  },
  {
    id: '3',
    name: 'Avocado',
    servingSize: '1 medium',
    calories: 240,
    protein: 3,
    carbs: 12,
    fat: 22,
    fiber: 10,
    sugar: 1,
    sodium: 10,
    imageUrl: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=500',
    nutritionalScore: { score: 'B' },
    nutritionalDetails: { saturatedFat: 3.1, sugar: 1, fiber: 10, sodium: 10 }
  },
  {
    id: '4',
    name: 'Banana',
    servingSize: '1 medium',
    calories: 105,
    protein: 1.3,
    carbs: 27,
    fat: 0.4,
    fiber: 3.1,
    sugar: 14,
    sodium: 1,
    imageUrl: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=500',
    nutritionalScore: { score: 'B' },
    nutritionalDetails: { saturatedFat: 0.1, sugar: 14, fiber: 3.1, sodium: 1 }
  },
  {
    id: '5',
    name: 'Egg',
    servingSize: '1 large',
    calories: 72,
    protein: 6.3,
    carbs: 0.4,
    fat: 5,
    fiber: 0,
    sugar: 0.2,
    sodium: 71,
    imageUrl: 'https://images.unsplash.com/photo-1607690424560-5e6f6f4874d2?w=500',
    nutritionalScore: { score: 'A' },
    nutritionalDetails: { saturatedFat: 1.6, sugar: 0.2, fiber: 0, sodium: 71 }
  },
  {
    id: '6',
    name: 'Salmon',
    servingSize: '100g',
    calories: 208,
    protein: 25.4,
    carbs: 0,
    fat: 12.4,
    fiber: 0,
    sugar: 0,
    sodium: 59,
    imageUrl: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500',
    nutritionalScore: { score: 'A' },
    nutritionalDetails: { saturatedFat: 3.1, sugar: 0, fiber: 0, sodium: 59 }
  },
  {
    id: '7',
    name: 'Quinoa',
    servingSize: '100g cooked',
    calories: 120,
    protein: 4.4,
    carbs: 22,
    fat: 1.9,
    fiber: 2.8,
    sugar: 0.9,
    sodium: 7,
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500',
    nutritionalScore: { score: 'A' },
    nutritionalDetails: { saturatedFat: 0.2, sugar: 0.9, fiber: 2.8, sodium: 7 }
  },
  {
    id: '8',
    name: 'Greek Yogurt',
    servingSize: '100g',
    calories: 97,
    protein: 9,
    carbs: 3.6,
    fat: 5,
    fiber: 0,
    sugar: 3.6,
    sodium: 36,
    imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500',
    nutritionalScore: { score: 'A' },
    nutritionalDetails: { saturatedFat: 3.1, sugar: 3.6, fiber: 0, sodium: 36 }
  },
  {
    id: '9',
    name: 'Sweet Potato',
    servingSize: '1 medium baked',
    calories: 112,
    protein: 2,
    carbs: 26,
    fat: 0.1,
    fiber: 3.9,
    sugar: 5.4,
    sodium: 6,
    imageUrl: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500',
    nutritionalScore: { score: 'A' },
    nutritionalDetails: { saturatedFat: 0.1, sugar: 5.4, fiber: 3.9, sodium: 6 }
  },
  {
    id: '10',
    name: 'Spinach',
    servingSize: '100g raw',
    calories: 23,
    protein: 2.9,
    carbs: 3.6,
    fat: 0.4,
    fiber: 2.2,
    sugar: 0.4,
    sodium: 79,
    imageUrl: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=500',
    nutritionalScore: { score: 'A' },
    nutritionalDetails: { saturatedFat: 0.1, sugar: 0.4, fiber: 2.2, sodium: 79 }
  }
];