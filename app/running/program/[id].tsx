import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, Calendar, Target, Trophy, Play, ChevronRight, RotateCcw, Star } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import Button from '@/components/Button';
import ProgressBar from '@/components/ProgressBar';
import Badge from '@/components/Badge';
import { useWorkoutStore } from '@/store/workoutStore';
import { useUserStore } from '@/store/userStore';
import { RunningProgram } from '@/types';

const { width } = Dimensions.get('window');

export default function RunningProgramDetailScreen() {
  const params = useLocalSearchParams();
  const programId = typeof params.id === 'string' ? params.id : '';
  
  const { runningPrograms, startProgram, activeProgram } = useWorkoutStore() as {
    runningPrograms: RunningProgram[];
    startProgram: (id: string) => void;
    activeProgram: RunningProgram | null;
  };
  const { user, updateUserRunningProfile } = useUserStore() as {
    user: any;
    updateUserRunningProfile: (profile: any) => void;
  };
  
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [program, setProgram] = useState<RunningProgram | null>(null);
  
  useEffect(() => {
    const foundProgram = runningPrograms.find(p => p.id === programId);
    setProgram(foundProgram || null);
    
    // Set selected week to current week if user has progress
    if (user?.runningProfile?.programProgress?.programId === programId) {
      setSelectedWeek(user.runningProfile.programProgress.currentWeek);
    }
  }, [programId, runningPrograms, user]);
  
  const isActiveProgram = activeProgram?.id === programId;
  const userProgress = user?.runningProfile?.programProgress;
  const hasStarted = userProgress?.programId === programId;
  
  const progressPercentage = useMemo(() => {
    if (!hasStarted || !userProgress || !program) return 0;
    return (userProgress.completedSessions / program.totalSessions) * 100;
  }, [hasStarted, userProgress, program]);
  
  const currentWeekProgress = useMemo(() => {
    if (!hasStarted || !userProgress) return 0;
    const sessionsPerWeek = 3; // Assuming 3 sessions per week
    const currentWeekSessions = userProgress.completedSessions % sessionsPerWeek;
    return (currentWeekSessions / sessionsPerWeek) * 100;
  }, [hasStarted, userProgress]);
  
  const handleStartProgram = () => {
    if (!program) return;
    
    startProgram(program.id);
    
    // Navigate to first session
    const firstSession = program.sessions[0];
    if (firstSession) {
      router.push(`/running/session/${firstSession.id}?programId=${program.id}` as any);
    }
  };
  
  const handleRestartProgram = () => {
    if (!program) return;
    
    // Reset progress
    updateUserRunningProfile({
      programProgress: {
        programId: program.id,
        currentWeek: 1,
        currentDay: 1,
        totalWeeks: program.duration,
        completedSessions: 0,
        totalSessions: program.totalSessions,
        startDate: new Date().toISOString()
      }
    });
    
    startProgram(program.id);
    setSelectedWeek(1);
  };
  
  const handleSessionPress = (sessionId: string) => {
    router.push(`/running/session/${sessionId}?programId=${programId}`);
  };
  
  const getSessionStatus = (sessionIndex: number) => {
    if (!hasStarted || !userProgress) return 'upcoming';
    if (sessionIndex < userProgress.completedSessions) return 'completed';
    if (sessionIndex === userProgress.completedSessions) return 'current';
    return 'upcoming';
  };
  
  const getWeekSessions = (week: number) => {
    if (!program) return [];
    return program.sessions.filter((session: any) => session.week === week);
  };
  
  if (!program) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Program not found</Text>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen 
        options={{
          title: program.name,
          headerBackTitle: 'Running'
        }}
      />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Image 
            source={{ uri: program.imageUrl }} 
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.heroOverlay} />
          
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{program.name}</Text>
            <Text style={styles.heroSubtitle}>{program.description}</Text>
            
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Calendar size={16} color={Colors.text.inverse} />
                <Text style={styles.heroStatText}>{program.duration} weeks</Text>
              </View>
              <View style={styles.heroStat}>
                <Clock size={16} color={Colors.text.inverse} />
                <Text style={styles.heroStatText}>{program.estimatedTimePerSession || 30} min/session</Text>
              </View>
              <View style={styles.heroStat}>
                <Target size={16} color={Colors.text.inverse} />
                <Text style={styles.heroStatText}>{program.totalSessions} sessions</Text>
              </View>
            </View>
            
            {program.isPopular && (
              <Badge 
                variant="success" 
                style={styles.popularBadge}
              >
                Popular
              </Badge>
            )}
          </View>
        </View>
        
        <View style={styles.content}>
          {/* Progress Section */}
          {hasStarted && (
            <Card style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>Your Progress</Text>
                <TouchableOpacity onPress={handleRestartProgram}>
                  <RotateCcw size={20} color={Colors.primary} />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.progressText}>
                Week {userProgress?.currentWeek} of {program.duration} • 
                {userProgress?.completedSessions} of {program.totalSessions} sessions completed
              </Text>
              
              <ProgressBar
                progress={progressPercentage / 100}
                height={8}
                progressColor={Colors.running.primary}
                style={styles.progressBar}
              />
              
              <Text style={styles.progressPercentage}>
                {Math.round(progressPercentage)}% Complete
              </Text>
            </Card>
          )}
          
          {/* Program Info */}
          <Card style={styles.infoCard}>
            <Text style={styles.infoTitle}>Program Overview</Text>
            <Text style={styles.infoDescription}>{program.description}</Text>
            
            <View style={styles.infoStats}>
              <View style={styles.infoStat}>
                <Text style={styles.infoStatValue}>{program.difficulty}</Text>
                <Text style={styles.infoStatLabel}>Difficulty</Text>
              </View>
              <View style={styles.infoStat}>
                <Text style={styles.infoStatValue}>{program.type || 'Running'}</Text>
                <Text style={styles.infoStatLabel}>Type</Text>
              </View>
              <View style={styles.infoStat}>
                <Text style={styles.infoStatValue}>{program.category || 'Training'}</Text>
                <Text style={styles.infoStatLabel}>Category</Text>
              </View>
            </View>
            
            <View style={styles.goalsContainer}>
              <Text style={styles.goalsTitle}>Goals:</Text>
              <View style={styles.goalsList}>
                {(program.goals || [program.goal]).filter((g): g is string => Boolean(g)).map((goal: string, index: number) => (
                  <Badge 
                    key={index}
                    variant="neutral"
                    style={styles.goalBadge}
                  >
                    {goal}
                  </Badge>
                ))}
              </View>
            </View>
          </Card>
          
          {/* Week Selector */}
          <View style={styles.weekSelector}>
            <Text style={styles.sectionTitle}>Weekly Schedule</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.weekTabs}
            >
              {Array.from({ length: program.duration }, (_, i) => i + 1).map(week => (
                <TouchableOpacity
                  key={week}
                  style={[
                    styles.weekTab,
                    selectedWeek === week && styles.weekTabActive
                  ]}
                  onPress={() => setSelectedWeek(week)}
                >
                  <Text style={[
                    styles.weekTabText,
                    selectedWeek === week && styles.weekTabTextActive
                  ]}>
                    Week {week}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          
          {/* Sessions for Selected Week */}
          <View style={styles.sessionsContainer}>
            {getWeekSessions(selectedWeek).map((session, index) => {
              const sessionIndex = program.sessions.findIndex(s => s.id === session.id);
              const status = getSessionStatus(sessionIndex);
              
              return (
                <TouchableOpacity
                  key={session.id}
                  style={[
                    styles.sessionCard,
                    status === 'completed' && styles.sessionCardCompleted,
                    status === 'current' && styles.sessionCardCurrent
                  ]}
                  onPress={() => handleSessionPress(session.id)}
                >
                  <View style={styles.sessionHeader}>
                    <View style={styles.sessionInfo}>
                      <Text style={styles.sessionTitle}>{session.name}</Text>
                      <Text style={styles.sessionDescription} numberOfLines={2}>
                        {session.description}
                      </Text>
                    </View>
                    
                    <View style={styles.sessionStatus}>
                      {status === 'completed' && (
                        <View style={styles.completedIcon}>
                          <Trophy size={16} color={Colors.success} />
                        </View>
                      )}
                      {status === 'current' && (
                        <View style={styles.currentIcon}>
                          <Play size={16} color={Colors.running.primary} />
                        </View>
                      )}
                      <ChevronRight size={20} color={Colors.text.secondary} />
                    </View>
                  </View>
                  
                  <View style={styles.sessionMeta}>
                    <View style={styles.sessionMetaItem}>
                      <Clock size={14} color={Colors.text.secondary} />
                      <Text style={styles.sessionMetaText}>
                        {session.duration ? `${session.duration} min` : 'Variable'}
                      </Text>
                    </View>
                    
                    {session.distance && (
                      <View style={styles.sessionMetaItem}>
                        <Target size={14} color={Colors.text.secondary} />
                        <Text style={styles.sessionMetaText}>{session.distance} km</Text>
                      </View>
                    )}
                    
                    <View style={styles.sessionMetaItem}>
                      <Star size={14} color={Colors.warning} />
                      <Text style={styles.sessionMetaText}>+{session.xpReward || 50} XP</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          
          {/* Action Button */}
          <View style={styles.actionContainer}>
            {!hasStarted ? (
              <Button
                title="Start Program"
                onPress={handleStartProgram}
                style={styles.actionButton}
                leftIcon={<Play size={20} color={Colors.text.inverse} />}
              />
            ) : (
              <Button
                title="Continue Program"
                onPress={() => {
                  const nextSession = program.sessions[userProgress?.completedSessions || 0];
                  if (nextSession) {
                    handleSessionPress(nextSession.id);
                  }
                }}
                style={styles.actionButton}
                leftIcon={<Play size={20} color={Colors.text.inverse} />}
              />
            )}
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
  heroSection: {
    height: 280,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  heroContent: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.inverse,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: Colors.text.inverse,
    opacity: 0.9,
    marginBottom: 16,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  heroStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroStatText: {
    fontSize: 14,
    color: Colors.text.inverse,
    fontWeight: '500',
  },
  popularBadge: {
    alignSelf: 'flex-start',
  },
  content: {
    padding: 16,
  },
  progressCard: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  progressText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 12,
  },
  progressBar: {
    marginBottom: 8,
  },
  progressPercentage: {
    fontSize: 12,
    color: Colors.text.tertiary,
    textAlign: 'right',
  },
  infoCard: {
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  infoDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  infoStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 16,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
  },
  infoStat: {
    alignItems: 'center',
  },
  infoStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  infoStatLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  goalsContainer: {
    marginTop: 8,
  },
  goalsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  goalsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalBadge: {
    marginBottom: 0,
  },
  weekSelector: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  weekTabs: {
    paddingHorizontal: 4,
    gap: 8,
  },
  weekTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  weekTabActive: {
    backgroundColor: Colors.running.primary,
    borderColor: Colors.running.primary,
  },
  weekTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  weekTabTextActive: {
    color: Colors.text.inverse,
  },
  sessionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  sessionCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sessionCardCompleted: {
    backgroundColor: `${Colors.success}10`,
    borderColor: Colors.success,
  },
  sessionCardCurrent: {
    backgroundColor: `${Colors.running.primary}10`,
    borderColor: Colors.running.primary,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sessionInfo: {
    flex: 1,
    marginRight: 12,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  sessionDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  sessionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completedIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: `${Colors.success}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: `${Colors.running.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  sessionMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sessionMetaText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  actionContainer: {
    marginBottom: 32,
  },
  actionButton: {
    width: '100%',
  },
});