import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert, Animated, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const COMPOSITION = [{label:'Muscle',pct:45,color:'#000'},{label:'Fat',pct:18.5,color:'#666'},{label:'Bone',pct:15,color:'#999'},{label:'Water',pct:21.5,color:'#CCC'}];
const BREAKDOWN = [{l:'Lean Mass',v:'148 lbs'},{l:'Fat Mass',v:'27 lbs'},{l:'BMI',v:'24.2'},{l:'Metabolic Rate',v:'1,850 cal/day'}];
const MEASUREMENTS = [{l:'Chest',v:'40 in'},{l:'Waist',v:'32 in'},{l:'Hips',v:'38 in'},{l:'Arms',v:'14.5 in'},{l:'Thighs',v:'23 in'},{l:'Shoulders',v:'46 in'},{l:'Neck',v:'15.5 in'},{l:'Calves',v:'15 in'}];
const CHANGES = [{l:'Body Fat',v:'\u2193 1.2%',good:true},{l:'Lean Mass',v:'\u2191 2 lbs',good:true},{l:'Waist',v:'\u2193 0.5 in',good:true}];

export default function BodyScanScreen() {
  const router = useRouter();
  const [step, setStep] = useState('intro');
  const [frontPhoto, setFrontPhoto] = useState(null);
  const [sidePhoto, setSidePhoto] = useState(null);
  const [progress, setProgress] = useState(0);
  const scanAnim = useRef(new Animated.Value(0)).current;

  const requestCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access is required for body scanning'); return false; }
    return true;
  };

  const takePhoto = async (side) => {
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [3, 4], quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) {
      if (side === 'front') { setFrontPhoto(result.assets[0].uri); setStep('side'); }
      else { setSidePhoto(result.assets[0].uri); setStep('analyzing'); }
    }
  };

  useEffect(() => {
    if (step === 'analyzing') {
      const interval = setInterval(() => setProgress(p => { if (p >= 100) { clearInterval(interval); return 100; } return p + 4; }), 120);
      Animated.loop(Animated.sequence([Animated.timing(scanAnim, { toValue: 1, duration: 1500, useNativeDriver: true }), Animated.timing(scanAnim, { toValue: 0, duration: 1500, useNativeDriver: true })])).start();
      // TODO: Replace setTimeout with real API call to body composition analysis endpoint
      const t = setTimeout(() => setStep('results'), 3000);
      return () => { clearInterval(interval); clearTimeout(t); };
    }
  }, [step]);

  // ── INTRO ──
  if (step === 'intro') return (
    <View style={s.container}>
      <View style={s.header}><Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color="#000" /></Pressable><Text style={s.headerTitle}>Body Scan</Text><Pressable><Ionicons name="help-circle-outline" size={24} color="#000" /></Pressable></View>
      <ScrollView contentContainerStyle={s.introContent}>
        <View style={s.introCircle}><Ionicons name="body-outline" size={80} color="#999" /></View>
        <Text style={s.introTitle}>Body Composition Scan</Text>
        <Text style={s.introDesc}>Take two photos (front and side view) to estimate your body composition including body fat %, muscle mass, and measurements.</Text>
        <View style={s.tipsCard}>
          <Text style={s.tipsBold}>For best results:</Text>
          {['Wear form-fitting clothes or activewear','Stand in a well-lit area','Keep arms slightly away from body','Stand 6-8 feet from camera'].map(t=>(<Text key={t} style={s.tipText}>\u2022 {t}</Text>))}
        </View>
        <Pressable style={s.startBtn} onPress={async()=>{if(await requestCamera())setStep('front');}}><Text style={s.startBtnText}>Start Scan</Text><Ionicons name="camera-outline" size={20} color="#FFF" /></Pressable>
      </ScrollView>
    </View>
  );

  // ── CAPTURE (front/side) ──
  if (step === 'front' || step === 'side') {
    const isFront = step === 'front';
    const photo = isFront ? frontPhoto : sidePhoto;
    return (
      <View style={s.container}>
        <View style={s.header}><Pressable onPress={()=>setStep('intro')}><Ionicons name="chevron-back" size={24} color="#000" /></Pressable><Text style={s.headerTitle}>{isFront?'Front View':'Side View'}</Text><View style={{width:24}} /></View>
        <View style={s.captureArea}>
          {photo ? <Image source={{uri:photo}} style={s.captureImage} /> : <View style={s.capturePlaceholder}><Ionicons name="person-outline" size={60} color="#666" /><Text style={s.captureLabel}>{isFront?'Front View':'Side View'}</Text><Text style={s.captureHint}>Align your body within the frame</Text></View>}
        </View>
        <View style={s.captureActions}>
          {photo && <Pressable style={s.retakeBtn} onPress={()=>{isFront?setFrontPhoto(null):setSidePhoto(null);}}><Text style={s.retakeBtnText}>Retake</Text></Pressable>}
          <Pressable style={s.captureBtn} onPress={()=>takePhoto(step)}><Ionicons name="camera" size={24} color="#FFF" /><Text style={s.captureBtnText}>{photo?'Next':'Capture '+( isFront?'Front':'Side')+' Photo'}</Text></Pressable>
        </View>
      </View>
    );
  }

  // ── ANALYZING ──
  if (step === 'analyzing') return (
    <View style={[s.container,{justifyContent:'center',alignItems:'center'}]}>
      <Text style={s.analyzingTitle}>Analyzing your body composition...</Text>
      <View style={s.analyzingPhotos}>
        {frontPhoto&&<Image source={{uri:frontPhoto}} style={s.analyzingThumb} />}
        {sidePhoto&&<Image source={{uri:sidePhoto}} style={s.analyzingThumb} />}
      </View>
      <View style={s.progressBarBg}><View style={[s.progressBarFill,{width:progress+'%'}]} /></View>
      <Text style={s.progressText}>{progress}%</Text>
    </View>
  );

  // ── RESULTS ──
  return (
    <View style={s.container}>
      <View style={s.header}><Pressable onPress={()=>router.back()}><Ionicons name="chevron-back" size={24} color="#000" /></Pressable><Text style={s.headerTitle}>Scan Results</Text><View style={{width:24}} /></View>
      <ScrollView contentContainerStyle={s.resultsContent}>
        <Text style={s.resultsTitle}>Your Results</Text>
        <Text style={s.resultsDate}>June 3, 2026</Text>

        {/* Body fat circle */}
        <View style={s.fatCircle}><Text style={s.fatNum}>18.5%</Text><Text style={s.fatLabel}>Body Fat</Text></View>
        <View style={s.athleticBadge}><Text style={s.athleticText}>Athletic</Text></View>

        {/* Composition */}
        <View style={s.card}>
          <View style={s.compBar}>{COMPOSITION.map(c=>(<View key={c.label} style={{width:c.pct+'%',backgroundColor:c.color,height:24}} />))}</View>
          <View style={s.legend}>{COMPOSITION.map(c=>(<View key={c.label} style={s.legendItem}><View style={[s.legendDot,{backgroundColor:c.color}]} /><Text style={s.legendText}>{c.label} {c.pct}%</Text></View>))}</View>
          {BREAKDOWN.map((b,i)=>(<View key={b.l} style={[s.breakdownRow,i===BREAKDOWN.length-1&&{borderBottomWidth:0}]}><Text style={s.breakdownLabel}>{b.l}</Text><Text style={s.breakdownVal}>{b.v}</Text></View>))}
        </View>

        {/* Measurements */}
        <View style={s.card}><Text style={s.cardTitle}>Estimated Measurements</Text>
          <View style={s.measGrid}>{MEASUREMENTS.map(m=>(<View key={m.l} style={s.measCell}><Text style={s.measLabel}>{m.l}</Text><Text style={s.measVal}>{m.v}</Text></View>))}</View>
        </View>

        {/* vs Last Scan */}
        <View style={s.card}><Text style={s.cardTitle}>vs Last Scan</Text>
          {CHANGES.map(c=>(<View key={c.l} style={s.changeRow}><Text style={s.changeLabel}>{c.l}</Text><Text style={[s.changeVal,{color:'#22C55E'}]}>{c.v}</Text></View>))}
        </View>

        {/* Photos */}
        <View style={s.photosRow}>
          {frontPhoto&&<Image source={{uri:frontPhoto}} style={s.photoThumb} />}
          {sidePhoto&&<Image source={{uri:sidePhoto}} style={s.photoThumb} />}
        </View>

        {/* Actions */}
        <Pressable style={s.saveBtn} onPress={()=>{Alert.alert('Saved','Results saved to your progress.');}}><Text style={s.saveBtnText}>Save Results</Text></Pressable>
        <Pressable style={s.scanAgainBtn} onPress={()=>{setStep('intro');setFrontPhoto(null);setSidePhoto(null);setProgress(0);}}><Text style={s.scanAgainText}>Scan Again</Text></Pressable>
        <Pressable><Text style={s.shareLink}>Share Results</Text></Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container:{flex:1,backgroundColor:'#FFFFFF'},
  header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:20,paddingTop:Platform.OS==='ios'?50:40,marginBottom:16},
  headerTitle:{fontSize:18,fontWeight:'700',color:'#000'},

  /* Intro */
  introContent:{alignItems:'center',paddingHorizontal:20,paddingBottom:40},
  introCircle:{width:200,height:200,borderRadius:100,backgroundColor:'#F0F0F0',justifyContent:'center',alignItems:'center',marginTop:20},
  introTitle:{fontSize:24,fontWeight:'800',color:'#000',textAlign:'center',marginTop:20},
  introDesc:{fontSize:14,color:'#666',textAlign:'center',lineHeight:22,paddingHorizontal:10,marginTop:10},
  tipsCard:{backgroundColor:'#F5F5F5',borderRadius:14,padding:16,width:'100%',marginTop:20},
  tipsBold:{fontSize:14,fontWeight:'700',color:'#000',marginBottom:6},
  tipText:{fontSize:13,color:'#444',marginTop:4},
  startBtn:{backgroundColor:'#000',height:52,borderRadius:26,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:8,width:'100%',marginTop:24},
  startBtnText:{fontSize:16,fontWeight:'700',color:'#FFF'},

  /* Capture */
  captureArea:{flex:1,marginHorizontal:20,borderRadius:16,overflow:'hidden',backgroundColor:'#1A1A1A'},
  captureImage:{flex:1,width:'100%'},
  capturePlaceholder:{flex:1,justifyContent:'center',alignItems:'center'},
  captureLabel:{fontSize:18,fontWeight:'700',color:'#FFF',marginTop:12},
  captureHint:{fontSize:13,color:'#999',marginTop:4},
  captureActions:{paddingHorizontal:20,paddingVertical:16,gap:10},
  captureBtn:{backgroundColor:'#000',height:52,borderRadius:26,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:8},
  captureBtnText:{fontSize:16,fontWeight:'700',color:'#FFF'},
  retakeBtn:{borderWidth:1,borderColor:'#E5E5E5',height:44,borderRadius:22,justifyContent:'center',alignItems:'center'},
  retakeBtnText:{fontSize:14,fontWeight:'600',color:'#000'},

  /* Analyzing */
  analyzingTitle:{fontSize:18,fontWeight:'700',color:'#000',marginBottom:20},
  analyzingPhotos:{flexDirection:'row',gap:12,marginBottom:20},
  analyzingThumb:{width:120,height:160,borderRadius:12},
  progressBarBg:{width:'60%',height:6,borderRadius:3,backgroundColor:'#E5E5E5',overflow:'hidden'},
  progressBarFill:{height:6,borderRadius:3,backgroundColor:'#000'},
  progressText:{fontSize:14,fontWeight:'700',color:'#000',marginTop:8},

  /* Results */
  resultsContent:{alignItems:'center',paddingBottom:40},
  resultsTitle:{fontSize:24,fontWeight:'800',color:'#000',marginTop:8},
  resultsDate:{fontSize:13,color:'#999',marginTop:4,marginBottom:20},
  fatCircle:{width:160,height:160,borderRadius:80,borderWidth:8,borderColor:'#E5E5E5',justifyContent:'center',alignItems:'center'},
  fatNum:{fontSize:36,fontWeight:'800',color:'#000'},
  fatLabel:{fontSize:14,color:'#666'},
  athleticBadge:{backgroundColor:'#22C55E',paddingHorizontal:14,paddingVertical:6,borderRadius:12,marginTop:10,marginBottom:24},
  athleticText:{fontSize:13,fontWeight:'700',color:'#FFF'},

  /* Card */
  card:{backgroundColor:'#FFF',borderRadius:16,padding:20,marginHorizontal:20,marginBottom:16,width:'100%',paddingHorizontal:20,...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}}})},
  cardTitle:{fontSize:16,fontWeight:'700',color:'#000',marginBottom:12},
  compBar:{height:24,borderRadius:12,flexDirection:'row',overflow:'hidden',marginBottom:12},
  legend:{flexDirection:'row',flexWrap:'wrap',gap:12,marginBottom:12},
  legendItem:{flexDirection:'row',alignItems:'center',gap:4},
  legendDot:{width:10,height:10,borderRadius:5},
  legendText:{fontSize:12,color:'#333'},
  breakdownRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#F0F0F0'},
  breakdownLabel:{fontSize:14,color:'#666'},
  breakdownVal:{fontSize:14,fontWeight:'700',color:'#000'},
  measGrid:{flexDirection:'row',flexWrap:'wrap'},
  measCell:{width:'50%',paddingVertical:8},
  measLabel:{fontSize:12,color:'#999'},
  measVal:{fontSize:18,fontWeight:'700',color:'#000',marginTop:2},
  changeRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:8},
  changeLabel:{fontSize:14,color:'#666'},
  changeVal:{fontSize:14,fontWeight:'700'},
  photosRow:{flexDirection:'row',gap:12,marginVertical:16},
  photoThumb:{width:100,height:133,borderRadius:10},
  saveBtn:{backgroundColor:'#000',height:52,borderRadius:26,justifyContent:'center',alignItems:'center',width:'80%',marginBottom:12},
  saveBtnText:{fontSize:16,fontWeight:'700',color:'#FFF'},
  scanAgainBtn:{borderWidth:1,borderColor:'#E5E5E5',height:48,borderRadius:24,justifyContent:'center',alignItems:'center',width:'80%',marginBottom:12},
  scanAgainText:{fontSize:14,fontWeight:'600',color:'#000'},
  shareLink:{fontSize:14,fontWeight:'600',color:'#000',marginBottom:20},
});
