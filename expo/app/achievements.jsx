import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';


const W = (Dimensions.get('window').width - 52) / 2;
const CATS = ['All','Workout','Running','Health','Social','Special'];

const EARNED = [
  {id:'e1',icon:'trophy',title:'First Workout',xp:100,date:'May 15',cat:'Workout'},
  {id:'e2',icon:'fitness',title:'5K Runner',xp:200,date:'May 22',cat:'Running'},
  {id:'e3',icon:'flame',title:'7-Day Streak',xp:300,date:'May 28',cat:'Special'},
  {id:'e4',icon:'sunny',title:'Early Bird',xp:150,date:'May 30',cat:'Workout'},
  {id:'e5',icon:'flash',title:'Calorie Crusher',xp:250,date:'Jun 1',cat:'Workout'},
  {id:'e6',icon:'water',title:'Hydration Hero',xp:200,date:'Jun 1',cat:'Health'},
  {id:'e7',icon:'barbell',title:'10 Workouts',xp:300,date:'Jun 2',cat:'Workout'},
  {id:'e8',icon:'speedometer',title:'Speed Demon',xp:400,date:'Jun 2',cat:'Running'},
  {id:'e9',icon:'restaurant',title:'Meal Prep Master',xp:200,date:'Jun 3',cat:'Health'},
  {id:'e10',icon:'people',title:'Social Butterfly',xp:150,date:'Jun 3',cat:'Social'},
  {id:'e11',icon:'moon',title:'Night Owl',xp:100,date:'Jun 3',cat:'Special'},
  {id:'e12',icon:'calendar',title:'Weekend Warrior',xp:200,date:'Jun 3',cat:'Special'},
];

const LOCKED = [
  {id:'l1',icon:'medal',title:'Marathon Runner',progress:'0/1',cat:'Running'},
  {id:'l2',icon:'star',title:'Century Club',progress:'42/100',cat:'Workout'},
  {id:'l3',icon:'flame',title:'Elite Streak',progress:'7/30',cat:'Special'},
  {id:'l4',icon:'barbell',title:'Iron Will',progress:'0/50',cat:'Workout'},
  {id:'l5',icon:'fitness',title:'Ultra Runner',progress:'23/100 km',cat:'Running'},
  {id:'l6',icon:'restaurant',title:'Master Chef',progress:'5/20',cat:'Health'},
  {id:'l7',icon:'shield',title:'Legend',progress:'Lvl 12/25',cat:'Special'},
  {id:'l8',icon:'trophy',title:'ZOWN Champion',progress:'Need all',cat:'Special'},
];

export default function AchievementsScreen() {
  const [cat, setCat] = useState('All');
  const filtered = useMemo(() => {
    const e = cat === 'All' ? EARNED : EARNED.filter(a => a.cat === cat);
    const l = cat === 'All' ? LOCKED : LOCKED.filter(a => a.cat === cat);
    return { earned: e, locked: l };
  }, [cat]);
  const totalXp = EARNED.reduce((s, a) => s + a.xp, 0);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.logoRow}><Image source={require('@/assets/branding/zown-logo-512.png')} style={s.logo} resizeMode="contain" /></View>
        <Text style={s.pageTitle}>Achievements</Text>

        <View style={s.progressCard}>
          <Text style={s.progressTitle}>{EARNED.length} / {EARNED.length + LOCKED.length} Achievements Unlocked</Text>
          <View style={s.progressBarBg}><View style={[s.progressBarFill, { width: Math.round(EARNED.length / (EARNED.length + LOCKED.length) * 100) + '%' }]} /></View>
          <Text style={s.progressXp}>{totalXp.toLocaleString()} XP Earned</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catScroll}>
          {CATS.map(c => (<Pressable key={c} style={[s.catPill, cat === c && s.catPillActive]} onPress={() => setCat(c)}><Text style={[s.catText, cat === c && s.catTextActive]}>{c}</Text></Pressable>))}
        </ScrollView>

        <View style={s.grid}>
          {filtered.earned.map(a => (
            <View key={a.id} style={[s.card, { width: W }]}>
              <View style={s.earnedCircle}><Ionicons name={a.icon} size={28} color="#FFD700" /></View>
              <Text style={s.cardTitle}>{a.title}</Text>
              <Text style={s.cardXp}>+{a.xp} XP</Text>
              <Text style={s.cardDate}>{a.date}</Text>
            </View>
          ))}
          {filtered.locked.map(a => (
            <View key={a.id} style={[s.card, { width: W }]}>
              <View style={s.lockedCircle}>
                <Ionicons name={a.icon} size={28} color="#CCC" />
                <View style={s.lockOverlay}><Ionicons name="lock-closed" size={12} color="#999" /></View>
              </View>
              <Text style={[s.cardTitle, { color: '#999' }]}>{a.title}</Text>
              <Text style={s.cardProgress}>{a.progress}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#FFFFFF'}, scroll:{flex:1}, scrollContent:{paddingBottom:100},
  logoRow:{alignItems:'center',marginTop:8,marginBottom:12}, logo:{width:120,height:36},
  pageTitle:{fontSize:24,fontWeight:'800',color:'#000',paddingHorizontal:20,marginBottom:16},
  progressCard:{backgroundColor:'#FFF',borderRadius:16,padding:20,marginHorizontal:20,marginBottom:20,...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}}})},
  progressTitle:{fontSize:16,fontWeight:'700',color:'#000',marginBottom:10},
  progressBarBg:{height:8,borderRadius:4,backgroundColor:'#E5E5E5',overflow:'hidden',marginBottom:8},
  progressBarFill:{height:8,borderRadius:4,backgroundColor:'#000'},
  progressXp:{fontSize:14,fontWeight:'600',color:'#22C55E'},
  catScroll:{paddingLeft:20,paddingRight:6,marginBottom:20},
  catPill:{backgroundColor:'#F0F0F0',paddingHorizontal:14,paddingVertical:8,borderRadius:16,marginRight:8},
  catPillActive:{backgroundColor:'#000'},
  catText:{fontSize:13,fontWeight:'700',color:'#333'},
  catTextActive:{color:'#FFF'},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:12,paddingHorizontal:20},
  card:{backgroundColor:'#FFF',borderRadius:16,padding:16,marginBottom:12,alignItems:'center',...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}}})},
  earnedCircle:{width:64,height:64,borderRadius:32,backgroundColor:'#000',justifyContent:'center',alignItems:'center'},
  lockedCircle:{width:64,height:64,borderRadius:32,backgroundColor:'#F0F0F0',justifyContent:'center',alignItems:'center',position:'relative'},
  lockOverlay:{position:'absolute',bottom:-2,right:-2,width:20,height:20,borderRadius:10,backgroundColor:'#FFF',justifyContent:'center',alignItems:'center'},
  cardTitle:{fontSize:13,fontWeight:'700',color:'#000',marginTop:8,textAlign:'center'},
  cardXp:{fontSize:11,fontWeight:'600',color:'#22C55E',marginTop:2},
  cardDate:{fontSize:10,color:'#999',marginTop:2},
  cardProgress:{fontSize:11,color:'#999',marginTop:4},
});
