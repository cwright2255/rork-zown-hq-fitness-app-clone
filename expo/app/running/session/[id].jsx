// app/running/session/[id].jsx
//
// Preview + launch screen for one specific day within a running program
// (e.g. "Couch to 5K, Week 3"). Previously read `runningPrograms` from
// store/workoutStore.js, which was emptied out earlier this session as
// fake mock data — meaning `foundProgram` was always undefined here, and
// the screen always fell back to hardcoded placeholder stats ("3.2km,
// 5:42 pace...") regardless of which session was actually opened. It also
// never launched a real run at all — "End Run" just navigated back.
//
// Rewritten to show the real interval structure from data/runningPrograms.js
// and to actually start app/running/active.jsx in program (interval) mode.
//
// Styling rebuilt to plain hex colors, matching every other screen in
// this app - the previous version imported a `theme/tokens` "dark_navy"
// token set that doesn't match this app's real design system anywhere
// else, and had a real, confirmed bug from it: intervalText, weekTitle,
// and distanceGoal were all colored with the SAME token used for the
// screen's own background (tokens.colors.dark_navy.text_primary),
// making that text genuinely invisible (same color as its own
// background) regardless of what that token actually resolved to.

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { getProgram, getProgramWeek, getSessionIntervals } from '@/data/runningPrograms';

function formatMinSec(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')}`;
}

export default function RunningSessionDetailScreen() {
  const params = useLocalSearchParams();
  const programId = typeof params.programId === 'string' ? params.programId : '';
  const weekNumber = params.week ? parseInt(params.week, 10) : 1;
  const sessionIndex = params.sessionIndex ? parseInt(params.sessionIndex, 10) : 0;

  const program = getProgram(programId);
  const week = getProgramWeek(programId, weekNumber);
  const intervals = getSessionIntervals(programId, weekNumber, sessionIndex);

  const audioCuesDefault = params.audioCues !== 'false';

  const handleStart = () => {
    router.push({
      pathname: '/running/active',
      params: {
        programId, week: String(weekNumber), sessionIndex: String(sessionIndex),
        audioCues: String(audioCuesDefault),
      },
    });
  };

  if (!program || !week) {
    return (
      <View style={styles.container}>
        <ScreenHeader showBack title="Session" variant="light" />
        <View style={styles.center}>
          <Text style={styles.emptyText}>Session not found.</Text>
        </View>
      </View>
    );
  }

  const totalSeconds = intervals ? intervals.reduce((s, iv) => s + iv.seconds, 0) : 0;
  const runSeconds = intervals ? intervals.filter((iv) => iv.type === 'run').reduce((s, iv) => s + iv.seconds, 0) : 0;

  return (
    <View style={styles.container}>
      <ScreenHeader showBack title={`${program.title} — Week ${weekNumber}`} variant="light" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.weekTitle}>{week.title}</Text>
        <Text style={styles.sessionMeta}>
          Session {sessionIndex + 1} of {week.sessionsPerWeek} • {formatMinSec(totalSeconds)} total
          {runSeconds > 0 && `, ${formatMinSec(runSeconds)} running`}
        </Text>

        {intervals ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Interval Plan</Text>
            {intervals.map((iv, i) => (
              <View key={i} style={styles.intervalRow}>
                <View style={[styles.intervalDot, iv.type === 'run' ? styles.dotRun : styles.dotWalk]} />
                <Text style={styles.intervalText}>{iv.cue}</Text>
                <Text style={styles.intervalDuration}>{formatMinSec(iv.seconds)}</Text>
              </View>
            ))}
          </View>
        ) : week.targetDistanceKm ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Target</Text>
            <Text style={styles.distanceGoal}>{week.targetDistanceKm} km continuous run</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        <PrimaryButton title="Start Session" onPress={handleStart} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#999', fontSize: 14 },
  scrollContent: { padding: 20, paddingBottom: 180 },
  weekTitle: { color: '#000', fontSize: 20, fontWeight: '700' },
  sessionMeta: { color: '#999', fontSize: 13, marginTop: 4, marginBottom: 16 },
  card: {
    backgroundColor: '#F5F5F5', borderRadius: 14, padding: 16,
  },
  cardLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase',
    color: '#999', marginBottom: 10,
  },
  intervalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  intervalDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  dotRun: { backgroundColor: '#22C55E' },
  dotWalk: { backgroundColor: '#4A90D9' },
  intervalText: { flex: 1, color: '#000', fontSize: 14, fontWeight: '600' },
  intervalDuration: { color: '#999', fontSize: 13 },
  distanceGoal: { color: '#000', fontSize: 24, fontWeight: '700' },
  // Real fix: this screen's path (/running/session/[id], two segments)
  // doesn't match app/_layout.jsx's nav-bar exclusion regex for
  // /running/ (which only excludes single-segment paths), so the bottom
  // nav bar genuinely, correctly stays visible here - but this button
  // was positioned at bottom: 24, well behind it. Now bottom: 100,
  // matching the same "nav bar visible, floating button needs to clear
  // it" situation already handled correctly in app/wearables.jsx.
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 100 },
});
