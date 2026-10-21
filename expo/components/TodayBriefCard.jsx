// components/TodayBriefCard.jsx
//
// The daily Today brief on the Home screen: a short note from the Coach, written once a day from what it knows about the person
// (services/briefService.js). It is part of Pro. A person on Pro sees the note, a skeleton while it is being written, or nothing at all
// when it could not be written; anyone else sees what it is, which plan it is part of and a button to the plans. Until the phone knows the
// plan it shows nothing, so a person who has Pro never sees the lock flash up first. The server holds the real line.
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUserStore } from '@/store/userStore';
import { useEntitlement } from '@/hooks/useEntitlement';
import { getTodayBrief } from '@/services/briefService';
import { FEATURE_NAMES, TIER_NAMES, featureTier } from '@/lib/entitlements';

export const BRIEF_LOCKED_TEXT = 'A short note from your Coach each morning, written from your sleep, recovery, training and what you have logged.';
export const BRIEF_FOOTNOTE = 'From your Coach, once a day. Training and nutrition guidance, not medical advice.';

/** `getBrief` is only there so a test can stand in for the service. */
export default function TodayBriefCard({ getBrief = getTodayBrief }) {
  const user = useUserStore((s) => s.user);
  const { can, ready } = useEntitlement();
  const uid = user?.uid;
  // A plan the phone does not know yet counts as Free for `can`, so `allowed` needs no check of `ready`; the lock does, so it never flashes up.
  const allowed = Boolean(uid) && can('todayBrief');
  const locked = Boolean(uid) && ready && !can('todayBrief');
  const [state, setState] = useState({ loading: false, brief: null });

  useEffect(() => {
    if (!allowed) {
      setState({ loading: false, brief: null });
      return undefined;
    }
    let cancelled = false;
    setState({ loading: true, brief: null });
    // The brief is written from the person as they are when it is asked for; a change to their profile later does not ask for another.
    getBrief({ user })
      .catch(() => null)
      .then((brief) => { if (!cancelled) setState({ loading: false, brief }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per person and plan; `getBrief` is a stable import (or a test's stand-in)
  }, [uid, allowed]);

  if (locked) {
    const planName = TIER_NAMES[featureTier('todayBrief')];
    return (
      <View testID="today-brief-locked" style={styles.card}>
        <View style={styles.headerRow}>
          <Ionicons name="lock-closed" size={18} color="#000000" />
          <Text style={styles.title}>Today brief</Text>
          <View style={styles.pill}><Text testID="today-brief-plan" style={styles.pillText}>{planName}</Text></View>
        </View>
        <Text style={styles.body}>{`${FEATURE_NAMES.todayBrief} is part of ${planName}. ${BRIEF_LOCKED_TEXT}`}</Text>
        <Pressable
          testID="today-brief-see-plans"
          accessibilityRole="button"
          accessibilityLabel={`See plans for the ${FEATURE_NAMES.todayBrief}`}
          style={styles.button}
          onPress={() => router.push({ pathname: '/paywall', params: { feature: 'todayBrief' } })}
        >
          <Text style={styles.buttonText}>See plans</Text>
        </Pressable>
      </View>
    );
  }

  if (state.loading) {
    return (
      <View testID="today-brief-loading" style={styles.card} accessibilityLabel="Writing your Today brief">
        <View style={styles.headerRow}>
          <Ionicons name="sunny-outline" size={18} color="#000000" />
          <Text style={styles.title}>Today brief</Text>
        </View>
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#000000" />
          <Text style={styles.body}>Writing your brief</Text>
        </View>
      </View>
    );
  }

  const brief = state.brief;
  if (!allowed || !brief) return null;
  return (
    <View testID="today-brief" style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="sunny-outline" size={18} color="#000000" />
        <Text style={styles.title}>Today brief</Text>
      </View>
      <Text testID="today-brief-headline" accessibilityRole="header" style={styles.headline}>{brief.headline}</Text>
      <View style={styles.points}>
        {brief.points.map((point, i) => (
          <View key={`${i}-${point}`} style={styles.pointRow}>
            <View style={styles.bullet} />
            <Text testID={`today-brief-point-${i}`} style={styles.point}>{point}</Text>
          </View>
        ))}
      </View>
      <Text testID="today-brief-note" style={styles.footnote}>{BRIEF_FOOTNOTE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#F0F0F0' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  title: { flex: 1, fontSize: 14, fontWeight: '700', color: '#000000' },
  pill: { backgroundColor: '#000000', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  body: { fontSize: 13, color: '#666666', lineHeight: 18 },
  button: { alignSelf: 'flex-start', backgroundColor: '#000000', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginTop: 12 },
  buttonText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headline: { fontSize: 18, fontWeight: '800', color: '#000000', marginBottom: 10 },
  points: { gap: 8 },
  pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#000000', marginTop: 7 },
  point: { flex: 1, fontSize: 14, color: '#000000', lineHeight: 20 },
  footnote: { fontSize: 11, color: '#8A8A8A', marginTop: 12 },
});
