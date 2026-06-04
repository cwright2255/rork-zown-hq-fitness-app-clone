import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

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

const PRODUCTS = [
  { id: '1', name: 'Performance Tee', icon: 'shirt-outline' },
  { id: '2', name: 'Training Shorts', icon: 'cut-outline' },
  { id: '3', name: 'Compression Top', icon: 'shirt-outline' },
  { id: '4', name: 'Running Jacket', icon: 'shirt-outline' },
];

export default function TryOnScreen() {
  const [photo, setPhoto] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState('1');

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed for Digital Try-On.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}><Ionicons name="chevron-back" size={22} color="#000" /></Pressable>
        <Text style={s.headerTitle}>Digital Try-On</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Camera / Photo Area */}
      <View style={s.cameraArea}>
        {photo ? (
          <View style={s.photoOverlay}>
            <Ionicons name="person" size={80} color="rgba(255,255,255,0.3)" />
            <View style={s.overlayBadge}><Text style={s.overlayText}>AR Preview</Text></View>
          </View>
        ) : (
          <View style={s.cameraPlaceholder}>
            <Ionicons name="body-outline" size={60} color="#666" />
            <Text style={s.cameraText}>Take a photo to start</Text>
          </View>
        )}
      </View>

      <Pressable style={s.takePhotoBtn} onPress={takePhoto}>
        <Ionicons name={photo ? 'camera-reverse-outline' : 'camera-outline'} size={20} color="#FFF" />
        <Text style={s.takePhotoText}>{photo ? 'Retake Photo' : 'Take Photo'}</Text>
      </Pressable>

      {/* Product Carousel */}
      <Text style={s.sectionLabel}>Select Product</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 6 }}>
        {PRODUCTS.map(p => (
          <Pressable key={p.id} style={[s.productCard, selectedProduct === p.id && s.productSelected]} onPress={() => setSelectedProduct(p.id)}>
            <Ionicons name={p.icon} size={24} color={selectedProduct === p.id ? '#FFF' : '#333'} />
            <Text style={[s.productName, selectedProduct === p.id && { color: '#FFF' }]}>{p.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Action Buttons */}
      {photo && (
        <View style={s.actions}>
          <Pressable style={s.saveBtn} onPress={() => Alert.alert('Saved!', 'Your look has been saved.')}><Ionicons name="bookmark-outline" size={18} color="#FFF" /><Text style={s.saveBtnText}>Save Look</Text></Pressable>
          <Pressable style={s.shareBtn} onPress={() => Alert.alert('Share', 'Sharing coming soon!')}><Ionicons name="share-outline" size={18} color="#000" /><Text style={s.shareBtnText}>Share</Text></Pressable>
        </View>
      )}
      {/* TODO: Implement actual AR overlay using camera feed + product 3D model */}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#FFF'},
  header:{flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#F0F0F0'},
  backBtn:{width:36,height:36,justifyContent:'center',alignItems:'center'},
  headerTitle:{flex:1,textAlign:'center',fontSize:18,fontWeight:'700',color:'#000'},
  cameraArea:{height:350,backgroundColor:'#1A1A1A',justifyContent:'center',alignItems:'center'},
  cameraPlaceholder:{alignItems:'center'},
  cameraText:{fontSize:14,color:'#999',marginTop:12},
  photoOverlay:{flex:1,justifyContent:'center',alignItems:'center',width:'100%'},
  overlayBadge:{position:'absolute',top:16,right:16,backgroundColor:'rgba(0,0,0,0.6)',paddingHorizontal:12,paddingVertical:6,borderRadius:12},
  overlayText:{fontSize:11,fontWeight:'700',color:'#FFF'},
  takePhotoBtn:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#000',height:48,borderRadius:24,marginHorizontal:20,marginVertical:12},
  takePhotoText:{fontSize:15,fontWeight:'700',color:'#FFF'},
  sectionLabel:{fontSize:14,fontWeight:'700',color:'#000',paddingHorizontal:20,marginBottom:10},
  productCard:{width:120,backgroundColor:'#F0F0F0',borderRadius:14,padding:14,alignItems:'center',marginRight:10},
  productSelected:{backgroundColor:'#000'},
  productName:{fontSize:12,fontWeight:'600',color:'#333',marginTop:6,textAlign:'center'},
  actions:{flexDirection:'row',gap:10,paddingHorizontal:20,marginTop:16},
  saveBtn:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,backgroundColor:'#000',height:44,borderRadius:22},
  saveBtnText:{fontSize:14,fontWeight:'700',color:'#FFF'},
  shareBtn:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,borderWidth:2,borderColor:'#000',height:44,borderRadius:22},
  shareBtnText:{fontSize:14,fontWeight:'700',color:'#000'},
});
