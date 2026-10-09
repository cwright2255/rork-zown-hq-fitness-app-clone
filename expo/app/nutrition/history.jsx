import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import { useNutritionStore } from '@/store/nutritionStore';
import { useUserStore } from '@/store/userStore';
import { localDateKey, parseDateKey } from '@/lib/localDate';
import { buildHistory, summarizeHistory } from '@/lib/nutritionHistory';
import { dayLabel } from '@/lib/mealCopy';

const RANGES = [7, 30, 90];
const CHART_HEIGHT = 120;
const n = (v) => Number(v).toLocaleString('en-US');

const barHeight = (day, max) => (day.logged && max > 0 ? Math.max(3, Math.round((day.calories / max) * CHART_HEIGHT)) : 2);

// What was eaten over the last week, month or three months: averages for the
// days that have food, a bar for every day against the calorie goal, and the
// days themselves (tap one to open it in the diary).
export default function IntakeHistoryScreen() {
  const [days, setDays] = useState(7);
  const [refreshing, setRefreshing] = useState(false);
  const { meals, dailyGoals, loadNutritionData } = useNutritionStore();
  const { user } = useUserStore();

  const todayKey = localDateKey();
  const history = useMemo(() => buildHistory(meals, { endKey: todayKey, days }), [meals, todayKey, days]);
  const summary = useMemo(() => summarizeHistory(history, dailyGoals), [history, dailyGoals]);
  const loggedDays = useMemo(() => history.filter((d) => d.logged).reverse(), [history]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (user && user.uid && loadNutritionData) await loadNutritionData(user.uid);
    } finally {
      setRefreshing(false);
    }
  };

  const goalLine = summary.goalCalories && summary.maxCalories > 0
    ? Math.round((summary.goalCalories / summary.maxCalories) * CHART_HEIGHT)
    : null;

  let versusGoal = null;
  if (summary.calorieDiff !== null) {
    const diff = Math.abs(summary.calorieDiff);
    versusGoal = diff === 0
      ? `Right on your ${n(summary.goalCalories)} kcal goal`
      : `${n(diff)} kcal ${summary.calorieDiff < 0 ? 'under' : 'over'} your ${n(summary.goalCalories)} kcal goal`;
  }

  const extra = (value, unit) => (value === null ? '—' : `${n(value)}${unit}`);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Intake History" showBack />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.pills}>
          {RANGES.map((r) => (
            <TouchableOpacity
              key={r}
              testID={`history-range-${r}`}
              style={[styles.pill, days === r ? styles.pillActive : styles.pillInactive]}
              onPress={() => setDays(r)}>
              <Text style={[styles.pillText, { color: days === r ? '#FFFFFF' : '#666666' }]}>{r} days</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View testID="history-summary" style={styles.card}>
          {summary.loggedDays === 0 ? (
            <Text testID="history-empty" style={styles.empty}>No food logged in the last {days} days.</Text>
          ) : (
            <>
              <Text style={styles.cardLabel}>Average per logged day</Text>
              <Text testID="history-avg-calories" style={styles.bigNumber}>{n(summary.avgCalories)}</Text>
              <Text style={styles.cardSub}>kcal</Text>
              {versusGoal ? <Text testID="history-vs-goal" style={styles.versus}>{versusGoal}</Text> : null}
              <Text testID="history-days-logged" style={styles.cardSub}>
                {summary.loggedDays} of {summary.totalDays} days logged
              </Text>

              <View style={styles.statRow}>
                <View style={styles.stat}><Text style={styles.statVal}>{n(summary.avgProtein)}g</Text><Text style={styles.statLabel}>Protein</Text></View>
                <View style={styles.stat}><Text style={styles.statVal}>{n(summary.avgCarbs)}g</Text><Text style={styles.statLabel}>Carbs</Text></View>
                <View style={styles.stat}><Text style={styles.statVal}>{n(summary.avgFat)}g</Text><Text style={styles.statLabel}>Fat</Text></View>
              </View>
              <View style={styles.statRow}>
                <View style={styles.stat}><Text testID="history-avg-fiber" style={styles.statVal}>{extra(summary.avgFiber, 'g')}</Text><Text style={styles.statLabel}>Fiber</Text></View>
                <View style={styles.stat}><Text testID="history-avg-sugar" style={styles.statVal}>{extra(summary.avgSugar, 'g')}</Text><Text style={styles.statLabel}>Sugar</Text></View>
                <View style={styles.stat}><Text testID="history-avg-sodium" style={styles.statVal}>{extra(summary.avgSodium, 'mg')}</Text><Text style={styles.statLabel}>Sodium</Text></View>
              </View>
            </>
          )}
        </View>

        {summary.loggedDays > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Calories per day</Text>
            <View testID="history-chart" style={styles.card}>
              <View style={[styles.chart, { height: CHART_HEIGHT }]}>
                {goalLine !== null ? <View testID="history-goal-line" style={[styles.goalLine, { bottom: goalLine }]} /> : null}
                {history.map((d) => (
                  <View key={d.date} style={styles.barSlot}>
                    <View
                      testID={`history-bar-${d.date}`}
                      accessibilityLabel={`${d.date}: ${d.logged ? `${Math.round(d.calories)} kcal` : 'nothing logged'}`}
                      style={[styles.bar, d.logged ? styles.barLogged : styles.barEmpty, { height: barHeight(d, summary.maxCalories) }]}
                    />
                  </View>
                ))}
              </View>
              {days === 7 ? (
                <View style={styles.axis}>
                  {history.map((d) => (
                    <Text key={d.date} style={styles.axisLabel}>
                      {parseDateKey(d.date).toLocaleDateString(undefined, { weekday: 'narrow' })}
                    </Text>
                  ))}
                </View>
              ) : null}
              {goalLine !== null ? <Text style={styles.legend}>Line: your {n(summary.goalCalories)} kcal goal</Text> : null}
            </View>

            <Text style={styles.sectionLabel}>Days</Text>
            {loggedDays.map((d) => (
              <TouchableOpacity
                key={d.date}
                testID={`history-day-${d.date}`}
                style={styles.dayRow}
                onPress={() => router.push({ pathname: '/nutrition', params: { date: d.date } })}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dayTitle}>{dayLabel(d.date, todayKey)}</Text>
                  <Text style={styles.daySub}>
                    P {Math.round(d.protein)}g {'·'} C {Math.round(d.carbs)}g {'·'} F {Math.round(d.fat)}g
                  </Text>
                </View>
                <Text style={styles.dayCals}>{n(Math.round(d.calories))} kcal</Text>
                <ChevronRight size={18} color="#999999" />
              </TouchableOpacity>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16, paddingBottom: 140 },
  pills: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  pill: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  pillActive: { backgroundColor: '#000000' },
  pillInactive: { backgroundColor: '#F0F0F0' },
  pillText: { fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEEEEE', borderRadius: 16,
    padding: 16, marginBottom: 16, alignItems: 'center',
  },
  cardLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: '#999999' },
  bigNumber: { fontSize: 44, fontWeight: '800', color: '#000000', marginTop: 4, letterSpacing: -1 },
  cardSub: { fontSize: 13, color: '#999999', marginTop: 2 },
  versus: { fontSize: 14, fontWeight: '600', color: '#000000', marginTop: 8, marginBottom: 2 },
  empty: { color: '#999999', fontSize: 14, paddingVertical: 12 },
  statRow: { flexDirection: 'row', alignSelf: 'stretch', marginTop: 16 },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 16, fontWeight: '700', color: '#000000' },
  statLabel: { fontSize: 12, color: '#999999', marginTop: 2 },
  sectionLabel: { fontSize: 18, fontWeight: '700', color: '#000000', marginBottom: 10, marginTop: 4 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', alignSelf: 'stretch', gap: 2 },
  goalLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#BBBBBB' },
  barSlot: { flex: 1, justifyContent: 'flex-end', alignItems: 'stretch' },
  bar: { borderRadius: 2 },
  barLogged: { backgroundColor: '#000000' },
  barEmpty: { backgroundColor: '#E5E5E5' },
  axis: { flexDirection: 'row', alignSelf: 'stretch', gap: 2, marginTop: 6 },
  axisLabel: { flex: 1, textAlign: 'center', fontSize: 11, color: '#999999' },
  legend: { fontSize: 11, color: '#999999', marginTop: 8 },
  dayRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  dayTitle: { fontSize: 15, fontWeight: '600', color: '#000000' },
  daySub: { fontSize: 12, color: '#999999', marginTop: 2 },
  dayCals: { fontSize: 14, fontWeight: '600', color: '#000000' },
});
