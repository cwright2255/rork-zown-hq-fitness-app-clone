// app/running/races/index.jsx
//
// Virtual Races: everything on offer, on one page. An introduction, how it works, the
// timed races (a Local 5K every week and a Worldwide 10K every month,
// lib/virtualRaces.js) and the journeys along real routes (lib/virtualJourneys.js),
// as cards like the ones on the Running screen, and the questions people ask.
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '@/store/userStore';
import { useVirtualChallengeStore } from '@/store/virtualChallengeStore';
import { RACE_KINDS } from '@/lib/virtualRaces';
import { JOURNEYS } from '@/lib/virtualJourneys';
import VirtualRaceCard from '@/components/VirtualRaceCard';
import JourneyCard from '@/components/JourneyCard';

const STEPS = [
  { title: 'Choose a race', text: 'Pick a timed race or a journey, open it and tap Join.' },
  { title: 'Run or walk with Zown', text: 'Record your run or walk in Zown and the distance is counted for you.' },
  { title: 'Earn XP and a badge', text: 'Cross the line or finish the route to earn XP and a badge. Timed races also put your time on the board.' },
];

const QUESTIONS = [
  {
    q: 'What counts?',
    a: 'A timed race counts a run only, and the full distance must be done in one run. A journey counts every run and walk you record after you join, added together.',
  },
  {
    q: 'Is there a medal?',
    a: 'No physical medal. You earn XP and a badge: Race Day for a timed race and Trailblazer for a journey.',
  },
  {
    q: 'Can I join more than one?',
    a: 'Yes. A run or walk adds to every journey you have joined. A timed race needs its own run at the right distance.',
  },
  {
    q: 'Who can see my results?',
    a: 'Your finishing times on the timed races are shown to other Zown users, unless you turn off Show in Leaderboards in Settings. Your journey progress is private to you.',
  },
];

export default function VirtualRacesScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const { width } = useWindowDimensions();
  const tileWidth = Math.floor((width - 40 - 14) / 2); // two cards a row, 20 in from each side

  useEffect(() => {
    useVirtualChallengeStore.getState().loadChallenges(user?.uid); // does nothing without a person
  }, [user?.uid]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()} accessibilityLabel="Back" testID="races-back">
          <Ionicons name="chevron-back" size={22} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>Virtual Races</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle} testID="races-hero">Pick a finish line. Then chase it.</Text>
          <Text style={styles.heroText}>
            Race the clock against runners near you and around the world, or travel a famous route one run at a time. Every mile gets a purpose.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>How it works</Text>
        <View style={styles.steps} testID="races-steps">
          {STEPS.map((step, i) => (
            <View key={step.title} style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{i + 1}</Text></View>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Timed races</Text>
        <Text style={styles.sectionText}>A new Local 5K starts every Monday and a new Worldwide 10K every month. Fastest time wins.</Text>
        <View style={styles.grid} testID="races-timed">
          {RACE_KINDS.map((kind) => (
            <VirtualRaceCard key={kind} kind={kind} width={tileWidth} />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Journeys</Text>
        <Text style={styles.sectionText}>Pick a route. Every run and walk you record adds up along it, with milestones on the way.</Text>
        <View style={styles.grid} testID="races-journeys">
          {JOURNEYS.map((journey) => (
            <JourneyCard key={journey.id} journey={journey} width={tileWidth} />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Questions</Text>
        <View style={styles.questions} testID="races-questions">
          {QUESTIONS.map((item) => (
            <View key={item.q} style={styles.question}>
              <Text style={styles.questionTitle}>{item.q}</Text>
              <Text style={styles.questionText}>{item.a}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#000' },
  content: { paddingBottom: 100 },

  hero: { marginHorizontal: 20, marginTop: 8, marginBottom: 24, backgroundColor: '#F5F5F5', borderRadius: 20, padding: 20 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#000' },
  heroText: { fontSize: 14, color: '#666', marginTop: 8, lineHeight: 20 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000', paddingHorizontal: 20, marginBottom: 8 },
  sectionText: { fontSize: 13, color: '#666', lineHeight: 19, paddingHorizontal: 20, marginBottom: 12 },

  steps: { paddingHorizontal: 20, gap: 14, marginBottom: 28, marginTop: 4 },
  step: { flexDirection: 'row', gap: 12 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: 13, fontWeight: '800', color: '#FFF' },
  stepBody: { flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: '700', color: '#000' },
  stepText: { fontSize: 13, color: '#666', marginTop: 2, lineHeight: 19 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingLeft: 20, rowGap: 16, marginBottom: 28 },

  questions: { paddingHorizontal: 20, gap: 16, marginTop: 4 },
  question: {},
  questionTitle: { fontSize: 15, fontWeight: '700', color: '#000' },
  questionText: { fontSize: 13, color: '#666', marginTop: 2, lineHeight: 19 },
});
