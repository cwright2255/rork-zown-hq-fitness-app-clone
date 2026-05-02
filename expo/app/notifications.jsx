import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Bell, Trophy, Droplets, Users } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';
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
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Bell size={40} color="#2A2A2A" />
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
                  <Icon size={18} color=tokens.colors.background.default />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.grayscale.black },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 14, marginBottom: 8,
  },
  rowUnread: { borderLeftWidth: 3, borderLeftColor: tokens.colors.background.default },
  icon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: tokens.colors.background.default, fontSize: 14, fontWeight: '600' },
  body: { color: '#999', fontSize: 13, lineHeight: 18, marginTop: 2 },
  time: { color: '#666', fontSize: 11, marginTop: 4 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: tokens.colors.background.default, marginTop: 6,
  },
  emptyCard: {
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 40, alignItems: 'center', gap: 10,
  },
  empty: { color: '#999', fontSize: 14 },
});
