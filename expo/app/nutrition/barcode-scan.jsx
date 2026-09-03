import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { ScanLine } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';

export default function BarcodeScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const cameraRef = useRef(null);
  // Real fix for a real race condition: the camera's onBarcodeScanned
  // fires repeatedly while a barcode is in frame, not once, and
  // isScanning is React state - it doesn't update synchronously, so the
  // camera can (and did) detect the same barcode a second time in the
  // brief gap before the state catches up, firing a second concurrent
  // lookup. One call succeeding and rendering a real result while
  // another duplicate call independently fails is exactly what produced
  // a "Lookup Failed" alert stacked on top of an already-successful
  // result. A ref updates immediately, with no re-render delay, so it
  // closes that gap.
  const isProcessingRef = useRef(false);

  const lookupBarcode = useCallback(async (barcode) => {
    setIsLookingUp(true);
    setIsScanning(false);
    try {
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('@/src/config/firebase');
      const fn = httpsCallable(functions, 'lookupCalorieApiBarcode');
      const result = await fn({ barcode });
      const data = result.data;

      if (!data?.found) {
        Alert.alert('Product Not Found', 'This barcode is not in our database.', [
          { text: 'Try Again', onPress: () => setIsScanning(true) },
          { text: 'Manual Entry', onPress: () => router.push('/nutrition/search') },
        ]);
        return;
      }

      const n = data.nutrition_per_100g || {};
      setScanResult({
        name: data.product?.name || 'Unknown Product',
        brand: data.product?.brand || undefined,
        calories: Math.round(n.energy_kcal || 0),
        protein: Math.round((n.protein_g || 0) * 10) / 10,
        carbs: Math.round((n.carbohydrates_g || 0) * 10) / 10,
        fat: Math.round((n.fat_g || 0) * 10) / 10,
        servingSize: data.serving?.label || '100g',
        barcode: data.barcode || barcode,
      });
    } catch (e) {
      Alert.alert('Lookup Failed', 'Please check connection and try again.', [
        { text: 'Try Again', onPress: () => setIsScanning(true) },
      ]);
    } finally {
      setIsLookingUp(false);
      isProcessingRef.current = false;
    }
  }, []);

  const handleBarcodeScanned = useCallback(({ data }) => {
    if (!isScanning || isProcessingRef.current) return;
    isProcessingRef.current = true;
    lookupBarcode(data);
  }, [isScanning, lookupBarcode]);

  const addToMeal = () => {
    if (!scanResult) return;
    router.push({
      pathname: '/nutrition/search',
      params: { scannedFood: JSON.stringify(scanResult) },
    });
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Scan Barcode" showBack />
        <View style={styles.center}><ActivityIndicator color="#000000" /></View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Scan Barcode" showBack />
        <View style={styles.permWrap}>
          <ScanLine size={64} color="#666666" />
          <Text style={styles.permTitle}>Camera Permission Required</Text>
          <Text style={styles.permText}>
            We need camera access to scan barcodes on food packages.
          </Text>
          <PrimaryButton title="Grant Permission" onPress={requestPermission} />
        </View>
      </SafeAreaView>
    );
  }

  if (scanResult) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Product Found" showBack />
        <View style={{ padding: 16 }}>
          <View style={styles.resultCard}>
            <Text style={styles.productName}>{scanResult.name}</Text>
            {scanResult.brand ? <Text style={styles.brandName}>{scanResult.brand}</Text> : null}
            <Text style={styles.barcodeText}>Barcode: {scanResult.barcode}</Text>
            <View style={styles.divider} />
            <View style={styles.nutritionGrid}>
              {[
                { v: scanResult.calories, l: 'Calories' },
                { v: `${scanResult.protein}g`, l: 'Protein' },
                { v: `${scanResult.carbs}g`, l: 'Carbs' },
                { v: `${scanResult.fat}g`, l: 'Fat' },
              ].map((n, i) => (
                <View key={i} style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{n.v}</Text>
                  <Text style={styles.nutritionLabel}>{n.l}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ gap: 12, marginTop: 16 }}>
            <PrimaryButton title="Add to Log" onPress={addToMeal} />
            <PrimaryButton title="Scan Another" variant="outline" onPress={() => { setScanResult(null); setIsScanning(true); }} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        onBarcodeScanned={handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'code128'],
        }}>
        <View style={styles.overlay}>
          <ScreenHeader title="Scan Barcode" showBack transparent />
          <View style={styles.scanArea}>
            <View style={styles.scanFrame} />
            <Text style={styles.hint}>Point camera at barcode</Text>
          </View>
          {isLookingUp ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color="#FFFFFF" size="large" />
              <Text style={styles.loadingText}>Looking up product...</Text>
            </View>
          ) : null}
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  camera: { flex: 1 },
  overlay: { flex: 1 },
  scanArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanFrame: {
    width: 260, height: 160,
    borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 16,
  },
  hint: { color: '#FFFFFF', marginTop: 12, fontSize: 14 },
  loadingOverlay: {
    position: 'absolute', inset: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  loadingText: { color: '#FFFFFF', marginTop: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  permWrap: { flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center', gap: 12 },
  permTitle: { fontSize: 20, fontWeight: '700', color: '#000000', textAlign: 'center' },
  permText: { fontSize: 14, color: '#666666', textAlign: 'center', lineHeight: 20 },
  resultCard: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDDDDD',
    borderRadius: 16, padding: 20,
  },
  productName: { fontSize: 22, fontWeight: '700', color: '#000000' },
  brandName: { fontSize: 14, color: '#666666', marginTop: 4 },
  barcodeText: { fontSize: 12, color: '#888888', marginTop: 8 },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 16 },
  nutritionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nutritionItem: {
    flex: 1, minWidth: '45%',
    padding: 12,
    borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 10,
    alignItems: 'center',
  },
  nutritionValue: { color: '#000000', fontSize: 18, fontWeight: '700' },
  nutritionLabel: { color: '#666666', fontSize: 12, marginTop: 2 },
});
