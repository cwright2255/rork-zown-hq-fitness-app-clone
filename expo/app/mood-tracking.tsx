import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { TrendingUp, Brain, Heart, Smile, Watch, Wifi, WifiOff, RefreshCw, Calendar, BarChart3, Target, Moon } from 'lucide-react-native';
import Colors from '@/constants/colors';

import { useUserStore } from '@/store/userStore';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { MoodEntry } from '@/types';
import { wearableService } from '@/services/wearableService';

interface UserStoreState {
  user: {
    lastMoodEntry?: any;
    [key: string]: any;
  } | null;
  updateUser: (updates: Record<string, any>) => void;
}

interface MoodStats {
  averageMood: number;
  averageEnergy: number;
  averageStress: number;
  averageSleep: number;
  moodTrend: 'improving' | 'declining' | 'stable';
  streakDays: number;
}

const moodEmojis = ['😢', '😕', '😐', '😊', '😄'];
const energyEmojis = ['🔋', '🔋', '🔋', '🔋', '🔋'];
const stressEmojis = ['😌', '😐', '😰', '😫', '🤯'];
const sleepEmojis = ['😴', '😪', '😐', '😊', '✨'];

export default function MoodTrackingScreen() {
  const { user, updateUser } = useUserStore() as UserStoreState;
  const [activeTab, setActiveTab] = useState<'today' | 'history' | 'insights'>('today');
  
  // Wearable integration state
  const [isLoadingWearableData, setIsLoadingWearableData] = useState(false);
  const [wearableConnected, setWearableConnected] = useState(false);
  const [wearableDataSource, setWearableDataSource] = useState<string>('');
  const [dataConfidence, setDataConfidence] = useState(0);
  const [useWearableData] = useState(true);
  
  // Today's mood entry state
  const [todayMood, setTodayMood] = useState(3);
  const [todayEnergy, setTodayEnergy] = useState(3);
  const [todayStress, setTodayStress] = useState(3);
  const [todaySleep, setTodaySleep] = useState(3);
  const [todayNotes, setTodayNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Check for connected wearables on component mount
  useEffect(() => {
    const initializeWearableData = async () => {
      checkWearableConnection();
      if (useWearableData) {
        await loadWearableMoodData();
      }
    };
    initializeWearableData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useWearableData]);

  const checkWearableConnection = () => {
    const connectedDevices = wearableService.getConnectedDevices();
    setWearableConnected(connectedDevices.length > 0);
    if (connectedDevices.length > 0) {
      setWearableDataSource(connectedDevices[0].name);
    }
  };

  const loadWearableMoodData = async () => {
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
        
        // Auto-generate tags based on wearable data
        const autoTags: string[] = [];
        if (moodData.mood >= 4) autoTags.push('Happy');
        if (moodData.energy >= 4) autoTags.push('Energetic');
        if (moodData.stress <= 2) autoTags.push('Calm');
        if (moodData.sleep >= 4) autoTags.push('Well-rested');
        if (moodData.stress >= 4) autoTags.push('Stressed');
        if (moodData.energy <= 2) autoTags.push('Tired');
        
        setSelectedTags(autoTags);
      }
    } catch (error) {
      console.error('Failed to load wearable mood data:', error);
    } finally {
      setIsLoadingWearableData(false);
    }
  };

  

  // Mock mood entries for demonstration
  const [moodEntries] = useState<MoodEntry[]>([
    {
      id: '1',
      date: '2024-01-15',
      mood: 4,
      energy: 3,
      stress: 2,
      sleep: 4,
      notes: 'Great workout today! Feeling accomplished.',
      tags: ['Happy', 'Energetic', 'Motivated']
    },
    {
      id: '2',
      date: '2024-01-14',
      mood: 3,
      energy: 2,
      stress: 4,
      sleep: 2,
      notes: 'Stressful day at work, did not sleep well.',
      tags: ['Stressed', 'Tired']
    },
    {
      id: '3',
      date: '2024-01-13',
      mood: 5,
      energy: 4,
      stress: 1,
      sleep: 5,
      notes: 'Perfect day! Everything went smoothly.',
      tags: ['Happy', 'Calm', 'Grateful']
    }
  ]);

  const moodStats: MoodStats = useMemo(() => {
    if (moodEntries.length === 0) {
      return {
        averageMood: 0,
        averageEnergy: 0,
        averageStress: 0,
        averageSleep: 0,
        moodTrend: 'stable',
        streakDays: 0
      };
    }

    const recent = moodEntries.slice(0, 7); // Last 7 days
    const averageMood = recent.reduce((sum, entry) => sum + entry.mood, 0) / recent.length;
    const averageEnergy = recent.reduce((sum, entry) => sum + entry.energy, 0) / recent.length;
    const averageStress = recent.reduce((sum, entry) => sum + entry.stress, 0) / recent.length;
    const averageSleep = recent.reduce((sum, entry) => sum + entry.sleep, 0) / recent.length;

    // Calculate trend
    let moodTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recent.length >= 3) {
      const recentAvg = recent.slice(0, 3).reduce((sum, entry) => sum + entry.mood, 0) / 3;
      const olderAvg = recent.slice(3, 6).reduce((sum, entry) => sum + entry.mood, 0) / Math.min(3, recent.length - 3);
      
      if (recentAvg > olderAvg + 0.5) moodTrend = 'improving';
      else if (recentAvg < olderAvg - 0.5) moodTrend = 'declining';
    }

    return {
      averageMood,
      averageEnergy,
      averageStress,
      averageSleep,
      moodTrend,
      streakDays: moodEntries.length
    };
  }, [moodEntries]);

  const handleConnectWearable = useCallback(() => {
    router.push('/wearables' as any);
  }, []);

  const handleRefreshWearableData = useCallback(() => {
    if (wearableConnected) {
      loadWearableMoodData();
    }
  }, [wearableConnected]);

  const saveTodayEntry = useCallback(() => {
    const entry: MoodEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      mood: todayMood,
      energy: todayEnergy,
      stress: todayStress,
      sleep: todaySleep,
      notes: useWearableData && wearableConnected 
        ? `${todayNotes}\n\n[Auto-generated from ${wearableDataSource} with ${dataConfidence}% confidence]`
        : todayNotes,
      tags: selectedTags
    };

    console.log('Saving mood entry:', entry);
    
    if (user) {
      updateUser({
        lastMoodEntry: entry
      });
    }

    setTodayNotes('');

    Alert.alert(
      'Mood Entry Saved!', 
      `Your mood data from ${wearableDataSource} has been saved successfully.`
    );
  }, [todayMood, todayEnergy, todayStress, todaySleep, todayNotes, selectedTags, useWearableData, wearableConnected, wearableDataSource, dataConfidence, user, updateUser]);

  const renderWearableStatus = () => (
    <Card variant="elevated" style={styles.wearableCard}>
      <View style={styles.wearableHeader}>
        <Watch size={20} color={wearableConnected ? Colors.success : Colors.text.secondary} />
        <Text style={styles.wearableTitle}>
          {wearableConnected ? 'Wearable Connected' : 'No Wearable Connected'}
        </Text>
        {wearableConnected ? (
          <Wifi size={16} color={Colors.success} />
        ) : (
          <WifiOff size={16} color={Colors.text.secondary} />
        )}
      </View>
      
      {wearableConnected ? (
        <View style={styles.wearableInfo}>
          <Text style={styles.wearableSource}>Data from: {wearableDataSource}</Text>
          <Text style={styles.wearableConfidence}>Confidence: {dataConfidence}%</Text>
          
          <View style={styles.wearableControls}>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={handleRefreshWearableData}
              disabled={isLoadingWearableData}
            >
              {isLoadingWearableData ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <RefreshCw size={16} color={Colors.primary} />
              )}

            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.wearableInfo}>
          <Text style={styles.wearableDescription}>
            Connect a wearable device to automatically track your mood based on biometric data like heart rate variability, sleep quality, and activity levels.
          </Text>
          <Button
            title="Connect Wearable"
            onPress={handleConnectWearable}
            style={styles.connectButton}
            variant="outline"
          />
        </View>
      )}
    </Card>
  );

  const renderTodayTab = () => (
    <ScrollView style={styles.content} removeClippedSubviews={true}>
      {renderWearableStatus()}
      
      {wearableConnected ? (
        <Card variant="elevated" style={styles.todayCard}>
          <View style={styles.todayHeader}>
            <Brain size={24} color={Colors.primary} />
            <Text style={styles.todayTitle}>Your mood data from wearable</Text>
          </View>
          
          {isLoadingWearableData ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading mood data from {wearableDataSource}...</Text>
            </View>
          ) : (
            <>
              <View style={styles.wearableDataContainer}>
                <View style={styles.wearableMetric}>
                  <Text style={styles.metricLabel}>Overall Mood</Text>
                  <Text style={styles.metricEmoji}>{moodEmojis[todayMood - 1]}</Text>
                  <Text style={styles.metricValue}>{todayMood}/5</Text>
                </View>
                <View style={styles.wearableMetric}>
                  <Text style={styles.metricLabel}>Energy Level</Text>
                  <Text style={styles.metricEmoji}>{energyEmojis[todayEnergy - 1]}</Text>
                  <Text style={styles.metricValue}>{todayEnergy}/5</Text>
                </View>
                <View style={styles.wearableMetric}>
                  <Text style={styles.metricLabel}>Stress Level</Text>
                  <Text style={styles.metricEmoji}>{stressEmojis[todayStress - 1]}</Text>
                  <Text style={styles.metricValue}>{todayStress}/5</Text>
                </View>
                <View style={styles.wearableMetric}>
                  <Text style={styles.metricLabel}>Sleep Quality</Text>
                  <Text style={styles.metricEmoji}>{sleepEmojis[todaySleep - 1]}</Text>
                  <Text style={styles.metricValue}>{todaySleep}/5</Text>
                </View>
              </View>

              {selectedTags.length > 0 && (
                <View style={styles.tagsContainer}>
                  <View style={styles.scaleLabelContainer}>
                    <Text style={styles.tagsLabel}>Auto-detected mood indicators</Text>
                    <Text style={styles.wearableIndicator}>📱 From {wearableDataSource}</Text>
                  </View>
                  <View style={styles.tagsGrid}>
                    {selectedTags.map((tag) => (
                      <View key={tag} style={[styles.tagButton, styles.selectedTagButton]}>
                        <Text style={styles.selectedTagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.confidenceContainer}>
                <Text style={styles.confidenceLabel}>Data Confidence</Text>
                <View style={styles.confidenceBar}>
                  <View 
                    style={[
                      styles.confidenceFill, 
                      { width: `${dataConfidence}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.confidenceText}>{dataConfidence}% accurate</Text>
              </View>

              <Button
                title="Save Wearable Data Entry"
                onPress={saveTodayEntry}
                style={styles.saveButton}
                disabled={isLoadingWearableData}
              />
            </>
          )}
        </Card>
      ) : (
        <Card variant="elevated" style={styles.noWearableCard}>
          <View style={styles.noWearableContent}>
            <Watch size={48} color={Colors.text.secondary} />
            <Text style={styles.noWearableTitle}>Connect a Wearable Device</Text>
            <Text style={styles.noWearableDescription}>
              Mood tracking requires data from connected wearable devices like Apple Watch, Fitbit, or Garmin. 
              These devices provide biometric data including heart rate variability, sleep patterns, and activity levels 
              to automatically assess your mood and well-being.
            </Text>
            <Button
              title="Connect Wearable Device"
              onPress={handleConnectWearable}
              style={styles.connectWearableButton}
            />
          </View>
        </Card>
      )}
    </ScrollView>
  );

  const renderHistoryTab = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false} removeClippedSubviews={true}>
      <View style={styles.sectionHeader}>
        <Calendar size={20} color={Colors.primary} />
        <Text style={styles.sectionTitle}>Mood History</Text>
      </View>
      
      {moodEntries.map((entry, index) => (
        <Card key={entry.id} variant="elevated" style={styles.historyCard}>
          <View style={[styles.historyHeader, { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }]}>
            <View style={styles.historyDateContainer}>
              <Text style={styles.historyDate}>
                {new Date(entry.date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </Text>
              <View style={styles.historyDayIndicator}>
                <Text style={styles.historyDayText}>{index === 0 ? 'Today' : `${index + 1} days ago`}</Text>
              </View>
            </View>
            <View style={styles.overallMoodIndicator}>
              <Text style={styles.overallMoodEmoji}>{moodEmojis[entry.mood - 1]}</Text>
            </View>
          </View>

          <View style={styles.historyMetricsContainer}>
            <View style={styles.historyMetric}>
              <View style={styles.metricIconContainer}>
                <Smile size={16} color={Colors.primary} />
              </View>
              <Text style={styles.metricLabel}>Mood</Text>
              <View style={styles.metricValueContainer}>
                <Text style={styles.metricValue}>{entry.mood}</Text>
                <Text style={styles.metricMaxValue}>/5</Text>
              </View>
            </View>
            
            <View style={styles.historyMetric}>
              <View style={styles.metricIconContainer}>
                <Heart size={16} color={Colors.error} />
              </View>
              <Text style={styles.metricLabel}>Energy</Text>
              <View style={styles.metricValueContainer}>
                <Text style={styles.metricValue}>{entry.energy}</Text>
                <Text style={styles.metricMaxValue}>/5</Text>
              </View>
            </View>
            
            <View style={styles.historyMetric}>
              <View style={styles.metricIconContainer}>
                <Brain size={16} color={Colors.warning} />
              </View>
              <Text style={styles.metricLabel}>Stress</Text>
              <View style={styles.metricValueContainer}>
                <Text style={styles.metricValue}>{entry.stress}</Text>
                <Text style={styles.metricMaxValue}>/5</Text>
              </View>
            </View>
            
            <View style={styles.historyMetric}>
              <View style={styles.metricIconContainer}>
                <Moon size={16} color={Colors.info} />
              </View>
              <Text style={styles.metricLabel}>Sleep</Text>
              <View style={styles.metricValueContainer}>
                <Text style={styles.metricValue}>{entry.sleep}</Text>
                <Text style={styles.metricMaxValue}>/5</Text>
              </View>
            </View>
          </View>

          {entry.tags.length > 0 && (
            <View style={styles.historyTagsContainer}>
              <Text style={styles.tagsHeaderText}>Mood Indicators</Text>
              <View style={styles.historyTags}>
                {entry.tags.map((tag) => (
                  <View key={tag} style={styles.historyTag}>
                    <Text style={styles.historyTagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {entry.notes && (
            <View style={styles.historyNotesContainer}>
              <Text style={styles.notesHeaderText}>Notes</Text>
              <Text style={styles.historyNotes}>{entry.notes}</Text>
            </View>
          )}
        </Card>
      ))}
    </ScrollView>
  );

  const renderInsightsTab = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false} removeClippedSubviews={true}>
      <View style={styles.sectionHeader}>
        <BarChart3 size={20} color={Colors.primary} />
        <Text style={styles.sectionTitle}>Mood Analytics</Text>
      </View>
      
      {/* Weekly Overview */}
      <Card variant="elevated" style={styles.insightsCard}>
        <View style={styles.insightsHeader}>
          <TrendingUp size={20} color={Colors.primary} />
          <Text style={styles.insightsTitle}>7-Day Overview</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.modernStatItem}>
            <View style={styles.statIconContainer}>
              <Smile size={18} color={Colors.primary} />
            </View>
            <Text style={styles.statValue}>{moodStats.averageMood.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Avg Mood</Text>
            <View style={styles.statProgressBar}>
              <View style={[styles.statProgressFill, { width: `${(moodStats.averageMood / 5) * 100}%`, backgroundColor: Colors.primary }]} />
            </View>
          </View>
          
          <View style={styles.modernStatItem}>
            <View style={styles.statIconContainer}>
              <Heart size={18} color={Colors.error} />
            </View>
            <Text style={styles.statValue}>{moodStats.averageEnergy.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Avg Energy</Text>
            <View style={styles.statProgressBar}>
              <View style={[styles.statProgressFill, { width: `${(moodStats.averageEnergy / 5) * 100}%`, backgroundColor: Colors.error }]} />
            </View>
          </View>
          
          <View style={styles.modernStatItem}>
            <View style={styles.statIconContainer}>
              <Brain size={18} color={Colors.warning} />
            </View>
            <Text style={styles.statValue}>{moodStats.averageStress.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Avg Stress</Text>
            <View style={styles.statProgressBar}>
              <View style={[styles.statProgressFill, { width: `${(moodStats.averageStress / 5) * 100}%`, backgroundColor: Colors.warning }]} />
            </View>
          </View>
          
          <View style={styles.modernStatItem}>
            <View style={styles.statIconContainer}>
              <Moon size={18} color={Colors.info} />
            </View>
            <Text style={styles.statValue}>{moodStats.averageSleep.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Avg Sleep</Text>
            <View style={styles.statProgressBar}>
              <View style={[styles.statProgressFill, { width: `${(moodStats.averageSleep / 5) * 100}%`, backgroundColor: Colors.info }]} />
            </View>
          </View>
        </View>
      </Card>

      {/* Trend Analysis */}
      <Card variant="elevated" style={styles.trendCard}>
        <View style={styles.trendHeader}>
          <Target size={20} color={Colors.success} />
          <Text style={styles.trendCardTitle}>Trend Analysis</Text>
        </View>
        
        <View style={styles.trendAnalysisContainer}>
          <View style={styles.trendIndicatorCard}>
            <Text style={styles.trendEmoji}>
              {moodStats.moodTrend === 'improving' ? '📈' : 
               moodStats.moodTrend === 'declining' ? '📉' : '➡️'}
            </Text>
            <Text style={styles.trendText}>
              {moodStats.moodTrend === 'improving' ? 'Improving Trend' : 
               moodStats.moodTrend === 'declining' ? 'Needs Attention' : 'Stable Mood'}
            </Text>
            <Text style={styles.trendDescription}>
              {moodStats.moodTrend === 'improving' ? 'Your mood has been getting better over time' : 
               moodStats.moodTrend === 'declining' ? 'Consider focusing on self-care activities' : 'Your mood has been consistent'}
            </Text>
          </View>
          
          <View style={styles.streakIndicatorCard}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakValue}>{moodStats.streakDays}</Text>
            <Text style={styles.streakLabel}>Day Streak</Text>
            <Text style={styles.streakDescription}>Keep tracking your mood daily!</Text>
          </View>
        </View>
      </Card>

      {/* Personalized Recommendations */}
      <Card variant="elevated" style={styles.recommendationsCard}>
        <View style={styles.recommendationsHeader}>
          <Heart size={20} color={Colors.success} />
          <Text style={styles.recommendationsTitle}>Personalized Insights</Text>
        </View>

        <View style={styles.recommendations}>
          {moodStats.averageStress > 3 && (
            <View style={styles.recommendationItem}>
              <View style={styles.recommendationIcon}>
                <Brain size={16} color={Colors.warning} />
              </View>
              <Text style={styles.recommendationText}>
                Your stress levels are elevated. Consider meditation or relaxation techniques.
              </Text>
            </View>
          )}
          {moodStats.averageEnergy < 3 && (
            <View style={styles.recommendationItem}>
              <View style={styles.recommendationIcon}>
                <Heart size={16} color={Colors.error} />
              </View>
              <Text style={styles.recommendationText}>
                Low energy levels detected. Ensure adequate sleep and nutrition.
              </Text>
            </View>
          )}
          {moodStats.averageSleep < 3 && (
            <View style={styles.recommendationItem}>
              <View style={styles.recommendationIcon}>
                <Moon size={16} color={Colors.info} />
              </View>
              <Text style={styles.recommendationText}>
                Poor sleep quality may be affecting your mood. Try establishing a bedtime routine.
              </Text>
            </View>
          )}
          {moodStats.averageMood < 3 && (
            <View style={styles.recommendationItem}>
              <View style={styles.recommendationIcon}>
                <Smile size={16} color={Colors.primary} />
              </View>
              <Text style={styles.recommendationText}>
                Consider talking to a mental health professional if low mood persists.
              </Text>
            </View>
          )}
          {moodStats.averageMood >= 4 && moodStats.averageStress <= 2 && (
            <View style={styles.recommendationItem}>
              <View style={styles.recommendationIcon}>
                <TrendingUp size={16} color={Colors.success} />
              </View>
              <Text style={styles.recommendationText}>
                Great job maintaining positive mental health! Keep up your healthy habits.
              </Text>
            </View>
          )}
          {wearableConnected && (
            <View style={styles.recommendationItem}>
              <View style={styles.recommendationIcon}>
                <Watch size={16} color={Colors.primary} />
              </View>
              <Text style={styles.recommendationText}>
                Your mood data is being automatically tracked from your {wearableDataSource}. Consider reviewing patterns in your biometric data.
              </Text>
            </View>
          )}
        </View>
      </Card>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Mood Tracking', headerShown: false }} />
      
      <View style={styles.header}>
        <Text style={styles.title}>Mood Tracking</Text>
        <Smile size={24} color={Colors.primary} />
      </View>

      <View style={styles.tabContainer}>
        {(['today', 'history', 'insights'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'today' && renderTodayTab()}
      {activeTab === 'history' && renderHistoryTab()}
      {activeTab === 'insights' && renderInsightsTab()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginVertical: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  activeTabText: {
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  todayCard: {
    padding: 20,
    marginBottom: 20,
  },
  todayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  todayTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 12,
  },
  selectedScaleButton: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}20`,
  },
  tagsContainer: {
    marginBottom: 24,
  },
  tagsLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  selectedTagButton: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  tagText: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  selectedTagText: {
    color: 'white',
  },

  saveButton: {
    marginTop: 8,
  },
  historyCard: {
    padding: 16,
    marginBottom: 16,
  },
  historyHeader: {
    marginBottom: 16,
  },
  historyDate: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  historyMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  historyMetric: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  metricEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  historyTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  historyTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: `${Colors.primary}20`,
  },
  historyTagText: {
    fontSize: 12,
    color: Colors.primary,
  },
  historyNotes: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  insightsCard: {
    padding: 20,
    marginBottom: 16,
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  insightsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  statEmoji: {
    fontSize: 16,
  },
  trendContainer: {
    marginBottom: 24,
  },
  trendLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  trendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  trendText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  streakContainer: {
    alignItems: 'center',
  },
  streakLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  streakValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  wearableCard: {
    padding: 16,
    marginBottom: 16,
  },
  wearableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  wearableTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    flex: 1,
  },
  wearableInfo: {
    gap: 8,
  },
  wearableSource: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  wearableConfidence: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  wearableDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  wearableControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}10`,
  },
  toggleButtonText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: `${Colors.primary}10`,
  },
  connectButton: {
    marginTop: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  scaleLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  wearableIndicator: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
  },
  recommendationsCard: {
    padding: 20,
    marginBottom: 20,
  },
  recommendationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  recommendationsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 12,
  },
  recommendations: {
    gap: 8,
  },
  recommendationText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  wearableDataContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  wearableMetric: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: `${Colors.primary}05`,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  confidenceContainer: {
    marginBottom: 24,
  },
  confidenceLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  confidenceBar: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    marginBottom: 8,
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  noWearableCard: {
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
  },
  noWearableContent: {
    alignItems: 'center',
    gap: 16,
  },
  noWearableTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  noWearableDescription: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  connectWearableButton: {
    marginTop: 8,
    minWidth: 200,
  },
  // New styles for updated UI
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Colors.spacing.lg,
    paddingHorizontal: Colors.spacing.xs,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: Colors.spacing.sm,
  },
  historyDateContainer: {
    flex: 1,
  },
  historyDayIndicator: {
    marginTop: Colors.spacing.xs,
  },
  historyDayText: {
    fontSize: 12,
    color: Colors.text.tertiary,
    fontWeight: '500',
  },
  overallMoodIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${Colors.primary}10`,
  },
  overallMoodEmoji: {
    fontSize: 24,
  },
  historyMetricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Colors.spacing.lg,
    paddingHorizontal: Colors.spacing.xs,
  },
  metricIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: `${Colors.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Colors.spacing.xs,
  },
  metricValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  metricMaxValue: {
    fontSize: 10,
    color: Colors.text.tertiary,
    marginLeft: 2,
  },
  historyTagsContainer: {
    marginBottom: Colors.spacing.md,
  },
  tagsHeaderText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: Colors.spacing.sm,
  },
  historyNotesContainer: {
    marginTop: Colors.spacing.sm,
  },
  notesHeaderText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: Colors.spacing.xs,
  },
  modernStatItem: {
    alignItems: 'center',
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Colors.radius.medium,
    padding: Colors.spacing.md,
    marginHorizontal: Colors.spacing.xs,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${Colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Colors.spacing.sm,
  },
  statProgressBar: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginTop: Colors.spacing.xs,
    overflow: 'hidden',
  },
  statProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  trendCard: {
    padding: Colors.spacing.xl,
    marginBottom: Colors.spacing.lg,
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Colors.spacing.lg,
  },
  trendCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: Colors.spacing.sm,
  },
  trendAnalysisContainer: {
    flexDirection: 'row',
    gap: Colors.spacing.md,
  },
  trendIndicatorCard: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Colors.radius.medium,
    padding: Colors.spacing.lg,
    alignItems: 'center',
  },
  trendDescription: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Colors.spacing.xs,
    lineHeight: 16,
  },
  streakIndicatorCard: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Colors.radius.medium,
    padding: Colors.spacing.lg,
    alignItems: 'center',
  },
  streakEmoji: {
    fontSize: 24,
    marginBottom: Colors.spacing.xs,
  },
  streakDescription: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Colors.spacing.xs,
    lineHeight: 16,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Colors.radius.medium,
    padding: Colors.spacing.md,
    marginBottom: Colors.spacing.sm,
  },
  recommendationIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: `${Colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Colors.spacing.md,
    marginTop: 2,
  },
});