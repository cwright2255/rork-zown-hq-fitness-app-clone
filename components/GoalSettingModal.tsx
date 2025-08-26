import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { X, Target, Calendar, TrendingUp, Award } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import Button from '@/components/Button';

interface GoalSettingModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (goal: any) => void;
}

const GOAL_CATEGORIES = [
  { id: 'fitness', label: 'Fitness', icon: '💪', color: Colors.primary },
  { id: 'nutrition', label: 'Nutrition', icon: '🥗', color: Colors.success },
  { id: 'wellness', label: 'Wellness', icon: '🧘', color: Colors.info },
  { id: 'habits', label: 'Habits', icon: '✅', color: Colors.secondary },
];

const GOAL_TIMEFRAMES = [
  { id: 'daily', label: 'Daily', duration: 1 },
  { id: 'weekly', label: 'Weekly', duration: 7 },
  { id: 'monthly', label: 'Monthly', duration: 30 },
  { id: 'quarterly', label: '3 Months', duration: 90 },
];

const FITNESS_GOALS = [
  'Complete 5 workouts per week',
  'Run 10,000 steps daily',
  'Burn 500 calories per workout',
  'Increase bench press by 10lbs',
  'Complete a 5K run',
  'Do 50 push-ups in a row',
];

const NUTRITION_GOALS = [
  'Drink 8 glasses of water daily',
  'Eat 5 servings of fruits/vegetables',
  'Consume 150g protein daily',
  'Limit sugar intake to 25g',
  'Meal prep 5 days a week',
  'Take vitamins daily',
];

const WELLNESS_GOALS = [
  'Meditate for 10 minutes daily',
  'Sleep 8 hours per night',
  'Practice gratitude journaling',
  'Take a 15-minute walk outside',
  'Do breathing exercises',
  'Limit screen time to 2 hours',
];

const HABIT_GOALS = [
  'Read for 30 minutes daily',
  'Wake up at 6 AM consistently',
  'No phone for first hour of day',
  'Stretch for 10 minutes daily',
  'Practice a new skill for 20 min',
  'Write in journal before bed',
];

