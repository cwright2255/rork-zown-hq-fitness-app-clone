import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useHealthStore } from '@/store/healthStore';
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

const METRICS_LIVE = [
  { icon: 'moon-outline', label: 'Sleep', value: '7.5h', target: 8, current: 7.5 },
  { icon: 'footsteps-outline', label: 'Steps', value: '7,200', target: 10000, current: 7200 },
  { icon: 'water-outline', label: 'Water', value: '5/8 glasses', target: 8, current: 5 },
  { icon: 'leaf-outline', label: 'Mindfulness', value: '10 min', target: 15, current: 10 },
];

const DEVICES = [
  { name: 'Apple Watch', icon: 'watch-outline' },
  { name: 'Fitbit', icon: 'fitness-outline' },
  { name: 'Garmin', icon: 'navigate-outline' },
  { name: 'WHOOP', icon: 'pulse-outline' },
];

export default function HealthScreen() {

  const { hydration, sleep, steps, getLatestWeight } = useHealthStore();
  const latestWeight = getLatestWeight();

  const METRICS_LIVE = [
    { icon: 'moon-outline', label: 'Sleep', value: sleep?.hours ? sleep.hours + 'h' : '\u2014', target: 8, current: sleep?.hours || 0 },
    { icon: 'footsteps-outline', label: 'Steps', value: steps ? steps.toLocaleString() : '0', target: 10000, current: steps || 0 },
    { icon: 'water-outline', label: 'Water', value: (hydration?.glasses || 0) + '/' + (hydration?.target || 8) + ' glasses', target: hydration?.target || 8, current: hydration?.glasses || 0 },
    { icon: 'leaf-outline', label: 'Mindfulness', value: '\u2014', target: 15, current: 0 },
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.logoRow}><Image source={require('@/assets/branding/zown-logo-512.png')} style={s.logo} resizeMode="contain" /></View>
        <Text style={s.pageTitle}>Health</Text>

        {/* Health Score */}
        <View style={s.card}>
          <Text style={s.cardHeader}>Your Health Score</Text>
          <View style={s.scoreCircle}><Text style={s.scoreNum}>82</Text></View>
          <Text style={s.scoreLabel}>Good</Text>
          <Text style={s.scoreUpdated}>Updated today at 9:15 AM</Text>
        </View>

        {/* Quick Stats */}
        <View style={s.statsRow}>
          {[{icon:'heart-outline',val:'72',unit:'bpm',label:'Heart Rate'},{icon:'pulse-outline',val:'98',unit:'%',label:'Blood Oxygen'},{icon:'happy-outline',val:'Low',unit:'',label:'Stress Level'}].map(st=>(
            <View key={st.label} style={s.statCard}>
              <Ionicons name={st.icon} size={20} color="#000" />
              <Text style={s.statVal}>{st.val}{st.unit ? ' '+st.unit : ''}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* AI Insight */}
        <View style={s.insightCard}>
          <View style={s.insightBadge}><Ionicons name="sparkles" size={14} color="#FFD700" /><Text style={s.insightBadgeText}>AI Coach</Text></View>
          <Text style={s.insightText}>Based on your activity, consider adding a 10-minute stretch before your evening workout to improve recovery.</Text>
          <Pressable><Text style={s.insightLink}>Get More Insights</Text></Pressable>
        </View>

        {/* Health Metrics */}
      {/* Body Composition Scan Card */}
      <TouchableOpacity
        style={{
          backgroundColor: '#F5F5F5',
          borderRadius: 16,
          padding: 20,
          marginBottom: 18,
        }}
        onPress={() => router.push('/body-scan')}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <View style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: '#E8F5E9',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
          }}>
            <Ionicons name="body-outline" size={24} color="#4CAF50" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A2E', marginBottom: 2 }}>
              Body Composition Scan
            </Text>
            <Text style={{ fontSize: 13, color: '#666', lineHeight: 18 }}>
              AI-powered body analysis using your camera
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </View>
        <View style={{
          backgroundColor: '#4CAF50',
          borderRadius: 10,
          paddingVertical: 10,
          alignItems: 'center',
        }}>
          <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>Scan Now</Text>
        </View>
      </TouchableOpacity>

        <Text style={s.sectionTitle}>Health Metrics</Text>
        <View style={s.metricsCard}>
          {METRICS_LIVE.map((m,i) => (
            <View key={m.label} style={[s.metricRow, i === METRICS_LIVE.length-1 && {borderBottomWidth:0}]}>
              <Ionicons name={m.icon} size={20} color="#000" style={{width:30}} />
              <Text style={s.metricLabel}>{m.label}</Text>
              <Text style={s.metricValue}>{m.value}</Text>
              <View style={s.metricBarBg}><View style={[s.metricBarFill,{width:Math.min(100,Math.round(m.current/m.target*100))+'%'}]} /></View>
            </View>
          ))}
        </View>

        {/* Wearable Sync */}
        <Text style={s.sectionTitle}>Wearable Sync</Text>
        <View style={s.syncCard}>
          <Text style={s.syncTitle}>Connect Your Device</Text>
          <View style={s.devicesRow}>
            {DEVICES.map(d=>(
              <View key={d.name} style={s.deviceItem}><View style={s.deviceCircle}><Ionicons name={d.icon} size={18} color="#000" /></View><Text style={s.deviceName}>{d.name}</Text></View>
            ))}
          </View>
          <Pressable style={s.syncBtn}><Text style={s.syncBtnText}>Sync Now</Text></Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#FFFFFF'}, scroll:{flex:1}, scrollContent:{paddingBottom:100},
  logoRow:{alignItems:'center',marginTop:8,marginBottom:12}, logo:{width:120,height:36},
  pageTitle:{fontSize:24,fontWeight:'800',color:'#000',paddingHorizontal:20,marginBottom:16},
  card:{backgroundColor:'#FFF',borderRadius:16,padding:20,marginHorizontal:20,marginBottom:20,alignItems:'center',...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}}})},
  cardHeader:{fontSize:16,fontWeight:'700',color:'#000',marginBottom:16},
  scoreCircle:{width:120,height:120,borderRadius:60,borderWidth:6,borderColor:'#000',justifyContent:'center',alignItems:'center'},
  scoreNum:{fontSize:36,fontWeight:'800',color:'#000'},
  scoreLabel:{fontSize:16,fontWeight:'700',color:'#22C55E',marginTop:8},
  scoreUpdated:{fontSize:11,color:'#999',marginTop:4},
  statsRow:{flexDirection:'row',gap:10,paddingHorizontal:20,marginBottom:20},
  statCard:{flex:1,backgroundColor:'#FFF',borderRadius:14,padding:14,alignItems:'center',...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}}})},
  statVal:{fontSize:18,fontWeight:'800',color:'#000',marginTop:4},
  statLabel:{fontSize:10,color:'#999',marginTop:2},
  insightCard:{backgroundColor:'#F5F5F5',borderRadius:16,padding:16,marginHorizontal:20,marginBottom:20},
  insightBadge:{flexDirection:'row',alignItems:'center',gap:4,marginBottom:8},
  insightBadgeText:{fontSize:12,fontWeight:'700',color:'#000'},
  insightText:{fontSize:14,color:'#444',lineHeight:22},
  insightLink:{fontSize:14,fontWeight:'600',color:'#000',marginTop:8},
  sectionTitle:{fontSize:18,fontWeight:'700',color:'#000',paddingHorizontal:20,marginTop:8,marginBottom:10},
  metricsCard:{backgroundColor:'#FFF',borderRadius:16,padding:16,marginHorizontal:20,marginBottom:20,...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}}})},
  metricRow:{flexDirection:'row',alignItems:'center',paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#F0F0F0'},
  metricLabel:{fontSize:14,fontWeight:'600',color:'#000',flex:1},
  metricValue:{fontSize:14,fontWeight:'700',color:'#000',marginRight:10,width:80,textAlign:'right'},
  metricBarBg:{width:60,height:4,borderRadius:2,backgroundColor:'#E5E5E5',overflow:'hidden'},
  metricBarFill:{height:4,borderRadius:2,backgroundColor:'#000'},
  syncCard:{backgroundColor:'#FFF',borderRadius:16,padding:16,marginHorizontal:20,marginBottom:24,...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}}})},
  syncTitle:{fontSize:16,fontWeight:'700',color:'#000',marginBottom:12},
  devicesRow:{flexDirection:'row',justifyContent:'space-around',marginBottom:16},
  deviceItem:{alignItems:'center'},
  deviceCircle:{width:48,height:48,borderRadius:24,backgroundColor:'#F0F0F0',justifyContent:'center',alignItems:'center'},
  deviceName:{fontSize:11,color:'#666',marginTop:4},
  syncBtn:{backgroundColor:'#000',height:44,borderRadius:22,justifyContent:'center',alignItems:'center'},
  syncBtnText:{fontSize:14,fontWeight:'700',color:'#FFF'},
});
