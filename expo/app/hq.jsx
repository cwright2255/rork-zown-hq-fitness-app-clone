import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Image,
  Dimensions,
  StatusBar,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { LineChart, BarChart } from 'react-native-chart-kit';
import {
  Flame,
  Heart as HeartIcon,
  Footprints,
  Moon,
  Droplet,
  Activity,
  ChevronDown,
  ChevronUp,
  Plus,
  TrendingUp,
  Star,
} from 'lucide-react-native';

import { useUserStore } from '@/store/userStore';
import { useExpStore } from '@/store/expStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useHealthStore } from '@/store/healthStore';
import { useRunningStore } from '@/store/runningStore';
import { tokens } from '../../theme/tokens';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');
const CARD_GAP = 12;
const H_PAD = 22;
const CARD_W = (width - H_PAD * 2 - CARD_GAP) / 2;

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WORKOUTS = [
  { id: '1', name: 'HIIT Blast', duration: '30 min', icon: 'barbell-outline' },
  { id: '2', name: 'Morning Yoga', duration: '20 min', icon: 'body-outline' },
  { id: '3', name: 'Strength Core', duration: '45 min', icon: 'fitness-outline' },
  { id: '4', name: 'Cardio Mix', duration: '25 min', icon: 'bicycle-outline' },
];

/* ─── Circular Progress Ring Component ─── */
function ProgressRing({ size = 80, strokeWidth = 8, progress = 0.7, color = '#000000', label, subLabel }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Background Circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#F5F5F5"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Foreground Progress Circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          transform={"rotate(-90 " + (size / 2) + " " + (size / 2) + ")"}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#000000' }}>{label}</Text>
        {subLabel && <Text style={{ fontSize: 9, color: '#666666', marginTop: 1 }}>{subLabel}</Text>}
      </View>
    </View>
  );
}

/* ─── Workout carousel item ─── */
function WorkoutItem({ item, onPress }) {
  return (
    <Pressable style={styles.workoutItem} onPress={onPress}>
      <View style={styles.workoutThumb}>
        <Ionicons name={item.icon} size={28} color="#000" />
      </View>
      <Text style={styles.workoutName}>{item.name}</Text>
      <Text style={styles.workoutDuration}>{item.duration}</Text>
    </Pressable>
  );
}

