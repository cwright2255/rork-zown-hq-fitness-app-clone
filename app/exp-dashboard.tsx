import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { Award, TrendingUp, BarChart2, List, Activity, MapPin, Coffee, Dumbbell, Flag } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useUserStore } from '@/store/userStore';
import { useExpStore } from '@/store/expStore';
import LevelProgress from '@/components/LevelProgress';
import ExpBreakdownChart from '@/components/ExpBreakdownChart';
import ExpActivityList from '@/components/ExpActivityList';
import BottomNavigation from '@/components/BottomNavigation';
import OptimizedScrollView from '@/components/OptimizedScrollView';
import { performanceMonitor } from '@/utils/performanceOptimizations';

export default function ExpDashboardScreen() {
  const [activeTab, setActiveTab] = useState('overview');
  const { user } = useUserStore();
  const { 
    expSystem, 
    getExpBreakdown, 
    getRecentActivities, 
    getExpToNextLevel, 
    getLevel,
    initializeExpSystem
  } = useExpStore();
  
  // Performance monitoring
  const renderMonitor = performanceMonitor.measureRender('ExpDashboardScreen');
  
  // Initialize exp system if needed
  useEffect(() => {
    renderMonitor.start();
    if (!expSystem || !expSystem.levelRequirements) {
      initializeExpSystem();
    }
    renderMonitor.end();
  }, [expSystem, initializeExpSystem, renderMonitor]);
  
  // Get user level and XP with proper fallbacks
  const level = user?.level || getLevel() || 1;
  const xp = user?.xp || expSystem?.totalExp || 0;
  const expToNextLevel = getExpToNextLevel() || 0;
  
  // Memoize expensive calculations
  const expBreakdown = useMemo(() => getExpBreakdown(), [getExpBreakdown]);
  const recentActivities = useMemo(() => getRecentActivities(5), [getRecentActivities]);
  const allActivities = useMemo(() => getRecentActivities(50), [getRecentActivities]);
  
  // Calculate level progress with null checks
  const levelRequirements = expSystem?.levelRequirements || { 1: 0, 2: 1000, 3: 2000, 4: 3000, 5: 4000 };
  const prevLevelExp = levelRequirements[level] || 0;
  const nextLevelExp = levelRequirements[level + 1] || prevLevelExp + expToNextLevel;
  
  // Define tabs
  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Activity size={20} color={activeTab === 'overview' ? Colors.primary : Colors.text.secondary} /> },
    { id: 'breakdown', label: 'Breakdown', icon: <BarChart2 size={20} color={activeTab === 'breakdown' ? Colors.primary : Colors.text.secondary} /> },
    { id: 'activities', label: 'Activities', icon: <List size={20} color={activeTab === 'activities' ? Colors.primary : Colors.text.secondary} /> },
    { id: 'levels', label: 'Levels', icon: <TrendingUp size={20} color={activeTab === 'levels' ? Colors.primary : Colors.text.secondary} /> },
  ];
  
  // Memoize tab content to improve performance
  const renderTabContent = useCallback(() => {
    switch (activeTab) {
      case 'overview':
        return (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Level Progress</Text>
              <LevelProgress 
                level={level} 
                xp={xp} 
                nextLevelXp={nextLevelExp} 
                xpForNextLevel={expToNextLevel}
                showDetails={true}
              />
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>EXP Summary</Text>
              <View style={styles.summaryContainer}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{xp.toLocaleString()}</Text>
                  <Text style={styles.summaryLabel}>Total XP</Text>
                </View>
                
                <View style={styles.summaryDivider} />
                
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{level}</Text>
                  <Text style={styles.summaryLabel}>Current Level</Text>
                </View>
                
                <View style={styles.summaryDivider} />
                
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{expToNextLevel.toLocaleString()}</Text>
                  <Text style={styles.summaryLabel}>XP to Next Level</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>EXP Breakdown</Text>
              <ExpBreakdownChart breakdown={expBreakdown} />
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Activities</Text>
              <ExpActivityList activities={recentActivities} />
            </View>
          </>
        );
        
      case 'breakdown':
        return (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>EXP Breakdown</Text>
              <ExpBreakdownChart breakdown={expBreakdown} />
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>EXP Sources</Text>
              <View style={styles.expSourcesContainer}>
                <View style={styles.expSourceItem}>
                  <View style={[styles.expSourceIcon, { backgroundColor: '#6366F120' }]}>
                    <Flag size={24} color="#6366F1" />
                  </View>
                  <View style={styles.expSourceContent}>
                    <Text style={styles.expSourceTitle}>Main Missions</Text>
                    <Text style={styles.expSourceDescription}>Complete main fitness goals and challenges</Text>
                    <Text style={styles.expSourceValue}>Base: 1,125 XP</Text>
                  </View>
                </View>
                
                <View style={styles.expSourceItem}>
                  <View style={[styles.expSourceIcon, { backgroundColor: '#8B5CF620' }]}>
                    <MapPin size={24} color="#8B5CF6" />
                  </View>
                  <View style={styles.expSourceContent}>
                    <Text style={styles.expSourceTitle}>Side Missions</Text>
                    <Text style={styles.expSourceDescription}>Complete additional fitness activities</Text>
                    <Text style={styles.expSourceValue}>Base: 375 XP</Text>
                  </View>
                </View>
                
                <View style={styles.expSourceItem}>
                  <View style={[styles.expSourceIcon, { backgroundColor: '#10B98120' }]}>
                    <Coffee size={24} color="#10B981" />
                  </View>
                  <View style={styles.expSourceContent}>
                    <Text style={styles.expSourceTitle}>Meals</Text>
                    <Text style={styles.expSourceDescription}>Log healthy meals and track nutrition</Text>
                    <Text style={styles.expSourceValue}>Base: 33-55 XP (based on rating)</Text>
                  </View>
                </View>
                
                <View style={styles.expSourceItem}>
                  <View style={[styles.expSourceIcon, { backgroundColor: '#F59E0B20' }]}>
                    <Dumbbell size={24} color="#F59E0B" />
                  </View>
                  <View style={styles.expSourceContent}>
                    <Text style={styles.expSourceTitle}>Workouts</Text>
                    <Text style={styles.expSourceDescription}>Complete workouts and exercise sessions</Text>
                    <Text style={styles.expSourceValue}>Base: 250-750 XP (based on type)</Text>
                  </View>
                </View>
                
                <View style={styles.expSourceItem}>
                  <View style={[styles.expSourceIcon, { backgroundColor: '#EF444420' }]}>
                    <Award size={24} color="#EF4444" />
                  </View>
                  <View style={styles.expSourceContent}>
                    <Text style={styles.expSourceTitle}>Events</Text>
                    <Text style={styles.expSourceDescription}>Participate in fitness events and challenges</Text>
                    <Text style={styles.expSourceValue}>Base: 100-250 XP (based on outcome)</Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        );
        
      case 'activities':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>All Activities</Text>
            <ExpActivityList activities={allActivities} maxHeight={400} />
          </View>
        );
        
      case 'levels':
        return (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Level Progress</Text>
              <LevelProgress 
                level={level} 
                xp={xp} 
                nextLevelXp={nextLevelExp} 
                xpForNextLevel={expToNextLevel}
                showDetails={true}
              />
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Level Requirements</Text>
              <View style={styles.levelRequirementsContainer}>
                <View style={styles.levelRequirementsHeader}>
                  <Text style={styles.levelRequirementsHeaderText}>Level</Text>
                  <Text style={styles.levelRequirementsHeaderText}>Required XP</Text>
                  <Text style={styles.levelRequirementsHeaderText}>XP Increase</Text>
                </View>
                
                {Object.entries(levelRequirements)
                  .slice(0, 20) // Show first 20 levels
                  .map(([lvl, reqXp], index) => {
                    const prevReq = levelRequirements[parseInt(lvl) - 1] || 0;
                    const increase = reqXp - prevReq;
                    const increasePercent = prevReq > 0 ? ((increase / prevReq) * 100).toFixed(0) : 'N/A';
                    
                    return (
                      <View 
                        key={lvl} 
                        style={[
                          styles.levelRequirementsRow,
                          parseInt(lvl) === level && styles.currentLevelRow
                        ]}
                      >
                        <Text 
                          style={[
                            styles.levelRequirementsCell,
                            parseInt(lvl) === level && styles.currentLevelText
                          ]}
                        >
                          {lvl}
                        </Text>
                        <Text 
                          style={[
                            styles.levelRequirementsCell,
                            parseInt(lvl) === level && styles.currentLevelText
                          ]}
                        >
                          {reqXp.toLocaleString()}
                        </Text>
                        <Text 
                          style={[
                            styles.levelRequirementsCell,
                            parseInt(lvl) === level && styles.currentLevelText
                          ]}
                        >
                          {index > 0 ? `+${increasePercent}%` : '-'}
                        </Text>
                      </View>
                    );
                  })
                }
              </View>
            </View>
          </>
        );
        
      default:
        return null;
    }
  }, [activeTab, level, xp, nextLevelExp, expToNextLevel, expBreakdown, recentActivities, levelRequirements]);
  
  return (
    <>
      <Stack.Screen options={{ title: 'EXP Dashboard' }} />
      
      <View style={styles.container}>
        <OptimizedScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          enableOptimizations={true}
        >
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Award size={32} color={Colors.primary} />
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>EXP Dashboard</Text>
                <Text style={styles.headerSubtitle}>Track your progress and growth</Text>
              </View>
            </View>
            
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>Level {level}</Text>
            </View>
          </View>
          
          <View style={styles.tabsContainer}>
            {tabs.map(tab => (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tabButton,
                  activeTab === tab.id && styles.activeTabButton
                ]}
                onPress={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                <Text 
                  style={[
                    styles.tabButtonText,
                    activeTab === tab.id && styles.activeTabButtonText
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {renderTabContent()}
        </OptimizedScrollView>
        
        <BottomNavigation />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80, // Space for bottom navigation
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextContainer: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  levelBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  levelBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.inverse,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 12,
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabButtonText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  activeTabButtonText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  summaryContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  summaryDivider: {
    width: 1,
    height: '100%',
    backgroundColor: Colors.border,
    marginHorizontal: 8,
  },
  expSourcesContainer: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
  },
  expSourceItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  expSourceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  expSourceContent: {
    flex: 1,
  },
  expSourceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  expSourceDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  expSourceValue: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.primary,
  },
  levelRequirementsContainer: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  levelRequirementsHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  levelRequirementsHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  levelRequirementsRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  currentLevelRow: {
    backgroundColor: `${Colors.primary}15`,
  },
  levelRequirementsCell: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.secondary,
  },
  currentLevelText: {
    fontWeight: '600',
    color: Colors.primary,
  },
});