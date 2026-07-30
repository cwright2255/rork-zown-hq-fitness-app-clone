import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { VIRTUAL_CHALLENGES } from '@/store/virtualChallengeStore';
import { useRunningStore } from '@/store/runningStore';
import { useUserStore } from '@/store/userStore';



/* ââ Static placeholder data ââ */

function SectionHeader({ title, onViewAll }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onViewAll && (
        <Pressable onPress={onViewAll}>
          <Text style={styles.viewAll}>View All</Text>
        </Pressable>
      )}
    </View>
  );
}

/* ââ Cards ââ */

function ProgramCard({ item }) {
  return (
    <Pressable
      style={styles.programCard}
      onPress={() => {
        router.push(`/running/${item.id}`);
      }}
    >
      <View style={styles.programImage}>
        <Ionicons name="calendar-outline" size={28} color="#999" />
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
    </Pressable>
  );
}

function ChallengeCard({ item }) {
  return (
    <Pressable
      style={styles.raceCard}
      onPress={() => Alert.alert('Coming Soon', 'Virtual challenges (real-world route distances tracked from your actual runs) are coming soon.')}
    >
      <View style={styles.raceThumbnail}>
        <Ionicons name="trophy-outline" size={32} color="#999" />
        <View style={styles.dateBadge}>
          <Text style={styles.dateText}>Soon</Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardSubtitle}>{item.distanceKm}km • {item.region}</Text>
    </Pressable>
  );
}

function StatBox({ value, label }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statBoxValue}>{value}</Text>
      <Text style={styles.statBoxLabel}>{label}</Text>
    </View>
  );
}

export default function RunningScreen() {
  const { getPersonalRecords, loadRuns, programs, loadRunningPrograms } = useRunningStore();
  const { user } = useUserStore();
  const [records, setRecords] = useState({ longestRun: null, fastestPace: null, best5k: null, totalDistance: 0 });

  useEffect(() => {
    if (user?.uid) {
      loadRuns(user.uid).then(() => setRecords(getPersonalRecords()));
    }
  }, [user?.uid]);

  useEffect(() => {
    loadRunningPrograms();
  }, []);

  const fmtPace = (secPerKm) => {
    if (!secPerKm) return '--';
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${m}'${String(s).padStart(2, '0')}"`;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Zown logo */}
        <View style={styles.logoRow}>
          <Image
            source={require('@/assets/branding/zown-logo-512.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Page title */}
        <Text style={styles.pageTitle}>Running</Text>

        {/* Real personal records -- computed from actual run history, not
            a fake "Featured Runs" carousel of workouts nobody has done. */}
        <SectionHeader title="Your Stats" />
        <View style={styles.statsRow}>
          <StatBox value={records.totalDistance ? `${records.totalDistance.toFixed(1)} km` : '--'} label="Total Distance" />
          <StatBox value={records.longestRun ? `${records.longestRun.distance.toFixed(1)} km` : '--'} label="Longest Run" />
          <StatBox value={fmtPace(records.fastestPace?.pace)} label="Best Pace" />
        </View>

        {/* Running Programs -- real content from data/runningPrograms.js */}
        <SectionHeader title="Running Programs" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          {programs.map((item) => (
            <ProgramCard key={item.id} item={item} />
          ))}
        </ScrollView>

        {/* Hiking -- real nearby trails via Google Places, see
            services/hikingService.js. Fully functional, not gated. */}
        <Pressable style={styles.hikingBanner} onPress={() => router.push('/running/hiking')}>
          <View style={styles.hikingBannerIcon}>
            <Ionicons name="walk-outline" size={22} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.hikingBannerTitle}>Hiking Near You</Text>
            <Text style={styles.hikingBannerSubtitle}>Real local trails, with directions to the trailhead</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#999" />
        </Pressable>

        {/* Virtual Challenges -- real distance model exists (see
            store/virtualChallengeStore.js) but gated behind "Coming Soon"
            here on purpose: this kind of feature typically ships a
            physical medal/reward on completion (see The Conqueror as the
            reference), and there's no fulfillment vendor or shipping
            logistics set up for that yet. Shipping the tracking mechanic
            while implying a reward that can't be fulfilled would be worse
            than not shipping it. */}
        <SectionHeader title="Virtual Challenges" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          {VIRTUAL_CHALLENGES.map((item) => (
            <ChallengeCard key={item.id} item={item} />
          ))}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  logoRow: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  logo: {
    width: 120,
    height: 36,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000',
    marginBottom: 20,
    paddingHorizontal: 20,
  },

  /* Section header */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statBoxValue: { fontSize: 17, fontWeight: '800', color: '#000' },
  statBoxLabel: { fontSize: 11, color: '#999', marginTop: 2, textAlign: 'center' },

  hikingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, marginBottom: 24,
    backgroundColor: '#F5F5F5', borderRadius: 16, padding: 14,
  },
  hikingBannerIcon: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#22C55E',
    alignItems: 'center', justifyContent: 'center',
  },
  hikingBannerTitle: { fontSize: 15, fontWeight: '700', color: '#000' },
  hikingBannerSubtitle: { fontSize: 12, color: '#999', marginTop: 2 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  viewAll: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },

  /* Carousel */
  carousel: {
    paddingLeft: 20,
    paddingRight: 6,
    marginBottom: 24,
  },

  /* Featured cards */
  featuredCard: {
    width: 200,
    marginRight: 14,
  },
  featuredImage: {
    height: 120,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Program cards */
  programCard: {
    width: 160,
    marginRight: 14,
  },
  programImage: {
    height: 100,
    borderRadius: 14,
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Race cards */
  raceCard: {
    width: 220,
    marginRight: 14,
  },
  raceThumbnail: {
    height: 130,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  dateBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dateText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },

  /* Shared card text */
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginTop: 8,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
});
