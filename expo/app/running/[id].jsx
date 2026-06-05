import React, { useState, useMemo } from 'react';
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



/* ââ Placeholder data ââ */

const WEEKLY_PLAN = [
  { week: 'W1', title: 'Walk/Run Intervals', desc: 'Run 1 min, Walk 2 min \u00d7 8 sets', duration: '20 min' },
  { week: 'W2', title: 'Building Endurance', desc: 'Run 2 min, Walk 1 min \u00d7 7 sets', duration: '25 min' },
  { week: 'W3', title: 'Longer Runs', desc: 'Run 3 min, Walk 1 min \u00d7 6 sets', duration: '25 min' },
  { week: 'W4', title: 'Pushing Further', desc: 'Run 5 min, Walk 1 min \u00d7 4 sets', duration: '28 min' },
];

const TOOLS = [
  { icon: 'navigate-outline', label: 'Track Distance & Pace with GPS' },
  { icon: 'musical-notes-outline', label: 'Sync with Your Playlists' },
  { icon: 'people-outline', label: 'Connect to Running Community' },
];

/* ââ Stat pill ââ */

function StatPill({ icon, label }) {
  return (
    <View style={styles.statPill}>
      <Ionicons name={icon} size={14} color="#FFF" />
      <Text style={styles.statPillText}>{label}</Text>
    </View>
  );
}

/* ââ Week row ââ */

function WeekRow({ item }) {
  return (
    <View style={styles.weekRow}>
      <View style={styles.weekCircle}>
        <Text style={styles.weekNum}>{item.week}</Text>
      </View>
      <View style={styles.weekInfo}>
        <Text style={styles.weekTitle}>Week {item.week.replace('W', '')}: {item.title}</Text>
        <Text style={styles.weekDesc}>{item.desc}</Text>
      </View>
      <Text style={styles.weekDuration}>{item.duration}</Text>
    </View>
  );
}

/* ââ Tool card ââ */

function ToolCard({ icon, label }) {
  return (
    <View style={styles.toolCard}>
      <View style={styles.toolIcon}>
        <Ionicons name={icon} size={18} color="#FFF" />
      </View>
      <Text style={styles.toolLabel}>{label}</Text>
    </View>
  );
}

/* ââ Main screen ââ */

