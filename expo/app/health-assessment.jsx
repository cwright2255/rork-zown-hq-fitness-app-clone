import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { tokens } from '../../theme/tokens';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const QUESTIONS = [
  {
    q: 'How active are you day-to-day?',
    options: ['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active'],
  },
  {
    q: 'How would you rate your sleep?',
    options: ['Poor', 'Fair', 'Good', 'Excellent'],
  },
  {
    q: 'How is your stress level?',
    options: ['Low', 'Moderate', 'High', 'Very High'],
  },
  {
    q: "What's your primary goal?",
    options: ['Lose Weight', 'Build Muscle', 'Improve Endurance', 'General Health'],
  },
];

export default function HealthAssessmentScreen() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});

  const total = QUESTIONS.length;
  const progress = ((step + 1) / total) * 100;
  const current = QUESTIONS[step];

  const handleSelect = (opt) => setAnswers({ ...answers, [step]: opt });

  const handleNext = () => {
    if (step < total - 1) {
      setStep(step + 1);
    } else {
      (router.canGoBack() ? router.back() : router.replace('/'));
    }
  };

  const selected = answers[step];

  return (
    <View style={styles.container}>
      <ScreenHeader title="Health Assessment" showBack />

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <ScrollView contentContainerStyle={{ padding: tokens.spacing.md, paddingBottom: 140 }}>
        <Text style={styles.stepLabel}>Question {step + 1} of {total}</Text>

        <View style={styles.card}>
          <Text style={styles.question}>{current.q}</Text>
          <View style={{ gap: 10, marginTop: tokens.spacing.md }}>
            {current.options.map(opt => {
              const active = selected === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  onPress={() => handleSelect(opt)}
                  style={[styles.option, active && styles.optionActive]}>
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <PrimaryButton
          title={step < total - 1 ? 'Next' : 'Finish'}
          onPress={handleNext}
          disabled={!selected}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.dark_navy.text_primary },
  progressTrack: { height: 2, backgroundColor: tokens.colors.dark_navy.text_primary },
  progressFill: { height: 2, backgroundColor: tokens.colors.dark_navy.bg_primary },
  stepLabel: {
    color: tokens.colors.dark_navy.text_muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: 12,
  },
  card: {
    backgroundColor: tokens.colors.dark_navy.text_primary, borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    borderRadius: tokens.radius.lg, padding: 20,
  },
  question: { color: tokens.colors.dark_navy.bg_primary, fontSize: 18, fontWeight: '600', lineHeight: 24 },
  option: {
    backgroundColor: '#0F0F0F', borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    borderRadius: tokens.radius.md, padding: tokens.spacing.md,
  },
  optionActive: { borderColor: tokens.colors.dark_navy.bg_primary, borderWidth: 2 },
  optionText: { color: tokens.colors.dark_navy.text_muted, fontSize: 15, fontWeight: '500' },
  optionTextActive: { color: tokens.colors.dark_navy.bg_primary, fontWeight: '600' },
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 24 },
});
