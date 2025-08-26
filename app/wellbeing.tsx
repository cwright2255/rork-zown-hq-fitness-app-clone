import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Smile, Watch, Wifi, WifiOff, RefreshCw, Brain, Heart, Moon, TrendingUp, Calendar, CheckCircle, Activity as ActivityIcon, Target, Scale, AlertTriangle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { wearableService, WearableData, WearableDevice } from '@/services/wearableService';
import { MoodEntry } from '@/types';

interface MoodStats {
  averageMood: number;
  averageEnergy: number;
  averageStress: number;
  averageSleep: number;
  moodTrend: 'improving' | 'declining' | 'stable';
  streakDays: number;
}

export default function WellbeingScreen() {
  const [activeTab, setActiveTab] = useState<'overview' | 'insights' | 'assessment'>('overview');

  const [connectedDevices, setConnectedDevices] = useState<WearableDevice[]>([]);
  const [wearableConnected, setWearableConnected] = useState<boolean>(false);
  const [wearableDataSource, setWearableDataSource] = useState<string>('');
  const [dataConfidence, setDataConfidence] = useState<number>(0);
  const [isLoadingWearableData, setIsLoadingWearableData] = useState<boolean>(false);

  const [todayMood, setTodayMood] = useState<number>(3);
  const [todayEnergy, setTodayEnergy] = useState<number>(3);
  const [todayStress, setTodayStress] = useState<number>(3);
  const [todaySleep, setTodaySleep] = useState<number>(3);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [latestData, setLatestData] = useState<WearableData | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState<boolean>(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

  const moodEmojis = ['😢', '😕', '😐', '😊', '😄'] as const;
  const energyEmojis = ['🔋', '🔋', '🔋', '🔋', '🔋'] as const;
  const stressEmojis = ['😌', '😐', '😰', '😫', '🤯'] as const;
  const sleepEmojis = ['😴', '😪', '😐', '😊', '✨'] as const;

  useEffect(() => {
    try {
      const devices = wearableService.getConnectedDevices();
      setConnectedDevices(Array.isArray(devices) ? devices : []);
      const isConnected = devices && devices.length > 0;
      setWearableConnected(!!isConnected);
      if (isConnected) setWearableDataSource(devices[0]?.name ?? 'Wearable');
    } catch (e) {
      console.log('init wearable devices error', e);
      setConnectedDevices([]);
      setWearableConnected(false);
    }
  }, []);

  const loadWearableMoodData = useCallback(async () => {
    if (!wearableConnected) return;
    setIsLoadingWearableData(true);
    try {
      const moodData = await wearableService.getMoodDataFromWearables();
      if (moodData) {
        setTodayMood(moodData.mood);
        setTodayEnergy(moodData.energy);
        setTodayStress(moodData.stress);
        setTodaySleep(moodData.sleep);
        setDataConfidence(moodData.confidence);
        setWearableDataSource(moodData.dataSource);
        const autoTags: string[] = [];
        if (moodData.mood >= 4) autoTags.push('Happy');
        if (moodData.energy >= 4) autoTags.push('Energetic');
        if (moodData.stress <= 2) autoTags.push('Calm');
        if (moodData.sleep >= 4) autoTags.push('Well-rested');
        if (moodData.stress >= 4) autoTags.push('Stressed');
        if (moodData.energy <= 2) autoTags.push('Tired');
        setSelectedTags(autoTags);
      }
    } catch (e) {
      console.log('loadWearableMoodData error', e);
    } finally {
      setIsLoadingWearableData(false);
    }
  }, [wearableConnected]);

  useEffect(() => {
    loadWearableMoodData();
  }, [loadWearableMoodData]);

  const handleConnectWearable = () => router.push('/wearables');
  const handleRefreshWearableData = () => {
    if (wearableConnected) loadWearableMoodData();
  };

  const moodEntries = useMemo<MoodEntry[]>(() => ([
    { id: '1', date: '2024-01-15', mood: 4, energy: 3, stress: 2, sleep: 4, notes: 'Great workout today! Feeling accomplished.', tags: ['Happy', 'Energetic', 'Motivated'] },
    { id: '2', date: '2024-01-14', mood: 3, energy: 2, stress: 4, sleep: 2, notes: 'Stressful day at work, did not sleep well.', tags: ['Stressed', 'Tired'] },
    { id: '3', date: '2024-01-13', mood: 5, energy: 4, stress: 1, sleep: 5, notes: 'Perfect day! Everything went smoothly.', tags: ['Happy', 'Calm', 'Grateful'] },
  ]), []);

  const moodStats: MoodStats = useMemo(() => {
    if (moodEntries.length === 0) {
      return { averageMood: 0, averageEnergy: 0, averageStress: 0, averageSleep: 0, moodTrend: 'stable', streakDays: 0 };
    }
    const recent = moodEntries.slice(0, 7);
    const averageMood = recent.reduce((s, e) => s + e.mood, 0) / recent.length;
    const averageEnergy = recent.reduce((s, e) => s + e.energy, 0) / recent.length;
    const averageStress = recent.reduce((s, e) => s + e.stress, 0) / recent.length;
    const averageSleep = recent.reduce((s, e) => s + e.sleep, 0) / recent.length;
    let trend: MoodStats['moodTrend'] = 'stable';
    if (recent.length >= 3) {
      const recentAvg = recent.slice(0, 3).reduce((s, e) => s + e.mood, 0) / 3;
      const olderAvg = recent.slice(3, 6).reduce((s, e) => s + e.mood, 0) / Math.min(3, Math.max(1, recent.length - 3));
      if (recentAvg > olderAvg + 0.5) trend = 'improving';
      else if (recentAvg < olderAvg - 0.5) trend = 'declining';
    }
    return { averageMood, averageEnergy, averageStress, averageSleep, moodTrend: trend, streakDays: moodEntries.length };
  }, [moodEntries]);

  const saveTodayEntry = () => {
    const entry: MoodEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      mood: todayMood,
      energy: todayEnergy,
      stress: todayStress,
      sleep: todaySleep,
      notes: `[Auto-generated from ${wearableDataSource} with ${dataConfidence}% confidence]`,
      tags: selectedTags,
    };
    console.log('Wellbeing save mood entry', entry);
    Alert.alert('Saved', 'Your wearable-derived mood entry has been saved.');
  };

  const syncAssessment = useCallback(async () => {
    try {
      setAssessmentLoading(true);
      setAssessmentError(null);
      const devices = wearableService.getConnectedDevices();
      if (!devices || devices.length === 0) {
        setAssessmentError('No connected wearables. Connect a device to continue.');
        setLatestData(null);
        return;
      }
      const primary = devices[0];
      const data = await wearableService.syncData(primary.id);
      if (!data) {
        setAssessmentError('Failed to sync from wearable.');
        setLatestData(null);
        return;
      }
      setLatestData(data);
    } catch (e) {
      console.log('syncAssessment error', e);
      setAssessmentError('Something went wrong while syncing.');
      setLatestData(null);
    } finally {
      setAssessmentLoading(false);
      try {
        const list = wearableService.getConnectedDevices();
        setConnectedDevices(Array.isArray(list) ? list : []);
      } catch {}
    }
  }, []);

  const assessmentBlocks = useMemo(() => {
    if (!latestData) return [] as Array<{ key: string; label: string; scorePct: number; color: string; icon: React.ReactNode; recs: string[] }>;

    const toPct = (score: number, max: number) => Math.round((score / max) * 100);

    const fitness = (() => {
      let s = 0; const m = 5;
      if ((latestData.steps ?? 0) >= 8000) s += 2; else if ((latestData.steps ?? 0) >= 5000) s += 1;
      if ((latestData.activeMinutes ?? 0) >= 45) s += 2; else if ((latestData.activeMinutes ?? 0) >= 20) s += 1;
      if ((latestData.heartRate ?? 0) > 0) s += 1;
      return { pct: toPct(Math.min(s, m), m), recs: s >= 4 ? ['Great activity levels—maintain variety.'] : ['Add an extra 20–30 min session.'] };
    })();

    const sleep = (() => {
      let s = 0; const m = 5;
      if ((latestData.sleepHours ?? 0) >= 7 && (latestData.sleepHours ?? 0) <= 9) s += 3; else if ((latestData.sleepHours ?? 0) >= 6) s += 1;
      if ((latestData.sleepQuality ?? 0) >= 4) s += 2; else if ((latestData.sleepQuality ?? 0) >= 3) s += 1;
      return { pct: toPct(Math.min(s, m), m), recs: s >= 4 ? ['Keep a stable 7–9h window.'] : ['Target 7–9h and improve wind-down.'] };
    })();

    const recovery = (() => {
      let s = 0; const m = 5;
      if ((latestData.hrv ?? 0) > 40) s += 2; else if ((latestData.hrv ?? 0) >= 30) s += 1;
      if ((latestData.recoveryScore ?? 0) >= 80 || (latestData.readinessScore ?? 0) >= 80) s += 3; else if ((latestData.recoveryScore ?? 0) >= 65 || (latestData.readinessScore ?? 0) >= 65) s += 1;
      return { pct: toPct(Math.min(s, m), m), recs: s >= 4 ? ['Recovery looks strong.'] : ['Prioritize sleep and easy movement.'] };
    })();

    const stress = (() => {
      let normalized: number;
      if (typeof latestData.stressLevel === 'number') normalized = Math.max(1, Math.min(5, latestData.stressLevel));
      else {
        let s = 3;
        if ((latestData.hrv ?? 0) < 25) s += 1; else if ((latestData.hrv ?? 0) > 40) s -= 1;
        if ((latestData.restingHeartRate ?? 0) > 70) s += 0.5; else if ((latestData.restingHeartRate ?? 0) > 0 && (latestData.restingHeartRate ?? 0) < 55) s -= 0.5;
        if ((latestData.recoveryScore ?? 0) > 0 && (latestData.recoveryScore ?? 0) < 60) s += 0.5;
        normalized = Math.round(Math.max(1, Math.min(5, s)));
      }
      const score = 6 - normalized; const max = 5;
      const pct = toPct(Math.max(0, Math.min(score, max)), max);
      return { pct, recs: pct >= 80 ? ['Nice stress balance—continue habits.'] : ['Try 5 min box breathing.'] };
    })();

    const cardio = (() => {
      let s = 0; const m = 5;
      if ((latestData.restingHeartRate ?? 0) > 0) { if ((latestData.restingHeartRate ?? 0) < 60) s += 3; else if ((latestData.restingHeartRate ?? 0) <= 70) s += 2; else s += 1; }
      if ((latestData.distance ?? 0) >= 3) s += 1;
      if ((latestData.calories ?? 0) >= 1800) s += 1;
      return { pct: toPct(Math.min(s, m), m), recs: s >= 4 ? ['Cardio markers solid.'] : ['Add 2x zone-2 sessions weekly.'] };
    })();

    return [
      { key: 'fitness', label: 'Fitness', scorePct: fitness.pct, color: '#10B981', icon: <ActivityIcon size={24} color="#10B981" />, recs: fitness.recs },
      { key: 'sleep', label: 'Sleep', scorePct: sleep.pct, color: '#06B6D4', icon: <Target size={24} color="#06B6D4" />, recs: sleep.recs },
      { key: 'recovery', label: 'Recovery', scorePct: recovery.pct, color: '#8B5CF6', icon: <Scale size={24} color="#8B5CF6" />, recs: recovery.recs },
      { key: 'stress', label: 'Stress', scorePct: stress.pct, color: '#F59E0B', icon: <Brain size={24} color="#F59E0B" />, recs: stress.recs },
      { key: 'cardio', label: 'Cardio', scorePct: cardio.pct, color: '#EF4444', icon: <Heart size={24} color="#EF4444" />, recs: cardio.recs },
    ];
  }, [latestData]);

  const renderWearableStatus = () => (
    <Card variant="elevated" style={styles.wearableCard}>
      <View style={styles.wearableHeader}>
        <Watch size={20} color={wearableConnected ? Colors.success : Colors.text.secondary} />
        <Text style={styles.wearableTitle}>{wearableConnected ? 'Wearable Connected' : 'No Wearable Connected'}</Text>
        {wearableConnected ? <Wifi size={16} color={Colors.success} /> : <WifiOff size={16} color={Colors.text.secondary} />}
      </View>
      {wearableConnected ? (
        <View style={styles.wearableInfo}>
          <Text style={styles.wearableSource}>Data from: {wearableDataSource}</Text>
          <Text style={styles.wearableConfidence}>Confidence: {dataConfidence}%</Text>
          <View style={styles.wearableControls}>
            <TouchableOpacity style={styles.refreshButton} onPress={handleRefreshWearableData} disabled={isLoadingWearableData} testID="refreshWearableBtn">
              {isLoadingWearableData ? <ActivityIndicator size="small" color={Colors.primary} /> : <RefreshCw size={16} color={Colors.primary} />}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.wearableInfo}>
          <Text style={styles.wearableDescription}>Connect a wearable device to automatically track mood and health metrics.</Text>
          <Button title="Connect Wearable" onPress={handleConnectWearable} style={styles.connectButton} variant="outline" testID="connectWearableBtn" />
        </View>
      )}
    </Card>
  );

  const OverviewTab = () => (
    <ScrollView style={styles.content} testID="overviewTab">
      {renderWearableStatus()}
      {wearableConnected ? (
        <Card variant="elevated" style={styles.todayCard}>
          <View style={styles.todayHeader}>
            <Brain size={24} color={Colors.primary} />
            <Text style={styles.todayTitle}>Today from your wearable</Text>
          </View>
          {isLoadingWearableData ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading from {wearableDataSource}…</Text>
            </View>
          ) : (
            <>
              <View style={styles.wearableDataContainer}>
                <View style={styles.wearableMetric}>
                  <Text style={styles.metricLabel}>Mood</Text>
                  <Text style={styles.metricEmoji}>{moodEmojis[todayMood - 1]}</Text>
                  <Text style={styles.metricValue}>{todayMood}/5</Text>
                </View>
                <View style={styles.wearableMetric}>
                  <Text style={styles.metricLabel}>Energy</Text>
                  <Text style={styles.metricEmoji}>{energyEmojis[todayEnergy - 1]}</Text>
                  <Text style={styles.metricValue}>{todayEnergy}/5</Text>
                </View>
                <View style={styles.wearableMetric}>
                  <Text style={styles.metricLabel}>Stress</Text>
                  <Text style={styles.metricEmoji}>{stressEmojis[todayStress - 1]}</Text>
                  <Text style={styles.metricValue}>{todayStress}/5</Text>
                </View>
                <View style={styles.wearableMetric}>
                  <Text style={styles.metricLabel}>Sleep</Text>
                  <Text style={styles.metricEmoji}>{sleepEmojis[todaySleep - 1]}</Text>
                  <Text style={styles.metricValue}>{todaySleep}/5</Text>
                </View>
              </View>

              {selectedTags.length > 0 && (
                <View style={styles.tagsContainer}>
                  <View style={styles.scaleLabelContainer}>
                    <Text style={styles.tagsLabel}>Auto indicators</Text>
                    <Text style={styles.wearableIndicator}>📱 From {wearableDataSource}</Text>
                  </View>
                  <View style={styles.tagsGrid}>
                    {selectedTags.map((t) => (
                      <View key={t} style={[styles.tagButton, styles.selectedTagButton]}>
                        <Text style={styles.selectedTagText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.confidenceContainer}>
                <Text style={styles.confidenceLabel}>Data confidence</Text>
                <View style={styles.confidenceBar}>
                  <View style={[styles.confidenceFill, { width: `${dataConfidence}%` }]} />
                </View>
                <Text style={styles.confidenceText}>{dataConfidence}% accurate</Text>
              </View>

              <Button title="Save Entry" onPress={saveTodayEntry} style={styles.saveButton} testID="saveMoodEntryBtn" />
            </>
          )}
        </Card>
      ) : (
        <Card variant="elevated" style={styles.noWearableCard}>
          <View style={styles.noWearableContent}>
            <Watch size={48} color={Colors.text.secondary} />
            <Text style={styles.noWearableTitle}>Connect a Wearable Device</Text>
            <Text style={styles.noWearableDescription}>Mood and health insights require a connected device like Apple Watch, Fitbit, or Garmin.</Text>
            <Button title="Connect Device" onPress={handleConnectWearable} style={styles.connectWearableButton} />
          </View>
        </Card>
      )}

      {latestData && (
        <Card variant="elevated" style={styles.snapshotCard}>
          <Text style={styles.sectionTitle}>Latest health snapshot</Text>
          <View style={styles.dataGrid}>
            {typeof latestData.heartRate === 'number' && (
              <View style={styles.dataItem} testID="metric-bpm">
                <Heart size={20} color={Colors.primary} />
                <Text style={styles.dataValue}>{latestData.heartRate}</Text>
                <Text style={styles.dataLabel}>BPM</Text>
              </View>
            )}
            {typeof latestData.steps === 'number' && (
              <View style={styles.dataItem} testID="metric-steps">
                <ActivityIcon size={20} color={Colors.primary} />
                <Text style={styles.dataValue}>{latestData.steps?.toLocaleString?.() ?? latestData.steps}</Text>
                <Text style={styles.dataLabel}>Steps</Text>
              </View>
            )}
            {typeof latestData.sleepHours === 'number' && (
              <View style={styles.dataItem} testID="metric-sleep">
                <Text style={styles.dataIcon}>😴</Text>
                <Text style={styles.dataValue}>{latestData.sleepHours}h</Text>
                <Text style={styles.dataLabel}>Sleep</Text>
              </View>
            )}
            {typeof latestData.hrv === 'number' && (
              <View style={styles.dataItem} testID="metric-hrv">
                <Text style={styles.dataIcon}>💓</Text>
                <Text style={styles.dataValue}>{latestData.hrv}ms</Text>
                <Text style={styles.dataLabel}>HRV</Text>
              </View>
            )}
          </View>
        </Card>
      )}
    </ScrollView>
  );

  const InsightsTab = () => (
    <ScrollView style={styles.content} testID="insightsTab">
      <View style={styles.sectionHeader}>
        <TrendingUp size={20} color={Colors.primary} />
        <Text style={styles.sectionTitle}>Mood Analytics</Text>
      </View>

      <Card variant="elevated" style={styles.insightsCard}>
        <View style={styles.insightsHeader}>
          <TrendingUp size={20} color={Colors.primary} />
          <Text style={styles.insightsTitle}>7-Day Overview</Text>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.modernStatItem}>
            <View style={styles.statIconContainer}><Smile size={18} color={Colors.primary} /></View>
            <Text style={styles.statValue}>{moodStats.averageMood.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Avg Mood</Text>
            <View style={styles.statProgressBar}><View style={[styles.statProgressFill, { width: `${(moodStats.averageMood / 5) * 100}%`, backgroundColor: Colors.primary }]} /></View>
          </View>
          <View style={styles.modernStatItem}>
            <View style={styles.statIconContainer}><Heart size={18} color={Colors.error} /></View>
            <Text style={styles.statValue}>{moodStats.averageEnergy.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Avg Energy</Text>
            <View style={styles.statProgressBar}><View style={[styles.statProgressFill, { width: `${(moodStats.averageEnergy / 5) * 100}%`, backgroundColor: Colors.error }]} /></View>
          </View>
          <View style={styles.modernStatItem}>
            <View style={styles.statIconContainer}><Brain size={18} color={Colors.warning} /></View>
            <Text style={styles.statValue}>{moodStats.averageStress.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Avg Stress</Text>
            <View style={styles.statProgressBar}><View style={[styles.statProgressFill, { width: `${(moodStats.averageStress / 5) * 100}%`, backgroundColor: Colors.warning }]} /></View>
          </View>
          <View style={styles.modernStatItem}>
            <View style={styles.statIconContainer}><Moon size={18} color={Colors.info} /></View>
            <Text style={styles.statValue}>{moodStats.averageSleep.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Avg Sleep</Text>
            <View style={styles.statProgressBar}><View style={[styles.statProgressFill, { width: `${(moodStats.averageSleep / 5) * 100}%`, backgroundColor: Colors.info }]} /></View>
          </View>
        </View>
      </Card>

      <Card variant="elevated" style={styles.historyCard}>
        <View style={styles.sectionHeader}><Calendar size={20} color={Colors.primary} /><Text style={styles.sectionTitle}>Mood History</Text></View>
        {moodEntries.map((entry, index) => (
          <Card key={entry.id} variant="elevated" style={styles.innerHistoryCard}>
            <View style={[styles.historyHeader, { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }]}>
              <View style={styles.historyDateContainer}>
                <Text style={styles.historyDate}>{new Date(entry.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
                <View style={styles.historyDayIndicator}><Text style={styles.historyDayText}>{index === 0 ? 'Today' : `${index + 1} days ago`}</Text></View>
              </View>
              <View style={styles.overallMoodIndicator}><Text style={styles.overallMoodEmoji}>{moodEmojis[entry.mood - 1]}</Text></View>
            </View>
            <View style={styles.historyMetricsContainer}>
              <View style={styles.historyMetric}><View style={styles.metricIconContainer}><Smile size={16} color={Colors.primary} /></View><Text style={styles.metricLabel}>Mood</Text><View style={styles.metricValueContainer}><Text style={styles.metricValue}>{entry.mood}</Text><Text style={styles.metricMaxValue}>/5</Text></View></View>
              <View style={styles.historyMetric}><View style={styles.metricIconContainer}><Heart size={16} color={Colors.error} /></View><Text style={styles.metricLabel}>Energy</Text><View style={styles.metricValueContainer}><Text style={styles.metricValue}>{entry.energy}</Text><Text style={styles.metricMaxValue}>/5</Text></View></View>
              <View style={styles.historyMetric}><View style={styles.metricIconContainer}><Brain size={16} color={Colors.warning} /></View><Text style={styles.metricLabel}>Stress</Text><View style={styles.metricValueContainer}><Text style={styles.metricValue}>{entry.stress}</Text><Text style={styles.metricMaxValue}>/5</Text></View></View>
              <View style={styles.historyMetric}><View style={styles.metricIconContainer}><Moon size={16} color={Colors.info} /></View><Text style={styles.metricLabel}>Sleep</Text><View style={styles.metricValueContainer}><Text style={styles.metricValue}>{entry.sleep}</Text><Text style={styles.metricMaxValue}>/5</Text></View></View>
            </View>
            {entry.tags.length > 0 && (
              <View style={styles.historyTagsContainer}>
                <Text style={styles.tagsHeaderText}>Mood Indicators</Text>
                <View style={styles.historyTags}>
                  {entry.tags.map((tag) => (<View key={tag} style={styles.historyTag}><Text style={styles.historyTagText}>{tag}</Text></View>))}
                </View>
              </View>
            )}
            {entry.notes && (
              <View style={styles.historyNotesContainer}><Text style={styles.notesHeaderText}>Notes</Text><Text style={styles.historyNotes}>{entry.notes}</Text></View>
            )}
          </Card>
        ))}
      </Card>
    </ScrollView>
  );

  const AssessmentTab = () => (
    <ScrollView style={styles.content} testID="assessmentTab">
      <View style={styles.syncBar}>
        <Text style={styles.syncText} numberOfLines={1}>{connectedDevices[0]?.name ?? 'Primary device'} connected</Text>
        <Button title={assessmentLoading ? 'Syncing…' : 'Sync now'} onPress={syncAssessment} disabled={assessmentLoading} testID="syncNowButton" />
      </View>
      {assessmentError && (
        <View style={styles.errorBox}>
          <AlertTriangle size={18} color={Colors.error} />
          <Text style={styles.errorText}>{assessmentError}</Text>
        </View>
      )}
      {assessmentLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Syncing wearable data…</Text>
        </View>
      )}
      {latestData ? (
        <Card variant="elevated" style={styles.resultsCard}>
          <View style={styles.resultsHeader}><CheckCircle size={40} color={Colors.success} /><Text style={styles.resultsTitle}>Assessment Ready</Text></View>
          {assessmentBlocks.map((b) => (
            <Card key={b.key} variant="elevated" style={styles.resultCard}>
              <View style={styles.resultHeader}>{b.icon}<Text style={styles.resultCategory}>{b.label}</Text><Text style={[styles.resultScore, { color: b.color }]}>{b.scorePct}%</Text></View>
              <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${b.scorePct}%`, backgroundColor: b.color }]} /></View>
              <View style={styles.recommendations}><Text style={styles.recommendationsTitle}>Recommendations</Text>{b.recs.map((r, i) => (<Text key={i} style={styles.recommendationText}>• {r}</Text>))}</View>
            </Card>
          ))}
        </Card>
      ) : (
        <Card variant="elevated" style={styles.snapshotCard}>
          <Text style={styles.sectionTitle}>No data yet</Text>
          <Text style={styles.helperText}>Tap the Sync now button to fetch your latest health metrics.</Text>
        </Card>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Wellbeing', headerShown: false }} />
      <View style={styles.header}>
        <Text style={styles.title}>Wellbeing</Text>
        <Smile size={24} color={Colors.primary} />
      </View>
      <View style={styles.tabContainer}>
        {(['overview', 'insights', 'assessment'] as const).map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab)} testID={`tab-${tab}`}>
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'insights' && <InsightsTab />}
      {activeTab === 'assessment' && <AssessmentTab />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card },
  title: { fontSize: 24, fontWeight: 'bold', color: Colors.text.primary },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 20, marginVertical: 16 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8, marginHorizontal: 4 },
  activeTab: { backgroundColor: Colors.primary },
  tabText: { fontSize: 14, fontWeight: '500', color: Colors.text.secondary },
  activeTabText: { color: 'white' },
  content: { flex: 1, paddingHorizontal: 20 },
  wearableCard: { padding: 16, marginBottom: 16 },
  wearableHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  wearableTitle: { fontSize: 16, fontWeight: '600', color: Colors.text.primary, flex: 1 },
  wearableInfo: { gap: 8 },
  wearableSource: { fontSize: 14, color: Colors.text.secondary },
  wearableConfidence: { fontSize: 14, color: Colors.text.secondary },
  wearableDescription: { fontSize: 14, color: Colors.text.secondary, lineHeight: 20, marginBottom: 12 },
  wearableControls: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  refreshButton: { padding: 8, borderRadius: 8, backgroundColor: `${Colors.primary}10` },
  connectButton: { marginTop: 8 },
  todayCard: { padding: 20, marginBottom: 20 },
  todayHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  todayTitle: { fontSize: 18, fontWeight: '600', color: Colors.text.primary, marginLeft: 12 },
  loadingContainer: { alignItems: 'center', paddingVertical: 20, gap: 12 },
  loadingText: { fontSize: 14, color: Colors.text.secondary },
  wearableDataContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, paddingHorizontal: 8 },
  wearableMetric: { alignItems: 'center', flex: 1, paddingVertical: 16, paddingHorizontal: 8, backgroundColor: `${Colors.primary}05`, borderRadius: 12, marginHorizontal: 4 },
  metricLabel: { fontSize: 12, color: Colors.text.secondary, marginBottom: 4 },
  metricEmoji: { fontSize: 20, marginBottom: 4 },
  metricValue: { fontSize: 12, fontWeight: '600', color: Colors.text.primary },
  tagsContainer: { marginBottom: 24 },
  tagsLabel: { fontSize: 16, fontWeight: '500', color: Colors.text.primary, marginBottom: 12 },
  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  selectedTagButton: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  selectedTagText: { color: 'white' },
  scaleLabelContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  wearableIndicator: { fontSize: 12, color: Colors.primary, fontWeight: '500' },
  confidenceContainer: { marginBottom: 24 },
  confidenceLabel: { fontSize: 16, fontWeight: '500', color: Colors.text.primary, marginBottom: 8 },
  confidenceBar: { height: 8, backgroundColor: Colors.border, borderRadius: 4, marginBottom: 8 },
  confidenceFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  confidenceText: { fontSize: 14, color: Colors.text.secondary, textAlign: 'center' },
  saveButton: { marginTop: 8 },
  noWearableCard: { padding: 24, marginBottom: 20, alignItems: 'center' },
  noWearableContent: { alignItems: 'center', gap: 16 },
  noWearableTitle: { fontSize: 20, fontWeight: '600', color: Colors.text.primary, textAlign: 'center' },
  noWearableDescription: { fontSize: 16, color: Colors.text.secondary, textAlign: 'center', lineHeight: 24 },
  connectWearableButton: { marginTop: 8, minWidth: 200 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Colors.spacing?.lg ?? 16, paddingHorizontal: Colors.spacing?.xs ?? 4 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.text.primary, marginLeft: Colors.spacing?.sm ?? 8 },
  insightsCard: { padding: 20, marginBottom: 16 },
  insightsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  insightsTitle: { fontSize: 18, fontWeight: '600', color: Colors.text.primary, marginLeft: 12 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  modernStatItem: { alignItems: 'center', flex: 1, backgroundColor: Colors.backgroundSecondary, borderRadius: Colors.radius?.medium ?? 12, padding: Colors.spacing?.md ?? 12, marginHorizontal: Colors.spacing?.xs ?? 4 },
  statIconContainer: { width: 32, height: 32, borderRadius: 16, backgroundColor: `${Colors.primary}15`, alignItems: 'center', justifyContent: 'center', marginBottom: Colors.spacing?.sm ?? 8 },
  statProgressBar: { width: '100%', height: 4, backgroundColor: Colors.border, borderRadius: 2, marginTop: Colors.spacing?.xs ?? 4, overflow: 'hidden' },
  statProgressFill: { height: '100%', borderRadius: 2 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: Colors.text.primary, marginBottom: 4 },
  statLabel: { fontSize: 12, color: Colors.text.secondary, marginBottom: 4 },
  historyCard: { padding: 16, marginBottom: 16 },
  innerHistoryCard: { padding: 16, marginBottom: 12 },
  historyHeader: { marginBottom: 16 },
  historyDate: { fontSize: 16, fontWeight: '600', color: Colors.text.primary },
  historyDateContainer: { flex: 1 },
  historyDayIndicator: { marginTop: Colors.spacing?.xs ?? 4 },
  overallMoodIndicator: { alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 24, backgroundColor: `${Colors.primary}10` },
  overallMoodEmoji: { fontSize: 24 },
  historyMetricsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Colors.spacing?.lg ?? 16, paddingHorizontal: Colors.spacing?.xs ?? 4 },
  metricIconContainer: { width: 24, height: 24, borderRadius: 12, backgroundColor: `${Colors.primary}10`, alignItems: 'center', justifyContent: 'center', marginBottom: Colors.spacing?.xs ?? 4 },
  metricValueContainer: { flexDirection: 'row', alignItems: 'baseline' },
  metricMaxValue: { fontSize: 10, color: Colors.text.tertiary, marginLeft: 2 },
  historyTagsContainer: { marginBottom: Colors.spacing?.md ?? 12 },
  tagsHeaderText: { fontSize: 14, fontWeight: '500', color: Colors.text.primary, marginBottom: Colors.spacing?.sm ?? 8 },
  historyTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  historyTag: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: `${Colors.primary}20` },
  historyTagText: { fontSize: 12, color: Colors.primary },
  historyNotesContainer: { marginTop: Colors.spacing?.sm ?? 8 },
  notesHeaderText: { fontSize: 14, fontWeight: '500', color: Colors.text.primary, marginBottom: Colors.spacing?.xs ?? 4 },
  historyNotes: { fontSize: 14, color: Colors.text.secondary, fontStyle: 'italic' },
  syncBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, marginBottom: 12 },
  syncText: { fontSize: 14, color: Colors.text.secondary, flex: 1, marginRight: 12 },
  snapshotCard: { padding: 16, marginBottom: 12 },
  dataGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  dataItem: { alignItems: 'center', minWidth: '45%' },
  dataIcon: { fontSize: 20, marginBottom: 4 },
  dataValue: { fontSize: 22, fontWeight: '700', color: Colors.text.primary, marginTop: 4 },
  dataLabel: { fontSize: 12, color: Colors.text.secondary, marginTop: 2 },
  resultsCard: { padding: 16, marginBottom: 16 },
  resultsHeader: { alignItems: 'center', marginBottom: 12 },
  resultsTitle: { fontSize: 20, fontWeight: '700', color: Colors.text.primary, marginTop: 8 },
  resultCard: { marginBottom: 12, padding: 16 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  resultCategory: { fontSize: 16, fontWeight: '600', color: Colors.text.primary, marginLeft: 12, flex: 1 },
  resultScore: { fontSize: 18, fontWeight: '700' },
  progressBar: { height: 8, backgroundColor: Colors.inactive, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  recommendations: { marginTop: 12 },
  recommendationsTitle: { fontSize: 14, fontWeight: '600', color: Colors.text.primary, marginBottom: 6 },
  recommendationText: { fontSize: 13, color: Colors.text.secondary, lineHeight: 18, marginBottom: 2 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  errorText: { color: Colors.error, fontSize: 14, marginLeft: 8, flex: 1 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  helperText: { fontSize: 13, color: Colors.text.secondary },
});