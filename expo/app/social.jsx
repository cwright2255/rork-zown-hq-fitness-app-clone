import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useExpStore } from '@/store/expStore';
import { useUserStore } from '@/store/userStore';

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

const STORY_FRIENDS = [
  { name: 'Alex', hasStory: true },
  { name: 'Sarah', hasStory: true },
  { name: 'Mike', hasStory: false },
  { name: 'Jessica', hasStory: false },
  { name: 'David', hasStory: false },
  { name: 'Emma', hasStory: false },
];

const FEED_POSTS = [
  {
    id: '1', user: 'Alex R.', time: '2 min ago',
    text: 'Just crushed my morning HIIT session! \u{1F4AA} Feeling amazing.',
    workout: { name: 'HIIT Blast', duration: '30 min', calories: '320' },
    likes: 45, comments: 12,
  },
  {
    id: '2', user: 'Sarah M.', time: '15 min ago',
    text: 'New personal record on my 5K! 24:32 \u{1F3C3}\u{200D}\u{2640}\u{FE0F}',
    hasMap: true,
    likes: 89, comments: 23,
  },
  {
    id: '3', user: 'You', time: '1 hour ago',
    text: 'Started the Couch to 5K program today. Day 1 done! \u{1F389}',
    workout: { name: 'C25K Week 1', duration: '20 min', calories: '180' },
    likes: 34, comments: 8,
  },
  {
    id: '4', user: 'Mike T.', time: '3 hours ago',
    text: 'Join me in this challenge, it\u{2019}s very interesting. Join now \u{1F4AA}',
    hasImage: true,
    likes: 121, comments: 34,
  },
  {
    id: '5', user: 'Jessica L.', time: 'Yesterday',
    text: 'Meal prep Sunday! Prepped 5 days of chicken and rice bowls.',
    hasImage: true,
    likes: 67, comments: 15,
  },
];

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

const DUELS = [
  { opponent: 'Alex R.', challenge: '10K Race', yours: '4.2km', theirs: '6.1km', yourPct: 42, theirPct: 61, days: 3 },
  { opponent: 'Sarah M.', challenge: 'Most Workouts This Week', yours: '3', theirs: '4', yourPct: 43, theirPct: 57, days: 2 },
];

const COMMUNITIES = [
  { name: 'ZOWN Runners Club', members: 1234, icon: 'fitness-outline' },
  { name: 'Strength Gang', members: 856, icon: 'barbell-outline' },
  { name: 'Meal Prep Masters', members: 2100, icon: 'restaurant-outline' },
];

