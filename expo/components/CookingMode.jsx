import React from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { findStepTimers, formatClock } from '@/lib/stepTimers';
import { keepScreenOn } from '@/services/keepAwake';
import { scheduleTimerAlert, cancelTimerAlert } from '@/services/cookTimerAlert';

// Cooking mode: one step at a time in large type, the screen kept awake, the
// ingredients one tap away, and a timer for any waiting time written in the step.
// Timers are kept by the clock time they end at, so they stay right when the app
// is in the background, and (if notifications are allowed) a notification rings
// when one ends. They stop when cooking mode is closed.
//
// steps and ingredients are lists of text (see lib/cookingSteps.js).

export default function CookingMode({ title, steps = [], ingredients = [], onClose }) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = React.useState(0);
  const [showIngredients, setShowIngredients] = React.useState(false);
  // key "step-n" -> { step, endAt, status: 'running' | 'done' }
  const [timers, setTimers] = React.useState({});
  const [now, setNow] = React.useState(() => Date.now());
  // key -> the promise of the scheduled notification's id
  const alerts = React.useRef({});

  React.useEffect(() => keepScreenOn('cooking'), []);

  const cancelAlert = (key) => {
    const pending = alerts.current[key];
    delete alerts.current[key];
    if (pending) pending.then(cancelTimerAlert);
  };

  React.useEffect(() => () => {
    Object.keys(alerts.current).forEach(cancelAlert);
  }, []);

  const running = Object.values(timers).some((t) => t.status === 'running');
  React.useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  React.useEffect(() => {
    const ended = Object.keys(timers).filter((k) => timers[k].status === 'running' && now >= timers[k].endAt);
    if (!ended.length) return;
    setTimers((prev) => {
      const next = { ...prev };
      ended.forEach((k) => { next[k] = { ...next[k], status: 'done' }; });
      return next;
    });
    try {
      Promise.resolve(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)).catch(() => {});
    } catch (e) {
      // No buzz on this phone; the screen still says the time is up.
    }
  }, [now, timers]);

  const stepCount = steps.length;
  const lastStep = index === stepCount - 1;
  const text = steps[index];
  const found = findStepTimers(text);

  const goBack = () => {
    setShowIngredients(false);
    setIndex((i) => Math.max(0, i - 1));
  };
  const goNext = () => {
    if (lastStep) {
      onClose?.();
      return;
    }
    setShowIngredients(false);
    setIndex((i) => i + 1);
  };

  const startTimer = (n, seconds) => {
    const key = `${index}-${n}`;
    const startedAt = Date.now();
    setNow(startedAt);
    setTimers((prev) => ({ ...prev, [key]: { step: index, endAt: startedAt + seconds * 1000, status: 'running' } }));
    alerts.current[key] = scheduleTimerAlert(seconds, { title: 'Timer done', body: `${title || 'Recipe'}, step ${index + 1}` });
  };
  const clearTimer = (key) => {
    cancelAlert(key);
    setTimers((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const elsewhere = Object.keys(timers).filter((k) => timers[k].step !== index);

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View
        testID="cook-container"
        style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.topBar}>
          <TouchableOpacity testID="cook-close" accessibilityRole="button" accessibilityLabel="Close cooking mode" onPress={onClose} style={styles.topButton}>
            <Text style={styles.topButtonText}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {stepCount > 0 ? (
            <TouchableOpacity
              testID="cook-ingredients-toggle"
              accessibilityRole="button"
              onPress={() => setShowIngredients((v) => !v)}
              style={styles.topButton}>
              <Text style={styles.topButtonText}>{showIngredients ? 'Steps' : 'Ingredients'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.topButton} />
          )}
        </View>

        {stepCount === 0 ? (
          <View style={styles.center}>
            <Text testID="cook-empty" style={styles.empty}>This recipe has no steps saved.</Text>
          </View>
        ) : (
          <>
            <Text testID="cook-step-count" style={styles.count}>{`Step ${index + 1} of ${stepCount}`}</Text>
            <View style={styles.track}>
              <View testID="cook-progress" style={[styles.fill, { width: `${((index + 1) / stepCount) * 100}%` }]} />
            </View>

            {elsewhere.length > 0 && (
              <ScrollView testID="cook-timer-chips" horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipsContent}>
                {elsewhere.map((k) => {
                  const t = timers[k];
                  return (
                    <TouchableOpacity
                      key={k}
                      testID={`cook-timer-chip-${k}`}
                      accessibilityRole="button"
                      style={[styles.chip, t.status === 'done' && styles.chipDone]}
                      onPress={() => { setShowIngredients(false); setIndex(t.step); }}>
                      <Text style={[styles.chipText, t.status === 'done' && styles.chipTextDone]}>
                        {`Step ${t.step + 1}: ${t.status === 'done' ? 'time is up' : formatClock((t.endAt - now) / 1000)}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              {showIngredients ? (
                <View testID="cook-ingredients-list">
                  {ingredients.map((line, i) => (
                    <Text key={i} style={styles.ingredient}>{line}</Text>
                  ))}
                </View>
              ) : (
                <>
                  <Text testID="cook-step-text" style={styles.stepText}>{text}</Text>
                  {found.map((f, n) => {
                    const key = `${index}-${n}`;
                    const t = timers[key];
                    if (!t) {
                      return (
                        <TouchableOpacity
                          key={key}
                          testID={`cook-timer-start-${n}`}
                          accessibilityRole="button"
                          style={styles.timerButton}
                          onPress={() => startTimer(n, f.seconds)}>
                          <Text style={styles.timerButtonText}>{`Start ${f.label} timer`}</Text>
                        </TouchableOpacity>
                      );
                    }
                    return (
                      <View key={key} style={styles.timerRow}>
                        {t.status === 'done' ? (
                          <Text testID={`cook-timer-done-${n}`} style={styles.timerDone}>Time is up</Text>
                        ) : (
                          <Text testID={`cook-timer-clock-${n}`} style={styles.timerClock}>{formatClock((t.endAt - now) / 1000)}</Text>
                        )}
                        <TouchableOpacity
                          testID={`cook-timer-stop-${n}`}
                          accessibilityRole="button"
                          style={styles.timerStop}
                          onPress={() => clearTimer(key)}>
                          <Text style={styles.timerStopText}>{t.status === 'done' ? 'Dismiss' : 'Stop'}</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </>
              )}
            </ScrollView>

            <View style={styles.nav}>
              <TouchableOpacity
                testID="cook-prev"
                accessibilityRole="button"
                disabled={index === 0}
                style={[styles.navButton, styles.navBack, index === 0 && styles.navDisabled]}
                onPress={goBack}>
                <Text style={styles.navBackText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="cook-next" accessibilityRole="button" style={[styles.navButton, styles.navNext]} onPress={goNext}>
                <Text style={styles.navNextText}>{lastStep ? 'Done' : 'Next'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 20 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  topButton: { minWidth: 92, paddingVertical: 10 },
  topButtonText: { fontSize: 16, fontWeight: '600', color: '#000000' },
  title: { flex: 1, textAlign: 'center', fontSize: 15, color: '#666666' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 18, color: '#666666', textAlign: 'center' },
  count: { marginTop: 18, fontSize: 14, fontWeight: '600', color: '#666666' },
  track: { height: 4, borderRadius: 2, backgroundColor: '#EEEEEE', marginTop: 8, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: '#000000' },
  chips: { flexGrow: 0, marginTop: 12 },
  chipsContent: { gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: '#000000' },
  chipDone: { backgroundColor: '#000000' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#000000' },
  chipTextDone: { color: '#FFFFFF' },
  body: { flex: 1, marginTop: 12 },
  bodyContent: { paddingVertical: 16 },
  stepText: { fontSize: 28, lineHeight: 40, color: '#000000', fontWeight: '500' },
  ingredient: { fontSize: 20, lineHeight: 30, color: '#000000', paddingVertical: 4 },
  timerButton: { marginTop: 24, paddingVertical: 16, borderRadius: 999, borderWidth: 1, borderColor: '#000000', alignItems: 'center' },
  timerButtonText: { fontSize: 18, fontWeight: '600', color: '#000000' },
  timerRow: { marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timerClock: { fontSize: 48, fontWeight: '700', color: '#000000', fontVariant: ['tabular-nums'] },
  timerDone: { fontSize: 32, fontWeight: '700', color: '#000000' },
  timerStop: { paddingVertical: 12, paddingHorizontal: 22, borderRadius: 999, borderWidth: 1, borderColor: '#000000' },
  timerStopText: { fontSize: 16, fontWeight: '600', color: '#000000' },
  nav: { flexDirection: 'row', gap: 12 },
  navButton: { flex: 1, paddingVertical: 18, borderRadius: 999, alignItems: 'center' },
  navBack: { borderWidth: 1, borderColor: '#000000', backgroundColor: '#FFFFFF' },
  navBackText: { fontSize: 18, fontWeight: '700', color: '#000000' },
  navDisabled: { opacity: 0.3 },
  navNext: { backgroundColor: '#000000' },
  navNextText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
});
