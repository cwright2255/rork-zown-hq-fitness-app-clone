import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, SafeAreaView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';



/* ââ Static placeholder data ââ */

const FEATURED_RUNS = [
  { id: 'r1', title: '5K Tempo Run', subtitle: '30 min \u2022 Intermediate' },
  { id: 'r2', title: 'Hill Sprints', subtitle: '20 min \u2022 Advanced' },
  { id: 'r3', title: 'Long Distance', subtitle: '60 min \u2022 Beginner' },
  { id: 'r4', title: 'Interval Training', subtitle: '25 min \u2022 Advanced' },
  { id: 'r5', title: 'Recovery Jog', subtitle: '35 min \u2022 Beginner' },
];

const PROGRAMS = [
  { id: 'p1', title: 'Couch to 5K', subtitle: '8 weeks \u2022 3x/week' },
  { id: 'p2', title: '10K Training', subtitle: '12 weeks \u2022 4x/week' },
  { id: 'p3', title: 'Marathon Prep', subtitle: '16 weeks \u2022 5x/week' },
  { id: 'p4', title: 'Speed Builder', subtitle: '6 weeks \u2022 3x/week' },
  { id: 'p5', title: 'Trail Running', subtitle: '10 weeks \u2022 3x/week' },
];

const VIRTUAL_RACES = [
  { id: 'v1', title: 'Spring 5K', distance: '5K', date: 'Jun 15' },
  { id: 'v2', title: 'City Half Marathon', distance: '21.1K', date: 'Jul 4' },
  { id: 'v3', title: 'Beach Run 10K', distance: '10K', date: 'Aug 20' },
  { id: 'v4', title: 'Mountain Trail', distance: '15K', date: 'Sep 10' },
  { id: 'v5', title: 'Charity Fun Run', distance: '5K', date: 'Oct 1' },
];

/* ââ Section header ââ */

function SectionHeader({ title, onViewAll }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable onPress={onViewAll}>
        <Text style={styles.viewAll}>View All</Text>
      </Pressable>
    </View>
  );
}

/* ââ Cards ââ */

function FeaturedCard({ item }) {
  return (
    <Pressable
      style={styles.featuredCard}
      onPress={() => {
        // TODO: navigate to run detail
        router.push({ pathname: `/running/${item.id}`, params: { title: item.title } });
      }}
    >
      <View style={styles.featuredImage}>
        <Ionicons name="fitness-outline" size={32} color="#999" />
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
    </Pressable>
  );
}

function ProgramCard({ item }) {
  return (
    <Pressable
      style={styles.programCard}
      onPress={() => {
        // TODO: navigate to running program detail
        router.push({ pathname: `/running/${item.id}`, params: { title: item.title } });
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

function RaceCard({ item }) {
  return (
    <Pressable
      style={styles.raceCard}
      onPress={() => {
        // TODO: navigate to virtual race detail
      }}
    >
      <View style={styles.raceThumbnail}>
        <Ionicons name="trophy-outline" size={32} color="#999" />
        <View style={styles.dateBadge}>
          <Text style={styles.dateText}>{item.date}</Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardSubtitle}>{item.distance}</Text>
    </Pressable>
  );
}

/* ââ Main screen ââ */

export default function RunningScreen() {
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

        {/* Carousel 1 - Featured Runs */}
        <SectionHeader
          title="Featured Runs"
          onViewAll={() => {
            // TODO: navigate to filtered runs list
          }}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          {FEATURED_RUNS.map((item) => (
            <FeaturedCard key={item.id} item={item} />
          ))}
        </ScrollView>

        {/* Carousel 2 - Running Programs */}
        <SectionHeader
          title="Running Programs"
          onViewAll={() => {
            // TODO: navigate to running programs list
          }}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          {PROGRAMS.map((item) => (
            <ProgramCard key={item.id} item={item} />
          ))}
        </ScrollView>

        {/* Carousel 3 - Virtual Races */}
        <SectionHeader
          title="Virtual Races"
          onViewAll={() => {
            // TODO: navigate to virtual races list
          }}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          {VIRTUAL_RACES.map((item) => (
            <RaceCard key={item.id} item={item} />
          ))}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ââ Styles ââ */

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
