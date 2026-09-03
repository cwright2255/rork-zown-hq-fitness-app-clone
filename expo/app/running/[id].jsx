import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRunningStore } from '@/store/runningStore';
import { useUserStore } from '@/store/userStore';
import MuscleHeatmapCard from '@/components/MuscleHeatmapCard';
import { getTargetMuscles } from '@/lib/muscleFatigue';

function summarizeIntervals(intervals) {
  const runIv = intervals.find((iv) => iv.type === 'run');
  const walkIv = intervals.find((iv) => iv.type === 'walk');
  const reps = intervals.filter((iv) => iv.type === 'run').length;
  const fmt = (secs) => (secs % 60 === 0 ? `${secs / 60} min` : `${secs} sec`);
  if (!walkIv) return `Run ${fmt(runIv?.seconds || 0)} continuous`;
  return `Run ${fmt(runIv.seconds)}, Walk ${fmt(walkIv.seconds)} x ${reps}`;
}

function StatPill({ icon, label }) {
  return (
    <View style={styles.statPill}>
      <Ionicons name={icon} size={14} color="#FFF" />
      <Text style={styles.statPillText}>{label}</Text>
    </View>
  );
}

function WeekRow({ item, onPress }) {
  return (
    <Pressable style={styles.weekRow} onPress={onPress}>
      <View style={styles.weekCircle}>
        <Text style={styles.weekNum}>{item.week}</Text>
      </View>
      <View style={styles.weekInfo}>
        <Text style={styles.weekTitle}>Week {item.week.replace('W', '')}: {item.title}</Text>
        <Text style={styles.weekDesc}>{item.desc}</Text>
      </View>
      <Text style={styles.weekDuration}>{item.duration}</Text>
      <Ionicons name="chevron-forward" size={18} color="#999" style={{ marginLeft: 6 }} />
    </Pressable>
  );
}

