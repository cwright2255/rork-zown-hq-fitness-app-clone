import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const CATS = ['All','High Protein','Low Carb','Vegan','Quick Meals','Post-Workout'];

const POST_WORKOUT = [
  {id:'pw1',name:'Protein Smoothie',cal:'180 cal',time:'5 min'},
  {id:'pw2',name:'Chicken & Rice',cal:'520 cal',time:'30 min'},
  {id:'pw3',name:'Greek Yogurt Bowl',cal:'280 cal',time:'5 min'},
  {id:'pw4',name:'Tuna Wrap',cal:'350 cal',time:'10 min'},
  {id:'pw5',name:'Egg White Omelette',cal:'220 cal',time:'15 min'},
];
const MEAL_PREP = [
  {id:'mp1',name:'Weekly Chicken Prep',cal:'',time:'2h'},
  {id:'mp2',name:'Overnight Oats x5',cal:'',time:'15 min'},
  {id:'mp3',name:'Veggie Stir Fry Batch',cal:'',time:'45 min'},
  {id:'mp4',name:'Turkey Meatballs',cal:'',time:'1h'},
  {id:'mp5',name:'Quinoa Salad Jars',cal:'',time:'30 min'},
];
const QUICK = [
  {id:'q1',name:'Avocado Toast',cal:'',time:'10 min'},
  {id:'q2',name:'Banana Pancakes',cal:'',time:'15 min'},
  {id:'q3',name:'Caprese Salad',cal:'',time:'5 min'},
  {id:'q4',name:'Shrimp Tacos',cal:'',time:'20 min'},
  {id:'q5',name:'Smoothie Bowl',cal:'',time:'10 min'},
];

function SectionHeader({title,onViewAll}){
  return <View style={s.sectionHeader}><Text style={s.sectionTitle}>{title}</Text><Pressable onPress={onViewAll}><Text style={s.viewAll}>View All</Text></Pressable></View>;
}

function RecipeCard({item}){
  return (
    <Pressable style={s.recipeCard}>
      <View style={s.recipeImage}><Ionicons name="restaurant-outline" size={28} color="#999" /></View>
      <Text style={s.recipeName} numberOfLines={1}>{item.name}</Text>
      <Text style={s.recipeMeta}>{item.cal?item.cal+' \u2022 ':''}{item.time}</Text>
    </Pressable>
  );
}

export default function RecipesScreen(){
  const [cat,setCat]=useState('All');
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.logoRow}><Image source={require('@/assets/branding/zown-logo-512.png')} style={s.logo} resizeMode="contain" /></View>
        <View style={s.headerRow}><Text style={s.pageTitle}>Recipes</Text><Pressable><Ionicons name="search-outline" size={22} color="#000" /></Pressable></View>

        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catScroll}>
          {CATS.map(c=>(<Pressable key={c} style={[s.catPill,cat===c&&s.catPillActive]} onPress={()=>setCat(c)}><Text style={[s.catPillText,cat===c&&s.catPillTextActive]}>{c}</Text></Pressable>))}
        </ScrollView>

        {/* Featured */}
        <Pressable style={s.featuredCard}>
          <View style={s.featuredImage}><Ionicons name="restaurant" size={48} color="#999" /></View>
          <View style={s.featuredOverlay}><Text style={s.featuredName}>Grilled Chicken Power Bowl</Text><Text style={s.featuredMeta}>High Protein \u2022 450 cal \u2022 25 min</Text></View>
        </Pressable>

        {/* Carousels */}
        <SectionHeader title="Post-Workout Meals" onViewAll={()=>{}} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>{POST_WORKOUT.map(i=><RecipeCard key={i.id} item={i} />)}</ScrollView>

        <SectionHeader title="Meal Prep Ideas" onViewAll={()=>{}} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>{MEAL_PREP.map(i=><RecipeCard key={i.id} item={i} />)}</ScrollView>

        <SectionHeader title="Quick & Healthy" onViewAll={()=>{}} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>{QUICK.map(i=><RecipeCard key={i.id} item={i} />)}</ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#FFFFFF'}, scroll:{flex:1}, scrollContent:{paddingBottom:100},
  logoRow:{alignItems:'center',marginTop:8,marginBottom:12}, logo:{width:120,height:36},
  headerRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:20,marginBottom:16},
  pageTitle:{fontSize:24,fontWeight:'800',color:'#000'},
  catScroll:{paddingLeft:20,paddingRight:6,marginBottom:20},
  catPill:{backgroundColor:'#F0F0F0',paddingHorizontal:16,paddingVertical:8,borderRadius:16,marginRight:8},
  catPillActive:{backgroundColor:'#000'},
  catPillText:{fontSize:13,fontWeight:'700',color:'#333'},
  catPillTextActive:{color:'#FFF'},
  featuredCard:{marginHorizontal:20,borderRadius:16,overflow:'hidden',marginBottom:24,height:200,position:'relative'},
  featuredImage:{flex:1,backgroundColor:'#E8E8E8',justifyContent:'center',alignItems:'center'},
  featuredOverlay:{position:'absolute',bottom:0,left:0,right:0,padding:16,backgroundColor:'rgba(0,0,0,0.6)'},
  featuredName:{fontSize:18,fontWeight:'800',color:'#FFF'},
  featuredMeta:{fontSize:13,color:'rgba(255,255,255,0.8)',marginTop:4},
  sectionHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:20,marginBottom:12},
  sectionTitle:{fontSize:18,fontWeight:'700',color:'#000'},
  viewAll:{fontSize:13,fontWeight:'600',color:'#666'},
  carousel:{paddingLeft:20,paddingRight:6,marginBottom:24},
  recipeCard:{width:160,marginRight:14},
  recipeImage:{height:120,borderRadius:14,backgroundColor:'#F0F0F0',justifyContent:'center',alignItems:'center'},
  recipeName:{fontSize:14,fontWeight:'600',color:'#000',marginTop:8},
  recipeMeta:{fontSize:12,color:'#999',marginTop:2},
});
