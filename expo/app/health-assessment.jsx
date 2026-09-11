import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { router } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { tokens } from '../../theme/tokens';



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

      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 140 }}>
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

// Real fix: same dark_navy misused-token bug as the other files already
// fixed this pass. option's background wasn't routed through dark_navy
// (a plain #0F0F0F, near-black) but is included here for the same
// reason as similar cases in other files this pass - designed for a
// dark background, would be jarring on this new light one. Now white
// with hq.jsx's own shadow, same as every other card in this pass.
// optionActive's border, same "black for active/selected state"
// convention used throughout.
const cardShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
  default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  progressTrack: { height: 2, backgroundColor: '#F5F5F5' },
  progressFill: { height: 2, backgroundColor: '#000000' },
  stepLabel: {
    color: '#999999', fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.lg, padding: 20,
  },
  question: { color: '#000000', fontSize: 18, fontWeight: '600', lineHeight: 24 },
  option: {
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.md, padding: tokens.spacing.md,
  },
  optionActive: { borderColor: '#000000', borderWidth: 2 },
  optionText: { color: '#666666', fontSize: 15, fontWeight: '500' },
  optionTextActive: { color: '#000000', fontWeight: '600' },
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 24 },
});