export default function RunPreviewScreen() {
  const params = useLocalSearchParams();
  const title = params.title || 'Couch to 5K';
  const router = useRouter();

  const [bookmarked, setBookmarked] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState('Motivator');
  const [audioCues, setAudioCues] = useState(true);
  const [hasStarted] = useState(false);

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
        {/* ââ Hero ââ */}
        <View style={styles.hero}>
          <Ionicons name="fitness-outline" size={60} color="#999" />

          {/* High XP badge */}
          <View style={styles.xpBadge}>
            <Text style={styles.xpBadgeText}>High XP</Text>
          </View>

          {/* Back button */}
          <Pressable style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="chevron-back" size={20} color="#000" />
          </Pressable>

          {/* Top-right actions */}
          <View style={styles.topRightActions}>
            <Pressable style={styles.actionBtn} onPress={() => setBookmarked(!bookmarked)}>
              <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={18} color="#000" />
            </Pressable>
            <Pressable style={styles.actionBtn}>
              <Ionicons name="ellipsis-vertical" size={18} color="#000" />
            </Pressable>
          </View>

          {/* Overlay */}
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>{title}</Text>
            <Text style={styles.heroDesc}>Running for Beginners \u2022 12 Week Program</Text>
            <View style={styles.statsRow}>
              <StatPill icon="speedometer-outline" label="6:30 /km" />
              <StatPill icon="time-outline" label="30 min" />
              <StatPill icon="map-outline" label="5K" />
              <StatPill icon="flash-outline" label="+150 XP" />
            </View>
            <View style={styles.overlayBottomRow}>
              <View style={styles.difficultyBadge}>
                <Text style={styles.difficultyText}>BEGINNER</Text>
              </View>
              <Text style={styles.categoryLabel}>Running</Text>
            </View>
          </View>
        </View>

        {/* ââ Audio Coaching ââ */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="headset-outline" size={20} color="#000" />
            <Text style={styles.sectionTitle}>Audio Coaching</Text>
          </View>
          <View style={styles.coachCard}>
            <Text style={styles.coachSelectLabel}>Select Your Coach</Text>
            <View style={styles.coachPills}>
              {['Motivator', 'Calm', 'Technical'].map((c) => (
                <Pressable
                  key={c}
                  style={[styles.coachPill, selectedCoach === c && styles.coachPillActive]}
                  onPress={() => setSelectedCoach(c)}
                >
                  <Text style={[styles.coachPillText, selectedCoach === c && styles.coachPillTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.coachDesc}>
              Audio cues for pace, intervals, and encouragement during your run
            </Text>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Audio Cues Enabled</Text>
              <Pressable style={[styles.toggle, audioCues && styles.toggleActive]} onPress={() => setAudioCues(!audioCues)}>
                <View style={[styles.toggleCircle, audioCues && styles.toggleCircleActive]} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ââ Program Details ââ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Program Details</Text>
          <Text style={styles.descriptionText}>
            The first place to visit for anyone looking to start running. Provides a heap of good
            advice for those wanting to run 5K. Go from the couch to running for 30 minutes in
            just 12 weeks with structured intervals and audio coaching.
          </Text>
          <Pressable>
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        </View>

        {/* ââ Weekly Plan ââ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly Plan</Text>
          {WEEKLY_PLAN.map((item) => (
            <WeekRow key={item.week} item={item} />
          ))}
        </View>

        {/* ââ Race Training Tools ââ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Race Training Tools</Text>
          <View style={styles.toolsStack}>
            {TOOLS.map((t) => (
              <ToolCard key={t.icon} icon={t.icon} label={t.label} />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* ââ Floating CTA ââ */}
      <Pressable
        style={styles.ctaButton}
        onPress={() => router.push('/running/active')}
      >
        <Text style={styles.ctaText}>{hasStarted ? 'Continue Run' : 'Start Run'}</Text>
        <Ionicons name={hasStarted ? 'play-forward' : 'play'} size={22} color="#FFF" />
      </Pressable>
    </View>
  );
}

/* ââ Styles ââ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 120 },

  /* Hero */
  hero: {
    height: 320,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  xpBadge: {
    position: 'absolute', top: 100, left: 16,
    backgroundColor: '#E8873A', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, zIndex: 10,
  },
  xpBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
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
  topRightActions: { position: 'absolute', top: 50, right: 16, flexDirection: 'row', gap: 8, zIndex: 10 },
  actionBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center',
  },

  /* Sections */
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000' },

  /* Audio coaching */
  coachCard: { backgroundColor: '#F5F5F5', borderRadius: 14, padding: 16, marginTop: 10 },
  coachSelectLabel: { fontSize: 15, fontWeight: '600', color: '#000' },
  coachPills: { flexDirection: 'row', gap: 8, marginTop: 8 },
  coachPill: { backgroundColor: '#E5E5E5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  coachPillActive: { backgroundColor: '#000' },
  coachPillText: { fontSize: 12, fontWeight: '600', color: '#333' },
  coachPillTextActive: { color: '#FFF' },
  coachDesc: { fontSize: 13, color: '#666', marginTop: 10 },
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

  /* Description */
  descriptionText: { fontSize: 14, color: '#444', lineHeight: 22, marginTop: 8 },
  seeAll: { fontSize: 14, fontWeight: '600', color: '#000', marginTop: 6 },

  /* Weekly plan */
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

  /* Tools */
  toolsStack: { gap: 10, marginTop: 10 },
  toolCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F5', borderRadius: 12, padding: 14, gap: 12,
  },
  toolIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#000',
    justifyContent: 'center', alignItems: 'center',
  },
  toolLabel: { fontSize: 14, fontWeight: '600', color: '#000' },

  /* CTA */
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
