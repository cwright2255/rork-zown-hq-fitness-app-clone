import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Dimensions, Platform, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '@/store/userStore';
import { getActiveFast, startFast, endFast } from '@/services/fastingService';

// Real fix: rebuilt to match the exact, established card structure every
// other widget on this screen uses (same size/shape as Calories, Heart,
// etc., collapsed to one headline value + tap-to-expand) - the original
// version was a full-width, differently-structured card. See
// StrengthScoreWidget.jsx's own comment on why the style values here
// are duplicated rather than shared with app/hq.jsx.
const { width } = Dimensions.get('window');
const CARD_GAP = 12;
const H_PAD = 22;
const CARD_W = (width - H_PAD * 2 - CARD_GAP) / 2;

const TARGET_OPTIONS = [16, 18, 20, 24];

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

export default function FastingWidget() {
  const { user } = useUserStore();
  const [isLoading, setIsLoading] = useState(true);
  const [activeFast, setActiveFast] = useState(null);
  const [now, setNow] = useState(new Date());
  const [selectedTarget, setSelectedTarget] = useState(16);
  const [isExpanded, setIsExpanded] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.uid) {
        setIsLoading(false);
        return;
      }
      try {
        const fast = await getActiveFast(user.uid);
        if (!cancelled) setActiveFast(fast);
      } catch (e) {
        console.warn('[FastingWidget] failed to load:', e?.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid]);

  useEffect(() => {
    if (!activeFast) return;
    intervalRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(intervalRef.current);
  }, [activeFast]);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((v) => !v);
  };

  const handleStart = async () => {
    if (!user?.uid) return;
    await startFast(user.uid, selectedTarget);
    setActiveFast({ startedAt: new Date(), targetHours: selectedTarget });
  };

  const handleEnd = async () => {
    if (!user?.uid) return;
    await endFast(user.uid);
    setActiveFast(null);
  };

  const elapsedMs = activeFast ? now - activeFast.startedAt : 0;
  const headline = isLoading ? '\u2014' : (activeFast ? formatElapsed(elapsedMs) : '\u2014');

  return (
    <View style={[s.cardContainer, isExpanded && s.expandedCardContainer, isExpanded && { overflow: 'visible' }]}>
      <TouchableOpacity activeOpacity={0.8} onPress={toggleExpand} style={s.statCard}>
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <View style={s.statCardHeader}>
            <Text style={s.statLabel}>Fasting Timer</Text>
            <Ionicons name="timer-outline" size={20} color="#000" />
          </View>
          <Text style={s.statValue}>{headline}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={s.statUnit}>{activeFast ? `of ${activeFast.targetHours}h` : 'Elapsed'}</Text>
            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color="#999" />
          </View>
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={s.insightPanel}>
          {!activeFast ? (
            <View>
              <Text style={s.insightTitle}>Start a Fast</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                {TARGET_OPTIONS.map((hrs) => (
                  <Pressable
                    key={hrs}
                    style={[s.targetPill, selectedTarget === hrs && s.targetPillActive]}
                    onPress={() => setSelectedTarget(hrs)}
                  >
                    <Text style={[s.targetPillText, selectedTarget === hrs && s.targetPillTextActive]}>{hrs}h</Text>
                  </Pressable>
                ))}
              </View>
              <TouchableOpacity style={s.panelBtn} onPress={handleStart}>
                <Text style={s.panelBtnText}>Start Fasting</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={s.detailStatText}>
                Target: <Text style={{ fontWeight: '700' }}>{activeFast.targetHours}h</Text>
              </Text>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${Math.min(100, (elapsedMs / (activeFast.targetHours * 3600000)) * 100)}%` }]} />
              </View>
              <TouchableOpacity style={[s.panelBtn, { marginTop: 12 }]} onPress={handleEnd}>
                <Text style={s.panelBtnText}>End Fast</Text>
              </TouchableOpacity>
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
  panelBtn: {
    backgroundColor: '#000000',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  panelBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  targetPill: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F5F5F5', alignItems: 'center' },
  targetPillActive: { backgroundColor: '#000000' },
  targetPillText: { fontSize: 12, fontWeight: '600', color: '#333333' },
  targetPillTextActive: { color: '#FFFFFF' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#E5E5E5', marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#000' },
});
