import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Heart, Activity, Brain, Scale, Target, CheckCircle, Watch, AlertTriangle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import Card from '@/components/Card';
import { wearableService, WearableData, WearableDevice } from '@/services/wearableService';

interface WearableAssessmentResult {
  category: string;
  score: number;
  maxScore: number;
  recommendations: string[];
  icon: React.ReactNode;
  color: string;
}

export default function HealthAssessmentScreen() {
  const [connectedDevices, setConnectedDevices] = useState<WearableDevice[]>([]);
  const [latestData, setLatestData] = useState<WearableData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadConnected = useCallback(() => {
    try {
      const list = wearableService.getConnectedDevices();
      setConnectedDevices(Array.isArray(list) ? list : []);
    } catch (e) {
      console.log('loadConnected error', e);
      setConnectedDevices([]);
    }
  }, []);

  const syncFromPrimary = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const devices = wearableService.getConnectedDevices();
      if (!devices || devices.length === 0) {
        setError('No connected wearables. Connect a device to continue.');
        setLatestData(null);
        return;
      }
      const primary = devices[0];
      console.log('Syncing from primary device', primary?.name);
      const data = await wearableService.syncData(primary.id);
      if (!data) {
        setError('Failed to sync from wearable.');
        setLatestData(null);
        return;
      }
      setLatestData(data);
    } catch (e) {
      console.log('syncFromPrimary error', e);
      setError('Something went wrong while syncing.');
      setLatestData(null);
    } finally {
      setIsLoading(false);
      loadConnected();
    }
  }, [loadConnected]);

  useEffect(() => {
    loadConnected();
  }, [loadConnected]);

  const results: WearableAssessmentResult[] = useMemo(() => {
    if (!latestData) return [];

    const fitnessScore = (() => {
      let score = 0;
      let max = 5;
      if ((latestData.steps ?? 0) >= 8000) score += 2; else if ((latestData.steps ?? 0) >= 5000) score += 1;
      if ((latestData.activeMinutes ?? 0) >= 45) score += 2; else if ((latestData.activeMinutes ?? 0) >= 20) score += 1;
      if ((latestData.heartRate ?? 0) > 0) score += 1;
      return { score: Math.min(score, max), max };
    })();

    const sleepScore = (() => {
      let score = 0;
      let max = 5;
      if ((latestData.sleepHours ?? 0) >= 7 && (latestData.sleepHours ?? 0) <= 9) score += 3; else if ((latestData.sleepHours ?? 0) >= 6) score += 1;
      if ((latestData.sleepQuality ?? 0) >= 4) score += 2; else if ((latestData.sleepQuality ?? 0) >= 3) score += 1;
      return { score: Math.min(score, max), max };
    })();

    const recoveryScore = (() => {
      let score = 0;
      let max = 5;
      if ((latestData.hrv ?? 0) > 40) score += 2; else if ((latestData.hrv ?? 0) >= 30) score += 1;
      if ((latestData.recoveryScore ?? 0) >= 80 || (latestData.readinessScore ?? 0) >= 80) score += 3; else if ((latestData.recoveryScore ?? 0) >= 65 || (latestData.readinessScore ?? 0) >= 65) score += 1;
      return { score: Math.min(score, max), max };
    })();

    const stressScore = (() => {
      let score = 0;
      const max = 5;
      let normalized: number;
      if (typeof latestData.stressLevel === 'number') {
        normalized = Math.max(1, Math.min(5, latestData.stressLevel));
      } else {
        let s = 3;
        if ((latestData.hrv ?? 0) < 25) s += 1; else if ((latestData.hrv ?? 0) > 40) s -= 1;
        if ((latestData.restingHeartRate ?? 0) > 70) s += 0.5; else if ((latestData.restingHeartRate ?? 0) > 0 && (latestData.restingHeartRate ?? 0) < 55) s -= 0.5;
        if ((latestData.recoveryScore ?? 0) > 0 && (latestData.recoveryScore ?? 0) < 60) s += 0.5;
        normalized = Math.round(Math.max(1, Math.min(5, s)));
      }
      score = 6 - normalized;
      return { score: Math.max(0, Math.min(score, max)), max };
    })();

    const cardioScore = (() => {
      let score = 0;
      let max = 5;
      if ((latestData.restingHeartRate ?? 0) > 0) {
        if ((latestData.restingHeartRate ?? 0) < 60) score += 3; else if ((latestData.restingHeartRate ?? 0) <= 70) score += 2; else score += 1;
      }
      if ((latestData.distance ?? 0) >= 3) score += 1;
      if ((latestData.calories ?? 0) >= 1800) score += 1;
      return { score: Math.min(score, max), max };
    })();

    const build = (label: string, pack: { score: number; max: number }, icon: React.ReactNode, color: string, recs: string[]): WearableAssessmentResult => ({
      category: label,
      score: pack.score,
      maxScore: pack.max,
      icon,
      color,
      recommendations: recs,
    });

    const recFitness = fitnessScore.score >= 4 ? [
      'Great activity levels—maintain variety and progressive overload.',
      'Keep active minutes above 45 on most days.',
    ] : fitnessScore.score >= 2 ? [
      'Add one extra 20–30 min session this week.',
      'Aim for 8k steps on 5 days.',
    ] : [
      'Start with daily 15–20 min walks.',
      'Use reminders to stand and move hourly.',
    ];

    const recSleep = sleepScore.score >= 4 ? [
      'Keep a stable 7–9h window and wind-down routine.',
      'Avoid screens 60 min before bed.',
    ] : [
      'Target 7–9h in a cool, dark room.',
      'Keep caffeine earlier in the day.',
    ];

    const recRecovery = recoveryScore.score >= 4 ? [
      'Recovery looks strong—schedule hard days strategically.',
      'Maintain hydration and protein intake.',
    ] : [
      'Prioritize sleep and low-intensity movement today.',
      'Consider breathwork to improve HRV.',
    ];

    const recStress = stressScore.score >= 4 ? [
      'Nice stress balance—continue current habits.',
    ] : [
      'Take 5 minutes for box breathing (4-4-4-4).',
      'A 10-minute walk can reduce stress quickly.',
    ];

    const recCardio = cardioScore.score >= 4 ? [
      'Cardio markers solid—maintain consistency.',
    ] : [
      'Add 2x zone-2 cardio sessions (20–30 min).',
      'Track resting HR weekly to see trends.',
    ];

    return [
      build('Fitness', fitnessScore, <Activity size={24} color="#10B981" />, '#10B981', recFitness),
      build('Sleep', sleepScore, <Target size={24} color="#06B6D4" />, '#06B6D4', recSleep),
      build('Recovery', recoveryScore, <Scale size={24} color="#8B5CF6" />, '#8B5CF6', recRecovery),
      build('Stress', stressScore, <Brain size={24} color="#F59E0B" />, '#F59E0B', recStress),
      build('Cardio', cardioScore, <Heart size={24} color="#EF4444" />, '#EF4444', recCardio),
    ];
  }, [latestData]);

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>Health Assessment</Text>
      <Text style={styles.subtitle}>Powered by your connected wearables</Text>
    </View>
  );

  const renderConnectState = () => (
    <Card variant="elevated" style={styles.connectCard}>
      <View style={styles.connectRow}>
        <Watch size={28} color={Colors.primary} />
        <View style={styles.connectInfo}>
          <Text style={styles.connectTitle}>Connect a wearable</Text>
          <Text style={styles.connectText}>Sync Apple Watch, Fitbit, Garmin, or Oura for an automatic assessment.</Text>
        </View>
      </View>
      <Button
        title="Manage Wearables"
        onPress={() => router.push('/wearables')}
        style={styles.manageBtn}
        testID="manageWearablesButton"
      />
    </Card>
  );

  const renderSyncBar = () => (
    <View style={styles.syncBar}>
      <Text style={styles.syncText} numberOfLines={1}>
        {connectedDevices[0]?.name ?? 'Primary device'} connected
      </Text>
      <Button title={isLoading ? 'Syncing…' : 'Sync now'} onPress={syncFromPrimary} disabled={isLoading} testID="syncNowButton" />
    </View>
  );

  const renderLatestSnapshot = () => (
    <Card variant="elevated" style={styles.snapshotCard}>
      <Text style={styles.sectionTitle}>Latest snapshot</Text>
      <View style={styles.dataGrid}>
        {typeof latestData?.heartRate === 'number' && (
          <View style={styles.dataItem} testID="metric-bpm">
            <Heart size={20} color={Colors.primary} />
            <Text style={styles.dataValue}>{latestData.heartRate}</Text>
            <Text style={styles.dataLabel}>BPM</Text>
          </View>
        )}
        {typeof latestData?.steps === 'number' && (
          <View style={styles.dataItem} testID="metric-steps">
            <Activity size={20} color={Colors.primary} />
            <Text style={styles.dataValue}>{latestData.steps?.toLocaleString?.() ?? latestData.steps}</Text>
            <Text style={styles.dataLabel}>Steps</Text>
          </View>
        )}
        {typeof latestData?.sleepHours === 'number' && (
          <View style={styles.dataItem} testID="metric-sleep">
            <Text style={styles.dataIcon}>😴</Text>
            <Text style={styles.dataValue}>{latestData.sleepHours}h</Text>
            <Text style={styles.dataLabel}>Sleep</Text>
          </View>
        )}
        {typeof latestData?.hrv === 'number' && (
          <View style={styles.dataItem} testID="metric-hrv">
            <Text style={styles.dataIcon}>💓</Text>
            <Text style={styles.dataValue}>{latestData.hrv}ms</Text>
            <Text style={styles.dataLabel}>HRV</Text>
          </View>
        )}
      </View>
    </Card>
  );

  const renderResults = () => (
    <ScrollView style={styles.resultsContainer} testID="resultsScroll">
      <View style={styles.resultsHeader}>
        <CheckCircle size={48} color={Colors.success} />
        <Text style={styles.resultsTitle}>Assessment Ready</Text>
        <Text style={styles.resultsSubtitle}>Derived from your wearable metrics</Text>
      </View>

      {results.map((result, idx) => (
        <Card key={idx} variant="elevated" style={styles.resultCard}>
          <View style={styles.resultHeader}>
            {result.icon}
            <Text style={styles.resultCategory}>{result.category}</Text>
            <Text style={[styles.resultScore, { color: result.color }]}>
              {Math.round((result.score / result.maxScore) * 100)}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(result.score / result.maxScore) * 100}%`, backgroundColor: result.color }]} />
          </View>
          <View style={styles.recommendations}>
            <Text style={styles.recommendationsTitle}>Recommendations</Text>
            {result.recommendations.map((rec, i) => (
              <Text key={i} style={styles.recommendationText}>• {rec}</Text>
            ))}
          </View>
        </Card>
      ))}

      <Button title="Return to Profile" onPress={() => router.back()} style={styles.returnButton} testID="returnToProfileButton" />
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Health Assessment', headerShown: false }} />
      {renderHeader()}

      {!connectedDevices.length ? (
        <ScrollView style={styles.content} testID="connectState">
          {renderConnectState()}
        </ScrollView>
      ) : (
        <ScrollView style={styles.content} testID="assessmentState">
          {renderSyncBar()}
          {error && (
            <View style={styles.errorBox}>
              <AlertTriangle size={18} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {isLoading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>Syncing wearable data…</Text>
            </View>
          )}
          {latestData && renderLatestSnapshot()}
          {latestData ? renderResults() : (
            <Card variant="elevated" style={styles.snapshotCard}>
              <Text style={styles.sectionTitle}>No data yet</Text>
              <Text style={styles.helperText}>Tap the Sync now button to fetch your latest health metrics.</Text>
            </Card>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 12,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  connectCard: {
    padding: 16,
  },
  connectRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectInfo: {
    marginLeft: 12,
    flex: 1,
  },
  connectTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  connectText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  manageBtn: {
    marginTop: 12,
  },
  syncBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 12,
  },
  syncText: {
    fontSize: 14,
    color: Colors.text.secondary,
    flex: 1,
    marginRight: 12,
  },
  snapshotCard: {
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginBottom: 12,
  },
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  dataItem: {
    alignItems: 'center',
    minWidth: '45%',
  },
  dataIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  dataValue: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text.primary,
    marginTop: 4,
  },
  dataLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  resultsContainer: {
    flex: 1,
  },
  resultsHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  resultsTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text.primary,
    marginTop: 12,
    marginBottom: 6,
  },
  resultsSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  resultCard: {
    marginBottom: 12,
    padding: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultCategory: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginLeft: 12,
    flex: 1,
  },
  resultScore: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.inactive,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  recommendations: {
    marginTop: 12,
  },
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginBottom: 6,
  },
  recommendationText: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
    marginBottom: 2,
  },
  returnButton: {
    marginTop: 16,
    marginBottom: 24,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  helperText: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
});