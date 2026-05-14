import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import StatCard from '@/components/StatCard';
import RunningMap from '@/components/RunningMap';
import { useWorkoutStore } from '@/store/workoutStore';
import { tokens } from '../../../../theme/tokens';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

export default function RunningSessionDetailScreen() {
  const params = useLocalSearchParams();
  const sessionId = typeof params.id === 'string' ? params.id : '';
  const programId = typeof params.programId === 'string' ? params.programId : '';

  const { runningPrograms } = useWorkoutStore();
  const [session, setSession] = useState(null);
  const [program, setProgram] = useState(null);

  useEffect(() => {
    const foundProgram = (runningPrograms || []).find(p => p.id === programId);
    if (foundProgram) {
      setProgram(foundProgram);
      const foundSession = foundProgram.sessions?.find(s => s.id === sessionId);
      setSession(foundSession || null);
    }
  }, [sessionId, programId, runningPrograms]);

  const handleEndRun = () => {
    router.back();
  };

  const distance = session?.distance || '3.2';
  const pace = session?.pace || '5:42';
  const duration = session?.duration || '18:23';
  const calories = session?.calories || '284';

  return (
    <View style={styles.container}>
      <ScreenHeader showBack title={session?.name || 'Run'} />

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.mapWrap}>
          {RunningMap ? <RunningMap /> : <View style={styles.mapPh} />}
        </View>

        <View style={{ padding: 16 }}>
          <View style={styles.statsCard}>
            <View style={styles.statsRow}>
              <StatCard value={`${distance}`} label="KM" />
              <StatCard value={pace} label="PACE /KM" />
            </View>
            <View style={[styles.statsRow, { marginTop: 12 }]}>
              <StatCard value={duration} label="DURATION" />
              <StatCard value={calories} label="KCAL" />
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <PrimaryButton title="End Run" onPress={handleEndRun} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.grayscale.black },
  mapWrap: { width: '100%', height: 320, backgroundColor: tokens.colors.ink.darker },
  mapPh: { flex: 1 },
  statsCard: {
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 12,
  },
  statsRow: { flexDirection: 'row', gap: 12 },
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 24 },
});
