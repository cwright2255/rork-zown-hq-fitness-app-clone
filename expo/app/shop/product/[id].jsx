import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

const SIZES = ['XS','S','M','L','XL'];
const COLORS = [{name:'Black',hex:'#000'},{name:'White',hex:'#FFF',border:true},{name:'Gray',hex:'#999'},{name:'Navy',hex:'#1A1A5E'}];

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const [selectedSize, setSelectedSize] = useState('M');
  const [selectedColor, setSelectedColor] = useState('Black');

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}><Ionicons name="chevron-back" size={22} color="#000" /></Pressable>
        <View style={{ flex: 1 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.imgArea}><Ionicons name="shirt-outline" size={60} color="#CCC" /></View>
        <View style={s.content}>
          <Text style={s.brand}>ZOWN ATHLETICS</Text>
          <Text style={s.name}>Performance Training Tee</Text>
          <Text style={s.price}>$45.00</Text>
          <Text style={s.soon}>Coming soon. This is a sample item: the Shop is not open yet.</Text>

          <Text style={s.sectionLabel}>Size</Text>
          <View style={s.pills}>
            {SIZES.map(sz => (
              <Pressable key={sz} style={[s.pill, selectedSize === sz && s.pillActive]} onPress={() => setSelectedSize(sz)}>
                <Text style={[s.pillText, selectedSize === sz && s.pillTextActive]}>{sz}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={s.sectionLabel}>Color</Text>
          <View style={s.colorRow}>
            {COLORS.map(c => (
              <Pressable key={c.name} style={[s.colorCircle, {backgroundColor:c.hex}, c.border && {borderWidth:1,borderColor:'#E0E0E0'}, selectedColor === c.name && s.colorSelected]} onPress={() => setSelectedColor(c.name)} />
            ))}
          </View>

          <Pressable style={[s.addCartBtn, s.addCartOff]} disabled accessibilityState={{ disabled: true }}><Text style={s.addCartText}>Add to Cart</Text></Pressable>
          <Pressable style={s.tryOnBtn} onPress={() => router.push('/shop/try-on')}><Text style={s.tryOnText}>Digital Try-On</Text></Pressable>

          <Text style={s.sectionLabel}>Description</Text>
          <Text style={s.desc}>Premium moisture-wicking training tee engineered for high-intensity workouts. Features 4-way stretch fabric, flatlock seams, and anti-odor technology.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#FFF'},
  header:{flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:8},
  backBtn:{width:36,height:36,justifyContent:'center',alignItems:'center'},
  imgArea:{height:300,backgroundColor:'#F0F0F0',justifyContent:'center',alignItems:'center'},
  content:{padding:20},
  brand:{fontSize:12,color:'#999',textTransform:'uppercase',letterSpacing:1,marginBottom:4},
  name:{fontSize:22,fontWeight:'800',color:'#000',marginBottom:4},
  price:{fontSize:20,fontWeight:'700',color:'#000',marginBottom:8},
  soon:{fontSize:13,color:'#666',marginBottom:12},
  sectionLabel:{fontSize:14,fontWeight:'700',color:'#000',marginTop:20,marginBottom:10},
  pills:{flexDirection:'row',gap:8},
  pill:{width:44,height:44,borderRadius:22,backgroundColor:'#F0F0F0',justifyContent:'center',alignItems:'center'},
  pillActive:{backgroundColor:'#000'},
  pillText:{fontSize:14,fontWeight:'700',color:'#333'},
  pillTextActive:{color:'#FFF'},
  colorRow:{flexDirection:'row',gap:12},
  colorCircle:{width:36,height:36,borderRadius:18},
  colorSelected:{borderWidth:3,borderColor:'#000'},
  addCartBtn:{backgroundColor:'#000',height:52,borderRadius:26,justifyContent:'center',alignItems:'center',marginTop:24},
  addCartOff:{backgroundColor:'#BDBDBD'},
  addCartText:{fontSize:16,fontWeight:'700',color:'#FFF'},
  tryOnBtn:{borderWidth:2,borderColor:'#000',height:52,borderRadius:26,justifyContent:'center',alignItems:'center',marginTop:10},
  tryOnText:{fontSize:16,fontWeight:'700',color:'#000'},
  desc:{fontSize:14,color:'#666',lineHeight:22},
});
