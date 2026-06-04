import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

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

const CONVERSATIONS = [
  { id: '1', name: 'Tillie Larson', lastMsg: 'I hope you are well.', time: '2s ago', unread: true },
  { id: '2', name: 'Lovely friends \u{1F60D}', lastMsg: 'This afternoon at 5:30PM', time: '1 min', unread: true, isGroup: true },
  { id: '3', name: 'Jordan Jordan', lastMsg: 'Are you ready for this after...', time: '2 mins', unread: false },
  { id: '4', name: 'Jay Bowen', lastMsg: 'Hi guys, How is going?', time: '5 mins', unread: false },
  { id: '5', name: 'Christine Gonzales', lastMsg: 'I hope you are well.', time: '1 day', unread: false },
  { id: '6', name: 'Don Richardson', lastMsg: 'This afternoon at 5:30PM', time: '1 day', unread: false },
  { id: '7', name: 'Alex R.', lastMsg: 'Great workout today! \u{1F4AA}', time: '2 days', unread: false },
  { id: '8', name: 'Sarah M.', lastMsg: 'Want to do a 5K together?', time: '3 days', unread: false },
];

export default function MessagesScreen() {


  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#000" />
        </Pressable>
        <Text style={s.headerTitle}>Messages</Text>
        <Pressable style={s.menuBtn}>
          <Ionicons name="ellipsis-vertical" size={20} color="#000" />
        </Pressable>
      </View>

      {/* Search */}
      <View style={s.searchBar}>
        <Ionicons name="search-outline" size={18} color="#999" />
        <Text style={s.searchText}>Search friends or neighbors</Text>
        <Ionicons name="options-outline" size={18} color="#666" />
      </View>

      {/* Stories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingLeft:20,paddingRight:6,marginBottom:8}}>
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

      {/* Conversation List */}
      <ScrollView style={s.convList} contentContainerStyle={{paddingBottom:20}}>
        {CONVERSATIONS.map(c => (
          <Pressable key={c.id} style={s.convRow} onPress={() => router.push({ pathname: '/messages/' + c.id, params: { name: c.name } })}>
            <View style={s.convAvatar}>
              <Ionicons name={c.isGroup ? 'people' : 'person'} size={22} color="#999" />
            </View>
            <View style={{flex:1,marginLeft:12}}>
              <Text style={[s.convName, c.unread && {fontWeight:'700'}]}>{c.name}</Text>
              <Text style={s.convMsg} numberOfLines={1}>{c.lastMsg}</Text>
            </View>
            <View style={{alignItems:'flex-end'}}>
              <Text style={s.convTime}>{c.time}</Text>
              {c.unread && <View style={s.unreadDot}/>}
            </View>
          </Pressable>
        ))}
      </ScrollView>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {flex:1,backgroundColor:'#FFFFFF'},

  /* Header */
  header: {flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:12},
  backBtn: {width:36,height:36,justifyContent:'center',alignItems:'center'},
  headerTitle: {flex:1,textAlign:'center',fontSize:18,fontWeight:'700',color:'#000'},
  menuBtn: {width:36,height:36,justifyContent:'center',alignItems:'center'},

  /* Search */
  searchBar: {flexDirection:'row',alignItems:'center',backgroundColor:'#F5F5F5',borderRadius:12,paddingHorizontal:14,paddingVertical:10,marginHorizontal:20,marginBottom:16},
  searchText: {flex:1,fontSize:14,color:'#999',marginLeft:8},

  /* Stories */
  storyAdd: {width:60,height:60,borderRadius:30,backgroundColor:'#FFB5B5',justifyContent:'center',alignItems:'center'},
  storyRing: {width:64,height:64,borderRadius:32,borderWidth:2,justifyContent:'center',alignItems:'center'},
  storyInner: {width:56,height:56,borderRadius:28,backgroundColor:'#E0E0E0',justifyContent:'center',alignItems:'center'},
  storyName: {fontSize:10,color:'#333',marginTop:4,textAlign:'center'},

  /* Conversations */
  convList: {flex:1},
  convRow: {flexDirection:'row',alignItems:'center',paddingVertical:14,paddingHorizontal:20,borderBottomWidth:1,borderBottomColor:'#F5F5F5'},
  convAvatar: {width:48,height:48,borderRadius:24,backgroundColor:'#E0E0E0',justifyContent:'center',alignItems:'center'},
  convName: {fontSize:15,fontWeight:'600',color:'#000'},
  convMsg: {fontSize:13,color:'#999',marginTop:2},
  convTime: {fontSize:11,color:'#999'},
  unreadDot: {width:8,height:8,borderRadius:4,backgroundColor:'#000',marginTop:4},

});
