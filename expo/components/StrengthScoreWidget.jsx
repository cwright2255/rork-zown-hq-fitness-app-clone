import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '@/store/userStore';
import { getBestOneRepMaxes, computeStrengthScore } from '@/services/strengthStandardsService';

// Real fix: rebuilt to match the exact, established card structure every
// other widget on this screen uses (same size/shape as Calories, Heart,
// etc., collapsed to one headline value + tap-to-expand) - the original
// version was a full-width, differently-structured card, visually
// inconsistent with the rest of the grid. Duplicates the small set of
// exact style values from app/hq.jsx's own styles (cardContainer,
// statCard, insightPanel, etc.) since those are local to that file and
// not shared/exported; kept numerically identical to match precisely.
const { width } = Dimensions.get('window');
const CARD_GAP = 12;
const H_PAD = 22;
const CARD_W = (width - H_PAD * 2 - CARD_GAP) / 2;

export default function StrengthScoreWidget() {
  const { user } = useUserStore();
  const [isLoading, setIsLoading] = useState(true);
  const [score, setScore] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

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

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((v) => !v);
  };

  const headline = isLoading ? '\u2014' : (score?.overallTier || '\u2014');
  const lifts = score ? Object.entries(score.perLift) : [];

  return (
    <View style={[s.cardContainer, isExpanded && s.expandedCardContainer, isExpanded && { overflow: 'visible' }]}>
      <TouchableOpacity activeOpacity={0.8} onPress={toggleExpand} style={s.statCard}>
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <View style={s.statCardHeader}>
            <Text style={s.statLabel}>Strength Score</Text>
            <Ionicons name="trophy-outline" size={20} color="#000" />
          </View>
          <Text style={s.statValue}>{headline}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={s.statUnit}>Tier</Text>
            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color="#999" />
          </View>
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={s.insightPanel}>
          {lifts.length === 0 ? (
            <Text style={s.detailStatText}>
              Log a set on Bench Press, Squat, or Deadlift to see how you compare to general strength standards.
            </Text>
          ) : (
            <View style={{ gap: 6, marginBottom: 4 }}>
              <Text style={s.insightTitle}>By Lift</Text>
              {lifts.map(([liftName, data]) => (
                <Text key={liftName} style={s.detailStatText}>
                  {liftName}: <Text style={{ fontWeight: '700' }}>{data.tier}</Text>
                </Text>
              ))}
              <Text style={{ fontSize: 10, color: '#AAAAAA', marginTop: 4 }}>
                General, estimated standards - not a precise measurement.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  cardContainer: {
    width: CARD_W,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'visible',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
    }),
  },
  expandedCardContainer: {
    width: width - H_PAD * 2,
    overflow: 'visible',
  },
  statCard: {
    padding: 16,
    minHeight: 130,
    justifyContent: 'space-between',
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  statValue: { fontSize: 28, fontWeight: '800', color: '#000' },
  statUnit: { fontSize: 12, color: '#999', marginTop: 2 },
  insightPanel: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    padding: 16,
    paddingBottom: 20,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'visible',
  },
  insightTitle: { fontSize: 14, fontWeight: '800', color: '#000000', marginBottom: 6 },
  detailStatText: { fontSize: 12, color: '#444' },
});
