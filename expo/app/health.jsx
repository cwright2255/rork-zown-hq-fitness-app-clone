import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView,
  RefreshControl, Pressable, Image, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useHealthStore } from '@/store/healthStore';
import { useUserStore } from '@/store/userStore';
import { useBodyCompositionStore } from '@/store/bodyCompositionStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useRunningStore } from '@/store/runningStore';
import { useHikingStore } from '@/store/hikingStore';
import { useWeightLogStore } from '@/store/weightLogStore';
import { useSettingsStore } from '@/store/settingsStore';
import { aggregateDailyLoad, calculateTrainingLoad } from '@/lib/trainingLoad';
import { calculateMuscleRecovery, fatigueFromRecovery } from '@/lib/muscleRecovery';
import { getLiftInsight, PRIMARY_LIFT_MUSCLES } from '@/lib/crossDomainInsights';
import { rookService } from '@/services/rookService';
import { getTrainingLoadInsight } from '@/services/insightService';
import { INSIGHT_SETTLE_MS } from '@/lib/insightCache';
import { recoveryTiles, recoveryCaption, bodyScanCard, hrvTitle } from '@/lib/healthDisplay';
import { localDateKey } from '@/lib/localDate';
import { computeReadiness } from '@/lib/readiness';
import { useEntitlement } from '@/hooks/useEntitlement';
import TrainingLoadCard from '@/components/TrainingLoadCard';
import ReadinessCard from '@/components/ReadinessCard';
import MuscleHeatmapCard from '@/components/MuscleHeatmapCard';
import HealthTrends from '@/components/HealthTrends';

