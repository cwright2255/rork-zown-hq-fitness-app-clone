import LoadingSkeleton from '@/src/components/LoadingSkeleton';
import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Pressable,
  Image,
  Dimensions,
  StatusBar,
  Platform,
  LayoutAnimation,
  UIManager,
  Modal,
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
import { useHomeWidgetsStore } from '@/store/homeWidgetsStore';
import { computeCalorieMetrics, estimateCaloriesFromSteps } from '@/lib/calorieMetrics';
import SwipeableCaloriesContent from '@/components/SwipeableCaloriesContent';
import { computeStepsMetrics } from '@/lib/stepsMetrics';
import SwipeableStepsContent from '@/components/SwipeableStepsContent';
import PromptModal from '@/components/PromptModal';
import { useRunningStore } from '@/store/runningStore';
import { getFullOrderedLayout, getWidgetDefinition } from '@/lib/homeWidgets';
import StrengthScoreWidget from '@/components/StrengthScoreWidget';
import FastingWidget from '@/components/FastingWidget';
import WidgetEditorModal from '@/components/WidgetEditorModal';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');
const CARD_GAP = 12;
const H_PAD = 22;
const CARD_W = (width - H_PAD * 2 - CARD_GAP) / 2;
const chartWidth = width - H_PAD * 2 - 32;

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

/* ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Circular Progress Ring Component ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ */
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

/* ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Workout carousel item ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ */
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
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { loadProfile } = useUserStore();
  const { loadXP } = useExpStore();
  const { loadWorkouts } = useWorkoutStore();
  const { loadAllHealth } = useHealthStore();
  const { loadRuns } = useRunningStore();

  const onRefresh = async () => {
    setRefreshing(true);
    setIsLoading(true);
    try {
      if (user?.uid) {
        await Promise.all([
          loadProfile(user.uid),
          loadXP(user.uid),
          loadWorkouts(user.uid),
          loadAllHealth(user.uid),
          loadRuns(user.uid)
        ]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const router = useRouter();
  const { user, updateUser, saveProfile } = useUserStore();
  const { getDailyExp } = useExpStore();
  const { completedWorkouts } = useWorkoutStore();
  const { hydration, sleep, steps: storeSteps, stepsHistory, meals, addGlass, flightsClimbed } = useHealthStore();
  const { rookRecovery, loadRookRecovery, loadAppleHealthActivity } = useHealthStore();
  useEffect(() => {
    if (user?.uid) {
      loadRookRecovery();
      loadAppleHealthActivity(user.uid);
    }
  }, [user?.uid]);
  const { layout: widgetLayout, loadLayout: loadWidgetLayout, isEditing } = useHomeWidgetsStore();
  useEffect(() => {
    if (user?.uid) loadWidgetLayout(user.uid);
  }, [user?.uid]);
  const isWidgetEnabled = (id) => {
    const entry = widgetLayout.find((w) => w.id === id);
    // Default to enabled if a widget genuinely isn't in the layout yet
    // (e.g. a brand-new widget added to the registry after someone
    // already saved a custom layout) - matches getDefaultWidgetLayout's
    // own "everything on by default" behavior rather than silently
    // hiding something new.
    return entry ? entry.enabled : true;
  };
  const { runs } = useRunningStore();

  const [expandedCard, setExpandedCard] = useState(null);
  const [showWidgetMenu, setShowWidgetMenu] = useState(false);
  const [showCalorieGoalModal, setShowCalorieGoalModal] = useState(false);

  const isToday = (d) => d && new Date(d).toDateString() === new Date().toDateString();
  const todayMealCals = (meals || []).filter(m => isToday(m.timestamp)).reduce((s, m) => s + (m.calories || 0), 0);

  const displayName = user?.name || user?.email?.split('@')[0] || 'there';

  const now = new Date();
  const dayName = DAYS[now.getDay()];
  const dateStr = String(now.getDate()).padStart(2, '0') + ' ' + MONTHS[now.getMonth()];

  const stepsVal = storeSteps || 0;
  const stepsGoal = 10000;

  // Real steps-based calorie contribution, added into today's total
  // only - see lib/calorieMetrics.js's own comment on
  // estimateCaloriesFromSteps for exactly why this doesn't retroactively
  // touch weekly/lifetime figures below.
  const stepsCalorieEstimate = useMemo(
    () => estimateCaloriesFromSteps(stepsVal, user?.weightKg),
    [stepsVal, user?.weightKg]
  );

  // Single, real source of truth for burned-calorie numbers - replaces
  // the previous todayWorkoutCals/todayRunCals pair, which computed the
  // same "today" total in a slightly different way from calorieMetrics.js
  // (risk of the two silently drifting apart over time).
  const calorieMetrics = useMemo(
    () => computeCalorieMetrics(completedWorkouts, runs, user?.dailyCalorieGoal, stepsCalorieEstimate),
    [completedWorkouts, runs, user?.dailyCalorieGoal, stepsCalorieEstimate]
  );
  const caloriesVal = calorieMetrics.todayCalories;
  const caloriesGoal = calorieMetrics.dailyCalorieGoal || 2200;

  // Real Overview/Breakdown/Trends/Lifetime for Steps, mirroring
  // calorieMetrics above exactly - see lib/stepsMetrics.js. stepsHistory
  // only starts recording real per-day data going forward from when
  // that field shipped, so this starts small and grows for real over
  // time, same as calorieMetrics' own history-dependent fields do.
  const stepsMetrics = useMemo(
    () => computeStepsMetrics(stepsHistory, stepsGoal),
    [stepsHistory, stepsGoal]
  );
  // Real fix: previously sleep?.hours || 7.5 - since the dead sleep
  // field (store/healthStore.js's standalone one, confirmed unreachable
  // elsewhere) is always exactly 0, this always fell through to a
  // hardcoded 7.5, never reflecting anything real. Now reads
  // rookRecovery.sleepHours, the same real, already-working data source
  // the Recovery panel below already correctly displays.
  const sleepVal = rookRecovery?.sleepHours ?? null;
  const hydrationVal = hydration?.glasses || 0;
  const hydrationTarget = hydration?.target || 8;
  // Real fix: previously getTotalExp() - lifetime cumulative XP, not
  // daily. Now reads the new getDailyExp() getter (store/expStore.js),
  // which tracks XP earned specifically today. Math.round guards
  // against fractional XP (e.g. steps-XP's per-step rate can produce
  // non-whole amounts) reaching the display as a decimal.
  const xpVal = getDailyExp ? Math.round(getDailyExp()) : 0;

  const toggleExpand = (cardName) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCard(expandedCard === cardName ? null : cardName);
  };

  /* Unified card wrapper that supports exact original styles when collapsed */
  const renderExpandableCard = (label, icon, value, unit, isHydration = false, expandedContent) => {
    const isExpanded = expandedCard === label;
    return (
      <View style={[styles.cardContainer, isExpanded && styles.expandedCardContainer, isExpanded && { overflow: 'visible' }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => toggleExpand(label)}
          style={styles.statCard}
        >
          {isHydration ? (
            // Original HydrationCard collapsed layout
            <View style={{ flex: 1, justifyContent: 'space-between' }}>
              <View style={styles.statCardHeader}>
                <Text style={styles.statLabel}>{label}</Text>
                <Ionicons name={icon} size={20} color="#000" />
              </View>
              <Text style={styles.statValue}>{value}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: Math.min((hydrationVal / hydrationTarget) * 100, 100) + '%' }]} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.statUnit}>{unit}</Text>
                {isExpanded ? (
                  <ChevronUp size={14} color="#999" />
                ) : (
                  <ChevronDown size={14} color="#999" />
                )}
              </View>
            </View>
          ) : (
            // Original standard StatCard collapsed layout
            <View style={{ flex: 1, justifyContent: 'space-between' }}>
              <View style={styles.statCardHeader}>
                <Text style={styles.statLabel}>{label}</Text>
                <Ionicons name={icon} size={20} color="#000" />
              </View>
              <Text style={styles.statValue}>{value}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.statUnit}>{unit}</Text>
                {isExpanded ? (
                  <ChevronUp size={14} color="#999" />
                ) : (
                  <ChevronDown size={14} color="#999" />
                )}
              </View>
            </View>
          )}
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.insightPanel}>
            {expandedContent}
          </View>
        )}
      </View>
    );
  };

  // Real, new: makes the existing, always-present homeWidgetsStore
  // (layout/toggleWidget/reorderWidget) actually control what's on
  // screen - previously every widget below was hardcoded, individually,
  // in this fixed source order, so isWidgetEnabled correctly hid a
  // disabled widget but reorderWidget's stored order was never
  // reflected here at all. Each entry's own JSX/logic is completely
  // unchanged from before - only wrapped as a named function so it can
  // be looked up by id and rendered in real, stored order.
  const widgetRenderers = {
    calories: () => (
      renderExpandableCard(
            'Calories',
            'flame-outline',
            caloriesVal.toLocaleString(),
            'Kcal',
            false,
            (
              <SwipeableCaloriesContent
                metrics={calorieMetrics}
                onSetGoal={() => setShowCalorieGoalModal(true)}
              />
            )
          )
    ),
    heart: () => (
      renderExpandableCard(
            'Heart',
            'heart-outline',
            rookRecovery?.restingHeartRate != null ? String(Math.round(rookRecovery.restingHeartRate)) : '\u2014',
            'bpm',
            false,
            (
              <View>
                {rookRecovery ? (
                  <View style={{ gap: 6, marginBottom: 12 }}>
                    <Text style={styles.insightTitle}>Today's Recovery</Text>
                    {rookRecovery.restingHeartRate != null && (
                      <Text style={styles.detailStatText}>Resting Heart Rate: <Text style={{fontWeight: '700'}}>{Math.round(rookRecovery.restingHeartRate)} bpm</Text></Text>
                    )}
                    {rookRecovery.hrv != null && (
                      <Text style={styles.detailStatText}>HRV: <Text style={{fontWeight: '700'}}>{Math.round(rookRecovery.hrv)} ms</Text></Text>
                    )}
                    {rookRecovery.sleepHours != null && (
                      <Text style={styles.detailStatText}>Sleep: <Text style={{fontWeight: '700'}}>{rookRecovery.sleepHours}h</Text></Text>
                    )}
                    <Text style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Source: {rookRecovery.source}</Text>
                  </View>
                ) : (
                  <View style={{ gap: 6, marginBottom: 12 }}>
                    <Text style={styles.insightTitle}>No wearable data yet</Text>
                    <Text style={styles.detailStatText}>
                      Connect a device to see real resting heart rate and HRV here.
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.panelBtn}
                  onPress={() => router.push('/rook-connect')}
                >
                  <Text style={styles.panelBtnText}>{rookRecovery ? 'Manage Devices' : 'Connect Device'}</Text>
                </TouchableOpacity>
              </View>
            )
          )
    ),
    steps: () => (
      renderExpandableCard(
            'Steps',
            'footsteps-outline',
            stepsVal.toLocaleString(),
            'Steps',
            false,
            (
              <SwipeableStepsContent
                metrics={stepsMetrics}
                onSetGoal={() => {}}
              />
            )
          )
    ),
    sleep: () => (
      renderExpandableCard(
            'Sleep',
            'moon-outline',
            sleepVal != null ? sleepVal.toLocaleString() : '\u2014',
            'Hours',
            false,
            (
              <View>
                {rookRecovery?.sleepHours != null ? (
                  <View style={{ gap: 6, marginBottom: 12 }}>
                    <Text style={styles.insightTitle}>Last Night</Text>
                    <Text style={styles.detailStatText}>Sleep: <Text style={{fontWeight: '700'}}>{rookRecovery.sleepHours}h</Text></Text>
                    <Text style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Source: {rookRecovery.source}</Text>
                  </View>
                ) : (
                  <View style={{ gap: 6, marginBottom: 12 }}>
                    <Text style={styles.insightTitle}>No wearable data yet</Text>
                    <Text style={styles.detailStatText}>
                      Connect a device to see real sleep data here.
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.panelBtn}
                  onPress={() => router.push('/health')}
                >
                  <Text style={styles.panelBtnText}>View Health</Text>
                </TouchableOpacity>
              </View>
            )
          )
    ),
    totalXp: () => (
      renderExpandableCard(
            'Total Daily XP',
            'star-outline',
            xpVal.toLocaleString(),
            'points',
            false,
            (
              <View>
                <View style={{ gap: 6, marginBottom: 12 }}>
                  <Text style={styles.insightTitle}>XP Overview</Text>
                  <Text style={styles.detailStatText}>Current Level: <Text style={{fontWeight: '700'}}>Level 12</Text></Text>
                  <Text style={styles.detailStatText}>Next Level: <Text style={{fontWeight: '700'}}>840 XP remaining</Text></Text>
                </View>

                <View style={{ marginTop: 8 }}>
                  <Text style={styles.chartTitle}>7-Day XP Earnings</Text>
                  <BarChart
                    data={{
                      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                      datasets: [{ data: [150, 300, 100, 450, 200, 150, 100] }],
                    }}
                    width={chartWidth}
                    height={180}
                    chartConfig={{
                      backgroundColor: '#FFFFFF',
                      backgroundGradientFrom: '#FFFFFF',
                      backgroundGradientTo: '#FFFFFF',
                      decimalPlaces: 0,
                      color: (opacity = 1) => "rgba(255, 193, 7, " + opacity + ")",
                      labelColor: (opacity = 1) => "rgba(0, 0, 0, " + opacity + ")",
                    }}
                    style={styles.chartStyle}
                  />
                </View>

                <TouchableOpacity
                  style={styles.panelBtn}
                  onPress={() => router.push('/battlepass')}
                >
                  <Text style={styles.panelBtnText}>View Battle Pass</Text>
                </TouchableOpacity>
              </View>
            )
          )
    ),
    storiesClimbed: () => (
      renderExpandableCard(
            'Stories Climbed',
            'trending-up-outline',
            flightsClimbed != null ? String(flightsClimbed) : '\u2014',
            'floors',
            false,
            (
              <View>
                {flightsClimbed != null ? (
                  <View style={{ gap: 6, marginBottom: 12 }}>
                    <Text style={styles.insightTitle}>Today's Climbing</Text>
                    <Text style={styles.detailStatText}>Floors Climbed: <Text style={{fontWeight: '700'}}>{flightsClimbed}</Text></Text>
                    <Text style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Source: Apple Health</Text>
                  </View>
                ) : (
                  <View style={{ gap: 6, marginBottom: 12 }}>
                    <Text style={styles.insightTitle}>No data yet</Text>
                    <Text style={styles.detailStatText}>
                      Connect Apple Health to see real floors climbed here.
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.panelBtn}
                  onPress={() => router.push('/rook-connect')}
                >
                  <Text style={styles.panelBtnText}>{flightsClimbed != null ? 'Manage Devices' : 'Connect Apple Health'}</Text>
                </TouchableOpacity>
              </View>
            )
          )
    ),
    restingHrv: () => (
      renderExpandableCard(
            'Resting HRV',
            'pulse-outline',
            rookRecovery?.hrv != null ? String(Math.round(rookRecovery.hrv)) : '\u2014',
            'ms',
            false,
            (
              <View>
                {rookRecovery?.hrv != null ? (
                  <View style={{ gap: 6, marginBottom: 12 }}>
                    <Text style={styles.insightTitle}>Today's Recovery</Text>
                    <Text style={styles.detailStatText}>HRV: <Text style={{fontWeight: '700'}}>{Math.round(rookRecovery.hrv)} ms</Text></Text>
                    <Text style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Source: {rookRecovery.source}</Text>
                  </View>
                ) : (
                  <View style={{ gap: 6, marginBottom: 12 }}>
                    <Text style={styles.insightTitle}>No wearable data yet</Text>
                    <Text style={styles.detailStatText}>
                      Connect a device to see real HRV data here.
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.panelBtn}
                  onPress={() => router.push('/health')}
                >
                  <Text style={styles.panelBtnText}>View Health</Text>
                </TouchableOpacity>
              </View>
            )
          )
    ),
    hydration: () => (
      renderExpandableCard(
            'Hydration',
            'water-outline',
            hydrationVal + " / " + hydrationTarget,
            'glasses',
            true,
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
          )
    ),
    recommendedWorkouts: () => (
      (
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
        )
    ),
    inviteFriends: () => (
      (
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
        )
    ),
    strengthScore: () => isWidgetEnabled('strengthScore') && <StrengthScoreWidget />,
    fasting: () => isWidgetEnabled('fasting') && <FastingWidget />,
  };

  const { gridWidgetIds, sectionWidgetIds } = useMemo(() => {
    const fullLayout = getFullOrderedLayout(widgetLayout);
    const allIds = fullLayout.filter((w) => w.enabled).map((w) => w.id);
    return {
      gridWidgetIds: allIds.filter((id) => getWidgetDefinition(id)?.kind === 'card'),
      sectionWidgetIds: allIds.filter((id) => getWidgetDefinition(id)?.kind !== 'card'),
    };
  }, [widgetLayout]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
        removeClippedSubviews={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
        }
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
          <TouchableOpacity hitSlop={8} onPress={() => setShowWidgetMenu(true)}>
            <Ionicons name="ellipsis-vertical" size={20} color="#000" />
          </TouchableOpacity>
        </View>

        {/* Expandable Grid */}
        <View style={styles.grid}>
          {gridWidgetIds.map((id) => (
            <React.Fragment key={id}>{widgetRenderers[id]?.()}</React.Fragment>
          ))}
        </View>

        {sectionWidgetIds.map((id) => (
          <React.Fragment key={id}>{widgetRenderers[id]?.()}</React.Fragment>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
      <Modal visible={showWidgetMenu} animationType="fade" transparent onRequestClose={() => setShowWidgetMenu(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setShowWidgetMenu(false)}>
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowWidgetMenu(false);
                useHomeWidgetsStore.getState().setEditing(true);
              }}
            >
              <Ionicons name="create-outline" size={18} color="#000" />
              <Text style={styles.menuItemText}>Edit Home Screen</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
      <WidgetEditorModal
        visible={isEditing}
        onClose={() => useHomeWidgetsStore.getState().setEditing(false)}
        uid={user?.uid}
      />
      <PromptModal
        visible={showCalorieGoalModal}
        title="Daily Calorie Goal"
        submitLabel="Save"
        fields={[
          { key: 'goal', label: 'How many calories do you want to burn per day?', placeholder: 'e.g. 500', keyboardType: 'numeric' },
        ]}
        onCancel={() => setShowCalorieGoalModal(false)}
        onSubmit={async (values) => {
          const goal = parseFloat(values.goal);
          if (!goal || Number.isNaN(goal)) {
            setShowCalorieGoalModal(false);
            return;
          }
          updateUser({ dailyCalorieGoal: goal });
          if (user?.uid) saveProfile(user.uid);
          setShowCalorieGoalModal(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 100, paddingRight: 20 },
  menuCard: { backgroundColor: '#FFF', borderRadius: 12, paddingVertical: 6, minWidth: 190, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16 },
  menuItemText: { fontSize: 14, fontWeight: '600', color: '#000' },
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    paddingHorizontal: H_PAD,
    paddingTop: 16,
    paddingBottom: 200,
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
    overflow: 'visible',
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
    overflow: 'visible',
  },
  statCard: {
    padding: 16,
    minHeight: 130,
    justifyContent: 'space-between',
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000',
  },
  statUnit: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },

  /* hydration progress bar */
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E5E5',
    marginTop: 8,
    marginBottom: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#000',
  },

  /* insight panel */
  insightPanel: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    padding: 16,
    paddingBottom: 20,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'visible',
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
