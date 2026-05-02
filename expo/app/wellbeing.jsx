import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import BottomNavigation from '@/components/BottomNavigation';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';
import { tokens } from '../../theme/tokens';

const MOODS = ['Ã°ÂÂÂ´', 'Ã°ÂÂÂ', 'Ã°ÂÂÂ', 'Ã°ÂÂÂ', 'Ã°ÂÂÂ'];
const STRESS = ['Low', 'Medium', 'High'];

export default function WellbeingScreen() {
  const [mood, setMood] = useState(3);
  const [stress, setStress] = useState('Low');
  const sleepHours = 7.4;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Wellbeing" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How are you feeling?</Text>
          <View style={styles.moodRow}>
            {MOODS.map((emoji, i) => {
              const active = mood === i;
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setMood(i)}
                  style={[styles.moodBtn, active && styles.moodBtnActive]}>
                  <Text style={styles.moodEmoji}>{emoji}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity onPress={() => router.push('/mood-tracking')}>
            <Text style={styles.link}>Track your mood Ã¢ÂÂ</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Sleep</Text>
          <Text style={styles.bigNum}>{sleepHours}</Text>
          <Text style={styles.sub}>hrs last night</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Stress</Text>
          <View style={styles.pillRow}>
            {STRESS.map(s => {
              const active = stress === s;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => setStress(s)}
                  style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}>
                  <Text style={[styles.pillText, { color: active ? tokens.colors.grayscale.black : tokens.colors.sky.dark }]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.grayscale.black },
  card: {
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: tokens.colors.legacy.darkSurface,
    borderRadius: 16, padding: 20, marginBottom: 12,
  },
  cardTitle: { color: tokens.colors.background.default, fontSize: 16, fontWeight: '600', marginBottom: 16 },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  moodBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  moodBtnActive: { backgroundColor: tokens.colors.background.default },
  moodEmoji: { fontSize: 24 },
  link: { color: tokens.colors.sky.dark, fontSize: 13, marginTop: 8 },
  label: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: tokens.colors.sky.dark, marginBottom: 8,
  },
  bigNum: { fontSize: 36, fontWeight: '800', color: tokens.colors.background.default, letterSpacing: -0.5 },
  sub: { color: tokens.colors.sky.dark, fontSize: 14, marginTop: 2 },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999 },
  pillActive: { backgroundColor: tokens.colors.background.default },
  pillInactive: { backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: tokens.colors.legacy.darkSurface },
  pillText: { fontSize: 13, fontWeight: '600' },
});
