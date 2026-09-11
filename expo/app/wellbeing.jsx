import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { router } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import BottomNavigation from '@/components/BottomNavigation';
import { tokens } from '../../theme/tokens';



const MOODS = ['ÃÂ°ÃÂÃÂÃÂ´', 'ÃÂ°ÃÂÃÂÃÂ', 'ÃÂ°ÃÂÃÂÃÂ', 'ÃÂ°ÃÂÃÂÃÂ', 'ÃÂ°ÃÂÃÂÃÂ'];
const STRESS = ['Low', 'Medium', 'High'];

export default function WellbeingScreen() {
  const [mood, setMood] = useState(3);
  const [stress, setStress] = useState('Low');
  const sleepHours = 7.4;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Wellbeing" />
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 100 }}>
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
            <Text style={styles.link}>Track your mood ÃÂ¢ÃÂÃÂ</Text>
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

// Real fix: same dark_navy misused-token bug as app/support.jsx and
// app/nutrition.jsx - backgroundColor: tokens.colors.dark_navy.text_primary
// (a "text" token, resolves to white) used as both container and card
// backgrounds, color: tokens.colors.dark_navy.text_muted (a gray-blue
// meant for a dark background, #7A869E) for secondary text, and
// backgroundColor: tokens.colors.dark_navy.bg_primary (#0B1220, a real,
// intentionally dark color) for the mood/stress "active" highlight -
// that one wasn't misused, it correctly used a background token as a
// background, but it's still the wrong color family for a light
// screen. Now black #000000, matching how hq.jsx's own primary
// selected-state buttons (e.g. "Add Glass") already use black. Cards
// use hq.jsx's own shadow instead of the previous border.
const cardShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
  default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  card: {
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.lg, padding: 20, marginBottom: 12,
  },
  cardTitle: { color: '#000000', fontSize: 16, fontWeight: '600', marginBottom: tokens.spacing.md },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  moodBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  moodBtnActive: { backgroundColor: '#000000' },
  moodEmoji: { fontSize: 24 },
  link: { color: '#666666', fontSize: 13, marginTop: 8 },
  label: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: '#999999', marginBottom: tokens.spacing.sm,
  },
  bigNum: { fontSize: 36, fontWeight: '800', color: '#000000', letterSpacing: -0.5 },
  sub: { color: '#666666', fontSize: 14, marginTop: 2 },
  pillRow: { flexDirection: 'row', gap: tokens.spacing.sm },
  pill: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999 },
  pillActive: { backgroundColor: '#000000' },
  pillInactive: { backgroundColor: '#FFFFFF', ...cardShadow },
  pillText: { fontSize: 13, fontWeight: '600' },
});
