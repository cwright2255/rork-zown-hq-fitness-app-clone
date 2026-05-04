import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, Scan } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import PrimaryButton from '@/components/PrimaryButton';
import { useUserStore } from '@/store/userStore';
import { tokens } from '../../theme/tokens';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const SLIDES = [
  {
    title: 'Welcome to ZOWN HQ',
    description: 'Own your day. Train smarter, eat cleaner, track every rep.',
  },
  {
    title: 'Personalized training',
    description: 'Workouts built around your level, goals and schedule.',
  },
  {
    title: 'Your mission starts now',
    description: 'A few quick questions and you\'re in. Change anything later.',
  },
];

const GOALS = ['Build Muscle', 'Lose Weight', 'Improve Endurance', 'Increase Strength', 'Enhance Flexibility', 'General Fitness', 'Sports Performance', 'Stress Reduction'];
const RESTRICTIONS = ['Vegan', 'Vegetarian', 'Pescatarian', 'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Halal', 'Kosher'];
const NUTRITION_STYLES = [
  { key: 'balanced', label: 'Balanced' },
  { key: 'high-protein', label: 'High Protein' },
  { key: 'low-carb', label: 'Low Carb' },
  { key: 'keto', label: 'Keto' },
  { key: 'carb-plus', label: 'Carb+' },
  { key: 'recovery', label: 'Recovery' },
];
const MUSCLE_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Glutes', 'Full Body', 'Mobility'];
const LEVELS = ['beginner', 'intermediate', 'advanced'];
const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

export default function OnboardingScreen() {
  const { setUser, completeOnboarding } = useUserStore();

  const [slide, setSlide] = useState(0);

  const [name, setName] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState('beginner');
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [dietaryRestrictions, setDietaryRestrictions] = useState([]);
  const [nutritionStyle, setNutritionStyle] = useState('balanced');
  const [workoutDays, setWorkoutDays] = useState(3);
  const [focusGroups, setFocusGroups] = useState([]);

  const handleToggle = useCallback((value, list, setter) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }, []);

  const handleGetStarted = useCallback(() => {
    try {
      const newUser = {
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

  const totalSteps = SLIDES.length + 1;
  const currentStep = slide;
  const isLast = slide === totalSteps - 1;

  const handleNext = () => {
    if (slide < totalSteps - 1) setSlide(slide + 1);
  };

  const handleBack = () => {
    if (slide > 0) setSlide(slide - 1);
  };

  const handleSkip = () => {
    setSlide(totalSteps - 1);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleBack}
          disabled={slide === 0}
          hitSlop={8}>
          {slide > 0 ? <ChevronLeft size={24} color={colors.text} /> : null}
        </TouchableOpacity>
        <View style={styles.dotsRow}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View key={i} style={[styles.dot, currentStep === i && styles.dotActive]} />
          ))}
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={handleSkip} hitSlop={8}>
          {!isLast ? <Text style={styles.skipText}>Skip</Text> : null}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {slide < SLIDES.length ? (
          <View style={styles.slide}>
            <Text style={styles.hero}>{SLIDES[slide].title}</Text>
            <Text style={styles.heroSub}>{SLIDES[slide].description}</Text>
          </View>
        ) : (
          <View>
            <Text style={styles.hero}>Let's set you up</Text>
            <Text style={styles.heroSub}>Quick setup. Change anything later.</Text>

            <Text style={styles.sectionLabel}>YOUR NAME</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Your name (optional)"
                placeholderTextColor={colors.textTertiary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                testID="name-input"
              />
            </View>

            <Text style={styles.sectionLabel}>FITNESS LEVEL</Text>
            <View style={styles.pillRow}>
              {LEVELS.map((l) => (
                <Pill key={l} label={l[0].toUpperCase() + l.slice(1)} active={fitnessLevel === l} onPress={() => setFitnessLevel(l)} />
              ))}
            </View>

            <Text style={styles.sectionLabel}>GOALS</Text>
            <View style={styles.pillWrap}>
              {GOALS.map((g) => (
                <Pill key={g} label={g} active={selectedGoals.includes(g)} onPress={() => handleToggle(g, selectedGoals, setSelectedGoals)} />
              ))}
            </View>

            <Text style={styles.sectionLabel}>DIETARY RESTRICTIONS</Text>
            <View style={styles.pillWrap}>
              {RESTRICTIONS.map((r) => (
                <Pill key={r} label={r} active={dietaryRestrictions.includes(r)} onPress={() => handleToggle(r, dietaryRestrictions, setDietaryRestrictions)} />
              ))}
            </View>

            <Text style={styles.sectionLabel}>WORKOUT DAYS / WEEK</Text>
            <View style={styles.pillRow}>
              {DAY_OPTIONS.map((d) => (
                <Pill key={d} label={String(d)} active={workoutDays === d} onPress={() => setWorkoutDays(d)} />
              ))}
            </View>

            <Text style={styles.sectionLabel}>FOCUS MUSCLE GROUPS</Text>
            <View style={styles.pillWrap}>
              {MUSCLE_GROUPS.map((m) => (
                <Pill key={m} label={m} active={focusGroups.includes(m)} onPress={() => handleToggle(m, focusGroups, setFocusGroups)} />
              ))}
            </View>

            <Text style={styles.sectionLabel}>NUTRITION STYLE</Text>
            <View style={styles.pillWrap}>
              {NUTRITION_STYLES.map((n) => (
                <Pill key={n.key} label={n.label} active={nutritionStyle === n.key} onPress={() => setNutritionStyle(n.key)} />
              ))}
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Scan size={20} color={colors.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>Optional: Body Scan</Text>
                <Text style={styles.infoDesc}>Capture your baseline. You can do this later from your profile.</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          title={isLast ? 'Get Started' : 'Continue'}
          onPress={isLast ? handleGetStarted : handleNext}
          testID="onboarding-next-btn"
        />
      </View>
    </SafeAreaView>
  );
}

function Pill({ label, active, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  headerBtn: {
    width: 60,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  dotsRow: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 24, backgroundColor: colors.text },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  slide: { paddingTop: 80 },
  hero: { ...typography.hero, marginBottom: spacing.md },
  heroSub: { fontSize: 16, color: colors.textSecondary, lineHeight: 24, marginBottom: spacing.xl },
  sectionLabel: { ...typography.label, marginTop: spacing.lg, marginBottom: spacing.md },
  inputRow: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    height: 56,
    justifyContent: 'center',
  },
  input: { fontSize: 16, color: colors.text },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.base,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pillActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.text },
  pillTextActive: { color: tokens.colors.grayscale.black },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  infoIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  infoTitle: { ...typography.h4, marginBottom: 2 },
  infoDesc: { ...typography.bodySmall },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
});
