import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Bell, Trophy, Droplets, Users } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import { tokens } from '../../theme/tokens';



const MOCK = [
  { id: '1', icon: Trophy, title: 'Badge Earned', body: 'You unlocked the 7-Day Streak badge.', time: '2h ago', unread: true },
  { id: '2', icon: Users, title: 'New Follower', body: 'Sarah started following you.', time: '5h ago', unread: true },
  { id: '3', icon: Droplets, title: 'Hydration Reminder', body: 'Time for a glass of water.', time: 'Yesterday', unread: false },
  { id: '4', icon: Bell, title: 'Workout Reminder', body: "Don't forget today's push session.", time: '2 days ago', unread: false },
];

export default function NotificationsScreen() {
  const [items, setItems] = useState(MOCK);

  const handleMark = (id) => {
    setItems(items.map(n => n.id === id ? { ...n, unread: false } : n));
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Notifications" showBack />
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40 }}>
        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Bell size={40} color="#CCCCCC" />
            <Text style={styles.empty}>No notifications yet</Text>
          </View>
        ) : (
          items.map(n => {
            const Icon = n.icon || Bell;
            return (
              <TouchableOpacity
                key={n.id}
                onPress={() => handleMark(n.id)}
                style={[styles.row, n.unread && styles.rowUnread]}>
                <View style={styles.icon}>
                  <Icon size={18} color="#000000" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{n.title}</Text>
                  <Text style={styles.body} numberOfLines={2}>{n.body}</Text>
                  <Text style={styles.time}>{n.time}</Text>
                </View>
                {n.unread ? <View style={styles.dot} /> : null}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// Real fix: same dark_navy misused-token bug as the other files already
// fixed this pass. rowUnread's left-border and dot's background both
// correctly used a background token as a background/border (not the
// misused-token bug itself), but still the wrong color family - now
// black, same "black for active/highlight state" convention already
// used in app/wellbeing.jsx and app/champion-pass.jsx. time used
// text_secondary specifically (a lighter gray-blue than text_muted,
// #B8C0D4) - kept as the lightest of the three text shades here (#999)
// to preserve that same relative emphasis.
const cardShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
  default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spacing.md,
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.lg, padding: 14, marginBottom: tokens.spacing.sm,
  },
  rowUnread: { borderLeftWidth: 3, borderLeftColor: '#000000' },
  icon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#000000', fontSize: 14, fontWeight: '600' },
  body: { color: '#666666', fontSize: 13, lineHeight: 18, marginTop: 2 },
  time: { color: '#999999', fontSize: 11, marginTop: 4 },
  dot: {
    width: 8, height: 8, borderRadius: tokens.radius.xs,
    backgroundColor: '#000000', marginTop: 6,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.lg, padding: 40, alignItems: 'center', gap: 10,
  },
  empty: { color: '#666666', fontSize: 14 },
});
