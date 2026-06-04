import React, { useState, useMemo } from 'react';
  const [achCat, setAchCat] = useState('All');
  const [showAllAch, setShowAllAch] = useState(false);

  const filteredAch = useMemo(() => {
    const earned = achCat === 'All' ? ACH_EARNED : ACH_EARNED.filter(a => a.cat === achCat);
    const locked = achCat === 'All' ? ACH_LOCKED : ACH_LOCKED.filter(a => a.cat === achCat);
    return { earned, locked };
  }, [achCat]);

  const visibleAch = showAllAch ? [...filteredAch.earned, ...filteredAch.locked] : [...filteredAch.earned, ...filteredAch.locked].slice(0, 6);
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

const TIERS = [
  {t:1,icon:'trophy',name:'Profile Badge',status:'claimed'},
  {t:2,icon:'star',name:'100 Bonus XP',status:'claimed'},
  {t:3,icon:'color-palette',name:'Dark Gold Theme',status:'claimed'},
  {t:4,icon:'barbell',name:'HIIT Elite',status:'claimed'},
  {t:5,icon:'nutrition',name:'Power Smoothie',status:'claimed'},
  {t:6,icon:'star',name:'200 Bonus XP',status:'claimed'},
  {t:7,icon:'person',name:'Avatar Frame',status:'current'},
  {t:8,icon:'map',name:'Beach 10K Route',status:'locked',xp:500},
  {t:9,icon:'star',name:'300 Bonus XP',status:'locked',xp:600},
  {t:10,icon:'barbell',name:'Titan Core',status:'locked',xp:700},
  {t:11,icon:'flame',name:'Fire Streak Badge',status:'locked',xp:800},
  {t:12,icon:'restaurant',name:'Meal Prep Pack',status:'locked',xp:900},
  {t:13,icon:'star',name:'500 Bonus XP',status:'locked',xp:1000},
  {t:14,icon:'pricetag',name:'20% Gear Discount',status:'locked',xp:1200},
  {t:15,icon:'fitness',name:'Pro Running Plan',status:'locked',xp:1400},
  {t:16,icon:'star',name:'750 Bonus XP',status:'locked',xp:1600},
  {t:17,icon:'color-palette',name:'Neon Theme',status:'locked',xp:1800},
  {t:18,icon:'star',name:'1000 Bonus XP',status:'locked',xp:2000},
  {t:19,icon:'shield',name:'Champion Badge',status:'locked',xp:2500},
  {t:20,icon:'ribbon',name:'OWN THE DAY Title',status:'locked',xp:3000},
];

const DAILY = [
  {title:'Complete 1 workout',xp:50,current:0,target:1},
  {title:'Log 3 meals',xp:30,current:2,target:3},
  {title:'Walk 5,000 steps',xp:40,current:3200,target:5000},
];
const WEEKLY = [
  {title:'Run 10km this week',xp:200,current:4.2,target:10,unit:'km'},
  {title:'Complete 5 workouts',xp:300,current:2,target:5},
];

const ACH_W = (Dimensions.get('window').width - 52) / 2;
const ACH_CATS = ['All','Workout','Running','Health','Social','Special'];

