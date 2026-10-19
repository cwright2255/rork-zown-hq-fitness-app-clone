import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Bell, Check, ChevronLeft, ChevronRight, Dumbbell, Footprints, CalendarDays, Plus, Repeat, Trash2, Utensils, Flag,
} from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import CalendarEventSheet from '@/components/CalendarEventSheet';
import { useScheduleStore } from '@/store/scheduleStore';
import { useMealPlanStore } from '@/store/mealPlanStore';
import { useGoalsStore } from '@/store/goalsStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useUserStore } from '@/store/userStore';
import { useActivityDays } from '@/services/streakService';
import { askForReminderPermission, reconcileReminders } from '@/services/calendarReminders';
import { MEAL_SLOTS } from '@/lib/foodLog';
import { formatTime, formatShortDate } from '@/lib/scheduleUtils';
import { localDateKey, parseDateKey } from '@/lib/localDate';
import { weekLabel } from '@/lib/mealPlan';
import {
  dayMarks, describeReminder, describeRepeat, goalMarkers, kindLabel, monthDay, occurrenceStatus, occurrencesOn, upcomingOccurrences, weekSummary,
} from '@/lib/calendarEvents';

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOT = { workout: '#000000', meal: '#2E7D32', goal: '#E65100', other: '#9E9E9E' };
const first = (v) => (Array.isArray(v) ? v[0] : v);
const pad = (n) => String(n).padStart(2, '0');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const KIND_ICON = { workout: Dumbbell, run: Footprints, nutrition: Utensils, other: CalendarDays };

