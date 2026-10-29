import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable, Dimensions, Platform, LayoutAnimation, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '@/store/userStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useNutritionStore } from '@/store/nutritionStore';
import { useWeightLogStore } from '@/store/weightLogStore';
import {
  getActiveFast, startFast, endFast, updateFastStart, getFastHistory, deleteFast,
} from '@/services/fastingService';
import { scheduleFastAlert, cancelFastAlert } from '@/services/fastingAlert';
import {
  FASTING_PLANS, DEFAULT_PLAN_ID, CUSTOM_PLAN_ID, DEFAULT_CUSTOM_HOURS, LONG_FAST_NOTE_HOURS,
  planById, planIdFor, stepCustomHours, fastLabel,
} from '@/lib/fastingPlans';
import {
  MIN_CORRELATION_POINTS, chartSeries, streaks, weightCorrelation, calorieCorrelation, linearFit,
  correlationSentence, formatR, shiftFastStart, goalTime, metGoal, normalizeFast,
  formatClock, formatDayLabel, formatStartLabel, formatDuration, formatHours,
} from '@/lib/fastingStats';
import { localDateKey } from '@/lib/localDate';
import FastingBarChart from '@/components/FastingBarChart';
import FastingScatterChart from '@/components/FastingScatterChart';

// Real fix: rebuilt to match the exact, established card structure every
// other widget on this screen uses (same size/shape as Calories, Heart,
// etc., collapsed to one headline value + tap-to-expand) - the original
// version was a full-width, differently-structured card. See
// StrengthScoreWidget.jsx's own comment on why the style values here
// are duplicated rather than shared with app/hq.jsx.
const { width } = Dimensions.get('window');
const CARD_GAP = 12;
const H_PAD = 22;
const CARD_W = (width - H_PAD * 2 - CARD_GAP) / 2;
const PANEL_W = width - H_PAD * 2 - 32; // the expanded card, less its padding
const PILL_W = (PANEL_W - 6 * 3) / 4; // four plans to a row

const KG_TO_LB = 2.20462;
const MINUTE = 60000;
const HOUR = 3600000;
const HISTORY_PAGE = 5;

const TABS = [
  { value: 'fast', label: 'Fast' },
  { value: 'history', label: 'History' },
  { value: 'charts', label: 'Charts' },
];
const RANGES = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'compare', label: 'Compare' },
];
const COMPARES = [
  { value: 'weight', label: 'Weight' },
  { value: 'calories', label: 'Calories' },
];
const RANGE_TITLES = {
  week: 'Last 7 days · hours fasted',
  month: 'Last 30 days · hours fasted',
  year: 'Last 12 months · average fast',
};

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

