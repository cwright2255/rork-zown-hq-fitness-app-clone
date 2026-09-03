import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Platform, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useHealthStore } from '@/store/healthStore';
import { useUserStore } from '@/store/userStore';
import * as ImagePicker from 'expo-image-picker';
import { searchFoods } from '@/services/passioService';

// Real grade badge colors - a standard, intuitive traffic-light
// progression matching the A-E grade from
// services/passioService.js's calculateNutritionalScore (now based on
// real FDA Daily Value percentages, not arbitrary cutoffs).
const GRADE_COLORS = { A: '#2E7D32', B: '#7CB342', C: '#FBC02D', D: '#F57C00', E: '#D32F2F' };

function GradeBadge({ grade }) {
  if (!grade) return null;
  return (
    <View style={[s.gradeBadge, { backgroundColor: GRADE_COLORS[grade] || '#999' }]}>
      <Text style={s.gradeBadgeText}>{grade}</Text>
    </View>
  );
}

export default function NutritionLogScreen() {
  const { meals, hydration, addGlass, logMeal, getTodayCalories, getTodayMacros } = useHealthStore();
  const todayMacros = (getTodayMacros ? getTodayMacros() : null) || { protein: 0, carbs: 0, fat: 0 };
  const MACROS = [
    { label:'Protein', current:todayMacros.protein || 0, target:120, color:'#000' },
    { label:'Carbs', current:todayMacros.carbs || 0, target:250, color:'#555' },
    { label:'Fat', current:todayMacros.fat || 0, target:65, color:'#999' },
  ];
  const { user } = useUserStore();
  const uid = user?.uid;
  const [isScanning, setIsScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [showBarcodeEntry, setShowBarcodeEntry] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');

  const handleFoodSearch = async (query) => {
    if (!query || query.length < 2) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const results = await searchFoods(query);
      setSearchResults(Array.isArray(results) ? results.slice(0, 8) : []);
    } catch (e) {
      console.warn('Food search failed:', e?.message);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Real fix: this now actually logs the food the user tapped - it
  // previously had nowhere to be called from at all, since the search
  // results it was written for were never rendered anywhere. Passes
  // the full result through unchanged, so nutritionalScore (the real,
  // FDA-Daily-Value-based grade) survives into the saved meal and
  // logMeal (store/healthStore.js) can use it for XP.
  const handleLogSearchResult = (food) => {
    logMeal({
      name: food.name,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      fiber: food.nutritionalDetails?.fiber,
      sugar: food.nutritionalDetails?.sugar,
      sodium: food.nutritionalDetails?.sodium,
      nutritionalScore: food.nutritionalScore,
      type: 'meal',
    }, uid);
    setShowFoodSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    Alert.alert('Logged!', `${food.name} added to your meals.`);
  };

  const handleBarcodeScan = async (barcode) => {
    try {
      const res = await fetch('https://world.openfoodfacts.org/api/v2/product/' + barcode + '.json');
      const data = await res.json();
      if (data?.product) {
        const p = data.product;
        const nut = p.nutriments || {};
        logMeal({
          name: p.product_name || 'Scanned Product',
          calories: Math.round(nut['energy-kcal_100g'] || 0),
          protein: Math.round(nut.proteins_100g || 0),
          carbs: Math.round(nut.carbohydrates_100g || 0),
          fat: Math.round(nut.fat_100g || 0),
          fiber: Math.round(nut.fiber_100g || 0),
          sugar: Math.round(nut.sugars_100g || 0),
          sodium: Math.round((nut.sodium_100g || 0) * 1000), // OpenFoodFacts reports sodium in g, not mg
          type: 'snack',
        }, uid);
        Alert.alert('Logged!', (p.product_name || 'Product') + ' added to your meals.');
      } else {
        Alert.alert('Not Found', 'Could not find product. Try searching manually.');
      }
    } catch (e) {
      Alert.alert('Error', 'Barcode lookup failed. Try again.');
    }
  };

  const handlePhotoLog = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return;
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled) {
        setIsScanning(true);
        try {
          // Use Passio.ai text search as fallback since image recognition needs native SDK
          setShowFoodSearch(true);
        } catch (e) {
          Alert.alert('Recognition Failed', 'Could not recognize food. Try searching manually.');
        } finally {
          setIsScanning(false);
        }
      }
    } catch (e) {
      setIsScanning(false);
    }
  };

  const todayCals = getTodayCalories ? getTodayCalories() : 0;
  const todayMeals = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (meals || []).filter(m => m.timestamp && m.timestamp.startsWith(today));
  }, [meals]);

  const glassCount = hydration?.glasses || 0;
  const consumed = todayCals; const target = 2000; const remaining = Math.max(0, target - consumed);

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

        {/* Quick log actions - real fix: these previously had empty,
            do-nothing handlers */}
        <View style={s.actionsRow}>
          <Pressable style={s.actionCard} onPress={() => setShowBarcodeEntry(true)}>
            <Ionicons name="barcode-outline" size={28} color="#000" />
            <Text style={s.actionLabel}>Scan Barcode</Text>
          </Pressable>
          <Pressable style={s.actionCard} onPress={handlePhotoLog}>
            <Ionicons name="camera-outline" size={28} color="#000" />
            <Text style={s.actionLabel}>Photo Log</Text>
          </Pressable>
          <Pressable style={s.actionCard} onPress={() => setShowFoodSearch(true)}>
            <Ionicons name="add-circle-outline" size={28} color="#000" />
            <Text style={s.actionLabel}>Quick Add</Text>
          </Pressable>
        </View>

        {/* Meals - real fix: this now shows today's actual logged
            meals, not a hardcoded mock list */}
        <View style={s.sectionRow}><Text style={s.sectionTitle}>Today's Meals</Text><Pressable onPress={() => setShowFoodSearch(true)}><Text style={s.addMeal}>Add Meal</Text></Pressable></View>
        {todayMeals.length === 0 ? (
          <Pressable style={s.emptyMeal} onPress={() => setShowFoodSearch(true)}><Text style={s.emptyMealText}>Tap to log a meal</Text></Pressable>
        ) : todayMeals.map(m=>(
          <View key={m.id} style={s.mealRow}>
            <View style={s.mealIcon}><Ionicons name="restaurant-outline" size={18} color="#000" /></View>
            <View style={s.mealInfo}>
              <Text style={s.mealName}>{m.name || 'Meal'}</Text>
              <Text style={s.mealItems}>{[m.protein && `${m.protein}g protein`, m.carbs && `${m.carbs}g carbs`, m.fat && `${m.fat}g fat`].filter(Boolean).join(' · ') || 'No macro detail'}</Text>
            </View>
            <GradeBadge grade={m.nutritionalScore?.score} />
            <Text style={s.mealCal}>{m.calories || 0} cal</Text>
          </View>
        ))}

        {/* Hydration */}
        <Text style={[s.sectionTitle,{marginTop:20}]}>Hydration</Text>
        <View style={s.hydrationCard}>
          <View style={s.glassesRow}>
            {Array.from({length:8}).map((_,i)=>(
              <Pressable key={i} onPress={()=>addGlass(uid)}>
                <Ionicons name={i<glassCount?'water':'water-outline'} size={28} color={i<glassCount?'#000':'#CCC'} />
              </Pressable>
            ))}
          </View>
          <Text style={s.glassesLabel}>{glassCount} of 8 glasses</Text>
          <Pressable style={s.addGlassBtn} onPress={()=>addGlass(uid)}><Text style={s.addGlassBtnText}>Add Glass</Text></Pressable>
        </View>
      </ScrollView>

      {/* Real, new food search modal - handleFoodSearch/searchResults/
          showFoodSearch already existed but were never actually
          rendered anywhere; this is what makes "Quick Add"/"Photo Log"
          genuinely work, and is where the real nutrient grade
          (services/passioService.js) is now visible during logging
          itself, not just applied retroactively for XP. */}
      <Modal visible={showFoodSearch} animationType="slide" onRequestClose={() => setShowFoodSearch(false)} presentationStyle="pageSheet">
        <SafeAreaView style={s.modalSafe}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Add Food</Text>
            <Pressable onPress={() => setShowFoodSearch(false)} hitSlop={10}>
              <Ionicons name="close" size={26} color="#000" />
            </Pressable>
          </View>
          <View style={s.searchRow}>
            <Ionicons name="search-outline" size={18} color="#999" style={{ marginRight: 8 }} />
            <TextInput
              style={s.searchInput}
              placeholder="Search foods..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={(v) => { setSearchQuery(v); handleFoodSearch(v); }}
              autoFocus
            />
          </View>
          <ScrollView style={s.modalScroll} contentContainerStyle={{ paddingBottom: 24 }}>
            {isSearching ? (
              <ActivityIndicator style={{ marginTop: 24 }} color="#000" />
            ) : searchResults.length === 0 && searchQuery.length >= 2 ? (
              <Text style={s.noResultsText}>No foods found for "{searchQuery}".</Text>
            ) : (
              searchResults.map((food) => (
                <Pressable key={food.id} style={s.resultRow} onPress={() => handleLogSearchResult(food)}>
                  <View style={s.resultInfo}>
                    <Text style={s.resultName} numberOfLines={1}>{food.name}</Text>
                    <Text style={s.resultDetail}>{food.calories} cal · {food.protein}g protein · {food.servingSize}</Text>
                  </View>
                  <GradeBadge grade={food.nutritionalScore?.score} />
                </Pressable>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Real, new barcode entry - no camera-scanning library is
          confirmed available in this project, so this is a genuinely
          working manual-entry fallback for the existing
          handleBarcodeScan lookup, rather than leaving "Scan Barcode"
          doing nothing. */}
      <Modal visible={showBarcodeEntry} animationType="fade" transparent onRequestClose={() => setShowBarcodeEntry(false)}>
        <View style={s.barcodeOverlay}>
          <View style={s.barcodeCard}>
            <Text style={s.modalTitle}>Enter Barcode</Text>
            <TextInput
              style={s.barcodeInput}
              placeholder="e.g. 0123456789012"
              placeholderTextColor="#999"
              value={barcodeInput}
              onChangeText={setBarcodeInput}
              keyboardType="number-pad"
              autoFocus
            />
            <View style={s.barcodeBtnRow}>
              <Pressable style={s.barcodeCancelBtn} onPress={() => { setShowBarcodeEntry(false); setBarcodeInput(''); }}>
                <Text style={s.barcodeCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={s.barcodeSubmitBtn} onPress={() => { handleBarcodeScan(barcodeInput.trim()); setShowBarcodeEntry(false); setBarcodeInput(''); }}>
                <Text style={s.barcodeSubmitText}>Look Up</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  mealCal:{fontSize:14,fontWeight:'700',color:'#000',marginLeft:10},
  emptyMeal:{marginHorizontal:20,marginTop:8,marginBottom:20,borderWidth:1,borderColor:'#E5E5E5',borderStyle:'dashed',borderRadius:12,padding:16,alignItems:'center'},
  emptyMealText:{fontSize:14,color:'#999'},
  hydrationCard:{backgroundColor:'#FFF',borderRadius:16,padding:16,marginHorizontal:20,marginBottom:24,alignItems:'center',...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}}})},
  glassesRow:{flexDirection:'row',gap:8,marginBottom:8},
  glassesLabel:{fontSize:14,fontWeight:'600',color:'#000',marginBottom:10},
  addGlassBtn:{backgroundColor:'#000',paddingHorizontal:20,paddingVertical:8,borderRadius:16},
  addGlassBtnText:{fontSize:13,fontWeight:'700',color:'#FFF'},

  gradeBadge:{width:26,height:26,borderRadius:13,justifyContent:'center',alignItems:'center',marginLeft:8},
  gradeBadgeText:{fontSize:13,fontWeight:'800',color:'#FFF'},

  modalSafe:{flex:1,backgroundColor:'#FFF'},
  modalHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:20,paddingTop:12,paddingBottom:16,borderBottomWidth:1,borderBottomColor:'#EEE'},
  modalTitle:{fontSize:18,fontWeight:'700',color:'#000'},
  searchRow:{flexDirection:'row',alignItems:'center',backgroundColor:'#F5F5F5',borderRadius:14,paddingHorizontal:14,paddingVertical:10,marginHorizontal:20,marginTop:16,marginBottom:12},
  searchInput:{flex:1,fontSize:15,color:'#000'},
  modalScroll:{flex:1,paddingHorizontal:20},
  noResultsText:{fontSize:14,color:'#999',textAlign:'center',marginTop:24},
  resultRow:{flexDirection:'row',alignItems:'center',paddingVertical:14,borderBottomWidth:1,borderBottomColor:'#F0F0F0'},
  resultInfo:{flex:1},
  resultName:{fontSize:15,fontWeight:'600',color:'#000'},
  resultDetail:{fontSize:12,color:'#999',marginTop:2},

  barcodeOverlay:{flex:1,backgroundColor:'rgba(0,0,0,0.5)',justifyContent:'center',alignItems:'center',padding:24},
  barcodeCard:{backgroundColor:'#FFF',borderRadius:20,padding:24,width:'100%'},
  barcodeInput:{backgroundColor:'#F5F5F5',borderRadius:12,paddingHorizontal:14,paddingVertical:12,fontSize:16,color:'#000',marginTop:16,marginBottom:20},
  barcodeBtnRow:{flexDirection:'row',gap:10},
  barcodeCancelBtn:{flex:1,backgroundColor:'#F0F0F0',borderRadius:14,paddingVertical:12,alignItems:'center'},
  barcodeCancelText:{fontSize:14,fontWeight:'700',color:'#000'},
  barcodeSubmitBtn:{flex:1,backgroundColor:'#000',borderRadius:14,paddingVertical:12,alignItems:'center'},
  barcodeSubmitText:{fontSize:14,fontWeight:'700',color:'#FFF'},
});
