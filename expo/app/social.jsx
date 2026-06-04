import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useExpStore } from '@/store/expStore';
export function ErrorBoundary({ error, retry }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 8 }}>Something went wrong</Text>
      <Text style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>{error?.message}</Text>
      <Pressable onPress={retry} style={{ backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 }}>
        <Text style={{ color: '#fff', fontWeight: '600' }}>Try Again</Text>
      </Pressable>
    </View>
  );
}

const FRIENDS = [
  { name: 'Alex R.', level: 15, xp: 12450, online: true },
  { name: 'Sarah M.', level: 12, xp: 7800, online: true },
  { name: 'Mike T.', level: 10, xp: 5200, online: false },
  { name: 'Jessica L.', level: 8, xp: 3100, online: false },
  { name: 'David K.', level: 14, xp: 11200, online: true },
];

const FEED = [
  { user: 'Alex R.', text: 'completed **HIIT Blast** and earned **+100 XP**', time: '2 hours ago' },
  { user: 'Sarah M.', text: 'achieved a new personal record: **5K in 24:32**', time: '3 hours ago' },
  { user: 'Mike T.', text: 'completed a **7-Day Workout Streak!**', time: '5 hours ago' },
  { user: 'Jessica L.', text: 'started the **Couch to 5K** program', time: 'Yesterday' },
  { user: 'David K.', text: 'reached **Level 14!**', time: 'Yesterday' },
  { user: 'Alex R.', text: 'challenged you to a **10K race**', time: '2 days ago' },
];

const DUELS = [
  { opponent: 'Alex R.', challenge: '10K Race', yourProgress: '4.2km', theirProgress: '6.1km', yourPct: 42, theirPct: 61, daysLeft: 3 },
  { opponent: 'Sarah M.', challenge: 'Most Workouts This Week', yourProgress: '3', theirProgress: '4', yourPct: 43, theirPct: 57, daysLeft: 2 },
];

