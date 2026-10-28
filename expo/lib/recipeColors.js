// lib/recipeColors.js
//
// The colours the Nutrition screen and the Home Macros card give protein, carbs and fat (lib/macroWeightData.js). The Recipes
// screen draws a recipe's macros in the same colours so a person reads them the same way everywhere. __tests__/recipePicks.test.js
// fails if these ever drift from the ones on Home.
export const MACRO_COLORS = { protein: '#3B82F6', carbs: '#F97316', fat: '#A855F7' };
