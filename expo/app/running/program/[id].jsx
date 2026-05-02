import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Check } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { useWorkoutStore } from '@/store/workoutStore';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';
import { tokens } from '../../../../theme/tokens';

export default function RunningProgramDetailScreen() {
  const params = useLocalSearchParams();
  const programId = typeof params.id === 'string' ? params.id : '';
  const { runningPrograms, startProgram, activeProgram } = useWorkoutStore();

  const [program, setProgram] = useState(null);

  useEffect(() => {
    const found = (runningPrograms || []).find(p => p.id === programId);
    setProgram(found || null);
  }, [programId, runningPrograms]);

  if (!program) {
    return (
      <View style={styles.container}>
        <ScreenHeader showBack />
        <View style={styles.center}>
          <Text style={styles.empty}>Program not found</Text>
        </View>
      </View>
    );
  }

  const weeks = program.duration || 8;
  const sessions = program.sessions || [];
  const isActive = activeProgram?.id === program.id;

  const handleStart = () => {
    try {
      startProgram?.(program.id);
      Alert.alert('Started', `${program.name} is now your active program.`);
    } catch (e) {
      Alert.alert('Error', 'Unable to start program.');
    }
  };

  const sessionsByWeek = {};
  sessions.forEach(s => {
    const w = s.week || 1;
    (sessionsByWeek[w] = sessionsByWeek[w] || []).push(s);
  });

  return (
    <View style={styles.container}>
      <ScreenHeader showBack />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <Text style={styles.title}>{program.name}</Text>
        {program.description ? (
          <Text style={styles.desc}>{program.description}</Text>
        ) : null}

        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Text style={styles.metaText}>{weeks} weeks</Text>
          </View>
          <View style={styles.metaChip}>
            <Text style={styles.metaText}>{sessions.length} sessions</Text>
          </View>
          {program.difficulty ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaText}>{program.difficulty}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionLabel}>Schedule</Text>
        {Object.keys(sessionsByWeek).sort((a, b) => +a - +b).map(week => (
          <View key={week} style={styles.weekCard}>
            <Text style={styles.weekLabel}>Week {week}</Text>
            {sessionsByWeek[week].map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.sessionRow}
                onPress={() =>
                  router.push(`/running/session/${s.id}?programId=${program.id}`)
                }>
                <View style={styles.dayBadge}>
                  <Text style={styles.dayText}>Day {s.day || ''}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionName}>{s.name || `Session ${s.day}`}</Text>
                  {s.description ? (
                    <Text style={styles.sessionDesc} numberOfLines={1}>{s.description}</Text>
                  ) : null}
                </View>
                {s.completed ? <Check size={16} color="#22C55E" /> : null}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottomBar}>
        <PrimaryButton
          title={isActive ? 'Continue Program' : 'Start Program'}
          onPress={handleStart}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.grayscale.black },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#999' },
  title: { color: tokens.colors.background.default, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  desc: { color: '#999', fontSize: 14, lineHeight: 20, marginTop: 8 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  metaChip: {
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  metaText: { color: '#999', fontSize: 12, fontWeight: '600' },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: '#999', marginBottom: 8, marginTop: 24,
  },
  weekCard: {
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 14, marginBottom: 10,
  },
  weekLabel: { color: tokens.colors.background.default, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  sessionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, gap: 10,
    borderTopWidth: 1, borderTopColor: '#2A2A2A',
  },
  dayBadge: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  dayText: { color: '#999', fontSize: 11, fontWeight: '600' },
  sessionName: { color: tokens.colors.background.default, fontSize: 14, fontWeight: '500' },
  sessionDesc: { color: '#999', fontSize: 12, marginTop: 2 },
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 24 },
});