function Segments({ options, value, onChange, testPrefix, small }) {
  return (
    <View style={s.segments}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          testID={`${testPrefix}-${o.value}`}
          accessibilityRole="button"
          accessibilityState={{ selected: value === o.value }}
          style={[s.segment, value === o.value && s.segmentActive]}
          onPress={() => onChange(o.value)}
        >
          <Text style={[s.segmentText, small && { fontSize: 11 }, value === o.value && s.segmentTextActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function FastingWidget() {
  const { user } = useUserStore();
  const weightUnits = useSettingsStore((st) => st.weightUnits);
  const remindersOn = useSettingsStore((st) => st.notifications !== false);
  const meals = useNutritionStore((st) => st.meals);
  const weightLogs = useWeightLogStore((st) => st.logs);
  const loadWeightLogs = useWeightLogStore((st) => st.loadLogs);

  const [isLoading, setIsLoading] = useState(true);
  const [activeFast, setActiveFast] = useState(null);
  const [now, setNow] = useState(new Date());
  const [selectedPlan, setSelectedPlan] = useState(DEFAULT_PLAN_ID);
  const [customHours, setCustomHours] = useState(DEFAULT_CUSTOM_HOURS);
  const [isExpanded, setIsExpanded] = useState(false);
  const [tab, setTab] = useState('fast');
  const [busy, setBusy] = useState(false);
  const [alertStatus, setAlertStatus] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draftStart, setDraftStart] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyState, setHistoryState] = useState('idle'); // idle | loading | ready | error
  const [shown, setShown] = useState(HISTORY_PAGE);
  const [range, setRange] = useState('week');
  const [compare, setCompare] = useState('weight');
  const intervalRef = useRef(null);
  const weightAsked = useRef(false);

  // The running fast, and its goal alert (scheduled again here so a fast started
  // on another phone, or before alerts existed, still rings on this one).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.uid) {
        setIsLoading(false);
        return;
      }
      try {
        const fast = await getActiveFast(user.uid);
        if (cancelled) return;
        setActiveFast(fast);
        if (fast) {
          const status = await scheduleFastAlert(fast);
          if (!cancelled) setAlertStatus(status);
        }
      } catch (e) {
        console.warn('[FastingWidget] failed to load:', e?.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid]);

  // The Notifications switch (Settings) clears the goal alert when it is turned off (services/notificationStartup.js); when it is turned
  // back on with a fast running, this card, which knows the fast, sets it again. (When the card first opens there is no fast yet, so this
  // does nothing then: the alert for a fast already running is set where the fast is loaded, above.)
  useEffect(() => {
    if (!remindersOn || !activeFast) return;
    scheduleFastAlert(activeFast).then(setAlertStatus).catch(() => undefined);
  }, [remindersOn]);

  useEffect(() => {
    if (!activeFast) return undefined;
    intervalRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(intervalRef.current);
  }, [activeFast]);

  const loadHistory = useCallback(async () => {
    if (!user?.uid) return;
    setHistoryState('loading');
    try {
      setHistory(await getFastHistory(user.uid));
      setHistoryState('ready');
    } catch (e) {
      console.warn('[FastingWidget] failed to load history:', e?.message);
      setHistoryState('error');
    }
  }, [user?.uid]);

  // The history is only read once the card is opened, not every time Home does.
  useEffect(() => {
    if (isExpanded && historyState === 'idle') loadHistory();
  }, [isExpanded, historyState, loadHistory]);

  // Weight is only needed for the weight chart.
  useEffect(() => {
    const wanted = isExpanded && tab === 'charts' && range === 'compare' && compare === 'weight';
    if (wanted && user?.uid && weightLogs.length === 0 && !weightAsked.current) {
      weightAsked.current = true;
      loadWeightLogs(user.uid);
    }
  }, [isExpanded, tab, range, compare, user?.uid, weightLogs.length, loadWeightLogs]);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((v) => !v);
  };

  const plan = planById(selectedPlan);
  const selectedHours = plan ? plan.hours : customHours;

  const handleStart = async () => {
    if (!user?.uid || busy) return;
    setBusy(true);
    try {
      const fast = await startFast(user.uid, selectedHours, { plan: planIdFor(selectedPlan) });
      setActiveFast(fast);
      setNow(new Date());
      setAlertStatus(await scheduleFastAlert(fast, { ask: true }));
    } catch (e) {
      console.warn('[FastingWidget] start failed:', e?.message);
      Alert.alert('Could not start your fast', 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleEnd = async () => {
    if (!user?.uid || !activeFast || busy) return;
    setBusy(true);
    try {
      const out = await endFast(user.uid, activeFast, new Date());
      await cancelFastAlert();
      setActiveFast(null);
      setEditing(false);
      setAlertStatus(null);
      const entry = out?.entry;
      if (!entry) {
        setLastResult(null);
      } else if (!entry.saveable) {
        setLastResult({ kind: 'short', text: 'That fast was under 10 minutes, so it was not added to your history.' });
      } else if (!out.saved) {
        setLastResult({ kind: 'unsaved', text: 'Your fast ended, but it could not be saved to your history.' });
      } else {
        const ms = entry.endedAt - entry.startedAt;
        setLastResult({
          kind: 'saved',
          text: `Saved · ${formatDuration(ms)} · ${entry.completed ? 'goal reached' : `${formatHours(entry.targetHours)} goal not reached`}`,
        });
        const saved = normalizeFast(entry);
        if (saved) setHistory((h) => [saved, ...h.filter((f) => f.id !== saved.id)]);
      }
    } catch (e) {
      console.warn('[FastingWidget] end failed:', e?.message);
      Alert.alert('Could not end your fast', 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const openEdit = () => {
    setDraftStart(activeFast.startedAt);
    setEditing(true);
  };
  const nudge = (deltaMs) => setDraftStart((d) => shiftFastStart(d, deltaMs, new Date()));
  const saveEdit = async () => {
    if (!user?.uid || !activeFast || !draftStart || busy) return;
    setBusy(true);
    try {
      await updateFastStart(user.uid, draftStart);
      const moved = { ...activeFast, startedAt: draftStart };
      setActiveFast(moved);
      setEditing(false);
      setNow(new Date());
      setAlertStatus(await scheduleFastAlert(moved));
    } catch (e) {
      console.warn('[FastingWidget] start time change failed:', e?.message);
      Alert.alert('Could not change the start time', 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleAlertNote = async () => {
    if (!activeFast) return;
    if (alertStatus === 'blocked') {
      Linking.openSettings();
      return;
    }
    setAlertStatus(await scheduleFastAlert(activeFast, { ask: true }));
  };

  const confirmRemove = (fast) => {
    Alert.alert(
      'Remove this fast?',
      'It will be taken out of your history, streak and charts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFast(user.uid, fast.id);
              setHistory((h) => h.filter((f) => f.id !== fast.id));
            } catch (e) {
              console.warn('[FastingWidget] remove failed:', e?.message);
              Alert.alert('Could not remove it', 'Check your connection and try again.');
            }
          },
        },
      ],
    );
  };

  const elapsedMs = activeFast ? now - activeFast.startedAt : 0;
  const targetMs = activeFast ? activeFast.targetHours * HOUR : 0;
  const goalReached = !!activeFast && elapsedMs >= targetMs;
  const headline = isLoading ? '—' : (activeFast ? formatElapsed(elapsedMs) : '—');

  // The charts and the streak only change when the day does, not every second the timer ticks.
  const todayKey = localDateKey(now);
  const today = useMemo(() => new Date(), [todayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const streak = useMemo(() => streaks(history, today), [history, today]);
  const series = useMemo(
    () => (range === 'compare' ? null : chartSeries(history, range, today)),
    [history, range, today],
  );

  return (
    <View style={[s.cardContainer, isExpanded && s.expandedCardContainer, isExpanded && { overflow: 'visible' }]}>
      <TouchableOpacity testID="fasting-card" activeOpacity={0.8} onPress={toggleExpand} style={s.statCard}>
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <View style={s.statCardHeader}>
            <Text style={s.statLabel}>Fasting Timer</Text>
            <Ionicons name="timer-outline" size={20} color="#000" />
          </View>
          <Text style={s.statValue}>{headline}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={s.statUnit}>{activeFast ? (goalReached ? 'Goal reached' : `of ${activeFast.targetHours}h`) : 'Elapsed'}</Text>
            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color="#999" />
          </View>
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={s.insightPanel}>
          <Segments options={TABS} value={tab} onChange={setTab} testPrefix="fasting-tab" />

          {tab === 'fast' && (
            <View style={{ marginTop: 14 }}>
              {!activeFast ? (
                <View>
                  <Text style={s.insightTitle}>Start a Fast</Text>
                  <View style={s.pillGrid}>
                    {FASTING_PLANS.map((p) => (
                      <Pressable
                        key={p.id}
                        testID={`fasting-plan-${p.id}`}
                        style={[s.targetPill, selectedPlan === p.id && s.targetPillActive]}
                        onPress={() => setSelectedPlan(p.id)}
                      >
                        <Text style={[s.targetPillText, selectedPlan === p.id && s.targetPillTextActive]}>{p.label}</Text>
                      </Pressable>
                    ))}
                    <Pressable
                      testID="fasting-plan-custom"
                      style={[s.targetPill, selectedPlan === CUSTOM_PLAN_ID && s.targetPillActive]}
                      onPress={() => setSelectedPlan(CUSTOM_PLAN_ID)}
                    >
                      <Text style={[s.targetPillText, selectedPlan === CUSTOM_PLAN_ID && s.targetPillTextActive]}>Custom</Text>
                    </Pressable>
                  </View>

                  {selectedPlan === CUSTOM_PLAN_ID && (
                    <View style={s.customRow}>
                      {[['\u22126', -6], ['\u22121', -1]].map(([label, delta]) => (
                        <Pressable
                          key={label}
                          testID={`fasting-custom-${delta}`}
                          style={[s.stepBtn, stepCustomHours(customHours, delta) === customHours && s.nudgeBtnOff]}
                          onPress={() => setCustomHours((h) => stepCustomHours(h, delta))}
                        >
                          <Text style={s.nudgeText}>{label}</Text>
                        </Pressable>
                      ))}
                      <Text testID="fasting-custom-value" style={s.customValue}>{`${customHours}h`}</Text>
                      {[['+1', 1], ['+6', 6]].map(([label, delta]) => (
                        <Pressable
                          key={label}
                          testID={`fasting-custom-${delta}`}
                          style={[s.stepBtn, stepCustomHours(customHours, delta) === customHours && s.nudgeBtnOff]}
                          onPress={() => setCustomHours((h) => stepCustomHours(h, delta))}
                        >
                          <Text style={s.nudgeText}>{label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  <Text testID="fasting-plan-summary" style={s.planSummary}>
                    {`${plan ? `${plan.name} \u00b7 ` : ''}fast for ${selectedHours} ${selectedHours === 1 ? 'hour' : 'hours'}`}
                  </Text>
                  {selectedHours > LONG_FAST_NOTE_HOURS && (
                    <Text testID="fasting-long-note" style={s.longNote}>
                      Fasts over 24 hours are not for everyone. Check with your doctor first.
                    </Text>
                  )}

                  <TouchableOpacity
                    testID="fasting-start"
                    style={[s.panelBtn, busy && s.panelBtnOff]}
                    disabled={busy}
                    onPress={handleStart}
                  >
                    <Text style={s.panelBtnText}>Start Fasting</Text>
                  </TouchableOpacity>

                  {lastResult && (
                    <Text testID="fasting-last-result" style={[s.resultText, lastResult.kind !== 'saved' && s.resultTextMuted]}>
                      {lastResult.text}
                    </Text>
                  )}
                </View>
              ) : (
                <View>
                  <Text style={s.detailStatText}>
                    Target: <Text style={{ fontWeight: '700' }}>{fastLabel(activeFast.targetHours, activeFast.plan)}</Text>
                    {planById(activeFast.plan) ? ` · ${planById(activeFast.plan).name}` : ''}
                  </Text>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${Math.min(100, (elapsedMs / targetMs) * 100)}%` }]} />
                  </View>
                  <Text testID="fasting-status" style={s.statusText}>
                    {goalReached
                      ? `Goal reached · ${formatDuration(elapsedMs - targetMs)} over`
                      : `${formatDuration(targetMs - elapsedMs)} to go`}
                  </Text>
                  <Text testID="fasting-goal-time" style={s.detailStatText}>
                    {`Goal: ${formatStartLabel(goalTime(activeFast.startedAt, activeFast.targetHours), now)}`}
                  </Text>

                  {!editing ? (
                    <View style={s.startRow}>
                      <Text testID="fasting-started" style={s.detailStatText}>
                        {`Started ${formatStartLabel(activeFast.startedAt, now)}`}
                      </Text>
                      <TouchableOpacity testID="fasting-edit-start" onPress={openEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={s.linkText}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View testID="fasting-editor" style={s.editor}>
                      <Text style={s.editorLabel}>Started</Text>
                      <Text testID="fasting-draft" style={s.editorValue}>{formatStartLabel(draftStart, now)}</Text>
                      <View style={s.nudgeRow}>
                        {[
                          ['−1h', -HOUR], ['−15m', -15 * MINUTE], ['+15m', 15 * MINUTE], ['+1h', HOUR],
                        ].map(([label, delta]) => (
                          <Pressable
                            key={label}
                            testID={`fasting-nudge-${delta / MINUTE}`}
                            style={[
                              s.nudgeBtn,
                              shiftFastStart(draftStart, delta, now).getTime() === draftStart.getTime() && s.nudgeBtnOff,
                            ]}
                            onPress={() => nudge(delta)}
                          >
                            <Text style={s.nudgeText}>{label}</Text>
                          </Pressable>
                        ))}
                      </View>
                      <View style={s.nudgeRow}>
                        <TouchableOpacity testID="fasting-edit-cancel" style={[s.smallBtn, s.smallBtnGhost]} onPress={() => setEditing(false)}>
                          <Text style={[s.smallBtnText, { color: '#000' }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity testID="fasting-edit-save" style={s.smallBtn} onPress={saveEdit} disabled={busy}>
                          <Text style={s.smallBtnText}>Save</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {(alertStatus === 'not-allowed' || alertStatus === 'blocked') && (
                    <TouchableOpacity testID="fasting-alert-note" onPress={handleAlertNote}>
                      <Text style={s.alertNote}>
                        {alertStatus === 'blocked'
                          ? 'Goal alerts are off in your phone’s settings. Tap to open Settings.'
                          : 'Get an alert when you reach your goal. Tap to turn on notifications.'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity testID="fasting-end" style={[s.panelBtn, { marginTop: 12 }, busy && s.panelBtnOff]} onPress={handleEnd} disabled={busy}>
                    <Text style={s.panelBtnText}>End Fast</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {tab === 'history' && (
            <View style={{ marginTop: 14 }}>
              {historyState === 'loading' || historyState === 'idle' ? (
                <Text testID="fasting-history-loading" style={s.mutedText}>Loading your fasts…</Text>
              ) : historyState === 'error' ? (
                <View>
                  <Text testID="fasting-history-error" style={s.mutedText}>Could not load your fasts.</Text>
                  <TouchableOpacity testID="fasting-history-retry" style={[s.smallBtn, { marginTop: 8, alignSelf: 'flex-start' }]} onPress={loadHistory}>
                    <Text style={s.smallBtnText}>Try again</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <View style={s.statRow}>
                    <View style={s.statTile}>
                      <Text testID="fasting-streak" style={s.tileValue}>{streak.current}</Text>
                      <Text style={s.tileLabel}>day streak</Text>
                    </View>
                    <View style={s.statTile}>
                      <Text testID="fasting-best-streak" style={s.tileValue}>{streak.best}</Text>
                      <Text style={s.tileLabel}>best streak</Text>
                    </View>
                    <View style={s.statTile}>
                      <Text testID="fasting-total" style={s.tileValue}>{history.length}</Text>
                      <Text style={s.tileLabel}>fasts</Text>
                    </View>
                  </View>
                  {streak.current > 0 && !streak.todayDone && (
                    <Text testID="fasting-streak-hint" style={s.mutedText}>Finish a fast today to keep your streak going.</Text>
                  )}

                  {history.length === 0 ? (
                    <Text testID="fasting-history-empty" style={[s.mutedText, { marginTop: 10 }]}>
                      No fasts yet. When you end a fast it is saved here.
                    </Text>
                  ) : (
                    <View style={{ marginTop: 8 }}>
                      {history.slice(0, shown).map((f) => (
                        <View key={f.id} testID={`fasting-row-${f.id}`} style={s.historyRow}>
                          <Ionicons
                            name={metGoal(f) ? 'checkmark-circle' : 'ellipse-outline'}
                            size={20}
                            color={metGoal(f) ? '#000' : '#B5B5B5'}
                          />
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={s.historyMain}>
                              {`${formatDayLabel(f.endedAt, now)} · ${formatDuration(f.endedAt - f.startedAt)}`}
                            </Text>
                            <Text style={s.historySub}>
                              {`${fastLabel(f.targetHours, f.plan)} goal · ${formatClock(f.startedAt)} – ${formatClock(f.endedAt)}`}
                            </Text>
                          </View>
                          <TouchableOpacity
                            testID={`fasting-remove-${f.id}`}
                            onPress={() => confirmRemove(f)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="trash-outline" size={18} color="#999" />
                          </TouchableOpacity>
                        </View>
                      ))}
                      {history.length > shown && (
                        <TouchableOpacity testID="fasting-show-more" onPress={() => setShown((n) => n + 10)} style={{ paddingVertical: 8 }}>
                          <Text style={s.linkText}>{`Show more (${history.length - shown} left)`}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {tab === 'charts' && (
            <View style={{ marginTop: 14 }}>
              <Segments options={RANGES} value={range} onChange={setRange} testPrefix="fasting-range" />

              {historyState === 'loading' || historyState === 'idle' ? (
                <Text testID="fasting-charts-loading" style={[s.mutedText, { marginTop: 14 }]}>Loading your fasts…</Text>
              ) : historyState === 'error' ? (
                <View style={{ marginTop: 14 }}>
                  <Text style={s.mutedText}>Could not load your fasts.</Text>
                  <TouchableOpacity testID="fasting-charts-retry" style={[s.smallBtn, { marginTop: 8, alignSelf: 'flex-start' }]} onPress={loadHistory}>
                    <Text style={s.smallBtnText}>Try again</Text>
                  </TouchableOpacity>
                </View>
              ) : range !== 'compare' ? (
                <View style={{ marginTop: 14 }}>
                  <Text style={s.chartTitle}>{RANGE_TITLES[range]}</Text>
                  {series.empty ? (
                    <Text testID="fasting-chart-empty" style={s.mutedText}>No fasts in this time yet.</Text>
                  ) : (
                    <View>
                      <FastingBarChart bars={series.bars} max={series.max} ticks={series.ticks} width={PANEL_W} height={120} />
                      <View style={s.legendRow}>
                        <View style={[s.legendDot, { backgroundColor: '#000' }]} />
                        <Text style={s.legendText}>Goal reached</Text>
                        <View style={[s.legendDot, { backgroundColor: '#B5B5B5', marginLeft: 14 }]} />
                        <Text style={s.legendText}>Ended early</Text>
                      </View>
                      <View style={s.statRow}>
                        <View style={s.statTile}>
                          <Text testID="fasting-sum-fasts" style={s.tileValue}>{series.summary.fasts}</Text>
                          <Text style={s.tileLabel}>fasts</Text>
                        </View>
                        <View style={s.statTile}>
                          <Text testID="fasting-sum-avg" style={s.tileValue}>{formatHours(series.summary.avgHours)}</Text>
                          <Text style={s.tileLabel}>average</Text>
                        </View>
                        <View style={s.statTile}>
                          <Text testID="fasting-sum-met" style={s.tileValue}>{`${series.summary.goalsMet}/${series.summary.fasts}`}</Text>
                          <Text style={s.tileLabel}>goals met</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                <View style={{ marginTop: 12 }}>
                  <Segments options={COMPARES} value={compare} onChange={setCompare} testPrefix="fasting-compare" small />
                  <CompareChart
                    kind={compare}
                    history={history}
                    weightLogs={weightLogs}
                    meals={meals}
                    now={today}
                    pounds={weightUnits !== 'metric'}
                  />
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// "Do longer fasts go with this?" for weight (per week) or calories (per day).
function CompareChart({ kind, history, weightLogs, meals, now, pounds }) {
  const data = useMemo(() => {
    if (kind === 'weight') {
      const raw = weightCorrelation(history, weightLogs);
      const factor = pounds ? KG_TO_LB : 1;
      const points = raw.points.map((p) => ({ ...p, y: Math.round(p.y * factor * 100) / 100 }));
      return { points, fit: linearFit(points) };
    }
    return calorieCorrelation(history, meals, { now });
  }, [kind, history, weightLogs, meals, now, pounds]);

  const unit = kind === 'weight' ? (pounds ? 'lb' : 'kg') : 'cal';
  const need = MIN_CORRELATION_POINTS - data.points.length;
  const title = kind === 'weight'
    ? `Weight change per week (${unit}) vs. average fast`
    : 'Calories logged that day vs. longest fast that day';
  const formatY = kind === 'weight'
    ? (v) => `${v > 0.05 ? '+' : v < -0.05 ? '−' : ''}${Math.abs(v).toFixed(1)}`
    : (v) => String(Math.round(v));

  if (need > 0) {
    return (
      <View style={{ marginTop: 12 }}>
        <Text style={s.chartTitle}>{title}</Text>
        <Text testID="fasting-compare-need" style={s.mutedText}>
          {kind === 'weight'
            ? `Not enough yet. Each dot is a week with a logged weight and fasts since the last logged week. You have ${data.points.length} of ${MIN_CORRELATION_POINTS}.`
            : `Not enough yet. Each dot is a day with a fast that ended and food logged. You have ${data.points.length} of ${MIN_CORRELATION_POINTS}.`}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 12 }}>
      <Text style={s.chartTitle}>{title}</Text>
      <FastingScatterChart points={data.points} fit={data.fit} width={PANEL_W} height={150} formatY={formatY} />
      <Text testID="fasting-compare-sentence" style={s.compareSentence}>{correlationSentence(kind, data.fit)}</Text>
      <Text testID="fasting-compare-r" style={s.mutedText}>
        {`${formatR(data.fit.r) || 'r = n/a'} · a pattern in your numbers, not proof of what causes it.`}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
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
      android: { elevation: 2 },
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
  statLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  statValue: { fontSize: 28, fontWeight: '800', color: '#000' },
  statUnit: { fontSize: 12, color: '#999', marginTop: 2 },
  insightPanel: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    padding: 16,
    paddingBottom: 20,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'visible',
  },
  insightTitle: { fontSize: 14, fontWeight: '800', color: '#000000', marginBottom: 8 },
  detailStatText: { fontSize: 12, color: '#444' },
  panelBtn: {
    backgroundColor: '#000000',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  panelBtnOff: { opacity: 0.35 },
  panelBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  segments: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: 10, padding: 3 },
  segment: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: '#000000' },
  segmentText: { fontSize: 12, fontWeight: '600', color: '#555' },
  segmentTextActive: { color: '#FFFFFF' },
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  targetPill: { width: PILL_W, paddingVertical: 9, borderRadius: 8, backgroundColor: '#F5F5F5', alignItems: 'center' },
  targetPillActive: { backgroundColor: '#000000' },
  targetPillText: { fontSize: 12, fontWeight: '600', color: '#333333' },
  targetPillTextActive: { color: '#FFFFFF' },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  stepBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D5D5D5', alignItems: 'center' },
  customValue: { flex: 1.4, textAlign: 'center', fontSize: 16, fontWeight: '800', color: '#000' },
  planSummary: { fontSize: 12, color: '#444' },
  longNote: { fontSize: 11, color: '#777', marginTop: 4 },
  resultText: { marginTop: 12, fontSize: 12, fontWeight: '700', color: '#000' },
  resultTextMuted: { fontWeight: '500', color: '#777' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#E5E5E5', marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#000' },
  statusText: { fontSize: 13, fontWeight: '800', color: '#000', marginTop: 8, marginBottom: 2 },
  startRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  linkText: { fontSize: 12, fontWeight: '700', color: '#000', textDecorationLine: 'underline' },
  editor: { marginTop: 8, padding: 12, borderRadius: 10, backgroundColor: '#F7F7F7' },
  editorLabel: { fontSize: 11, color: '#777' },
  editorValue: { fontSize: 15, fontWeight: '800', color: '#000', marginBottom: 10 },
  nudgeRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  nudgeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D5D5D5', alignItems: 'center' },
  nudgeBtnOff: { opacity: 0.35 },
  nudgeText: { fontSize: 12, fontWeight: '700', color: '#000' },
  smallBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: '#000', alignItems: 'center', paddingHorizontal: 12 },
  smallBtnGhost: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D5D5D5' },
  smallBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  alertNote: { marginTop: 10, fontSize: 11, color: '#777', textDecorationLine: 'underline' },
  mutedText: { fontSize: 12, color: '#777', lineHeight: 17 },
  statRow: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 6 },
  statTile: { flex: 1, backgroundColor: '#F7F7F7', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  tileValue: { fontSize: 18, fontWeight: '800', color: '#000' },
  tileLabel: { fontSize: 11, color: '#777', marginTop: 2 },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAEAEA' },
  historyMain: { fontSize: 13, fontWeight: '700', color: '#000' },
  historySub: { fontSize: 11, color: '#777', marginTop: 1 },
  chartTitle: { fontSize: 12, fontWeight: '700', color: '#000', marginBottom: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendText: { fontSize: 11, color: '#777' },
  compareSentence: { fontSize: 13, fontWeight: '700', color: '#000', marginTop: 10, marginBottom: 4 },
});