// The calendar: a month grid, and under it the selected day (events, meals from the meal plan, goals due), how the week of
// workouts is going, goals with deadlines, and what is coming up. Events are added here, by the AI coach after the person says
// yes, or (for meals) from the meal plan; each can repeat and can remind.
export default function CalendarScreen() {
  const params = useLocalSearchParams();
  const requested = first(params.date);
  const todayKey = localDateKey();
  const [selected, setSelected] = useState(() => (parseDateKey(requested) ? requested : todayKey));
  // The sheet: null (closed), { event: null } for a new event, { event } for changing one.
  const [sheet, setSheet] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const user = useUserStore((s) => s.user);
  const events = useScheduleStore((s) => s.events);
  const addEvent = useScheduleStore((s) => s.addEvent);
  const updateEvent = useScheduleStore((s) => s.updateEvent);
  const skipOccurrence = useScheduleStore((s) => s.skipOccurrence);
  const removeEvent = useScheduleStore((s) => s.removeEvent);
  const setOccurrenceDone = useScheduleStore((s) => s.setOccurrenceDone);
  const mealEntries = useMealPlanStore((s) => s.entries);
  const goals = useGoalsStore((s) => s.goals);
  const workouts = useWorkoutStore((s) => s.workouts);
  const activeDays = useActivityDays();

  const uid = user && user.uid;
  React.useEffect(() => {
    if (!uid) return;
    // The calendar itself is merged with the cloud copy when the app opens (app/_layout.jsx); the meal plan, which shows on the
    // days, is merged when its own screen opens, so it is done here too, and the goals are loaded.
    useMealPlanStore.getState().startSync(uid);
    if (useGoalsStore.getState().goals.length === 0) useGoalsStore.getState().loadGoals(uid);
  }, [uid]);

  const view = parseDateKey(selected);
  const year = view.getFullYear();
  const month = view.getMonth();
  const active = useMemo(() => new Set(activeDays), [activeDays]);
  const goalList = useMemo(() => goalMarkers(goals, todayKey), [goals, todayKey]);
  const mealDates = useMemo(() => [...new Set(mealEntries.map((e) => e.date))], [mealEntries]);
  const marks = useMemo(() => dayMarks({ events, mealDates, goals: goalList }, year, month), [events, mealDates, goalList, year, month]);

  const dayOccurrences = useMemo(() => occurrencesOn(events, selected), [events, selected]);
  const dayMeals = useMemo(
    () => mealEntries
      .filter((e) => e.date === selected)
      .sort((a, b) => MEAL_SLOTS.findIndex((s) => s.id === a.slot) - MEAL_SLOTS.findIndex((s) => s.id === b.slot)),
    [mealEntries, selected]
  );
  const dayGoals = useMemo(() => goalList.filter((g) => g.date === selected), [goalList, selected]);
  const summary = useMemo(() => weekSummary(events, selected, active, todayKey), [events, selected, active, todayKey]);
  const upcoming = useMemo(() => upcomingOccurrences(events, new Date(), 5), [events]);
  const deadlineGoals = goalList.slice(0, 4);

  const cells = useMemo(() => {
    const lead = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    const list = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= count; d += 1) list.push(`${year}-${pad(month + 1)}-${pad(d)}`);
    while (list.length % 7 !== 0) list.push(null);
    const rows = [];
    for (let i = 0; i < list.length; i += 7) rows.push(list.slice(i, i + 7));
    return rows;
  }, [year, month]);

  const goToMonth = (delta) => {
    const first = new Date(year, month + delta, 1);
    setSelected(`${first.getFullYear()}-${pad(first.getMonth() + 1)}-01`);
  };

  // Reminders follow the calendar: after anything that changes it, they are set again from it.
  const syncReminders = () => { reconcileReminders(); };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (uid) {
        await Promise.all([useScheduleStore.getState().startSync(uid), useMealPlanStore.getState().startSync(uid), useGoalsStore.getState().loadGoals(uid)]);
        syncReminders();
      }
    } catch (e) {
      console.warn('[calendar] refresh failed:', e?.message);
    }
    setRefreshing(false);
  };

  const save = (form) => {
    const editing = sheet && sheet.event;
    const result = editing ? updateEvent(sheet.event.id, form) : addEvent(form);
    if (!result.ok) return result;
    setSelected(localDateKey(new Date(result.event.start)));
    const wantsReminder = result.event.remindMinutes !== null;
    (async () => {
      if (wantsReminder) await askForReminderPermission();
      const { blocked } = await reconcileReminders();
      if (blocked && wantsReminder) {
        Alert.alert('Reminders are off', 'Notifications are turned off for ZOWN, so there will be no reminder. You can turn them on in your phone\'s Settings.');
      }
    })();
    return result;
  };

  const tick = (o, status) => {
    // A workout or run that was logged counts as done by itself; only a tick can be taken back.
    if (status.done && !o.done) return;
    setOccurrenceDone(o.eventId, o.date, !o.done);
    syncReminders();
  };

  const confirmRemove = (o) => {
    if (!o.recurring) {
      Alert.alert('Remove from calendar?', o.title, [
        { text: 'Keep', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => { removeEvent(o.eventId); syncReminders(); } },
      ]);
      return;
    }
    Alert.alert('Remove a repeating event?', `${o.title} · ${describeRepeat(o.repeat)}`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Just this day', onPress: () => { skipOccurrence(o.eventId, o.date); syncReminders(); } },
      { text: 'All days', style: 'destructive', onPress: () => { removeEvent(o.eventId); syncReminders(); } },
    ]);
  };

  const openEvent = (o) => {
    const event = events.find((e) => e.id === o.eventId);
    if (event) setSheet({ event });
  };

  const workoutChoices = useMemo(
    () => (Array.isArray(workouts) ? workouts.filter((w) => w && w.id).map((w) => ({ id: w.id, name: w.name })) : []),
    [workouts]
  );

  const dots = (key) => {
    const m = marks.get(Number(key.slice(8, 10)));
    if (!m) return [];
    return ['workout', 'meal', 'goal', 'other'].filter((k) => m[k]);
  };

  const dayTitle = `${MONTHS[month]} ${view.getDate()}, ${year}`;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Calendar"
        showBack
        rightAction={
          <TouchableOpacity testID="calendar-add" accessibilityRole="button" accessibilityLabel="Add to calendar" onPress={() => setSheet({ event: null })} hitSlop={8}>
            <Plus size={24} color="#000" />
          </TouchableOpacity>
        }
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />}>
        <View style={styles.monthRow}>
          <TouchableOpacity testID="month-prev" accessibilityLabel="Previous month" onPress={() => goToMonth(-1)} hitSlop={10}>
            <ChevronLeft size={22} color="#000" />
          </TouchableOpacity>
          <Text testID="month-label" style={styles.monthLabel}>{MONTHS[month]} {year}</Text>
          <TouchableOpacity testID="month-next" accessibilityLabel="Next month" onPress={() => goToMonth(1)} hitSlop={10}>
            <ChevronRight size={22} color="#000" />
          </TouchableOpacity>
        </View>

        <View style={styles.calCard}>
          <View style={styles.weekdayRow}>
            {WEEKDAY_LETTERS.map((d, i) => <Text key={i} style={styles.weekdayLetter}>{d}</Text>)}
          </View>
          {cells.map((row, ri) => (
            <View key={ri} testID={`week-row-${ri}`} style={styles.weekRow}>
              {row.map((key, ci) => {
                if (!key) return <View key={ci} style={styles.dayCell} />;
                const isSelected = key === selected;
                const isToday = key === todayKey;
                return (
                  <TouchableOpacity
                    key={key}
                    testID={`day-${key}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={[styles.dayCell, isSelected && styles.dayCellSelected, isToday && !isSelected && styles.dayCellToday]}
                    onPress={() => setSelected(key)}>
                    <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{Number(key.slice(8, 10))}</Text>
                    <View style={styles.dotRow}>
                      {dots(key).map((k) => <View key={k} testID={`dot-${key}-${k}`} style={[styles.dot, { backgroundColor: isSelected ? '#FFFFFF' : DOT[k] }]} />)}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          <View style={styles.legend}>
            {[['workout', 'Workout'], ['meal', 'Meal'], ['goal', 'Goal'], ['other', 'Other']].map(([k, label]) => (
              <View key={k} style={styles.legendItem}><View style={[styles.dot, { backgroundColor: DOT[k] }]} /><Text style={styles.legendText}>{label}</Text></View>
            ))}
            {selected !== todayKey ? (
              <TouchableOpacity testID="calendar-today" accessibilityRole="button" onPress={() => setSelected(todayKey)} hitSlop={8}>
                <Text style={styles.todayLink}>Today</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View testID="week-summary" style={styles.card}>
          <Text style={styles.cardTitle}>Week of {weekLabel(selected)}</Text>
          {summary.planned > 0 ? (
            <>
              <Text style={styles.cardLine}>{summary.done} of {plural(summary.planned, 'workout')} done</Text>
              <View style={styles.barTrack}><View style={[styles.barFill, { width: `${summary.percent}%` }]} /></View>
              <Text style={styles.cardMeta}>
                {summary.missed > 0 ? `${summary.missed} missed · ` : ''}{summary.remaining} to go
                {summary.meals > 0 ? ` · ${plural(summary.meals, 'meal')} planned` : ''}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.cardLine}>No workouts planned this week.</Text>
              {summary.meals > 0 ? <Text style={styles.cardMeta}>{plural(summary.meals, 'meal')} planned</Text> : null}
              <View style={styles.ctaRow}>
                <TouchableOpacity testID="week-add-workout" accessibilityRole="button" style={styles.cta} onPress={() => setSheet({ event: null })}>
                  <Text style={styles.ctaText}>Schedule a workout</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="week-ask-coach" accessibilityRole="button" style={styles.cta} onPress={() => router.push('/coach')}>
                  <Text style={styles.ctaText}>Ask your Coach</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>{dayTitle}</Text>
        {dayOccurrences.map((o) => {
          const status = occurrenceStatus(o, active, todayKey);
          const Icon = KIND_ICON[o.kind] || CalendarDays;
          const detail = [o.recurring ? describeRepeat(o.repeat) : '', o.remindMinutes !== null ? describeReminder(o.remindMinutes) : ''].filter(Boolean).join(' · ');
          return (
            <View key={o.key} style={styles.occRow}>
              <TouchableOpacity
                testID={`occ-check-${o.key}`}
                accessibilityRole="checkbox"
                accessibilityLabel={`Mark ${o.title} done`}
                accessibilityState={{ checked: status.done }}
                style={[styles.check, status.done && styles.checkDone]}
                onPress={() => tick(o, status)}
                hitSlop={8}>
                {status.done ? <Check size={16} color="#FFF" /> : null}
              </TouchableOpacity>
              <TouchableOpacity testID={`occ-${o.key}`} accessibilityRole="button" style={styles.occInfo} onPress={() => openEvent(o)}>
                <Text style={[styles.occTitle, status.done && styles.occTitleDone]} numberOfLines={2}>{o.title}</Text>
                <Text style={styles.occTime}>
                  {formatTime(o.start)} · {kindLabel(o.kind)}
                  {status.tracked && status.done && !o.done ? ' · Logged' : ''}
                  {status.missed ? ' · Missed' : ''}
                </Text>
                {detail ? (
                  <View style={styles.detailRow}>
                    {o.recurring ? <Repeat size={11} color="#999" /> : <Bell size={11} color="#999" />}
                    <Text style={styles.occDetail}>{detail}</Text>
                  </View>
                ) : null}
                {o.notes ? <Text style={styles.occDetail} numberOfLines={2}>{o.notes}</Text> : null}
              </TouchableOpacity>
              <View style={styles.kindIcon}><Icon size={16} color="#000" /></View>
              <TouchableOpacity testID={`occ-remove-${o.key}`} accessibilityRole="button" accessibilityLabel={`Remove ${o.title}`} onPress={() => confirmRemove(o)} hitSlop={10} style={styles.remove}>
                <Trash2 size={18} color="#999" />
              </TouchableOpacity>
            </View>
          );
        })}

        {dayMeals.length > 0 ? (
          <TouchableOpacity testID="day-meals" accessibilityRole="button" style={styles.mealsBlock} onPress={() => router.push({ pathname: '/nutrition/plan', params: { date: selected } })}>
            <Text style={styles.mealsTitle}>Meal plan</Text>
            {dayMeals.map((m) => (
              <Text key={m.id} style={styles.mealLine} numberOfLines={1}>
                {(MEAL_SLOTS.find((s) => s.id === m.slot) || { name: m.slot }).name} · {m.name}{m.loggedAt ? ' · Logged' : ''}
              </Text>
            ))}
          </TouchableOpacity>
        ) : null}

        {dayGoals.map((g) => (
          <TouchableOpacity key={g.id} testID={`day-goal-${g.id}`} accessibilityRole="button" style={styles.goalDue} onPress={() => router.push('/progress')}>
            <Flag size={16} color="#E65100" />
            <Text style={styles.goalDueText} numberOfLines={2}>Goal due: {g.title} ({g.percent}%)</Text>
          </TouchableOpacity>
        ))}

        {dayOccurrences.length === 0 && dayMeals.length === 0 && dayGoals.length === 0 ? <Text style={styles.empty}>Nothing scheduled</Text> : null}

        <TouchableOpacity testID="day-add" accessibilityRole="button" style={styles.addBtn} onPress={() => setSheet({ event: null })}>
          <Plus size={18} color="#666" />
          <Text style={styles.addText}>Add to this day</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, styles.gap]}>Goals</Text>
        {deadlineGoals.length > 0 ? deadlineGoals.map((g) => (
          <TouchableOpacity key={g.id} testID={`goal-${g.id}`} accessibilityRole="button" style={styles.goalRow} onPress={() => router.push('/progress')}>
            <View style={styles.goalTop}>
              <Text style={styles.goalTitle} numberOfLines={1}>{g.title}</Text>
              <Text style={[styles.goalDate, g.overdue && styles.goalOverdue]}>{g.overdue ? 'Overdue · ' : 'Due '}{monthDay(g.date)}</Text>
            </View>
            <View style={styles.barTrack}><View style={[styles.barFill, { width: `${g.percent}%` }]} /></View>
          </TouchableOpacity>
        )) : (
          <TouchableOpacity testID="goals-empty" accessibilityRole="button" onPress={() => router.push('/progress')}>
            <Text style={styles.empty}>Set a goal with a deadline on the Progress tab and it shows up here.</Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.sectionTitle, styles.gap]}>Upcoming</Text>
        {upcoming.length > 0 ? upcoming.map((u) => (
          <TouchableOpacity key={u.key} testID={`upcoming-${u.key}`} accessibilityRole="button" style={styles.upRow} onPress={() => setSelected(u.date)}>
            <Text style={styles.upDate}>{formatShortDate(u.start)}</Text>
            <Text style={styles.upTitle} numberOfLines={1}>{u.title}</Text>
            <Text style={styles.upTime}>{formatTime(u.start)}</Text>
          </TouchableOpacity>
        )) : (
          <TouchableOpacity testID="upcoming-empty" accessibilityRole="button" onPress={() => router.push('/coach')}>
            <Text style={styles.empty}>Nothing coming up. Ask your AI Coach to plan your week.</Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.sectionTitle, styles.gap]}>Quick Log</Text>
        <View style={styles.quickRow}>
          {[
            { icon: Dumbbell, label: 'Log Workout', route: '/workouts' },
            { icon: Footprints, label: 'Log Run', route: '/running/program' },
            { icon: Utensils, label: 'Log Meal', route: '/nutrition' },
            { icon: Bell, label: 'Log Health', route: '/health' },
          ].map((q) => (
            <TouchableOpacity key={q.label} testID={`quick-${q.route}`} accessibilityRole="button" style={styles.quickItem} onPress={() => router.push(q.route)}>
              <View style={styles.quickCircle}><q.icon size={20} color="#000" /></View>
              <Text style={styles.quickLabel}>{q.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {sheet ? (
        <CalendarEventSheet
          event={sheet.event}
          initialDate={selected}
          workouts={workoutChoices}
          onSave={save}
          onOpenWorkout={(id) => { setSheet(null); router.push(`/workout/${id}`); }}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 140 },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 8, marginBottom: 12 },
  monthLabel: { fontSize: 18, fontWeight: '700', color: '#000' },
  calCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 12, marginHorizontal: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  weekdayRow: { flexDirection: 'row', marginBottom: 8 },
  weekdayLetter: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: '#999' },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 16, minHeight: 46, justifyContent: 'center' },
  dayCellSelected: { backgroundColor: '#000' },
  dayCellToday: { borderWidth: 1, borderColor: '#000' },
  dayText: { fontSize: 14, fontWeight: '500', color: '#000' },
  dayTextSelected: { color: '#FFF', fontWeight: '700' },
  dotRow: { flexDirection: 'row', gap: 2, height: 6, marginTop: 2, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 11, color: '#666' },
  todayLink: { fontSize: 12, fontWeight: '700', color: '#000', textDecorationLine: 'underline' },
  card: { backgroundColor: '#F7F7F7', borderRadius: 16, padding: 16, marginHorizontal: 20, marginBottom: 20 },
  cardTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: '#999' },
  cardLine: { fontSize: 16, fontWeight: '700', color: '#000', marginTop: 6 },
  cardMeta: { fontSize: 13, color: '#666', marginTop: 8 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: '#E5E5E5', marginTop: 10, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: '#000' },
  ctaRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  cta: { flex: 1, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: '#000', alignItems: 'center' },
  ctaText: { fontSize: 13, fontWeight: '600', color: '#000' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000', paddingHorizontal: 20, marginBottom: 12 },
  gap: { marginTop: 24 },
  occRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#CCC', alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: '#000', borderColor: '#000' },
  occInfo: { flex: 1, marginLeft: 12 },
  occTitle: { fontSize: 15, fontWeight: '600', color: '#000' },
  occTitleDone: { color: '#999', textDecorationLine: 'line-through' },
  occTime: { fontSize: 12, color: '#666', marginTop: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  occDetail: { fontSize: 12, color: '#999', marginTop: 2 },
  kindIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  remove: { marginLeft: 10 },
  mealsBlock: { marginHorizontal: 20, marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: '#F1F8F2' },
  mealsTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: '#2E7D32', marginBottom: 6 },
  mealLine: { fontSize: 14, color: '#000', marginTop: 2 },
  goalDue: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: '#FFF3E8' },
  goalDueText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#000' },
  empty: { fontSize: 14, color: '#999', paddingHorizontal: 20, marginBottom: 12 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 20, marginTop: 12, borderWidth: 1, borderColor: '#E5E5E5', borderStyle: 'dashed', borderRadius: 12, padding: 14 },
  addText: { fontSize: 14, color: '#666' },
  goalRow: { paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  goalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#000' },
  goalDate: { fontSize: 12, color: '#666', marginLeft: 8 },
  goalOverdue: { color: '#C62828' },
  upRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  upDate: { fontSize: 13, fontWeight: '700', color: '#000', width: 56 },
  upTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#000' },
  upTime: { fontSize: 12, color: '#999' },
  quickRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 20, marginBottom: 24 },
  quickItem: { alignItems: 'center' },
  quickCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  quickLabel: { fontSize: 11, fontWeight: '600', color: '#000', marginTop: 6, textAlign: 'center' },
});