const COMMUNITIES = [
  { name: 'ZOWN Runners Club', members: 1234, icon: 'fitness-outline' },
  { name: 'Strength Gang', members: 856, icon: 'barbell-outline' },
  { name: 'Meal Prep Masters', members: 2100, icon: 'restaurant-outline' },
];

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function SocialScreen() {
  const { totalExp } = useExpStore();
  const [lbTab, setLbTab] = useState('week');

  const myXp = totalExp || 0;

  const LEADERBOARD = [
    { rank: 1, name: 'Alex R.', xp: 12450, isYou: false },
    { rank: 2, name: 'David K.', xp: 11200, isYou: false },
    { rank: 3, name: 'You', xp: myXp, isYou: true },
    { rank: 4, name: 'Sarah M.', xp: 7800, isYou: false },
    { rank: 5, name: 'Mike T.', xp: 5200, isYou: false },
    { rank: 6, name: 'Jessica L.', xp: 3100, isYou: false },
    { rank: 7, name: 'Chris P.', xp: 2900, isYou: false },
    { rank: 8, name: 'Amanda W.', xp: 2600, isYou: false },
    { rank: 9, name: 'Jordan H.', xp: 2100, isYou: false },
    { rank: 10, name: 'Taylor N.', xp: 1800, isYou: false },
  ];

  const myRank = LEADERBOARD.findIndex(l => l.isYou) + 1;

  const renderBold = (text) => {
    const parts = text.split(/\*\*(.+?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1
        ? <Text key={i} style={{ fontWeight: '700' }}>{part}</Text>
        : <Text key={i}>{part}</Text>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.logoRow}>
          <Image source={require('@/assets/branding/zown-logo-512.png')} style={s.logo} resizeMode="contain" />
        </View>
        <View style={s.headerRow}>
          <Text style={s.pageTitle}>Social</Text>
          <View style={s.headerIcons}>
            <Pressable style={s.iconBtn} onPress={() => { /* TODO: navigate to messages */ }}>
              <Ionicons name="chatbubble-outline" size={18} color="#000" />
              <View style={s.badge}><Text style={s.badgeText}>3</Text></View>
            </Pressable>
            <Pressable style={s.iconBtn} onPress={() => { /* TODO: navigate to add friends / search people */ }}>
              <Ionicons name="person-add-outline" size={18} color="#000" />
            </Pressable>
          </View>
        </View>

        {/* Friends Section */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Friends</Text>
          <Pressable><Text style={s.sectionLink}>Find Friends</Text></Pressable>
        </View>
        {FRIENDS.map((f, i) => (
          <View key={i} style={s.friendRow}>
            <View style={s.avatar}><Ionicons name="person" size={20} color="#999" /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.friendName}>{f.name}</Text>
              <Text style={s.friendLevel}>Level {f.level}</Text>
            </View>
            <Text style={s.friendXp}>{f.xp.toLocaleString()} XP</Text>
            <View style={[s.statusDot, { backgroundColor: f.online ? '#22C55E' : '#CCC' }]} />
          </View>
        ))}

        {/* Activity Feed */}
        <View style={[s.sectionHeader, { marginTop: 24 }]}>
          <Text style={s.sectionTitle}>Activity Feed</Text>
        </View>
        {FEED.map((item, i) => (
          <View key={i} style={s.feedItem}>
            <View style={s.feedAvatarSmall}><Ionicons name="person" size={14} color="#999" /></View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.feedText}><Text style={{ fontWeight: '700' }}>{item.user}</Text>{' '}{renderBold(item.text)}</Text>
              <Text style={s.feedTime}>{item.time}</Text>
            </View>
          </View>
        ))}

        {/* Leaderboard */}
        <View style={[s.sectionHeader, { marginTop: 24 }]}>
          <Text style={s.sectionTitle}>Leaderboard</Text>
        </View>
        <View style={s.lbToggle}>
          <Pressable style={[s.lbPill, lbTab === 'week' && s.lbPillActive]} onPress={() => setLbTab('week')}>
            <Text style={[s.lbPillText, lbTab === 'week' && s.lbPillTextActive]}>This Week</Text>
          </Pressable>
          <Pressable style={[s.lbPill, lbTab === 'all' && s.lbPillActive]} onPress={() => setLbTab('all')}>
            <Text style={[s.lbPillText, lbTab === 'all' && s.lbPillTextActive]}>All Time</Text>
          </Pressable>
        </View>
        <View style={s.lbRankSummary}>
          <Text style={s.lbRankText}>Your Rank: #{myRank}</Text>
        </View>
        {LEADERBOARD.map((entry) => (
          <View key={entry.rank} style={[s.lbRow, entry.isYou && s.lbRowYou]}>
            <Text style={s.lbRankNum}>{entry.rank}</Text>
            {entry.rank <= 3 ? (
              <Ionicons name="medal-outline" size={18} color={MEDAL_COLORS[entry.rank - 1]} style={{ marginRight: 8 }} />
            ) : (
              <View style={{ width: 26 }} />
            )}
            <View style={s.lbAvatar}><Ionicons name="person" size={14} color="#999" /></View>
            <Text style={[s.lbName, entry.isYou && { fontWeight: '800' }]}>{entry.name}</Text>
            <Text style={s.lbXp}>{entry.xp.toLocaleString()} XP</Text>
          </View>
        ))}

        {/* Active Duels */}
        <View style={[s.sectionHeader, { marginTop: 24 }]}>
          <Text style={s.sectionTitle}>Active Duels</Text>
        </View>
        {DUELS.map((d, i) => (
          <View key={i} style={s.duelCard}>
            <Text style={s.duelTitle}>You vs {d.opponent}</Text>
            <Text style={s.duelChallenge}>{d.challenge}</Text>
            <View style={s.duelBarsRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={s.duelLabel}>You: {d.yourProgress}</Text>
                <View style={s.duelBarBg}><View style={[s.duelBarFill, { width: d.yourPct + '%', backgroundColor: '#000' }]} /></View>
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[s.duelLabel, { textAlign: 'right' }]}>{d.opponent}: {d.theirProgress}</Text>
                <View style={s.duelBarBg}><View style={[s.duelBarFill, { width: d.theirPct + '%', backgroundColor: '#999' }]} /></View>
              </View>
            </View>
            <Text style={s.duelDays}>{d.daysLeft} days left</Text>
          </View>
        ))}
        <Pressable style={s.challengeBtn}>
          <Text style={s.challengeBtnText}>Challenge a Friend</Text>
        </Pressable>

        {/* Community */}
        <View style={[s.sectionHeader, { marginTop: 24 }]}>
          <Text style={s.sectionTitle}>Community</Text>
          <Pressable><Text style={s.sectionLink}>View All</Text></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 6, marginBottom: 20 }}>
          {COMMUNITIES.map((c, i) => (
            <View key={i} style={s.communityCard}>
              <Ionicons name={c.icon} size={28} color="#000" style={{ marginBottom: 8 }} />
              <Text style={s.communityName}>{c.name}</Text>
              <Text style={s.communityMembers}>{c.members.toLocaleString()} members</Text>
            </View>
          ))}
        </ScrollView>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  logoRow: { alignItems: 'center', marginTop: 8, marginBottom: 12 },
  logo: { width: 120, height: 36 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#000' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  sectionLink: { fontSize: 14, fontWeight: '600', color: '#000' },

  /* Friends */
  friendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  friendName: { fontSize: 15, fontWeight: '600', color: '#000' },
  friendLevel: { fontSize: 12, color: '#999', marginTop: 1 },
  friendXp: { fontSize: 13, fontWeight: '700', color: '#000', marginRight: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  /* Feed */
  feedItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  feedAvatarSmall: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  feedText: { fontSize: 14, color: '#333', lineHeight: 20 },
  feedTime: { fontSize: 11, color: '#999', marginTop: 4 },

  /* Leaderboard */
  lbToggle: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 12 },
  lbPill: { flex: 1, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F0F0F0', alignItems: 'center' },
  lbPillActive: { backgroundColor: '#000' },
  lbPillText: { fontSize: 13, fontWeight: '700', color: '#333' },
  lbPillTextActive: { color: '#FFF' },
  lbRankSummary: { paddingHorizontal: 20, marginBottom: 10 },
  lbRankText: { fontSize: 15, fontWeight: '700', color: '#000' },
  lbRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20 },
  lbRowYou: { backgroundColor: '#F5F5F5', borderRadius: 12, marginHorizontal: 12, paddingHorizontal: 16 },
  lbRankNum: { fontSize: 14, fontWeight: '700', color: '#000', width: 24 },
  lbAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  lbName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#000' },
  lbXp: { fontSize: 13, fontWeight: '700', color: '#000' },

  /* Duels */
  duelCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginHorizontal: 20, marginBottom: 12, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 3 }, default: {} }) },
  duelTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 2 },
  duelChallenge: { fontSize: 13, color: '#666', marginBottom: 12 },
  duelBarsRow: { flexDirection: 'row', marginBottom: 8 },
  duelLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  duelBarBg: { height: 6, borderRadius: 3, backgroundColor: '#E5E5E5', overflow: 'hidden' },
  duelBarFill: { height: 6, borderRadius: 3 },
  duelDays: { fontSize: 12, color: '#999', textAlign: 'center' },
  challengeBtn: { backgroundColor: '#000', height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginHorizontal: 20, marginBottom: 12 },
  challengeBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  /* Community */
  communityCard: { width: 160, backgroundColor: '#F5F5F5', borderRadius: 14, padding: 14, alignItems: 'center', marginRight: 12 },
  communityName: { fontSize: 13, fontWeight: '700', color: '#000', textAlign: 'center', marginBottom: 4 },
  communityMembers: { fontSize: 12, color: '#666' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 },
  headerIcons: { flexDirection: 'row', gap: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  badge: { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
});
