// components/TodayBriefCard.jsx
//
// The daily Today brief on the Home screen: a short note from the Coach, written once a day from what it knows about the person
// (services/briefService.js). It is open to every plan, and it is always on the screen for a signed-in person:
//   - today's brief, once the phone has it (at once, when this run of the app has already read or written it);
//   - a skeleton while it is being written for the first time that day;
//   - when today's cannot be written (no connection, the AI gives nothing, the day's allowance is used up), the last brief kept on the phone,
//     marked with its day and with a note that today's is not ready, and a button to try again;
//   - with no brief kept either, a card that says it is not ready and has the same button.
// It never disappears because the AI had nothing to say.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '@/store/userStore';
import { getTodayBrief, getLastBrief, peekTodayBrief } from '@/services/briefService';
import { parseDateKey } from '@/lib/localDate';

export const BRIEF_FOOTNOTE = 'From your Coach, once a day. Training and nutrition guidance, not medical advice.';
export const BRIEF_NOT_READY_TEXT = 'Your Coach has not written today\'s brief yet. It is written from your sleep, recovery, training and what you have logged. Check your connection and try again.';
export const BRIEF_EARLIER_NOTE = 'Today\'s brief is not ready yet. This is the last one your Coach wrote.';

/** "Sun, Oct 25" for a day key like "2026-10-25"; the key as it is when it is not a real day. */
export function briefDayLabel(day) {
  const date = parseDateKey(day);
  return date ? date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : String(day || '');
}

