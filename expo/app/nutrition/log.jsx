import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const MEALS = [
  { id:'m1', meal:'Breakfast', items:'Yogurt, banana', cal:350, icon:'sunny-outline' },
  { id:'m2', meal:'Lunch', items:'Chicken salad', cal:520, icon:'partly-sunny-outline' },
  { id:'m3', meal:'Snack', items:'Protein bar', cal:280, icon:'cafe-outline' },
];
const MACROS = [
  { label:'Protein', current:85, target:120, color:'#000' },
  { label:'Carbs', current:180, target:250, color:'#555' },
  { label:'Fat', current:45, target:65, color:'#999' },
];

export default function NutritionLogScreen() {
  const [glasses, setGlasses] = useState(5);
  const consumed = 1450; const target = 2000; const remaining = target - consumed;
  const calPct = Math.round((consumed/target)*100);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.logoRow}><Image source={require('@/assets/branding/zown-logo-512.png')} style={s.logo} resizeMode="contain" /></View>
        <Text style={s.pageTitle}>Nutrition</Text>

        {/* Calorie card */}
        <View style={s.card}>
          <View style={s.calCircle}><Text style={s.calNum}>{remaining}</Text><Text style={s.calUnit}>cal left</Text></View>
          <View style={s.calRow}>
            <View style={s.calStat}><Text style={s.calStatVal}>{consumed}</Text><Text style={s.calStatLabel}>Consumed</Text></View>
            <View style={s.calStat}><Text style={s.calStatVal}>{target}</Text><Text style={s.calStatLabel}>Target</Text></View>
          </View>
          <View style={s.macrosRow}>
            {MACROS.map(m=>(
              <View key={m.label} style={s.macroItem}>
                <Text style={s.macroLabel}>{m.label}</Text>
                <View style={s.macroBarBg}><View style={[s.macroBarFill,{width:Math.round(m.current/m.target*100)+'%',backgroundColor:m.color}]} /></View>
                <Text style={s.macroVal}>{m.current}g / {m.target}g</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quick log actions */}
        <View style={s.actionsRow}>
          {[{icon:'barcode-outline',label:'Scan Barcode'},{icon:'camera-outline',label:'Photo Log'},{icon:'add-circle-outline',label:'Quick Add'}].map(a=>(
            <Pressable key={a.label} style={s.actionCard} onPress={()=>{/* TODO */}}>
              <Ionicons name={a.icon} size={28} color="#000" />
              <Text style={s.actionLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Meals */}
        <View style={s.sectionRow}><Text style={s.sectionTitle}>Today's Meals</Text><Pressable><Text style={s.addMeal}>Add Meal</Text></Pressable></View>
        {MEALS.map(m=>(
          <View key={m.id} style={s.mealRow}>
            <View style={s.mealIcon}><Ionicons name={m.icon} size={18} color="#000" /></View>
            <View style={s.mealInfo}><Text style={s.mealName}>{m.meal}</Text><Text style={s.mealItems}>{m.items}</Text></View>
            <Text style={s.mealCal}>{m.cal} cal</Text>
          </View>
        ))}
        <Pressable style={s.emptyMeal}><Text style={s.emptyMealText}>Tap to log dinner</Text></Pressable>

        {/* Hydration */}
        <Text style={[s.sectionTitle,{marginTop:20}]}>Hydration</Text>
        <View style={s.hydrationCard}>
          <View style={s.glassesRow}>
            {Array.from({length:8}).map((_,i)=>(
              <Pressable key={i} onPress={()=>setGlasses(i+1)}>
                <Ionicons name={i<glasses?'water':'water-outline'} size={28} color={i<glasses?'#000':'#CCC'} />
              </Pressable>
            ))}
          </View>
          <Text style={s.glassesLabel}>{glasses} of 8 glasses</Text>
          <Pressable style={s.addGlassBtn} onPress={()=>glasses<8&&setGlasses(glasses+1)}><Text style={s.addGlassBtnText}>Add Glass</Text></Pressable>
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
  calCircle:{width:120,height:120,borderRadius:60,borderWidth:6,borderColor:'#000',justifyContent:'center',alignItems:'center',marginBottom:12},
  calNum:{fontSize:28,fontWeight:'800',color:'#000'},
  calUnit:{fontSize:11,color:'#999'},
  calRow:{flexDirection:'row',gap:40,marginBottom:16},
  calStat:{alignItems:'center'},
  calStatVal:{fontSize:18,fontWeight:'700',color:'#000'},
  calStatLabel:{fontSize:11,color:'#999',marginTop:2},
  macrosRow:{flexDirection:'row',gap:16,width:'100%'},
  macroItem:{flex:1},
  macroLabel:{fontSize:12,fontWeight:'600',color:'#000',marginBottom:4},
  macroBarBg:{height:4,borderRadius:2,backgroundColor:'#E5E5E5',overflow:'hidden'},
  macroBarFill:{height:4,borderRadius:2},
  macroVal:{fontSize:10,color:'#999',marginTop:2},
  actionsRow:{flexDirection:'row',gap:10,paddingHorizontal:20,marginBottom:20},
  actionCard:{flex:1,backgroundColor:'#F0F0F0',borderRadius:14,padding:16,alignItems:'center',gap:6},
  actionLabel:{fontSize:11,fontWeight:'600',color:'#000'},
  sectionRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:20,marginBottom:12},
  sectionTitle:{fontSize:18,fontWeight:'700',color:'#000',paddingHorizontal:20},
  addMeal:{fontSize:13,fontWeight:'600',color:'#666'},
  mealRow:{flexDirection:'row',alignItems:'center',paddingVertical:12,paddingHorizontal:20,borderBottomWidth:1,borderBottomColor:'#F0F0F0'},
  mealIcon:{width:40,height:40,borderRadius:20,backgroundColor:'#F0F0F0',justifyContent:'center',alignItems:'center'},
  mealInfo:{flex:1,marginLeft:12},
  mealName:{fontSize:15,fontWeight:'600',color:'#000'},
  mealItems:{fontSize:12,color:'#999',marginTop:2},
  mealCal:{fontSize:14,fontWeight:'700',color:'#000'},
  emptyMeal:{marginHorizontal:20,marginTop:8,marginBottom:20,borderWidth:1,borderColor:'#E5E5E5',borderStyle:'dashed',borderRadius:12,padding:16,alignItems:'center'},
  emptyMealText:{fontSize:14,color:'#999'},
  hydrationCard:{backgroundColor:'#FFF',borderRadius:16,padding:16,marginHorizontal:20,marginBottom:24,alignItems:'center',...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}}})},
  glassesRow:{flexDirection:'row',gap:8,marginBottom:8},
  glassesLabel:{fontSize:14,fontWeight:'600',color:'#000',marginBottom:10},
  addGlassBtn:{backgroundColor:'#000',paddingHorizontal:20,paddingVertical:8,borderRadius:16},
  addGlassBtnText:{fontSize:13,fontWeight:'700',color:'#FFF'},
});
