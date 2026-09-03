import LoadingSkeleton from '@/src/components/LoadingSkeleton';
import EmptyState from '@/src/components/EmptyState';
import ScanMeshPreview from '@/components/ScanMeshPreview';
import ScanComparisonSection from '@/components/ScanComparisonSection';
import PromptModal from '@/components/PromptModal';
import React, { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { View, Text, StyleSheet, ScrollView,
  RefreshControl, Pressable, Image, Platform, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useHealthStore } from '@/store/healthStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useRunningStore } from '@/store/runningStore';
import { useUserStore } from '@/store/userStore';
import { useBodyCompositionStore } from '@/store/bodyCompositionStore';
import { useGoalsStore } from '@/store/goalsStore';
import { useWeightLogStore } from '@/store/weightLogStore';
// WEIGHT_DATA_LIVE removed - now sourced from useWeightLogStore (real Firestore data)
// GOALS_LIVE removed - now sourced from useGoalsStore (real Firestore data)
// MEASUREMENTS removed - now sourced from real scan data (waist/hip/shoulder are the only measurements bodyCompositionService.js actually computes)
// MONTHLY removed - now computed live from real workout/run records

export default function ProgressScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { weightHistory, loadAllHealth } = useHealthStore();
  const { user, updateUser, saveProfile } = useUserStore();

  const { scans, loadScans } = useBodyCompositionStore();
  useEffect(() => {
    if (user?.uid && scans.length === 0) loadScans(user.uid);
  }, [user?.uid]);
  const { goals, loadGoals, addGoal, updateGoalProgress } = useGoalsStore();
  useEffect(() => {
    if (user?.uid && goals.length === 0) loadGoals(user.uid);
  }, [user?.uid]);
  const { completedWorkouts } = useWorkoutStore();
  const { runs } = useRunningStore();
  const { logs: weightLogs, loadLogs: loadWeightLogs, addLog: addWeightLog } = useWeightLogStore();
  useEffect(() => {
    if (user?.uid && weightLogs.length === 0) loadWeightLogs(user.uid);
  }, [user?.uid]);
  // Real min/max scaling for the chart, derived from actual logged weight
  // entries (kg, converted to lbs for display). Guards against an empty
  // log history so maxW/minW/range never end up NaN before any entry
  // exists. Must come after weightLogs is declared above - this used to
  // sit near the top of the component when it read from a module-level
  // constant (no ordering concern), and stayed in that wrong spot after
  // being switched to read from the real store value.
  const weightValsLbs = weightLogs.map((l) => Math.round(l.weightKg * 2.20462));
  const maxW = weightValsLbs.length ? Math.max(...weightValsLbs) : 0;
  const minW = weightValsLbs.length ? Math.min(...weightValsLbs) : 0;
  const range = maxW - minW || 1;
  const latestScan = scans.length ? scans[scans.length - 1] : null;
  const bodyScan = latestScan ? {
    date: latestScan.createdAtLocal,
    bodyFat: latestScan.bodyFatPercent,
    bmi: latestScan.bmi,
    // Lean mass isn't stored directly - standard estimate from recorded
    // weight and body fat %, converted kg -> lbs. Null if weight wasn't
    // provided at scan time (it's optional on the intake form).
    leanMass: (latestScan.weightKg != null && latestScan.bodyFatPercent != null)
      ? Math.round(latestScan.weightKg * (1 - latestScan.bodyFatPercent / 100) * 2.20462)
      : null,
  } : null;

  // Custom-styled modal state, replacing Alert.prompt (a native iOS-only
  // dialog that can't be restyled). activeModal is null | 'addGoal' |
  // 'logWeight' | 'targetWeight' - only one flow open at a time.
  const [activeModal, setActiveModal] = useState(null);

  const handleAddGoal = () => setActiveModal('addGoal');

  const submitAddGoal = async (values) => {
    const title = (values.title || '').trim();
    const target = parseFloat(values.target);
    const unit = (values.unit || '').trim();
    if (!title || !target || Number.isNaN(target)) {
      Alert.alert('Missing info', 'Please fill in a title and a valid target number.');
      return;
    }
    try {
      await addGoal({ uid: user?.uid, title, current: 0, target, unit });
      setActiveModal(null);
    } catch (e) {
      Alert.alert("Couldn't save goal", e?.message || 'Please try again.');
    }
  };

  const promptForTargetWeight = () => setActiveModal('targetWeight');

  const submitTargetWeight = async (values) => {
    const targetLbs = parseFloat(values.targetWeight);
    if (!targetLbs || Number.isNaN(targetLbs)) {
      setActiveModal(null);
      return;
    }
    const targetWeightKg = Math.round((targetLbs / 2.20462) * 10) / 10;
    updateUser({ targetWeightKg });
    if (user?.uid) saveProfile(user.uid);
    setActiveModal(null);
  };

  const handleLogWeight = () => setActiveModal('logWeight');

  const submitLogWeight = async (values) => {
    const weightLbs = parseFloat(values.weight);
    if (!weightLbs || Number.isNaN(weightLbs)) {
      Alert.alert('Invalid weight', 'Please enter a number.');
      return;
    }
    const weightKg = Math.round((weightLbs / 2.20462) * 10) / 10;
    try {
      await addWeightLog(user?.uid, weightKg);
      updateUser({ weightKg });
      if (user?.uid) saveProfile(user.uid);
      if (user?.targetWeightKg == null) {
        setActiveModal('targetWeight');
      } else {
        setActiveModal(null);
      }
    } catch (e) {
      Alert.alert("Couldn't log weight", e?.message || 'Please try again.');
    }
  };

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
        <Text style={s.pageTitle}>Progress</Text>

        {/* Weight tracker */}

      {/* Latest Body Scan */}
      <View style={{ backgroundColor: '#F5F5F5', borderRadius: 16, padding: 18, marginBottom: 18 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="body-outline" size={20} color="#4CAF50" />
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginLeft: 8 }}>
              Latest Body Scan
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: '#999' }}>{bodyScan?.date ? new Date(bodyScan.date).toLocaleDateString() : 'No scan yet'}</Text>
        </View>
        <TouchableOpacity
          disabled={!latestScan}
          onPress={() => latestScan && router.push('/body-scan/' + latestScan.id)}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: '#4CAF50' }}>{bodyScan ? bodyScan.bodyFat + '%' : '\u2014'}</Text>
              <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Body Fat</Text>
            </View>
            <View style={{ width: 1, backgroundColor: '#E0E0E0' }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: '#1A1A2E' }}>{bodyScan ? bodyScan.leanMass + ' lbs' : '\u2014'}</Text>
              <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Lean Mass</Text>
            </View>
            <View style={{ width: 1, backgroundColor: '#E0E0E0' }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: '#1A1A2E' }}>{bodyScan ? bodyScan.bmi : '\u2014'}</Text>
              <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>BMI</Text>
            </View>
          </View>
          {latestScan && (
            <Text style={{ fontSize: 11, color: '#999', textAlign: 'center', marginTop: -8, marginBottom: 10 }}>
              Tap to view full scan
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={{ backgroundColor: '#4CAF50', borderRadius: 10, paddingVertical: 9, alignItems: 'center' }}
          onPress={() => router.push('/body-scan/capture')}
          activeOpacity={0.7}
        >
          <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>New Scan</Text>
        </TouchableOpacity>
        {scans.length > 1 && (
          <View style={{ marginTop: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A1A2E', marginBottom: 8 }}>
              Scan History
            </Text>
            {[...scans].reverse().map((scan) => (
              <TouchableOpacity
                key={scan.id}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10,
                  backgroundColor: '#FFF', marginBottom: 6,
                }}
                onPress={() => router.push('/body-scan/' + scan.id)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A2E' }}>
                  {scan.createdAtLocal ? new Date(scan.createdAtLocal).toLocaleDateString() : '\u2014'}
                </Text>
                <Text style={{ fontSize: 12, color: '#666' }}>
                  {scan.bodyFatPercent != null ? scan.bodyFatPercent + '% BF' : '\u2014'}
                  {scan.bmi != null ? '  \u00b7  BMI ' + scan.bmi : ''}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#999" />
              </TouchableOpacity>
            ))}
            {scans.length >= 2 && (
              <TouchableOpacity
                style={{
                  marginTop: 6, borderRadius: 10, paddingVertical: 9, alignItems: 'center',
                  borderWidth: 1, borderColor: '#1A1A2E',
                }}
                onPress={() => router.push({
                  pathname: '/body-scan/compare',
                  params: { a: scans[scans.length - 2].id, b: scans[scans.length - 1].id },
                })}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A2E' }}>Compare Scans</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

        <Text style={s.sectionTitle}>Weight</Text>
        <View style={s.card}>
          {weightLogs.length === 0 ? (
            <View>
              <Text style={{ fontSize: 13, color: '#999', marginBottom: 16 }}>
                No weight logged yet.
              </Text>
            </View>
          ) : (
            <View>
              <Text style={s.weightNum}>
                {weightValsLbs[weightValsLbs.length - 1]} lbs
              </Text>
              {weightValsLbs.length > 1 && (() => {
                const delta = weightValsLbs[0] - weightValsLbs[weightValsLbs.length - 1];
                const arrow = delta > 0 ? '\u2193' : delta < 0 ? '\u2191' : '';
                const text = arrow + ' ' + Math.abs(delta) + ' lbs from start';
                return <Text style={s.weightChange}>{text}</Text>;
              })()}
              {user?.targetWeightKg != null && (
                <Text style={s.weightGoal}>
                  {'Target: ' + Math.round(user.targetWeightKg * 2.20462) + ' lbs'}
                </Text>
              )}
              <View style={s.chartArea}>
                {weightLogs.map((log, i) => {
                  const valLbs = weightValsLbs[i];
                  const h = ((maxW - valLbs) / range) * 100;
                  const label = log.createdAtLocal
                    ? new Date(log.createdAtLocal).toLocaleDateString('en-US', { month: 'short' })
                    : '';
                  return (
                    <View key={log.id} style={s.chartCol}>
                      <View style={[s.chartDot,{marginTop:h}]} />
                      <Text style={s.chartLabel}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
          <Pressable style={s.logWeightBtn} onPress={handleLogWeight}>
            <Text style={s.logWeightBtnText}>Log Weight</Text>
          </Pressable>
        </View>

        <ScanComparisonSection scans={scans} />

        {/* Goals */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>Active Goals</Text>
          <Pressable onPress={handleAddGoal}><Text style={s.addLink}>Add Goal</Text></Pressable>
        </View>
        <View style={s.card}>
          {goals.length === 0 ? (
            <Text style={{ fontSize: 13, color: '#999' }}>
              No goals yet. Tap "Add Goal" to set one.
            </Text>
          ) : goals.map((g, i) => {
            const pct = g.target ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
            const remaining = g.target != null ? Math.max(0, g.target - g.current) : null;
            const detail = remaining && remaining > 0 ? `${remaining} ${g.unit} to go` : (g.completed ? 'Complete' : '');
            return (
              <View key={g.id} style={[{ marginBottom: i === goals.length - 1 ? 0 : 16 }]}>
                <Text style={s.goalTitle}>{g.title}</Text>
                <View style={s.goalBarBg}><View style={[s.goalBarFill,{width:pct+'%'}]} /></View>
                <View style={s.goalRow}>
                  <Text style={s.goalDetail}>{g.current}/{g.target} {g.unit} ({pct}%)</Text>
                  <Text style={s.goalExtra}>{detail}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Measurements - waist/hip/shoulder are the only fields
            bodyCompositionService.js actually computes per scan; no
            chest/arm/thigh data exists anywhere in the app, so those
            rows were dropped rather than shown with fabricated values. */}
        <View style={s.sectionRow}><Text style={s.sectionTitle}>Measurements</Text></View>
        <View style={s.card}>
          {(() => {
            if (!latestScan) {
              return <Text style={{ fontSize: 13, color: '#999' }}>No scan yet.</Text>;
            }
            const prevScan = scans.length > 1 ? scans[scans.length - 2] : null;
            const rows = [
              ['waistCircumferenceCm', 'Waist'],
              ['hipCircumferenceCm', 'Hip'],
              ['shoulderWidthCm', 'Shoulder width'],
            ].map(([key, label]) => {
              const val = latestScan.measurements?.[key];
              const prevVal = prevScan?.measurements?.[key];
              const delta = (typeof val === 'number' && typeof prevVal === 'number') ? val - prevVal : null;
              return { key, label, val, delta };
            }).filter((r) => r.val != null);
            return rows.map((r, i) => (
              <View key={r.key} style={[s.measRow, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={s.measLabel}>{r.label}</Text>
                <Text style={s.measValue}>{r.val} cm</Text>
                {r.delta != null && r.delta !== 0 ? (
                  <Text style={[s.measChange, { color: r.delta < 0 ? '#22C55E' : '#F97316' }]}>
                    {(r.delta > 0 ? '\u2191 ' : '\u2193 ') + Math.abs(r.delta).toFixed(1) + ' cm'}
                  </Text>
                ) : (
                  <Text style={s.measChange}> </Text>
                )}
              </View>
            ));
          })()}
        </View>

        {/* Monthly summary - genuinely computed from completedWorkouts/
            runs by real calendar month. XP has no historical log (only a
            running total on the user object), so it shows the current
            total with no fabricated "vs last month" comparison. */}
        {(() => {
          const now = new Date();
          const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const inRange = (dateStr, start, end) => {
            if (!dateStr) return false;
            const d = new Date(dateStr);
            return d >= start && d < end;
          };
          const thisMonthWorkouts = completedWorkouts.filter((w) => inRange(w.completedAt, thisMonthStart, now));
          const lastMonthWorkouts = completedWorkouts.filter((w) => inRange(w.completedAt, lastMonthStart, thisMonthStart));
          const thisMonthRuns = runs.filter((r) => inRange(r.startTime, thisMonthStart, now));
          const lastMonthRuns = runs.filter((r) => inRange(r.startTime, lastMonthStart, thisMonthStart));
          const sumCal = (arr, key) => arr.reduce((sum, item) => sum + (item[key] || 0), 0);
          const thisMonthCalories = sumCal(thisMonthWorkouts, 'caloriesBurned') + sumCal(thisMonthRuns, 'calories');
          const lastMonthCalories = sumCal(lastMonthWorkouts, 'caloriesBurned') + sumCal(lastMonthRuns, 'calories');
          const diffText = (curr, prev) => {
            const d = curr - prev;
            return d === 0 ? 'Same as last month' : (d > 0 ? '+' : '') + d + ' vs last month';
          };
          const monthLabel = now.toLocaleDateString('en-US', { month: 'long' });
          const stats = [
            { label: 'Workouts', val: String(thisMonthWorkouts.length), diff: diffText(thisMonthWorkouts.length, lastMonthWorkouts.length) },
            { label: 'Runs', val: String(thisMonthRuns.length), diff: diffText(thisMonthRuns.length, lastMonthRuns.length) },
            { label: 'Calories', val: thisMonthCalories.toLocaleString(), diff: diffText(thisMonthCalories, lastMonthCalories) },
            { label: 'XP', val: (user?.xp ?? 0).toLocaleString(), diff: 'Current total' },
          ];
          return (
            <View>
              <Text style={s.sectionTitle}>{monthLabel} Summary</Text>
              <View style={s.monthCard}>
                {stats.map((m) => (
                  <View key={m.label} style={s.monthStat}>
                    <Text style={s.monthVal}>{m.val}</Text>
                    <Text style={s.monthLabel}>{m.label}</Text>
                    <Text style={s.monthDiff}>{m.diff}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })()}
      </ScrollView>
      <PromptModal
        visible={activeModal === 'addGoal'}
        title="New Goal"
        submitLabel="Save Goal"
        fields={[
          { key: 'title', label: 'What do you want to achieve?', placeholder: 'e.g. Lose 10 lbs' },
          { key: 'target', label: "What's your target number?", placeholder: 'e.g. 10', keyboardType: 'numeric' },
          { key: 'unit', label: 'Unit for this goal', placeholder: 'e.g. lbs, workouts, km' },
        ]}
        onCancel={() => setActiveModal(null)}
        onSubmit={submitAddGoal}
      />
      <PromptModal
        visible={activeModal === 'logWeight'}
        title="Log Weight"
        submitLabel="Save"
        fields={[
          { key: 'weight', label: 'Enter your current weight (lbs)', placeholder: 'e.g. 175', keyboardType: 'numeric' },
        ]}
        onCancel={() => setActiveModal(null)}
        onSubmit={submitLogWeight}
      />
      <PromptModal
        visible={activeModal === 'targetWeight'}
        title="Target Weight"
        submitLabel="Save"
        fields={[
          { key: 'targetWeight', label: 'What weight are you working towards? (lbs)', placeholder: 'e.g. 170', keyboardType: 'numeric' },
        ]}
        onCancel={() => setActiveModal(null)}
        onSubmit={submitTargetWeight}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#FFFFFF'}, scroll:{flex:1}, scrollContent:{paddingBottom:100},
  logoRow:{alignItems:'center',marginTop:8,marginBottom:12}, logo:{width:120,height:36},
  pageTitle:{fontSize:24,fontWeight:'800',color:'#000',paddingHorizontal:20,marginBottom:8},
  sectionTitle:{fontSize:18,fontWeight:'700',color:'#000',paddingHorizontal:20,marginTop:16,marginBottom:10},
  sectionRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:20,marginTop:16,marginBottom:10},
  addLink:{fontSize:13,fontWeight:'600',color:'#666'},
  card:{backgroundColor:'#FFF',borderRadius:16,padding:16,marginHorizontal:20,marginBottom:16,...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}}})},
  weightNum:{fontSize:36,fontWeight:'800',color:'#000'},
  weightChange:{fontSize:14,color:'#22C55E',fontWeight:'600',marginTop:4},
  weightGoal:{fontSize:13,color:'#666',marginTop:2,marginBottom:16},
  chartArea:{flexDirection:'row',justifyContent:'space-around',height:120,marginBottom:12},
  chartCol:{alignItems:'center',flex:1},
  chartDot:{width:8,height:8,borderRadius:4,backgroundColor:'#000'},
  chartLabel:{fontSize:11,color:'#999',marginTop:4,position:'absolute',bottom:0},
  logWeightBtn:{backgroundColor:'#000',paddingHorizontal:20,paddingVertical:10,borderRadius:16,alignSelf:'center'},
  logWeightBtnText:{fontSize:13,fontWeight:'700',color:'#FFF'},
  goalCard:{backgroundColor:'#FFF',borderRadius:16,padding:16,marginHorizontal:20,marginBottom:12,...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}}})},
  goalTitle:{fontSize:16,fontWeight:'700',color:'#000',marginBottom:8},
  goalBarBg:{height:6,borderRadius:3,backgroundColor:'#E5E5E5',overflow:'hidden',marginBottom:6},
  goalBarFill:{height:6,borderRadius:3,backgroundColor:'#000'},
  goalRow:{flexDirection:'row',justifyContent:'space-between'},
  goalDetail:{fontSize:12,color:'#666'},
  goalExtra:{fontSize:12,color:'#999'},
  measRow:{flexDirection:'row',alignItems:'center',paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#F0F0F0'},
  measLabel:{fontSize:14,fontWeight:'600',color:'#000',flex:1},
  measValue:{fontSize:14,fontWeight:'700',color:'#000',marginRight:12},
  measChange:{fontSize:13,fontWeight:'600'},
  monthCard:{flexDirection:'row',flexWrap:'wrap',backgroundColor:'#FFF',borderRadius:16,padding:16,marginHorizontal:20,marginBottom:24,...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}}})},
  monthStat:{width:'50%',paddingVertical:8,alignItems:'center'},
  monthVal:{fontSize:22,fontWeight:'800',color:'#000'},
  monthLabel:{fontSize:11,color:'#999',marginTop:2},
  monthDiff:{fontSize:10,color:'#22C55E',marginTop:2},
});
