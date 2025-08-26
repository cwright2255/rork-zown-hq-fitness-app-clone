import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight, Scan } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Card from '@/components/Card';
import { useUserStore } from '@/store/userStore';
import { User } from '@/types';

const OnboardingScreen = () => {
  const { setUser, completeOnboarding } = useUserStore();

  const [name, setName] = useState<string>('');
  const [fitnessLevel, setFitnessLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);
  const [nutritionStyle, setNutritionStyle] = useState<'balanced' | 'high-protein' | 'low-carb' | 'keto' | 'carb-plus' | 'recovery'>('balanced');
  const [workoutDays, setWorkoutDays] = useState<number>(3);
  const [focusGroups, setFocusGroups] = useState<string[]>([]);

  const goals = useMemo(() => [
    'Build Muscle',
    'Lose Weight',
    'Improve Endurance',
    'Increase Strength',
    'Enhance Flexibility',
    'General Fitness',
    'Sports Performance',
    'Stress Reduction',
  ], []);

  const restrictionOptions = useMemo(() => [
    'Vegan',
    'Vegetarian',
    'Pescatarian',
    'Gluten-Free',
    'Dairy-Free',
    'Nut-Free',
    'Halal',
    'Kosher',
  ], []);

  const nutritionStyles = useMemo(() => ([
    { key: 'balanced', label: 'Balanced' },
    { key: 'high-protein', label: 'High P' },
    { key: 'low-carb', label: 'Low C' },
    { key: 'keto', label: 'Keto' },
    { key: 'carb-plus', label: 'Carb+' },
    { key: 'recovery', label: 'Recovery' },
  ] as const), []);

  const workoutDayOptions = useMemo(() => [1, 2, 3, 4, 5, 6, 7] as const, []);

  const muscleGroupOptions = useMemo(() => [
    'Chest',
    'Back',
    'Legs',
    'Shoulders',
    'Arms',
    'Core',
    'Glutes',
    'Full Body',
    'Mobility',
  ], []);

  const handleToggleArray = useCallback((value: string, list: string[], setter: (next: string[]) => void) => {
    const exists = list.includes(value);
    setter(exists ? list.filter(v => v !== value) : [...list, value]);
  }, []);

  const handleNavigateBodyScan = useCallback(() => {
    console.log('[Onboarding] Navigate to Body Scan');
    router.push('/profile/body-scan');
  }, []);

  const handleGetStarted = useCallback(() => {
    try {
      console.log('[Onboarding] Creating user');
      const newUser: User = {
        id: Date.now().toString(),
        name: name || 'Athlete',
        email: '',
        profileImage: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500',
        joinDate: new Date().toISOString(),
        fitnessLevel,
        goals: selectedGoals,
        exp: 0,
        xp: 0,
        level: 1,
        expToNextLevel: 1000,
        streak: 0,
        streakData: { currentStreak: 0, longestStreak: 0, streakDates: [] },
        preferences: {
          units: 'metric',
          notifications: { workouts: true, nutrition: true, social: true },
          privacy: { profileVisible: true, shareProgress: true },
          workoutDuration: 30,
          dietaryPreference: `${nutritionStyle}` + (dietaryRestrictions.length ? ` | ${dietaryRestrictions.join(',')}` : ''),
          workoutFrequencyDays: workoutDays,
          focusMuscleGroups: focusGroups,
          enableWaterTracking: true,
        },
        fitnessMetrics: { weight: 70, height: 175, bodyFat: 15, muscleMass: 35 },
        expSystem: {
          totalExp: 0,
          level: 1,
          expToNextLevel: 1000,
          expSources: { workouts: 0, nutrition: 0, social: 0 },
          levelRequirements: { 1: 1000 },
        },
        subscription: { tier: 'free', status: 'active', startDate: new Date().toISOString(), autoRenew: false },
      };

      setUser(newUser);
      completeOnboarding();
      router.replace('/');
    } catch (e) {
      console.error('[Onboarding] Error finishing onboarding', e);
    }
  }, [completeOnboarding, dietaryRestrictions, fitnessLevel, name, nutritionStyle, selectedGoals, setUser, workoutDays, focusGroups]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>Welcome to Zown HQ</Text>
          <Text style={styles.stepDescription}>
            Quick setup. You can change anything later.
          </Text>

          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80' }}
            style={styles.welcomeImage}
            resizeMode="cover"
          />

          <Input
            label="Your name"
            value={name}
            onChangeText={setName}
            placeholder="Enter your name (optional)"
            autoCapitalize="words"
            containerStyle={styles.input}
            testID="name-input"
          />

          <Text style={styles.sectionTitle}>Fitness level</Text>
          <View style={styles.levelContainer}>
            <Button
              title="Beginner"
              variant={fitnessLevel === 'beginner' ? 'primary' : 'outline'}
              onPress={() => setFitnessLevel('beginner')}
              style={styles.levelButton}
              testID="level-beginner"
            />
            <Button
              title="Intermediate"
              variant={fitnessLevel === 'intermediate' ? 'primary' : 'outline'}
              onPress={() => setFitnessLevel('intermediate')}
              style={styles.levelButton}
              testID="level-intermediate"
            />
            <Button
              title="Advanced"
              variant={fitnessLevel === 'advanced' ? 'primary' : 'outline'}
              onPress={() => setFitnessLevel('advanced')}
              style={styles.levelButton}
              testID="level-advanced"
            />
          </View>

          <Text style={styles.sectionTitle}>Goals</Text>
          <View style={styles.goalsContainer}>
            {goals.map((goal) => (
              <Button
                key={goal}
                title={goal}
                variant={selectedGoals.includes(goal) ? 'primary' : 'outline'}
                onPress={() => handleToggleArray(goal, selectedGoals, setSelectedGoals)}
                style={styles.goalButton}
                testID={`goal-${goal}`}
              />
            ))}
          </View>

          <Text style={styles.sectionTitle}>Dietary restrictions</Text>
          <View style={styles.goalsContainer}>
            {restrictionOptions.map((opt) => (
              <Button
                key={opt}
                title={opt}
                variant={dietaryRestrictions.includes(opt) ? 'primary' : 'outline'}
                onPress={() => handleToggleArray(opt, dietaryRestrictions, setDietaryRestrictions)}
                style={styles.goalButton}
                testID={`restriction-${opt}`}
              />
            ))}
          </View>

          <Text style={styles.sectionTitle}>Workout days per week</Text>
          <View style={styles.levelContainer}>
            {workoutDayOptions.map((d) => (
              <Button
                key={`day-${d}`}
                title={`${d}`}
                variant={workoutDays === d ? 'primary' : 'outline'}
                onPress={() => setWorkoutDays(d)}
                style={styles.levelButton}
                testID={`workout-days-${d}`}
              />
            ))}
          </View>

          <Text style={styles.sectionTitle}>Focus muscle groups</Text>
          <View style={styles.goalsContainer}>
            {muscleGroupOptions.map((mg) => (
              <Button
                key={mg}
                title={mg}
                variant={focusGroups.includes(mg) ? 'primary' : 'outline'}
                onPress={() => handleToggleArray(mg, focusGroups, setFocusGroups)}
                style={styles.goalButton}
                testID={`muscle-${mg}`}
              />
            ))}
          </View>

          <Text style={styles.sectionTitle}>Nutrition style</Text>
          <View style={styles.goalsContainer}>
            {nutritionStyles.map((styleOpt) => (
              <Button
                key={styleOpt.key}
                title={styleOpt.label}
                variant={nutritionStyle === styleOpt.key ? 'primary' : 'outline'}
                onPress={() => setNutritionStyle(styleOpt.key)}
                style={styles.goalButton}
                testID={`nutrition-${styleOpt.key}`}
              />
            ))}
          </View>

          <Card variant="elevated" style={styles.bodyScanCard}>
            <Text style={styles.bodyScanTitle}>Optional: Body Scan</Text>
            <Text style={styles.bodyScanDescription}>
              Do a quick in-app capture to power progress tracking. You can do this anytime.
            </Text>
            <Button
              title="Start Body Scan"
              onPress={handleNavigateBodyScan}
              leftIcon={<Scan size={18} color={Colors.text.inverse} />}
              style={styles.bodyScanButton}
              testID="start-body-scan-btn"
            />
          </Card>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Get Started"
          onPress={handleGetStarted}
          rightIcon={<ArrowRight size={20} color="#FFFFFF" />}
          style={styles.nextButton}
          testID="onboarding-next-btn"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  stepDescription: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 12,
    marginTop: 8,
  },
  welcomeImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  levelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  levelButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  goalsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 8,
  },
  goalButton: {
    margin: 4,
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  nextButton: {
    width: '100%',
  },
  bodyScanCard: {
    marginTop: 24,
    padding: 16,
  },
  bodyScanTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 6,
  },
  bodyScanDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 12,
  },
  bodyScanButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
  },
});

export default OnboardingScreen;
