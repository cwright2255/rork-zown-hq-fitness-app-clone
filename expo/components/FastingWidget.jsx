import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '@/store/userStore';
import { getActiveFast, startFast, endFast } from '@/services/fastingService';

const TARGET_OPTIONS = [16, 18, 20, 24];

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

// Real, new: a live fasting timer, backed by services/fastingService.js
// (a current/active fast document, not a full history - see that
// file's own comment on scope). Elapsed time ticks locally every
// second from the real, stored start time, not re-fetched from
// Firestore on every tick.
export default function FastingWidget() {
  const { user } = useUserStore();
  const [isLoading, setIsLoading] = useState(true);
  const [activeFast, setActiveFast] = useState(null);
  const [now, setNow] = useState(new Date());
  const [selectedTarget, setSelectedTarget] = useState(16);
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

  if (isLoading) {
    return (
      <View style={s.card}>
        <ActivityIndicator size="small" color="#000000" />
      </View>
    );
  }

  if (!activeFast) {
    return (
      <View style={s.card}>
        <View style={s.header}>
          <Ionicons name="timer-outline" size={18} color="#000000" />
          <Text style={s.title}>Fasting Timer</Text>
        </View>
        <Text style={s.emptyText}>Start a fast and this will track your elapsed time toward your target.</Text>
        <View style={s.targetRow}>
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
        <Pressable style={s.startButton} onPress={handleStart}>
          <Text style={s.startButtonText}>Start Fasting</Text>
        </Pressable>
      </View>
    );
  }

  const elapsedMs = now - activeFast.startedAt;
  const targetMs = activeFast.targetHours * 60 * 60 * 1000;
  const progress = Math.min(1, elapsedMs / targetMs);
  const isComplete = elapsedMs >= targetMs;

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Ionicons name="timer-outline" size={18} color="#000000" />
        <Text style={s.title}>Fasting Timer</Text>
      </View>
      <View style={s.activeRow}>
        <View style={s.elapsedWrap}>
          <Text style={s.elapsedText}>{formatElapsed(elapsedMs)}</Text>
          <Text style={s.elapsedSubtext}>
            {isComplete ? `Goal reached! Past your ${activeFast.targetHours}h target` : `of ${activeFast.targetHours}h target`}
          </Text>
        </View>
      </View>
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${progress * 100}%` }, isComplete && s.progressFillComplete]} />
      </View>
      <Pressable style={s.endButton} onPress={handleEnd}>
        <Text style={s.endButtonText}>End Fast</Text>
      </Pressable>
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
  emptyText: { fontSize: 13, color: '#666666', lineHeight: 18, marginBottom: 14 },
  targetRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  targetPill: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F5F5F5', alignItems: 'center' },
  targetPillActive: { backgroundColor: '#000000' },
  targetPillText: { fontSize: 13, fontWeight: '600', color: '#333333' },
  targetPillTextActive: { color: '#FFFFFF' },
  startButton: { backgroundColor: '#000000', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  startButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  activeRow: { alignItems: 'center', marginBottom: 12 },
  elapsedWrap: { alignItems: 'center' },
  elapsedText: { fontSize: 32, fontWeight: '800', color: '#000000' },
  elapsedSubtext: { fontSize: 12, color: '#666666', marginTop: 2 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: '#F0F0F0', overflow: 'hidden', marginBottom: 14 },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#000000' },
  progressFillComplete: { backgroundColor: '#10B981' },
  endButton: { borderWidth: 1, borderColor: '#000000', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  endButtonText: { color: '#000000', fontSize: 14, fontWeight: '700' },
});