export default function GoalSettingModal({ visible, onClose, onSave }: GoalSettingModalProps) {
  const [selectedCategory, setSelectedCategory] = useState('fitness');
  const [goalTitle, setGoalTitle] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [targetUnit, setTargetUnit] = useState('');
  const [timeframe, setTimeframe] = useState('weekly');
  const [isCustomGoal, setIsCustomGoal] = useState(false);

  const getSuggestedGoals = () => {
    switch (selectedCategory) {
      case 'fitness': return FITNESS_GOALS;
      case 'nutrition': return NUTRITION_GOALS;
      case 'wellness': return WELLNESS_GOALS;
      case 'habits': return HABIT_GOALS;
      default: return FITNESS_GOALS;
    }
  };

  const handleSave = useCallback(() => {
    if (!goalTitle.trim()) {
      Alert.alert('Error', 'Please enter a goal title');
      return;
    }

    const selectedCategoryData = GOAL_CATEGORIES.find(cat => cat.id === selectedCategory);
    const selectedTimeframeData = GOAL_TIMEFRAMES.find(tf => tf.id === timeframe);
    
    const newGoal = {
      id: `goal-${Date.now()}`,
      title: goalTitle.trim(),
      category: selectedCategory,
      categoryColor: selectedCategoryData?.color || Colors.primary,
      targetValue: targetValue ? parseFloat(targetValue) : undefined,
      targetUnit: targetUnit || undefined,
      timeframe,
      timeframeDuration: selectedTimeframeData?.duration || 7,
      progress: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    onSave(newGoal);
    
    // Reset form
    setGoalTitle('');
    setTargetValue('');
    setTargetUnit('');
    setSelectedCategory('fitness');
    setTimeframe('weekly');
    setIsCustomGoal(false);
    
    onClose();
  }, [goalTitle, selectedCategory, targetValue, targetUnit, timeframe, onSave, onClose]);

  const handleSuggestedGoalPress = (suggestedGoal: string) => {
    setGoalTitle(suggestedGoal);
    setIsCustomGoal(false);
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Card style={styles.modal}>
        <View style={styles.header}>
          <Text style={styles.title}>Set New Goal</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Goal Category Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category</Text>
            <View style={styles.categoryGrid}>
              {GOAL_CATEGORIES.map(category => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryCard,
                    selectedCategory === category.id && styles.categoryCardSelected
                  ]}
                  onPress={() => {
                    setSelectedCategory(category.id);
                    setGoalTitle('');
                    setIsCustomGoal(false);
                  }}
                >
                  <Text style={styles.categoryIcon}>{category.icon}</Text>
                  <Text style={[
                    styles.categoryLabel,
                    selectedCategory === category.id && styles.categoryLabelSelected
                  ]}>
                    {category.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Suggested Goals */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Suggested Goals</Text>
              <TouchableOpacity
                style={styles.customGoalToggle}
                onPress={() => {
                  setIsCustomGoal(!isCustomGoal);
                  if (!isCustomGoal) setGoalTitle('');
                }}
              >
                <Text style={styles.customGoalToggleText}>
                  {isCustomGoal ? 'Use Suggested' : 'Custom Goal'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {!isCustomGoal ? (
              <View style={styles.suggestedGoals}>
                {getSuggestedGoals().map((goal, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.suggestedGoalItem,
                      goalTitle === goal && styles.suggestedGoalItemSelected
                    ]}
                    onPress={() => handleSuggestedGoalPress(goal)}
                  >
                    <Target size={16} color={goalTitle === goal ? Colors.primary : Colors.text.secondary} />
                    <Text style={[
                      styles.suggestedGoalText,
                      goalTitle === goal && styles.suggestedGoalTextSelected
                    ]}>
                      {goal}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <TextInput
                style={styles.textInput}
                value={goalTitle}
                onChangeText={setGoalTitle}
                placeholder="Enter your custom goal..."
                placeholderTextColor={Colors.text.tertiary}
                multiline
              />
            )}
          </View>

          {/* Target Value (Optional) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Target (Optional)</Text>
            <View style={styles.targetInputContainer}>
              <TextInput
                style={styles.targetValueInput}
                value={targetValue}
                onChangeText={setTargetValue}
                placeholder="Number"
                placeholderTextColor={Colors.text.tertiary}
                keyboardType="numeric"
              />
              <TextInput
                style={styles.targetUnitInput}
                value={targetUnit}
                onChangeText={setTargetUnit}
                placeholder="Unit (e.g., lbs, mins, reps)"
                placeholderTextColor={Colors.text.tertiary}
              />
            </View>
          </View>

          {/* Timeframe Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Timeframe</Text>
            <View style={styles.timeframeGrid}>
              {GOAL_TIMEFRAMES.map(tf => (
                <TouchableOpacity
                  key={tf.id}
                  style={[
                    styles.timeframeCard,
                    timeframe === tf.id && styles.timeframeCardSelected
                  ]}
                  onPress={() => setTimeframe(tf.id)}
                >
                  <Calendar size={16} color={timeframe === tf.id ? Colors.primary : Colors.text.secondary} />
                  <Text style={[
                    styles.timeframeLabel,
                    timeframe === tf.id && styles.timeframeLabelSelected
                  ]}>
                    {tf.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Cancel"
            variant="outline"
            onPress={onClose}
            style={styles.cancelButton}
          />
          <Button
            title="Set Goal"
            variant="primary"
            onPress={handleSave}
            style={styles.saveButton}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    width: '90%',
    maxHeight: '85%',
    margin: 20,
    padding: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  categoryIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  categoryLabelSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  customGoalToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.primary + '10',
    borderRadius: 6,
  },
  customGoalToggleText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
  },
  suggestedGoals: {
    gap: 8,
  },
  suggestedGoalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    gap: 12,
  },
  suggestedGoalItemSelected: {
    backgroundColor: Colors.primary + '10',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  suggestedGoalText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.secondary,
  },
  suggestedGoalTextSelected: {
    color: Colors.primary,
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  targetInputContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  targetValueInput: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  targetUnitInput: {
    flex: 2,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeframeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeframeCard: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  timeframeCardSelected: {
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary,
  },
  timeframeLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  timeframeLabelSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
  },
});