export default function RunPreviewScreen() {
  const params = useLocalSearchParams();
  const programId = typeof params.id === 'string' ? params.id : 'c25k';
  const router = useRouter();

  const { programProgress, loadRuns, programs, loadRunningPrograms, favoriteProgramIds } = useRunningStore();
  const program = programs.find((p) => p.id === programId);
  const isFavorited = favoriteProgramIds.includes(programId);
  const title = program?.title || 'Program';
  const { user } = useUserStore();

  useEffect(() => {
    if (user?.uid) loadRuns(user.uid);
  }, [user?.uid]);

  useEffect(() => {
    loadRunningPrograms();
  }, []);

  const progress = programProgress[programId];
  const currentWeek = progress?.currentWeek || 1;
  const nextSessionIndex = progress?.completedSessionIndexes?.length || 0;
  const hasStarted = !!progress;

  const [audioCues, setAudioCues] = useState(true);

  const weeklyPlan = (program?.weeks || []).map((w) => {
    const seconds = w.intervals
      ? w.intervals.reduce((s, iv) => s + iv.seconds, 0)
      : w.sessionOverrides
        ? w.sessionOverrides[0].reduce((s, iv) => s + iv.seconds, 0)
        : w.targetDistanceKm ? null : 0;
    const duration = seconds != null
      ? `${Math.round(seconds / 60)} min`
      : `${w.targetDistanceKm} km`;
    const desc = w.intervals
      ? summarizeIntervals(w.intervals)
      : w.sessionOverrides
        ? 'Varies by session'
        : `${w.targetDistanceKm}km continuous run`;
    return { week: `W${w.week}`, title: w.title, desc, duration };
  });

  const weekCount = program?.weeks?.length || 0;
  const sessionsPerWeek = program?.weeks?.[0]?.sessionsPerWeek;

  // Real progress across the whole program, not just the current week -
  // programProgress only directly tracks completedSessionIndexes within
  // the CURRENT week, so full-program completion is derived: every
  // session from weeks already passed (assumes a user completes a week
  // before advancing, matching how currentWeek actually increments)
  // plus the current week's own real tracked completions. Correctly
  // resolves to 0 when the program hasn't been started at all.
  const totalSessions = (program?.weeks || []).reduce((sum, w) => sum + (w.sessionsPerWeek || 0), 0);
  const completedSessions = (program?.weeks || [])
    .filter((w) => w.week < currentWeek)
    .reduce((sum, w) => sum + (w.sessionsPerWeek || 0), 0)
    + (progress?.completedSessionIndexes?.length || 0);
  const progressPercent = totalSessions > 0 ? Math.min(100, Math.round((completedSessions / totalSessions) * 100)) : 0;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/running/program');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Ionicons name="fitness-outline" size={60} color="#999" />

          <Pressable style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="chevron-back" size={20} color="#000" />
          </Pressable>

          <Pressable
            style={styles.favoriteBtn}
            onPress={() => useRunningStore.getState().toggleFavoriteProgram(programId, user?.uid)}
          >
            <Ionicons name={isFavorited ? 'bookmark' : 'bookmark-outline'} size={18} color="#000" />
          </Pressable>

          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>{title}</Text>
            <Text style={styles.heroDesc}>{program?.subtitle || ''}</Text>
            <View style={styles.statsRow}>
              {weekCount > 0 && <StatPill icon="calendar-outline" label={`${weekCount} Weeks`} />}
              {sessionsPerWeek != null && <StatPill icon="repeat-outline" label={`${sessionsPerWeek}x / week`} />}
            </View>
            <View style={styles.overlayBottomRow}>
              {program?.level && (
                <View style={styles.difficultyBadge}>
                  <Text style={styles.difficultyText}>{program.level.toUpperCase()}</Text>
                </View>
              )}
              <Text style={styles.categoryLabel}>Running</Text>
            </View>
          </View>
        </View>

        {hasStarted && (
          <View style={styles.section}>
            <View style={styles.progressHeaderRow}>
              <Text style={styles.sectionTitle}>Progress</Text>
              <Text style={styles.progressCount}>{completedSessions}/{totalSessions} sessions</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="headset-outline" size={20} color="#000" />
            <Text style={styles.sectionTitle}>Audio Coaching</Text>
          </View>
          <View style={styles.coachCard}>
            <Text style={styles.coachDesc}>
              Voice cues for run/walk intervals during your session, powered by the same real
              coaching system used on the active run screen.
            </Text>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Audio Cues Enabled</Text>
              <Pressable style={[styles.toggle, audioCues && styles.toggleActive]} onPress={() => setAudioCues(!audioCues)}>
                <View style={[styles.toggleCircle, audioCues && styles.toggleCircleActive]} />
              </Pressable>
            </View>
          </View>
        </View>

        {program?.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Program Details</Text>
            <Text style={styles.descriptionText}>{program.description}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly Plan</Text>
          {weeklyPlan.map((item) => (
            <WeekRow
              key={item.week}
              item={item}
              onPress={() => router.push(`/running/week/${programId}-${item.week.toLowerCase()}`)}
            />
          ))}
        </View>

        <View style={styles.section}>
          <MuscleHeatmapCard mode="target" targetMuscles={getTargetMuscles('running')} title="Muscles You'll Work" />
        </View>
      </ScrollView>

      <Pressable
        style={styles.ctaButton}
        onPress={() => {
          if (!hasStarted) useRunningStore.getState().startProgram(programId, user?.uid);
          router.push({
            pathname: '/running/session/[id]',
            params: {
              id: `${programId}-w${currentWeek}-s${nextSessionIndex}`,
              programId,
              week: String(currentWeek),
              sessionIndex: String(nextSessionIndex),
              audioCues: String(audioCues),
            },
          });
        }}
      >
        <Text style={styles.ctaText}>{hasStarted ? 'Continue Program' : 'Start Program'}</Text>
        <Ionicons name={hasStarted ? 'play-forward' : 'play'} size={22} color="#FFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 120 },

  hero: {
    height: 320,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  heroOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingBottom: 14, paddingTop: 65,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  heroDesc: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 10 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statPillText: { fontSize: 12, color: '#FFF' },
  overlayBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  difficultyBadge: { backgroundColor: '#E8873A', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  difficultyText: { fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 1 },
  categoryLabel: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  backBtn: {
    position: 'absolute', top: 50, left: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center', zIndex: 10,
  },
  favoriteBtn: {
    position: 'absolute', top: 50, right: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center', zIndex: 10,
  },

  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  progressHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  progressCount: { fontSize: 14, color: '#999' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#E5E5E5', overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: '#000' },

  coachCard: { backgroundColor: '#F5F5F5', borderRadius: 14, padding: 16, marginTop: 10 },
  coachDesc: { fontSize: 13, color: '#666' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  toggleLabel: { fontSize: 14, color: '#000' },
  toggle: {
    width: 44, height: 24, borderRadius: 12,
    backgroundColor: '#E5E5E5', justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleActive: { backgroundColor: '#000' },
  toggleCircle: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF',
  },
  toggleCircleActive: { alignSelf: 'flex-end' },

  descriptionText: { fontSize: 14, color: '#444', lineHeight: 22, marginTop: 8 },

  weekRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  weekCircle: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F0F0',
    justifyContent: 'center', alignItems: 'center',
  },
  weekNum: { fontSize: 14, fontWeight: '700', color: '#000' },
  weekInfo: { flex: 1, marginLeft: 12 },
  weekTitle: { fontSize: 15, fontWeight: '600', color: '#000' },
  weekDesc: { fontSize: 12, color: '#999', marginTop: 2 },
  weekDuration: { fontSize: 13, color: '#666' },

  ctaButton: {
    position: 'absolute', bottom: 24, left: 24, right: 24,
    height: 52, borderRadius: 26, backgroundColor: '#000',
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    zIndex: 100,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: -2 } },
      android: { elevation: 8 },
      default: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: -2 } },
    }),
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
