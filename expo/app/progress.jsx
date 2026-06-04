import React from 'react';
import { router } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Platform , TouchableOpacity} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const WEIGHT_DATA = [
  {month:'Jan',val:185},{month:'Feb',val:183},{month:'Mar',val:181},
  {month:'Apr',val:180},{month:'May',val:178},{month:'Jun',val:177},{month:'Jul',val:175},
];
const GOALS = [
  {title:'Lose 15 lbs',current:10,target:15,unit:'lbs lost',detail:'5 lbs to go',date:'Started Apr 1'},
  {title:'Run a Half Marathon',current:8.2,target:21.1,unit:'km longest',detail:'Target Sep 2026',date:''},
  {title:'100 Workouts',current:42,target:100,unit:'workouts',detail:'58 to go',date:''},
  {title:'Bench Press 200 lbs',current:165,target:200,unit:'lbs',detail:'35 lbs to go',date:''},
];
const MEASUREMENTS = [
  {label:'Chest',value:'40 in',change:'\u2193 1 in',good:true},
  {label:'Waist',value:'32 in',change:'\u2193 2 in',good:true},
  {label:'Arms',value:'14.5 in',change:'\u2191 0.5 in',good:true},
  {label:'Thighs',value:'23 in',change:'\u2193 1 in',good:true},
];
const MONTHLY = [{label:'Workouts',val:'8',diff:'+3'},{label:'Runs',val:'4',diff:'+2'},{label:'Calories',val:'12,400',diff:'+2,100'},{label:'XP',val:'1,200',diff:'+400'}];