export default function HealthScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const {
    loadAllHealth, loadAppleHealthActivity, steps, sleep, hydration, rookRecovery, loadRookRecovery, readingsHistory, syncReadings,
  } = useHealthStore();
  const { user } = useUserStore();
  const { scans, loadScans } = useBodyCompositionStore();
  const { completedWorkouts, loadWorkouts, getExerciseHistory } = useWorkoutStore();
  const { runs, loadRuns } = useRunningStore();
  const { completedHikes, loadCompletedHikes } = useHikingStore();
  const { logs: weightLogs, loadLogs: loadWeightLogs } = useWeightLogStore();
  const pounds = useSettingsStore((st) => st.weightUnits) !== 'metric';
  const [trainingLoad, setTrainingLoad] = useState(null);
  const [trainingLoadInsight, setTrainingLoadInsight] = useState(null);
  const [muscleFatigue, setMuscleFatigue] = useState({});
  const [liftInsights, setLiftInsights] = useState([]);

  const latestScan = scans && scans.length ? scans[scans.length - 1] : null;

  // Body scan is part of a higher plan. Until the phone knows the plan nothing is marked, so a person who has it never sees the label flash up.
  const { can, ready } = useEntitlement();
  const bodyCard = bodyScanCard({ latestScan, locked: ready && !can('bodyScan') });

  // Real fix: previously read sleep?.hours - store/healthStore.js's
  // standalone sleep field, confirmed dead (logSleep, its only setter,
  // is never called from anywhere reachable). Real sleep data already
  // exists via rookRecovery (populated by loadRookRecovery below, the
  // same store field app/hq.jsx's own Heart card already reads
  // correctly) - this just wasn't wired to it. '\u2014' for genuinely
  // no data yet, matching that same card's convention, rather than a
  // fixed "0.0h" that looked like a real, if low, reading.
  // Apple Health has no sleep field on rookRecovery, so last night's sleep comes from the daily record the phone keeps (see Trends below).
  const sleepHours = rookRecovery?.sleepHours ?? readingsHistory?.[localDateKey(new Date())]?.sleepHours ?? null;
  const METRICS_LIVE = [
    { icon: 'walk-outline', label: 'Steps', value: `${steps ?? 0}`, current: steps ?? 0, target: 10000 },
    { icon: 'moon-outline', label: 'Sleep', value: sleepHours != null ? `${sleepHours.toFixed(1)}h` : '\u2014', current: sleepHours ?? 0, target: 8 },
    { icon: 'water-outline', label: 'Hydration', value: `${hydration?.glasses ?? 0}/${hydration?.target ?? 8}`, current: hydration?.glasses ?? 0, target: hydration?.target ?? 8 },
  ];

  // Today's readiness: the daily record of HRV, resting heart rate and sleep, and the training load worked out below.
  const readiness = computeReadiness({
    history: readingsHistory, today: localDateKey(new Date()), trainingLoad, hrvLabel: hrvTitle(rookRecovery),
  });

  useEffect(() => {
    if (user?.uid) {
      loadAllHealth(user.uid);
      loadAppleHealthActivity(user.uid);
      loadRookRecovery();
      syncReadings(user.uid);
      loadWeightLogs(user.uid);
      loadScans(user.uid);
      loadWorkouts(user.uid);
      loadRuns(user.uid);
      loadCompletedHikes(user.uid);
    }
  }, [user?.uid]);

  // The AI's comment on the training numbers. It is asked for once the numbers have stopped changing (the lists load one after the
  // other), at most once a day for each set of numbers, and kept on the phone (services/insightService.js), so opening this
  // screen again does not spend another request.
  useEffect(() => {
    const dailyLoad = aggregateDailyLoad({ completedWorkouts, runs, completedHikes });
    const result = calculateTrainingLoad(dailyLoad);
    setTrainingLoad(result);
    setTrainingLoadInsight(null);
    if (!user?.uid || result.zone === 'insufficient_data') return undefined;

    let cancelled = false;
    const timer = setTimeout(() => {
      getTrainingLoadInsight({ uid: user.uid, trainingLoad: result }).then((text) => {
        if (!cancelled) setTrainingLoadInsight(text);
      });
    }, INSIGHT_SETTLE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [completedWorkouts, runs, completedHikes, user?.uid]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let recovery;
      const rookData = await rookService.getTodayRecovery();
      if (rookData?.hrv != null || rookData?.sleepHours != null) {
        recovery = {
          hrv: rookData.hrv,
          sleepHours: rookData.sleepHours,
          sleepQuality: rookData.sleepEfficiency != null
            ? (rookData.sleepEfficiency >= 85 ? 'good' : rookData.sleepEfficiency >= 60 ? 'fair' : 'poor')
            : undefined,
        };
      } else if (sleep?.hours) {
        recovery = { sleepHours: sleep.hours, sleepQuality: sleep.quality };
      }

      if (cancelled) return;
      const fatigue = fatigueFromRecovery(calculateMuscleRecovery({ completedWorkouts, runs, completedHikes, recovery }));
      setMuscleFatigue(fatigue);
    })();
    return () => { cancelled = true; };
  }, [completedWorkouts, runs, completedHikes, sleep?.hours, sleep?.quality]);

  // Real, new: cross-domain lift insights - real plateau detection
  // (lib/crossDomainInsights.js) for each of the three primary lifts,
  // cross-checked against real running/hiking load. Runs once real runs/
  // hikes history is loaded; re-fetches each lift's own logged-set
  // history directly (same query shape getBestOneRepMaxes already uses)
  // rather than depending on completedWorkouts' own exercise list, since
  // the plateau math needs the full per-session history, not just a
  // single best. Silently empty (never a fabricated "all good" message)
  // when nothing real is detected for any of the three.
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    (async () => {
      const liftNames = Object.keys(PRIMARY_LIFT_MUSCLES);
      const histories = await Promise.all(
        liftNames.map((name) => getExerciseHistory(name, user.uid))
      );
      if (cancelled) return;
      const insights = liftNames
        .map((name, i) => getLiftInsight({
          exerciseName: name,
          muscleGroups: PRIMARY_LIFT_MUSCLES[name],
          loggedSets: histories[i],
          runs,
          completedHikes,
        }))
        .filter(Boolean);
      setLiftInsights(insights);
    })();
    return () => { cancelled = true; };
  }, [user?.uid, runs, completedHikes]);

  const onRefresh = async () => {
    setRefreshing(true);
    setIsLoading(true);
    try {
      if (user?.uid) {
        await loadAllHealth(user.uid);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };
return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
        }>
        <View style={s.logoRow}><Image source={require('@/assets/branding/zown-logo-512.png')} style={s.logo} resizeMode="contain" /></View>
        <Text style={s.pageTitle}>Health</Text>

        <Text style={s.sectionTitle}>Recovery</Text>
        <View style={s.statsRow}>
          {recoveryTiles(rookRecovery).map((tile) => (
            <View key={tile.key} testID={`recovery-${tile.key}`} style={s.statCard}>
              <Ionicons name={tile.icon} size={20} color="#000" />
              <Text style={s.statVal}>{tile.unit ? `${tile.value} ${tile.unit}` : tile.value}</Text>
              <Text style={s.statLabel}>{tile.label}</Text>
            </View>
          ))}
        </View>
        <Text testID="recovery-caption" style={s.recoveryCaption}>{recoveryCaption(rookRecovery)}</Text>

        <ReadinessCard readiness={readiness} />

        <TrainingLoadCard trainingLoad={trainingLoad} aiInsight={trainingLoadInsight} />

        <View style={{ marginHorizontal: 20, marginBottom: 18 }}>
          <MuscleHeatmapCard
            mode="fatigue"
            fatigueByMuscle={muscleFatigue}
            title="Muscle Fatigue"
            scan={latestScan}
            onRetryScan={() => user?.uid && loadScans(user.uid)}
          />
        </View>

        {liftInsights.length > 0 && (
          <View style={s.insightCard}>
            <View style={s.insightBadge}>
              <Ionicons name="git-compare-outline" size={14} color="#000" />
              <Text style={s.insightBadgeText}>Cross-Training Insight</Text>
            </View>
            {liftInsights.map((insight) => (
              <Text key={insight.exerciseName} style={[s.insightText, { marginBottom: 6 }]}>
                {insight.message}
              </Text>
            ))}
          </View>
        )}

        <TouchableOpacity
          testID="body-composition-card"
          style={s.bodyCard}
          onPress={() => router.push(bodyCard.cardRoute)}
          activeOpacity={0.7}
        >
          <View style={s.bodyCardTop}>
            <View style={s.bodyCardIcon}>
              <Ionicons name="body-outline" size={24} color="#4CAF50" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.bodyCardTitleRow}>
                <Text style={s.bodyCardTitle}>Body Composition</Text>
                {bodyCard.pill ? (
                  <View testID="body-composition-plan" style={s.planPill}><Text style={s.planPillText}>{bodyCard.pill}</Text></View>
                ) : null}
              </View>
              <Text style={s.bodyCardSubtitle}>{bodyCard.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {bodyCard.showViewProgress && (
              <View style={s.bodyCardSecondary}>
                <Text style={s.bodyCardSecondaryText}>View progress</Text>
              </View>
            )}
            <Pressable
              testID="body-composition-primary"
              onPress={(e) => { e.stopPropagation(); router.push(bodyCard.primaryRoute); }}
              style={s.bodyCardPrimary}
            >
              <Text style={s.bodyCardPrimaryText}>{bodyCard.primaryLabel}</Text>
            </Pressable>
          </View>
        </TouchableOpacity>

        <Text style={s.sectionTitle}>Health Metrics</Text>
        <View style={s.metricsCard}>
          {METRICS_LIVE.map((m,i) => (
            <View key={m.label} style={[s.metricRow, i === METRICS_LIVE.length-1 && {borderBottomWidth:0}]}>
              <Ionicons name={m.icon} size={20} color="#000" style={{width:30}} />
              <Text style={s.metricLabel}>{m.label}</Text>
              <Text testID={`metric-${m.label.toLowerCase()}`} style={s.metricValue}>{m.value}</Text>
              <View style={s.metricBarBg}><View testID={`metric-bar-${m.label.toLowerCase()}`} style={[s.metricBarFill,{width:Math.min(100,Math.round(m.current/m.target*100))+'%'}]} /></View>
            </View>
          ))}
        </View>

        <Text style={s.sectionTitle}>Trends</Text>
        <HealthTrends history={readingsHistory} weightLogs={weightLogs} pounds={pounds} hrvLabel={hrvTitle(rookRecovery)} />

        <Text style={s.sectionTitle}>Wearable Sync</Text>
        <View style={s.syncCard}>
          <Text style={s.syncTitle}>Connect Your Device</Text>
          <Text style={s.syncSubtitle}>
            Sync real heart rate, HRV, and sleep data from Garmin, Fitbit, WHOOP, Oura, Polar, Withings, Dexcom, or Strava.
          </Text>
          <Pressable style={s.syncBtn} onPress={() => router.push('/rook-connect')}>
            <Text style={s.syncBtnText}>Manage Devices</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#FFFFFF'}, scroll:{flex:1}, scrollContent:{paddingBottom:100},
  logoRow:{alignItems:'center',marginTop:8,marginBottom:12}, logo:{width:120,height:36},
  pageTitle:{fontSize:24,fontWeight:'800',color:'#000',paddingHorizontal:20,marginBottom:16},
  statsRow:{flexDirection:'row',gap:10,paddingHorizontal:20,marginBottom:8},
  recoveryCaption:{fontSize:12,color:'#777',paddingHorizontal:20,marginBottom:20},
  statCard:{flex:1,backgroundColor:'#FFF',borderRadius:14,padding:14,alignItems:'center',...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}}})},
  statVal:{fontSize:18,fontWeight:'800',color:'#000',marginTop:4},
  statLabel:{fontSize:10,color:'#999',marginTop:2},
  insightCard:{backgroundColor:'#F5F5F5',borderRadius:16,padding:16,marginHorizontal:20,marginBottom:20},
  insightBadge:{flexDirection:'row',alignItems:'center',gap:4,marginBottom:8},
  insightBadgeText:{fontSize:12,fontWeight:'700',color:'#000'},
  insightText:{fontSize:14,color:'#444',lineHeight:22},
  insightLink:{fontSize:14,fontWeight:'600',color:'#000',marginTop:8},
  sectionTitle:{fontSize:18,fontWeight:'700',color:'#000',paddingHorizontal:20,marginTop:8,marginBottom:10},
  metricsCard:{backgroundColor:'#FFF',borderRadius:16,padding:16,marginHorizontal:20,marginBottom:20,...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}}})},
  metricRow:{flexDirection:'row',alignItems:'center',paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#F0F0F0'},
  metricLabel:{fontSize:14,fontWeight:'600',color:'#000',flex:1},
  metricValue:{fontSize:14,fontWeight:'700',color:'#000',marginRight:10,width:80,textAlign:'right'},
  metricBarBg:{width:60,height:4,borderRadius:2,backgroundColor:'#E5E5E5',overflow:'hidden'},
  metricBarFill:{height:4,borderRadius:2,backgroundColor:'#000'},
  syncCard:{backgroundColor:'#FFF',borderRadius:16,padding:16,marginHorizontal:20,marginBottom:24,...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}}})},
  syncTitle:{fontSize:16,fontWeight:'700',color:'#000',marginBottom:6},
  syncSubtitle:{fontSize:13,color:'#666',lineHeight:18,marginBottom:16},
  syncBtn:{backgroundColor:'#000',height:44,borderRadius:22,justifyContent:'center',alignItems:'center'},
  syncBtnText:{fontSize:14,fontWeight:'700',color:'#FFF'},
  bodyCard:{backgroundColor:'#F5F5F5',borderRadius:16,padding:20,marginBottom:18,marginHorizontal:20},
  bodyCardTop:{flexDirection:'row',alignItems:'center',marginBottom:10},
  bodyCardIcon:{width:44,height:44,borderRadius:12,backgroundColor:'#E8F5E9',justifyContent:'center',alignItems:'center',marginRight:12},
  bodyCardTitleRow:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:2},
  bodyCardTitle:{fontSize:16,fontWeight:'700',color:'#1A1A2E'},
  bodyCardSubtitle:{fontSize:13,color:'#666',lineHeight:18},
  planPill:{backgroundColor:'#000',borderRadius:8,paddingHorizontal:8,paddingVertical:2},
  planPillText:{fontSize:11,fontWeight:'700',color:'#FFD700'},
  bodyCardSecondary:{flex:1,backgroundColor:'#FFF',borderRadius:10,paddingVertical:10,alignItems:'center',borderWidth:1,borderColor:'#4CAF50'},
  bodyCardSecondaryText:{color:'#4CAF50',fontSize:14,fontWeight:'600'},
  bodyCardPrimary:{flex:1,backgroundColor:'#4CAF50',borderRadius:10,paddingVertical:10,alignItems:'center'},
  bodyCardPrimaryText:{color:'#FFF',fontSize:14,fontWeight:'600'},
});
