import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import BottomNavigation from '@/components/BottomNavigation';
import { tokens } from '../../theme/tokens';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const MOODS = ['Ã°ÂÂÂ´', 'Ã°ÂÂÂ', 'Ã°ÂÂÂ', 'Ã°ÂÂÂ', 'Ã°ÂÂÂ'];
const STRESS = ['Low', 'Medium', 'High'];

export default function WellbeingScreen() {
  const [mood, setMood] = useState(3);
  const [stress, setStress] = useState('Low');
  const sleepHours = 7.4;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Wellbeing" />
      <ScrollView contentContainerStyle={{ padding: tokens.spacing.md, paddingBottom: 100 }}>
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
                  <Text style={[styles.pillText, { color: active ? '#000' : '#999' }]}>
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
  container: { flex: 1, backgroundColor: tokens.colors.dark_navy.text_primary },
  card: {
    backgroundColor: tokens.colors.dark_navy.text_primary, borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    borderRadius: tokens.radius.lg, padding: 20, marginBottom: 12,
  },
  cardTitle: { color: tokens.colors.dark_navy.bg_primary, fontSize: 16, fontWeight: '600', marginBottom: tokens.spacing.md },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  moodBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  moodBtnActive: { backgroundColor: tokens.colors.dark_navy.bg_primary },
  moodEmoji: { fontSize: 24 },
  link: { color: tokens.colors.dark_navy.text_muted, fontSize: 13, marginTop: 8 },
  label: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: tokens.colors.dark_navy.text_muted, marginBottom: tokens.spacing.sm,
  },
  bigNum: { fontSize: 36, fontWeight: '800', color: tokens.colors.dark_navy.bg_primary, letterSpacing: -0.5 },
  sub: { color: tokens.colors.dark_navy.text_muted, fontSize: 14, marginTop: 2 },
  pillRow: { flexDirection: 'row', gap: tokens.spacing.sm },
  pill: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999 },
  pillActive: { backgroundColor: tokens.colors.dark_navy.bg_primary },
  pillInactive: { backgroundColor: tokens.colors.dark_navy.text_primary, borderWidth: 1, borderColor: tokens.colors.dark_navy.border },
  pillText: { fontSize: 13, fontWeight: '600' },
});
