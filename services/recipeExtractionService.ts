import { Platform } from 'react-native';

import * as Clipboard from 'expo-clipboard';
import { Recipe, RecipeIngredient } from '@/types';

export interface SocialMediaRecipeData {
  url: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'pinterest' | 'other';
  title?: string;
  description?: string;
  imageUrl?: string;
  videoUrl?: string;
  author?: string;
  duration?: number;
}

export interface ExtractedRecipeData {
  name: string;
  description: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  category?: string;
  tags?: string[];
  dietaryTags?: string[];
  imageUrl?: string;
  sourceUrl?: string;
  sourcePlatform?: string;
  author?: string;
}

class RecipeExtractionService {
  private readonly AI_API_URL = 'https://toolkit.rork.com/text/llm/';

  async extractRecipeFromUrl(url: string): Promise<ExtractedRecipeData | null> {
    try {
      console.log('Extracting recipe from URL:', url);
      
      // Detect platform
      const platform = this.detectPlatform(url);
      console.log('Detected platform:', platform);
      
      // Get metadata from URL
      const metadata = await this.getUrlMetadata(url);
      console.log('URL metadata:', metadata);
      
      // Extract recipe using AI
      const extractedRecipe = await this.extractRecipeWithAI(metadata, url, platform);
      
      if (extractedRecipe) {
        console.log('Successfully extracted recipe:', extractedRecipe.name);
        return {
          ...extractedRecipe,
          sourceUrl: url,
          sourcePlatform: platform,
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting recipe from URL:', error);
      return null;
    }
  }

  async extractRecipeFromText(text: string): Promise<ExtractedRecipeData | null> {
    try {
      console.log('Extracting recipe from text');
      
      const extractedRecipe = await this.extractRecipeWithAI({ 
        url: '', 
        platform: 'other', 
        description: text 
      }, '', 'other');
      
      if (extractedRecipe) {
        console.log('Successfully extracted recipe from text:', extractedRecipe.name);
        return extractedRecipe;
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting recipe from text:', error);
      return null;
    }
  }

  async handleSharedContent(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        // On web, try to get from clipboard
        const clipboardContent = await Clipboard.getStringAsync();
        if (this.isValidUrl(clipboardContent)) {
          return clipboardContent;
        }
        return clipboardContent;
      } else {
        // On mobile, this would be called from a share extension
        // For now, we'll use clipboard as fallback
        const clipboardContent = await Clipboard.getStringAsync();
        if (this.isValidUrl(clipboardContent)) {
          return clipboardContent;
        }
        return clipboardContent;
      }
    } catch (error) {
      console.error('Error handling shared content:', error);
      return null;
    }
  }

  private detectPlatform(url: string): string {
    const domain = url.toLowerCase();
    
    if (domain.includes('instagram.com') || domain.includes('instagr.am')) {
      return 'instagram';
    } else if (domain.includes('tiktok.com')) {
      return 'tiktok';
    } else if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
      return 'youtube';
    } else if (domain.includes('facebook.com') || domain.includes('fb.com')) {
      return 'facebook';
    } else if (domain.includes('pinterest.com') || domain.includes('pin.it')) {
      return 'pinterest';
    } else {
      return 'other';
    }
  }

  private async getUrlMetadata(url: string): Promise<SocialMediaRecipeData> {
    try {
      // For web compatibility, we'll use a simple fetch approach
      // In a real app, you might use a metadata extraction service
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)'
        }
      });
      
      const html = await response.text();
      
      // Extract basic metadata from HTML
      const title = this.extractMetaTag(html, 'og:title') || this.extractTitle(html);
      const description = this.extractMetaTag(html, 'og:description') || this.extractMetaTag(html, 'description');
      const imageUrl = this.extractMetaTag(html, 'og:image');
      const videoUrl = this.extractMetaTag(html, 'og:video');
      
      return {
        url,
        platform: this.detectPlatform(url) as any,
        title,
        description,
        imageUrl,
        videoUrl
      };
    } catch (error) {
      console.error('Error getting URL metadata:', error);
      return {
        url,
        platform: this.detectPlatform(url) as any
      };
    }
  }

  private extractMetaTag(html: string, property: string): string | undefined {
    const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i');
    const match = html.match(regex);
    return match ? match[1] : undefined;
  }

  private extractTitle(html: string): string | undefined {
    const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    return match ? match[1] : undefined;
  }

  private async extractRecipeWithAI(metadata: SocialMediaRecipeData, url: string, platform: string): Promise<ExtractedRecipeData | null> {
    try {
      const prompt = `
Analyze the following content and extract a complete recipe if one exists. The content is from ${platform}.

Content:
Title: ${metadata.title || 'N/A'}
Description: ${metadata.description || 'N/A'}
URL: ${url}

Please extract and return a JSON object with the following structure if a recipe is found:
{
  "name": "Recipe name",
  "description": "Brief description",
  "ingredients": [
    {
      "id": "1",
      "name": "ingredient name with amount",
      "amount": number,
      "unit": "unit of measurement"
    }
  ],
  "instructions": ["step 1", "step 2", ...],
  "prepTime": minutes (number),
  "cookTime": minutes (number),
  "servings": number,
  "difficulty": "easy|medium|hard",
  "category": "breakfast|lunch|dinner|snack|dessert",
  "tags": ["tag1", "tag2"],
  "dietaryTags": ["vegetarian", "vegan", "gluten-free", etc],
  "imageUrl": "${metadata.imageUrl || ''}",
  "author": "author name if available"
}

If no recipe is found, return null. Only return valid JSON.
`;

      const response = await fetch(this.AI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      const completion = data.completion;

      // Try to parse the JSON response
      try {
        const jsonMatch = completion.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const recipeData = JSON.parse(jsonMatch[0]);
          
          // Validate the extracted data
          if (recipeData && recipeData.name && recipeData.ingredients && recipeData.instructions) {
            return recipeData;
          }
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
      }

      return null;
    } catch (error) {
      console.error('Error extracting recipe with AI:', error);
      return null;
    }
  }

  private isValidUrl(string: string): boolean {
    try {
      new URL(string);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Generate grocery list from recipes
  generateGroceryList(recipes: Recipe[]): { ingredient: string; amount: number; unit: string; recipes: string[] }[] {
    const groceryMap = new Map<string, { amount: number; unit: string; recipes: Set<string> }>();

    recipes.forEach(recipe => {
      recipe.ingredients.forEach(ingredient => {
        const key = ingredient.name.toLowerCase().trim();
        
        if (groceryMap.has(key)) {
          const existing = groceryMap.get(key)!;
          // If same unit, add amounts; otherwise, keep separate entries
          if (existing.unit === ingredient.unit) {
            existing.amount += ingredient.amount;
          }
          existing.recipes.add(recipe.name);
        } else {
          groceryMap.set(key, {
            amount: ingredient.amount,
            unit: ingredient.unit,
            recipes: new Set([recipe.name])
          });
        }
      });
    });

    return Array.from(groceryMap.entries()).map(([ingredient, data]) => ({
      ingredient,
      amount: data.amount,
      unit: data.unit,
      recipes: Array.from(data.recipes)
    }));
  }
}

export default new RecipeExtractionService();