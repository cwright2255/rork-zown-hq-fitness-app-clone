import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';
import Card from './Card';
import ProgressBar from './ProgressBar';
import { useNutritionStore } from '@/store/nutritionStore';

interface NutritionSummaryProps {
  date?: string;
  calories?: {
    consumed: number;
    goal: number;
  };
  macros?: {
    protein: {
      consumed: number;
      goal: number;
    };
    carbs: {
      consumed: number;
      goal: number;
    };
    fat: {
      consumed: number;
      goal: number;
    };
  };
  nutritionalScore?: {
    score: 'A' | 'B' | 'C' | 'D' | 'E';
    averagePoints: number;
  };
}

const NutritionSummary: React.FC<NutritionSummaryProps> = ({
  date,
  calories: propCalories,
  macros: propMacros,
  nutritionalScore,
}) => {
  const { getDailyNutrition, dailyGoals } = useNutritionStore();
  
  // If date is provided, get nutrition data for that date
  const dailyNutrition = date ? getDailyNutrition(date) : null;
  
  // Use provided props or calculate from daily nutrition
  const calories = propCalories || {
    consumed: dailyNutrition?.calories || 0,
    goal: dailyGoals.calories
  };
  
  const macros = propMacros || {
    protein: {
      consumed: dailyNutrition?.protein || 0,
      goal: dailyGoals.protein
    },
    carbs: {
      consumed: dailyNutrition?.carbs || 0,
      goal: dailyGoals.carbs
    },
    fat: {
      consumed: dailyNutrition?.fat || 0,
      goal: dailyGoals.fat
    }
  };
  
  const caloriesProgress = Math.min(calories.consumed / calories.goal, 1);
  const proteinProgress = Math.min(macros.protein.consumed / macros.protein.goal, 1);
  const carbsProgress = Math.min(macros.carbs.consumed / macros.carbs.goal, 1);
  const fatProgress = Math.min(macros.fat.consumed / macros.fat.goal, 1);
  
  const caloriesRemaining = calories.goal - calories.consumed;
  
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
  
  return (
    <Card variant="elevated" style={styles.card}>
      <View style={styles.caloriesContainer}>
        <View style={styles.caloriesHeader}>
          <Text style={styles.caloriesTitle}>Calories</Text>
          <Text style={styles.caloriesValue}>
            {calories.consumed} / {calories.goal}
          </Text>
        </View>
        
        <ProgressBar 
          progress={caloriesProgress}
          height={10}
          progressColor={Colors.primary}
          style={styles.caloriesProgress}
        />
        
        <Text style={styles.caloriesRemaining}>
          {caloriesRemaining > 0 
            ? `${caloriesRemaining} calories remaining`
            : 'Daily goal reached'}
        </Text>
      </View>
      
      <View style={styles.macrosContainer}>
        <Text style={styles.macrosTitle}>Macronutrients</Text>
        
        <View style={styles.macroItem}>
          <View style={styles.macroHeader}>
            <Text style={styles.macroName}>Protein</Text>
            <Text style={styles.macroValue}>
              {macros.protein.consumed}g / {macros.protein.goal}g
            </Text>
          </View>
          <ProgressBar 
            progress={proteinProgress}
            height={6}
            progressColor="#4CAF50"
          />
        </View>
        
        <View style={styles.macroItem}>
          <View style={styles.macroHeader}>
            <Text style={styles.macroName}>Carbs</Text>
            <Text style={styles.macroValue}>
              {macros.carbs.consumed}g / {macros.carbs.goal}g
            </Text>
          </View>
          <ProgressBar 
            progress={carbsProgress}
            height={6}
            progressColor="#2196F3"
          />
        </View>
        
        <View style={styles.macroItem}>
          <View style={styles.macroHeader}>
            <Text style={styles.macroName}>Fat</Text>
            <Text style={styles.macroValue}>
              {macros.fat.consumed}g / {macros.fat.goal}g
            </Text>
          </View>
          <ProgressBar 
            progress={fatProgress}
            height={6}
            progressColor="#FF9800"
          />
        </View>
      </View>
      
      {nutritionalScore && (
        <View style={styles.nutriScoreContainer}>
          <Text style={styles.nutriScoreTitle}>Nutritional Quality</Text>
          
          <View style={styles.nutriScoreGrades}>
            {['A', 'B', 'C', 'D', 'E'].map((grade) => (
              <View 
                key={grade}
                style={[
                  styles.nutriScoreGrade,
                  { 
                    backgroundColor: getNutriScoreColor(grade),
                    opacity: nutritionalScore.score === grade ? 1 : 0.3
                  }
                ]}
              >
                <Text style={styles.nutriScoreGradeText}>{grade}</Text>
              </View>
            ))}
          </View>
          
          <Text style={styles.nutriScoreDescription}>
            {nutritionalScore.score === 'A' && "Excellent nutritional quality"}
            {nutritionalScore.score === 'B' && "Good nutritional quality"}
            {nutritionalScore.score === 'C' && "Average nutritional quality"}
            {nutritionalScore.score === 'D' && "Poor nutritional quality"}
            {nutritionalScore.score === 'E' && "Unhealthy nutritional quality"}
          </Text>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: Colors.spacing.lg,
    padding: Colors.spacing.lg,
  },
  caloriesContainer: {
    marginBottom: Colors.spacing.lg,
  },
  caloriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Colors.spacing.sm,
  },
  caloriesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  caloriesValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  caloriesProgress: {
    marginBottom: Colors.spacing.sm,
  },
  caloriesRemaining: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'right',
  },
  macrosContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Colors.spacing.lg,
  },
  macrosTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Colors.spacing.md,
  },
  macroItem: {
    marginBottom: Colors.spacing.md,
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Colors.spacing.xs,
  },
  macroName: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  macroValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  nutriScoreContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Colors.spacing.lg,
    marginTop: Colors.spacing.lg,
  },
  nutriScoreTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Colors.spacing.md,
  },
  nutriScoreGrades: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Colors.spacing.md,
  },
  nutriScoreGrade: {
    width: '18%',
    paddingVertical: Colors.spacing.xs + 2,
    borderRadius: Colors.radius.xs,
    alignItems: 'center',
  },
  nutriScoreGradeText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
  },
  nutriScoreDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});

export default NutritionSummary;