/** `getBrief`, `getEarlier` and `peek` are only there so a test can stand in for the service. */
export default function TodayBriefCard({ getBrief = getTodayBrief, getEarlier = getLastBrief, peek = peekTodayBrief }) {
  const user = useUserStore((s) => s.user);
  const uid = user?.uid;
  // What is shown: today's brief (or null), the last one kept from an earlier day ({ brief, day } or null), and whether a try is on its way.
  const [state, setState] = useState(() => {
    const brief = uid ? peek({ user }) : null;
    return { uid, loading: Boolean(uid) && !brief, brief, earlier: null, trying: false };
  });
  const latest = useRef(0);

  const ask = (retry) => {
    latest.current += 1;
    const mine = latest.current;
    const settle = (patch) => { if (latest.current === mine) setState((s) => ({ ...s, ...patch })); };
    // `getBrief` is a stable import (or a test's stand-in); a brief is written from the person as they are when it is asked for, and a change to
    // their profile later does not ask for another.
    return Promise.resolve()
      .then(() => (retry ? getBrief({ user, retry: true }) : getBrief({ user })))
      .catch(() => null)
      .then(async (brief) => {
        if (brief) {
          settle({ loading: false, trying: false, brief, earlier: null });
          return;
        }
        if (latest.current !== mine) return; // nobody is waiting for this any more
        // No brief for today: the last one kept stands in for it, so the card is still there.
        const earlier = await Promise.resolve().then(() => getEarlier({ user })).catch(() => null);
        const standIn = earlier && earlier.brief ? earlier : null;
        // `brief` is left as it is: one already on the screen (read a moment ago by this run of the app) is never taken down because it could
        // not be read again.
        if (latest.current === mine) setState((s) => ({ ...s, loading: false, trying: false, earlier: standIn }));
      });
  };

  useEffect(() => {
    if (!uid) {
      setState({ uid, loading: false, brief: null, earlier: null, trying: false });
      return undefined;
    }
    // Another person's brief is never shown while this person's is found. For the person the state was made for (the first run) it stands.
    const peeked = peek({ user });
    setState((s) => (s.uid === uid ? s : { uid, loading: !peeked, brief: peeked, earlier: null, trying: false }));
    ask(false);
    // Whatever is on its way for this person is not wanted once they go (or the screen does).
    return () => { latest.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per person
  }, [uid]);

  if (!uid) return null;

  // For the render before the effect has caught up with a different person: nothing of the last person's is shown.
  const view = state.uid === uid ? state : { uid, loading: true, brief: null, earlier: null, trying: false };

  // The button is disabled while a try is on its way, so it cannot be pressed twice.
  const tryAgain = () => {
    setState((s) => ({ ...s, trying: true }));
    ask(true);
  };

  if (view.loading && !view.brief && !view.earlier) {
    return (
      <View testID="today-brief-loading" style={styles.card} accessibilityLabel="Writing your Today brief">
        <View style={styles.headerRow}>
          <Ionicons name="sunny-outline" size={18} color="#000000" />
          <Text style={styles.title}>Today brief</Text>
        </View>
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#000000" />
          <Text style={styles.body}>Writing your brief</Text>
        </View>
      </View>
    );
  }

  const shownBrief = view.brief || (view.earlier && view.earlier.brief);
  if (!shownBrief) {
    return (
      <View testID="today-brief-missing" style={styles.card}>
        <View style={styles.headerRow}>
          <Ionicons name="sunny-outline" size={18} color="#000000" />
          <Text style={styles.title}>Today brief</Text>
        </View>
        <Text testID="today-brief-missing-text" style={styles.body}>{BRIEF_NOT_READY_TEXT}</Text>
        <TryAgain trying={view.trying} onPress={tryAgain} />
      </View>
    );
  }

  const isEarlier = !view.brief;
  return (
    <View testID={isEarlier ? 'today-brief-earlier' : 'today-brief'} style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="sunny-outline" size={18} color="#000000" />
        <Text style={styles.title}>Today brief</Text>
        {isEarlier && (
          <View style={styles.pill}><Text testID="today-brief-day" style={styles.pillText}>{`From ${briefDayLabel(view.earlier.day)}`}</Text></View>
        )}
      </View>
      <Text testID="today-brief-headline" accessibilityRole="header" style={styles.headline}>{shownBrief.headline}</Text>
      <View style={styles.points}>
        {shownBrief.points.map((point, i) => (
          <View key={`${i}-${point}`} style={styles.pointRow}>
            <View style={styles.bullet} />
            <Text testID={`today-brief-point-${i}`} style={styles.point}>{point}</Text>
          </View>
        ))}
      </View>
      {isEarlier && <Text testID="today-brief-earlier-note" style={styles.earlierNote}>{BRIEF_EARLIER_NOTE}</Text>}
      {isEarlier && <TryAgain trying={view.trying} onPress={tryAgain} />}
      <Text testID="today-brief-note" style={styles.footnote}>{BRIEF_FOOTNOTE}</Text>
    </View>
  );
}

function TryAgain({ trying, onPress }) {
  return (
    <Pressable
      testID="today-brief-try-again"
      accessibilityRole="button"
      accessibilityLabel="Try again to write today's brief"
      accessibilityState={{ disabled: trying, busy: trying }}
      disabled={trying}
      style={[styles.button, trying && styles.buttonBusy]}
      onPress={onPress}
    >
      {trying ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Try again</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#F0F0F0' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  title: { flex: 1, fontSize: 14, fontWeight: '700', color: '#000000' },
  pill: { backgroundColor: '#000000', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  body: { fontSize: 13, color: '#666666', lineHeight: 18 },
  button: { alignSelf: 'flex-start', backgroundColor: '#000000', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginTop: 12, minWidth: 96, alignItems: 'center' },
  buttonBusy: { opacity: 0.7 },
  buttonText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headline: { fontSize: 18, fontWeight: '800', color: '#000000', marginBottom: 10 },
  points: { gap: 8 },
  pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#000000', marginTop: 7 },
  point: { flex: 1, fontSize: 14, color: '#000000', lineHeight: 20 },
  earlierNote: { fontSize: 12, color: '#666666', marginTop: 12 },
  footnote: { fontSize: 11, color: '#8A8A8A', marginTop: 12 },
});
