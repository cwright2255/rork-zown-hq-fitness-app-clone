import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useHealthStore } from '@/store/healthStore';
import { useUserStore } from '@/store/userStore';

export function ErrorBoundary({ error, retry }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 8 }}>Something went wrong</Text>
      <Pressable onPress={retry} style={{ backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 }}>
        <Text style={{ color: '#fff', fontWeight: '600' }}>Try Again</Text>
      </Pressable>
    </View>
  );
}

const MEAL = {
  name: 'Grilled Chicken Salad',
  calories: 420,
  protein: 38,
  carbs: 24,
  fat: 18,
  fiber: 6,
  sugar: 8,
  sodium: 580,
  cholesterol: 95,
  ingredients: ['Grilled chicken breast (6 oz)','Mixed greens (2 cups)','Cherry tomatoes (1/2 cup)','Cucumber (1/2 cup)','Avocado (1/4)','Olive oil dressing (2 tbsp)','Feta cheese (1 oz)','Red onion (2 tbsp)'],
};

function MacroBar({ label, value, max, color }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <View style={s.macroItem}>
      <View style={s.macroLabelRow}><Text style={s.macroLabel}>{label}</Text><Text style={s.macroVal}>{value}g</Text></View>
      <View style={s.macroBarBg}><View style={[s.macroBarFill, { width: pct + '%', backgroundColor: color }]} /></View>
    </View>
  );
}

export default function MealDetailScreen() {
  const { id } = useLocalSearchParams();
  const { logMeal } = useHealthStore();
  const { user } = useUserStore();
  const [portion, setPortion] = useState(1);

  const portions = [0.5, 1, 1.5, 2];
  const cal = Math.round(MEAL.calories * portion);
  const protein = Math.round(MEAL.protein * portion);
  const carbs = Math.round(MEAL.carbs * portion);
  const fat = Math.round(MEAL.fat * portion);

  const handleLog = () => {
    logMeal({
      name: MEAL.name,
      calories: cal,
      protein,
      carbs,
      fat,
      type: 'lunch',
    }, user?.uid);
    Alert.alert('Meal Logged', MEAL.name + ' (' + cal + ' cal) logged successfully!');
    router.back();
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}><Ionicons name="chevron-back" size={22} color="#000" /></Pressable>
        <Text style={s.headerTitle}>Meal Detail</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.imgArea}><Ionicons name="restaurant-outline" size={48} color="#CCC" /></View>
        <View style={s.content}>
          <Text style={s.mealName}>{MEAL.name}</Text>
          <Text style={s.calBig}>{cal} cal</Text>

          <Text style={s.sectionLabel}>Portion Size</Text>
          <View style={s.portionRow}>
            {portions.map(p => (
              <Pressable key={p} style={[s.portionPill, portion === p && s.portionActive]} onPress={() => setPortion(p)}>
                <Text style={[s.portionText, portion === p && s.portionTextActive]}>{p}x</Text>
              </Pressable>
            ))}
          </View>

          <Text style={s.sectionLabel}>Macronutrients</Text>
          <MacroBar label="Protein" value={protein} max={50} color="#4CAF50" />
          <MacroBar label="Carbs" value={carbs} max={60} color="#2196F3" />
          <MacroBar label="Fat" value={fat} max={40} color="#FF9800" />

          <Text style={s.sectionLabel}>Ingredients</Text>
          {MEAL.ingredients.map((ing, i) => (
            <View key={i} style={s.ingredientRow}>
              <View style={s.bullet} />
              <Text style={s.ingredientText}>{ing}</Text>
            </View>
          ))}

          <Text style={s.sectionLabel}>Nutrition Facts</Text>
          <View style={s.factsCard}>
            {[['Calories', cal + ''],['Total Fat', fat + 'g'],['Saturated Fat', Math.round(fat*0.3) + 'g'],['Cholesterol', Math.round(MEAL.cholesterol*portion) + 'mg'],['Sodium', Math.round(MEAL.sodium*portion) + 'mg'],['Carbs', carbs + 'g'],['Fiber', Math.round(MEAL.fiber*portion) + 'g'],['Sugar', Math.round(MEAL.sugar*portion) + 'g'],['Protein', protein + 'g']].map(([k,v],i) => (
              <View key={i} style={s.factRow}><Text style={s.factLabel}>{k}</Text><Text style={s.factVal}>{v}</Text></View>
            ))}
          </View>

          <Pressable style={s.logBtn} onPress={handleLog}><Text style={s.logBtnText}>Log This Meal</Text></Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#FFF'},
  header:{flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#F0F0F0'},
  backBtn:{width:36,height:36,justifyContent:'center',alignItems:'center'},
  headerTitle:{flex:1,textAlign:'center',fontSize:18,fontWeight:'700',color:'#000'},
  imgArea:{height:200,backgroundColor:'#F0F0F0',justifyContent:'center',alignItems:'center'},
  content:{padding:20},
  mealName:{fontSize:22,fontWeight:'800',color:'#000'},
  calBig:{fontSize:28,fontWeight:'800',color:'#4CAF50',marginTop:4,marginBottom:16},
  sectionLabel:{fontSize:14,fontWeight:'700',color:'#000',marginTop:20,marginBottom:10},
  portionRow:{flexDirection:'row',gap:8},
  portionPill:{paddingHorizontal:20,paddingVertical:10,borderRadius:20,backgroundColor:'#F0F0F0'},
  portionActive:{backgroundColor:'#000'},
  portionText:{fontSize:14,fontWeight:'700',color:'#333'},
  portionTextActive:{color:'#FFF'},
  macroItem:{marginBottom:14},
  macroLabelRow:{flexDirection:'row',justifyContent:'space-between',marginBottom:4},
  macroLabel:{fontSize:13,fontWeight:'600',color:'#333'},
  macroVal:{fontSize:13,fontWeight:'700',color:'#000'},
  macroBarBg:{height:8,borderRadius:4,backgroundColor:'#F0F0F0',overflow:'hidden'},
  macroBarFill:{height:8,borderRadius:4},
  ingredientRow:{flexDirection:'row',alignItems:'center',marginBottom:8},
  bullet:{width:6,height:6,borderRadius:3,backgroundColor:'#000',marginRight:10},
  ingredientText:{fontSize:14,color:'#333'},
  factsCard:{backgroundColor:'#F8F8F8',borderRadius:16,padding:16},
  factRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:6,borderBottomWidth:1,borderBottomColor:'#F0F0F0'},
  factLabel:{fontSize:13,color:'#666'},
  factVal:{fontSize:13,fontWeight:'600',color:'#000'},
  logBtn:{backgroundColor:'#000',height:52,borderRadius:26,justifyContent:'center',alignItems:'center',marginTop:24},
  logBtnText:{fontSize:16,fontWeight:'700',color:'#FFF'},
});
