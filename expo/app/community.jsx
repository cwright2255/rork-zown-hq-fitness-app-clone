import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Heart, MessageCircle } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import BottomNavigation from '@/components/BottomNavigation';
import { tokens } from '../../theme/tokens';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const FEED = [
  { id: '1', name: 'Jordan L.', initials: 'JL', time: '2h', text: 'Just crushed leg day â new PR on squats!' },
  { id: '2', name: 'Sam R.', initials: 'SR', time: '5h', text: 'Morning 5k in under 22 min. Feeling unstoppable.' },
  { id: '3', name: 'Alex T.', initials: 'AT', time: '1d', text: 'Protein smoothie recipe â drop yours below.' },
];

const CHALLENGES = [
  { id: 'c1', name: '30-Day Cardio', participants: 412, daysLeft: 12 },
  { id: 'c2', name: 'Strength PR Month', participants: 206, daysLeft: 21 },
  { id: 'c3', name: 'Summer Shred', participants: 894, daysLeft: 34 },
];

export default function CommunityScreen() {
  const [tab, setTab] = useState('feed');

  return (
    <View style={styles.container}>
      <ScreenHeader title="Community" />

      <View style={styles.tabs}>
        {['feed', 'challenges'].map(t => {
          const active = tab === t;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, active ? styles.tabActive : styles.tabInactive]}>
              <Text style={[styles.tabText, { color: active ? '#000' : '#999' }]}>
                {t === 'feed' ? 'Feed' : 'Challenges'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {tab === 'feed' ? (
          FEED.map(post => (
            <View key={post.id} style={styles.card}>
              <View style={styles.postHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{post.initials}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.postName}>{post.name}</Text>
                  <Text style={styles.postTime}>{post.time} ago</Text>
                </View>
              </View>
              <Text style={styles.postText}>{post.text}</Text>
              <View style={styles.postActions}>
                <TouchableOpacity style={styles.action}>
                  <Heart size={18} color="#999" />
                  <Text style={styles.actionText}>Like</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.action}>
                  <MessageCircle size={18} color="#999" />
                  <Text style={styles.actionText}>Comment</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          CHALLENGES.map(c => (
            <View key={c.id} style={styles.card}>
              <View style={styles.challengeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.challengeName}>{c.name}</Text>
                  <Text style={styles.challengeMeta}>{c.participants} participants</Text>
                </View>
                <View style={styles.daysBadge}>
                  <Text style={styles.daysText}>{c.daysLeft}d left</Text>
                </View>
              </View>
              <View style={{ marginTop: 12 }}>
                <PrimaryButton title="Join" variant="outline" style={{ height: 36 }} onPress={() => {}} />
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.grayscale.black },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  tab: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999 },
  tabActive: { backgroundColor: tokens.colors.background.default },
  tabInactive: { backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A' },
  tabText: { fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 16, marginBottom: 12,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: tokens.colors.background.default, fontWeight: '700', fontSize: 13 },
  postName: { color: tokens.colors.background.default, fontSize: 14, fontWeight: '600' },
  postTime: { color: '#666', fontSize: 12 },
  postText: { color: tokens.colors.background.default, fontSize: 14, lineHeight: 20, marginTop: 10 },
  postActions: {
    flexDirection: 'row', gap: 20,
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#2A2A2A',
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: '#999', fontSize: 13 },
  challengeRow: { flexDirection: 'row', alignItems: 'center' },
  challengeName: { color: tokens.colors.background.default, fontSize: 16, fontWeight: '600' },
  challengeMeta: { color: '#999', fontSize: 13, marginTop: 2 },
  daysBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  daysText: { color: '#22C55E', fontSize: 12, fontWeight: '600' },
});