const ACH_EARNED = [
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

const ACH_LOCKED = [
  {id:'l1',icon:'medal',title:'Marathon Runner',progress:'0/1',cat:'Running'},
  {id:'l2',icon:'star',title:'Century Club',progress:'42/100',cat:'Workout'},
  {id:'l3',icon:'flame',title:'Elite Streak',progress:'7/30',cat:'Special'},
  {id:'l4',icon:'barbell',title:'Iron Will',progress:'0/50',cat:'Workout'},
  {id:'l5',icon:'fitness',title:'Ultra Runner',progress:'23/100 km',cat:'Running'},
  {id:'l6',icon:'restaurant',title:'Master Chef',progress:'5/20',cat:'Health'},
  {id:'l7',icon:'shield',title:'Legend',progress:'Lvl 12/25',cat:'Special'},
  {id:'l8',icon:'trophy',title:'ZOWN Champion',progress:'Need all',cat:'Special'},
];


function TierCard({tier}){
  const claimed = tier.status === 'claimed';
  const current = tier.status === 'current';
  const bg = claimed ? '#000' : current ? '#FFF' : '#F5F5F5';
  const border = claimed ? '#FFD700' : current ? '#FFD700' : '#E5E5E5';
  const iconColor = claimed ? '#FFD700' : current ? '#000' : '#CCC';
  return (
    <View style={s.tierCol}>
      <View style={s.tierNum}><Text style={s.tierNumText}>{tier.t}</Text></View>
      <View style={[s.tierBox,{backgroundColor:bg,borderColor:border}]}>
        <Ionicons name={tier.icon} size={32} color={iconColor} />
        <Text style={[s.tierName,{color:claimed?'#FFF':current?'#000':'#999'}]} numberOfLines={2}>{tier.name}</Text>
        {claimed && <Text style={s.tierClaimed}>CLAIMED</Text>}
        {current && <Pressable style={s.claimBtn}><Text style={s.claimBtnText}>CLAIM</Text></Pressable>}
        {tier.status==='locked' && <Text style={s.tierXpNeed}>{tier.xp} XP</Text>}
      </View>
    </View>
  );
}

function MissionRow({m,weekly}){
  const pct = Math.min(100,Math.round(m.current/m.target*100));
  return (
    <View style={s.missionCard}>
      <View style={s.missionInfo}>
        <Text style={s.missionTitle}>{m.title}</Text>
        <View style={s.missionBarBg}><View style={[s.missionBarFill,{width:pct+'%'}]} /></View>
        <Text style={s.missionProg}>{m.current}{m.unit||''}/{m.target}{m.unit||''}</Text>
      </View>
      <View style={s.missionXpBadge}><Text style={s.missionXpText}>+{m.xp}</Text></View>
    </View>
  );
}

export default function BattlePassScreen(){
  const [track,setTrack]=useState('Free');
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.logoRow}><Image source={require('@/assets/branding/zown-logo-512.png')} style={s.logo} resizeMode="contain" /></View>

        {/* Season banner */}
        <View style={s.banner}>
          <Text style={s.seasonLabel}>SEASON 1</Text>
          <Text style={s.seasonTitle}>OWN THE DAY</Text>
          <Text style={s.seasonDate}>June 2026</Text>
          <View style={s.seasonBarBg}><View style={[s.seasonBarFill,{width:'35%'}]} /></View>
          <View style={s.seasonRow}><Text style={s.seasonLevel}>Level 7 / 20</Text><Text style={s.seasonDays}>24 days left</Text></View>
        </View>

        {/* XP counter */}
        <View style={s.xpRow}><Text style={s.xpLabel}>Current XP: <Text style={s.xpBold}>2,450</Text></Text><Text style={s.xpLabel}>Next Tier: <Text style={s.xpBold}>500 XP</Text></Text></View>

        {/* Tier carousel */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tierScroll}>
          {TIERS.map(t=><TierCard key={t.t} tier={t} />)}
        </ScrollView>

        {/* Track toggle */}
        <View style={s.trackRow}>
          {['Free','Premium'].map(t=>(<Pressable key={t} style={[s.trackPill,track===t&&s.trackPillActive]} onPress={()=>setTrack(t)}><Text style={[s.trackText,track===t&&s.trackTextActive]}>{t} Track</Text></Pressable>))}
        </View>

        {track==='Premium' && (
          <View style={s.premiumCard}>
            <Text style={s.premiumTitle}>Upgrade to Premium</Text>
            <Text style={s.premiumPrice}>$9.99 / season</Text>
            {['Unlock all 20 tiers','Exclusive gear discounts','Premium recipes & workouts','Custom themes'].map(b=>(<View key={b} style={s.benefitRow}><Ionicons name="checkmark-circle" size={16} color="#FFD700" /><Text style={s.benefitText}>{b}</Text></View>))}
            <Pressable style={s.upgradeBtn}><Text style={s.upgradeBtnText}>Upgrade Now</Text></Pressable>
          </View>
        )}

        {/* Missions */}
        <View style={s.missionHeader}><Text style={s.sectionTitle}>Missions</Text><Text style={s.resetTimer}>Resets in 14h</Text></View>
        <Text style={s.missionGroup}>Daily</Text>
        {DAILY.map((m,i)=><MissionRow key={i} m={m} />)}
        <Text style={s.missionGroup}>Weekly</Text>
        {WEEKLY.map((m,i)=><MissionRow key={i} m={m} weekly />)}
      
        {/* Achievements Section */}
        <View style={s.missionHeader}>
          <Text style={s.sectionTitle}>Achievements</Text>
          <Text style={s.resetTimer}>{ACH_EARNED.length}/{ACH_EARNED.length + ACH_LOCKED.length}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingLeft:20,paddingRight:6,marginBottom:16}}>
          {ACH_CATS.map(c => (
            <Pressable key={c} style={{backgroundColor: achCat === c ? '#000' : '#F0F0F0', paddingHorizontal:16, paddingVertical:8, borderRadius:20, marginRight:8}} onPress={() => setAchCat(c)}>
              <Text style={{fontSize:13, fontWeight:'700', color: achCat === c ? '#FFF' : '#333'}}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',paddingHorizontal:20,marginBottom:12}}>
          {visibleAch.map(a => {
            const isEarned = a.xp !== undefined;
            return (
              <View key={a.id} style={{width:ACH_W,backgroundColor:'#FFF',borderRadius:16,padding:16,marginBottom:12,alignItems:'center',...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.04,shadowRadius:6,shadowOffset:{width:0,height:2}},android:{elevation:2},default:{}})}}>
                <View style={{width:56,height:56,borderRadius:28,backgroundColor:isEarned?'#000':'#F0F0F0',justifyContent:'center',alignItems:'center',marginBottom:10}}>
                  <Ionicons name={a.icon} size={28} color={isEarned ? '#FFD700' : '#CCC'} />
                  {!isEarned && <View style={{position:'absolute',bottom:-2,right:-2,backgroundColor:'#FFF',borderRadius:8,padding:2}}><Ionicons name="lock-closed" size={12} color="#999" /></View>}
                </View>
                <Text style={{fontSize:13,fontWeight:'700',color:'#000',textAlign:'center',marginBottom:4}}>{a.title}</Text>
                {isEarned ? <Text style={{fontSize:12,fontWeight:'600',color:'#22C55E'}}>+{a.xp} XP</Text> : <Text style={{fontSize:11,color:'#999'}}>{a.progress}</Text>}
              </View>
            );
          })}
        </View>

        {!showAllAch && filteredAch.earned.length + filteredAch.locked.length > 6 && (
          <Pressable style={{alignItems:'center',marginBottom:24}} onPress={() => setShowAllAch(true)}>
            <Text style={{fontSize:14,fontWeight:'700',color:'#000'}}>View All Achievements</Text>
          </Pressable>
        )}
        {showAllAch && (
          <Pressable style={{alignItems:'center',marginBottom:24}} onPress={() => setShowAllAch(false)}>
            <Text style={{fontSize:14,fontWeight:'700',color:'#999'}}>Show Less</Text>
          </Pressable>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#FFFFFF'}, scroll:{flex:1}, scrollContent:{paddingBottom:100},
  logoRow:{alignItems:'center',marginTop:8,marginBottom:12}, logo:{width:120,height:36},
  banner:{backgroundColor:'#000',borderRadius:16,marginHorizontal:20,padding:20,marginBottom:20},
  seasonLabel:{fontSize:12,color:'#999',textTransform:'uppercase',letterSpacing:2},
  seasonTitle:{fontSize:28,fontWeight:'900',color:'#FFF',marginTop:4},
  seasonDate:{fontSize:13,color:'#666',marginTop:2,marginBottom:12},
  seasonBarBg:{height:6,borderRadius:3,backgroundColor:'#333',overflow:'hidden'},
  seasonBarFill:{height:6,borderRadius:3,backgroundColor:'#FFD700'},
  seasonRow:{flexDirection:'row',justifyContent:'space-between',marginTop:8},
  seasonLevel:{fontSize:12,fontWeight:'700',color:'#FFD700'},
  seasonDays:{fontSize:12,color:'#999'},
  xpRow:{flexDirection:'row',justifyContent:'space-between',paddingHorizontal:20,marginBottom:16},
  xpLabel:{fontSize:13,color:'#666'},
  xpBold:{fontWeight:'700',color:'#000'},
  tierScroll:{paddingLeft:20,paddingRight:6,marginBottom:20},
  tierCol:{alignItems:'center',marginRight:2},
  tierNum:{width:24,height:24,borderRadius:12,backgroundColor:'#F0F0F0',justifyContent:'center',alignItems:'center',marginBottom:4},
  tierNumText:{fontSize:11,fontWeight:'700',color:'#000'},
  tierBox:{width:110,height:140,borderRadius:12,padding:10,alignItems:'center',justifyContent:'center',borderWidth:2},
  tierName:{fontSize:11,fontWeight:'600',marginTop:6,textAlign:'center'},
  tierClaimed:{fontSize:8,fontWeight:'800',color:'#FFD700',marginTop:4},
  claimBtn:{backgroundColor:'#FFD700',paddingHorizontal:12,paddingVertical:4,borderRadius:8,marginTop:6},
  claimBtnText:{fontSize:10,fontWeight:'800',color:'#000'},
  tierXpNeed:{fontSize:10,color:'#999',marginTop:4},
  trackRow:{flexDirection:'row',gap:8,paddingHorizontal:20,marginBottom:16},
  trackPill:{flex:1,paddingVertical:10,borderRadius:20,backgroundColor:'#F0F0F0',alignItems:'center'},
  trackPillActive:{backgroundColor:'#000'},
  trackText:{fontSize:13,fontWeight:'700',color:'#333'},
  trackTextActive:{color:'#FFF'},
  premiumCard:{backgroundColor:'#F5F5F5',borderRadius:16,padding:20,marginHorizontal:20,marginBottom:20},
  premiumTitle:{fontSize:18,fontWeight:'700',color:'#000'},
  premiumPrice:{fontSize:14,color:'#666',marginTop:2,marginBottom:12},
  benefitRow:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:6},
  benefitText:{fontSize:13,color:'#333'},
  upgradeBtn:{backgroundColor:'#000',height:48,borderRadius:24,justifyContent:'center',alignItems:'center',marginTop:12},
  upgradeBtnText:{fontSize:16,fontWeight:'700',color:'#FFF'},
  missionHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:20,marginBottom:8},
  sectionTitle:{fontSize:18,fontWeight:'700',color:'#000'},
  resetTimer:{fontSize:12,color:'#999'},
  missionGroup:{fontSize:13,fontWeight:'600',color:'#999',textTransform:'uppercase',paddingHorizontal:20,marginTop:12,marginBottom:8},
  missionCard:{flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderRadius:12,padding:14,marginHorizontal:20,marginBottom:8,...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.04,shadowRadius:6,shadowOffset:{width:0,height:2}},android:{elevation:2},default:{shadowColor:'#000',shadowOpacity:0.04,shadowRadius:6,shadowOffset:{width:0,height:2}}})},
  missionInfo:{flex:1},
  missionTitle:{fontSize:14,fontWeight:'600',color:'#000',marginBottom:6},
  missionBarBg:{height:4,borderRadius:2,backgroundColor:'#E5E5E5',overflow:'hidden',marginBottom:4},
  missionBarFill:{height:4,borderRadius:2,backgroundColor:'#000'},
  missionProg:{fontSize:11,color:'#999'},
  missionXpBadge:{backgroundColor:'#F0F0F0',paddingHorizontal:10,paddingVertical:6,borderRadius:10,marginLeft:10},
  missionXpText:{fontSize:12,fontWeight:'700',color:'#000'},
});
