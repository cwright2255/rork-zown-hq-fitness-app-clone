import React, { useEffect, useMemo, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import HomeWidgetCard from './HomeWidgetCard';
import { useScheduleStore } from '@/store/scheduleStore';
import { useCalendarInviteStore } from '@/store/calendarInviteStore';
import { nextUpSummary } from '@/lib/homeWidgetData';
import { incomingInvites, waitingText } from '@/lib/calendarInvites';

const TICK_MS = 60 * 1000;

// Home > Next Up: the next workout or event on the calendar, with its time. Whatever the AI coach adds to the calendar shows up
// here too. A tap opens the Calendar on that day (or on today when nothing is planned). When calendar invitations from friends are
// waiting for an answer, it says how many, so they are not missed (they are answered on the Calendar).
export default function NextUpWidget() {
  const events = useScheduleStore((s) => s.events);
  const invites = useCalendarInviteStore((s) => s.invites);
  const inviteUid = useCalendarInviteStore((s) => s.uid);
  // "Next" moves on as the clock does, also when the app stays open on this screen.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  const next = useMemo(() => nextUpSummary(events, now), [events, now]);
  const waiting = useMemo(() => waitingText(incomingInvites(invites, inviteUid, now).length), [invites, inviteUid, now]);

  return (
    <HomeWidgetCard
      testID="home-widget-nextup"
      label="Next Up"
      icon="calendar-outline"
      caption={next ? next.when : 'Open the calendar'}
      accessibilityLabel={`${next ? `Next up: ${next.title}, ${next.when}.` : 'Next up: nothing planned.'}${waiting ? ` ${waiting}.` : ''} Opens the calendar.`}
      onPress={() => (next ? router.push({ pathname: '/calendar', params: { date: next.date } }) : router.push('/calendar'))}
    >
      <Text style={s.title} numberOfLines={2} testID="home-nextup-title">{next ? next.title : 'Nothing planned'}</Text>
      {waiting ? <Text style={s.waiting} testID="home-nextup-invites">{waiting}</Text> : null}
    </HomeWidgetCard>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '800', color: '#000' },
  waiting: { fontSize: 12, fontWeight: '700', color: '#C62828', marginTop: 4 },
});
