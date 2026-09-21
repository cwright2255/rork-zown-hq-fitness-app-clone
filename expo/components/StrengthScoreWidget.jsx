import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '@/store/userStore';
import { getBestOneRepMaxes, computeStrengthScore } from '@/services/strengthStandardsService';

const TIER_COLORS = {
  Untrained: '#999999',
  Beginner: '#8B5CF6',
  Novice: '#3B82F6',
  Intermediate: '#10B981',
  Advanced: '#F59E0B',
  Elite: '#EF4444',
};

// Real, new: general, estimated population-standard comparison for
// bench/squat/deadlift, built from the user's own real logged 1RMs
// (services/strengthStandardsService.js) and their own real, stored
// bodyweight and gender - not a guess. Labeled "general, estimated"
// directly in the UI since these standards genuinely vary by source,
// not a precise, universally-agreed figure.
export default function StrengthScoreWidget() {
  const { user } = useUserStore();
  const [isLoading, setIsLoading] = useState(true);
  const [score, setScore] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.uid) {
        setIsLoading(false);
        return;
      }
      try {
        const oneRepMaxes = await getBestOneRepMaxes(user.uid);
        if (cancelled) return;
        const result = computeStrengthScore({
          oneRepMaxes,
          bodyweightKg: user?.fitnessMetrics?.weight,
          gender: user?.gender,
        });
        setScore(result);
      } catch (e) {
        console.warn('[StrengthScoreWidget] failed to load:', e?.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid]);

  if (isLoading) {
    return (
      <View style={s.card}>
        <ActivityIndicator size="small" color="#000000" />
      </View>
    );
  }

  if (!score || !score.overallTier) {
    return (
      <View style={s.card}>
        <View style={s.header}>
          <Ionicons name="trophy-outline" size={18} color="#000000" />
          <Text style={s.title}>Strength Score</Text>
        </View>
        <Text style={s.emptyText}>
          Log a set on Bench Press, Squat, or Deadlift to see how you compare to general strength standards.
        </Text>
      </View>
    );
  }

  const tierColor = TIER_COLORS[score.overallTier] || '#999999';
  const lifts = Object.entries(score.perLift);

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Ionicons name="trophy-outline" size={18} color="#000000" />
        <Text style={s.title}>Strength Score</Text>
      </View>

      <View style={s.overallRow}>
        <View style={[s.tierBadge, { backgroundColor: tierColor }]}>
          <Text style={s.tierBadgeText}>{score.overallTier}</Text>
        </View>
        <Text style={s.overallSubtext}>Your overall level, based on your weakest logged lift</Text>
      </View>

      {lifts.map(([liftName, data]) => (
        <View key={liftName} style={s.liftRow}>
          <Text style={s.liftName}>{liftName}</Text>
          <View style={s.liftBarTrack}>
            <View
              style={[
                s.liftBarFill,
                { width: `${Math.min(100, Math.max(4, data.progressToNext * 100))}%`, backgroundColor: TIER_COLORS[data.tier] || '#999999' },
              ]}
            />
          </View>
          <Text style={s.liftTier}>{data.tier}</Text>
        </View>
      ))}

      <Text style={s.disclaimer}>General, estimated standards - not a precise measurement.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  title: { fontSize: 16, fontWeight: '700', color: '#000000' },
  emptyText: { fontSize: 13, color: '#666666', lineHeight: 18 },
  overallRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  tierBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  tierBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  overallSubtext: { flex: 1, fontSize: 12, color: '#666666' },
  liftRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  liftName: { width: 90, fontSize: 12, fontWeight: '600', color: '#000000' },
  liftBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#F0F0F0', overflow: 'hidden' },
  liftBarFill: { height: '100%', borderRadius: 3 },
  liftTier: { width: 80, fontSize: 11, color: '#666666', textAlign: 'right' },
  disclaimer: { fontSize: 10, color: '#AAAAAA', marginTop: 4 },
});