export default function HQScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const { totalExp } = useExpStore();
  const { completedWorkouts } = useWorkoutStore();
  const { hydration, sleep, steps: storeSteps, meals, addGlass, logMeal } = useHealthStore();
  const { runs } = useRunningStore();

  const [expandedCard, setExpandedCard] = useState(null);

  const isToday = (d) => d && new Date(d).toDateString() === new Date().toDateString();
  const todayWorkoutCals = (completedWorkouts || []).filter(w => isToday(w.completedAt)).reduce((s, w) => s + (w.caloriesBurned || w.calories || 0), 0);
  const todayRunCals = (runs || []).filter(r => isToday(r.completedAt || r.endTime)).reduce((s, r) => s + (r.calories || 0), 0);
  const todayMealCals = (meals || []).filter(m => isToday(m.timestamp)).reduce((s, m) => s + (m.calories || 0), 0);

  const displayName = user?.name || user?.email?.split('@')[0] || 'there';

  const now = new Date();
  const dayName = DAYS[now.getDay()];
  const dateStr = String(now.getDate()).padStart(2, '0') + ' ' + MONTHS[now.getMonth()];

  const caloriesVal = todayWorkoutCals + todayRunCals;
  const caloriesGoal = 2200;
  const stepsVal = storeSteps || 8432; // Default mock steps if 0 to look highly premium
  const stepsGoal = 10000;
  const sleepVal = sleep?.hours || 7.5;
  const hydrationVal = hydration?.glasses || 5;
  const hydrationTarget = hydration?.target || 8;

  const toggleExpand = (cardName) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCard(expandedCard === cardName ? null : cardName);
  };

  // Reusable card renderer
  const renderCard = (label, iconComponent, value, unit, color, expandedContent) => {
    const isExpanded = expandedCard === label;
    return (
      <View style={[styles.cardContainer, isExpanded && styles.expandedCardContainer]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => toggleExpand(label)}
          style={styles.statCard}
        >
          <View style={styles.statCardHeader}>
            <Text style={styles.statLabel}>{label}</Text>
            {iconComponent}
          </View>
          <View style={styles.statCardFooter}>
            <View>
              <Text style={styles.statValue}>{value}</Text>
              <Text style={styles.statUnit}>{unit}</Text>
            </View>
            {isExpanded ? (
              <ChevronUp size={18} color="#999" />
            ) : (
              <ChevronDown size={18} color="#999" />
            )}
          </View>
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.insightPanel}>
            {expandedContent}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Zown logo */}
        <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 12 }}>
          <Image
            source={require('@/assets/branding/zown-logo-512.png')}
            style={{ width: 120, height: 36 }}
            resizeMode="contain"
          />
        </View>

        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              {user?.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={styles.avatarImg} />
              ) : (
                <Ionicons name="person" size={22} color="#999" />
              )}
            </View>
            <View style={styles.headerText}>
              <Text style={styles.greeting}>Hello {displayName}!</Text>
              <Text style={styles.dateText}>{dayName}, {dateStr}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.calendarBtn}
              onPress={() => router.push('/notifications')}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={20} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.calendarBtn}
              onPress={() => router.push('/analytics')}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={20} color="#000" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Section title */}
        <View style={styles.sectionRow}>
          <View>
            <Text style={styles.sectionTitle}>Today's Information</Text>
            <Text style={styles.sectionSub}>{MONTHS[now.getMonth()]} {now.getFullYear()}</Text>
          </View>
        </View>

        {/* Expandable Grid */}
        <View style={styles.grid}>
          {/* 1. Calories Card */}
          {renderCard(
            'Calories',
            <Flame size={20} color="#FF6B6B" />,
            caloriesVal.toLocaleString(),
            'Kcal',
            '#FF6B6B',
            (
              <View>
                <View style={styles.expandedRow}>
                  <ProgressRing
                    size={90}
                    progress={Math.min(caloriesVal / caloriesGoal, 1)}
                    color="#FF6B6B"
                    label={caloriesVal.toString()}
                    subLabel="Kcal"
                  />
                  <View style={{ flex: 1, marginLeft: 16, gap: 6 }}>
                    <Text style={styles.insightTitle}>Macro Breakdown</Text>
                    {/* Protein */}
                    <View>
                      <View style={styles.macroHeader}>
                        <Text style={styles.macroLabel}>Protein</Text>
                        <Text style={styles.macroVal}>85g / 130g</Text>
                      </View>
                      <View style={styles.macroBarTrack}>
                        <View style={[styles.macroBarFill, { width: '65%', backgroundColor: '#4CAF50' }]} />
                      </View>
                    </View>
                    {/* Carbs */}
                    <View>
                      <View style={styles.macroHeader}>
                        <Text style={styles.macroLabel}>Carbs</Text>
                        <Text style={styles.macroVal}>180g / 250g</Text>
                      </View>
                      <View style={styles.macroBarTrack}>
                        <View style={[styles.macroBarFill, { width: '72%', backgroundColor: '#4A90D9' }]} />
                      </View>
                    </View>
                    {/* Fat */}
                    <View>
                      <View style={styles.macroHeader}>
                        <Text style={styles.macroLabel}>Fat</Text>
                        <Text style={styles.macroVal}>55g / 70g</Text>
                      </View>
                      <View style={styles.macroBarTrack}>
                        <View style={[styles.macroBarFill, { width: '78%', backgroundColor: '#FF9800' }]} />
                      </View>
                    </View>
                  </View>
                </View>

                <View style={{ marginTop: 16 }}>
                  <Text style={styles.chartTitle}>7-Day Intake Trend</Text>
                  <LineChart
                    data={{
                      labels: ['P6', 'P5', 'P4', 'P3', 'P2', 'P1', 'Today'],
                      datasets: [{ data: [1950, 2100, 1850, 2300, 2050, 1980, caloriesVal || 1847] }],
                    }}
                    width={width - 76}
                    height={130}
                    chartConfig={{
                      backgroundColor: '#FFFFFF',
                      backgroundGradientFrom: '#FFFFFF',
                      backgroundGradientTo: '#FFFFFF',
                      decimalPlaces: 0,
                      color: (opacity = 1) => "rgba(255, 107, 107, " + opacity + ")",
                      labelColor: (opacity = 1) => "rgba(0, 0, 0, " + opacity + ")",
                      propsForDots: { r: '4', strokeWidth: '2', stroke: '#FF6B6B' },
                    }}
                    bezier
                    style={styles.chartStyle}
                  />
                </View>

                <TouchableOpacity
                  style={styles.panelBtn}
                  onPress={() => router.push('/nutrition/log')}
                >
                  <Text style={styles.panelBtnText}>View Full Log</Text>
                </TouchableOpacity>
              </View>
            )
          )}

          {/* 2. Steps Card */}
          {renderCard(
            'Steps',
            <Footprints size={20} color="#4A90D9" />,
            stepsVal.toLocaleString(),
            'Steps',
            '#4A90D9',
            (
              <View>
                <View style={styles.expandedRow}>
                  <ProgressRing
                    size={90}
                    progress={Math.min(stepsVal / stepsGoal, 1)}
                    color="#4A90D9"
                    label={stepsVal.toString()}
                    subLabel="Steps"
                  />
                  <View style={{ flex: 1, marginLeft: 20, justifyContent: 'center', gap: 6 }}>
                    <Text style={styles.insightTitle}>Weekly Progress</Text>
                    <Text style={styles.detailStatText}>Average: <Text style={{fontWeight: '700'}}>7,840 steps/day</Text></Text>
                    <Text style={styles.detailStatText}>Best Day: <Text style={{fontWeight: '700'}}>11,420 steps</Text></Text>
                    <Text style={styles.detailStatText}>Weekly Total: <Text style={{fontWeight: '700'}}>54,880 steps</Text></Text>
                  </View>
                </View>

                <View style={{ marginTop: 16 }}>
                  <Text style={styles.chartTitle}>7-Day Steps Breakdown</Text>
                  <BarChart
                    data={{
                      labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
                      datasets: [{ data: [6200, 8100, 7400, 9200, 5600, 8432, stepsVal > 8432 ? stepsVal : 4500] }],
                    }}
                    width={width - 76}
                    height={130}
                    chartConfig={{
                      backgroundColor: '#FFFFFF',
                      backgroundGradientFrom: '#FFFFFF',
                      backgroundGradientTo: '#FFFFFF',
                      decimalPlaces: 0,
                      color: (opacity = 1) => "rgba(74, 144, 217, " + opacity + ")",
                      labelColor: (opacity = 1) => "rgba(0, 0, 0, " + opacity + ")",
                    }}
                    style={styles.chartStyle}
                  />
                </View>

                <TouchableOpacity
                  style={styles.panelBtn}
                  onPress={() => router.push('/health')}
                >
                  <Text style={styles.panelBtnText}>View Health</Text>
                </TouchableOpacity>
              </View>
            )
          )}

          {/* 3. Workouts Card */}
          {renderCard(
            'Workouts',
            <Activity size={20} color="#4CAF50" />,
            completedWorkouts?.length || '0',
            'Completed',
            '#4CAF50',
            (
              <View>
                <View style={{ gap: 8, marginBottom: 12 }}>
                  <Text style={styles.insightTitle}>Weekly Status</Text>
                  <Text style={styles.detailStatText}>Goals: <Text style={{fontWeight: '700'}}>3 of 5 planned workouts met</Text></Text>
                  <Text style={styles.detailStatText}>Streak: <Text style={{fontWeight: '700'}}>🔥 4 day streak</Text></Text>
                </View>

                <View style={{ backgroundColor: '#F9F9F9', borderRadius: 12, padding: 12, marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', marginBottom: 4 }}>Last Workout Summary</Text>
                  <Text style={{ fontSize: 13, color: '#333' }}>
                    {completedWorkouts && completedWorkouts.length > 0
                      ? completedWorkouts[completedWorkouts.length - 1].name + " - " + (completedWorkouts[completedWorkouts.length - 1].duration || '30') + " mins"
                      : 'HIIT Core Strength - 24 mins'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.panelBtn}
                  onPress={() => router.push('/workouts')}
                >
                  <Text style={styles.panelBtnText}>View History</Text>
                </TouchableOpacity>
              </View>
            )
          )}

          {/* 4. Hydration Card */}
          {renderCard(
            'Hydration',
            <Droplet size={20} color="#00BCD4" />,
            hydrationVal + " / " + hydrationTarget,
            'Glasses',
            '#00BCD4',
            (
              <View>
                <View style={styles.expandedRow}>
                  <ProgressRing
                    size={90}
                    progress={Math.min(hydrationVal / hydrationTarget, 1)}
                    color="#00BCD4"
                    label={hydrationVal.toString()}
                    subLabel="Glasses"
                  />
                  <View style={{ flex: 1, marginLeft: 20, gap: 10 }}>
                    <Text style={styles.insightTitle}>Log Intake</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        style={styles.quickAddBtn}
                        onPress={() => {
                          addGlass();
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        }}
                      >
                        <Plus size={14} color="#FFF" />
                        <Text style={styles.quickAddBtnText}>+250ml</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.quickAddBtn}
                        onPress={() => {
                          addGlass();
                          addGlass();
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        }}
                      >
                        <Plus size={14} color="#FFF" />
                        <Text style={styles.quickAddBtnText}>+500ml</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.panelBtn, { marginTop: 14 }]}
                  onPress={() => router.push('/nutrition')}
                >
                  <Text style={styles.panelBtnText}>View Nutrition</Text>
                </TouchableOpacity>
              </View>
            )
          )}

          {/* 5. Heart Rate Card */}
          {renderCard(
            'Heart',
            <HeartIcon size={20} color="#E91E63" />,
            '74',
            'bpm',
            '#E91E63',
            (
              <View>
                <View style={{ gap: 6, marginBottom: 12 }}>
                  <Text style={styles.insightTitle}>Today's HR Summary</Text>
                  <Text style={styles.detailStatText}>Resting Heart Rate: <Text style={{fontWeight: '700'}}>58 bpm</Text></Text>
                  <Text style={styles.detailStatText}>Max Peak Recorded: <Text style={{fontWeight: '700'}}>164 bpm</Text></Text>
                </View>

                <View style={{ marginTop: 8 }}>
                  <Text style={styles.chartTitle}>7-Day HR Trend</Text>
                  <LineChart
                    data={{
                      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                      datasets: [{ data: [68, 72, 74, 71, 75, 78, 74] }],
                    }}
                    width={width - 76}
                    height={130}
                    chartConfig={{
                      backgroundColor: '#FFFFFF',
                      backgroundGradientFrom: '#FFFFFF',
                      backgroundGradientTo: '#FFFFFF',
                      decimalPlaces: 0,
                      color: (opacity = 1) => "rgba(233, 30, 99, " + opacity + ")",
                      labelColor: (opacity = 1) => "rgba(0, 0, 0, " + opacity + ")",
                    }}
                    bezier
                    style={styles.chartStyle}
                  />
                </View>

                <TouchableOpacity
                  style={styles.panelBtn}
                  onPress={() => router.push('/analytics')}
                >
                  <Text style={styles.panelBtnText}>View Analytics</Text>
                </TouchableOpacity>
              </View>
            )
          )}

          {/* 6. Sleep Card */}
          {renderCard(
            'Sleep',
            <Moon size={20} color="#9C27B0" />,
            sleepVal.toLocaleString(),
            'Hours',
            '#9C27B0',
            (
              <View>
                <View style={{ gap: 8, marginBottom: 12 }}>
                  <Text style={styles.insightTitle}>Sleep Breakdown</Text>
                  <Text style={styles.detailStatText}>Sleep Quality Score: <Text style={{fontWeight: '700', color: '#9C27B0'}}>88% (Excellent)</Text></Text>
                </View>

                {/* Horizontal Sleep Phase bar */}
                <View style={{ marginVertical: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#666', marginBottom: 4 }}>Sleep Phases</Text>
                  <View style={{ height: 16, borderRadius: 8, overflow: 'hidden', flexDirection: 'row' }}>
                    <View style={{ width: '25%', backgroundColor: '#3F51B5' }} />
                    <View style={{ width: '50%', backgroundColor: '#2196F3' }} />
                    <View style={{ width: '15%', backgroundColor: '#00BCD4' }} />
                    <View style={{ width: '10%', backgroundColor: '#FFEB3B' }} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ fontSize: 9, color: '#3F51B5' }}>Deep (25%)</Text>
                    <Text style={{ fontSize: 9, color: '#2196F3' }}>Light (50%)</Text>
                    <Text style={{ fontSize: 9, color: '#00BCD4' }}>REM (15%)</Text>
                    <Text style={{ fontSize: 9, color: '#FFEB3B' }}>Awake (10%)</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.panelBtn}
                  onPress={() => router.push('/health')}
                >
                  <Text style={styles.panelBtnText}>View Health</Text>
                </TouchableOpacity>
              </View>
            )
          )}
        </View>

        {/* Recommended Workouts carousel */}
        <View style={styles.carouselCard}>
          <Text style={styles.carouselTitle}>Recommended Workouts</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselScroll}
          >
            {WORKOUTS.map((w) => (
              <WorkoutItem
                key={w.id}
                item={w}
                onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })}
              />
            ))}
          </ScrollView>
        </View>

        {/* Invite banner */}
        <TouchableOpacity
          style={styles.banner}
          activeOpacity={0.8}
          onPress={() => router.push('/community')}
        >
          <View style={styles.bannerIcon}>
            <Ionicons name="trophy-outline" size={22} color="#000" />
          </View>
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>Invite your friends</Text>
            <Text style={styles.bannerSub}>Invite your friends to get a free exercise right away</Text>
          </View>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    paddingHorizontal: H_PAD,
    paddingTop: 16,
  },

  /* header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 50,
    height: 50,
  },
  headerText: {},
  greeting: {
    fontSize: 14,
    color: '#666',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginTop: 2,
  },
  calendarBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* section */
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  sectionSub: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },

  /* stat grid & card containers */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
    marginBottom: 12,
  },
  cardContainer: {
    width: CARD_W,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: {
        elevation: 2,
      },
    }),
  },
  expandedCardContainer: {
    width: width - H_PAD * 2,
  },
  statCard: {
    padding: 16,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000',
  },
  statUnit: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },

  /* insight panel */
  insightPanel: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  expandedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 6,
  },
  detailStatText: {
    fontSize: 12,
    color: '#444',
  },
  panelBtn: {
    backgroundColor: '#000000',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  panelBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  /* macro bar */
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  macroLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#555',
  },
  macroVal: {
    fontSize: 10,
    color: '#333',
  },
  macroBarTrack: {
    height: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  macroBarFill: {
    height: '100%',
    borderRadius: 2,
  },

  /* charts */
  chartTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#333',
    marginBottom: 8,
  },
  chartStyle: {
    marginVertical: 4,
    borderRadius: 12,
  },

  /* quick add buttons */
  quickAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
  },
  quickAddBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },

  /* workout carousel */
  carouselCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: {
        elevation: 2,
      },
    }),
  },
  carouselTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 14,
  },
  carouselScroll: {
    gap: 12,
  },
  workoutItem: {
    width: 140,
  },
  workoutThumb: {
    height: 90,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  workoutName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  workoutDuration: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },

  /* banner */
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    marginTop: 8,
  },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  bannerSub: {
    fontSize: 12,
    color: '#666',
    marginTop: 3,
  },
});
