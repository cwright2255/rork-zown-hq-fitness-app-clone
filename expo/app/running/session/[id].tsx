import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, Target, Zap, Play, Music, Volume2, Heart } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import Button from '@/components/Button';
import Badge from '@/components/Badge';
import { useWorkoutStore } from '@/store/workoutStore';
import { useUserStore } from '@/store/userStore';
import { useSpotifyStore } from '@/store/spotifyStore';
import SpotifyMusicPlayer from '@/components/SpotifyMusicPlayer';
import { RunningSession, RunningProgram } from '@/types';

export default function RunningSessionDetailScreen() {
  const params = useLocalSearchParams();
  const sessionId = typeof params.id === 'string' ? params.id : '';
  const programId = typeof params.programId === 'string' ? params.programId : '';
  
  const { runningPrograms } = useWorkoutStore() as {
    runningPrograms: RunningProgram[];
  };
  const { user } = useUserStore() as {
    user: any;
  };
  
  const [session, setSession] = useState<RunningSession | null>(null);
  const [program, setProgram] = useState<RunningProgram | null>(null);
  const [audioCoaching, setAudioCoaching] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  
  const { isConnected: isSpotifyConnected, isClientCredentialsReady: isSpotifyClientCreds, initializeClientCredentials } = useSpotifyStore() as {
    isConnected: boolean;
    isClientCredentialsReady: boolean;
    initializeClientCredentials: () => Promise<boolean>;
  };
  const hasSpotifyAccess = isSpotifyConnected || isSpotifyClientCreds;
  
  useEffect(() => {
    // Find the program and session
    const foundProgram = runningPrograms.find((p: RunningProgram) => p.id === programId);
    if (foundProgram) {
      setProgram(foundProgram);
      const foundSession = foundProgram.sessions.find((s: RunningSession) => s.id === sessionId);
      setSession(foundSession || null);
    }
    
    // Set audio preferences from user profile
    if (user?.preferences?.running) {
      setAudioCoaching(user.preferences.running.audioCoaching);
    }
  }, [sessionId, programId, runningPrograms, user]);
  
  const handleStartWorkout = () => {
    if (!session || !program) return;
    
    // Navigate to active workout with session data
    router.push({
      pathname: '/workout/active',
      params: { 
        sessionId: session.id,
        programId: program.id,
        type: 'running'
      }
    });
  };
  
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes === 0) {
      return `${remainingSeconds}s`;
    }
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };
  
  const getIntervalTypeColor = (type: string) => {
    switch (type) {
      case 'run':
      case 'jog':
        return Colors.running.primary;
      case 'walk':
        return Colors.running.secondary;
      case 'sprint':
        return Colors.error;
      default:
        return Colors.text.secondary;
    }
  };
  
  const getIntervalTypeIcon = (type: string) => {
    switch (type) {
      case 'run':
      case 'jog':
        return <Zap size={16} color={getIntervalTypeColor(type)} />;
      case 'walk':
        return <Target size={16} color={getIntervalTypeColor(type)} />;
      case 'sprint':
        return <Zap size={16} color={getIntervalTypeColor(type)} />;
      default:
        return <Clock size={16} color={getIntervalTypeColor(type)} />;
    }
  };
  
  const calculateEstimatedStats = () => {
    if (!session) return { distance: 0, calories: 0 };
    
    // Rough estimates based on session type and duration
    const basePace = 6; // minutes per km
    const duration = session.duration || 30;
    const distance = session.distance || (duration / basePace);
    const calories = Math.round(duration * 10); // ~10 calories per minute
    
    return { distance, calories };
  };
  
  const estimatedStats = calculateEstimatedStats();
  
  if (!session || !program) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Session not found</Text>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen 
        options={{
          title: session.name,
          headerBackTitle: program.name
        }}
      />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={styles.sessionTitle}>{session.name}</Text>
          <Text style={styles.sessionDescription}>{session.description}</Text>
          
          <View style={styles.sessionMeta}>
            <View style={styles.metaItem}>
              <Clock size={20} color={Colors.running.primary} />
              <Text style={styles.metaText}>
                {session.duration ? `${session.duration} min` : 'Variable duration'}
              </Text>
            </View>
            
            {session.distance && (
              <View style={styles.metaItem}>
                <Target size={20} color={Colors.running.primary} />
                <Text style={styles.metaText}>{session.distance} km</Text>
              </View>
            )}
            
            <View style={styles.metaItem}>
              <Zap size={20} color={Colors.warning} />
              <Text style={styles.metaText}>+{session.xpReward} XP</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.content}>
          {/* Workout Breakdown */}
          <Card style={styles.breakdownCard}>
            <Text style={styles.cardTitle}>Workout Breakdown</Text>
            
            {session.intervals && session.intervals.length > 0 ? (
              <View style={styles.intervalsContainer}>
                {session.intervals.map((interval, index) => (
                  <View key={index} style={styles.intervalItem}>
                    <View style={styles.intervalHeader}>
                      <View style={styles.intervalType}>
                        {getIntervalTypeIcon(interval.type)}
                        <Text style={[styles.intervalTypeText, { color: getIntervalTypeColor(interval.type) }]}>
                          {interval.type.toUpperCase()}
                        </Text>
                      </View>
                      
                      <Text style={styles.intervalDuration}>
                        {formatDuration(interval.duration)}
                        {interval.repeat && interval.repeat > 1 && (
                          <Text style={styles.intervalRepeat}> × {interval.repeat}</Text>
                        )}
                      </Text>
                    </View>
                    
                    <View style={styles.intervalDetails}>
                      <Badge 
                        variant={interval.intensity === 'high' ? 'error' : interval.intensity === 'medium' ? 'warning' : 'success'}
                        style={styles.intensityBadge}
                      >
                        {interval.intensity}
                      </Badge>
                      
                      {interval.pace && (
                        <Text style={styles.intervalPace}>
                          Target pace: {interval.pace} min/km
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.simpleWorkout}>
                <Text style={styles.simpleWorkoutText}>
                  {session.type === 'run' ? 'Continuous run' : 'Walking session'}
                </Text>
                {session.targetPace && (
                  <Text style={styles.targetPace}>
                    Target pace: {session.targetPace} min/km
                  </Text>
                )}
              </View>
            )}
          </Card>
          
          {/* Instructions */}
          <Card style={styles.instructionsCard}>
            <Text style={styles.cardTitle}>Instructions</Text>
            <View style={styles.instructionsList}>
              {(session.instructions || []).map((instruction: string, index: number) => (
                <View key={index} style={styles.instructionItem}>
                  <View style={styles.instructionNumber}>
                    <Text style={styles.instructionNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.instructionText}>{instruction}</Text>
                </View>
              ))}
            </View>
          </Card>
          
          {/* Estimated Stats */}
          <Card style={styles.statsCard}>
            <Text style={styles.cardTitle}>Estimated Stats</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Target size={24} color={Colors.running.distance} />
                <Text style={styles.statValue}>{estimatedStats.distance.toFixed(1)} km</Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
              
              <View style={styles.statItem}>
                <Zap size={24} color={Colors.warning} />
                <Text style={styles.statValue}>{estimatedStats.calories}</Text>
                <Text style={styles.statLabel}>Calories</Text>
              </View>
              
              <View style={styles.statItem}>
                <Heart size={24} color={Colors.error} />
                <Text style={styles.statValue}>Zone 2-3</Text>
                <Text style={styles.statLabel}>Heart Rate</Text>
              </View>
            </View>
          </Card>
          
          {/* Audio & Music Settings */}
          <Card style={styles.settingsCard}>
            <Text style={styles.cardTitle}>Audio Settings</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Volume2 size={20} color={Colors.text.primary} />
                <Text style={styles.settingLabel}>Audio Coaching</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, audioCoaching && styles.toggleActive]}
                onPress={() => setAudioCoaching(!audioCoaching)}
              >
                <View style={[styles.toggleThumb, audioCoaching && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.settingDescription}>
              Get voice prompts for interval changes and encouragement during your run.
            </Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Music size={20} color={hasSpotifyAccess ? '#1DB954' : Colors.text.primary} />
                <Text style={styles.settingLabel}>Background Music</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, musicEnabled && styles.toggleActive]}
                onPress={async () => {
                  if (!musicEnabled && !hasSpotifyAccess) {
                    console.log('RunningSession: Music enabled but no Spotify access, trying to connect...');
                    const success = await initializeClientCredentials();
                    if (success) {
                      setMusicEnabled(true);
                    } else {
                      Alert.alert(
                        'Connect Spotify',
                        'Connect your Spotify account to play music during runs.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Connect', onPress: () => router.push('/spotify-integration' as any) },
                        ]
                      );
                    }
                  } else {
                    setMusicEnabled(!musicEnabled);
                  }
                }}
                testID="music-toggle"
              >
                <View style={[styles.toggleThumb, musicEnabled && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.settingDescription}>
              {hasSpotifyAccess 
                ? 'Spotify connected. Tap tracks below to play during your run.' 
                : 'Connect Spotify to play music in the background during your run.'}
            </Text>
          </Card>
          
          {/* Spotify Music Player */}
          {musicEnabled && (
            hasSpotifyAccess ? (
              <SpotifyMusicPlayer 
                workoutType="running"
                style={styles.musicPlayerCard}
              />
            ) : (
              <Card style={styles.connectSpotifyCard}>
                <View style={styles.connectSpotifyContent}>
                  <Music size={28} color={Colors.text.tertiary} />
                  <Text style={styles.connectSpotifyTitle}>Connect Spotify</Text>
                  <Text style={styles.connectSpotifyText}>Get running playlists and music recommendations</Text>
                  <Button
                    title="Connect"
                    onPress={() => router.push('/spotify-integration' as any)}
                    style={styles.connectSpotifyButton}
                  />
                </View>
              </Card>
            )
          )}
          
          {/* Safety Tips */}
          <Card style={styles.safetyCard}>
            <Text style={styles.cardTitle}>Safety Tips</Text>
            <View style={styles.safetyTips}>
              <Text style={styles.safetyTip}>• Stay hydrated before, during, and after your run</Text>
              <Text style={styles.safetyTip}>• Warm up with a 5-minute walk before starting</Text>
              <Text style={styles.safetyTip}>• Listen to your body and rest if you feel pain</Text>
              <Text style={styles.safetyTip}>• Cool down with walking and stretching</Text>
              <Text style={styles.safetyTip}>• Run in well-lit areas and wear reflective gear</Text>
            </View>
          </Card>
          
          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            <Button
              title="Begin Workout"
              onPress={handleStartWorkout}
              style={styles.startButton}
              leftIcon={<Play size={20} color={Colors.text.inverse} />}
            />
            
            <Button
              title="Finish Session"
              onPress={() => router.back()}
              style={styles.finishButton}
              variant="secondary"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  errorText: {
    fontSize: 18,
    color: Colors.text.primary,
    textAlign: 'center',
    marginTop: 50,
  },
  headerSection: {
    backgroundColor: Colors.backgroundSecondary,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sessionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  sessionDescription: {
    fontSize: 16,
    color: Colors.text.secondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  sessionMeta: {
    flexDirection: 'row',
    gap: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  content: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  breakdownCard: {
    marginBottom: 16,
  },
  intervalsContainer: {
    gap: 12,
  },
  intervalItem: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
  },
  intervalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  intervalType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  intervalTypeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  intervalDuration: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  intervalRepeat: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  intervalDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  intensityBadge: {
    height: 20,
    paddingHorizontal: 8,
  },
  intervalPace: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  simpleWorkout: {
    padding: 16,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    alignItems: 'center',
  },
  simpleWorkoutText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  targetPace: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  instructionsCard: {
    marginBottom: 16,
  },
  instructionsList: {
    gap: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    gap: 12,
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.running.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  instructionNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.inverse,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  statsCard: {
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  settingsCard: {
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  settingDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 16,
    paddingLeft: 32,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.inactive,
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: Colors.running.primary,
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.text.inverse,
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  safetyCard: {
    marginBottom: 24,
    backgroundColor: `${Colors.warning}10`,
    borderColor: Colors.warning,
    borderWidth: 1,
  },
  safetyTips: {
    gap: 8,
  },
  safetyTip: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 18,
  },
  actionButtonsContainer: {
    gap: 12,
    marginBottom: 32,
  },
  startButton: {
    width: '100%',
  },
  finishButton: {
    width: '100%',
  },
  musicPlayerCard: {
    marginBottom: 16,
  },
  connectSpotifyCard: {
    marginBottom: 16,
  },
  connectSpotifyContent: {
    alignItems: 'center',
    padding: 20,
  },
  connectSpotifyTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginTop: 10,
    marginBottom: 6,
  },
  connectSpotifyText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center' as const,
    marginBottom: 14,
  },
  connectSpotifyButton: {
    paddingHorizontal: 32,
  },
});