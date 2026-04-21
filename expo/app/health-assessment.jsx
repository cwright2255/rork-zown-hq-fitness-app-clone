import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';

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
      router.back();
    }
  };

  const selected = answers[step];

  return (
    <View style={styles.container}>
      <ScreenHeader title="Health Assessment" showBack />

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <Text style={styles.stepLabel}>Question {step + 1} of {total}</Text>

        <View style={styles.card}>
          <Text style={styles.question}>{current.q}</Text>
          <View style={{ gap: 10, marginTop: 16 }}>
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
  container: { flex: 1, backgroundColor: '#000' },
  progressTrack: { height: 2, backgroundColor: '#1A1A1A' },
  progressFill: { height: 2, backgroundColor: '#fff' },
  stepLabel: {
    color: '#999', fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: 12,
  },
  card: {
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 20,
  },
  question: { color: '#fff', fontSize: 18, fontWeight: '600', lineHeight: 24 },
  option: {
    backgroundColor: '#0F0F0F', borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 12, padding: 16,
  },
  optionActive: { borderColor: '#fff', borderWidth: 2 },
  optionText: { color: '#999', fontSize: 15, fontWeight: '500' },
  optionTextActive: { color: '#fff', fontWeight: '600' },
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 24 },
});