export default function ProgressScreen() {
  const maxW = Math.max(...WEIGHT_DATA.map(d=>d.val));
  const minW = Math.min(...WEIGHT_DATA.map(d=>d.val));
  const range = maxW - minW || 1;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.logoRow}><Image source={require('@/assets/branding/zown-logo-512.png')} style={s.logo} resizeMode="contain" /></View>
        <Text style={s.pageTitle}>Progress</Text>

        {/* Weight tracker */}

      {/* Latest Body Scan */}
      <TouchableOpacity
        style={{
          backgroundColor: '#F5F5F5',
          borderRadius: 16,
          padding: 18,
          marginBottom: 18,
        }}
        onPress={() => router.push('/body-scan')}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="body-outline" size={20} color="#4CAF50" />
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginLeft: 8 }}>
              Latest Body Scan
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: '#999' }}>2 days ago</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14 }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#4CAF50' }}>18.5%</Text>
            <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Body Fat</Text>
          </View>
          <View style={{ width: 1, backgroundColor: '#E0E0E0' }} />
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#1A1A2E' }}>148 lbs</Text>
            <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Lean Mass</Text>
          </View>
          <View style={{ width: 1, backgroundColor: '#E0E0E0' }} />
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#1A1A2E' }}>24.2</Text>
            <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>BMI</Text>
          </View>
        </View>
        <View style={{
          backgroundColor: '#4CAF50',
          borderRadius: 10,
          paddingVertical: 9,
          alignItems: 'center',
        }}>
          <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>New Scan</Text>
        </View>
      </TouchableOpacity>

        <Text style={s.sectionTitle}>Weight</Text>
        <View style={s.card}>
          <Text style={s.weightNum}>175 lbs</Text>
          <Text style={s.weightChange}>\u2193 5 lbs from start</Text>
          <Text style={s.weightGoal}>Target: 170 lbs</Text>
          <View style={s.chartArea}>
            {WEIGHT_DATA.map((d,i)=>{
              const h = ((maxW - d.val) / range) * 100;
              return (
                <View key={d.month} style={s.chartCol}>
                  <View style={[s.chartDot,{marginTop:h}]} />
                  <Text style={s.chartLabel}>{d.month}</Text>
                </View>
              );
            })}
          </View>
          <Pressable style={s.logWeightBtn}><Text style={s.logWeightBtnText}>Log Weight</Text></Pressable>
        </View>

        {/* Goals */}
        <View style={s.sectionRow}><Text style={s.sectionTitle}>Active Goals</Text><Pressable><Text style={s.addLink}>Add Goal</Text></Pressable></View>
        {GOALS.map(g=>{
          const pct=Math.round(g.current/g.target*100);
          return (
            <View key={g.title} style={s.goalCard}>
              <Text style={s.goalTitle}>{g.title}</Text>
              <View style={s.goalBarBg}><View style={[s.goalBarFill,{width:pct+'%'}]} /></View>
              <View style={s.goalRow}>
                <Text style={s.goalDetail}>{g.current}/{g.target} {g.unit} ({pct}%)</Text>
                <Text style={s.goalExtra}>{g.detail}</Text>
              </View>
            </View>
          );
        })}

        {/* Measurements */}
        <View style={s.sectionRow}><Text style={s.sectionTitle}>Measurements</Text><Pressable><Text style={s.addLink}>Update</Text></Pressable></View>
        <View style={s.card}>
          {MEASUREMENTS.map((m,i)=>(
            <View key={m.label} style={[s.measRow,i===MEASUREMENTS.length-1&&{borderBottomWidth:0}]}>
              <Text style={s.measLabel}>{m.label}</Text>
              <Text style={s.measValue}>{m.value}</Text>
              <Text style={[s.measChange,{color:'#22C55E'}]}>{m.change}</Text>
            </View>
          ))}
        </View>

        {/* Monthly summary */}
        <Text style={s.sectionTitle}>June Summary</Text>
        <View style={s.monthCard}>
          {MONTHLY.map(m=>(
            <View key={m.label} style={s.monthStat}>
              <Text style={s.monthVal}>{m.val}</Text>
              <Text style={s.monthLabel}>{m.label}</Text>
              <Text style={s.monthDiff}>{m.diff} vs last month</Text>
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
  pageTitle:{fontSize:24,fontWeight:'800',color:'#000',paddingHorizontal:20,marginBottom:8},
  sectionTitle:{fontSize:18,fontWeight:'700',color:'#000',paddingHorizontal:20,marginTop:16,marginBottom:10},
  sectionRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:20,marginTop:16,marginBottom:10},
  addLink:{fontSize:13,fontWeight:'600',color:'#666'},
  card:{backgroundColor:'#FFF',borderRadius:16,padding:16,marginHorizontal:20,marginBottom:16,...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}}})},
  weightNum:{fontSize:36,fontWeight:'800',color:'#000'},
  weightChange:{fontSize:14,color:'#22C55E',fontWeight:'600',marginTop:4},
  weightGoal:{fontSize:13,color:'#666',marginTop:2,marginBottom:16},
  chartArea:{flexDirection:'row',justifyContent:'space-around',height:120,marginBottom:12},
  chartCol:{alignItems:'center',flex:1},
  chartDot:{width:8,height:8,borderRadius:4,backgroundColor:'#000'},
  chartLabel:{fontSize:11,color:'#999',marginTop:4,position:'absolute',bottom:0},
  logWeightBtn:{backgroundColor:'#000',paddingHorizontal:20,paddingVertical:10,borderRadius:16,alignSelf:'center'},
  logWeightBtnText:{fontSize:13,fontWeight:'700',color:'#FFF'},
  goalCard:{backgroundColor:'#FFF',borderRadius:16,padding:16,marginHorizontal:20,marginBottom:12,...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}}})},
  goalTitle:{fontSize:16,fontWeight:'700',color:'#000',marginBottom:8},
  goalBarBg:{height:6,borderRadius:3,backgroundColor:'#E5E5E5',overflow:'hidden',marginBottom:6},
  goalBarFill:{height:6,borderRadius:3,backgroundColor:'#000'},
  goalRow:{flexDirection:'row',justifyContent:'space-between'},
  goalDetail:{fontSize:12,color:'#666'},
  goalExtra:{fontSize:12,color:'#999'},
  measRow:{flexDirection:'row',alignItems:'center',paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#F0F0F0'},
  measLabel:{fontSize:14,fontWeight:'600',color:'#000',flex:1},
  measValue:{fontSize:14,fontWeight:'700',color:'#000',marginRight:12},
  measChange:{fontSize:13,fontWeight:'600'},
  monthCard:{flexDirection:'row',flexWrap:'wrap',backgroundColor:'#FFF',borderRadius:16,padding:16,marginHorizontal:20,marginBottom:24,...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}}})},
  monthStat:{width:'50%',paddingVertical:8,alignItems:'center'},
  monthVal:{fontSize:22,fontWeight:'800',color:'#000'},
  monthLabel:{fontSize:11,color:'#999',marginTop:2},
  monthDiff:{fontSize:10,color:'#22C55E',marginTop:2},
});