export default function SocialScreen() {
  const { totalExp } = useExpStore();
  const { user } = useUserStore();
  const [activeTab, setActiveTab] = useState('Feed');
  const [lbTab, setLbTab] = useState('week');

  const displayName = user?.name || user?.email?.split('@')[0] || 'there';
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
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
  const TABS = ['Feed', 'Leaderboard', 'Duels', 'Community'];

  const renderFeed = () => FEED_POSTS.map(post => (
    <View key={post.id} style={s.postCard}>
      <View style={s.postHeader}>
        <View style={s.postAvatar}><Ionicons name="person" size={20} color="#999" /></View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.postUser}>{post.user}</Text>
          <Text style={s.postTime}>{post.time}</Text>
        </View>
        <Ionicons name="ellipsis-horizontal" size={18} color="#999" />
      </View>
      <Text style={s.postText}>{post.text}</Text>
      {post.hasImage && (
        <View style={s.postImage}>
          <Ionicons name="image-outline" size={40} color="#CCC" />
        </View>
      )}
      {post.workout && (
        <View style={s.workoutCard}>
          <View style={s.workoutIcon}><Ionicons name="flash" size={18} color="#FFF" /></View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#000' }}>{post.workout.name}</Text>
            <Text style={{ fontSize: 12, color: '#999' }}>{post.workout.duration}</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#000' }}>{post.workout.calories} Kcal</Text>
        </View>
      )}
      {post.hasMap && (
        <View style={s.mapCard}>
          <Ionicons name="map-outline" size={32} color="#999" />
          <Text style={{ fontSize: 12, color: '#999', marginTop: 6 }}>5K Route</Text>
        </View>
      )}
      <View style={s.postFooter}>
        <View style={s.postAction}><Ionicons name="heart-outline" size={20} color="#666" /><Text style={s.postActionText}>{post.likes}</Text></View>
        <View style={s.postAction}><Ionicons name="chatbubble-outline" size={18} color="#666" /><Text style={s.postActionText}>{post.comments}</Text></View>
        <Pressable style={[s.postAction, { marginLeft: 'auto' }]}><Ionicons name="share-outline" size={18} color="#666" /><Text style={s.postActionText}>Share</Text></Pressable>
      </View>
    </View>
  ));

  const renderLeaderboard = () => (
    <View>
      <View style={s.lbToggle}>
        <Pressable style={[s.lbPill, lbTab === 'week' && s.lbPillActive]} onPress={() => setLbTab('week')}>
          <Text style={[s.lbPillText, lbTab === 'week' && s.lbPillTextActive]}>This Week</Text>
        </Pressable>
        <Pressable style={[s.lbPill, lbTab === 'all' && s.lbPillActive]} onPress={() => setLbTab('all')}>
          <Text style={[s.lbPillText, lbTab === 'all' && s.lbPillTextActive]}>All Time</Text>
        </Pressable>
      </View>
      <View style={s.lbRankSummary}><Text style={s.lbRankLabel}>Your Rank: #{myRank}</Text></View>
      {LEADERBOARD.map(e => (
        <View key={e.rank} style={[s.lbRow, e.isYou && s.lbRowYou]}>
          <Text style={s.lbNum}>{e.rank}</Text>
          {e.rank <= 3 ? <Ionicons name="medal-outline" size={18} color={MEDAL_COLORS[e.rank-1]} style={{marginRight:8}}/> : <View style={{width:26}}/>}
          <View style={s.lbAv}><Ionicons name="person" size={14} color="#999"/></View>
          <Text style={[s.lbName, e.isYou && {fontWeight:'800'}]}>{e.name}</Text>
          <Text style={s.lbXp}>{e.xp.toLocaleString()} XP</Text>
        </View>
      ))}
    </View>
  );

  const renderDuels = () => (
    <View>
      {DUELS.map((d, i) => (
        <View key={i} style={s.duelCard}>
          <Text style={s.duelTitle}>You vs {d.opponent}</Text>
          <Text style={s.duelSub}>{d.challenge}</Text>
          <View style={s.duelBars}>
            <View style={{flex:1,marginRight:8}}>
              <Text style={s.duelLbl}>You: {d.yours}</Text>
              <View style={s.barBg}><View style={[s.barFill,{width:d.yourPct+'%',backgroundColor:'#000'}]}/></View>
            </View>
            <View style={{flex:1,marginLeft:8}}>
              <Text style={[s.duelLbl,{textAlign:'right'}]}>{d.opponent}: {d.theirs}</Text>
              <View style={s.barBg}><View style={[s.barFill,{width:d.theirPct+'%',backgroundColor:'#999'}]}/></View>
            </View>
          </View>
          <Text style={s.duelDays}>{d.days} days left</Text>
        </View>
      ))}
      <Pressable style={s.challengeBtn}><Text style={s.challengeBtnTxt}>Challenge a Friend</Text></Pressable>
    </View>
  );

  const renderCommunity = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingLeft:20,paddingRight:6}}>
      {COMMUNITIES.map((c,i) => (
        <View key={i} style={s.commCard}>
          <Ionicons name={c.icon} size={28} color="#000" style={{marginBottom:8}}/>
          <Text style={s.commName}>{c.name}</Text>
          <Text style={s.commMembers}>{c.members.toLocaleString()} members</Text>
        </View>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollPad} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerAvatar}><Ionicons name="person" size={22} color="#999" /></View>
          <View style={{flex:1,marginLeft:12}}>
            <Text style={s.headerGreet}>Hello {displayName}!</Text>
            <Text style={s.headerDate}>{dateStr}</Text>
          </View>
          <Pressable style={s.iconBtn} onPress={() => router.push('/messages')}>
            <Ionicons name="chatbubble-outline" size={18} color="#000" />
            <View style={s.badge}><Text style={s.badgeTxt}>3</Text></View>
          </Pressable>
          <Pressable style={[s.iconBtn,{marginLeft:10}]} onPress={() => { /* TODO: add friends */ }}>
            <Ionicons name="person-add-outline" size={18} color="#000" />
          </Pressable>
        </View>

        {/* Search */}
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={18} color="#999" />
          <Text style={s.searchText}>Search friends or neighbors</Text>
          <Ionicons name="options-outline" size={18} color="#666" />
        </View>

        {/* Stories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingLeft:20,paddingRight:6,marginBottom:20}}>
          <Pressable style={{alignItems:'center',marginRight:14}}>
            <View style={s.storyAdd}><Ionicons name="add" size={24} color="#FFF" /></View>
            <Text style={s.storyName}>Add</Text>
          </Pressable>
          {STORY_FRIENDS.map((f,i) => (
            <Pressable key={i} style={{alignItems:'center',marginRight:14}}>
              <View style={[s.storyRing, {borderColor: f.hasStory ? '#FF6B6B' : '#E0E0E0'}]}>
                <View style={s.storyInner}><Ionicons name="person" size={24} color="#999" /></View>
              </View>
              <Text style={s.storyName}>{f.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Tab Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingLeft:20,paddingRight:6,marginBottom:16}}>
          {TABS.map(t => (
            <Pressable key={t} style={[s.tab, activeTab === t && s.tabActive]} onPress={() => setActiveTab(t)}>
              <Text style={[s.tabText, activeTab === t && s.tabTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Tab Content */}
        {activeTab === 'Feed' && renderFeed()}
        {activeTab === 'Leaderboard' && renderLeaderboard()}
        {activeTab === 'Duels' && renderDuels()}
        {activeTab === 'Community' && renderCommunity()}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {flex:1,backgroundColor:'#FFFFFF'},
  scroll: {flex:1},
  scrollPad: {paddingBottom:100},

  /* Header */
  header: {flexDirection:'row',alignItems:'center',paddingHorizontal:20,marginBottom:16,marginTop:8},
  headerAvatar: {width:44,height:44,borderRadius:22,backgroundColor:'#E0E0E0',justifyContent:'center',alignItems:'center'},
  headerGreet: {fontSize:13,color:'#666'},
  headerDate: {fontSize:15,fontWeight:'700',color:'#000',marginTop:1},
  iconBtn: {width:36,height:36,borderRadius:18,backgroundColor:'#F0F0F0',justifyContent:'center',alignItems:'center'},
  badge: {position:'absolute',top:-2,right:-2,width:16,height:16,borderRadius:8,backgroundColor:'#FF3B30',justifyContent:'center',alignItems:'center'},
  badgeTxt: {color:'#FFF',fontSize:9,fontWeight:'700'},

  /* Search */
  searchBar: {flexDirection:'row',alignItems:'center',backgroundColor:'#F5F5F5',borderRadius:12,paddingHorizontal:14,paddingVertical:10,marginHorizontal:20,marginBottom:16},
  searchText: {flex:1,fontSize:14,color:'#999',marginLeft:8},

  /* Stories */
  storyAdd: {width:60,height:60,borderRadius:30,backgroundColor:'#FFB5B5',justifyContent:'center',alignItems:'center'},
  storyRing: {width:64,height:64,borderRadius:32,borderWidth:2,justifyContent:'center',alignItems:'center'},
  storyInner: {width:56,height:56,borderRadius:28,backgroundColor:'#E0E0E0',justifyContent:'center',alignItems:'center'},
  storyName: {fontSize:10,color:'#333',marginTop:4,textAlign:'center'},

  /* Tabs */
  tab: {backgroundColor:'#F0F0F0',paddingHorizontal:16,paddingVertical:8,borderRadius:20,marginRight:8},
  tabActive: {backgroundColor:'#000'},
  tabText: {fontSize:13,fontWeight:'700',color:'#333'},
  tabTextActive: {color:'#FFF'},

  /* Feed Posts */
  postCard: {backgroundColor:'#FFF',borderRadius:16,marginHorizontal:20,marginBottom:16,overflow:'hidden',...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{}})},
  postHeader: {flexDirection:'row',alignItems:'center',padding:14},
  postAvatar: {width:40,height:40,borderRadius:20,backgroundColor:'#E0E0E0',justifyContent:'center',alignItems:'center'},
  postUser: {fontSize:15,fontWeight:'600',color:'#000'},
  postTime: {fontSize:11,color:'#999',marginTop:1},
  postText: {fontSize:15,color:'#000',lineHeight:22,paddingHorizontal:14,paddingBottom:10},
  postImage: {width:'100%',height:200,backgroundColor:'#F0F0F0',justifyContent:'center',alignItems:'center'},
  workoutCard: {flexDirection:'row',backgroundColor:'#F8F8F8',borderRadius:12,padding:12,marginHorizontal:14,marginBottom:10,alignItems:'center'},
  workoutIcon: {width:40,height:40,borderRadius:20,backgroundColor:'#000',justifyContent:'center',alignItems:'center'},
  mapCard: {height:140,borderRadius:12,backgroundColor:'#E8E8E8',marginHorizontal:14,marginBottom:10,justifyContent:'center',alignItems:'center'},
  postFooter: {flexDirection:'row',paddingHorizontal:14,paddingVertical:10,borderTopWidth:1,borderTopColor:'#F0F0F0',alignItems:'center'},
  postAction: {flexDirection:'row',alignItems:'center',marginRight:16},
  postActionText: {fontSize:13,color:'#666',marginLeft:4},

  /* Leaderboard */
  lbToggle: {flexDirection:'row',paddingHorizontal:20,gap:8,marginBottom:12},
  lbPill: {flex:1,paddingVertical:10,borderRadius:20,backgroundColor:'#F0F0F0',alignItems:'center'},
  lbPillActive: {backgroundColor:'#000'},
  lbPillText: {fontSize:13,fontWeight:'700',color:'#333'},
  lbPillTextActive: {color:'#FFF'},
  lbRankSummary: {paddingHorizontal:20,marginBottom:10},
  lbRankLabel: {fontSize:15,fontWeight:'700',color:'#000'},
  lbRow: {flexDirection:'row',alignItems:'center',paddingVertical:10,paddingHorizontal:20},
  lbRowYou: {backgroundColor:'#F5F5F5',borderRadius:12,marginHorizontal:12,paddingHorizontal:16},
  lbNum: {fontSize:14,fontWeight:'700',color:'#000',width:24},
  lbAv: {width:28,height:28,borderRadius:14,backgroundColor:'#F0F0F0',justifyContent:'center',alignItems:'center',marginRight:10},
  lbName: {flex:1,fontSize:14,fontWeight:'600',color:'#000'},
  lbXp: {fontSize:13,fontWeight:'700',color:'#000'},

  /* Duels */
  duelCard: {backgroundColor:'#FFF',borderRadius:16,padding:16,marginHorizontal:20,marginBottom:12,...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{}})},
  duelTitle: {fontSize:16,fontWeight:'700',color:'#000',marginBottom:2},
  duelSub: {fontSize:13,color:'#666',marginBottom:12},
  duelBars: {flexDirection:'row',marginBottom:8},
  duelLbl: {fontSize:12,color:'#666',marginBottom:4},
  barBg: {height:6,borderRadius:3,backgroundColor:'#E5E5E5',overflow:'hidden'},
  barFill: {height:6,borderRadius:3},
  duelDays: {fontSize:12,color:'#999',textAlign:'center'},
  challengeBtn: {backgroundColor:'#000',height:48,borderRadius:24,justifyContent:'center',alignItems:'center',marginHorizontal:20,marginBottom:12},
  challengeBtnTxt: {fontSize:16,fontWeight:'700',color:'#FFF'},

  /* Community */
  commCard: {width:160,backgroundColor:'#F5F5F5',borderRadius:14,padding:14,alignItems:'center',marginRight:12},
  commName: {fontSize:13,fontWeight:'700',color:'#000',textAlign:'center',marginBottom:4},
  commMembers: {fontSize:12,color:'#666'},
});
